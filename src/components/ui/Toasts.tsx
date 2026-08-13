import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { useUI } from '@/store/uiStore';
import { Icon, type IconName } from './Icon';

/**
 * Toast stack.
 *
 * Announced through an `aria-live="polite"` region so a screen reader hears
 * "Project saved" without the focus being yanked away. Errors do not auto-
 * dismiss (see `uiStore`) — a message the user never got a chance to read is
 * the same as no message at all.
 */

const TONE: Record<
  'info' | 'success' | 'error' | 'warning',
  { icon: IconName; accent: string }
> = {
  info: { icon: 'info', accent: 'text-ink-400' },
  success: { icon: 'check', accent: 'text-ok' },
  error: { icon: 'alert', accent: 'text-danger' },
  warning: { icon: 'alert', accent: 'text-warn' },
};

export function Toasts() {
  const toasts = useUI((s) => s.toasts);
  const dismiss = useUI((s) => s.dismissToast);
  const reducedMotion = useUI((s) => s.reducedMotion);

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed bottom-6 right-6 z-[110] flex w-[320px] flex-col gap-2"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const tone = TONE[toast.tone];
          return (
            <motion.div
              key={toast.id}
              layout={!reducedMotion}
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              role={toast.tone === 'error' ? 'alert' : 'status'}
              className="glass pointer-events-auto flex items-start gap-2.5 rounded-panel p-3 shadow-medium"
            >
              <Icon name={tone.icon} className={clsx('mt-0.5 h-4 w-4 shrink-0', tone.accent)} />
              <div className="min-w-0 flex-1">
                <p className="text-caption font-medium text-ink-800 dark:text-sage-50">
                  {toast.title}
                </p>
                {toast.description && (
                  <p className="mt-0.5 text-[11px] leading-relaxed text-ink-500 dark:text-ink-400">
                    {toast.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss notification"
                className="rounded-control p-0.5 text-ink-400 transition-colors duration-150 hover:text-ink-700 dark:hover:text-ink-200"
              >
                <Icon name="close" className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
