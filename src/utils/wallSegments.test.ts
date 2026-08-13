import { describe, expect, it } from 'vitest';
import type { Opening } from '@/types';
import { buildWallSegments } from './wallSegments';

/**
 * Wall construction is verified by AREA CONSERVATION: the solid segments plus
 * the openings must exactly account for the wall. That single invariant catches
 * every realistic bug in the pier/lintel/sill split — a missing piece, a double
 * count, or an off-by-one at a boundary.
 */

const opening = (over: Partial<Opening>): Opening => ({
  id: 'o',
  kind: 'door',
  wall: 'north',
  offset: 2,
  width: 0.9,
  height: 2.05,
  sillHeight: 0,
  hinge: 'left',
  swing: 'in',
  ...over,
});

const area = (segments: Array<{ w: number; h: number }>) =>
  segments.reduce((sum, s) => sum + s.w * s.h, 0);

describe('buildWallSegments', () => {
  it('returns one full panel for a blank wall', () => {
    const segments = buildWallSegments(4, 2.6, []);
    expect(segments).toHaveLength(1);
    expect(segments[0].w).toBeCloseTo(4);
    expect(segments[0].h).toBeCloseTo(2.6);
    expect(segments[0].x).toBeCloseTo(0);
  });

  it('conserves area around a door', () => {
    const door = opening({ offset: 2, width: 0.9, height: 2.05 });
    const segments = buildWallSegments(4, 2.6, [door]);
    expect(area(segments)).toBeCloseTo(4 * 2.6 - 0.9 * 2.05, 6);
  });

  it('conserves area around a window, including the sill below it', () => {
    const window = opening({
      kind: 'window',
      offset: 2,
      width: 1.2,
      height: 1.1,
      sillHeight: 0.9,
    });
    const segments = buildWallSegments(4, 2.6, [window]);
    expect(area(segments)).toBeCloseTo(4 * 2.6 - 1.2 * 1.1, 6);
  });

  it('conserves area with several openings on one wall', () => {
    const openings = [
      opening({ offset: 1, width: 0.9, height: 2.05 }),
      opening({ kind: 'window', offset: 3, width: 1.2, height: 1.1, sillHeight: 0.9 }),
      opening({ kind: 'window', offset: 5, width: 0.8, height: 1.0, sillHeight: 1.1 }),
    ];
    const segments = buildWallSegments(6, 2.6, openings);
    const holes = openings.reduce((sum, o) => sum + o.width * o.height, 0);
    expect(area(segments)).toBeCloseTo(6 * 2.6 - holes, 6);
  });

  it('handles an unsorted opening list identically', () => {
    const a = opening({ offset: 1, width: 0.9 });
    const b = opening({ offset: 3, width: 0.9 });
    const forwards = buildWallSegments(5, 2.6, [a, b]);
    const backwards = buildWallSegments(5, 2.6, [b, a]);
    expect(area(backwards)).toBeCloseTo(area(forwards), 9);
  });

  it('produces no zero-size segments for a door reaching full height', () => {
    const segments = buildWallSegments(4, 2.05, [opening({ offset: 2, height: 2.05 })]);
    expect(segments.every((s) => s.w > 0 && s.h > 0)).toBe(true);
    expect(segments).toHaveLength(2); // Piers each side, no lintel.
  });

  it('handles an opening flush against the wall start', () => {
    const segments = buildWallSegments(4, 2.6, [opening({ offset: 0.45, width: 0.9 })]);
    expect(area(segments)).toBeCloseTo(4 * 2.6 - 0.9 * 2.05, 6);
    expect(segments.every((s) => s.w > 0 && s.h > 0)).toBe(true);
  });

  it('handles an opening that spans the entire wall', () => {
    const segments = buildWallSegments(2, 2.6, [
      opening({ kind: 'window', offset: 1, width: 2, height: 1.2, sillHeight: 0.9 }),
    ]);
    expect(area(segments)).toBeCloseTo(2 * 2.6 - 2 * 1.2, 6);
  });

  it('does not double-count when two openings overlap', () => {
    // Overlapping openings are invalid input, but must not produce negative or
    // duplicated geometry.
    const segments = buildWallSegments(4, 2.6, [
      opening({ offset: 2, width: 1.2 }),
      opening({ offset: 2.2, width: 1.2 }),
    ]);
    expect(segments.every((s) => s.w > 0 && s.h > 0)).toBe(true);
    expect(area(segments)).toBeLessThan(4 * 2.6);
  });
});
