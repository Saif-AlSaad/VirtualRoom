import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import type { OpeningKind, Unit, WallSide } from '@/types';
import { useEditor } from '@/store/editorStore';
import { useUI } from '@/store/uiStore';
import {
  ACCENT_WALL_COLORS,
  FLOOR_COLORS,
  FLOOR_PATTERNS,
  FLOOR_PRESETS,
  WALL_COLORS,
  WALL_PATTERNS,
} from '@/data/finishes';
import { ROOM_LIMITS, evaluatePlacement, occupiedFloorArea, totalCost } from '@/utils/placement';
import { WALL_LABEL, WALL_SIDES, floorArea, wallLength } from '@/utils/roomGeometry';
import {
  formatArea,
  formatLength,
  formatLengthShort,
  fromDisplay,
  parseLength,
  toDisplay,
  unitLabel,
} from '@/utils/units';
import { formatCurrency } from '@/utils/exporters';
import { Icon, type IconName } from './Icon';
import { Button, ColorPicker, IconButton, Section, Segmented } from './primitives';

/**
 * Architectural room presets by unit system.
 */
const getPresets = (unit: Unit) =>
  unit === 'm'
    ? [
        { label: '3 × 3 m', w: 3.0, l: 3.0 },
        { label: '4 × 4.5 m', w: 4.0, l: 4.5 },
        { label: '5 × 6 m', w: 5.0, l: 6.0 },
        { label: '6 × 8 m', w: 6.0, l: 8.0 },
      ]
    : [
        { label: '10 × 10 ft', w: 3.048, l: 3.048 },
        { label: '12 × 14 ft', w: 3.658, l: 4.267 },
        { label: '15 × 18 ft', w: 4.572, l: 5.486 },
        { label: '18 × 24 ft', w: 5.486, l: 7.315 },
      ];

/**
 * Compact dimension input cell for paired CAD-style inputs (e.g. W x L, H x T).
 */
function CompactDimensionField({
  label,
  badge,
  value,
  min,
  max,
  step = 0.01,
  suffix,
  unit,
  onChange,
  onCommit,
}: {
  label: string;
  badge?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  unit: Unit;
  onChange: (val: number) => void;
  onCommit?: (val: number) => void;
}) {
  const [text, setText] = useState<string | null>(null);
  const display = toDisplay(value, unit);
  const displayMin = toDisplay(min, unit);
  const displayMax = toDisplay(max, unit);

  const commitText = () => {
    if (text === null) return;
    const metres = parseLength(text, unit);
    if (metres !== null) {
      const clamped = Math.max(min, Math.min(max, metres));
      onChange(clamped);
      onCommit?.(clamped);
    }
    setText(null);
  };

  return (
    <div className="flex flex-col gap-1.5 rounded-control border border-ink-200/80 bg-ink-50/50 p-2.5 transition-all focus-within:border-sage-500 focus-within:bg-white focus-within:ring-1 focus-within:ring-sage-500/20 dark:border-ink-700/60 dark:bg-ink-800/30 dark:focus-within:border-sage-500 dark:focus-within:bg-ink-850">
      <div className="flex items-center justify-between text-[11px]">
        <span className="flex items-center gap-1.5 font-medium text-ink-600 dark:text-ink-300">
          {badge && (
            <span className="flex h-4 w-4 items-center justify-center rounded bg-ink-200/70 text-[9px] font-bold text-ink-700 dark:bg-ink-700 dark:text-sage-200">
              {badge}
            </span>
          )}
          {label}
        </span>
        <span className="text-[10px] font-medium tabular-nums text-ink-400">
          {suffix ?? unitLabel(unit)}
        </span>
      </div>
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          value={text ?? display.toFixed(2)}
          onChange={(e) => setText(e.target.value)}
          onBlur={commitText}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') {
              setText(null);
              e.currentTarget.blur();
            }
            e.stopPropagation();
          }}
          className="h-7 w-full rounded border border-ink-200 bg-white px-2 text-caption font-medium tabular-nums text-ink-900 transition-colors focus:border-sage-500 focus:outline-none dark:border-ink-700 dark:bg-ink-900 dark:text-sage-50"
        />
      </div>
      <input
        type="range"
        min={displayMin}
        max={displayMax}
        step={step}
        value={display}
        onChange={(e) => {
          const val = Number(e.target.value);
          onChange(fromDisplay(val, unit));
        }}
        onPointerUp={() => onCommit?.(value)}
        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-ink-200 accent-sage-600 transition-opacity hover:opacity-100 dark:bg-ink-700"
      />
    </div>
  );
}

/**
 * Collapsible Opening card with compact layout and instant visual status.
 */
