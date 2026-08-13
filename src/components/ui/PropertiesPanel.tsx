import { useMemo } from 'react';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import type { PlacementIssue } from '@/types';
import { useEditor } from '@/store/editorStore';
import { useUI } from '@/store/uiStore';
import { resolveCatalogItem } from '@/data/catalog';
import { QUICK_SWATCHES } from '@/data/finishes';
import { evaluatePlacement, indexIssues, instanceSize } from '@/utils/placement';
import { formatLength, fromDisplay, parseLength, toDisplay, unitLabel } from '@/utils/units';
import { formatCurrency } from '@/utils/exporters';
import { Icon } from './Icon';
import { Button, EmptyState, IconButton, NumberField, Section, SwatchGrid, Tooltip } from './primitives';
import { RoomPanel } from './RoomPanel';

/**
 * Right-hand inspector for the current selection.
 *
 * Sectioned rather than a flat list — Transform / Appearance / Actions — and
 * every numeric control pairs a slider with a typed input. Position and size
 * are shown in the project's display unit and parsed back through the same
 * `parseLength` used everywhere else, so `1.83`, `6'` and `72"` all work in any
 * box.
 *
 * When nothing is selected this becomes the room inspector rather than an empty
 * panel: there is always something useful to edit.
 */

function IssueList({ issues }: { issues: PlacementIssue[] }) {
  if (issues.length === 0) return null;

  return (
    <ul className="flex flex-col gap-1.5">
      {issues.map((issue, i) => (
        <li
          key={`${issue.code}-${i}`}
          className={clsx(
            'flex items-start gap-2 rounded-control px-2.5 py-2 text-caption',
            issue.severity === 'error'
              ? 'bg-danger/10 text-[#a92a2a] dark:text-[#fca5a5]'
              : 'bg-warn/10 text-[#8a5a05] dark:text-[#fcd34d]'
          )}
        >
          <Icon
            name={issue.severity === 'error' ? 'alert' : 'info'}
            className="mt-px h-3.5 w-3.5 shrink-0"
          />
          <span>
            {/* Severity is stated in words as well as colour. */}
            <strong className="font-semibold">
              {issue.severity === 'error' ? 'Error: ' : 'Warning: '}
            </strong>
            {issue.message}
          </span>
        </li>
      ))}
    </ul>
  );
}

