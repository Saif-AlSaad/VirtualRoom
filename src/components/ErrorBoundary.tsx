import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useEditor } from '@/store/editorStore';
import { exportJSON } from '@/utils/exporters';

/**
 * Top-level error boundary.
 *
 * The important part is not the apology screen — it is the "Download a backup"
 * button. The store still holds the user's room in memory when a render throws,
 * so the single most valuable thing this screen can do is let them rescue it
 * before reloading.
 */

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Structured so a production log drain can pick it up without parsing prose.
    console.error('[roomcraft] render error', {
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    });
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex h-full items-center justify-center bg-ink-50 p-6 dark:bg-ink-950">
        <div className="w-full max-w-lg rounded-modal border border-ink-200 bg-white p-6 shadow-high dark:border-ink-800 dark:bg-ink-900">
          <h1 className="text-title font-semibold text-ink-900 dark:text-sage-50">
            Something broke
          </h1>
          <p className="mt-2 text-body text-ink-600 dark:text-ink-300">
            RoomCraft hit an unexpected error and stopped rendering. Your room is still in
            memory — download a backup before reloading.
          </p>

          <pre className="scroll-thin mt-4 max-h-32 overflow-auto rounded-control bg-ink-100 p-3 font-mono text-[11px] text-ink-600 dark:bg-ink-800 dark:text-ink-300">
            {error.message}
          </pre>

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => {
                try {
                  exportJSON(useEditor.getState().toProject());
                } catch {
                  /* the backup is best-effort; reloading is still available */
                }
              }}
              className="h-9 flex-1 rounded-control bg-sage-700 px-4 text-body font-medium text-sage-50 transition-colors duration-150 hover:bg-sage-800"
            >
              Download a backup
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="h-9 rounded-control border border-ink-200 px-4 text-body font-medium text-ink-800 transition-colors duration-150 hover:bg-ink-50 dark:border-ink-700 dark:text-sage-50 dark:hover:bg-ink-800"
            >
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