function OpeningCard({
  id,
  index,
  isExpanded,
  onToggle,
}: {
  id: string;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const doc = useEditor((s) => s.doc);
  const updateOpening = useEditor((s) => s.updateOpening);
  const removeOpening = useEditor((s) => s.removeOpening);
  const unit = doc.unit;

  const opening = doc.room.openings.find((o) => o.id === id);
  if (!opening) return null;

  const dims = doc.room.dimensions;
  const maxOffset = wallLength(opening.wall, dims);
  const isDoor = opening.kind === 'door';

  return (
    <div className="overflow-hidden rounded-panel border border-ink-200 bg-white transition-all duration-150 hover:border-ink-300 dark:border-ink-800 dark:bg-ink-900/90 dark:hover:border-ink-700">
      {/* Header Row */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        className="flex w-full items-center justify-between gap-2 p-2.5 text-left transition-colors hover:bg-ink-50/70 dark:hover:bg-ink-800/40"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className={clsx(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-control transition-colors',
              isDoor
                ? 'bg-sage-500/15 text-sage-700 dark:bg-sage-500/20 dark:text-sage-300'
                : 'bg-sky-500/15 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300'
            )}
          >
            <Icon name={isDoor ? 'door' : 'window'} className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-caption font-semibold text-ink-900 dark:text-sage-50">
                {isDoor ? 'Door' : 'Window'} {index + 1}
              </span>
            </div>
            <p className="truncate text-[11px] tabular-nums text-ink-400">
              {WALL_LABEL[opening.wall].split(' ')[0]} wall ·{' '}
              {formatLengthShort(opening.width, unit)} × {formatLengthShort(opening.height, unit)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <IconButton
            size="sm"
            icon="trash"
            label={`Delete ${opening.kind}`}
            onClick={(e) => {
              e.stopPropagation();
              removeOpening(opening.id);
            }}
          />
          <span className="p-1 text-ink-400">
            <Icon
              name="chevron-down"
              className={clsx(
                'h-3.5 w-3.5 transition-transform duration-200',
                isExpanded && '-rotate-180'
              )}
            />
          </span>
        </div>
      </button>

      {/* Expanded Controls */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="overflow-hidden border-t border-ink-100 dark:border-ink-800"
          >
            <div className="flex flex-col gap-3 bg-ink-50/50 p-3 dark:bg-ink-950/40">
              {/* Wall Selector */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-medium text-ink-500 dark:text-ink-400">
                  Wall placement
                </span>
                <div className="grid grid-cols-4 gap-1 rounded-control bg-ink-200/50 p-1 dark:bg-ink-800">
                  {WALL_SIDES.map((side) => {
                    const active = opening.wall === side;
                    const sideName = side.charAt(0).toUpperCase() + side.slice(1);
                    const compass =
                      side === 'north'
                        ? 'Back'
                        : side === 'south'
                          ? 'Front'
                          : side === 'east'
                            ? 'Right'
                            : 'Left';
                    return (
                      <button
                        key={side}
                        type="button"
                        onClick={() => updateOpening(opening.id, { wall: side })}
                        className={clsx(
                          'flex flex-col items-center justify-center rounded py-1 px-1 text-[11px] font-medium transition-all',
                          active
                            ? 'bg-white text-ink-900 shadow-subtle dark:bg-ink-700 dark:text-sage-50'
                            : 'text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-sage-100'
                        )}
                      >
                        <span className="font-semibold">{sideName}</span>
                        <span className="text-[9px] opacity-60">({compass})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Position Along Wall with Center action */}
              <div className="flex flex-col gap-1.5 rounded-control border border-ink-200/70 bg-white/80 p-2.5 shadow-subtle dark:border-ink-700/60 dark:bg-ink-900/60">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-medium text-ink-600 dark:text-ink-300">
                    Position along wall
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateOpening(opening.id, { offset: maxOffset / 2 })}
                      className="rounded bg-sage-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-sage-700 hover:bg-sage-500/20 dark:bg-sage-500/20 dark:text-sage-300"
                      title="Center along wall"
                    >
                      Center
                    </button>
                    <span className="tabular-nums font-semibold text-ink-800 dark:text-sage-50">
                      {toDisplay(opening.offset, unit).toFixed(2)} {unitLabel(unit)}
                    </span>
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={toDisplay(maxOffset, unit)}
                  step={0.01}
                  value={toDisplay(opening.offset, unit)}
                  onChange={(e) =>
                    updateOpening(
                      opening.id,
                      { offset: fromDisplay(Number(e.target.value), unit) },
                      true
                    )
                  }
                  onPointerUp={(e) =>
                    updateOpening(opening.id, {
                      offset: fromDisplay(Number(e.currentTarget.value), unit),
                    })
                  }
                  className="h-1 w-full cursor-pointer appearance-none rounded-full bg-ink-200 accent-sage-600 dark:bg-ink-700"
                />
                <div className="flex justify-between text-[10px] text-ink-400">
                  <span>Start (0.00)</span>
                  <span className="tabular-nums">
                    Max {toDisplay(maxOffset, unit).toFixed(2)} {unitLabel(unit)}
                  </span>
                </div>
              </div>

              {/* Dimensions: 2-column paired Width & Height */}
              <div className="grid grid-cols-2 gap-2">
                <CompactDimensionField
                  label="Width"
                  badge="W"
                  value={opening.width}
                  min={0.2}
                  max={maxOffset}
                  step={0.01}
                  unit={unit}
                  onChange={(w) => updateOpening(opening.id, { width: w }, true)}
                  onCommit={(w) => updateOpening(opening.id, { width: w })}
                />
                <CompactDimensionField
                  label="Height"
                  badge="H"
                  value={opening.height}
                  min={0.2}
                  max={dims.height}
                  step={0.01}
                  unit={unit}
                  onChange={(h) => updateOpening(opening.id, { height: h }, true)}
                  onCommit={(h) => updateOpening(opening.id, { height: h })}
                />
              </div>

              {/* Window: Sill Height */}
              {!isDoor && (
                <CompactDimensionField
                  label="Sill height"
                  badge="S"
                  value={opening.sillHeight}
                  min={0}
                  max={Math.max(0, dims.height - opening.height)}
                  step={0.01}
                  unit={unit}
                  onChange={(s) => updateOpening(opening.id, { sillHeight: s }, true)}
                  onCommit={(s) => updateOpening(opening.id, { sillHeight: s })}
                />
              )}

              {/* Door: Hinge & Swing */}
              {isDoor && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-medium text-ink-500 dark:text-ink-400">
                      Hinge
                    </span>
                    <Segmented
                      size="sm"
                      label="Hinge side"
                      value={opening.hinge}
                      options={[
                        { value: 'left', label: 'Left' },
                        { value: 'right', label: 'Right' },
                      ]}
                      onChange={(hinge) => updateOpening(opening.id, { hinge })}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-medium text-ink-500 dark:text-ink-400">
                      Swing
                    </span>
                    <Segmented
                      size="sm"
                      label="Swing direction"
                      value={opening.swing}
                      options={[
                        { value: 'in', label: 'In' },
                        { value: 'out', label: 'Out' },
                      ]}
                      onChange={(swing) => updateOpening(opening.id, { swing })}
                    />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * SVG texture thumbnails for wall and floor patterns.
 */
function PatternThumbnail({ id, className }: { id: string; className?: string }) {
  switch (id) {
    case 'brick':
      return (
        <svg viewBox="0 0 24 16" className={className} fill="none" stroke="currentColor" strokeWidth="1">
          <rect x="0" y="0" width="24" height="16" rx="2" fill="currentColor" fillOpacity="0.08" stroke="none" />
          <line x1="0" y1="5" x2="24" y2="5" />
          <line x1="0" y1="11" x2="24" y2="11" />
          <line x1="6" y1="0" x2="6" y2="5" />
          <line x1="18" y1="0" x2="18" y2="5" />
          <line x1="12" y1="5" x2="12" y2="11" />
          <line x1="6" y1="11" x2="6" y2="16" />
          <line x1="18" y1="11" x2="18" y2="16" />
        </svg>
      );
    case 'panels': // Slats
      return (
        <svg viewBox="0 0 24 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.2">
          <rect x="0" y="0" width="24" height="16" rx="2" fill="currentColor" fillOpacity="0.08" stroke="none" />
          <line x1="4" y1="0" x2="4" y2="16" />
          <line x1="8" y1="0" x2="8" y2="16" />
          <line x1="12" y1="0" x2="12" y2="16" />
          <line x1="16" y1="0" x2="16" y2="16" />
          <line x1="20" y1="0" x2="20" y2="16" />
        </svg>
      );
    case 'subway': // Tile
      return (
        <svg viewBox="0 0 24 16" className={className} fill="none" stroke="currentColor" strokeWidth="1">
          <rect x="0" y="0" width="24" height="16" rx="2" fill="currentColor" fillOpacity="0.08" stroke="none" />
          <line x1="0" y1="8" x2="24" y2="8" />
          <line x1="8" y1="0" x2="8" y2="8" />
          <line x1="16" y1="0" x2="16" y2="8" />
          <line x1="4" y1="8" x2="4" y2="16" />
          <line x1="12" y1="8" x2="12" y2="16" />
          <line x1="20" y1="8" x2="20" y2="16" />
        </svg>
      );
    case 'stripes':
      return (
        <svg viewBox="0 0 24 16" className={className} fill="none" stroke="currentColor" strokeWidth="1">
          <rect x="0" y="0" width="24" height="16" rx="2" fill="currentColor" fillOpacity="0.08" stroke="none" />
          <line x1="3" y1="0" x2="3" y2="16" strokeDasharray="2 1" />
          <line x1="9" y1="0" x2="9" y2="16" strokeDasharray="2 1" />
          <line x1="15" y1="0" x2="15" y2="16" strokeDasharray="2 1" />
          <line x1="21" y1="0" x2="21" y2="16" strokeDasharray="2 1" />
        </svg>
      );
    case 'concrete':
      return (
        <svg viewBox="0 0 24 16" className={className} fill="none">
          <rect x="0" y="0" width="24" height="16" rx="2" fill="currentColor" fillOpacity="0.12" />
          <circle cx="5" cy="4" r="0.75" fill="currentColor" opacity="0.6" />
          <circle cx="12" cy="7" r="1" fill="currentColor" opacity="0.6" />
          <circle cx="18" cy="4" r="0.75" fill="currentColor" opacity="0.6" />
          <circle cx="8" cy="12" r="0.8" fill="currentColor" opacity="0.6" />
          <circle cx="16" cy="11" r="0.9" fill="currentColor" opacity="0.6" />
        </svg>
      );
    case 'planks':
      return (
        <svg viewBox="0 0 24 16" className={className} fill="none" stroke="currentColor" strokeWidth="1">
          <rect x="0" y="0" width="24" height="16" rx="2" fill="currentColor" fillOpacity="0.08" stroke="none" />
          <line x1="0" y1="5.5" x2="24" y2="5.5" />
          <line x1="0" y1="10.5" x2="24" y2="10.5" />
          <line x1="7" y1="0" x2="7" y2="5.5" />
          <line x1="17" y1="5.5" x2="17" y2="10.5" />
          <line x1="10" y1="10.5" x2="10" y2="16" />
        </svg>
      );
    case 'herringbone':
      return (
        <svg viewBox="0 0 24 16" className={className} fill="none" stroke="currentColor" strokeWidth="1">
          <rect x="0" y="0" width="24" height="16" rx="2" fill="currentColor" fillOpacity="0.08" stroke="none" />
          <path d="M4 2 L12 8 L4 14" />
          <path d="M12 2 L20 8 L12 14" />
        </svg>
      );
    case 'tiles':
      return (
        <svg viewBox="0 0 24 16" className={className} fill="none" stroke="currentColor" strokeWidth="1">
          <rect x="0" y="0" width="24" height="16" rx="2" fill="currentColor" fillOpacity="0.08" stroke="none" />
          <line x1="8" y1="0" x2="8" y2="16" />
          <line x1="16" y1="0" x2="16" y2="16" />
          <line x1="0" y1="8" x2="24" y2="8" />
        </svg>
      );
    default: // plain / plaster
      return (
        <svg viewBox="0 0 24 16" className={className} fill="none">
          <rect x="0" y="0" width="24" height="16" rx="2" fill="currentColor" fillOpacity="0.1" />
        </svg>
      );
  }
}

/**
 * Visual partition creation tiles.
 */
const PARTITION_PRESETS = [
  {
    type: 'full' as const,
    label: 'Full Wall',
    sub: 'Floor to ceiling',
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="5" y="3" width="14" height="18" rx="1.5" fill="currentColor" fillOpacity="0.15" />
        <line x1="4" y1="21" x2="20" y2="21" strokeWidth="2" />
      </svg>
    ),
  },
  {
    type: 'half' as const,
    label: 'Half Wall',
    sub: '1.1m counter',
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="5" y="11" width="14" height="10" rx="1.5" fill="currentColor" fillOpacity="0.15" />
        <line x1="4" y1="21" x2="20" y2="21" strokeWidth="2" />
        <line x1="5" y1="11" x2="19" y2="11" strokeDasharray="2 2" strokeOpacity="0.6" />
      </svg>
    ),
  },
  {
    type: 'screen' as const,
    label: 'Divider',
    sub: 'Open screen',
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="5" y="4" width="14" height="17" rx="1.5" />
        <line x1="9.5" y1="4" x2="9.5" y2="21" />
        <line x1="14.5" y1="4" x2="14.5" y2="21" />
      </svg>
    ),
  },
];

// ── Guides & Snapping Switch ──────────────────────────────────────────────

interface StudioSwitchProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
  icon?: IconName;
  badge?: string;
  badgeVariant?: 'warn' | 'sage';
}

function StudioSwitch({
  checked,
  onChange,
  label,
  description,
  icon,
  badge,
  badgeVariant = 'sage',
}: StudioSwitchProps) {
  return (
    <motion.button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      whileHover={{ scale: 1.008 }}
      whileTap={{ scale: 0.985 }}
      className={clsx(
        'group flex w-full items-center justify-between gap-3 rounded-lg p-2 text-left transition-all duration-200',
        'border border-transparent hover:border-ink-200/70 dark:hover:border-ink-800/70',
        'hover:bg-ink-100/60 dark:hover:bg-ink-900/40',
        checked && 'bg-sage-50/50 dark:bg-sage-950/20'
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {icon && (
          <div
            className={clsx(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors duration-200',
              checked
                ? 'bg-sage-600/15 text-sage-600 dark:bg-sage-500/25 dark:text-sage-400'
                : 'bg-ink-100 text-ink-400 dark:bg-ink-800/80 dark:text-ink-500'
            )}
          >
            <Icon name={icon} className="h-3.5 w-3.5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className={clsx(
                'text-xs font-medium leading-tight transition-colors duration-150',
                checked
                  ? 'text-ink-900 dark:text-sage-100 font-semibold'
                  : 'text-ink-700 dark:text-ink-300'
              )}
            >
              {label}
            </span>
            {badge && (
              <span
                className={clsx(
                  'rounded px-1.5 py-0.5 text-[9px] font-semibold leading-none',
                  badgeVariant === 'warn'
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                    : 'bg-sage-500/15 text-sage-600 dark:text-sage-400 border border-sage-500/30'
                )}
              >
                {badge}
              </span>
            )}
          </div>
          {description && (
            <p className="truncate text-[10px] text-ink-400 dark:text-ink-500 leading-normal mt-0.5">
              {description}
            </p>
          )}
        </div>
      </div>

      {/* Animated Switch Track & Thumb */}
      <div
        className={clsx(
          'relative h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors duration-200 ease-out',
          checked
            ? 'bg-sage-600 dark:bg-sage-500 shadow-xs shadow-sage-600/30'
            : 'bg-ink-300 dark:bg-ink-700'
        )}
      >
        <motion.div
          animate={{ x: checked ? 16 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
          className="h-4 w-4 rounded-full bg-white shadow-xs"
        />
      </div>
    </motion.button>
  );
}

export function RoomPanel() {
  const doc = useEditor((s) => s.doc);
  const setRoomDimensions = useEditor((s) => s.setRoomDimensions);
  const setWallSideColor = useEditor((s) => s.setWallSideColor);
  const setWallSidePattern = useEditor((s) => s.setWallSidePattern);
  const resetWallSide = useEditor((s) => s.resetWallSide);
  const setFloor = useEditor((s) => s.setFloor);
  const setUnit = useEditor((s) => s.setUnit);
  const addOpening = useEditor((s) => s.addOpening);
  const addPartition = useEditor((s) => s.addPartition);
  const removePartition = useEditor((s) => s.removePartition);
  const select = useEditor((s) => s.select);
  const selection = useEditor((s) => s.selection);

  const currency = useUI((s) => s.currency);
  const showDimensions = useUI((s) => s.showDimensions);
  const setShowDimensions = useUI((s) => s.setShowDimensions);
  const showClearance = useUI((s) => s.showClearance);
  const setShowClearance = useUI((s) => s.setShowClearance);
  const showGrid = useUI((s) => s.showGrid);
  const setShowGrid = useUI((s) => s.setShowGrid);
  const selectedWallSide = useUI((s) => s.selectedWallSide);
  const setSelectedWallSide = useUI((s) => s.setSelectedWallSide);
  const snap = useUI((s) => s.snap);
  const setSnap = useUI((s) => s.setSnap);
  const openModal = useUI((s) => s.openModal);

  const unit = doc.unit;
  const dims = doc.room.dimensions;

  const area = floorArea(dims);
  const occupied = useMemo(() => occupiedFloorArea(doc.furniture), [doc.furniture]);
  const cost = useMemo(() => totalCost(doc.furniture), [doc.furniture]);
  const density = area > 0 ? Math.min(1, occupied / area) : 0;

  // Openings expanded state & filters
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const first = doc.room.openings[0];
    return first ? new Set([first.id]) : new Set();
  });
  const [openingFilter, setOpeningFilter] = useState<'all' | 'door' | 'window'>('all');
  const [finishTab, setFinishTab] = useState<'walls' | 'floor'>('walls');

  const clearanceIssueCount = useMemo(() => {
    if (!showClearance) return 0;
    const issues = evaluatePlacement(doc);
    return issues.filter((i) => i.code === 'clearance').length;
  }, [doc, showClearance]);

  const activeGuidesCount = (showDimensions ? 1 : 0) + (showClearance ? 1 : 0) + (showGrid ? 1 : 0);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddOpening = (kind: OpeningKind, wall: WallSide) => {
    const id = addOpening(kind, wall);
    if (id) {
      setExpandedIds((prev) => new Set([...prev, id]));
    }
  };

  const filteredOpenings = useMemo(() => {
    return doc.room.openings.filter((o) => {
      if (openingFilter === 'door') return o.kind === 'door';
      if (openingFilter === 'window') return o.kind === 'window';
      return true;
    });
  }, [doc.room.openings, openingFilter]);

  const presets = useMemo(() => getPresets(unit), [unit]);

  return (
    <>
      <Section
        title="Dimensions"
        icon="ruler"
        action={
          <span className="inline-flex items-center gap-1 rounded-full bg-sage-500/15 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-sage-700 dark:text-sage-300">
            {formatArea(area, unit)}
          </span>
        }
      >
        {/* Unit switch */}
        <div className="flex items-center justify-between">
          <span className="text-caption font-medium text-ink-500 dark:text-ink-400">Units</span>
          <Segmented
            size="sm"
            label="Measurement units"
            value={unit}
            options={[
              { value: 'm', label: 'Metres' },
              { value: 'ft', label: 'Feet' },
            ]}
            onChange={setUnit}
          />
        </div>

        {/* Floor dimensions: 2-column W & L */}
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-medium text-ink-500 dark:text-ink-400">
            Floor plan (Interior)
          </span>
          <div className="grid grid-cols-2 gap-2">
            <CompactDimensionField
              label="Width"
              badge="W"
              value={dims.width}
              min={ROOM_LIMITS.minWidth}
              max={ROOM_LIMITS.maxWidth}
              unit={unit}
              onChange={(w) => setRoomDimensions({ width: w })}
            />
            <CompactDimensionField
              label="Length"
              badge="L"
              value={dims.length}
              min={ROOM_LIMITS.minLength}
              max={ROOM_LIMITS.maxLength}
              unit={unit}
              onChange={(l) => setRoomDimensions({ length: l })}
            />
          </div>
        </div>

        {/* Quick Room Size Presets */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-ink-500 dark:text-ink-400">
              Room presets
            </span>
            <span className="text-[10px] text-ink-400">Standard footprints</span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {presets.map((p) => {
              const active =
                Math.abs(dims.width - p.w) < 0.05 && Math.abs(dims.length - p.l) < 0.05;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setRoomDimensions({ width: p.w, length: p.l })}
                  className={clsx(
                    'rounded-control border px-1.5 py-1 text-center text-[10px] font-medium transition-all',
                    active
                      ? 'border-sage-500 bg-sage-50 text-sage-800 shadow-subtle dark:bg-sage-950/60 dark:text-sage-200'
                      : 'border-ink-200/80 bg-white text-ink-600 hover:border-ink-300 hover:bg-ink-50 dark:border-ink-800 dark:bg-ink-900/60 dark:text-ink-300 dark:hover:bg-ink-800'
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Wall & Structural Specs: 2-column Height & Thickness */}
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-medium text-ink-500 dark:text-ink-400">
            Wall & vertical structure
          </span>
          <div className="grid grid-cols-2 gap-2">
            <CompactDimensionField
              label="Wall height"
              badge="H"
              value={dims.height}
              min={ROOM_LIMITS.minHeight}
              max={ROOM_LIMITS.maxHeight}
              unit={unit}
              onChange={(h) => setRoomDimensions({ height: h })}
            />
            <CompactDimensionField
              label="Thickness"
              badge="T"
              value={dims.wallThickness}
              min={ROOM_LIMITS.minWallThickness}
              max={ROOM_LIMITS.maxWallThickness}
              unit={unit}
              onChange={(t) => setRoomDimensions({ wallThickness: t })}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-control bg-ink-50/80 p-2 text-[11px] text-ink-500 dark:bg-ink-800/40 dark:text-ink-400">
          <Icon name="info" className="h-3.5 w-3.5 shrink-0 text-sage-600 dark:text-sage-400" />
          <span>Width and length are interior measurements — the usable floor.</span>
        </div>
      </Section>

      <Section
        title="Openings"
        icon="door"
        action={
          doc.room.openings.length > 0 ? (
            <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-ink-600 dark:bg-ink-800 dark:text-ink-300">
              {doc.room.openings.length}
            </span>
          ) : undefined
        }
      >
        {/* Quick Add Action Bar */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleAddOpening('door', 'south')}
            className={clsx(
              'group flex items-center justify-center gap-2 rounded-control border border-ink-200 bg-white px-3 py-2 text-caption font-medium shadow-subtle',
              'transition-all duration-150 hover:border-sage-500 hover:bg-sage-50/40 hover:text-sage-900',
              'dark:border-ink-700/80 dark:bg-ink-800/80 dark:text-sage-100 dark:hover:border-sage-500 dark:hover:bg-sage-950/40'
            )}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded bg-sage-500/15 text-sage-600 transition-colors group-hover:bg-sage-600 group-hover:text-white dark:text-sage-300">
              <Icon name="door" className="h-3.5 w-3.5" />
            </span>
            <span>+ Add Door</span>
          </button>
          <button
            type="button"
            onClick={() => handleAddOpening('window', 'north')}
            className={clsx(
              'group flex items-center justify-center gap-2 rounded-control border border-ink-200 bg-white px-3 py-2 text-caption font-medium shadow-subtle',
              'transition-all duration-150 hover:border-sky-500 hover:bg-sky-50/40 hover:text-sky-900',
              'dark:border-ink-700/80 dark:bg-ink-800/80 dark:text-sky-100 dark:hover:border-sky-500 dark:hover:bg-sky-950/40'
            )}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded bg-sky-500/15 text-sky-600 transition-colors group-hover:bg-sky-600 group-hover:text-white dark:text-sky-300">
              <Icon name="window" className="h-3.5 w-3.5" />
            </span>
            <span>+ Add Window</span>
          </button>
        </div>

        {/* Filter Pills if multiple openings */}
        {doc.room.openings.length > 1 && (
          <div className="flex items-center gap-1 rounded-control bg-ink-100 p-0.5 text-[11px] dark:bg-ink-800">
            <button
              type="button"
              onClick={() => setOpeningFilter('all')}
              className={clsx(
                'flex-1 rounded py-1 font-medium transition-all',
                openingFilter === 'all'
                  ? 'bg-white text-ink-900 shadow-subtle dark:bg-ink-700 dark:text-sage-50'
                  : 'text-ink-500 hover:text-ink-800 dark:text-ink-400'
              )}
            >
              All ({doc.room.openings.length})
            </button>
            <button
              type="button"
              onClick={() => setOpeningFilter('door')}
              className={clsx(
                'flex-1 rounded py-1 font-medium transition-all',
                openingFilter === 'door'
                  ? 'bg-white text-ink-900 shadow-subtle dark:bg-ink-700 dark:text-sage-50'
                  : 'text-ink-500 hover:text-ink-800 dark:text-ink-400'
              )}
            >
              Doors ({doc.room.openings.filter((o) => o.kind === 'door').length})
            </button>
            <button
              type="button"
              onClick={() => setOpeningFilter('window')}
              className={clsx(
                'flex-1 rounded py-1 font-medium transition-all',
                openingFilter === 'window'
                  ? 'bg-white text-ink-900 shadow-subtle dark:bg-ink-700 dark:text-sage-50'
                  : 'text-ink-500 hover:text-ink-800 dark:text-ink-400'
              )}
            >
              Windows ({doc.room.openings.filter((o) => o.kind === 'window').length})
            </button>
          </div>
        )}

        {/* Openings List or Empty State */}
        {doc.room.openings.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-panel border border-dashed border-ink-200 p-5 text-center dark:border-ink-800">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-100 text-ink-400 dark:bg-ink-800">
              <Icon name="door" className="h-4 w-4" />
            </div>
            <p className="mt-2 text-caption font-semibold text-ink-700 dark:text-ink-200">
              No doors or windows yet
            </p>
            <p className="mt-0.5 text-[11px] text-ink-400">
              Openings stay attached to their walls when the room is resized.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredOpenings.map((o, idx) => (
              <OpeningCard
                key={o.id}
                id={o.id}
                index={idx}
                isExpanded={expandedIds.has(o.id)}
                onToggle={() => toggleExpanded(o.id)}
              />
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Interior Partition Walls"
        icon="layers"
        action={
          (doc.room.partitions ?? []).length > 0 ? (
            <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-ink-600 dark:bg-ink-800 dark:text-ink-300">
              {(doc.room.partitions ?? []).length}
            </span>
          ) : undefined
        }
      >
        {/* Visual Partition Creation Tiles */}
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-medium text-ink-500 dark:text-ink-400">
            Add interior wall or divider
          </span>
          <div className="grid grid-cols-3 gap-2">
            {PARTITION_PRESETS.map((p) => (
              <button
                key={p.type}
                type="button"
                onClick={() => {
                  const id = addPartition(p.type);
                  if (id) select(id);
                }}
                className={clsx(
                  'group flex flex-col items-center justify-center gap-1 rounded-control border border-ink-200 bg-white p-2.5 text-center shadow-subtle transition-all duration-150',
                  'hover:border-sage-500 hover:bg-sage-50/40 hover:shadow-medium',
                  'dark:border-ink-700/80 dark:bg-ink-800/80 dark:hover:border-sage-500 dark:hover:bg-sage-950/40'
                )}
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sage-500/10 text-sage-600 transition-colors group-hover:bg-sage-600 group-hover:text-white dark:bg-sage-500/20 dark:text-sage-300">
                  {p.icon}
                </div>
                <span className="text-[11px] font-semibold text-ink-900 dark:text-sage-50">
                  {p.label}
                </span>
                <span className="text-[9px] text-ink-400 leading-none">
                  {p.sub}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Partition Items List or Empty State */}
        {(doc.room.partitions ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-panel border border-dashed border-ink-200 p-4 text-center dark:border-ink-800">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-100 text-ink-400 dark:bg-ink-800">
              <Icon name="layers" className="h-4 w-4" />
            </div>
            <p className="mt-1.5 text-caption font-semibold text-ink-700 dark:text-ink-200">
              No interior partitions yet
            </p>
            <p className="mt-0.5 text-[11px] text-ink-400">
              Divide open-plan areas, define alcoves, or create half-wall kitchen counters.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {(doc.room.partitions ?? []).map((p) => {
              const active = selection.includes(p.id);
              return (
                <div
                  key={p.id}
                  onClick={() => select(p.id)}
                  className={clsx(
                    'group flex cursor-pointer items-center justify-between gap-2.5 rounded-control border p-2.5 text-left transition-all',
                    active
                      ? 'border-sage-500 bg-sage-50/80 shadow-subtle dark:border-sage-500 dark:bg-sage-950/40'
                      : 'border-ink-200 bg-white hover:border-ink-300 hover:bg-ink-50/60 dark:border-ink-800 dark:bg-ink-900 dark:hover:border-ink-700'
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div
                      className={clsx(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-control transition-colors',
                        active
                          ? 'bg-sage-600 text-white'
                          : 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300'
                      )}
                    >
                      <Icon name="layers" className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-caption font-semibold text-ink-900 dark:text-sage-50">
                        {p.name || 'Interior Partition'}
                      </p>
                      <p className="text-[11px] tabular-nums text-ink-400">
                        {formatLength(p.length, unit)} · {formatLength(p.height, unit)} tall
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {active && (
                      <span className="rounded bg-sage-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-sage-700 dark:text-sage-300">
                        Selected
                      </span>
                    )}
                    <IconButton
                      size="sm"
                      icon="trash"
                      label="Delete partition"
                      onClick={(e) => {
                        e.stopPropagation();
                        removePartition(p.id);
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section
        title="Finishes"
        icon="sparkle"
        action={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sage-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sage-700 ring-1 ring-sage-500/25 dark:bg-sage-500/25 dark:text-sage-300">
            <span className="h-1.5 w-1.5 rounded-full bg-sage-500" />
            {finishTab === 'walls'
              ? selectedWallSide === 'all'
                ? 'All Walls'
                : `${WALL_LABEL[selectedWallSide].split(' ')[0]} Accent`
              : doc.room.floor.pattern}
          </span>
        }
      >
        {/* Studio Switcher Tabs with Animated Spring Pill */}
        <div className="relative flex items-center rounded-control bg-ink-200/60 p-0.5 dark:bg-ink-800/80">
          {(['walls', 'floor'] as const).map((tab) => {
            const active = finishTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setFinishTab(tab)}
                className={clsx(
                  'relative z-10 flex flex-1 items-center justify-center gap-2 rounded py-1.5 text-[11px] font-bold transition-colors duration-150',
                  active
                    ? 'text-ink-900 dark:text-sage-50'
                    : 'text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-sage-100'
                )}
              >
                {active && (
                  <motion.div
                    layoutId="finishes-active-tab-pill"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    className="absolute inset-0 rounded bg-white shadow-subtle dark:bg-ink-700"
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <Icon name={tab === 'walls' ? 'palette' : 'grid'} className="h-3.5 w-3.5" />
                  <span>{tab === 'walls' ? 'Walls & Accents' : 'Flooring & Tiles'}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Tab Content with Fluid AnimatePresence Transition */}
        <AnimatePresence mode="wait">
          {finishTab === 'walls' ? (
            <motion.div
              key="walls"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              className="flex flex-col gap-3.5 pt-0.5"
            >
              {/* Wall Scope: All Walls vs Accent Wall */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-ink-700 dark:text-sage-100">Target wall</span>
                  {selectedWallSide !== 'all' ? (
                    doc.room.wallOverrides?.[selectedWallSide] ? (
                      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-500/25 dark:bg-amber-500/25 dark:text-amber-300">
                        Custom Accent
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] text-ink-400">Inherits Base</span>
                    )
                  ) : (
                    <span className="font-mono text-[10px] text-ink-400">All 4 Walls</span>
                  )}
                </div>
                <div
                  role="radiogroup"
                  aria-label="Wall target"
                  className="relative flex items-center rounded-control bg-ink-200/60 p-0.5 dark:bg-ink-800/80"
                >
                  {[
                    { value: 'all' as const, label: 'All Walls' },
                    { value: 'north' as const, label: 'North' },
                    { value: 'south' as const, label: 'South' },
                    { value: 'east' as const, label: 'East' },
                    { value: 'west' as const, label: 'West' },
                  ].map((opt) => {
                    const active = selectedWallSide === opt.value;
                    const hasOverride = opt.value !== 'all' && !!doc.room.wallOverrides?.[opt.value];
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setSelectedWallSide(opt.value)}
                        className={clsx(
                          'relative z-10 flex flex-1 items-center justify-center gap-1 rounded py-1 text-[11px] font-semibold transition-colors duration-150',
                          active
                            ? 'text-ink-900 dark:text-sage-50'
                            : 'text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-sage-100'
                        )}
                      >
                        {active && (
                          <motion.div
                            layoutId="wall-target-active-pill"
                            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                            className="absolute inset-0 rounded bg-white shadow-subtle dark:bg-ink-700"
                          />
                        )}
                        <span className="relative z-10 flex items-center gap-1">
                          <span>{opt.label}</span>
                          {hasOverride && (
                            <span
                              className={clsx(
                                'h-1.5 w-1.5 rounded-full',
                                active ? 'bg-amber-500' : 'bg-sage-500 animate-pulse'
                              )}
                              title="Custom finish active on this wall"
                            />
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Accent Wall Status Banner */}
              {selectedWallSide !== 'all' && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="overflow-hidden"
                >
                  {doc.room.wallOverrides?.[selectedWallSide] ? (
                    <div className="flex items-center justify-between rounded-panel border border-sage-500/40 bg-gradient-to-r from-sage-50/90 to-sage-100/40 p-2.5 text-caption shadow-xs dark:border-sage-800/80 dark:from-sage-950/40 dark:to-ink-900/60">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-control bg-sage-500/20 text-sage-700 dark:text-sage-300">
                          <Icon name="sparkle" className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-bold text-sage-900 dark:text-sage-100">
                            {WALL_LABEL[selectedWallSide]} Accent Wall
                          </p>
                          <p className="text-[10px] text-sage-600 dark:text-sage-400">
                            Custom pattern & paint active on this wall
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => resetWallSide(selectedWallSide)}
                        className="text-sage-700 hover:text-danger dark:text-sage-300 dark:hover:text-danger"
                      >
                        Reset
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between rounded-panel border border-dashed border-ink-300/80 bg-ink-50/50 p-2.5 text-caption dark:border-ink-700/80 dark:bg-ink-900/40">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-control bg-ink-200/50 text-ink-500 dark:bg-ink-800 dark:text-ink-400">
                          <Icon name="layers" className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-ink-800 dark:text-ink-200">
                            {WALL_LABEL[selectedWallSide]} Wall
                          </p>
                          <p className="text-[10px] text-ink-400">
                            Currently inherits base room finish
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setWallSideColor(selectedWallSide, doc.room.walls.color)}
                      >
                        Customize
                      </Button>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Active accents quick-jump pills when All Walls is selected */}
              {selectedWallSide === 'all' &&
                doc.room.wallOverrides &&
                Object.keys(doc.room.wallOverrides).length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 rounded-control bg-sage-50/70 p-2 dark:bg-sage-950/30 border border-sage-200/60 dark:border-sage-900/50">
                    <span className="text-[11px] font-semibold text-sage-800 dark:text-sage-300">
                      Active Accents:
                    </span>
                    {WALL_SIDES.filter((s) => !!doc.room.wallOverrides?.[s]).map((s) => (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        key={s}
                        type="button"
                        onClick={() => setSelectedWallSide(s)}
                        className="rounded-control border border-sage-300/80 bg-white px-2 py-0.5 text-[10px] font-semibold text-ink-800 shadow-2xs transition-colors hover:border-sage-500 hover:text-sage-700 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-200"
                      >
                        {WALL_LABEL[s].split(' ')[0]} →
                      </motion.button>
                    ))}
                  </div>
                )}

              {/* Wall Pattern 2-Column Gallery */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-ink-700 dark:text-sage-100">
                    {selectedWallSide === 'all'
                      ? 'Wall pattern & texture'
                      : `${WALL_LABEL[selectedWallSide]} wall pattern`}
                  </span>
                  <span className="font-mono text-[10px] text-ink-400">
                    6 Architectural Finishes
                  </span>
                </div>
                <div role="radiogroup" aria-label="Wall pattern" className="grid grid-cols-2 gap-2">
                  {WALL_PATTERNS.map((p) => {
                    const activeFinish =
                      selectedWallSide === 'all'
                        ? doc.room.walls
                        : (doc.room.wallOverrides?.[selectedWallSide] ?? doc.room.walls);
                    const active = (activeFinish.pattern ?? 'plain') === p.id;
                    return (
                      <motion.button
                        whileHover={{ y: -1.5, scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        key={p.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setWallSidePattern(selectedWallSide, p.id)}
                        className={clsx(
                          'group flex items-center gap-2.5 rounded-panel border p-2.5 text-left transition-all duration-150',
                          active
                            ? 'border-sage-500 bg-sage-50/80 shadow-subtle ring-1 ring-sage-500/25 dark:border-sage-500 dark:bg-sage-950/40'
                            : 'border-ink-200/90 bg-white/80 hover:border-ink-300 hover:bg-white dark:border-ink-800/80 dark:bg-ink-900/60 dark:hover:border-ink-700'
                        )}
                      >
                        <div
                          className={clsx(
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-control p-1 transition-colors shadow-2xs',
                            active
                              ? 'bg-sage-500/15 text-sage-700 dark:bg-sage-500/25 dark:text-sage-300'
                              : 'bg-ink-100/70 text-ink-500 group-hover:bg-ink-100 group-hover:text-ink-700 dark:bg-ink-800/70 dark:text-ink-400 dark:group-hover:text-ink-200'
                          )}
                        >
                          <PatternThumbnail id={p.id} className="h-5.5 w-5.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className={clsx(
                                'truncate text-[11px] font-semibold',
                                active
                                  ? 'text-sage-900 dark:text-sage-50'
                                  : 'text-ink-800 dark:text-ink-200'
                              )}
                            >
                              {p.name}
                            </span>
                            {active && (
                              <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-sage-600 text-white shadow-xs">
                                <Icon name="check" className="h-2.5 w-2.5" />
                              </span>
                            )}
                          </div>
                          <p className="truncate text-[10px] text-ink-400 dark:text-ink-500">
                            {p.id === 'plain'
                              ? 'Smooth matte'
                              : p.id === 'brick'
                              ? 'Exposed brick'
                              : p.id === 'panels'
                              ? 'Acoustic slats'
                              : p.id === 'subway'
                              ? 'Subway tile'
                              : p.id === 'stripes'
                              ? 'Designer pinstripe'
                              : 'Cast concrete'}
                          </p>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Wall Colour Studio */}
              <div className="flex flex-col gap-2">
                <span className="font-semibold text-ink-700 dark:text-sage-100 text-[11px]">
                  {selectedWallSide === 'all'
                    ? 'Wall colour & accents'
                    : `${WALL_LABEL[selectedWallSide]} wall colour`}
                </span>
                <ColorPicker
                  label={
                    selectedWallSide === 'all'
                      ? 'Wall colour'
                      : `${WALL_LABEL[selectedWallSide]} wall colour`
                  }
                  presets={WALL_COLORS}
                  secondaryPresets={ACCENT_WALL_COLORS}
                  secondaryLabel="Designer Accents"
                  value={
                    selectedWallSide === 'all'
                      ? doc.room.walls.color
                      : (doc.room.wallOverrides?.[selectedWallSide]?.color ?? doc.room.walls.color)
                  }
                  onChange={(c) => setWallSideColor(selectedWallSide, c)}
                />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="floor"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              className="flex flex-col gap-3.5 pt-0.5"
            >
              {/* Quick Complete Flooring Presets */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-ink-700 dark:text-sage-100">
                    Curated floor materials
                  </span>
                  <span className="font-mono text-[10px] text-ink-400">1-click presets</span>
                </div>
                <div role="radiogroup" aria-label="Flooring presets" className="grid grid-cols-2 gap-1.5">
                  {FLOOR_PRESETS.map((preset) => {
                    const active =
                      doc.room.floor.color.toLowerCase() === preset.color.toLowerCase() &&
                      doc.room.floor.pattern === preset.pattern;
                    return (
                      <motion.button
                        whileHover={{ y: -1, scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        key={preset.name}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setFloor({ color: preset.color, pattern: preset.pattern })}
                        className={clsx(
                          'flex items-center gap-2 rounded-panel border p-2 text-left transition-all duration-150',
                          active
                            ? 'border-sage-500 bg-sage-50/80 shadow-subtle ring-1 ring-sage-500/20 dark:border-sage-500 dark:bg-sage-950/40'
                            : 'border-ink-200/90 bg-white/80 hover:border-ink-300 hover:bg-white dark:border-ink-800/80 dark:bg-ink-900/60 dark:hover:border-ink-700'
                        )}
                      >
                        <span
                          className="h-4 w-4 shrink-0 rounded-full border border-black/15 shadow-2xs dark:border-white/20"
                          style={{ backgroundColor: preset.color }}
                        />
                        <div className="min-w-0 flex-1">
                          <span
                            className={clsx(
                              'block truncate text-[11px] font-semibold',
                              active
                                ? 'text-sage-900 dark:text-sage-50'
                                : 'text-ink-800 dark:text-ink-200'
                            )}
                          >
                            {preset.name}
                          </span>
                          <span className="block text-[9.5px] text-ink-400 capitalize font-mono">
                            {preset.pattern}
                          </span>
                        </div>
                        {active && (
                          <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-sage-600 text-white shadow-xs">
                            <Icon name="check" className="h-2.5 w-2.5" />
                          </span>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Floor Pattern */}
              <div className="flex flex-col gap-2">
                <span className="font-semibold text-ink-700 dark:text-sage-100 text-[11px]">
                  Floor pattern & layout
                </span>
                <div role="radiogroup" aria-label="Floor pattern" className="grid grid-cols-2 gap-2">
                  {FLOOR_PATTERNS.map((p) => {
                    const active = doc.room.floor.pattern === p.id;
                    return (
                      <motion.button
                        whileHover={{ y: -1.5, scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        key={p.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setFloor({ pattern: p.id })}
                        className={clsx(
                          'group flex items-center gap-2.5 rounded-panel border p-2.5 text-left transition-all duration-150',
                          active
                            ? 'border-sage-500 bg-sage-50/80 shadow-subtle ring-1 ring-sage-500/25 dark:border-sage-500 dark:bg-sage-950/40'
                            : 'border-ink-200/90 bg-white/80 hover:border-ink-300 hover:bg-white dark:border-ink-800/80 dark:bg-ink-900/60 dark:hover:border-ink-700'
                        )}
                      >
                        <div
                          className={clsx(
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-control p-1 transition-colors shadow-2xs',
                            active
                              ? 'bg-sage-500/15 text-sage-700 dark:bg-sage-500/25 dark:text-sage-300'
                              : 'bg-ink-100/70 text-ink-500 group-hover:bg-ink-100 group-hover:text-ink-700 dark:bg-ink-800/70 dark:text-ink-400 dark:group-hover:text-ink-200'
                          )}
                        >
                          <PatternThumbnail id={p.id} className="h-5.5 w-5.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className={clsx(
                                'truncate text-[11px] font-semibold',
                                active
                                  ? 'text-sage-900 dark:text-sage-50'
                                  : 'text-ink-800 dark:text-ink-200'
                              )}
                            >
                              {p.name}
                            </span>
                            {active && (
                              <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-sage-600 text-white shadow-xs">
                                <Icon name="check" className="h-2.5 w-2.5" />
                              </span>
                            )}
                          </div>
                          <p className="truncate text-[10px] text-ink-400 dark:text-ink-500">
                            {p.id === 'planks'
                              ? 'Timber hardwood'
                              : p.id === 'herringbone'
                              ? 'Chevron parquet'
                              : p.id === 'tiles'
                              ? 'Ceramic grid'
                              : 'Polished screed'}
                          </p>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Floor Colour */}
              <div className="flex flex-col gap-2">
                <span className="font-semibold text-ink-700 dark:text-sage-100 text-[11px]">
                  Floor colour & tone
                </span>
                <ColorPicker
                  label="Floor colour"
                  presets={FLOOR_COLORS}
                  value={doc.room.floor.color}
                  onChange={(c) => setFloor({ color: c })}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Section>

      <Section title="Guides & snapping" icon="magnet" defaultOpen={false}>
        {/* Canvas Visual Guides */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between px-1 pb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400 dark:text-ink-500">
              Visual Overlays
            </span>
            <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[9px] font-semibold text-ink-500 dark:bg-ink-800 dark:text-ink-400 tabular-nums">
              {activeGuidesCount}/3 active
            </span>
          </div>

          <StudioSwitch
            label="Room & object dimensions"
            description="Wall spans & selected item boundaries"
            icon="ruler"
            checked={showDimensions}
            onChange={setShowDimensions}
          />
          <StudioSwitch
            label="Clearance zones"
            description="Usable space & functional footprints"
            icon="layers"
            checked={showClearance}
            onChange={setShowClearance}
            badge={clearanceIssueCount > 0 ? `${clearanceIssueCount} alert${clearanceIssueCount > 1 ? 's' : ''}` : undefined}
            badgeVariant={clearanceIssueCount > 0 ? 'warn' : 'sage'}
          />
          <StudioSwitch
            label="Reference coordinate grid"
            description="1.0-metre CAD floor alignment mesh"
            icon="grid"
            checked={showGrid}
            onChange={setShowGrid}
          />
        </div>

        {/* Snapping Separator & Quick Actions */}
        <div className="flex items-center justify-between px-1 pt-2 pb-0.5 border-t border-ink-200/80 dark:border-ink-800/80 mt-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400 dark:text-ink-500">
            Magnetic Snapping
          </span>
          <div className="flex items-center gap-1.5 text-[10px]">
            <button
              type="button"
              onClick={() => setSnap({ wall: true, furniture: true, grid: true })}
              className="font-medium text-sage-600 hover:text-sage-500 dark:text-sage-400 dark:hover:text-sage-300 transition-colors"
            >
              All On
            </button>
            <span className="text-ink-300 dark:text-ink-700">·</span>
            <button
              type="button"
              onClick={() => setSnap({ wall: false, furniture: false, grid: false })}
              className="font-medium text-ink-400 hover:text-ink-600 dark:text-ink-500 dark:hover:text-ink-300 transition-colors"
            >
              All Off
            </button>
          </div>
        </div>

        {/* Snapping Switches */}
        <div className="flex flex-col gap-1">
          <StudioSwitch
            label="Snap to perimeter walls"
            description="Flush contact with exterior boundary"
            icon="snap-face"
            checked={snap.wall}
            onChange={(wall) => setSnap({ wall })}
          />
          <StudioSwitch
            label="Snap to other objects"
            description="Edge & center line alignment guides"
            icon="cube"
            checked={snap.furniture}
            onChange={(furniture) => setSnap({ furniture })}
          />
          <StudioSwitch
            label="Snap to coordinate grid"
            description="10 cm precision increment increments"
            icon="magnet"
            checked={snap.grid}
            onChange={(grid) => setSnap({ grid })}
          />
        </div>

        {/* Rotation Angle Snapping Card */}
        <div className="flex flex-col gap-2 rounded-lg bg-ink-100/60 p-2.5 dark:bg-ink-900/50 border border-ink-200/70 dark:border-ink-800/80 mt-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-ink-200/80 text-ink-600 dark:bg-ink-800 dark:text-ink-400">
                <Icon name="rotate" className="h-3 w-3" />
              </div>
              <span className="text-xs font-semibold text-ink-800 dark:text-sage-100">
                Rotation Angle Step
              </span>
            </div>
            <span className="text-[10px] font-semibold text-sage-600 dark:text-sage-400 tabular-nums">
              {snap.rotationStep === 0
                ? 'Free continuous'
                : snap.rotationStep === 90
                ? '90° Orthogonal'
                : `${snap.rotationStep}° Increments`}
            </span>
          </div>

          <div
            role="radiogroup"
            aria-label="Rotation snapping"
            className="relative flex items-center rounded-md bg-ink-200/70 p-0.5 dark:bg-ink-800/80"
          >
            {[
              { value: 0, label: 'Free' },
              { value: 15, label: '15°' },
              { value: 45, label: '45°' },
              { value: 90, label: '90°' },
            ].map((opt) => {
              const active = snap.rotationStep === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setSnap({ rotationStep: opt.value })}
                  className={clsx(
                    'relative z-10 flex-1 py-1.5 text-center text-caption font-semibold transition-colors duration-150',
                    active
                      ? 'text-ink-900 dark:text-sage-50'
                      : 'text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-200'
                  )}
                >
                  {active && (
                    <motion.div
                      layoutId="rotation-step-active-pill"
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                      className="absolute inset-0 rounded-[5px] bg-white shadow-xs dark:bg-ink-700 dark:shadow-ink-950/40"
                    />
                  )}
                  <span className="relative z-10">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Pro Workflow Callout */}
        <div className="flex items-start gap-2.5 rounded-lg border border-ink-200/70 bg-ink-100/50 p-2.5 text-[11px] text-ink-600 dark:border-ink-800/70 dark:bg-ink-900/30 dark:text-ink-400 mt-0.5">
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-ink-200/80 text-ink-600 dark:bg-ink-800 dark:text-ink-400">
            <Icon name="keyboard" className="h-3 w-3" />
          </div>
          <div className="flex flex-col gap-1 leading-relaxed">
            <p>
              Hold{' '}
              <kbd className="rounded border border-ink-300 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ink-800 shadow-2xs dark:border-ink-700 dark:bg-ink-800 dark:text-sage-200">
                Alt
              </kbd>{' '}
              while dragging items or walls to ignore all snapping.
            </p>
            <p className="text-[10px] text-ink-400 dark:text-ink-500">
              Hold{' '}
              <kbd className="rounded border border-ink-300 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ink-800 shadow-2xs dark:border-ink-700 dark:bg-ink-800 dark:text-sage-200">
                Shift
              </kbd>{' '}
              during rotation for smooth continuous free angle.
            </p>
          </div>
        </div>
      </Section>

      <Section title="Summary" icon="receipt">
        <dl className="flex flex-col gap-1.5 text-caption">
          <div className="flex justify-between">
            <dt className="text-ink-500 dark:text-ink-400">Floor area</dt>
            <dd className="tabular-nums font-medium text-ink-800 dark:text-sage-50">
              {formatArea(area, unit)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-500 dark:text-ink-400">Furniture</dt>
            <dd className="tabular-nums font-medium text-ink-800 dark:text-sage-50">
              {doc.furniture.length} items
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-500 dark:text-ink-400">Floor used</dt>
            <dd className="tabular-nums font-medium text-ink-800 dark:text-sage-50">
              {Math.round(density * 100)}%
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-500 dark:text-ink-400">Estimated cost</dt>
            <dd className="tabular-nums font-medium text-ink-800 dark:text-sage-50">
              {formatCurrency(cost, currency)}
            </dd>
          </div>
        </dl>

        {/* Density bar doubles as a crowding warning. */}
        <div>
          <div className="h-1.5 overflow-hidden rounded-full bg-ink-200 dark:bg-ink-800">
            <div
              className={clsx(
                'h-full rounded-full transition-all duration-300',
                density > 0.6 ? 'bg-warn' : 'bg-sage-500'
              )}
              style={{ width: `${Math.round(density * 100)}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-ink-400">
            {density > 0.6
              ? 'Above 60% floor coverage a room starts to feel crowded.'
              : 'Comfortable amount of open floor.'}
          </p>
        </div>

        <Button size="sm" icon="receipt" block onClick={() => openModal('summary')}>
          Full shopping list
        </Button>
        <p className="text-[11px] text-ink-400">
          Room is {formatLength(dims.width, unit)} × {formatLength(dims.length, unit)}.
        </p>
      </Section>
    </>
  );
}
