import { AnimatePresence, motion } from 'framer-motion';
import { useEditor } from '@/store/editorStore';
import { useUI } from '@/store/uiStore';
import { Icon } from './Icon';
import { Button } from './primitives';

/**
 * First-run hint.
 *
 * Deliberately a single dismissible pointer rather than a multi-step tour:
 * the app's core action is "drag a thing into the room", and once someone has
 * done that they can discover the rest. It disappears for good the moment the
 * first item is placed, so it never nags anyone who already understood.
 */
export function Onboarding() {
  const furnitureCount = useEditor((s) => s.doc.furniture.length);
  const done = useUI((s) => s.onboardingDone);
  const complete = useUI((s) => s.completeOnboarding);
  const openModal = useUI((s) => s.openModal);
  const presentation = useUI((s) => s.presentationMode);
  const reducedMotion = useUI((s) => s.reducedMotion);

  const show = !done && furnitureCount === 0 && !presentation;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1], delay: 0.35 }}
          className="glass pointer-events-auto absolute left-1/2 top-1/2 z-30 w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-panel p-5 shadow-high"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-control bg-sage-700 text-sage-50">
            <Icon name="cube" className="h-[18px] w-[18px]" />
          </span>
          <h2 className="mt-3 text-section font-semibold text-ink-900 dark:text-sage-50">
            Drag a sofa in here to start
          </h2>
          <p className="mt-1.5 text-caption leading-relaxed text-ink-600 dark:text-ink-300">
            Pick anything from the catalog on the left and drag it onto the floor — or just
            press Enter on a card and it will find a free spot. Everything snaps to walls
            and warns you when items overlap.
          </p>

          <ul className="mt-3 flex flex-col gap-1.5 text-[11px] text-ink-500 dark:text-ink-400">
            <li className="flex items-center gap-2">
              <Icon name="rotate" className="h-3.5 w-3.5 shrink-0" />
              Press <Kbd>R</Kbd> to rotate the selection
            </li>
            <li className="flex items-center gap-2">
              <Icon name="ruler" className="h-3.5 w-3.5 shrink-0" />
              Arrow keys nudge by 10 cm, <Kbd>Shift</Kbd> for 50 cm
            </li>
            <li className="flex items-center gap-2">
              <Icon name="keyboard" className="h-3.5 w-3.5 shrink-0" />
              <button
                type="button"
                onClick={() => openModal('shortcuts')}
                className="underline underline-offset-2 hover:text-ink-800 dark:hover:text-sage-100"
              >
                See all shortcuts
              </button>
            </li>
          </ul>

          <Button variant="primary" size="sm" block className="mt-4" onClick={complete}>
            Got it
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-ink-300 bg-white px-1 font-mono text-[10px] text-ink-600 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-300">
      {children}
    </kbd>
  );
}
