import { describe, expect, it } from 'vitest';
import {
  M_PER_FT,
  formatArea,
  formatLength,
  formatLengthShort,
  fromDisplay,
  parseLength,
  toDisplay,
} from './units';

describe('conversion', () => {
  it('round-trips metres through feet', () => {
    const metres = 3.75;
    expect(fromDisplay(toDisplay(metres, 'ft'), 'ft')).toBeCloseTo(metres, 9);
  });

  it('leaves metres untouched', () => {
    expect(toDisplay(2.5, 'm')).toBe(2.5);
    expect(fromDisplay(2.5, 'm')).toBe(2.5);
  });

  it('uses the international foot', () => {
    expect(fromDisplay(1, 'ft')).toBeCloseTo(M_PER_FT);
  });
});

describe('formatLength', () => {
  it('formats metres with two decimals', () => {
    expect(formatLength(3.456, 'm')).toBe('3.46 m');
  });

  it('formats feet as feet and inches, not decimal feet', () => {
    expect(formatLength(M_PER_FT * 12, 'ft')).toBe('12′');
    expect(formatLength(M_PER_FT * 12 + 0.0254 * 6, 'ft')).toBe('12′ 6″');
  });

  it('promotes to the next foot when inches round up to 12', () => {
    // 11.99 inches rounds to 12, which must read as the next whole foot.
    const almost = M_PER_FT * 5 + 0.0254 * 11.99;
    expect(formatLength(almost, 'ft')).toBe('6′ 0″');
  });

  it('handles non-finite input without throwing', () => {
    expect(formatLength(Number.NaN, 'm')).toBe('—');
  });
});

describe('formatLengthShort', () => {
  it('is compact in both units', () => {
    expect(formatLengthShort(2, 'm')).toBe('2.00m');
    expect(formatLengthShort(M_PER_FT * 8, 'ft')).toBe('8′');
  });
});

describe('formatArea', () => {
  it('uses m² for metric and ft² for imperial', () => {
    expect(formatArea(12, 'm')).toBe('12.00 m²');
    expect(formatArea(1, 'ft')).toBe('10.8 ft²');
  });
});

describe('parseLength', () => {
  it('reads a bare number in the active unit', () => {
    expect(parseLength('3', 'm')).toBeCloseTo(3);
    expect(parseLength('3', 'ft')).toBeCloseTo(3 * M_PER_FT);
  });

  it('reads explicit metric suffixes regardless of the active unit', () => {
    expect(parseLength('350cm', 'ft')).toBeCloseTo(3.5);
    expect(parseLength('1200mm', 'ft')).toBeCloseTo(1.2);
    expect(parseLength('2.4m', 'ft')).toBeCloseTo(2.4);
  });

  it('reads feet-and-inches notation', () => {
    expect(parseLength(`12'`, 'm')).toBeCloseTo(12 * M_PER_FT);
    expect(parseLength(`12' 6"`, 'm')).toBeCloseTo(12 * M_PER_FT + 6 * 0.0254);
    expect(parseLength('12ft 6in', 'm')).toBeCloseTo(12 * M_PER_FT + 6 * 0.0254);
  });

  it('reads inches on their own', () => {
    expect(parseLength('18"', 'm')).toBeCloseTo(18 * 0.0254);
  });

  it('carries the sign through to the inches component', () => {
    expect(parseLength(`-3' 6"`, 'm')).toBeCloseTo(-(3 * M_PER_FT + 6 * 0.0254));
  });

  it('returns null rather than NaN for junk', () => {
    expect(parseLength('', 'm')).toBeNull();
    expect(parseLength('abc', 'm')).toBeNull();
    expect(parseLength('12 metres or so', 'm')).toBeNull();
  });
});
