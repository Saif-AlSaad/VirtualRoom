/**
 * Color utility functions for parsing, validating, and normalizing hex values.
 */

/** Normalizes a hex string to lowercase '#rrggbb', or returns null if invalid. */
export function normalizeHex(val: string): string | null {
  if (!val) return null;
  let clean = val.trim();
  if (clean.startsWith('#')) {
    clean = clean.slice(1);
  }
  if (/^[0-9a-f]{3}$/i.test(clean)) {
    clean = clean
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (/^[0-9a-f]{6}$/i.test(clean)) {
    return `#${clean.toLowerCase()}`;
  }
  return null;
}

/** Ensures a value passed to native <input type="color"> is strictly valid '#rrggbb'. */
export function toStrictHex(val: string, fallback = '#ffffff'): string {
  const norm = normalizeHex(val);
  return norm ?? fallback;
}
