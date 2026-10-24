import type { Rect, RoomDimensions, Vec2 } from '@/types';
import { rectAABB, normalizeAngle } from './collision';

/**
 * Snapping: grid, wall, furniture-edge and rotation.
 *
 * All snapping is a *suggestion layer* over a raw pointer position. It returns
 * the adjusted transform plus the guides that should be drawn, so the viewport
 * can explain to the user why the object jumped.
 */

export interface SnapSettings {
  grid: boolean;
  gridSize: number;
  wall: boolean;
  furniture: boolean;
  /** Rotation increment in degrees; 0 disables rotation snapping. */
  rotationStep: number;
  /** Distance within which a snap engages, in metres. */
  threshold: number;
  /** Automatically rotate wall-hugging furniture to face into the room when near walls. */
  autoRotate?: boolean;
}

export const DEFAULT_SNAP: SnapSettings = {
  grid: true,
  gridSize: 0.1,
  wall: true,
  furniture: true,
  rotationStep: 15,
  threshold: 0.25,
  autoRotate: true,
};

/** A line the viewport draws to show an active alignment. */
export interface SnapGuide {
  axis: 'x' | 'z';
  value: number;
  kind: 'wall' | 'furniture' | 'grid';
}

export interface SnapResult {
  position: Vec2;
  rotation: number;
  guides: SnapGuide[];
  snappedToWall: boolean;
}

export function snapToStep(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}

/** Snaps an angle to the nearest increment, normalised to [0, 360). */
export function snapRotation(degrees: number, step: number): number {
  if (step <= 0) return normalizeAngle(degrees);
  return normalizeAngle(Math.round(degrees / step) * step);
}

