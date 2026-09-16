import type {
  CatalogItem,
  DocumentState,
  FurnitureInstance,
  PlacementIssue,
  Rect,
  RoomDimensions,
  WallPartition,
} from '@/types';
import { resolveCatalogItem } from '@/data/catalog';
import {
  clearanceRect,
  hasClearance,
  rectInsideRoom,
  rectsOverlap,
} from './collision';
import { doorApproachRect, nearestWall } from './roomGeometry';

/**
 * Placement validation.
 *
 * The rule that shapes this module: an invalid placement must always be able to
 * say *why*, and name the other object involved. "Invalid" with a red outline
 * and no explanation is the single most frustrating thing a planner can do.
 *
 * Severity is meaningful:
 *   error   — physically impossible (overlap, outside the room). Blocked.
 *   warning — legal but a bad idea (no clearance, blocks a door). Allowed.
 */

/** Distance a wall-mounted item may sit from a wall before we complain. */
const WALL_MOUNT_TOLERANCE = 0.35;

/** Footprint of a placed instance, with its scale applied. */
export function instanceRect(
  instance: FurnitureInstance,
  catalog: CatalogItem = resolveCatalogItem(instance.catalogId)
): Rect {
  return {
    cx: instance.position.x,
    cz: instance.position.z,
    w: catalog.size.w * instance.scale.x,
    d: catalog.size.d * instance.scale.z,
    rot: instance.rotation,
  };
}

/** Footprint of an interior partition wall as an oriented rectangle. */
export function partitionRect(partition: WallPartition): Rect {
  return {
    cx: partition.position.x,
    cz: partition.position.z,
    w: partition.thickness,
    d: partition.length,
    rot: partition.rotation,
  };
}

/** Real-world size of a placed instance in metres, scale applied. */
export function instanceSize(
  instance: FurnitureInstance,
  catalog: CatalogItem = resolveCatalogItem(instance.catalogId)
): { w: number; d: number; h: number } {
  return {
    w: catalog.size.w * instance.scale.x,
    d: catalog.size.d * instance.scale.z,
    h: catalog.size.h * instance.scale.y,
  };
}

/** Height of the instance's base above the floor. */
export function instanceBaseY(
  instance: FurnitureInstance,
  catalog: CatalogItem = resolveCatalogItem(instance.catalogId)
): number {
  return catalog.elevation;
}

export interface EvaluateOptions {
  /** Skip clearance and door checks — used during high-frequency drag updates. */
  errorsOnly?: boolean;
  /** Only evaluate these instances (still tested against all others). */
  subset?: Set<string>;
}

/**
 * Evaluates every placed object against the room and against each other.
 *
 * Complexity is O(n²) over placed furniture. With the documented budget of
 * ~120 objects that is ~7k cheap rectangle tests, well under a frame — and the
 * SAT helper short-circuits on an AABB check first. If the budget ever grows,
 * this is the place to add a uniform grid broad-phase.
 */
