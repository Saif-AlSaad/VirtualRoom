import { useEffect } from 'react';
import { useEditor } from '@/store/editorStore';
import { useUI } from '@/store/uiStore';
import { useDrag } from '@/store/dragStore';

/**
 * Global keyboard shortcuts.
 *
 * Two rules govern everything here:
 *   1. Never fire while the user is typing. A `Delete` keypress in the room-name
 *      field must delete a character, not the sofa.
 *   2. Every shortcut has a mouse equivalent, and every mouse action that
 *      matters has a shortcut — the editor must be fully operable from the
 *      keyboard alone, including nudging objects into place.
 */

export interface ShortcutDoc {
  keys: string;
  label: string;
  group: string;
}

/** Single source of truth for the shortcuts dialog and this hook's behaviour. */
export const SHORTCUTS: ShortcutDoc[] = [
  { keys: 'Ctrl+Z', label: 'Undo', group: 'History' },
  { keys: 'Ctrl+Shift+Z', label: 'Redo', group: 'History' },
  { keys: 'Ctrl+Y', label: 'Redo (alternative)', group: 'History' },

  { keys: 'Delete', label: 'Delete selection', group: 'Editing' },
  { keys: 'Ctrl+D', label: 'Duplicate selection', group: 'Editing' },
  { keys: 'Ctrl+A', label: 'Select everything', group: 'Editing' },
  { keys: 'Escape', label: 'Deselect / cancel drag', group: 'Editing' },
  { keys: 'Ctrl+G', label: 'Group selection', group: 'Editing' },
  { keys: 'L', label: 'Lock or unlock selection', group: 'Editing' },
  { keys: 'H', label: 'Hide or show selection', group: 'Editing' },

  { keys: '↑ ↓ ← →', label: 'Nudge by 10 cm', group: 'Movement' },
  { keys: 'Shift+↑', label: 'Nudge by 50 cm', group: 'Movement' },
  { keys: 'Alt+↑', label: 'Nudge by 1 cm', group: 'Movement' },
  { keys: 'R', label: 'Rotate 90° clockwise', group: 'Movement' },
  { keys: 'Shift+R', label: 'Rotate 90° anticlockwise', group: 'Movement' },
  { keys: 'Alt+drag', label: 'Move ignoring snapping', group: 'Movement' },

  { keys: '1', label: '3D view', group: 'View' },
  { keys: '2', label: 'Top-down 2D view', group: 'View' },
  { keys: '3', label: 'Walkthrough', group: 'View' },
  { keys: 'N', label: 'Toggle day / night', group: 'View' },
  { keys: 'G', label: 'Toggle grid', group: 'View' },
  { keys: 'C', label: 'Toggle clearance zones', group: 'View' },
  { keys: 'B', label: 'Toggle catalog sidebar', group: 'View' },
  { keys: 'P', label: 'Toggle properties panel', group: 'View' },

  { keys: 'Ctrl+F', label: 'Search the catalog', group: 'General' },
  { keys: '?', label: 'Show this list', group: 'General' },
];

/** True when a keystroke belongs to a text field rather than the editor. */
function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  return /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
}

export function useKeyboardShortcuts(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;

      const editor = useEditor.getState();
      const ui = useUI.getState();
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key;
      const lower = key.toLowerCase();

      // ── History ────────────────────────────────────────────────────────
      if (mod && lower === 'z') {
        event.preventDefault();
        const label = event.shiftKey ? editor.redo() : editor.undo();
        if (label) {
          ui.toast(`${event.shiftKey ? 'Redid' : 'Undid'} ${label.toLowerCase()}`);
        }
        return;
      }
      if (mod && lower === 'y') {
        event.preventDefault();
        const label = editor.redo();
        if (label) ui.toast(`Redid ${label.toLowerCase()}`);
        return;
      }

      // ── Selection ──────────────────────────────────────────────────────
      if (mod && lower === 'a') {
        event.preventDefault();
        editor.selectAll();
        return;
      }
      if (mod && lower === 'd') {
        event.preventDefault();
        const ids = editor.duplicateSelection();
        if (ids.length > 0) ui.toast(`Duplicated ${ids.length} item${ids.length === 1 ? '' : 's'}`);
        return;
      }
      if (mod && lower === 'g') {
        event.preventDefault();
        if (event.shiftKey) editor.ungroupSelection();
        else editor.groupSelection();
        return;
      }

      if (key === 'Escape') {
        // Escape unwinds the most recent thing first: a live drag, then a
        // modal, then presentation mode, then the selection.
        if (useDrag.getState().mode !== null) {
          editor.cancelGesture();
          useDrag.getState().end();
          return;
        }
        if (ui.modal !== null) {
          ui.closeModal();
          return;
        }
        if (ui.presentationMode) {
          ui.setPresentationMode(false);
          return;
        }
        editor.clearSelection();
        return;
      }

      if (key === 'Delete' || key === 'Backspace') {
        if (editor.selection.length === 0) return;
        event.preventDefault();
        editor.deleteSelection();
        return;
      }

      // Everything below is unmodified single keys.
      if (mod || event.altKey) {
        // …except Alt+arrows, the fine-nudge modifier.
        if (!event.altKey || !key.startsWith('Arrow')) return;
      }

      // ── Movement ───────────────────────────────────────────────────────
      if (key.startsWith('Arrow')) {
        if (editor.selection.length === 0) return;
        event.preventDefault();
        const step = event.shiftKey ? 0.5 : event.altKey ? 0.01 : 0.1;
        const delta = { x: 0, z: 0 };
        if (key === 'ArrowUp') delta.z = -step;
        if (key === 'ArrowDown') delta.z = step;
        if (key === 'ArrowLeft') delta.x = -step;
        if (key === 'ArrowRight') delta.x = step;
        editor.moveSelection(delta);
        return;
      }

      switch (lower) {
        case 'r':
          if (editor.selection.length === 0) return;
          event.preventDefault();
          editor.rotateSelection(event.shiftKey ? -90 : 90);
          return;
        case 'l': {
          if (editor.selection.length === 0) return;
          const anyLocked = editor.doc.furniture.some(
            (f) => editor.selection.includes(f.instanceId) && f.locked
          );
          editor.setLocked(editor.selection, !anyLocked);
          return;
        }
        case 'h': {
          if (editor.selection.length === 0) return;
          const anyHidden = editor.doc.furniture.some(
            (f) => editor.selection.includes(f.instanceId) && !f.visible
          );
          editor.setVisible(editor.selection, anyHidden);
          return;
        }
        case '1':
          ui.setViewMode('3d');
          return;
        case '2':
          ui.setViewMode('2d');
          return;
        case '3':
          ui.setViewMode('walk');
          return;
        case 'n':
          ui.setTimeOfDay(ui.timeOfDay === 'day' ? 'night' : 'day');
          return;
        case 'g':
          ui.setShowGrid(!ui.showGrid);
          return;
        case 'c':
          ui.setShowClearance(!ui.showClearance);
          return;
        case 'b':
          ui.toggleCatalog();
          return;
        case 'p':
          ui.setPropertiesOpen(!ui.propertiesOpen);
          return;
        case '?':
          ui.openModal('shortcuts');
          return;
        default:
          if (key === '/' && event.shiftKey) ui.openModal('shortcuts');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
