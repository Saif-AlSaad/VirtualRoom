import {
  SCHEMA_VERSION,
  type FloorFinish,
  type FurnitureInstance,
  type Opening,
  type Project,
  type Room,
  type Unit,
  type WallSide,
} from '@/types';
import { createId, createProjectId } from './id';
import { getCatalogItem } from '@/data/catalog';
import { clampOpeningOffset, wallLength } from './roomGeometry';
import { normalizeAngle } from './collision';
import { ROOM_LIMITS } from './placement';

/**
 * Parsing and repair for untrusted project data.
 *
 * Two paths reach this module and NEITHER can be trusted: a JSON file the user
 * imports, and a layout decoded from a share-link URL. Both are attacker- or
 * corruption-controlled, so every field is type-checked, range-clamped and
 * re-derived before it is allowed near application state.
 *
 * The policy is REPAIR, NOT REJECT wherever repair is unambiguous: a project
 * with one bad furniture entry loads with that entry dropped and a warning,
 * rather than failing wholesale and losing the user's other 30 objects. Only
 * structural failure or an unsupported future schema version is fatal.
 */

export interface ParseSuccess {
  ok: true;
  project: Project;
  warnings: string[];
}
export interface ParseFailure {
  ok: false;
  error: string;
}
export type ParseResult = ParseSuccess | ParseFailure;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const num = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

const clamp = (v: number, min: number, max: number): number =>
  Math.min(Math.max(v, min), max);

const str = (v: unknown, fallback: string): string =>
  typeof v === 'string' ? v : fallback;

const bool = (v: unknown, fallback: boolean): boolean =>
  typeof v === 'boolean' ? v : fallback;

/** Hex colours only — never interpolate arbitrary strings into CSS or a shader. */
const HEX = /^#[0-9a-f]{6}$/i;
const color = (v: unknown, fallback: string): string =>
  typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : fallback;

/** Text fields are length-capped so a hostile file cannot bloat localStorage. */
const text = (v: unknown, fallback: string, max = 200): string =>
  typeof v === 'string' ? v.slice(0, max) : fallback;

const WALLS: WallSide[] = ['north', 'south', 'east', 'west'];
const isWall = (v: unknown): v is WallSide =>
  typeof v === 'string' && (WALLS as string[]).includes(v);

export const DEFAULT_FLOOR: FloorFinish = { color: '#c69c6d', pattern: 'planks' };

export function defaultRoom(): Room {
  return {
    dimensions: { width: 4.2, length: 5.0, height: 2.6, wallThickness: 0.12 },
    walls: { color: '#f5f4f0' },
    floor: { ...DEFAULT_FLOOR },
    openings: [],
  };
}

export function createProject(name = 'Untitled room', unit: Unit = 'm'): Project {
  const now = Date.now();
  return {
    id: createProjectId(),
    schemaVersion: SCHEMA_VERSION,
    name,
    unit,
    room: defaultRoom(),
    furniture: [],
    createdAt: now,
    updatedAt: now,
  };
}

function parseOpening(
  raw: unknown,
  room: Room,
  warnings: string[]
): Opening | null {
  if (!isObject(raw)) {
    warnings.push('Dropped an opening that was not an object.');
    return null;
  }
  const kind = raw.kind === 'window' ? 'window' : 'door';
  if (!isWall(raw.wall)) {
    warnings.push(`Dropped a ${kind} attached to an unknown wall.`);
    return null;
  }
  const wall = raw.wall;
  const maxLen = wallLength(wall, room.dimensions);

  const width = clamp(num(raw.width, kind === 'door' ? 0.9 : 1.2), 0.2, maxLen);
  const height = clamp(
    num(raw.height, kind === 'door' ? 2.05 : 1.2),
    0.2,
    room.dimensions.height
  );
  const sillHeight =
    kind === 'door'
      ? 0
      : clamp(num(raw.sillHeight, 0.9), 0, Math.max(0, room.dimensions.height - height));

  // Re-clamp the offset rather than trusting it: this is what guarantees the
  // invariant "an opening is always fully on its wall" after any import.
  const offset = clampOpeningOffset(
    num(raw.offset, maxLen / 2),
    width,
    wall,
    room.dimensions
  );

  return {
    id: typeof raw.id === 'string' && raw.id.length <= 64 ? raw.id : createId('opn'),
    kind,
    wall,
    offset,
    width,
    height,
    sillHeight,
    hinge: raw.hinge === 'right' ? 'right' : 'left',
    swing: raw.swing === 'out' ? 'out' : 'in',
  };
}

