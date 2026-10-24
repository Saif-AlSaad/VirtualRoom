import { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import type { CatalogItem, FurnitureInstance, Unit, Vec3 } from '@/types';
import {
  calculateNewScale,
  calculateUniformScale,
  formatDualDimension,
  fromDisplay,
  isUniformScale,
  toDisplay,
} from '@/utils/furnitureSizing';
import { parseLength, unitLabel } from '@/utils/units';
import { Icon } from './Icon';
import { NumberField, Section, Tooltip } from './primitives';

interface Props {
  instance: FurnitureInstance;
  catalog: CatalogItem;
  projectUnit: Unit;
  disabled?: boolean;
  onLiveChange: (scale: Vec3) => void;
  onCommit: (scale: Vec3, label: string) => void;
}

export function FurnitureDimensionsEditor({
  instance,
  catalog,
  projectUnit,
  disabled = false,
  onLiveChange,
  onCommit,
}: Props) {
  // Local unit preference for dimension customization; initialized to project unit
  const [activeUnit, setActiveUnit] = useState<Unit>(projectUnit);
  const [lockRatio, setLockRatio] = useState<boolean>(true);

  // Sync with project unit if it changes
  useEffect(() => {
    setActiveUnit(projectUnit);
  }, [projectUnit]);

  const [minScale, maxScale] = catalog.scaleRange;

  // Real-world sizes in metres (with scale applied)
  const currentWidthM = catalog.size.w * instance.scale.x;
  const currentDepthM = catalog.size.d * instance.scale.z;
  const currentHeightM = catalog.size.h * instance.scale.y;

  // Dual unit representations for secondary badges
  const widthDual = useMemo(
    () => formatDualDimension(currentWidthM, activeUnit),
    [currentWidthM, activeUnit]
  );
  const depthDual = useMemo(
    () => formatDualDimension(currentDepthM, activeUnit),
    [currentDepthM, activeUnit]
  );
  const heightDual = useMemo(
    () => formatDualDimension(currentHeightM, activeUnit),
    [currentHeightM, activeUnit]
  );

  // Display values in the active unit
  const widthDisplay = toDisplay(currentWidthM, activeUnit);
  const depthDisplay = toDisplay(currentDepthM, activeUnit);
  const heightDisplay = toDisplay(currentHeightM, activeUnit);

  // Min and max allowable dimensions in the active unit
  const minWidthDisplay = toDisplay(catalog.size.w * minScale, activeUnit);
  const maxWidthDisplay = toDisplay(catalog.size.w * maxScale, activeUnit);

  const minDepthDisplay = toDisplay(catalog.size.d * minScale, activeUnit);
  const maxDepthDisplay = toDisplay(catalog.size.d * maxScale, activeUnit);

  const minHeightDisplay = toDisplay(catalog.size.h * minScale, activeUnit);
  const maxHeightDisplay = toDisplay(catalog.size.h * maxScale, activeUnit);

  const step = activeUnit === 'm' ? 0.01 : 0.05;

  // Scale ratio statistics
  const uniform = isUniformScale(instance.scale);
  const averageRatio = (instance.scale.x + instance.scale.y + instance.scale.z) / 3;

  // ── Dimension Change Handlers ──────────────────────────────────────────

  const handleWidthChange = useCallback(
    (newValDisplay: number, commit = false) => {
      const newMetres = fromDisplay(newValDisplay, activeUnit);
      const nextScale = calculateNewScale({
        axis: 'w',
        newDimensionMetres: newMetres,
        currentScale: instance.scale,
        catalogSize: catalog.size,
        scaleRange: catalog.scaleRange,
        lockRatio,
      });

      if (commit) {
        onCommit(nextScale, 'Resize width');
      } else {
        onLiveChange(nextScale);
      }
    },
    [activeUnit, catalog.scaleRange, catalog.size, instance.scale, lockRatio, onCommit, onLiveChange]
  );

  const handleDepthChange = useCallback(
    (newValDisplay: number, commit = false) => {
      const newMetres = fromDisplay(newValDisplay, activeUnit);
      const nextScale = calculateNewScale({
        axis: 'd',
        newDimensionMetres: newMetres,
        currentScale: instance.scale,
        catalogSize: catalog.size,
        scaleRange: catalog.scaleRange,
        lockRatio,
      });

      if (commit) {
        onCommit(nextScale, 'Resize depth');
      } else {
        onLiveChange(nextScale);
      }
    },
    [activeUnit, catalog.scaleRange, catalog.size, instance.scale, lockRatio, onCommit, onLiveChange]
  );

  const handleHeightChange = useCallback(
    (newValDisplay: number, commit = false) => {
      const newMetres = fromDisplay(newValDisplay, activeUnit);
      const nextScale = calculateNewScale({
        axis: 'h',
        newDimensionMetres: newMetres,
        currentScale: instance.scale,
        catalogSize: catalog.size,
        scaleRange: catalog.scaleRange,
        lockRatio,
      });

      if (commit) {
        onCommit(nextScale, 'Resize height');
      } else {
        onLiveChange(nextScale);
      }
    },
    [activeUnit, catalog.scaleRange, catalog.size, instance.scale, lockRatio, onCommit, onLiveChange]
  );

  // ── Scale Ratio Handlers ───────────────────────────────────────────────

  const handleScaleRatioChange = useCallback(
    (newRatio: number, commit = false) => {
      const nextScale = calculateUniformScale(
        newRatio,
        instance.scale,
        catalog.scaleRange,
        lockRatio && !uniform // preserve non-uniform proportions if locked
      );

      if (commit) {
        onCommit(nextScale, 'Adjust scale ratio');
      } else {
        onLiveChange(nextScale);
      }
    },
    [catalog.scaleRange, instance.scale, lockRatio, onCommit, onLiveChange, uniform]
  );

  const applyScalePreset = useCallback(
    (ratio: number) => {
      const nextScale = calculateUniformScale(
        ratio,
        instance.scale,
        catalog.scaleRange,
        false
      );
      onCommit(nextScale, `Scale to ${Math.round(ratio * 100)}%`);
    },
    [catalog.scaleRange, instance.scale, onCommit]
  );

  const resetToCatalogSize = useCallback(() => {
    onCommit({ x: 1, y: 1, z: 1 }, 'Reset furniture size');
  }, [onCommit]);

  return (
    <Section title="Dimensions & Scale" icon="ruler" defaultOpen={true}>
      {/* Unit Selector & Aspect Ratio Lock Bar */}
      <div className="flex items-center justify-between gap-2 border-b border-ink-100 pb-2.5 dark:border-ink-800">
        <div className="flex items-center gap-1.5">
          <span className="text-caption font-medium text-ink-500 dark:text-ink-400">
            Unit:
          </span>
          <div
            role="group"
            aria-label="Dimension unit selector"
            className="inline-flex rounded-control border border-ink-200 bg-ink-50 p-0.5 dark:border-ink-700 dark:bg-ink-800"
          >
            <button
              type="button"
              disabled={disabled}
              onClick={() => setActiveUnit('m')}
              className={clsx(
                'rounded-[3px] px-2.5 py-0.5 text-[11px] font-semibold transition-all duration-150',
                activeUnit === 'm'
                  ? 'bg-sage-600 text-white shadow-subtle dark:bg-sage-500'
                  : 'text-ink-600 hover:text-ink-900 dark:text-ink-300 dark:hover:text-white'
              )}
            >
              m (Metres)
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setActiveUnit('ft')}
              className={clsx(
                'rounded-[3px] px-2.5 py-0.5 text-[11px] font-semibold transition-all duration-150',
                activeUnit === 'ft'
                  ? 'bg-sage-600 text-white shadow-subtle dark:bg-sage-500'
                  : 'text-ink-600 hover:text-ink-900 dark:text-ink-300 dark:hover:text-white'
              )}
            >
              ft (Feet)
            </button>
          </div>
        </div>

        {/* Aspect Ratio Lock Toggle */}
        <Tooltip
          content={
            lockRatio
              ? 'Lock aspect ratio (proportional resize)'
              : 'Unlock aspect ratio (independent axis stretch)'
          }
          side="top"
        >
          <button
            type="button"
            disabled={disabled}
            aria-pressed={lockRatio}
            onClick={() => setLockRatio((prev) => !prev)}
            className={clsx(
              'flex items-center gap-1.5 rounded-control border px-2 py-1 text-[11px] font-medium transition-colors duration-150',
              lockRatio
                ? 'border-sage-300 bg-sage-50 text-sage-800 dark:border-sage-800/80 dark:bg-sage-950/40 dark:text-sage-200'
                : 'border-ink-200 bg-white text-ink-500 hover:text-ink-800 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-400 dark:hover:text-ink-200'
            )}
          >
            <Icon
              name={lockRatio ? 'link' : 'unlink'}
              className="h-3.5 w-3.5"
            />
            <span>{lockRatio ? 'Ratio locked' : 'Free stretch'}</span>
          </button>
        </Tooltip>
      </div>

      {/* Dimension Inputs */}
      <div className="flex flex-col gap-2.5">
        {/* Width (W) */}
        <div>
          <NumberField
            label="Width (W)"
            suffix={unitLabel(activeUnit)}
            value={widthDisplay}
            min={minWidthDisplay}
            max={maxWidthDisplay}
            step={step}
            showSlider
            disabled={disabled}
            format={(v) => v.toFixed(2)}
            parse={(t) => {
              const m = parseLength(t, activeUnit);
              return m === null ? null : toDisplay(m, activeUnit);
            }}
            onChange={(v) => handleWidthChange(v, false)}
            onCommit={(v) => handleWidthChange(v, true)}
          />
          <div className="mt-0.5 flex justify-end">
            <span className="text-[10.5px] tabular-nums text-ink-400 dark:text-ink-500">
              ≈ {widthDual.secondary}
            </span>
          </div>
        </div>

        {/* Depth (D) / Length */}
        <div>
          <NumberField
            label="Depth (D)"
            suffix={unitLabel(activeUnit)}
            value={depthDisplay}
            min={minDepthDisplay}
            max={maxDepthDisplay}
            step={step}
            showSlider
            disabled={disabled}
            format={(v) => v.toFixed(2)}
            parse={(t) => {
              const m = parseLength(t, activeUnit);
              return m === null ? null : toDisplay(m, activeUnit);
            }}
            onChange={(v) => handleDepthChange(v, false)}
            onCommit={(v) => handleDepthChange(v, true)}
          />
          <div className="mt-0.5 flex justify-end">
            <span className="text-[10.5px] tabular-nums text-ink-400 dark:text-ink-500">
              ≈ {depthDual.secondary}
            </span>
          </div>
        </div>

        {/* Height (H) */}
        <div>
          <NumberField
            label="Height (H)"
            suffix={unitLabel(activeUnit)}
            value={heightDisplay}
            min={minHeightDisplay}
            max={maxHeightDisplay}
            step={step}
            showSlider
            disabled={disabled}
            format={(v) => v.toFixed(2)}
            parse={(t) => {
              const m = parseLength(t, activeUnit);
              return m === null ? null : toDisplay(m, activeUnit);
            }}
            onChange={(v) => handleHeightChange(v, false)}
            onCommit={(v) => handleHeightChange(v, true)}
          />
          <div className="mt-0.5 flex justify-end">
            <span className="text-[10.5px] tabular-nums text-ink-400 dark:text-ink-500">
              ≈ {heightDual.secondary}
            </span>
          </div>
        </div>
      </div>

      {/* Scale Ratio & Preset Adjustments */}
      <div className="mt-1 flex flex-col gap-2 rounded-control border border-ink-100 bg-ink-50/50 p-2.5 dark:border-ink-800 dark:bg-ink-900/30">
        <div className="flex items-center justify-between">
          <span className="text-caption font-medium text-ink-600 dark:text-ink-300">
            Scale Ratio
          </span>
          <div className="flex items-center gap-1.5 text-caption font-medium tabular-nums">
            <span className="text-sage-700 dark:text-sage-400 font-semibold">
              {(averageRatio).toFixed(2)}×
            </span>
            <span className="text-ink-400">
              ({Math.round(averageRatio * 100)}%)
            </span>
            {!uniform && (
              <span className="rounded bg-warn/15 px-1 py-0.2 text-[10px] font-medium text-[#8a5a05] dark:text-[#fcd34d]">
                Custom
              </span>
            )}
          </div>
        </div>

        <NumberField
          label="Ratio Multiplier"
          suffix="×"
          value={averageRatio}
          min={minScale}
          max={maxScale}
          step={0.01}
          showSlider
          disabled={disabled}
          format={(v) => v.toFixed(2)}
          parse={(t) => {
            const raw = t.replace(/[×%]/g, '').trim();
            const n = Number(raw);
            return Number.isFinite(n) ? n : null;
          }}
          onChange={(v) => handleScaleRatioChange(v, false)}
          onCommit={(v) => handleScaleRatioChange(v, true)}
        />

        {/* Quick Scale Ratio Presets */}
        <div className="flex items-center gap-1.5 pt-0.5">
          {[
            { label: '0.8×', ratio: 0.8 },
            { label: '1.0×', ratio: 1.0 },
            { label: '1.2×', ratio: 1.2 },
            { label: '1.5×', ratio: 1.5 },
          ].map((preset) => (
            <button
              key={preset.label}
              type="button"
              disabled={disabled}
              onClick={() => applyScalePreset(preset.ratio)}
              className={clsx(
                'flex-1 rounded-control border py-1 text-[11px] font-medium transition-colors duration-150',
                Math.abs(averageRatio - preset.ratio) < 0.02 && uniform
                  ? 'border-sage-500 bg-sage-50 text-sage-800 dark:bg-sage-950/60 dark:text-sage-200'
                  : 'border-ink-200 bg-white text-ink-600 hover:border-sage-400 hover:text-sage-700 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300'
              )}
            >
              {preset.label}
            </button>
          ))}

          <button
            type="button"
            disabled={disabled || (uniform && Math.abs(averageRatio - 1.0) < 0.005)}
            onClick={resetToCatalogSize}
            className="rounded-control border border-ink-200 bg-white px-2.5 py-1 text-[11px] font-medium text-ink-600 transition-colors duration-150 hover:border-danger/40 hover:text-danger disabled:opacity-40 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300 dark:hover:text-danger"
          >
            Reset
          </button>
        </div>
      </div>
    </Section>
  );
}
