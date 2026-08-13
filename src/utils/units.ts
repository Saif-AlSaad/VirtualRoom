import type { Unit } from '@/types';

/**
 * Unit conversion and formatting.
 *
 * Everything stored in the app is metres (see `types/index.ts`). This module is
 * the only place allowed to know what a foot is.
 */

export const M_PER_FT = 0.3048;
export const M_PER_IN = 0.0254;

export function toDisplay(metres: number, unit: Unit): number {
  return unit === 'ft' ? metres / M_PER_FT : metres;
}

export function fromDisplay(value: number, unit: Unit): number {
  return unit === 'ft' ? value * M_PER_FT : value;
}

/** Rounds to a sane number of decimals for the unit (mm vs ~1/16"). */
export function roundForUnit(value: number, unit: Unit): number {
  const factor = unit === 'ft' ? 100 : 1000;
  return Math.round(value * factor) / factor;
}

/**
 * Human-readable length. Feet render as `12' 6"` because decimal feet are
 * unreadable to anyone who actually uses feet.
 */
export function formatLength(
  metres: number,
  unit: Unit,
  opts: { precise?: boolean } = {}
): string {
  if (!Number.isFinite(metres)) return '—';
  if (unit === 'm') {
    const decimals = opts.precise ? 3 : 2;
    return `${metres.toFixed(decimals)} m`;
  }
  const totalInches = metres / M_PER_IN;
  const feet = Math.floor(totalInches / 12);
  let inches = totalInches - feet * 12;
  // Round to 1/2" for display, promoting to the next foot when it rolls over.
  inches = Math.round(inches * 2) / 2;
  if (inches >= 12) return `${feet + 1}′ 0″`;
  const inchText = Number.isInteger(inches) ? `${inches}` : inches.toFixed(1);
  return inches === 0 ? `${feet}′` : `${feet}′ ${inchText}″`;
}

/** Short form for dense UI (dimension chips, minimap labels). */
export function formatLengthShort(metres: number, unit: Unit): string {
  if (unit === 'm') return `${metres.toFixed(2)}m`;
  const totalInches = metres / M_PER_IN;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches - feet * 12);
  if (inches >= 12) return `${feet + 1}′`;
  return inches === 0 ? `${feet}′` : `${feet}′${inches}″`;
}

/** Floor area, in the unit's natural squared measure. */
export function formatArea(squareMetres: number, unit: Unit): string {
  if (unit === 'm') return `${squareMetres.toFixed(2)} m²`;
  const sqft = squareMetres / (M_PER_FT * M_PER_FT);
  return `${sqft.toFixed(1)} ft²`;
}

const FEET_INCHES = /^\s*(-?\d+(?:\.\d+)?)\s*(?:'|′|ft|feet)\s*(?:(\d+(?:\.\d+)?)\s*(?:"|″|in|inch(?:es)?)?)?\s*$/i;
const INCHES_ONLY = /^\s*(-?\d+(?:\.\d+)?)\s*(?:"|″|in|inch(?:es)?)\s*$/i;
const METRIC = /^\s*(-?\d+(?:\.\d+)?)\s*(m|cm|mm)\s*$/i;

/**
 * Parses user text into metres. Accepts the notations people actually type:
 * `3.5`, `3.5m`, `350cm`, `12'`, `12' 6"`, `18"`.
 *
 * A bare number is interpreted in `unit`. Returns null when unparseable, so
 * callers can reject the edit instead of writing NaN into the document.
 */
export function parseLength(input: string, unit: Unit): number | null {
  const raw = String(input).trim();
  if (raw === '') return null;

  const metric = METRIC.exec(raw);
  if (metric) {
    const n = Number(metric[1]);
    if (!Number.isFinite(n)) return null;
    const suffix = metric[2].toLowerCase();
    return suffix === 'm' ? n : suffix === 'cm' ? n / 100 : n / 1000;
  }

  const inchesOnly = INCHES_ONLY.exec(raw);
  if (inchesOnly) {
    const n = Number(inchesOnly[1]);
    return Number.isFinite(n) ? n * M_PER_IN : null;
  }

  const ftIn = FEET_INCHES.exec(raw);
  if (ftIn) {
    const feet = Number(ftIn[1]);
    const inches = ftIn[2] === undefined ? 0 : Number(ftIn[2]);
    if (!Number.isFinite(feet) || !Number.isFinite(inches)) return null;
    // Negative feet carry the sign through to the inches component.
    const sign = feet < 0 ? -1 : 1;
    return sign * (Math.abs(feet) * M_PER_FT + inches * M_PER_IN);
  }

  const bare = Number(raw);
  if (!Number.isFinite(bare)) return null;
  return fromDisplay(bare, unit);
}

/** Label for the unit, for input suffixes. */
export function unitLabel(unit: Unit): string {
  return unit === 'm' ? 'm' : 'ft';
}