/** Angular distance between two headings, in degrees, always ≤ 180. */
export function angleDelta(a: number, b: number): number {
  const d = Math.abs(normalizeAngle(a) - normalizeAngle(b)) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Resolves a desired transform into a snapped one.
 *
 * Priority is deliberate: walls beat furniture edges, which beat the grid.
 * A user dragging a wardrobe toward a wall means "against the wall", and a
 * 10 cm grid should never pull it 5 cm off the plaster.
 *
 * Smart Wall-Hugger Auto-Rotation:
 * When an object approaches a room wall within the snapping threshold, it
 * automatically orients its back flush to the wall with its front facing
 * into the room (North wall: 0°, South wall: 180°, West wall: 90°, East wall: 270°).
 */
export function computeSnap(
  desired: Rect,
  others: Rect[],
  dims: RoomDimensions,
  settings: SnapSettings
): SnapResult {
  const guides: SnapGuide[] = [];
  let rotation = normalizeAngle(desired.rot);
  if (settings.rotationStep > 0) {
    rotation = snapRotation(rotation, settings.rotationStep);
  }

  const rect: Rect = { ...desired, rot: rotation };
  let { cx, cz } = rect;
  let snappedX = false;
  let snappedZ = false;
  let snappedToWall = false;

  const box = rectAABB({ ...rect, cx, cz });
  const hw = dims.width / 2;
  const hl = dims.length / 2;
  const t = settings.threshold;

  // --- Walls (with Smart Wall-Hugger Auto-Rotation) ------------------------
  if (settings.wall) {
    if (settings.autoRotate !== false) {
      const distWest = Math.abs(box.minX - -hw);
      const distEast = Math.abs(box.maxX - hw);
      const distNorth = Math.abs(box.minZ - -hl);
      const distSouth = Math.abs(box.maxZ - hl);

      const minDist = Math.min(distWest, distEast, distNorth, distSouth);

      if (minDist < t) {
        if (minDist === distNorth) {
          rotation = 0;
          cz = -hl + desired.d / 2;
          snappedZ = true;
          snappedToWall = true;
          guides.push({ axis: 'z', value: -hl, kind: 'wall' });

          const newBox = rectAABB({ ...desired, cx, cz, rot: rotation });
          if (Math.abs(newBox.minX - -hw) < t) {
            cx += -hw - newBox.minX;
            snappedX = true;
            guides.push({ axis: 'x', value: -hw, kind: 'wall' });
          } else if (Math.abs(newBox.maxX - hw) < t) {
            cx -= newBox.maxX - hw;
            snappedX = true;
            guides.push({ axis: 'x', value: hw, kind: 'wall' });
          }
        } else if (minDist === distSouth) {
          rotation = 180;
          cz = hl - desired.d / 2;
          snappedZ = true;
          snappedToWall = true;
          guides.push({ axis: 'z', value: hl, kind: 'wall' });

          const newBox = rectAABB({ ...desired, cx, cz, rot: rotation });
          if (Math.abs(newBox.minX - -hw) < t) {
            cx += -hw - newBox.minX;
            snappedX = true;
            guides.push({ axis: 'x', value: -hw, kind: 'wall' });
          } else if (Math.abs(newBox.maxX - hw) < t) {
            cx -= newBox.maxX - hw;
            snappedX = true;
            guides.push({ axis: 'x', value: hw, kind: 'wall' });
          }
        } else if (minDist === distWest) {
          rotation = 90;
          cx = -hw + desired.d / 2;
          snappedX = true;
          snappedToWall = true;
          guides.push({ axis: 'x', value: -hw, kind: 'wall' });

          const newBox = rectAABB({ ...desired, cx, cz, rot: rotation });
          if (Math.abs(newBox.minZ - -hl) < t) {
            cz += -hl - newBox.minZ;
            snappedZ = true;
            guides.push({ axis: 'z', value: -hl, kind: 'wall' });
          } else if (Math.abs(newBox.maxZ - hl) < t) {
            cz -= newBox.maxZ - hl;
            snappedZ = true;
            guides.push({ axis: 'z', value: hl, kind: 'wall' });
          }
        } else if (minDist === distEast) {
          rotation = 270;
          cx = hw - desired.d / 2;
          snappedX = true;
          snappedToWall = true;
          guides.push({ axis: 'x', value: hw, kind: 'wall' });

          const newBox = rectAABB({ ...desired, cx, cz, rot: rotation });
          if (Math.abs(newBox.minZ - -hl) < t) {
            cz += -hl - newBox.minZ;
            snappedZ = true;
            guides.push({ axis: 'z', value: -hl, kind: 'wall' });
          } else if (Math.abs(newBox.maxZ - hl) < t) {
            cz -= newBox.maxZ - hl;
            snappedZ = true;
            guides.push({ axis: 'z', value: hl, kind: 'wall' });
          }
        }
      }
    } else {
      if (Math.abs(box.minX - -hw) < t) {
        cx += -hw - box.minX;
        snappedX = true;
        snappedToWall = true;
        guides.push({ axis: 'x', value: -hw, kind: 'wall' });
      } else if (Math.abs(box.maxX - hw) < t) {
        cx -= box.maxX - hw;
        snappedX = true;
        snappedToWall = true;
        guides.push({ axis: 'x', value: hw, kind: 'wall' });
      }

      if (Math.abs(box.minZ - -hl) < t) {
        cz += -hl - box.minZ;
        snappedZ = true;
        snappedToWall = true;
        guides.push({ axis: 'z', value: -hl, kind: 'wall' });
      } else if (Math.abs(box.maxZ - hl) < t) {
        cz -= box.maxZ - hl;
        snappedZ = true;
        snappedToWall = true;
        guides.push({ axis: 'z', value: hl, kind: 'wall' });
      }
    }
  }

  // --- Other furniture ---------------------------------------------------
  if (settings.furniture && (!snappedX || !snappedZ)) {
    const self = rectAABB({ ...rect, cx, cz });
    let bestX: { delta: number; guide: number } | null = null;
    let bestZ: { delta: number; guide: number } | null = null;

    for (const other of others) {
      const o = rectAABB(other);

      if (!snappedX) {
        // Flush edges (my left to their right, etc.) and centre alignment.
        const candidates: Array<[number, number]> = [
          [o.maxX - self.minX, o.maxX],
          [o.minX - self.maxX, o.minX],
          [o.minX - self.minX, o.minX],
          [o.maxX - self.maxX, o.maxX],
          [(o.minX + o.maxX) / 2 - (self.minX + self.maxX) / 2, (o.minX + o.maxX) / 2],
        ];
        for (const [delta, guide] of candidates) {
          if (Math.abs(delta) < t && (!bestX || Math.abs(delta) < Math.abs(bestX.delta))) {
            bestX = { delta, guide };
          }
        }
      }

      if (!snappedZ) {
        const candidates: Array<[number, number]> = [
          [o.maxZ - self.minZ, o.maxZ],
          [o.minZ - self.maxZ, o.minZ],
          [o.minZ - self.minZ, o.minZ],
          [o.maxZ - self.maxZ, o.maxZ],
          [(o.minZ + o.maxZ) / 2 - (self.minZ + self.maxZ) / 2, (o.minZ + o.maxZ) / 2],
        ];
        for (const [delta, guide] of candidates) {
          if (Math.abs(delta) < t && (!bestZ || Math.abs(delta) < Math.abs(bestZ.delta))) {
            bestZ = { delta, guide };
          }
        }
      }
    }

    if (bestX) {
      cx += bestX.delta;
      snappedX = true;
      guides.push({ axis: 'x', value: bestX.guide, kind: 'furniture' });
    }
    if (bestZ) {
      cz += bestZ.delta;
      snappedZ = true;
      guides.push({ axis: 'z', value: bestZ.guide, kind: 'furniture' });
    }
  }

  // --- Grid --------------------------------------------------------------
  if (settings.grid) {
    if (!snappedX) cx = snapToStep(cx, settings.gridSize);
    if (!snappedZ) cz = snapToStep(cz, settings.gridSize);
  }

  return { position: { x: cx, z: cz }, rotation, guides, snappedToWall };
}
