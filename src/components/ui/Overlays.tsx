import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import type { CameraPreset } from '@/types';
import { useEditor } from '@/store/editorStore';
import { useUI } from '@/store/uiStore';
import { resolveCatalogItem } from '@/data/catalog';
import { instanceRect } from '@/utils/placement';
import { rectCorners } from '@/utils/collision';
import { Icon } from './Icon';
import { IconButton, Switch, Tooltip } from './primitives';

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
  const alignSelection = useEditor((s) => s.alignSelection);
  const distributeSelection = useEditor((s) => s.distributeSelection);
  const snapSelectionToFace = useEditor((s) => s.snapSelectionToFace);
  const presentation = useUI((s) => s.presentationMode);
  const reducedMotion = useUI((s) => s.reducedMotion);
  const viewerMode = useUI((s) => s.viewerMode);
  const propertiesOpen = useUI((s) => s.propertiesOpen);

  const selected = useMemo(
    () => furniture.filter((f) => selection.includes(f.instanceId)),
    [furniture, selection]
  );

  // In read-only viewer mode, editing actions are hidden
  if (viewerMode) return null;

  const anyLocked = selected.some((f) => f.locked);
  const anyHidden = selected.some((f) => !f.visible);
  const label =
    selected.length === 1
      ? resolveCatalogItem(selected[0].catalogId).name
      : `${selected.length} items`;

  // When properties panel is closed on a single selection, MobileInspector is displayed underneath
  const hasInspectorBelow = !propertiesOpen && selected.length === 1;

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
          className={clsx(
            "glass pointer-events-auto absolute left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-panel p-1.5 shadow-medium transition-[bottom] duration-200",
            hasInspectorBelow ? "bottom-36" : "bottom-6"
          )}
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
          {selection.length > 1 && (
            <>
              <span className="mx-0.5 h-6 w-px bg-ink-200 dark:bg-ink-700" />
              <IconButton
                size="sm"
                icon="align-left"
                label="Align Left"
                onClick={() => alignSelection('left')}
              />
              <IconButton
                size="sm"
                icon="align-center"
                label="Align Center X"
                onClick={() => alignSelection('center-x')}
              />
              <IconButton
                size="sm"
                icon="align-right"
                label="Align Right"
                onClick={() => alignSelection('right')}
              />
              <IconButton
                size="sm"
                icon="distribute"
                label="Distribute Evenly"
                disabled={selection.length < 3}
                onClick={() => distributeSelection('auto')}
              />
              <IconButton
                size="sm"
                icon="snap-face"
                label="Snap to Face"
                onClick={() => snapSelectionToFace('auto')}
              />
            </>
          )}
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
  const cameraPreset = useUI((s) => s.cameraPreset);
  const planViewAngle = useUI((s) => s.planViewAngle);
  const setPlanViewAngle = useUI((s) => s.setPlanViewAngle);
  const rotatePlanView = useUI((s) => s.rotatePlanView);
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
    <div className="pointer-events-auto absolute bottom-6 left-6 z-20 opacity-75 transition-opacity duration-200 hover:opacity-100 focus-within:opacity-100">
      <div className="relative">
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

        {/* Cardinal orientation buttons */}
        <button
          type="button"
          onClick={() => setPlanViewAngle(0)}
          title="Align plan view North (0°)"
          aria-label="Align plan view North"
          className={clsx(
            "absolute left-1/2 top-1 -translate-x-1/2 rounded px-1 py-0.2 text-[9px] font-bold transition-all",
            cameraPreset === 'top' && planViewAngle === 0
              ? "bg-sage-600 text-white shadow-xs"
              : "text-ink-400 hover:text-ink-800 dark:hover:text-sage-300"
          )}
        >
          N
        </button>
        <button
          type="button"
          onClick={() => setPlanViewAngle(90)}
          title="Align plan view East (90°)"
          aria-label="Align plan view East"
          className={clsx(
            "absolute right-1 top-1/2 -translate-y-1/2 rounded px-1 py-0.2 text-[9px] font-bold transition-all",
            cameraPreset === 'top' && planViewAngle === 90
              ? "bg-sage-600 text-white shadow-xs"
              : "text-ink-400 hover:text-ink-800 dark:hover:text-sage-300"
          )}
        >
          E
        </button>
        <button
          type="button"
          onClick={() => setPlanViewAngle(180)}
          title="Align plan view South (180°)"
          aria-label="Align plan view South"
          className={clsx(
            "absolute bottom-1 left-1/2 -translate-x-1/2 rounded px-1 py-0.2 text-[9px] font-bold transition-all",
            cameraPreset === 'top' && planViewAngle === 180
              ? "bg-sage-600 text-white shadow-xs"
              : "text-ink-400 hover:text-ink-800 dark:hover:text-sage-300"
          )}
        >
          S
        </button>
        <button
          type="button"
          onClick={() => setPlanViewAngle(270)}
          title="Align plan view West (270°)"
          aria-label="Align plan view West"
          className={clsx(
            "absolute left-1 top-1/2 -translate-y-1/2 rounded px-1 py-0.2 text-[9px] font-bold transition-all",
            cameraPreset === 'top' && planViewAngle === 270
              ? "bg-sage-600 text-white shadow-xs"
              : "text-ink-400 hover:text-ink-800 dark:hover:text-sage-300"
          )}
        >
          W
        </button>
      </div>

      {/* Plan view & angle rotation controls */}
      <div className="mt-1.5 flex items-center justify-between gap-1 rounded-panel border border-ink-200/80 bg-white/90 p-1 shadow-subtle backdrop-blur dark:border-ink-700/80 dark:bg-ink-900/90">
        <Tooltip content="Rotate plan view -90° (Counter-clockwise)">
          <button
            type="button"
            onClick={() => rotatePlanView(-90)}
            aria-label="Rotate plan view counter-clockwise"
            className="flex h-6 w-6 items-center justify-center rounded-[4px] text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-white"
          >
            <Icon name="rotate-ccw" className="h-3.5 w-3.5" />
          </button>
        </Tooltip>

        <Tooltip content={`Plan view angle: ${planViewAngle}° (Click to cycle 90°)`}>
          <button
            type="button"
            onClick={() => {
              if (cameraPreset === 'top') {
                rotatePlanView(90);
              } else {
                setCameraPreset('top');
              }
            }}
            className={clsx(
              "flex flex-1 items-center justify-center gap-1 px-2 py-0.5 text-[11px] font-medium transition-colors duration-150 rounded-[4px]",
              cameraPreset === 'top'
                ? "bg-sage-700 text-sage-50 font-semibold shadow-xs"
                : "text-ink-600 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-white"
            )}
          >
            <span>Plan {planViewAngle > 0 ? `${planViewAngle}°` : 'view'}</span>
          </button>
        </Tooltip>

        <Tooltip content="Rotate plan view +90° (Clockwise)">
          <button
            type="button"
            onClick={() => rotatePlanView(90)}
            aria-label="Rotate plan view clockwise"
            className="flex h-6 w-6 items-center justify-center rounded-[4px] text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-white"
          >
            <Icon name="rotate" className="h-3.5 w-3.5" />
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

  const quality = useUI((s) => s.quality);
  const postFx = useUI((s) => s.postFx);
  const setPostFx = useUI((s) => s.setPostFx);

  const [fxOpen, setFxOpen] = useState(false);
  const fxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!fxOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (fxRef.current && !fxRef.current.contains(e.target as Node)) {
        setFxOpen(false);
      }
    };
    window.addEventListener('pointerdown', handleClick);
    return () => window.removeEventListener('pointerdown', handleClick);
  }, [fxOpen]);

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
          {/* Visual Effects & Fidelity Studio popover */}
          <div ref={fxRef} className="relative">
            <div className="glass flex items-center p-1 rounded-panel shadow-subtle">
              <IconButton
                size="sm"
                icon="sparkle"
                label="Studio Visual Fidelity (SSAO, Bloom, Reflections)"
                active={fxOpen || (postFx.enabled && quality !== 'performance')}
                onClick={() => setFxOpen(!fxOpen)}
              />
            </div>

            <AnimatePresence>
              {fxOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="glass absolute right-0 top-full z-40 mt-2 w-72 rounded-panel border border-ink-200/90 bg-white/95 p-3.5 shadow-elevated backdrop-blur-md dark:border-ink-700/90 dark:bg-ink-900/95"
                >
                  <div className="mb-3 flex items-center justify-between border-b border-ink-200 pb-2.5 dark:border-ink-800">
                    <div className="flex items-center gap-1.5">
                      <Icon name="sparkle" className="h-4 w-4 text-sage-600 dark:text-sage-400" />
                      <span className="text-caption font-semibold text-ink-900 dark:text-sage-50">
                        Studio Visual Fidelity
                      </span>
                    </div>
                    <span
                      className={clsx(
                        'rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                        postFx.enabled && quality !== 'performance'
                          ? 'bg-sage-600/10 text-sage-700 dark:bg-sage-500/20 dark:text-sage-300'
                          : 'bg-ink-200/50 text-ink-500 dark:bg-ink-800 dark:text-ink-400'
                      )}
                    >
                      {quality === 'performance'
                        ? 'Fast Mode'
                        : postFx.enabled
                          ? 'Active'
                          : 'Disabled'}
                    </span>
                  </div>

                  {quality === 'performance' && (
                    <div className="mb-3 rounded-control bg-warn/10 p-2 text-[11px] leading-snug text-warn">
                      Rendering quality is set to Fast. Set to Balanced or High in About & diagnostics to enable post-processing.
                    </div>
                  )}

                  <div className="flex flex-col gap-3 text-caption">
                    <Switch
                      label="Studio Post-Processing"
                      description="Master switch for photorealistic camera passes"
                      checked={postFx.enabled}
                      onChange={(enabled) => setPostFx({ enabled })}
                    />

                    {postFx.enabled && quality !== 'performance' && (
                      <div className="flex flex-col gap-2.5 border-t border-ink-200/60 pt-2.5 dark:border-ink-800/60">
                        <Switch
                          label="Ambient Occlusion (SSAO)"
                          description="Grounds furniture & corners with contact shadows"
                          checked={postFx.ssao}
                          onChange={(ssao) => setPostFx({ ssao })}
                        />

                        {postFx.ssao && (
                          <div className="flex items-center justify-between pl-1">
                            <span className="text-[11px] text-ink-500 dark:text-ink-400">AO Strength</span>
                            <div className="flex items-center gap-2">
                              <input
                                type="range"
                                min={0.5}
                                max={2.5}
                                step={0.1}
                                value={postFx.aoIntensity}
                                onChange={(e) => setPostFx({ aoIntensity: Number(e.target.value) })}
                                className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-ink-200 accent-sage-600 dark:bg-ink-700"
                              />
                              <span className="w-6 text-right text-[10px] tabular-nums text-ink-400">
                                {postFx.aoIntensity.toFixed(1)}x
                              </span>
                            </div>
                          </div>
                        )}

                        <Switch
                          label="Studio Reflections (PBR)"
                          description="Physically-based radiance on glossy & metallic surfaces"
                          checked={postFx.reflections}
                          onChange={(reflections) => setPostFx({ reflections })}
                        />

                        <Switch
                          label="Architectural Bloom"
                          description="Soft light spill on windows & glowing lamps"
                          checked={postFx.bloom}
                          onChange={(bloom) => setPostFx({ bloom })}
                        />

                        {postFx.bloom && (
                          <div className="flex items-center justify-between pl-1">
                            <span className="text-[11px] text-ink-500 dark:text-ink-400">Bloom Glow</span>
                            <div className="flex items-center gap-2">
                              <input
                                type="range"
                                min={0.1}
                                max={1.5}
                                step={0.05}
                                value={postFx.bloomIntensity}
                                onChange={(e) => setPostFx({ bloomIntensity: Number(e.target.value) })}
                                className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-ink-200 accent-sage-600 dark:bg-ink-700"
                              />
                              <span className="w-6 text-right text-[10px] tabular-nums text-ink-400">
                                {postFx.bloomIntensity.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        )}

                        <Switch
                          label="Cinematic Vignette"
                          description="Subtle camera lens edge falloff"
                          checked={postFx.vignette}
                          onChange={(vignette) => setPostFx({ vignette })}
                        />
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

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
