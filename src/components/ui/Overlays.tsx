import { useCallback, useMemo, useRef } from 'react';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import type { CameraPreset } from '@/types';
import { useEditor } from '@/store/editorStore';
import { useUI } from '@/store/uiStore';
import { resolveCatalogItem } from '@/data/catalog';
import { instanceRect } from '@/utils/placement';
import { rectCorners } from '@/utils/collision';
import { Icon } from './Icon';
import { IconButton, Tooltip } from './primitives';

/**
 * Floating viewport overlays: contextual toolbar, minimap, camera presets and
 * the day/night control.
 *
 * All of them are `position: absolute` over a full-bleed canvas — the viewport
 * is never boxed in by chrome, which is what makes a 3D tool feel like a
 * workspace instead of a widget.
 */

// ── Bottom-centre context toolbar ────────────────────────────────────────

/**
 * Appears only when something is selected. This is where Figma and Blender put
 * contextual actions, and it is why their sidebars stay calm: the things you
 * reach for constantly live under your cursor, not in a panel.
 */
export function ContextToolbar() {
  const selection = useEditor((s) => s.selection);
  const furniture = useEditor((s) => s.doc.furniture);
  const rotateSelection = useEditor((s) => s.rotateSelection);
  const duplicateSelection = useEditor((s) => s.duplicateSelection);
  const deleteSelection = useEditor((s) => s.deleteSelection);
  const setLocked = useEditor((s) => s.setLocked);
  const setVisible = useEditor((s) => s.setVisible);
  const clearSelection = useEditor((s) => s.clearSelection);
  const presentation = useUI((s) => s.presentationMode);
  const reducedMotion = useUI((s) => s.reducedMotion);

  const selected = useMemo(
    () => furniture.filter((f) => selection.includes(f.instanceId)),
    [furniture, selection]
  );

  const anyLocked = selected.some((f) => f.locked);
  const anyHidden = selected.some((f) => !f.visible);
  const label =
    selected.length === 1
      ? resolveCatalogItem(selected[0].catalogId).name
      : `${selected.length} items`;

  return (
    <AnimatePresence>
      {selection.length > 0 && !presentation && (
        <motion.div
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          role="toolbar"
          aria-label={`Actions for ${label}`}
          className="glass pointer-events-auto absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-panel p-1.5 shadow-medium"
        >
          <span className="max-w-[12rem] truncate px-2 text-caption font-medium text-ink-700 dark:text-ink-200">
            {label}
          </span>
          <span className="mx-0.5 h-6 w-px bg-ink-200 dark:bg-ink-700" />

          <IconButton
            size="sm"
            icon="rotate"
            label="Rotate 90° (R)"
            disabled={anyLocked}
            onClick={() => rotateSelection(90)}
          />
          <IconButton
            size="sm"
            icon="copy"
            label="Duplicate (Ctrl+D)"
            onClick={() => duplicateSelection()}
          />
          <IconButton
            size="sm"
            icon={anyLocked ? 'unlock' : 'lock'}
            label={anyLocked ? 'Unlock' : 'Lock'}
            active={anyLocked}
            onClick={() => setLocked(selection, !anyLocked)}
          />
          <IconButton
            size="sm"
            icon={anyHidden ? 'eye-off' : 'eye'}
            label={anyHidden ? 'Show' : 'Hide'}
            active={anyHidden}
            onClick={() => setVisible(selection, anyHidden)}
          />
          <IconButton
            size="sm"
            icon="trash"
            label="Delete (Del)"
            disabled={anyLocked}
            onClick={deleteSelection}
          />
          <span className="mx-0.5 h-6 w-px bg-ink-200 dark:bg-ink-700" />
          <IconButton size="sm" icon="close" label="Deselect (Esc)" onClick={clearSelection} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Minimap ───────────────────────────────────────────────────────────────

const MAP_SIZE = 160;

/**
 * Bottom-left plan view. Low opacity until hovered so it never competes with
 * the scene, and clicking it re-centres the camera on that part of the room.
 */
export function MiniMap() {
  const doc = useEditor((s) => s.doc);
  const selection = useEditor((s) => s.selection);
  const select = useEditor((s) => s.select);
  const setCameraPreset = useUI((s) => s.setCameraPreset);
  const presentation = useUI((s) => s.presentationMode);
  const svgRef = useRef<SVGSVGElement>(null);

  const { width, length } = doc.room.dimensions;
  const pad = 8;
  const scale = Math.min(
    (MAP_SIZE - pad * 2) / Math.max(width, 0.1),
    (MAP_SIZE - pad * 2) / Math.max(length, 0.1)
  );

  // Room-space (metres, origin centre) → SVG space (pixels, origin top-left).
  const toSvg = useCallback(
    (x: number, z: number) => ({
      x: MAP_SIZE / 2 + x * scale,
      y: MAP_SIZE / 2 + z * scale,
    }),
    [scale]
  );

  const shapes = useMemo(
    () =>
      doc.furniture
        .filter((f) => f.visible)
        .map((f) => {
          const catalog = resolveCatalogItem(f.catalogId);
          const points = rectCorners(instanceRect(f, catalog))
            .map((c) => {
              const p = toSvg(c.x, c.z);
              return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
            })
            .join(' ');
          return {
            id: f.instanceId,
            points,
            color: f.colorOverride ?? catalog.finishes[0]?.color ?? '#a3b18a',
            selected: selection.includes(f.instanceId),
          };
        }),
    [doc.furniture, selection, toSvg]
  );

  if (presentation) return null;

  const roomTL = toSvg(-width / 2, -length / 2);
  const roomBR = toSvg(width / 2, length / 2);

  return (
    <div className="pointer-events-auto absolute bottom-6 left-6 z-20 opacity-55 transition-opacity duration-200 hover:opacity-100 focus-within:opacity-100">
      <svg
        ref={svgRef}
        width={MAP_SIZE}
        height={MAP_SIZE}
        viewBox={`0 0 ${MAP_SIZE} ${MAP_SIZE}`}
        role="img"
        aria-label={`Plan view of ${doc.name}, ${doc.furniture.length} items placed`}
        className="rounded-panel border border-ink-200/80 bg-white/85 shadow-medium backdrop-blur-[12px] dark:border-ink-700/80 dark:bg-ink-900/85"
      >
        <rect
          x={roomTL.x}
          y={roomTL.y}
          width={roomBR.x - roomTL.x}
          height={roomBR.y - roomTL.y}
          className="fill-sage-50 stroke-sage-700 dark:fill-ink-800"
          strokeWidth={1.5}
        />

        {/* Openings, drawn as gaps in the wall line */}
        {doc.room.openings.map((o) => {
          const half = o.width / 2;
          const a =
            o.wall === 'north' || o.wall === 'south'
              ? toSvg(-width / 2 + o.offset - half, o.wall === 'north' ? -length / 2 : length / 2)
              : toSvg(o.wall === 'west' ? -width / 2 : width / 2, -length / 2 + o.offset - half);
          const b =
            o.wall === 'north' || o.wall === 'south'
              ? toSvg(-width / 2 + o.offset + half, o.wall === 'north' ? -length / 2 : length / 2)
              : toSvg(o.wall === 'west' ? -width / 2 : width / 2, -length / 2 + o.offset + half);
          return (
            <line
              key={o.id}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={o.kind === 'door' ? '#588157' : '#7aa5c4'}
              strokeWidth={3}
              strokeLinecap="round"
            />
          );
        })}

        {shapes.map((s) => (
          <polygon
            key={s.id}
            points={s.points}
            fill={s.color}
            fillOpacity={s.selected ? 0.95 : 0.7}
            stroke={s.selected ? '#344e41' : 'rgba(52,78,65,0.35)'}
            strokeWidth={s.selected ? 1.6 : 0.8}
            className="cursor-pointer"
            onClick={() => select(s.id)}
          />
        ))}
      </svg>

      <div className="mt-1.5 flex justify-center">
        <Tooltip content="Jump to top-down view">
          <button
            type="button"
            onClick={() => setCameraPreset('top')}
            className="rounded-control bg-white/85 px-2 py-0.5 text-[11px] text-ink-500 shadow-subtle backdrop-blur transition-colors duration-150 hover:text-ink-800 dark:bg-ink-900/85 dark:text-ink-400"
          >
            Plan view
          </button>
        </Tooltip>
      </div>
    </div>
  );
}

// ── Camera presets & environment ─────────────────────────────────────────

const PRESETS: Array<{ value: CameraPreset; label: string }> = [
  { value: 'corner', label: 'Corner' },
  { value: 'front', label: 'Front' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'top', label: 'Top' },
];

export function ViewportControls() {
  const cameraPreset = useUI((s) => s.cameraPreset);
  const setCameraPreset = useUI((s) => s.setCameraPreset);
  const timeOfDay = useUI((s) => s.timeOfDay);
  const setTimeOfDay = useUI((s) => s.setTimeOfDay);
  const lightIntensity = useUI((s) => s.lightIntensity);
  const setLightIntensity = useUI((s) => s.setLightIntensity);
  const presentation = useUI((s) => s.presentationMode);
  const viewMode = useUI((s) => s.viewMode);
  const measureToolActive = useUI((s) => s.measureToolActive);
  const toggleMeasureTool = useUI((s) => s.toggleMeasureTool);
  const setMeasureToolActive = useUI((s) => s.setMeasureToolActive);

  if (presentation) return null;

  return (
    <>
      {measureToolActive && (
        <div className="glass pointer-events-auto absolute left-1/2 top-4 z-30 flex -translate-x-1/2 items-center gap-3 rounded-panel border border-emerald-500/40 bg-white/95 px-4 py-2 text-caption font-medium shadow-medium dark:bg-ink-900/95">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-ink-800 dark:text-sage-50">
            Tape Measure: Click two points to measure distance · Press <kbd className="rounded border border-ink-300 px-1 py-0.5 font-mono text-[10px] dark:border-ink-700">Esc</kbd> to exit
          </span>
          <button
            type="button"
            onClick={() => setMeasureToolActive(false)}
            className="rounded-control p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800 dark:hover:text-sage-100"
            aria-label="Close measure tool"
          >
            <Icon name="close" className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="pointer-events-auto absolute right-6 top-6 z-20 flex flex-col items-end gap-2">
        <div className="flex items-center gap-2">
          <div className="glass flex items-center p-1 rounded-panel shadow-subtle">
            <IconButton
              size="sm"
              icon="ruler"
              label={measureToolActive ? 'Deactivate tape measure (M)' : 'Tape measure (M)'}
              active={measureToolActive}
              onClick={toggleMeasureTool}
            />
          </div>

          {viewMode !== 'walk' && (
            <div className="glass flex items-center gap-0.5 rounded-panel p-1 shadow-subtle">
              {PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setCameraPreset(p.value)}
                  aria-pressed={cameraPreset === p.value}
                  className={clsx(
                    'rounded-[4px] px-2.5 py-1 text-[11px] font-medium transition-colors duration-150',
                    cameraPreset === p.value
                      ? 'bg-sage-700 text-sage-50'
                      : 'text-ink-500 hover:bg-ink-100 hover:text-ink-800 dark:text-ink-400 dark:hover:bg-ink-800'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="glass flex items-center gap-2 rounded-panel px-2 py-1.5 shadow-subtle">
          <IconButton
            size="sm"
            icon={timeOfDay === 'day' ? 'sun' : 'moon'}
            label={timeOfDay === 'day' ? 'Switch to night lighting' : 'Switch to day lighting'}
            onClick={() => setTimeOfDay(timeOfDay === 'day' ? 'night' : 'day')}
          />
          <input
            type="range"
            min={0}
            max={2}
            step={0.05}
            value={lightIntensity}
            onChange={(e) => setLightIntensity(Number(e.target.value))}
            aria-label="Light intensity"
            className="h-1 w-24 cursor-pointer appearance-none rounded-full bg-ink-200 accent-sage-600 dark:bg-ink-700"
          />
          <span className="w-8 text-right text-[11px] tabular-nums text-ink-400">
            {Math.round(lightIntensity * 100)}%
          </span>
        </div>

        {viewMode === 'walk' && (
          <div className="glass rounded-panel px-3 py-2 text-[11px] text-ink-500 shadow-subtle dark:text-ink-400">
            <strong className="font-semibold text-ink-700 dark:text-ink-200">Walkthrough</strong>
            <br />
            W/A/S/D to move · Q/E or ←/→ to turn · Shift to run
          </div>
        )}
      </div>
    </>
  );
}

// ── Presentation mode banner ─────────────────────────────────────────────

export function PresentationExit() {
  const presentation = useUI((s) => s.presentationMode);
  const setPresentation = useUI((s) => s.setPresentationMode);

  if (!presentation) return null;

  return (
    <button
      type="button"
      onClick={() => setPresentation(false)}
      className="glass pointer-events-auto absolute right-6 top-6 z-30 flex items-center gap-2 rounded-panel px-3 py-2 text-caption font-medium text-ink-700 shadow-medium transition-colors duration-150 hover:text-ink-900 dark:text-ink-200"
    >
      <Icon name="close" className="h-4 w-4" />
      Exit presentation
    </button>
  );
}
