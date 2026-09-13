import type { AlignMode, DistributeAxis, FurnitureInstance, Vec2 } from '@/types';
import { resolveCatalogItem } from '@/data/catalog';
import { deg2rad } from './collision';

export interface ItemBounds {
  instanceId: string;
  cx: number;
  cz: number;
  w: number;
  d: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  locked: boolean;
}

/**
 * Calculates the oriented floor bounding box for a placed furniture item.
 */
export function getItemBounds(instance: FurnitureInstance): ItemBounds {
  const catalog = resolveCatalogItem(instance.catalogId);
  const baseW = catalog.size.w * instance.scale.x;
  const baseD = catalog.size.d * instance.scale.z;
  const rad = deg2rad(instance.rotation);

  // AABB extents taking yaw into account
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const w = baseW * cos + baseD * sin;
  const d = baseW * sin + baseD * cos;

  const cx = instance.position.x;
  const cz = instance.position.z;

  return {
    instanceId: instance.instanceId,
    cx,
    cz,
    w,
    d,
    minX: cx - w / 2,
    maxX: cx + w / 2,
    minZ: cz - d / 2,
    maxZ: cz + d / 2,
    locked: instance.locked,
  };
}

/**
 * Calculates total bounding box extents for multiple items.
 */
export function getGroupBounds(boundsList: ItemBounds[]) {
  if (boundsList.length === 0) {
    return { minX: 0, maxX: 0, minZ: 0, maxZ: 0, centerX: 0, centerZ: 0, width: 0, depth: 0 };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const b of boundsList) {
    if (b.minX < minX) minX = b.minX;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.minZ < minZ) minZ = b.minZ;
    if (b.maxZ > maxZ) maxZ = b.maxZ;
  }

  return {
    minX,
    maxX,
    minZ,
    maxZ,
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
    width: maxX - minX,
    depth: maxZ - minZ,
  };
}

/**
 * Computes new positions for items aligned according to the given mode.
 */
export function calculateAlignedPositions(
  instances: FurnitureInstance[],
  mode: AlignMode
): Map<string, Vec2> {
  const result = new Map<string, Vec2>();
  if (instances.length <= 1) return result;

  const boundsList = instances.map(getItemBounds);
  const group = getGroupBounds(boundsList);

  for (const b of boundsList) {
    if (b.locked) continue;

    let newX = b.cx;
    let newZ = b.cz;

    switch (mode) {
      case 'left':
        newX = group.minX + b.w / 2;
        break;
      case 'center-x':
        newX = group.centerX;
        break;
      case 'right':
        newX = group.maxX - b.w / 2;
        break;
      case 'back':
        newZ = group.minZ + b.d / 2;
        break;
      case 'center-z':
        newZ = group.centerZ;
        break;
      case 'front':
        newZ = group.maxZ - b.d / 2;
        break;
    }

    result.set(b.instanceId, { x: newX, z: newZ });
  }

  return result;
}

/**
 * Computes new positions for items distributed evenly along X or Z.
 */
export function calculateDistributedPositions(
  instances: FurnitureInstance[],
  axis: DistributeAxis = 'auto'
): Map<string, Vec2> {
  const result = new Map<string, Vec2>();
  if (instances.length < 3) return result;

  const boundsList = instances.map(getItemBounds);
  const group = getGroupBounds(boundsList);

  const effectiveAxis =
    axis === 'auto' ? (group.width >= group.depth ? 'x' : 'z') : axis;

  if (effectiveAxis === 'x') {
    const sorted = [...boundsList].sort((a, b) => a.cx - b.cx);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    const totalSpan = last.maxX - first.minX;
    const totalItemWidth = sorted.reduce((sum, b) => sum + b.w, 0);
    const gap = (totalSpan - totalItemWidth) / (sorted.length - 1);

    let currentLeft = first.minX;
    for (let i = 0; i < sorted.length; i++) {
      const b = sorted[i];
      if (!b.locked) {
        result.set(b.instanceId, {
          x: currentLeft + b.w / 2,
          z: b.cz,
        });
      }
      currentLeft += b.w + gap;
    }
  } else {
    const sorted = [...boundsList].sort((a, b) => a.cz - b.cz);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    const totalSpan = last.maxZ - first.minZ;
    const totalItemDepth = sorted.reduce((sum, b) => sum + b.d, 0);
    const gap = (totalSpan - totalItemDepth) / (sorted.length - 1);

    let currentBack = first.minZ;
    for (let i = 0; i < sorted.length; i++) {
      const b = sorted[i];
      if (!b.locked) {
        result.set(b.instanceId, {
          x: b.cx,
          z: currentBack + b.d / 2,
        });
      }
      currentBack += b.d + gap;
    }
  }

  return result;
}

/**
 * Snaps items consecutively so that adjacent faces touch flush with zero gap.
 */
export function calculateSnappedFacePositions(
  instances: FurnitureInstance[],
  axis: DistributeAxis = 'auto'
): Map<string, Vec2> {
  const result = new Map<string, Vec2>();
  if (instances.length < 2) return result;

  const boundsList = instances.map(getItemBounds);
  const group = getGroupBounds(boundsList);

  const effectiveAxis =
    axis === 'auto' ? (group.width >= group.depth ? 'x' : 'z') : axis;

  if (effectiveAxis === 'x') {
    const sorted = [...boundsList].sort((a, b) => a.cx - b.cx);
    let prevRight = sorted[0].maxX;

    for (let i = 1; i < sorted.length; i++) {
      const b = sorted[i];
      if (!b.locked) {
        const newX = prevRight + b.w / 2;
        result.set(b.instanceId, { x: newX, z: b.cz });
        prevRight = newX + b.w / 2;
      } else {
        prevRight = b.maxX;
      }
    }
  } else {
    const sorted = [...boundsList].sort((a, b) => a.cz - b.cz);
    let prevFront = sorted[0].maxZ;

    for (let i = 1; i < sorted.length; i++) {
      const b = sorted[i];
      if (!b.locked) {
        const newZ = prevFront + b.d / 2;
        result.set(b.instanceId, { x: b.cx, z: newZ });
        prevFront = newZ + b.d / 2;
      } else {
        prevFront = b.maxZ;
      }
    }
  }

  return result;
}
