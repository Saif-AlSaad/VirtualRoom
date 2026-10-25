import { describe, expect, it } from 'vitest';
import type { Rect, RoomDimensions } from '@/types';
import { DEFAULT_SNAP, angleDelta, computeSnap, snapRotation, snapToStep } from './snapping';

const dims: RoomDimensions = {
  width: 4,
  length: 6,
  height: 2.6,
  wallThickness: 0.12,
};

const rect = (cx: number, cz: number, w = 1, d = 1, rot = 0): Rect => ({
  cx,
  cz,
  w,
  d,
  rot,
});

describe('snapToStep', () => {
  it('rounds to the nearest multiple', () => {
    expect(snapToStep(0.37, 0.1)).toBeCloseTo(0.4);
    expect(snapToStep(-0.37, 0.1)).toBeCloseTo(-0.4);
  });

  it('is a no-op for a zero step', () => {
    expect(snapToStep(0.37, 0)).toBe(0.37);
  });
});

describe('snapRotation', () => {
  it('snaps to the nearest increment and normalises', () => {
    expect(snapRotation(43, 15)).toBe(45);
    expect(snapRotation(-10, 15)).toBe(345);
    expect(snapRotation(358, 90)).toBe(0);
  });

  it('leaves rotation free when the step is zero', () => {
    expect(snapRotation(37.4, 0)).toBeCloseTo(37.4);
  });
});

describe('angleDelta', () => {
  it('never exceeds 180° and handles the wrap', () => {
    expect(angleDelta(10, 350)).toBe(20);
    expect(angleDelta(0, 180)).toBe(180);
  });
});

describe('computeSnap', () => {
  it('pulls an object flush against the nearest wall', () => {
    // Room is 4 wide, so the west wall is at x = -2. A 1 m object centred at
    // -1.42 has its left edge 0.08 from the wall — inside the threshold.
    const result = computeSnap(rect(-1.42, 0), [], dims, DEFAULT_SNAP);
    expect(result.position.x).toBeCloseTo(-1.5);
    expect(result.snappedToWall).toBe(true);
    expect(result.guides.some((g) => g.kind === 'wall')).toBe(true);
  });

  it('does not snap to a wall that is far away', () => {
    const result = computeSnap(rect(0, 0), [], dims, DEFAULT_SNAP);
    expect(result.snappedToWall).toBe(false);
  });

  it('snaps flush to another object edge', () => {
    const other = rect(0, 0, 1, 1);
    // Left edge of the moving object is 0.06 from the other's right edge.
    const result = computeSnap(rect(1.06, 0), [other], dims, {
      ...DEFAULT_SNAP,
      wall: false,
    });
    expect(result.position.x).toBeCloseTo(1);
    expect(result.guides.some((g) => g.kind === 'furniture')).toBe(true);
  });

  it('prefers the wall over a nearby furniture edge', () => {
    // An object near both the west wall and another item must go to the wall.
    const other = rect(-1.0, 0, 1, 1);
    const result = computeSnap(rect(-1.44, 0), [other], dims, DEFAULT_SNAP);
    expect(result.position.x).toBeCloseTo(-1.5);
    expect(result.snappedToWall).toBe(true);
  });

  it('falls back to the grid when nothing else is in range', () => {
    const result = computeSnap(rect(0.37, -0.23), [], dims, DEFAULT_SNAP);
    expect(result.position.x).toBeCloseTo(0.4);
    expect(result.position.z).toBeCloseTo(-0.2);
  });

  it('honours a disabled snapping configuration exactly', () => {
    const off = {
      ...DEFAULT_SNAP,
      grid: false,
      wall: false,
      furniture: false,
      rotationStep: 0,
    };
    const result = computeSnap(rect(-1.44, 0.37, 1, 1, 37.4), [], dims, off);
    expect(result.position.x).toBeCloseTo(-1.44);
    expect(result.position.z).toBeCloseTo(0.37);
    expect(result.rotation).toBeCloseTo(37.4);
    expect(result.guides).toHaveLength(0);
  });

  it('applies rotation snapping alongside position snapping', () => {
    const result = computeSnap(rect(0, 0, 1, 1, 43), [], dims, DEFAULT_SNAP);
    expect(result.rotation).toBe(45);
  });

  it('auto-rotates wall-hugging furniture to 0° flush against the North wall', () => {
    // North wall is at z = -3. An item with w=1.2, d=0.6 dragged near z=-2.5
    const item = rect(0, -2.5, 1.2, 0.6, 90);
    const result = computeSnap(item, [], dims, DEFAULT_SNAP);
    expect(result.snappedToWall).toBe(true);
    expect(result.rotation).toBe(0);
    expect(result.position.z).toBeCloseTo(-2.7); // -3.0 + 0.6/2
  });

  it('auto-rotates wall-hugging furniture to 180° flush against the South wall', () => {
    // South wall is at z = 3. An item with w=1.2, d=0.6 dragged near z=2.5
    const item = rect(0, 2.5, 1.2, 0.6, 0);
    const result = computeSnap(item, [], dims, DEFAULT_SNAP);
    expect(result.snappedToWall).toBe(true);
    expect(result.rotation).toBe(180);
    expect(result.position.z).toBeCloseTo(2.7); // 3.0 - 0.6/2
  });

  it('auto-rotates wall-hugging furniture to 90° flush against the West wall', () => {
    // West wall is at x = -2. An item with w=1.2, d=0.6 dragged near x=-1.5
    const item = rect(-1.5, 0, 1.2, 0.6, 0);
    const result = computeSnap(item, [], dims, DEFAULT_SNAP);
    expect(result.snappedToWall).toBe(true);
    expect(result.rotation).toBe(90);
    expect(result.position.x).toBeCloseTo(-1.7); // -2.0 + 0.6/2
  });

  it('auto-rotates wall-hugging furniture to 270° flush against the East wall', () => {
    // East wall is at x = 2. An item with w=1.2, d=0.6 dragged near x=1.5
    const item = rect(1.5, 0, 1.2, 0.6, 0);
    const result = computeSnap(item, [], dims, DEFAULT_SNAP);
    expect(result.snappedToWall).toBe(true);
    expect(result.rotation).toBe(270);
    expect(result.position.x).toBeCloseTo(1.7); // 2.0 - 0.6/2
  });

  it('preserves manual rotation when autoRotate is explicitly false', () => {
    // East wall is at x = 2. Item at x=1.5 has right edge at 1.5 + 0.6 = 2.1 (0.1 from wall)
    const item = rect(1.5, 0, 1.2, 0.6, 45);
    const result = computeSnap(item, [], dims, {
      ...DEFAULT_SNAP,
      autoRotate: false,
      rotationStep: 0,
    });
    expect(result.snappedToWall).toBe(true);
    expect(result.rotation).toBe(45);
  });
});
