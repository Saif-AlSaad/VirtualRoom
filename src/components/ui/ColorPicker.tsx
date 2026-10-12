import { useState, useEffect, useRef } from 'react';
import clsx from 'clsx';
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
        <div role="radiogroup" aria-label={`${label} swatches`} className="flex flex-wrap gap-2">
          {presets.map((c) => {
            const active = c.color.toLowerCase() === value.toLowerCase();
            return (
              <Tooltip key={c.color} content={c.name}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={c.name}
                  onClick={() => {
                    onChange(c.color.toLowerCase());
                    setTypedHex(c.color.toLowerCase());
                  }}
                  className={clsx(
                    'relative h-7 w-7 rounded-control border transition-all duration-150 ease-out',
                    'hover:scale-110 active:scale-95',
                    active
                      ? 'border-sage-600 ring-2 ring-sage-500 ring-offset-1 dark:ring-offset-ink-900 shadow-sm'
                      : 'border-ink-200 dark:border-ink-700'
                  )}
                  style={{ backgroundColor: c.color }}
                >
                  {active && (
                    <Icon
                      name="check"
                      className="absolute inset-0 m-auto h-3.5 w-3.5 text-white mix-blend-difference"
                      strokeWidth={2.4}
                    />
                  )}
                </button>
              </Tooltip>
            );
          })}
        </div>
      )}

      {/* Secondary Swatches (e.g. Accents) */}
      {secondaryPresets && secondaryPresets.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-0.5">
          <span className="text-[11px] font-medium text-ink-400">{secondaryLabel}</span>
          <div role="radiogroup" aria-label={`${secondaryLabel} swatches`} className="flex flex-wrap gap-2">
            {secondaryPresets.map((c) => {
              const active = c.color.toLowerCase() === value.toLowerCase();
              return (
                <Tooltip key={c.color} content={c.name}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={c.name}
                    onClick={() => {
                      onChange(c.color.toLowerCase());
                      setTypedHex(c.color.toLowerCase());
                    }}
                    className={clsx(
                      'relative h-6 w-6 rounded-control border transition-all duration-150 ease-out',
                      'hover:scale-110 active:scale-95',
                      active
                        ? 'border-sage-600 ring-2 ring-sage-500 ring-offset-1 dark:ring-offset-ink-900 shadow-sm'
                        : 'border-ink-200 dark:border-ink-700'
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
                  </button>
                </Tooltip>
              );
            })}
          </div>
        </div>
      )}

      {/* Custom Color Selector Section */}
      {allowCustom && (
        <div className="flex flex-col gap-1.5 rounded-panel border border-ink-200 bg-ink-50/50 p-2.5 dark:border-ink-800 dark:bg-ink-900/40">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-medium text-ink-600 dark:text-ink-300">
              Custom colour
            </span>
            {matchedPreset ? (
              <span className="truncate text-ink-400">{matchedPreset.name}</span>
            ) : (
              <span className="rounded bg-sage-100 px-1.5 py-0.2 text-[10px] font-semibold text-sage-800 dark:bg-sage-950/60 dark:text-sage-300">
                Custom {value.toUpperCase()}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Color Swatch Button with Native Color Picker Input */}
            <div className="relative group shrink-0">
              <label
                className={clsx(
                  'relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-control border shadow-inner transition-transform group-hover:scale-105 group-active:scale-95',
                  !matchedPreset
                    ? 'border-sage-600 ring-2 ring-sage-500 ring-offset-1 dark:ring-offset-ink-900'
                    : 'border-ink-300 dark:border-ink-600'
                )}
                style={{ backgroundColor: activeStrict }}
                title="Click to open color palette"
              >
                <Icon
                  name="palette"
                  className="h-3.5 w-3.5 text-white opacity-80 mix-blend-difference"
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
              <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-caption font-semibold text-ink-400">
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
                placeholder="c69c6d"
                maxLength={6}
                className={clsx(
                  'h-8 w-full rounded-control border bg-white pl-5 pr-2 font-mono text-caption uppercase text-ink-800',
                  'transition-colors duration-150',
                  'placeholder:text-ink-400 focus:border-sage-500 focus:outline-none focus:ring-1 focus:ring-sage-500',
                  'dark:border-ink-700 dark:bg-ink-800 dark:text-sage-50'
                )}
                aria-label={`Hex code for ${label}`}
              />
            </div>

            {/* Screen EyeDropper tool if browser supports it */}
            {supportsEyeDropper && (
              <button
                type="button"
                onClick={handleEyeDropper}
                title="Sample colour from screen"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control border border-ink-200 bg-white text-ink-600 transition-colors hover:border-ink-300 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-ink-700"
              >
                <Icon name="dropper" className="h-3.5 w-3.5" />
              </button>
            )}

            {/* Quick button to open native picker */}
            <button
              type="button"
              onClick={() => colorInputRef.current?.click()}
              className="flex h-8 items-center gap-1 rounded-control border border-ink-200 bg-white px-2 text-caption font-medium text-ink-700 transition-colors hover:border-ink-300 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-200 dark:hover:bg-ink-700"
            >
              <Icon name="palette" className="h-3.5 w-3.5 text-ink-400" />
              <span>Pick</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
