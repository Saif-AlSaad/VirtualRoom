import { describe, expect, it } from 'vitest';
import type { Clearance, Rect } from '@/types';
import {
  clampRectToRoom,
  clearanceRect,
  normalizeAngle,
  outOfBoundsAmount,
  overlapDepth,
  rectAABB,
  rectCorners,
  rectInsideRoom,
  rectsOverlap,
  rotateLocal,
  unrotateLocal,
} from './collision';

const rect = (cx: number, cz: number, w: number, d: number, rot = 0): Rect => ({
  cx,
  cz,
  w,
  d,
  rot,
});

describe('rotateLocal', () => {
  it('is the identity at 0°', () => {
    const p = rotateLocal(1, 2, 0);
    expect(p.x).toBeCloseTo(1);
    expect(p.z).toBeCloseTo(2);
  });

  it('maps local +Z to world +X at 90°, matching three.js rotation.y', () => {
    const p = rotateLocal(0, 1, 90);
    expect(p.x).toBeCloseTo(1);
    expect(p.z).toBeCloseTo(0);
  });

  it('round-trips through unrotateLocal at an arbitrary angle', () => {
    const p = rotateLocal(0.7, -1.3, 37);
    const back = unrotateLocal(p.x, p.z, 37);
    expect(back.x).toBeCloseTo(0.7);
    expect(back.z).toBeCloseTo(-1.3);
  });
});

describe('normalizeAngle', () => {
  it('wraps negatives into [0, 360)', () => {
    expect(normalizeAngle(-90)).toBe(270);
    expect(normalizeAngle(450)).toBe(90);
    expect(normalizeAngle(360)).toBe(0);
  });
});

describe('rectCorners / rectAABB', () => {
  it('produces four corners around the centre', () => {
    const corners = rectCorners(rect(0, 0, 2, 1));
    expect(corners).toHaveLength(4);
    expect(Math.max(...corners.map((c) => c.x))).toBeCloseTo(1);
    expect(Math.max(...corners.map((c) => c.z))).toBeCloseTo(0.5);
  });

  it('grows the AABB when the rectangle is rotated 45°', () => {
    const straight = rectAABB(rect(0, 0, 2, 1));
    const angled = rectAABB(rect(0, 0, 2, 1, 45));
    expect(angled.maxX - angled.minX).toBeGreaterThan(straight.maxX - straight.minX);
  });
});

describe('rectsOverlap', () => {
  it('detects a clear overlap', () => {
    expect(rectsOverlap(rect(0, 0, 2, 2), rect(1, 1, 2, 2))).toBe(true);
  });

  it('returns false for separated rectangles', () => {
    expect(rectsOverlap(rect(0, 0, 1, 1), rect(5, 0, 1, 1))).toBe(false);
  });

  it('treats exactly flush edges as NOT overlapping', () => {
    // Two 1 m boxes touching at x = 0.5. Placing furniture against a wall or
    // another item must never be reported as a collision.
    expect(rectsOverlap(rect(0, 0, 1, 1), rect(1, 0, 1, 1))).toBe(false);
  });

  it('catches rotated overlaps an AABB test would miss', () => {
    // Two long thin rectangles crossing at right angles: their AABBs overlap
    // and so do they.
    expect(rectsOverlap(rect(0, 0, 3, 0.3), rect(0, 0, 0.3, 3))).toBe(true);
  });

  it('rejects rotated rectangles whose AABBs overlap but bodies do not', () => {
    // Two diamonds offset along the diagonal — the classic false positive for
    // axis-aligned tests.
    const a = rect(0, 0, 1, 1, 45);
    const b = rect(1.2, 1.2, 1, 1, 45);
    expect(rectAABB(a).maxX).toBeGreaterThan(rectAABB(b).minX);
    expect(rectsOverlap(a, b)).toBe(false);
  });

  it('is symmetric', () => {
    const a = rect(0, 0, 2, 1, 30);
    const b = rect(0.8, 0.3, 1.5, 1.5, 70);
    expect(rectsOverlap(a, b)).toBe(rectsOverlap(b, a));
  });
});

describe('overlapDepth', () => {
  it('is zero when apart and positive when interpenetrating', () => {
    expect(overlapDepth(rect(0, 0, 1, 1), rect(3, 0, 1, 1))).toBe(0);
    expect(overlapDepth(rect(0, 0, 2, 2), rect(1, 0, 2, 2))).toBeCloseTo(1, 2);
  });
});

describe('room bounds', () => {
  it('accepts a rectangle fully inside', () => {
    expect(rectInsideRoom(rect(0, 0, 1, 1), 4, 5)).toBe(true);
  });

  it('rejects one poking through a wall', () => {
    expect(rectInsideRoom(rect(1.9, 0, 1, 1), 4, 5)).toBe(false);
  });

  it('accepts one placed exactly flush to the wall', () => {
    expect(rectInsideRoom(rect(1.5, 0, 1, 1), 4, 5)).toBe(true);
  });

  it('reports how far out of bounds a rectangle is', () => {
    expect(outOfBoundsAmount(rect(2.5, 0, 1, 1), 4, 5)).toBeCloseTo(1);
    expect(outOfBoundsAmount(rect(0, 0, 1, 1), 4, 5)).toBe(0);
  });
});

describe('clampRectToRoom', () => {
  it('pulls an out-of-bounds rectangle back flush to the wall', () => {
    const clamped = clampRectToRoom(rect(9, 0, 1, 1), 4, 5);
    expect(clamped.x).toBeCloseTo(1.5);
  });

  it('leaves an interior rectangle untouched', () => {
    const clamped = clampRectToRoom(rect(0.3, -1, 1, 1), 4, 5);
    expect(clamped.x).toBeCloseTo(0.3);
    expect(clamped.z).toBeCloseTo(-1);
  });

  it('centres an object that is wider than the room instead of oscillating', () => {
    const clamped = clampRectToRoom(rect(3, 0, 10, 1), 4, 5);
    expect(clamped.x).toBe(0);
  });

  it('clamps a rotated rectangle by its true extent', () => {
    const clamped = clampRectToRoom(rect(1.9, 0, 1, 1, 45), 4, 5);
    const box = rectAABB({ ...rect(clamped.x, clamped.z, 1, 1, 45) });
    expect(box.maxX).toBeLessThanOrEqual(2 + 1e-6);
  });
});

describe('clearanceRect', () => {
  const clearance: Clearance = { front: 0.6, back: 0, left: 0.2, right: 0.2 };

  it('grows the rectangle by the requested amounts', () => {
    const zone = clearanceRect(rect(0, 0, 1, 1), clearance);
    expect(zone.w).toBeCloseTo(1.4);
    expect(zone.d).toBeCloseTo(1.6);
  });

  it('shifts the centre toward the asymmetric side', () => {
    // Clearance only at the front (+Z), so the zone's centre moves +Z by half.
    const zone = clearanceRect(rect(0, 0, 1, 1), clearance);
    expect(zone.cz).toBeCloseTo(0.3);
    expect(zone.cx).toBeCloseTo(0);
  });

  it('rotates the shift with the object', () => {
    // At 90° the object's local front (+Z) points to world +X.
    const zone = clearanceRect(rect(0, 0, 1, 1, 90), clearance);
    expect(zone.cx).toBeCloseTo(0.3);
    expect(zone.cz).toBeCloseTo(0);
  });
});