export function evaluatePlacement(
  doc: DocumentState,
  options: EvaluateOptions = {}
): PlacementIssue[] {
  const issues: PlacementIssue[] = [];
  const dims = doc.room.dimensions;

  const entries = doc.furniture
    .filter((f) => f.visible)
    .map((f) => {
      const catalog = resolveCatalogItem(f.catalogId);
      return { instance: f, catalog, rect: instanceRect(f, catalog) };
    });

  const wanted = (id: string) => !options.subset || options.subset.has(id);

  for (let i = 0; i < entries.length; i++) {
    const a = entries[i];
    if (!wanted(a.instance.instanceId)) continue;

    // --- Fits in the room at all? ---------------------------------------
    if (a.rect.w > dims.width + 1e-6 || a.rect.d > dims.length + 1e-6) {
      issues.push({
        instanceId: a.instance.instanceId,
        severity: 'error',
        code: 'oversized',
        message: `${a.catalog.name} is larger than the room. Scale it down or enlarge the room.`,
      });
    } else if (!rectInsideRoom(a.rect, dims.width, dims.length)) {
      issues.push({
        instanceId: a.instance.instanceId,
        severity: 'error',
        code: 'out-of-bounds',
        message: `${a.catalog.name} extends past the room wall.`,
      });
    }

    // --- Wall-mounted items must actually touch a wall -------------------
    if (a.catalog.wallMounted) {
      const { distance } = nearestWall(
        { x: a.rect.cx, z: a.rect.cz },
        dims
      );
      if (distance > WALL_MOUNT_TOLERANCE + a.rect.d / 2) {
        issues.push({
          instanceId: a.instance.instanceId,
          severity: 'warning',
          code: 'not-on-wall',
          message: `${a.catalog.name} is wall-mounted but is floating away from the wall.`,
        });
      }
    }
  }

  // --- Overlap with interior partition walls -----------------------------
  const partitions = doc.room.partitions ?? [];
  if (partitions.length > 0) {
    for (let i = 0; i < entries.length; i++) {
      const a = entries[i];
      if (!a.catalog.collides) continue;
      if (!wanted(a.instance.instanceId)) continue;
      for (const p of partitions) {
        const pRect = partitionRect(p);
        if (rectsOverlap(a.rect, pRect)) {
          issues.push({
            instanceId: a.instance.instanceId,
            severity: 'error',
            code: 'overlap',
            message: `Overlaps with ${p.name || 'interior wall'}`,
            otherId: p.id,
          });
          break;
        }
      }
    }
  }

  // --- Pairwise overlap ---------------------------------------------------
  for (let i = 0; i < entries.length; i++) {
    const a = entries[i];
    if (!a.catalog.collides) continue;
    for (let j = i + 1; j < entries.length; j++) {
      const b = entries[j];
      if (!b.catalog.collides) continue;
      if (!wanted(a.instance.instanceId) && !wanted(b.instance.instanceId)) continue;

      // Objects at clearly different heights can share a footprint — a monitor
      // on a desk, a TV above a console.
      if (verticalGap(a, b)) continue;

      if (rectsOverlap(a.rect, b.rect)) {
        if (wanted(a.instance.instanceId)) {
          issues.push({
            instanceId: a.instance.instanceId,
            severity: 'error',
            code: 'overlap',
            message: `Overlaps with ${b.catalog.name}`,
            otherId: b.instance.instanceId,
          });
        }
        if (wanted(b.instance.instanceId)) {
          issues.push({
            instanceId: b.instance.instanceId,
            severity: 'error',
            code: 'overlap',
            message: `Overlaps with ${a.catalog.name}`,
            otherId: a.instance.instanceId,
          });
        }
      }
    }
  }

  if (options.errorsOnly) return issues;

  // --- Clearance ----------------------------------------------------------
  for (const a of entries) {
    if (!wanted(a.instance.instanceId)) continue;
    if (!hasClearance(a.catalog.clearance)) continue;
    const zone = clearanceRect(a.rect, a.catalog.clearance);

    for (const b of entries) {
      if (b === a || !b.catalog.collides) continue;
      if (verticalGap(a, b)) continue;
      if (rectsOverlap(zone, b.rect)) {
        issues.push({
          instanceId: a.instance.instanceId,
          severity: 'warning',
          code: 'clearance',
          message: `${b.catalog.name} sits in the space needed to use the ${a.catalog.name.toLowerCase()}.`,
          otherId: b.instance.instanceId,
        });
        break; // One clearance warning per object is enough to act on.
      }
    }
  }

  // --- Door approach ------------------------------------------------------
  const doors = doc.room.openings.filter((o) => o.kind === 'door');
  for (const door of doors) {
    const approach = doorApproachRect(door, dims);
    for (const a of entries) {
      if (!wanted(a.instance.instanceId)) continue;
      if (!a.catalog.collides) continue;
      // Only floor-standing furniture can block a doorway.
      if (a.catalog.elevation > 1.2) continue;
      if (rectsOverlap(approach, a.rect)) {
        issues.push({
          instanceId: a.instance.instanceId,
          severity: 'warning',
          code: 'blocks-door',
          message: `${a.catalog.name} blocks the swing of the ${door.wall} door.`,
        });
      }
    }
  }

  return issues;
}

type Entry = {
  instance: FurnitureInstance;
  catalog: CatalogItem;
  rect: Rect;
};

/** True when two objects occupy separate height bands and cannot conflict. */
function verticalGap(a: Entry, b: Entry): boolean {
  const aLow = a.catalog.elevation;
  const aHigh = aLow + a.catalog.size.h * a.instance.scale.y;
  const bLow = b.catalog.elevation;
  const bHigh = bLow + b.catalog.size.h * b.instance.scale.y;
  return aHigh <= bLow + 1e-6 || bHigh <= aLow + 1e-6;
}

/** Indexes issues by instance for O(1) lookup while rendering. */
export function indexIssues(
  issues: PlacementIssue[]
): Map<string, PlacementIssue[]> {
  const map = new Map<string, PlacementIssue[]>();
  for (const issue of issues) {
    const list = map.get(issue.instanceId);
    if (list) list.push(issue);
    else map.set(issue.instanceId, [issue]);
  }
  return map;
}

export function worstSeverity(
  issues: PlacementIssue[] | undefined
): 'error' | 'warning' | null {
  if (!issues || issues.length === 0) return null;
  return issues.some((i) => i.severity === 'error') ? 'error' : 'warning';
}

/**
 * Would placing/moving `candidate` be legal? Used by drag-and-drop to decide
 * whether to accept a drop, without recomputing the whole document.
 */
