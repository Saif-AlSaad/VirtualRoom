import { useEffect, useRef } from 'react';
import { useEditor } from '@/store/editorStore';
import { useProjects } from '@/store/projectsStore';
import { useUI } from '@/store/uiStore';
import { writeAutosave } from '@/utils/storage';

/**
 * Debounced autosave with crash recovery.
 *
 * Writes on a 900 ms trailing debounce so a drag produces one save rather than
 * sixty, and again on `pagehide` so closing the tab mid-edit does not lose the
 * last change. Every write goes to two places: the named project record and a
 * single rolling autosave slot. If the named write fails (quota), the autosave
 * slot may still hold the newest state, which is what the dashboard's recovery
 * banner reads.
 *
 * A failed save is surfaced ONCE, not on every retry — a toast storm during an
 * out-of-quota condition helps nobody.
 */

const DEBOUNCE_MS = 900;

export function useAutosave(active: boolean): void {
  const saveProject = useProjects((s) => s.save);
  const toast = useUI((s) => s.toast);
  const timer = useRef<number>();
  const warned = useRef(false);

  useEffect(() => {
    if (!active) return;

    const flush = (reason: 'debounce' | 'unload') => {
      const editor = useEditor.getState();
      // Nothing changed since the last successful write.
      if (editor.revision === editor.lastSavedRevision) return;

      const revision = editor.revision;
      const project = editor.toProject();

      // Autosave slot first: it is the recovery path, so it should be the most
      // likely of the two writes to have succeeded.
      writeAutosave(project);
      const result = saveProject(project);

      if (result.ok) {
        editor.markSaved(revision);
        warned.current = false;
        return;
      }

      editor.setSaveStatus('failed');
      if (!warned.current && reason === 'debounce') {
        warned.current = true;
        toast('Could not save this room', {
          description: result.error,
          tone: 'error',
        });
      }
    };

    // Subscribe to revision changes rather than re-running an effect per render.
    const unsubscribe = useEditor.subscribe((state, prev) => {
      if (state.revision === prev.revision) return;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => flush('debounce'), DEBOUNCE_MS);
    });

    // `pagehide` fires reliably on mobile Safari where `beforeunload` does not.
    const onHide = () => {
      window.clearTimeout(timer.current);
      flush('unload');
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') onHide();
    };
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearTimeout(timer.current);
      unsubscribe();
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      // Final flush so switching to the dashboard never loses the last edit.
      flush('unload');
    };
  }, [active, saveProject, toast]);
}

/** Watches connectivity so the save indicator can say "offline, saved locally". */
export function useOnlineStatus(): void {
  const setSaveStatus = useEditor((s) => s.setSaveStatus);

  useEffect(() => {
    const update = () => {
      const editor = useEditor.getState();
      if (editor.saveStatus === 'failed') return;
      if (!navigator.onLine) setSaveStatus('offline');
      else if (editor.revision === editor.lastSavedRevision) setSaveStatus('saved');
    };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, [setSaveStatus]);
}
