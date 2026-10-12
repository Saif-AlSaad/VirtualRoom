import { useEffect, useState } from 'react';
import { MotionConfig } from 'framer-motion';
import { Dashboard } from './components/ui/Dashboard';
import { Editor } from './components/Editor';
import { Toasts } from './components/ui/Toasts';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useEditor } from '@/store/editorStore';
import { useProjects } from '@/store/projectsStore';
import { useUI } from '@/store/uiStore';
import { useTheme } from '@/hooks/useTheme';
import { consumeShareFromUrl } from '@/utils/shareLink';
import { getLastOpenProject } from '@/utils/storage';
import { storageAvailable } from '@/utils/storage';
import { initCustomCatalog } from '@/utils/customModelStorage';

/**
 * App root: theme, routing between dashboard and editor, and startup.
 *
 * STARTUP ORDER matters here. A share link in the URL always wins — someone who
 * clicked a link expects to see that room, not whatever they were editing last
 * week. Only when there is no link do we restore the last open project.
 */
export function App() {
  useTheme();

  const screen = useUI((s) => s.screen);
  const setScreen = useUI((s) => s.setScreen);
  const reducedMotion = useUI((s) => s.reducedMotion);
  const toast = useUI((s) => s.toast);

  const loadProject = useEditor((s) => s.loadProject);
  const openProject = useProjects((s) => s.open);
  const saveProject = useProjects((s) => s.save);

  const [booted, setBooted] = useState(false);

  useEffect(() => {
    if (booted) return;
    setBooted(true);

    // Hydrate persisted custom 3D models and catalog items into memory
    initCustomCatalog().catch(() => {});

    if (!storageAvailable()) {
      toast('Browser storage is unavailable', {
        description:
          'Private browsing or a blocked cookie setting. You can design normally, but nothing will be saved — export a project file to keep your work.',
        tone: 'warning',
      });
    }

    // 1. A share link takes priority over everything.
    const shared = consumeShareFromUrl();
    if (shared) {
      if (shared.ok) {
        // Give the imported copy its own identity so opening a link never
        // overwrites the sender's project on the recipient's machine.
        loadProject(shared.project);
        saveProject(shared.project);
        setScreen('editor');
        toast('Opened a shared room', {
          description:
            shared.warnings.length > 0
              ? shared.warnings[0]
              : 'This is your own copy — edits stay on this device.',
          tone: shared.warnings.length > 0 ? 'warning' : 'success',
        });
      } else {
        toast('Could not open that link', { description: shared.error, tone: 'error' });
      }
      return;
    }

    // 2. Otherwise restore the last project the user had open.
    const lastId = getLastOpenProject();
    if (lastId) {
      const project = openProject(lastId);
      if (project) {
        loadProject(project);
        setScreen('editor');
      }
    }
  }, [booted, loadProject, openProject, saveProject, setScreen, toast]);

  return (
    <ErrorBoundary>
      {/* One place decides whether the whole app animates. */}
      <MotionConfig reducedMotion={reducedMotion ? 'always' : 'never'}>
        <div className="h-full w-full">
          {screen === 'dashboard' ? <Dashboard /> : <Editor />}
          <Toasts />
        </div>
      </MotionConfig>
    </ErrorBoundary>
  );
}