export function isPlacementValid(
  candidate: FurnitureInstance,
  doc: DocumentState
): { valid: boolean; reason: string | null; blockerId: string | null } {
  const catalog = resolveCatalogItem(candidate.catalogId);
  const dims = doc.room.dimensions;
  const rect = instanceRect(candidate, catalog);

  if (rect.w > dims.width + 1e-6 || rect.d > dims.length + 1e-6) {
    return { valid: false, reason: 'Too large for this room', blockerId: null };
  }
  if (!rectInsideRoom(rect, dims.width, dims.length)) {
    return { valid: false, reason: 'Outside the room', blockerId: null };
  }
  if (!catalog.collides) return { valid: true, reason: null, blockerId: null };

  const self: Entry = { instance: candidate, catalog, rect };
  for (const other of doc.furniture) {
    if (other.instanceId === candidate.instanceId || !other.visible) continue;
    const otherCatalog = resolveCatalogItem(other.catalogId);
    if (!otherCatalog.collides) continue;
    const entry: Entry = {
      instance: other,
      catalog: otherCatalog,
      rect: instanceRect(other, otherCatalog),
    };
    if (verticalGap(self, entry)) continue;
    if (rectsOverlap(rect, entry.rect)) {
      return {
        valid: false,
        reason: `Overlaps with ${otherCatalog.name}`,
        blockerId: other.instanceId,
      };
    }
  }
  return { valid: true, reason: null, blockerId: null };
}

/**
 * Finds a free spot for a newly added item. Tries the room centre, then walks
 * an outward spiral. Without this, dropping three sofas from the catalog would
 * stack them all at the origin and immediately flag two as invalid.
 */
export function findFreeSpot(
  candidate: FurnitureInstance,
  doc: DocumentState,
  preferred?: { x: number; z: number }
): { x: number; z: number } {
  const dims = doc.room.dimensions;
  const start = preferred ?? { x: 0, z: 0 };
  const probe = { ...candidate, position: { ...start } };
  if (isPlacementValid(probe, doc).valid) return start;

  const step = 0.25;
  const maxRadius = Math.max(dims.width, dims.length);
  for (let radius = step; radius <= maxRadius; radius += step) {
    const points = Math.max(8, Math.round((2 * Math.PI * radius) / step));
    for (let i = 0; i < points; i++) {
      const angle = (i / points) * Math.PI * 2;
      const p = {
        x: start.x + Math.cos(angle) * radius,
        z: start.z + Math.sin(angle) * radius,
      };
      probe.position = p;
      if (isPlacementValid(probe, doc).valid) return p;
    }
  }
  // Nowhere free — return the preferred point and let validation flag it.
  return start;
}

/** Sum of catalog prices for everything placed. */
export function totalCost(furniture: FurnitureInstance[]): number {
  return furniture.reduce(
    (sum, f) => sum + resolveCatalogItem(f.catalogId).price,
    0
  );
}

/** Groups placed furniture into a shopping list with quantities. */
export function shoppingList(furniture: FurnitureInstance[]): Array<{
  catalogId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}> {
  const map = new Map<string, { name: string; quantity: number; unitPrice: number }>();
  for (const f of furniture) {
    const c = resolveCatalogItem(f.catalogId);
    const existing = map.get(c.id);
    if (existing) existing.quantity += 1;
    else map.set(c.id, { name: c.name, quantity: 1, unitPrice: c.price });
  }
  return [...map.entries()]
    .map(([catalogId, v]) => ({
      catalogId,
      name: v.name,
      quantity: v.quantity,
      unitPrice: v.unitPrice,
      total: v.unitPrice * v.quantity,
    }))
    .sort((a, b) => b.total - a.total);
}

export function occupiedFloorArea(furniture: FurnitureInstance[]): number {
  return furniture.reduce((sum, f) => {
    const c = resolveCatalogItem(f.catalogId);
    if (!c.collides) return sum;
    const r = instanceRect(f, c);
    return sum + r.w * r.d;
  }, 0);
}

/** Room dimension guard rails, in metres. */
export const ROOM_LIMITS = {
  minWidth: 0.8,
  maxWidth: 40,
  minLength: 0.8,
  maxLength: 40,
  minHeight: 1.8,
  maxHeight: 8,
  minWallThickness: 0.02,
  maxWallThickness: 0.6,
} as const;

/** Validates room dimensions, returning a message per invalid field. */
export function validateRoomDimensions(
  dims: Partial<RoomDimensions>
): Partial<Record<keyof RoomDimensions, string>> {
  const errors: Partial<Record<keyof RoomDimensions, string>> = {};
  const check = (
    key: keyof RoomDimensions,
    min: number,
    max: number,
    label: string
  ) => {
    const value = dims[key];
    if (value === undefined) return;
    if (!Number.isFinite(value)) {
      errors[key] = `${label} must be a number.`;
    } else if (value <= 0) {
      errors[key] = `${label} must be greater than zero.`;
    } else if (value < min) {
      errors[key] = `${label} must be at least ${min} m.`;
    } else if (value > max) {
      errors[key] = `${label} cannot exceed ${max} m.`;
    }
  };
  check('width', ROOM_LIMITS.minWidth, ROOM_LIMITS.maxWidth, 'Width');
  check('length', ROOM_LIMITS.minLength, ROOM_LIMITS.maxLength, 'Length');
  check('height', ROOM_LIMITS.minHeight, ROOM_LIMITS.maxHeight, 'Height');
  check(
    'wallThickness',
    ROOM_LIMITS.minWallThickness,
    ROOM_LIMITS.maxWallThickness,
    'Wall thickness'
  );
  return errors;
}
