import type { Clearance, Rect, Vec2 } from '@/types';

/**
 * 2D collision on the floor plane.
 *
 * Furniture rotates freely, so axis-aligned boxes are not sufficient — a sofa
 * at 30° would report a bounding box far larger than the sofa. We therefore use
 * oriented rectangles and the Separating Axis Theorem, with a cheap AABB
 * broad-phase in front of it.
 *
 * ROTATION CONVENTION: degrees, matching three.js `rotation.y`. Local +Z is the
 * direction an object faces; the Y-rotation matrix maps local (x, z) to world
 * (x·cos + z·sin, −x·sin + z·cos).
 */

/** 0.1 mm. Objects placed exactly flush must not read as overlapping. */
export const EPSILON = 1e-4;

export function deg2rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function normalizeAngle(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Rotates a local offset into world space around +Y. */
export function rotateLocal(x: number, z: number, degrees: number): Vec2 {
  const a = deg2rad(degrees);
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return { x: x * cos + z * sin, z: -x * sin + z * cos };
}

/** Inverse of `rotateLocal` — world offset back into the object's local frame. */
export function unrotateLocal(x: number, z: number, degrees: number): Vec2 {
  return rotateLocal(x, z, -degrees);
}

/** The four corners of an oriented rectangle, in world space. */
export function rectCorners(r: Rect): Vec2[] {
  const hw = r.w / 2;
  const hd = r.d / 2;
  const local: Array<[number, number]> = [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ];
  return local.map(([lx, lz]) => {
    const p = rotateLocal(lx, lz, r.rot);
    return { x: r.cx + p.x, z: r.cz + p.z };
  });
}

export interface AABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** World-space AABB of an oriented rectangle. Used for broad-phase and 2D view. */
export function rectAABB(r: Rect): AABB {
  const corners = rectCorners(r);
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const c of corners) {
    if (c.x < minX) minX = c.x;
    if (c.x > maxX) maxX = c.x;
    if (c.z < minZ) minZ = c.z;
    if (c.z > maxZ) maxZ = c.z;
  }
  return { minX, maxX, minZ, maxZ };
}

function aabbOverlap(a: AABB, b: AABB): boolean {
  return (
    a.minX < b.maxX - EPSILON &&
    a.maxX > b.minX + EPSILON &&
    a.minZ < b.maxZ - EPSILON &&
    a.maxZ > b.minZ + EPSILON
  );
}

/** Projects corners onto an axis and returns the [min, max] interval. */
function project(corners: Vec2[], axis: Vec2): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const c of corners) {
    const v = c.x * axis.x + c.z * axis.z;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return [min, max];
}

/**
 * Separating Axis Theorem for two convex rectangles. Only four axes need
 * testing (two edge normals per rectangle); if any axis separates them, they
 * do not overlap.
 */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  // Broad-phase: cheap rejection for the common case of distant objects.
  if (!aabbOverlap(rectAABB(a), rectAABB(b))) return false;

  const ca = rectCorners(a);
  const cb = rectCorners(b);
  const axes: Vec2[] = [
    rotateLocal(1, 0, a.rot),
    rotateLocal(0, 1, a.rot),
    rotateLocal(1, 0, b.rot),
    rotateLocal(0, 1, b.rot),
  ];

  for (const axis of axes) {
    const [minA, maxA] = project(ca, axis);
    const [minB, maxB] = project(cb, axis);
    // Strict separation with epsilon: flush contact is allowed.
    if (maxA <= minB + EPSILON || maxB <= minA + EPSILON) return false;
  }
  return true;
}

/** How deeply two rectangles interpenetrate, along the axis of least overlap. */
export function overlapDepth(a: Rect, b: Rect): number {
  if (!rectsOverlap(a, b)) return 0;
  const ca = rectCorners(a);
  const cb = rectCorners(b);
  const axes: Vec2[] = [
    rotateLocal(1, 0, a.rot),
    rotateLocal(0, 1, a.rot),
    rotateLocal(1, 0, b.rot),
    rotateLocal(0, 1, b.rot),
  ];
  let least = Infinity;
  for (const axis of axes) {
    const [minA, maxA] = project(ca, axis);
    const [minB, maxB] = project(cb, axis);
    const depth = Math.min(maxA, maxB) - Math.max(minA, minB);
    if (depth < least) least = depth;
  }
  return Math.max(0, least);
}

export function pointInRect(p: Vec2, r: Rect): boolean {
  const local = unrotateLocal(p.x - r.cx, p.z - r.cz, r.rot);
  return (
    Math.abs(local.x) <= r.w / 2 + EPSILON && Math.abs(local.z) <= r.d / 2 + EPSILON
  );
}

/**
 * True when the rectangle lies entirely inside the room's usable floor —
 * i.e. inside the inner face of the walls.
 */
export function rectInsideRoom(
  r: Rect,
  innerWidth: number,
  innerLength: number
): boolean {
  const hw = innerWidth / 2;
  const hl = innerLength / 2;
  for (const c of rectCorners(r)) {
    if (
      c.x < -hw - EPSILON ||
      c.x > hw + EPSILON ||
      c.z < -hl - EPSILON ||
      c.z > hl + EPSILON
    ) {
      return false;
    }
  }
  return true;
}

/** Signed distance the rectangle pokes outside the room; 0 when fully inside. */
export function outOfBoundsAmount(
  r: Rect,
  innerWidth: number,
  innerLength: number
): number {
  const hw = innerWidth / 2;
  const hl = innerLength / 2;
  const box = rectAABB(r);
  return Math.max(
    0,
    -hw - box.minX,
    box.maxX - hw,
    -hl - box.minZ,
    box.maxZ - hl
  );
}

/**
 * Clamps a rectangle back inside the room by translating it. Returns the
 * corrected centre. Used while dragging so furniture slides along the wall
 * rather than stopping dead at the boundary.
 */
export function clampRectToRoom(
  r: Rect,
  innerWidth: number,
  innerLength: number
): Vec2 {
  const hw = innerWidth / 2;
  const hl = innerLength / 2;
  const box = rectAABB(r);
  const spanX = box.maxX - box.minX;
  const spanZ = box.maxZ - box.minZ;

  let cx = r.cx;
  let cz = r.cz;

  // If the object is simply larger than the room on an axis, centre it there —
  // clamping both sides would fight itself.
  if (spanX >= innerWidth) {
    cx = 0;
  } else {
    if (box.minX < -hw) cx += -hw - box.minX;
    if (box.maxX > hw) cx -= box.maxX - hw;
  }
  if (spanZ >= innerLength) {
    cz = 0;
  } else {
    if (box.minZ < -hl) cz += -hl - box.minZ;
    if (box.maxZ > hl) cz -= box.maxZ - hl;
  }
  return { x: cx, z: cz };
}

/**
 * Grows a rectangle by its per-side clearance requirement. Because clearance is
 * asymmetric (a bed needs space at the foot, not behind the headboard) the
 * centre shifts as well as the size growing.
 */
export function clearanceRect(r: Rect, c: Clearance): Rect {
  const w = r.w + c.left + c.right;
  const d = r.d + c.front + c.back;
  // Local-space centre shift, then rotated into world.
  const shift = rotateLocal((c.right - c.left) / 2, (c.front - c.back) / 2, r.rot);
  return { cx: r.cx + shift.x, cz: r.cz + shift.z, w, d, rot: r.rot };
}

export function hasClearance(c: Clearance): boolean {
  return c.front > 0 || c.back > 0 || c.left > 0 || c.right > 0;
}

/** Euclidean distance on the floor plane. */
export function distance2D(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