function parseFurniture(
  raw: unknown,
  warnings: string[]
): FurnitureInstance | null {
  if (!isObject(raw)) {
    warnings.push('Dropped a furniture entry that was not an object.');
    return null;
  }
  const catalogId = str(raw.catalogId, '');
  const catalog = getCatalogItem(catalogId);
  if (!catalog) {
    // Unknown ids are kept out of the document entirely — the scene renders a
    // placeholder for them elsewhere, but on import it is cleaner to drop and
    // tell the user than to litter the room with grey boxes.
    warnings.push(`Dropped "${catalogId || 'unnamed item'}" — not in this catalog.`);
    return null;
  }

  const position = isObject(raw.position) ? raw.position : {};
  const scale = isObject(raw.scale) ? raw.scale : {};
  const [minScale, maxScale] = catalog.scaleRange;

  const finishId = str(raw.finishId, catalog.finishes[0].id);
  const validFinish = catalog.finishes.some((f) => f.id === finishId)
    ? finishId
    : catalog.finishes[0].id;

  return {
    instanceId:
      typeof raw.instanceId === 'string' && raw.instanceId.length <= 64
        ? raw.instanceId
        : createId('itm'),
    catalogId,
    position: {
      x: clamp(num(position.x, 0), -100, 100),
      z: clamp(num(position.z, 0), -100, 100),
    },
    rotation: normalizeAngle(num(raw.rotation, 0)),
    scale: {
      x: clamp(num(scale.x, 1), minScale, maxScale),
      y: clamp(num(scale.y, 1), minScale, maxScale),
      z: clamp(num(scale.z, 1), minScale, maxScale),
    },
    finishId: validFinish,
    colorOverride:
      typeof raw.colorOverride === 'string' && HEX.test(raw.colorOverride)
        ? raw.colorOverride.toLowerCase()
        : null,
    locked: bool(raw.locked, false),
    visible: bool(raw.visible, true),
    groupId:
      typeof raw.groupId === 'string' && raw.groupId.length <= 64
        ? raw.groupId
        : null,
    note: text(raw.note, '', 500),
    customModelUrl:
      typeof raw.customModelUrl === 'string' && raw.customModelUrl.length <= 10000000
        ? raw.customModelUrl
        : null,
    elevation:
      typeof raw.elevation === 'number' && Number.isFinite(raw.elevation)
        ? clamp(raw.elevation, 0, 20)
        : undefined,
  };
}

/** Maximum objects accepted from an import, matching the performance budget. */
export const MAX_FURNITURE = 400;

/**
 * Validates and repairs an arbitrary value into a Project.
 *
 * Never throws — callers get a discriminated result they must handle.
 */
