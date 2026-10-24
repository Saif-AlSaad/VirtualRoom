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
import { ROOM_LIMITS, occupiedFloorArea, totalCost } from '@/utils/placement';
import { WALL_LABEL, WALL_SIDES, floorArea, wallLength } from '@/utils/roomGeometry';
import {
  formatArea,
  formatLength,
  formatLengthShort,
  fromDisplay,
  parseLength,
  toDisplay,
  unitLabel,
  M_PER_IN,
  M_PER_FT,
} from '@/utils/units';
import { formatCurrency } from '@/utils/exporters';
import { Icon } from './Icon';
import { Button, ColorPicker, IconButton, Section, Segmented, Switch, Tooltip } from './primitives';

/**
 * Compact dimension input cell for paired CAD-style inputs (e.g. W x L, H x T).
 */
function CompactDimensionField({
  label,
  badge,
  badgeColor = 'sage',
  icon,
  value,
  min,
  max,
  step = 0.01,
  suffix,
  unit,
  secondary,
  onChange,
  onCommit,
}: {
  label: string;
  badge?: string;
  badgeColor?: 'sage' | 'sky' | 'amber' | 'indigo';
  icon?: React.ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  unit: Unit;
  secondary?: string;
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

  const nudge = (delta: number) => {
    const current = toDisplay(value, unit);
    const updated = Math.max(displayMin, Math.min(displayMax, current + delta));
    const metres = fromDisplay(updated, unit);
    onChange(metres);
    onCommit?.(metres);
  };

  const nudgeAmount = unit === 'ft' ? 0.5 : 0.1;

  const badgeStyles = {
    sage: 'bg-sage-500/15 text-sage-700 dark:bg-sage-500/25 dark:text-sage-300',
    sky: 'bg-sky-500/15 text-sky-700 dark:bg-sky-500/25 dark:text-sky-300',
    amber: 'bg-amber-500/15 text-amber-700 dark:bg-amber-500/25 dark:text-amber-300',
    indigo: 'bg-indigo-500/15 text-indigo-700 dark:bg-indigo-500/25 dark:text-indigo-300',
  };

  return (
    <div className="group flex flex-col gap-2 rounded-control border border-ink-200/90 bg-white/70 p-2.5 transition-all duration-150 focus-within:border-sage-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-sage-500/20 dark:border-ink-700/70 dark:bg-ink-800/40 dark:focus-within:border-sage-500 dark:focus-within:bg-ink-850 shadow-subtle hover:border-ink-300 dark:hover:border-ink-700">
      <div className="flex items-center justify-between text-[11px]">
        <span className="flex items-center gap-1.5 font-semibold text-ink-700 dark:text-sage-100">
          {badge && (
            <span
              className={clsx(
                'flex h-4 w-4 items-center justify-center rounded font-bold text-[9px] shadow-subtle',
                badgeStyles[badgeColor]
              )}
            >
              {badge}
            </span>
          )}
          {icon}
          {label}
        </span>
        {secondary ? (
          <span className="text-[10px] font-mono text-ink-400 dark:text-ink-500">
            {secondary}
          </span>
        ) : (
          <span className="text-[10px] font-medium tabular-nums text-ink-400">
            {suffix ?? unitLabel(unit)}
          </span>
        )}
      </div>

      <div className="relative flex items-center">
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
          className="h-7.5 w-full rounded border border-ink-200 bg-white pl-2.5 pr-14 text-caption font-semibold tabular-nums text-ink-900 transition-colors focus:border-sage-500 focus:outline-none dark:border-ink-700 dark:bg-ink-900 dark:text-sage-50"
        />
        <div className="absolute right-1 flex items-center gap-0.5">
          <motion.button
            whileTap={{ scale: 0.85 }}
            type="button"
            onClick={() => nudge(-nudgeAmount)}
            className="flex h-5 w-4 items-center justify-center rounded text-ink-400 hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800 dark:hover:text-sage-200 transition-colors"
            title={`Decrease by ${nudgeAmount}`}
          >
            <span className="text-[12px] font-bold leading-none">−</span>
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.85 }}
            type="button"
            onClick={() => nudge(+nudgeAmount)}
            className="flex h-5 w-4 items-center justify-center rounded text-ink-400 hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800 dark:hover:text-sage-200 transition-colors"
            title={`Increase by ${nudgeAmount}`}
          >
            <span className="text-[12px] font-bold leading-none">+</span>
          </motion.button>
          <span className="pointer-events-none ml-0.5 text-[9.5px] font-semibold uppercase text-ink-400 dark:text-ink-500">
            {suffix ?? unitLabel(unit)}
          </span>
        </div>
      </div>

      <div className="pt-0.5">
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
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink-200 accent-sage-600 transition-opacity hover:opacity-100 dark:bg-ink-700"
        />
      </div>
    </div>
  );
}

/**
 * Intelligent wall thickness control presenting inches in imperial and cm in metric.
 */
