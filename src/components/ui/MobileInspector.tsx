import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEditor, useSelectedInstance } from '@/store/editorStore';
import { useUI } from '@/store/uiStore';
import { resolveCatalogItem } from '@/data/catalog';
import { instanceSize } from '@/utils/placement';
import { formatLength, unitLabel } from '@/utils/units';
import { formatCurrency } from '@/utils/exporters';
import { Icon } from './Icon';

/**
 * Bottom inspection card for Mobile / Tablet & Read-Only Viewer mode.
 *
 * Lets touch users inspect placed furniture (dimensions, price, finish, note)
 * by tapping items without accidentally dragging them across the room.
 */
export function MobileInspector() {
  const selected = useSelectedInstance();
  const clearSelection = useEditor((s) => s.clearSelection);
  const unit = useEditor((s) => s.doc.unit);
  const currency = useUI((s) => s.currency);
  const viewerMode = useUI((s) => s.viewerMode);
  const viewMode = useUI((s) => s.viewMode);

  const catalog = useMemo(
    () => (selected ? resolveCatalogItem(selected.catalogId) : null),
    [selected]
  );

  const size = useMemo(
    () => (selected && catalog ? instanceSize(selected, catalog) : null),
    [selected, catalog]
  );

  if (!selected || !catalog || !size || viewMode === 'walk') return null;

  const currentElevation = selected.elevation ?? catalog.elevation;
  const finish = catalog.finishes.find((f) => f.id === selected.finishId) ?? catalog.finishes[0];
  const color = selected.colorOverride ?? finish?.color ?? '#888888';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="glass pointer-events-auto absolute bottom-4 left-4 right-4 z-30 mx-auto max-w-md rounded-panel p-3.5 shadow-large border border-ink-200/60 dark:border-ink-700/60"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Swatch / Thumbnail indicator */}
            <div
              className="h-10 w-10 shrink-0 rounded-control border border-black/10 shadow-subtle dark:border-white/10"
              style={{ backgroundColor: color }}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-body font-semibold text-ink-900 dark:text-sage-50">
                  {catalog.name}
                </h3>
                {viewerMode && (
                  <span className="rounded bg-sage-500/15 px-1.5 py-0.5 text-[10px] font-medium text-sage-700 dark:text-sage-300">
                    Viewer
                  </span>
                )}
              </div>
              <p className="text-caption text-ink-500 dark:text-ink-400 capitalize">
                {catalog.category} • {formatCurrency(catalog.price, currency)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={clearSelection}
            aria-label="Close inspector"
            className="rounded-full p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>

        {/* Dimension & Elevation chips */}
        <div className="mt-3 flex flex-wrap gap-2 text-caption">
          <div className="flex items-center gap-1 rounded bg-ink-100 px-2 py-1 text-ink-700 dark:bg-ink-800 dark:text-ink-200">
            <span className="text-ink-400">Size:</span>
            <span className="font-medium">
              {formatLength(size.w, unit)} × {formatLength(size.d, unit)} × {formatLength(size.h, unit)}
            </span>
          </div>
          {currentElevation > 0 && (
            <div className="flex items-center gap-1 rounded bg-ink-100 px-2 py-1 text-ink-700 dark:bg-ink-800 dark:text-ink-200">
              <span className="text-ink-400">Elevation:</span>
              <span className="font-medium">
                {currentElevation.toFixed(2)} {unitLabel(unit)}
              </span>
            </div>
          )}
          {finish && (
            <div className="flex items-center gap-1 rounded bg-ink-100 px-2 py-1 text-ink-700 dark:bg-ink-800 dark:text-ink-200">
              <span className="text-ink-400">Finish:</span>
              <span className="font-medium">{finish.name}</span>
            </div>
          )}
        </div>

        {selected.note && (
          <p className="mt-2 text-caption text-ink-600 dark:text-ink-300 italic">
            "{selected.note}"
          </p>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