export function parseProject(raw: unknown): ParseResult {
  const warnings: string[] = [];

  if (!isObject(raw)) return { ok: false, error: 'File is not a RoomCraft project.' };

  const version = num(raw.schemaVersion, 0);
  if (version > SCHEMA_VERSION) {
    return {
      ok: false,
      error: `This project was made with a newer version of RoomCraft (schema v${version}). Update the app to open it.`,
    };
  }
  if (version < SCHEMA_VERSION) {
    warnings.push(`Upgraded project from schema v${version} to v${SCHEMA_VERSION}.`);
  }

  const rawRoom = isObject(raw.room) ? raw.room : {};
  const rawDims = isObject(rawRoom.dimensions) ? rawRoom.dimensions : {};
  const base = defaultRoom();

  const dimensions = {
    width: clamp(
      num(rawDims.width, base.dimensions.width),
      ROOM_LIMITS.minWidth,
      ROOM_LIMITS.maxWidth
    ),
    length: clamp(
      num(rawDims.length, base.dimensions.length),
      ROOM_LIMITS.minLength,
      ROOM_LIMITS.maxLength
    ),
    height: clamp(
      num(rawDims.height, base.dimensions.height),
      ROOM_LIMITS.minHeight,
      ROOM_LIMITS.maxHeight
    ),
    wallThickness: clamp(
      num(rawDims.wallThickness, base.dimensions.wallThickness),
      ROOM_LIMITS.minWallThickness,
      ROOM_LIMITS.maxWallThickness
    ),
  };

  const rawFloor = isObject(rawRoom.floor) ? rawRoom.floor : {};
  const pattern = rawFloor.pattern;
  const room: Room = {
    dimensions,
    walls: {
      color: color(
        isObject(rawRoom.walls) ? rawRoom.walls.color : undefined,
        base.walls.color
      ),
      pattern:
        isObject(rawRoom.walls) &&
        (rawRoom.walls.pattern === 'plain' ||
          rawRoom.walls.pattern === 'brick' ||
          rawRoom.walls.pattern === 'panels' ||
          rawRoom.walls.pattern === 'subway' ||
          rawRoom.walls.pattern === 'stripes' ||
          rawRoom.walls.pattern === 'concrete')
          ? rawRoom.walls.pattern
          : 'plain',
    },
    floor: {
      color: color(rawFloor.color, base.floor.color),
      pattern:
        pattern === 'plain' ||
        pattern === 'planks' ||
        pattern === 'tiles' ||
        pattern === 'herringbone'
          ? pattern
          : 'planks',
    },
    openings: [],
  };

  const rawOpenings = Array.isArray(rawRoom.openings) ? rawRoom.openings : [];
  if (rawOpenings.length > 40) {
    warnings.push('Project had an unreasonable number of openings; extras were dropped.');
  }
  for (const o of rawOpenings.slice(0, 40)) {
    const parsed = parseOpening(o, room, warnings);
    if (parsed) room.openings.push(parsed);
  }

  const rawFurniture = Array.isArray(raw.furniture) ? raw.furniture : [];
  if (rawFurniture.length > MAX_FURNITURE) {
    warnings.push(
      `Project contained ${rawFurniture.length} objects; only the first ${MAX_FURNITURE} were loaded.`
    );
  }
  const furniture: FurnitureInstance[] = [];
  const seenIds = new Set<string>();
  for (const f of rawFurniture.slice(0, MAX_FURNITURE)) {
    const parsed = parseFurniture(f, warnings);
    if (!parsed) continue;
    // Duplicate instance ids would break selection and undo/redo.
    if (seenIds.has(parsed.instanceId)) parsed.instanceId = createId('itm');
    seenIds.add(parsed.instanceId);
    furniture.push(parsed);
  }

  const now = Date.now();
  const project: Project = {
    id:
      typeof raw.id === 'string' && /^prj_[a-z0-9]{4,40}$/.test(raw.id)
        ? raw.id
        : createProjectId(),
    schemaVersion: SCHEMA_VERSION,
    name: text(raw.name, 'Imported room', 80).trim() || 'Imported room',
    unit: raw.unit === 'ft' ? 'ft' : 'm',
    room,
    furniture,
    createdAt: num(raw.createdAt, now),
    updatedAt: now,
  };

  return { ok: true, project, warnings };
}

/** Parses a JSON string. Wraps JSON.parse so malformed text is a clean failure. */
export function parseProjectJSON(json: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' };
  }
  return parseProject(raw);
}

export function serializeProject(project: Project): string {
  return JSON.stringify(project, null, 2);
}
