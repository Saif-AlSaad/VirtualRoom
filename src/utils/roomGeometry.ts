import type {
  Opening,
  Rect,
  RoomDimensions,
  Vec2,
  WallSide,
} from '@/types';

/**
 * Room and wall-opening geometry.
 *
 * DIMENSION CONVENTION: `width` and `length` are INTERIOR measurements — the
 * usable floor. Walls are built outward from that box, so a 4 × 3 m room always
 * gives you 12 m² of floor regardless of wall thickness. This is what furniture
 * planners (and builders quoting floor area) mean by room size.
 *
 * WALL PARAMETERISATION: an opening's `offset` is the distance along its wall
 * from the wall's start corner to the opening's centre. North/south walls run
 * along +X starting at x = −width/2; east/west walls run along +Z starting at
 * z = −length/2. Storing offsets rather than XZ positions is what keeps doors
 * attached to their wall when the room is resized.
 */

export const WALL_SIDES: WallSide[] = ['north', 'south', 'east', 'west'];

export const WALL_LABEL: Record<WallSide, string> = {
  north: 'North (back)',
  south: 'South (front)',
  east: 'East (right)',
  west: 'West (left)',
};

/** Length of the given wall, in metres. */
export function wallLength(side: WallSide, dims: RoomDimensions): number {
  return side === 'north' || side === 'south' ? dims.width : dims.length;
}

/** Rotation (degrees) for an object standing against this wall, facing inward. */
export function wallFacingRotation(side: WallSide): number {
  switch (side) {
    case 'north':
      return 0;
    case 'south':
      return 180;
    case 'west':
      return 90;
    case 'east':
      return 270;
  }
}

/** Unit vector pointing from the wall into the room. */
export function wallInwardNormal(side: WallSide): Vec2 {
  switch (side) {
    case 'north':
      return { x: 0, z: 1 };
    case 'south':
      return { x: 0, z: -1 };
    case 'west':
      return { x: 1, z: 0 };
    case 'east':
      return { x: -1, z: 0 };
  }
}

/** A point on the wall's inner face, `offset` metres along it. */
export function pointOnWall(
  side: WallSide,
  offset: number,
  dims: RoomDimensions
): Vec2 {
  const hw = dims.width / 2;
  const hl = dims.length / 2;
  switch (side) {
    case 'north':
      return { x: -hw + offset, z: -hl };
    case 'south':
      return { x: -hw + offset, z: hl };
    case 'west':
      return { x: -hw, z: -hl + offset };
    case 'east':
      return { x: hw, z: -hl + offset };
  }
}

/** Inverse of `pointOnWall` — how far along the wall a world point projects. */
export function offsetAlongWall(
  side: WallSide,
  p: Vec2,
  dims: RoomDimensions
): number {
  const hw = dims.width / 2;
  const hl = dims.length / 2;
  return side === 'north' || side === 'south' ? p.x + hw : p.z + hl;
}

/** Which wall a point is nearest to, and how far away it is. */
export function nearestWall(
  p: Vec2,
  dims: RoomDimensions
): { side: WallSide; distance: number } {
  const hw = dims.width / 2;
  const hl = dims.length / 2;
  const candidates: Array<{ side: WallSide; distance: number }> = [
    { side: 'north', distance: Math.abs(p.z - -hl) },
    { side: 'south', distance: Math.abs(hl - p.z) },
    { side: 'west', distance: Math.abs(p.x - -hw) },
    { side: 'east', distance: Math.abs(hw - p.x) },
  ];
  return candidates.reduce((best, c) => (c.distance < best.distance ? c : best));
}

/**
 * Clamps an opening's offset so the whole opening stays on its wall. Called
 * whenever the room is resized or an opening is dragged.
 */
export function clampOpeningOffset(
  offset: number,
  width: number,
  side: WallSide,
  dims: RoomDimensions
): number {
  const len = wallLength(side, dims);
  const half = width / 2;
  if (width >= len) return len / 2;
  return Math.min(Math.max(offset, half), len - half);
}

/** True when the opening fits on its wall at its current offset. */
export function openingFitsOnWall(
  opening: Opening,
  dims: RoomDimensions
): boolean {
  const len = wallLength(opening.wall, dims);
  const half = opening.width / 2;
  return (
    opening.width <= len &&
    opening.offset >= half - 1e-6 &&
    opening.offset <= len - half + 1e-6 &&
    opening.sillHeight + opening.height <= dims.height + 1e-6
  );
}

/** World position and rotation for rendering an opening's frame. */
export function openingTransform(
  opening: Opening,
  dims: RoomDimensions
): { position: Vec2; rotation: number; normal: Vec2 } {
  return {
    position: pointOnWall(opening.wall, opening.offset, dims),
    rotation: wallFacingRotation(opening.wall),
    normal: wallInwardNormal(opening.wall),
  };
}

/** Depth of floor a door needs kept clear on the inside, in metres. */
export const DOOR_APPROACH_DEPTH = 0.9;

/**
 * The floor area in front of a door that must stay clear. Furniture landing
 * here produces a `blocks-door` warning rather than a hard error — it is a
 * usability problem, not a physical impossibility.
 */
export function doorApproachRect(
  opening: Opening,
  dims: RoomDimensions
): Rect {
  const { position, rotation, normal } = openingTransform(opening, dims);
  const depth = DOOR_APPROACH_DEPTH;
  return {
    cx: position.x + normal.x * (depth / 2),
    cz: position.z + normal.z * (depth / 2),
    w: opening.width,
    d: depth,
    rot: rotation,
  };
}

/** Interior floor area in m². */
export function floorArea(dims: RoomDimensions): number {
  return dims.width * dims.length;
}

/** Interior volume in m³. */
export function roomVolume(dims: RoomDimensions): number {
  return dims.width * dims.length * dims.height;
}

/** Total wall area minus openings — useful for the review panel. */
export function netWallArea(
  dims: RoomDimensions,
  openings: Opening[]
): number {
  const gross = 2 * (dims.width + dims.length) * dims.height;
  const holes = openings.reduce((sum, o) => sum + o.width * o.height, 0);
  return Math.max(0, gross - holes);
}
