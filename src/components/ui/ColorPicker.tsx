import { useState, useEffect, useRef } from 'react';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { normalizeHex, toStrictHex } from '@/utils/color';
import { Icon } from './Icon';
import { Tooltip } from './primitives';

export interface ColorOption {
  name: string;
  color: string;
}

export interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
  presets?: ColorOption[];
  secondaryPresets?: ColorOption[];
  secondaryLabel?: string;
  allowCustom?: boolean;
  className?: string;
}

export function ColorPicker({
  label,
  value,
  onChange,
  presets = [],
  secondaryPresets,
  secondaryLabel = 'Accents',
  allowCustom = true,
  className,
}: ColorPickerProps) {
  const [typedHex, setTypedHex] = useState(value);
  const colorInputRef = useRef<HTMLInputElement>(null);

  // Sync internal text field when external value changes
  useEffect(() => {
    setTypedHex(value);
  }, [value]);

  const activeStrict = toStrictHex(value);
  const matchedPreset = presets
    .concat(secondaryPresets ?? [])
    .find((p) => p.color.toLowerCase() === value.toLowerCase());

  const handleHexChange = (text: string) => {
    setTypedHex(text);
    const valid = normalizeHex(text);
    if (valid && valid.toLowerCase() !== value.toLowerCase()) {
      onChange(valid);
    }
  };

  const handleHexBlur = () => {
    const valid = normalizeHex(typedHex);
    if (valid) {
      setTypedHex(valid);
      if (valid.toLowerCase() !== value.toLowerCase()) {
        onChange(valid);
      }
    } else {
      setTypedHex(value);
    }
  };

  const handleNativeColorInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value.toLowerCase();
    setTypedHex(newColor);
    onChange(newColor);
  };

  // Modern browser screen eyedropper progressive enhancement
  const supportsEyeDropper =
    typeof window !== 'undefined' && 'EyeDropper' in window;

  const handleEyeDropper = async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dropper = new (window as any).EyeDropper();
      const result = await dropper.open();
      if (result?.sRGBHex) {
        const hex = normalizeHex(result.sRGBHex);
        if (hex) {
          setTypedHex(hex);
          onChange(hex);
        }
      }
    } catch {
      // User cancelled or unsupported
    }
  };

  return (
    <div className={clsx('flex flex-col gap-2.5', className)} role="group" aria-label={label}>
      {/* Primary Swatches */}
      {presets.length > 0 && (
        <div
          role="radiogroup"
          aria-label={`${label} swatches`}
          className={clsx(
            presets.length === 8
              ? 'grid grid-cols-8 gap-1.5'
              : presets.length === 12
              ? 'grid grid-cols-6 gap-1.5'
              : presets.length <= 6
              ? 'grid grid-cols-6 gap-1.5'
              : 'flex flex-wrap gap-2'
          )}
        >
          {presets.map((c) => {
            const active = c.color.toLowerCase() === value.toLowerCase();
            return (
              <Tooltip key={c.color} content={c.name}>
                <motion.button
                  whileHover={{ scale: 1.15, y: -1 }}
                  whileTap={{ scale: 0.92 }}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={c.name}
                  onClick={() => {
                    onChange(c.color.toLowerCase());
                    setTypedHex(c.color.toLowerCase());
                  }}
                  className={clsx(
                    'relative aspect-square w-full rounded-control border transition-all duration-150 ease-out',
                    active
                      ? 'border-sage-600 ring-2 ring-sage-500 ring-offset-1 dark:ring-offset-ink-900 shadow-sm'
                      : 'border-ink-200/90 dark:border-ink-700/80 hover:border-ink-400'
                  )}
                  style={{ backgroundColor: c.color }}
                >
                  {active && (
                    <Icon
                      name="check"
                      className="absolute inset-0 m-auto h-3 w-3 text-white mix-blend-difference"
                      strokeWidth={2.4}
                    />
                  )}
                </motion.button>
              </Tooltip>
            );
          })}
        </div>
      )}

      {/* Secondary Swatches (e.g. Accents) */}
      {secondaryPresets && secondaryPresets.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-0.5">
          <span className="text-[11px] font-semibold text-ink-500 dark:text-ink-400">{secondaryLabel}</span>
          <div
            role="radiogroup"
            aria-label={`${secondaryLabel} swatches`}
            className={clsx(
              secondaryPresets.length === 6
                ? 'grid grid-cols-6 gap-2'
                : 'flex flex-wrap gap-2'
            )}
          >
            {secondaryPresets.map((c) => {
              const active = c.color.toLowerCase() === value.toLowerCase();
              return (
                <Tooltip key={c.color} content={c.name}>
                  <motion.button
                    whileHover={{ scale: 1.15, y: -1 }}
                    whileTap={{ scale: 0.92 }}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={c.name}
                    onClick={() => {
                      onChange(c.color.toLowerCase());
                      setTypedHex(c.color.toLowerCase());
                    }}
                    className={clsx(
                      'relative aspect-square w-full rounded-control border transition-all duration-150 ease-out',
                      active
                        ? 'border-sage-600 ring-2 ring-sage-500 ring-offset-1 dark:ring-offset-ink-900 shadow-sm'
                        : 'border-ink-200/90 dark:border-ink-700/80 hover:border-ink-400'
                    )}
                    style={{ backgroundColor: c.color }}
                  >
                    {active && (
                      <Icon
                        name="check"
                        className="absolute inset-0 m-auto h-3 w-3 text-white mix-blend-difference"
                        strokeWidth={2.4}
                      />
                    )}
                  </motion.button>
                </Tooltip>
              );
            })}
          </div>
        </div>
      )}

      {/* Custom Color Selector Section */}
      {allowCustom && (
        <div className="flex flex-col gap-1.5 rounded-panel border border-ink-200/90 bg-ink-50/60 p-2.5 transition-colors dark:border-ink-800/80 dark:bg-ink-900/50 shadow-xs">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-ink-700 dark:text-ink-200">
              Custom colour
            </span>
            {matchedPreset ? (
              <span className="truncate rounded bg-ink-100/90 px-1.5 py-0.5 font-mono text-[10px] font-medium text-ink-500 dark:bg-ink-800/90 dark:text-ink-400">
                {matchedPreset.name}
              </span>
            ) : (
              <span className="rounded bg-sage-500/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-sage-700 ring-1 ring-sage-500/25 dark:bg-sage-500/25 dark:text-sage-300">
                Custom {value.toUpperCase()}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Live Swatch Button that triggers native color picker */}
            <div className="relative group shrink-0">
              <label
                className={clsx(
                  'relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-control border shadow-xs transition-transform duration-150 group-hover:scale-105 group-active:scale-95',
                  !matchedPreset
                    ? 'border-sage-600 ring-2 ring-sage-500 ring-offset-1 dark:ring-offset-ink-900'
                    : 'border-ink-300 dark:border-ink-600'
                )}
                style={{ backgroundColor: activeStrict }}
                title="Click to open color palette"
              >
                <Icon
                  name="palette"
                  className="h-3.5 w-3.5 text-white opacity-85 mix-blend-difference drop-shadow"
                />
                <input
                  ref={colorInputRef}
                  type="color"
                  value={activeStrict}
                  onChange={handleNativeColorInput}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  aria-label={`Pick custom ${label}`}
                />
              </label>
            </div>

            {/* Hex text input */}
            <div className="relative flex-1 min-w-0">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-[11px] font-bold text-ink-400">
                #
              </span>
              <input
                type="text"
                spellCheck={false}
                value={typedHex.replace(/^#/, '').toUpperCase()}
                onChange={(e) => handleHexChange(e.target.value)}
                onBlur={handleHexBlur}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleHexBlur();
                  }
                }}
                placeholder="C69C6D"
                maxLength={6}
                className={clsx(
                  'h-8 w-full rounded-control border border-ink-200/90 bg-white pl-6 pr-2 font-mono text-[12px] font-bold uppercase text-ink-900',
                  'transition-all duration-150 shadow-2xs',
                  'placeholder:text-ink-400 focus:border-sage-500 focus:outline-none focus:ring-1 focus:ring-sage-500/30',
                  'dark:border-ink-700/80 dark:bg-ink-950 dark:text-sage-50'
                )}
                aria-label={`Hex code for ${label}`}
              />
            </div>

            {/* Screen EyeDropper tool if browser supports it */}
            {supportsEyeDropper && (
              <motion.button
                whileTap={{ scale: 0.92 }}
                type="button"
                onClick={handleEyeDropper}
                title="Sample colour from screen"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control border border-ink-200/90 bg-white text-ink-600 transition-colors hover:border-ink-300 hover:bg-ink-50 dark:border-ink-700/80 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-ink-700 shadow-2xs"
              >
                <Icon name="dropper" className="h-3.5 w-3.5" />
              </motion.button>
            )}

            {/* Quick button to open native picker */}
            <motion.button
              whileTap={{ scale: 0.94 }}
              type="button"
              onClick={() => colorInputRef.current?.click()}
              className="flex h-8 items-center gap-1.5 rounded-control border border-ink-200/90 bg-white px-2.5 text-[11px] font-semibold text-ink-700 transition-colors hover:border-ink-300 hover:bg-ink-50 dark:border-ink-700/80 dark:bg-ink-800 dark:text-ink-200 dark:hover:bg-ink-700 shadow-2xs"
            >
              <Icon name="palette" className="h-3.5 w-3.5 text-sage-600 dark:text-sage-400" />
              <span>Pick</span>
            </motion.button>
          </div>
        </div>
      )}
    </div>
  );
}

