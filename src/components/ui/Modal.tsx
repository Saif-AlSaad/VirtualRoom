import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { IconButton, Button } from './primitives';
import { useUI } from '@/store/uiStore';

/**
 * Accessible dialog.
 *
 * Implements the three things a hand-rolled modal almost always misses:
 *   1. focus moves INTO the dialog on open and RETURNS to the trigger on close;
 *   2. Tab is trapped inside while it is open;
 *   3. the background is inert to screen readers via aria-modal + a portal.
 *
 * Escape closes unless the dialog is destructive-confirm, where an accidental
 * keypress dismissing the question is fine but is never treated as a "yes".
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  theme?: 'auto' | 'studio';
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  theme = 'studio',
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();
  const reducedMotion = useUI((s) => s.reducedMotion);

  useEffect(() => {
    if (!open) return;
    restoreTo.current = document.activeElement as HTMLElement | null;

    // Defer so the panel exists before we look inside it for a focus target.
    const raf = requestAnimationFrame(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panelRef.current)?.focus();
    });

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = previousOverflow;
      restoreTo.current?.focus?.();
    };
  }, [open]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const nodes = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose]
  );

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descId : undefined}
            tabIndex={-1}
            onKeyDown={onKeyDown}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 4 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className={clsx(
              'relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-[18px]',
              theme === 'studio'
                ? 'border border-studio-border bg-studio-sidebar text-studio-text shadow-2xl outline-none'
                : 'border border-ink-200/80 bg-white shadow-high outline-none dark:border-studio-border dark:bg-studio-sidebar dark:shadow-2xl',
              size === 'sm' && 'max-w-md',
              size === 'md' && 'max-w-xl',
              size === 'lg' && 'max-w-3xl'
            )}
          >
            <header
              className={clsx(
                'flex items-start justify-between gap-4 px-6 py-5',
                theme === 'studio'
                  ? 'border-b border-studio-divider'
                  : 'border-b border-ink-100 dark:border-studio-divider'
              )}
            >
              <div className="min-w-0 pr-2">
                <h2
                  id={titleId}
                  className={clsx(
                    'text-base font-semibold tracking-tight',
                    theme === 'studio'
                      ? 'text-studio-text'
                      : 'text-ink-900 dark:text-studio-text'
                  )}
                >
                  {title}
                </h2>
                {description && (
                  <p
                    id={descId}
                    className={clsx(
                      'mt-1 text-xs leading-relaxed',
                      theme === 'studio'
                        ? 'text-studio-text-muted'
                        : 'text-ink-500 dark:text-studio-text-muted'
                    )}
                  >
                    {description}
                  </p>
                )}
              </div>
              <IconButton
                icon="close"
                label="Close dialog"
                onClick={onClose}
                size="sm"
                showTooltip={false}
                className={clsx(
                  'transition-colors',
                  theme === 'studio'
                    ? 'text-studio-text-dim hover:bg-studio-hover hover:text-studio-text'
                    : 'text-ink-400 hover:bg-ink-100 hover:text-ink-700 dark:text-studio-text-dim dark:hover:bg-studio-hover dark:hover:text-studio-text'
                )}
              />
            </header>

            <div className="scroll-thin flex-1 overflow-y-auto px-6 py-5">{children}</div>

            {footer && (
              <footer
                className={clsx(
                  'flex items-center justify-end gap-2.5 px-6 py-4',
                  theme === 'studio'
                    ? 'border-t border-studio-divider bg-studio-bg/70'
                    : 'border-t border-ink-100 bg-ink-50/50 dark:border-studio-divider dark:bg-studio-bg/60'
                )}
              >
                {footer}
              </footer>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/** Destructive-action confirmation. Never auto-focuses the confirm button. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Delete',
  tone = 'danger',
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant={tone}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-body text-ink-600 dark:text-ink-300">{message}</p>
    </Modal>
  );
}