function SelectionInspector() {
  const doc = useEditor((s) => s.doc);
  const selection = useEditor((s) => s.selection);
  const updateFurniture = useEditor((s) => s.updateFurniture);
  const beginGesture = useEditor((s) => s.beginGesture);
  const endGesture = useEditor((s) => s.endGesture);
  const duplicateSelection = useEditor((s) => s.duplicateSelection);
  const deleteSelection = useEditor((s) => s.deleteSelection);
  const setLocked = useEditor((s) => s.setLocked);
  const setVisible = useEditor((s) => s.setVisible);
  const groupSelection = useEditor((s) => s.groupSelection);
  const ungroupSelection = useEditor((s) => s.ungroupSelection);
  const currency = useUI((s) => s.currency);

  const unit = doc.unit;
  const instance = useMemo(
    () =>
      selection.length === 1
        ? doc.furniture.find((f) => f.instanceId === selection[0])
        : undefined,
    [selection, doc.furniture]
  );

  const issues = useMemo(() => {
    if (selection.length === 0) return [];
    const all = evaluatePlacement(doc, { subset: new Set(selection) });
    const map = indexIssues(all);
    return selection.flatMap((id) => map.get(id) ?? []);
  }, [doc, selection]);

  // ── Multi-selection: group actions only ────────────────────────────────
  if (selection.length > 1) {
    const anyLocked = doc.furniture.some(
      (f) => selection.includes(f.instanceId) && f.locked
    );
    const total = selection.reduce((sum, id) => {
      const f = doc.furniture.find((x) => x.instanceId === id);
      return sum + (f ? resolveCatalogItem(f.catalogId).price : 0);
    }, 0);

    return (
      <>
        <div className="border-b border-ink-200 px-4 py-3 dark:border-ink-800">
          <p className="text-body font-medium text-ink-900 dark:text-sage-50">
            {selection.length} items selected
          </p>
          <p className="text-caption text-ink-400">{formatCurrency(total, currency)} total</p>
        </div>

        {issues.length > 0 && (
          <Section title="Issues" icon="alert">
            <IssueList issues={issues} />
          </Section>
        )}

        <Section title="Actions" icon="layers">
          <div className="grid grid-cols-2 gap-2">
            <Button icon="copy" onClick={() => duplicateSelection()}>
              Duplicate
            </Button>
            <Button
              icon={anyLocked ? 'unlock' : 'lock'}
              onClick={() => setLocked(selection, !anyLocked)}
            >
              {anyLocked ? 'Unlock' : 'Lock'}
            </Button>
            <Button icon="layers" onClick={groupSelection}>
              Group
            </Button>
            <Button icon="layers" onClick={ungroupSelection}>
              Ungroup
            </Button>
          </div>
          <Button variant="danger" icon="trash" block onClick={deleteSelection}>
            Delete {selection.length} items
          </Button>
        </Section>
      </>
    );
  }

  if (!instance) return <RoomPanel />;

  const catalog = resolveCatalogItem(instance.catalogId);
  const size = instanceSize(instance, catalog);
  const [minScale, maxScale] = catalog.scaleRange;
  const halfW = doc.room.dimensions.width / 2;
  const halfL = doc.room.dimensions.length / 2;

  const commitPatch = (patch: Parameters<typeof updateFurniture>[1]) =>
    updateFurniture(instance.instanceId, patch);
  const livePatch = (patch: Parameters<typeof updateFurniture>[1]) =>
    updateFurniture(instance.instanceId, patch, true);

  return (
    <>
      <div className="flex items-start justify-between gap-2 border-b border-ink-200 px-4 py-3 dark:border-ink-800">
        <div className="min-w-0">
          <p className="truncate text-body font-medium text-ink-900 dark:text-sage-50">
            {catalog.name}
          </p>
          <p className="text-caption text-ink-400">
            {formatLength(size.w, unit)} × {formatLength(size.d, unit)} ×{' '}
            {formatLength(size.h, unit)}
          </p>
        </div>
        <div className="flex gap-1">
          <IconButton
            size="sm"
            icon={instance.visible ? 'eye' : 'eye-off'}
            label={instance.visible ? 'Hide item' : 'Show item'}
            active={!instance.visible}
            onClick={() => setVisible([instance.instanceId], !instance.visible)}
          />
          <IconButton
            size="sm"
            icon={instance.locked ? 'lock' : 'unlock'}
            label={instance.locked ? 'Unlock item' : 'Lock item'}
            active={instance.locked}
            onClick={() => setLocked([instance.instanceId], !instance.locked)}
          />
        </div>
      </div>

      {instance.locked && (
        <p className="flex items-center gap-2 bg-ink-100 px-4 py-2 text-caption text-ink-600 dark:bg-ink-800 dark:text-ink-300">
          <Icon name="lock" className="h-3.5 w-3.5" />
          Locked — unlock it to make changes.
        </p>
      )}

      {issues.length > 0 && (
        <Section title="Issues" icon="alert">
          <IssueList issues={issues} />
        </Section>
      )}

      <Section title="Transform" icon="ruler">
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="X"
            suffix={unitLabel(unit)}
            value={toDisplay(instance.position.x, unit)}
            min={toDisplay(-halfW, unit)}
            max={toDisplay(halfW, unit)}
            showSlider={false}
            disabled={instance.locked}
            format={(v) => v.toFixed(2)}
            parse={(t) => {
              const m = parseLength(t, unit);
              return m === null ? null : toDisplay(m, unit);
            }}
            onChange={(v) =>
              commitPatch({ position: { ...instance.position, x: fromDisplay(v, unit) } })
            }
          />
          <NumberField
            label="Z"
            suffix={unitLabel(unit)}
            value={toDisplay(instance.position.z, unit)}
            min={toDisplay(-halfL, unit)}
            max={toDisplay(halfL, unit)}
            showSlider={false}
            disabled={instance.locked}
            format={(v) => v.toFixed(2)}
            parse={(t) => {
              const m = parseLength(t, unit);
              return m === null ? null : toDisplay(m, unit);
            }}
            onChange={(v) =>
              commitPatch({ position: { ...instance.position, z: fromDisplay(v, unit) } })
            }
          />
        </div>

        <NumberField
          label="Rotation"
          suffix="°"
          value={Math.round(instance.rotation)}
          min={0}
          max={359}
          step={1}
          disabled={instance.locked}
          format={(v) => String(Math.round(v))}
          onChange={(v) => livePatch({ rotation: v })}
          onCommit={(v) => {
            // A slider drag is one undo step, not sixty.
            beginGesture('Rotate item');
            livePatch({ rotation: v });
            endGesture();
          }}
        />
        <div className="flex gap-1.5">
          {[0, 45, 90, 180, 270].map((deg) => (
            <button
              key={deg}
              type="button"
              disabled={instance.locked}
              onClick={() => commitPatch({ rotation: deg })}
              className="flex-1 rounded-control border border-ink-200 py-1 text-[11px] tabular-nums text-ink-600 transition-colors duration-150 hover:border-sage-400 hover:text-sage-700 disabled:opacity-40 dark:border-ink-700 dark:text-ink-300"
            >
              {deg}°
            </button>
          ))}
        </div>

        {minScale !== maxScale && (
          <NumberField
            label="Scale"
            suffix="%"
            value={Math.round(instance.scale.x * 100)}
            min={Math.round(minScale * 100)}
            max={Math.round(maxScale * 100)}
            step={1}
            disabled={instance.locked}
            format={(v) => String(Math.round(v))}
            onChange={(v) => {
              const s = v / 100;
              livePatch({ scale: { x: s, y: s, z: s } });
            }}
            onCommit={(v) => {
              const s = v / 100;
              beginGesture('Scale item');
              livePatch({ scale: { x: s, y: s, z: s } });
              endGesture();
            }}
          />
        )}
      </Section>

      <Section title="Appearance" icon="sparkle">
        {catalog.finishes.length > 1 && (
          <div className="flex flex-col gap-2">
            <span className="text-caption font-medium text-ink-500 dark:text-ink-400">
              Finish
            </span>
            <div role="radiogroup" aria-label="Finish" className="flex flex-col gap-1">
              {catalog.finishes.map((finish) => {
                const active = finish.id === instance.finishId && !instance.colorOverride;
                return (
                  <button
                    key={finish.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={instance.locked}
                    onClick={() =>
                      commitPatch({ finishId: finish.id, colorOverride: null })
                    }
                    className={clsx(
                      'flex items-center gap-2.5 rounded-control border px-2 py-1.5 text-left text-caption',
                      'transition-colors duration-150 disabled:opacity-40',
                      active
                        ? 'border-sage-500 bg-sage-50 text-sage-800 dark:bg-sage-900/30 dark:text-sage-100'
                        : 'border-ink-200 text-ink-600 hover:border-ink-300 dark:border-ink-700 dark:text-ink-300'
                    )}
                  >
                    <span
                      className="h-5 w-5 shrink-0 rounded border border-black/10"
                      style={{ backgroundColor: finish.color }}
                    />
                    <span className="flex-1">{finish.name}</span>
                    {active && <Icon name="check" className="h-3.5 w-3.5" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-caption font-medium text-ink-500 dark:text-ink-400">
              Custom colour
            </span>
            {instance.colorOverride && (
              <button
                type="button"
                onClick={() => commitPatch({ colorOverride: null })}
                className="text-[11px] text-sage-700 underline-offset-2 hover:underline dark:text-sage-300"
              >
                Reset
              </button>
            )}
          </div>
          <SwatchGrid
            label="Custom colour"
            colors={QUICK_SWATCHES.map((c) => ({ color: c, name: c }))}
            value={instance.colorOverride ?? ''}
            onChange={(color) => commitPatch({ colorOverride: color })}
          />
        </div>
      </Section>

      <Section title="Notes" icon="info" defaultOpen={false}>
        <textarea
          value={instance.note}
          onChange={(e) => livePatch({ note: e.target.value.slice(0, 500) })}
          onBlur={() => commitPatch({ note: instance.note })}
          onKeyDown={(e) => e.stopPropagation()}
          rows={3}
          placeholder="e.g. reuse existing, or check delivery access"
          aria-label="Note for this item"
          className="w-full resize-y rounded-control border border-ink-200 bg-white p-2 text-caption transition-colors duration-150 focus:border-sage-500 dark:border-ink-700 dark:bg-ink-800 dark:text-sage-50"
        />
      </Section>

      <Section title="Actions" icon="settings">
        <div className="grid grid-cols-2 gap-2">
          <Button icon="copy" onClick={() => duplicateSelection()}>
            Duplicate
          </Button>
          <Button variant="danger" icon="trash" onClick={deleteSelection} disabled={instance.locked}>
            Delete
          </Button>
        </div>
        <p className="text-[11px] text-ink-400">
          {catalog.availability === 'available' ? 'In catalog' : catalog.availability} ·{' '}
          {formatCurrency(catalog.price, currency)}
        </p>
      </Section>
    </>
  );
}

export function PropertiesPanel() {
  const open = useUI((s) => s.propertiesOpen);
  const setOpen = useUI((s) => s.setPropertiesOpen);
  const reducedMotion = useUI((s) => s.reducedMotion);
  const selection = useEditor((s) => s.selection);
  const furnitureCount = useEditor((s) => s.doc.furniture.length);

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.aside
          key="properties"
          initial={reducedMotion ? { opacity: 0 } : { x: 320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={reducedMotion ? { opacity: 0 } : { x: 320, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          aria-label="Properties"
          className="z-20 flex h-full w-[320px] shrink-0 flex-col border-l border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900"
        >
          <div className="flex items-center justify-between border-b border-ink-200 px-4 py-2 dark:border-ink-800">
            <h2 className="text-caption font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">
              {selection.length === 0 ? 'Room' : 'Properties'}
            </h2>
            <IconButton
              size="sm"
              icon="chevron-right"
              label="Hide properties panel"
              onClick={() => setOpen(false)}
            />
          </div>

          <motion.div
            key={selection.join(',') || 'room'}
            initial={reducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut', staggerChildren: 0.03 }}
            className="scroll-thin flex-1 overflow-y-auto"
          >
            {selection.length === 0 && furnitureCount === 0 ? (
              <>
                <EmptyState
                  icon="cube"
                  title="Nothing selected"
                  description="Drag furniture in from the left, or select an object to edit it. Room settings are below."
                />
                <RoomPanel />
              </>
            ) : (
              <SelectionInspector />
            )}
          </motion.div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

/** Re-exported so the context toolbar can reuse the same tooltip wrapper. */
export { Tooltip };