function WallThicknessControl({
  thickness,
  unit,
  onChange,
}: {
  thickness: number;
  unit: Unit;
  onChange: (metres: number) => void;
}) {
  const [text, setText] = useState<string | null>(null);

  const isFt = unit === 'ft';
  const displayVal = isFt ? thickness / M_PER_IN : thickness * 100;
  const minVal = isFt ? 2.5 : 6;
  const maxVal = isFt ? 14 : 35;
  const step = isFt ? 0.25 : 1;
  const suffix = isFt ? 'in' : 'cm';
  const secondary = isFt
    ? `≈ ${(thickness * 100).toFixed(0)} cm`
    : `≈ ${(thickness / M_PER_IN).toFixed(1)}″`;

  const commitText = () => {
    if (text === null) return;
    const raw = Number(text);
    if (Number.isFinite(raw) && raw > 0) {
      const metres = isFt ? raw * M_PER_IN : raw / 100;
      const clamped = Math.max(
        ROOM_LIMITS.minWallThickness,
        Math.min(ROOM_LIMITS.maxWallThickness, metres)
      );
      onChange(clamped);
    }
    setText(null);
  };

  const nudge = (delta: number) => {
    const updated = Math.max(minVal, Math.min(maxVal, displayVal + delta));
    const metres = isFt ? updated * M_PER_IN : updated / 100;
    onChange(metres);
  };

  const nudgeAmount = isFt ? 0.5 : 1;

  const presets = isFt
    ? [
        { label: '4.5″ Stud', m: 0.1143 },
        { label: '6″ Ext', m: 0.1524 },
        { label: '8″ Block', m: 0.2032 },
      ]
    : [
        { label: '10 cm', m: 0.10 },
        { label: '12 cm', m: 0.12 },
        { label: '15 cm', m: 0.15 },
        { label: '20 cm', m: 0.20 },
      ];

  return (
    <div className="group flex flex-col gap-2 rounded-control border border-ink-200/90 bg-white/70 p-2.5 transition-all duration-150 focus-within:border-sage-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-sage-500/20 dark:border-ink-700/70 dark:bg-ink-800/40 dark:focus-within:border-sage-500 dark:focus-within:bg-ink-850 shadow-subtle hover:border-ink-300 dark:hover:border-ink-700">
      <div className="flex items-center justify-between text-[11px]">
        <span className="flex items-center gap-1.5 font-semibold text-ink-700 dark:text-sage-100">
          <span className="flex h-4 w-4 items-center justify-center rounded font-bold text-[9px] bg-amber-500/15 text-amber-700 dark:bg-amber-500/25 dark:text-amber-300 shadow-subtle">
            T
          </span>
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="2" y="3" width="12" height="10" rx="1.5" />
            <path d="M6 3v10M10 3v10" strokeDasharray="2 2" strokeWidth="1.2" />
          </svg>
          Thickness
        </span>
        <span className="text-[10px] font-mono text-ink-400 dark:text-ink-500">
          {secondary}
        </span>
      </div>

      <div className="relative flex items-center">
        <input
          type="text"
          inputMode="decimal"
          value={text ?? displayVal.toFixed(1)}
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
          className="h-7.5 w-full rounded border border-ink-200 bg-white pl-2.5 pr-14 text-caption font-semibold tabular-nums text-ink-900 transition-colors focus:border-sage-500 focus:outline-none dark:border-ink-700 dark:bg-ink-900 dark:text-sage-50"
        />
        <div className="absolute right-1 flex items-center gap-0.5">
          <motion.button
            whileTap={{ scale: 0.85 }}
            type="button"
            onClick={() => nudge(-nudgeAmount)}
            className="flex h-5 w-4 items-center justify-center rounded text-ink-400 hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800 dark:hover:text-sage-200 transition-colors"
            title={`Decrease by ${nudgeAmount}`}
          >
            <span className="text-[12px] font-bold leading-none">−</span>
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.85 }}
            type="button"
            onClick={() => nudge(+nudgeAmount)}
            className="flex h-5 w-4 items-center justify-center rounded text-ink-400 hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800 dark:hover:text-sage-200 transition-colors"
            title={`Increase by ${nudgeAmount}`}
          >
            <span className="text-[12px] font-bold leading-none">+</span>
          </motion.button>
          <span className="pointer-events-none ml-0.5 text-[9.5px] font-semibold uppercase text-ink-400 dark:text-ink-500">
            {suffix}
          </span>
        </div>
      </div>

      <div className="pt-0.5">
        <input
          type="range"
          min={minVal}
          max={maxVal}
          step={step}
          value={displayVal}
          onChange={(e) => {
            const raw = Number(e.target.value);
            const metres = isFt ? raw * M_PER_IN : raw / 100;
            onChange(metres);
          }}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink-200 accent-sage-600 transition-opacity hover:opacity-100 dark:bg-ink-700"
        />
      </div>

      <div className="flex gap-1 pt-0.5">
        {presets.map((p) => {
          const active = Math.abs(thickness - p.m) < 0.015;
          return (
            <motion.button
              whileTap={{ scale: 0.95 }}
              whileHover={{ y: -0.5 }}
              key={p.label}
              type="button"
              onClick={() => onChange(p.m)}
              className={clsx(
                'flex-1 rounded border py-0.5 text-[9.5px] font-medium transition-all duration-150',
                active
                  ? 'border-sage-500 bg-sage-50 text-sage-800 dark:bg-sage-950/60 dark:text-sage-200 font-semibold shadow-subtle ring-1 ring-sage-500/20'
                  : 'border-ink-200/80 bg-white/80 text-ink-600 hover:border-sage-400 hover:text-sage-700 dark:border-ink-700/80 dark:bg-ink-800/60 dark:text-ink-300'
              )}
            >
              {p.label}
            </motion.button>
          );
        })}
      </div>
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
                <div className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1.5 font-semibold text-ink-700 dark:text-sage-100">
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-sage-600 dark:text-sage-400" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <circle cx="8" cy="8" r="6" />
                      <path d="M8 2v12M2 8h12" opacity="0.3" />
                      <polygon points="8,2.5 10,7 6,7" fill="currentColor" stroke="none" />
                    </svg>
                    Wall placement
                  </span>
                  <span className="text-[10px] text-ink-400">
                    {WALL_LABEL[opening.wall]}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1 rounded-control bg-ink-200/50 p-1 dark:bg-ink-800/80">
                  {[
                    { side: 'north' as const, glyph: '↑', code: 'N', label: 'North wall (Back)' },
                    { side: 'south' as const, glyph: '↓', code: 'S', label: 'South wall (Front)' },
                    { side: 'east' as const, glyph: '→', code: 'E', label: 'East wall (Right)' },
                    { side: 'west' as const, glyph: '←', code: 'W', label: 'West wall (Left)' },
                  ].map((item) => {
                    const active = opening.wall === item.side;
                    return (
                      <Tooltip key={item.side} content={item.label} side="top">
                        <motion.button
                          whileTap={{ scale: 0.92 }}
                          type="button"
                          onClick={() => updateOpening(opening.id, { wall: item.side })}
                          className={clsx(
                            'relative flex flex-col items-center justify-center rounded py-1 px-1 transition-all duration-150',
                            active
                              ? 'bg-white text-ink-900 shadow-subtle dark:bg-ink-700 dark:text-sage-50 font-bold'
                              : 'text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-sage-100 font-medium'
                          )}
                        >
                          <span className="text-[12px] font-bold leading-none">{item.glyph}</span>
                          <span className="text-[10.5px] leading-tight font-bold mt-0.5">{item.code}</span>
                        </motion.button>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>

              {/* Position Along Wall with Center action */}
              <div className="flex flex-col gap-1.5 rounded-control border border-ink-200/80 bg-white/80 p-2.5 shadow-subtle dark:border-ink-700/60 dark:bg-ink-900/60">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-ink-700 dark:text-sage-100">
                    Position along wall
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Tooltip content="Center opening on wall">
                      <motion.button
                        whileTap={{ scale: 0.92 }}
                        type="button"
                        onClick={() => updateOpening(opening.id, { offset: maxOffset / 2 })}
                        className="flex items-center gap-1 rounded bg-sage-500/15 px-2 py-0.5 text-[10px] font-semibold text-sage-700 hover:bg-sage-500/25 dark:bg-sage-500/20 dark:text-sage-300 transition-colors"
                      >
                        <Icon name="align-center" className="h-3 w-3" />
                        <span>Center</span>
                      </motion.button>
                    </Tooltip>
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
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink-200 accent-sage-600 dark:bg-ink-700"
                />
                <div className="flex justify-between text-[10px] font-mono text-ink-400">
                  <span>Corner (0.00)</span>
                  <span className="tabular-nums">
                    Max {toDisplay(maxOffset, unit).toFixed(2)} {unitLabel(unit)}
                  </span>
                </div>
              </div>

              {/* Dimensions: 2-column paired Width & Height */}
              <div className="flex flex-col gap-1.5">
                <div className="grid grid-cols-2 gap-2">
                  <CompactDimensionField
                    label="Width"
                    badge="W"
                    badgeColor={isDoor ? 'sage' : 'sky'}
                    value={opening.width}
                    min={0.2}
                    max={maxOffset}
                    step={0.01}
                    unit={unit}
                    secondary={
                      unit === 'ft'
                        ? `≈ ${opening.width.toFixed(2)} m`
                        : `≈ ${formatLengthShort(opening.width, 'ft')}`
                    }
                    onChange={(w) => updateOpening(opening.id, { width: w }, true)}
                    onCommit={(w) => updateOpening(opening.id, { width: w })}
                  />
                  <CompactDimensionField
                    label="Height"
                    badge="H"
                    badgeColor={isDoor ? 'sage' : 'sky'}
                    value={opening.height}
                    min={0.2}
                    max={dims.height}
                    step={0.01}
                    unit={unit}
                    secondary={
                      unit === 'ft'
                        ? `≈ ${opening.height.toFixed(2)} m`
                        : `≈ ${formatLengthShort(opening.height, 'ft')}`
                    }
                    onChange={(h) => updateOpening(opening.id, { height: h }, true)}
                    onCommit={(h) => updateOpening(opening.id, { height: h })}
                  />
                </div>

                {/* Standard Size Presets */}
                <div className="flex gap-1 pt-0.5">
                  {(isDoor
                    ? unit === 'ft'
                      ? [
                          { label: '30″ × 80″', w: 0.762, h: 2.032 },
                          { label: '36″ × 80″', w: 0.914, h: 2.032 },
                          { label: '60″ Double', w: 1.524, h: 2.032 },
                        ]
                      : [
                          { label: '0.75 × 2.0 m', w: 0.75, h: 2.0 },
                          { label: '0.9 × 2.1 m', w: 0.9, h: 2.1 },
                          { label: '1.5 × 2.1 m', w: 1.5, h: 2.1 },
                        ]
                    : unit === 'ft'
                      ? [
                          { label: '24″ × 48″', w: 0.61, h: 1.219 },
                          { label: '36″ × 48″', w: 0.914, h: 1.219 },
                          { label: '60″ × 48″', w: 1.524, h: 1.219 },
                        ]
                      : [
                          { label: '0.6 × 1.2 m', w: 0.6, h: 1.2 },
                          { label: '1.0 × 1.4 m', w: 1.0, h: 1.4 },
                          { label: '1.6 × 1.4 m', w: 1.6, h: 1.4 },
                        ]
                  ).map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => updateOpening(opening.id, { width: preset.w, height: preset.h })}
                      className="flex-1 rounded border border-ink-200/90 bg-white/80 py-0.5 text-[9.5px] font-medium text-ink-600 hover:border-sage-400 hover:text-sage-700 dark:border-ink-700/80 dark:bg-ink-800/60 dark:text-ink-300 transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Window: Sill Height */}
              {!isDoor && (
                <div className="flex flex-col gap-1.5">
                  <CompactDimensionField
                    label="Sill height"
                    badge="S"
                    badgeColor="amber"
                    value={opening.sillHeight}
                    min={0}
                    max={Math.max(0, dims.height - opening.height)}
                    step={0.01}
                    unit={unit}
                    secondary={
                      unit === 'ft'
                        ? `≈ ${opening.sillHeight.toFixed(2)} m`
                        : `≈ ${formatLengthShort(opening.sillHeight, 'ft')}`
                    }
                    onChange={(s) => updateOpening(opening.id, { sillHeight: s }, true)}
                    onCommit={(s) => updateOpening(opening.id, { sillHeight: s })}
                  />
                  <div className="flex gap-1">
                    {(unit === 'ft'
                      ? [
                          { label: 'Floor (0″)', m: 0 },
                          { label: '34″ (Std)', m: 0.864 },
                          { label: '48″ (High)', m: 1.219 },
                        ]
                      : [
                          { label: 'Floor (0 m)', m: 0 },
                          { label: '0.85 m (Std)', m: 0.85 },
                          { label: '1.2 m (High)', m: 1.2 },
                        ]
                    ).map((sp) => (
                      <button
                        key={sp.label}
                        type="button"
                        onClick={() => updateOpening(opening.id, { sillHeight: sp.m })}
                        className="flex-1 rounded border border-ink-200/90 bg-white/80 py-0.5 text-[9.5px] font-medium text-ink-600 hover:border-sky-400 hover:text-sky-700 dark:border-ink-700/80 dark:bg-ink-800/60 dark:text-ink-300 transition-colors"
                      >
                        {sp.label}
                      </button>
                    ))}
                  </div>
                </div>
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

  const perimeter = (dims.width + dims.length) * 2;
  const longerSide = Math.max(dims.width, dims.length);
  const shorterSide = Math.min(dims.width, dims.length);
  const ratio = shorterSide > 0 ? longerSide / shorterSide : 1;
  const ratioLabel = ratio < 1.1 ? 'Square' : ratio < 1.35 ? 'Standard' : 'Elongated';

  const ceilingPresets = useMemo(
    () =>
      unit === 'm'
        ? [
            { label: '2.4 m', val: 2.4 },
            { label: '2.7 m', val: 2.7 },
            { label: '3.0 m', val: 3.0 },
            { label: '3.5 m', val: 3.5 },
          ]
        : [
            { label: '8 ft', val: 2.4384 },
            { label: '9 ft', val: 2.7432 },
            { label: '10 ft', val: 3.048 },
            { label: '12 ft', val: 3.6576 },
          ],
    [unit]
  );

  return (
    <>
      {/* ── Architectural Room Overview Card ── */}
      <div className="relative overflow-hidden rounded-panel border border-ink-200/90 bg-gradient-to-br from-white via-sage-50/25 to-ink-50/40 p-3 shadow-subtle dark:border-ink-700/80 dark:from-ink-900/90 dark:via-ink-850 dark:to-ink-900/70">
        <div className="flex items-center justify-between pb-2.5 border-b border-ink-100 dark:border-ink-800/70">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-control bg-sage-500/15 text-sage-600 ring-1 ring-sage-500/20 dark:bg-sage-500/20 dark:text-sage-300">
              <Icon name="home" className="h-4 w-4" />
            </div>
            <div>
              <div className="text-caption font-bold text-ink-900 dark:text-sage-50">
                Room Architecture
              </div>
              <div className="text-[10px] text-ink-400">
                Active interior envelope
              </div>
            </div>
          </div>

          {/* Smooth Animated Unit Switcher Pill */}
          <div className="relative flex items-center rounded-control bg-ink-200/60 p-0.5 dark:bg-ink-800/80">
            {(['m', 'ft'] as const).map((u) => {
              const active = unit === u;
              return (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUnit(u)}
                  className={clsx(
                    'relative z-10 flex items-center gap-1 rounded px-2.5 py-1 text-[11px] font-semibold transition-colors duration-150',
                    active
                      ? 'text-ink-900 dark:text-sage-50'
                      : 'text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-sage-100'
                  )}
                >
                  {active && (
                    <motion.div
                      layoutId="room-unit-pill"
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                      className="absolute inset-0 rounded bg-white shadow-subtle dark:bg-ink-700"
                    />
                  )}
                  <span className="relative z-10 font-mono uppercase tracking-wide">
                    {u === 'm' ? 'm' : 'ft'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3 Key Architectural Metrics with Icons & Micro-Animations */}
        <div className="grid grid-cols-3 gap-1.5 pt-2.5 text-center">
          <motion.div
            whileHover={{ y: -2 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col items-center rounded-control border border-ink-200/60 bg-white/80 p-2 shadow-subtle dark:border-ink-800 dark:bg-ink-800/60 cursor-default"
          >
            <div className="flex items-center gap-1 text-[10px] font-semibold text-ink-400">
              <svg viewBox="0 0 16 16" className="h-3 w-3 text-sage-600 dark:text-sage-400" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" strokeDasharray="2.5 2.5" />
                <path d="M5.5 2.5v11M10.5 2.5v11M2.5 5.5h11M2.5 10.5h11" strokeWidth="0.7" opacity="0.6" />
              </svg>
              <span>Area</span>
            </div>
            <div className="mt-0.5 text-[12px] font-bold tabular-nums text-sage-700 dark:text-sage-300">
              {formatArea(area, unit)}
            </div>
            <div className="text-[9px] text-ink-400 font-mono">
              {unit === 'ft'
                ? `≈ ${area.toFixed(1)} m²`
                : `≈ ${(area / (M_PER_FT * M_PER_FT)).toFixed(1)} ft²`}
            </div>
          </motion.div>

          <motion.div
            whileHover={{ y: -2 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col items-center rounded-control border border-ink-200/60 bg-white/80 p-2 shadow-subtle dark:border-ink-800 dark:bg-ink-800/60 cursor-default"
          >
            <div className="flex items-center gap-1 text-[10px] font-semibold text-ink-400">
              <svg viewBox="0 0 16 16" className="h-3 w-3 text-sky-600 dark:text-sky-400" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" strokeWidth="1.6" />
                <circle cx="2.5" cy="2.5" r="1.2" fill="currentColor" />
                <circle cx="13.5" cy="2.5" r="1.2" fill="currentColor" />
                <circle cx="13.5" cy="13.5" r="1.2" fill="currentColor" />
                <circle cx="2.5" cy="13.5" r="1.2" fill="currentColor" />
              </svg>
              <span>Perimeter</span>
            </div>
            <div className="mt-0.5 text-[12px] font-bold tabular-nums text-ink-800 dark:text-sage-100">
              {formatLengthShort(perimeter, unit)}
            </div>
            <div className="text-[9px] text-ink-400 font-mono">
              2×(W+L)
            </div>
          </motion.div>

          <motion.div
            whileHover={{ y: -2 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col items-center rounded-control border border-ink-200/60 bg-white/80 p-2 shadow-subtle dark:border-ink-800 dark:bg-ink-800/60 cursor-default"
          >
            <div className="flex items-center gap-1 text-[10px] font-semibold text-ink-400">
              <svg viewBox="0 0 16 16" className="h-3 w-3 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" strokeWidth="1.6">
                <rect x="2.5" y="4" width="11" height="8" rx="1.5" />
                <path d="M2.5 8h11" strokeDasharray="2 2" strokeWidth="0.9" />
              </svg>
              <span>Ratio</span>
            </div>
            <div className="mt-0.5 text-[12px] font-bold tabular-nums text-ink-800 dark:text-sage-100">
              1 : {ratio.toFixed(2)}
            </div>
            <div className="text-[9px] text-ink-400 font-mono">
              {ratioLabel}
            </div>
          </motion.div>
        </div>
      </div>

      <Section
        title="Dimensions"
        icon="ruler"
        action={
          <span className="inline-flex items-center gap-1 rounded-full bg-sage-500/15 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-sage-700 dark:text-sage-300">
            {formatArea(area, unit)}
          </span>
        }
      >
        {/* Floor dimensions: 2-column W & L with CAD icons */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-ink-700 dark:text-sage-100">
              Floor plan (Interior)
            </span>
            <span className="text-[10px] text-ink-400">Usable boundary</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <CompactDimensionField
              label="Width"
              badge="W"
              badgeColor="sage"
              icon={
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-sage-600 dark:text-sage-400" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M2 8h12M4.5 5.5 2 8l2.5 2.5M11.5 5.5 14 8l-2.5 2.5" />
                  <path d="M2 3v10M14 3v10" strokeWidth="1.2" opacity="0.6" />
                </svg>
              }
              value={dims.width}
              min={ROOM_LIMITS.minWidth}
              max={ROOM_LIMITS.maxWidth}
              unit={unit}
              secondary={
                unit === 'ft'
                  ? `≈ ${dims.width.toFixed(2)} m`
                  : `≈ ${(dims.width / M_PER_FT).toFixed(2)} ft`
              }
              onChange={(w) => setRoomDimensions({ width: w })}
            />
            <CompactDimensionField
              label="Length"
              badge="L"
              badgeColor="sky"
              icon={
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M8 2v12M5.5 4.5 8 2l2.5 2.5M5.5 11.5 8 14l2.5-2.5" />
                  <path d="M3 2h10M3 14h10" strokeWidth="1.2" opacity="0.6" />
                </svg>
              }
              value={dims.length}
              min={ROOM_LIMITS.minLength}
              max={ROOM_LIMITS.maxLength}
              unit={unit}
              secondary={
                unit === 'ft'
                  ? `≈ ${dims.length.toFixed(2)} m`
                  : `≈ ${(dims.length / M_PER_FT).toFixed(2)} ft`
              }
              onChange={(l) => setRoomDimensions({ length: l })}
            />
          </div>
        </div>

        {/* Wall & Structural Specs: 2-column Height & Thickness */}
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold text-ink-700 dark:text-sage-100">
            Wall & vertical structure
          </span>
          <div className="grid grid-cols-2 gap-2">
            <CompactDimensionField
              label="Wall height"
              badge="H"
              badgeColor="amber"
              icon={
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M8 3v10M5 6l3-3 3 3" />
                  <path d="M2 13h12" strokeWidth="1.8" />
                </svg>
              }
              value={dims.height}
              min={ROOM_LIMITS.minHeight}
              max={ROOM_LIMITS.maxHeight}
              unit={unit}
              secondary={
                unit === 'ft'
                  ? `≈ ${dims.height.toFixed(2)} m`
                  : `≈ ${(dims.height / M_PER_FT).toFixed(2)} ft`
              }
              onChange={(h) => setRoomDimensions({ height: h })}
            />
            <WallThicknessControl
              thickness={dims.wallThickness}
              unit={unit}
              onChange={(t) => setRoomDimensions({ wallThickness: t })}
            />
          </div>

          {/* Quick Ceiling Presets */}
          <div className="flex items-center gap-1.5 pt-0.5">
            <div className="flex items-center gap-1 text-[10px] text-ink-400 shrink-0">
              <svg viewBox="0 0 16 16" className="h-3 w-3 text-amber-500" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M2 3h12M8 13V5M5 8l3-3 3 3" />
              </svg>
              <span>Ceiling:</span>
            </div>
            <div className="grid grid-cols-4 gap-1 flex-1">
              {ceilingPresets.map((cp) => {
                const active = Math.abs(dims.height - cp.val) < 0.04;
                return (
                  <motion.button
                    whileTap={{ scale: 0.94 }}
                    whileHover={{ y: -0.5 }}
                    key={cp.label}
                    type="button"
                    onClick={() => setRoomDimensions({ height: cp.val })}
                    className={clsx(
                      'rounded-control border px-1.5 py-0.5 text-center text-[10px] font-medium transition-all duration-150',
                      active
                        ? 'border-amber-500/70 bg-amber-50 text-amber-800 shadow-subtle ring-1 ring-amber-500/20 dark:bg-amber-950/50 dark:text-amber-200 font-semibold'
                        : 'border-ink-200/80 bg-white/70 text-ink-600 hover:border-ink-300 dark:border-ink-800 dark:bg-ink-800/40 dark:text-ink-400'
                    )}
                  >
                    {cp.label}
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-control border border-sage-200/60 bg-sage-50/50 p-2 text-[11px] text-sage-800 dark:border-sage-900/50 dark:bg-sage-950/30 dark:text-sage-300">
          <Icon name="info" className="h-3.5 w-3.5 shrink-0 text-sage-600 dark:text-sage-400" />
          <span>Width and length are interior measurements — the usable floor boundary.</span>
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
        {/* Quick Add Action Bar with Animated Gradient Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <motion.button
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={() => handleAddOpening('door', 'south')}
            className={clsx(
              'group flex items-center justify-center gap-2 rounded-control border border-sage-500/30 bg-gradient-to-b from-white to-sage-50/30 px-3 py-2.5 text-caption font-semibold shadow-subtle',
              'transition-all duration-150 hover:border-sage-500 hover:from-sage-50/60 hover:to-sage-100/50 hover:text-sage-900 hover:shadow-glow-sage',
              'dark:border-sage-500/30 dark:from-ink-800 dark:to-sage-950/30 dark:text-sage-100 dark:hover:border-sage-500 dark:hover:from-ink-800 dark:hover:to-sage-950/60'
            )}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded bg-sage-500/20 text-sage-600 transition-colors group-hover:bg-sage-600 group-hover:text-white dark:text-sage-300">
              <Icon name="door" className="h-3.5 w-3.5" />
            </span>
            <span>+ Add Door</span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={() => handleAddOpening('window', 'north')}
            className={clsx(
              'group flex items-center justify-center gap-2 rounded-control border border-sky-500/30 bg-gradient-to-b from-white to-sky-50/30 px-3 py-2.5 text-caption font-semibold shadow-subtle',
              'transition-all duration-150 hover:border-sky-500 hover:from-sky-50/60 hover:to-sky-100/50 hover:text-sky-900',
              'dark:border-sky-500/30 dark:from-ink-800 dark:to-sky-950/30 dark:text-sky-100 dark:hover:border-sky-500 dark:hover:from-ink-800 dark:hover:to-sky-950/60'
            )}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded bg-sky-500/20 text-sky-600 transition-colors group-hover:bg-sky-600 group-hover:text-white dark:text-sky-300">
              <Icon name="window" className="h-3.5 w-3.5" />
            </span>
            <span>+ Add Window</span>
          </motion.button>
        </div>

        {/* Filter Bar with Animated Spring Pills and Icons */}
        {doc.room.openings.length > 1 && (
          <div className="relative flex items-center rounded-control bg-ink-100/80 p-0.5 text-[11px] dark:bg-ink-800/80">
            {[
              { id: 'all' as const, icon: 'layers' as const, label: 'All', count: doc.room.openings.length },
              { id: 'door' as const, icon: 'door' as const, label: 'Doors', count: doc.room.openings.filter((o) => o.kind === 'door').length },
              { id: 'window' as const, icon: 'window' as const, label: 'Windows', count: doc.room.openings.filter((o) => o.kind === 'window').length },
            ].map((tab) => {
              const active = openingFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setOpeningFilter(tab.id)}
                  className={clsx(
                    'relative flex flex-1 items-center justify-center gap-1.5 rounded py-1 font-medium transition-colors duration-150',
                    active
                      ? 'text-ink-900 dark:text-sage-50 font-semibold'
                      : 'text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-sage-100'
                  )}
                >
                  {active && (
                    <motion.div
                      layoutId="opening-filter-pill"
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                      className="absolute inset-0 rounded bg-white shadow-subtle dark:bg-ink-700"
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    <Icon name={tab.icon} className="h-3.5 w-3.5" />
                    <span>{tab.label}</span>
                    <span
                      className={clsx(
                        'rounded-full px-1.5 py-0.2 text-[9.5px] tabular-nums',
                        active
                          ? 'bg-sage-500/15 text-sage-700 dark:text-sage-300'
                          : 'bg-ink-200/60 text-ink-500 dark:bg-ink-600/40 dark:text-ink-400'
                      )}
                    >
                      {tab.count}
                    </span>
                  </span>
                </button>
              );
            })}
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
          <span className="inline-flex items-center gap-1 rounded-full bg-sage-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sage-700 dark:text-sage-300">
            {finishTab === 'walls'
              ? selectedWallSide === 'all'
                ? 'All Walls'
                : `${WALL_LABEL[selectedWallSide].split(' ')[0]} Accent`
              : doc.room.floor.pattern}
          </span>
        }
      >
        {/* Studio Switcher Tabs */}
        <div className="flex items-center gap-1 rounded-control bg-ink-100 p-0.5 text-[11px] dark:bg-ink-800">
          <button
            type="button"
            onClick={() => setFinishTab('walls')}
            className={clsx(
              'flex flex-1 items-center justify-center gap-1.5 rounded py-1.5 font-semibold transition-all',
              finishTab === 'walls'
                ? 'bg-white text-ink-900 shadow-subtle dark:bg-ink-700 dark:text-sage-50'
                : 'text-ink-500 hover:text-ink-800 dark:text-ink-400'
            )}
          >
            <Icon name="palette" className="h-3.5 w-3.5" />
            <span>Walls & Accents</span>
          </button>
          <button
            type="button"
            onClick={() => setFinishTab('floor')}
            className={clsx(
              'flex flex-1 items-center justify-center gap-1.5 rounded py-1.5 font-semibold transition-all',
              finishTab === 'floor'
                ? 'bg-white text-ink-900 shadow-subtle dark:bg-ink-700 dark:text-sage-50'
                : 'text-ink-500 hover:text-ink-800 dark:text-ink-400'
            )}
          >
            <Icon name="grid" className="h-3.5 w-3.5" />
            <span>Flooring & Tiles</span>
          </button>
        </div>

        {/* ── WALLS TAB ─────────────────────────────────────────── */}
        {finishTab === 'walls' && (
          <div className="flex flex-col gap-3.5 pt-0.5">
            {/* Wall Scope: All Walls vs Accent Wall */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium text-ink-500 dark:text-ink-400">Target wall</span>
                {selectedWallSide !== 'all' ? (
                  doc.room.wallOverrides?.[selectedWallSide] ? (
                    <span className="rounded bg-sage-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-sage-700 dark:text-sage-300">
                      Custom Accent
                    </span>
                  ) : (
                    <span className="text-[10px] text-ink-400">Matches Room Base</span>
                  )
                ) : (
                  <span className="text-[10px] text-ink-400">All 4 Walls</span>
                )}
              </div>
              <Segmented
                size="sm"
                label="Wall target"
                value={selectedWallSide}
                options={[
                  { value: 'all', label: 'All Walls' },
                  { value: 'north', label: 'North' },
                  { value: 'south', label: 'South' },
                  { value: 'east', label: 'East' },
                  { value: 'west', label: 'West' },
                ]}
                onChange={(val) => setSelectedWallSide(val as WallSide | 'all')}
              />
            </div>

            {/* Accent Wall Status Banner */}
            {selectedWallSide !== 'all' && (
              doc.room.wallOverrides?.[selectedWallSide] ? (
                <div className="flex items-center justify-between rounded-control border border-sage-300 bg-sage-50/70 p-2 text-caption dark:border-sage-800/80 dark:bg-sage-950/30">
                  <div className="min-w-0">
                    <p className="font-semibold text-sage-900 dark:text-sage-100">
                      {WALL_LABEL[selectedWallSide]} Accent Wall
                    </p>
                    <p className="text-[10px] text-sage-600 dark:text-sage-400">
                      Custom pattern & paint active on this wall
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => resetWallSide(selectedWallSide)}
                  >
                    Reset
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-control border border-dashed border-ink-300 bg-ink-50/40 p-2 text-caption dark:border-ink-700 dark:bg-ink-800/30">
                  <div className="min-w-0">
                    <p className="font-medium text-ink-700 dark:text-ink-200">
                      {WALL_LABEL[selectedWallSide]} Wall
                    </p>
                    <p className="text-[10px] text-ink-400">
                      Currently inherits the base room finish
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setWallSideColor(selectedWallSide, doc.room.walls.color)}
                  >
                    Customize
                  </Button>
                </div>
              )
            )}

            {/* Active accents quick-jump pills when All Walls is selected */}
            {selectedWallSide === 'all' &&
              doc.room.wallOverrides &&
              Object.keys(doc.room.wallOverrides).length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 rounded-control bg-sage-50/60 p-2 dark:bg-sage-950/25">
                  <span className="text-[11px] font-medium text-sage-800 dark:text-sage-300">
                    Active Accents:
                  </span>
                  {WALL_SIDES.filter((s) => !!doc.room.wallOverrides?.[s]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSelectedWallSide(s)}
                      className="rounded-control border border-sage-200 bg-white px-2 py-0.5 text-[10px] font-medium text-ink-700 shadow-subtle transition-all hover:border-sage-400 hover:text-sage-700 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-200"
                    >
                      {WALL_LABEL[s].split(' ')[0]} &rarr;
                    </button>
                  ))}
                </div>
              )}

            {/* Wall Pattern 2-Column Gallery */}
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-medium text-ink-500 dark:text-ink-400">
                {selectedWallSide === 'all'
                  ? 'Wall pattern & texture'
                  : `${WALL_LABEL[selectedWallSide]} wall pattern`}
              </span>
              <div role="radiogroup" aria-label="Wall pattern" className="grid grid-cols-2 gap-2">
                {WALL_PATTERNS.map((p) => {
                  const activeFinish =
                    selectedWallSide === 'all'
                      ? doc.room.walls
                      : (doc.room.wallOverrides?.[selectedWallSide] ?? doc.room.walls);
                  const active = (activeFinish.pattern ?? 'plain') === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setWallSidePattern(selectedWallSide, p.id)}
                      className={clsx(
                        'group flex items-start gap-2.5 rounded-control border p-2 text-left transition-all',
                        active
                          ? 'border-sage-500 bg-sage-50/80 shadow-subtle dark:border-sage-500 dark:bg-sage-950/40'
                          : 'border-ink-200 bg-white hover:border-ink-300 hover:bg-ink-50 dark:border-ink-800 dark:bg-ink-900 dark:hover:border-ink-700'
                      )}
                    >
                      <div
                        className={clsx(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded transition-colors',
                          active
                            ? 'text-sage-700 dark:text-sage-300'
                            : 'text-ink-400 group-hover:text-ink-600 dark:text-ink-500 dark:group-hover:text-ink-300'
                        )}
                      >
                        <PatternThumbnail id={p.id} className="h-6 w-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
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
                            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-sage-600 text-white">
                              <Icon name="check" className="h-2.5 w-2.5" />
                            </span>
                          )}
                        </div>
                        <p className="line-clamp-2 text-[10px] leading-tight text-ink-400">
                          {p.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Wall Colour Studio */}
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-medium text-ink-500 dark:text-ink-400">
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
          </div>
        )}

        {/* ── FLOORING TAB ──────────────────────────────────────── */}
        {finishTab === 'floor' && (
          <div className="flex flex-col gap-3.5 pt-0.5">
            {/* Quick Complete Flooring Presets */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-ink-500 dark:text-ink-400">
                  Curated floor materials
                </span>
                <span className="text-[10px] text-ink-400">1-click complete styling</span>
              </div>
              <div role="radiogroup" aria-label="Flooring presets" className="grid grid-cols-2 gap-1.5">
                {FLOOR_PRESETS.map((preset) => {
                  const active =
                    doc.room.floor.color.toLowerCase() === preset.color.toLowerCase() &&
                    doc.room.floor.pattern === preset.pattern;
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setFloor({ color: preset.color, pattern: preset.pattern })}
                      className={clsx(
                        'flex items-center gap-2 rounded-control border p-2 text-left transition-all',
                        active
                          ? 'border-sage-500 bg-sage-50/80 shadow-subtle dark:border-sage-500 dark:bg-sage-950/40'
                          : 'border-ink-200 bg-white hover:border-ink-300 hover:bg-ink-50 dark:border-ink-800 dark:bg-ink-900 dark:hover:border-ink-700'
                      )}
                    >
                      <span
                        className="h-4 w-4 shrink-0 rounded-full border border-black/15 shadow-subtle dark:border-white/20"
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
                        <span className="block text-[9px] text-ink-400 capitalize">
                          {preset.pattern}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Floor Pattern */}
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-medium text-ink-500 dark:text-ink-400">
                Floor pattern & layout
              </span>
              <div role="radiogroup" aria-label="Floor pattern" className="grid grid-cols-2 gap-2">
                {FLOOR_PATTERNS.map((p) => {
                  const active = doc.room.floor.pattern === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setFloor({ pattern: p.id })}
                      className={clsx(
                        'group flex items-start gap-2.5 rounded-control border p-2 text-left transition-all',
                        active
                          ? 'border-sage-500 bg-sage-50/80 shadow-subtle dark:border-sage-500 dark:bg-sage-950/40'
                          : 'border-ink-200 bg-white hover:border-ink-300 hover:bg-ink-50 dark:border-ink-800 dark:bg-ink-900 dark:hover:border-ink-700'
                      )}
                    >
                      <div
                        className={clsx(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded transition-colors',
                          active
                            ? 'text-sage-700 dark:text-sage-300'
                            : 'text-ink-400 group-hover:text-ink-600 dark:text-ink-500 dark:group-hover:text-ink-300'
                        )}
                      >
                        <PatternThumbnail id={p.id} className="h-6 w-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
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
                            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-sage-600 text-white">
                              <Icon name="check" className="h-2.5 w-2.5" />
                            </span>
                          )}
                        </div>
                        <p className="line-clamp-2 text-[10px] leading-tight text-ink-400">
                          {p.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Floor Colour */}
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-medium text-ink-500 dark:text-ink-400">
                Floor colour & tone
              </span>
              <ColorPicker
                label="Floor colour"
                presets={FLOOR_COLORS}
                value={doc.room.floor.color}
                onChange={(c) => setFloor({ color: c })}
              />
            </div>
          </div>
        )}
      </Section>

      <Section title="Guides & snapping" icon="magnet" defaultOpen={false}>
        <Switch label="Show dimensions" checked={showDimensions} onChange={setShowDimensions} />
        <Switch
          label="Show clearance zones"
          description="Space each item needs to be usable"
          checked={showClearance}
          onChange={setShowClearance}
        />
        <Switch label="Show grid" checked={showGrid} onChange={setShowGrid} />
        <div className="h-px bg-ink-200 dark:bg-ink-800" />
        <Switch label="Snap to walls" checked={snap.wall} onChange={(wall) => setSnap({ wall })} />
        <Switch
          label="Auto-align to walls"
          description="Rotate furniture to face inward when near walls"
          checked={snap.autoRotate ?? true}
          onChange={(autoRotate) => setSnap({ autoRotate })}
        />
        <Switch
          label="Snap to furniture"
          checked={snap.furniture}
          onChange={(furniture) => setSnap({ furniture })}
        />
        <Switch label="Snap to grid" checked={snap.grid} onChange={(grid) => setSnap({ grid })} />
        <div className="flex items-center justify-between">
          <span className="text-caption font-medium text-ink-500 dark:text-ink-400">
            Rotation step
          </span>
          <Segmented
            size="sm"
            label="Rotation snapping"
            value={String(snap.rotationStep)}
            options={[
              { value: '0', label: 'Free' },
              { value: '15', label: '15°' },
              { value: '45', label: '45°' },
              { value: '90', label: '90°' },
            ]}
            onChange={(v) => setSnap({ rotationStep: Number(v) })}
          />
        </div>
        <p className="text-[11px] text-ink-400">Hold Alt while dragging to ignore snapping.</p>
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
