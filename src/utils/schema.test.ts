import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION } from '@/types';
import { createProject, parseProject, parseProjectJSON, serializeProject } from './schema';
import { CATALOG } from '@/data/catalog';
import { ROOM_LIMITS } from './placement';

/**
 * These tests treat `parseProject` as a security boundary, because it is one:
 * it is the only thing standing between a hostile share link and application
 * state.
 */

const validCatalogId = CATALOG[0].id;

function baseProject() {
  return {
    id: 'prj_abcdef1234',
    schemaVersion: SCHEMA_VERSION,
    name: 'Test room',
    unit: 'm',
    room: {
      dimensions: { width: 4, length: 5, height: 2.6, wallThickness: 0.12 },
      walls: { color: '#f5f4f0' },
      floor: { color: '#c69c6d', pattern: 'planks' },
      openings: [],
    },
    furniture: [],
    createdAt: 1,
    updatedAt: 2,
  };
}

describe('round trip', () => {
  it('survives serialize → parse unchanged in every meaningful field', () => {
    const project = createProject('Round trip', 'ft');
    project.furniture.push({
      instanceId: 'itm_one',
      catalogId: validCatalogId,
      position: { x: 1.25, z: -0.5 },
      rotation: 90,
      scale: { x: 1, y: 1, z: 1 },
      finishId: CATALOG[0].finishes[0].id,
      colorOverride: '#a3b18a',
      locked: true,
      visible: false,
      groupId: 'grp_x',
      note: 'keep',
    });

    const result = parseProjectJSON(serializeProject(project));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.project.name).toBe('Round trip');
    expect(result.project.unit).toBe('ft');
    expect(result.project.furniture).toHaveLength(1);
    const item = result.project.furniture[0];
    expect(item.instanceId).toBe('itm_one');
    expect(item.position.x).toBeCloseTo(1.25);
    expect(item.rotation).toBe(90);
    expect(item.locked).toBe(true);
    expect(item.visible).toBe(false);
    expect(item.note).toBe('keep');
  });
});

describe('structural rejection', () => {
  it('rejects non-objects', () => {
    expect(parseProject(null).ok).toBe(false);
    expect(parseProject('a string').ok).toBe(false);
    expect(parseProject([1, 2, 3]).ok).toBe(false);
  });

  it('rejects malformed JSON with a readable message', () => {
    const result = parseProjectJSON('{not json');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/valid JSON/i);
  });

  it('refuses a newer schema version rather than guessing', () => {
    const result = parseProject({ ...baseProject(), schemaVersion: SCHEMA_VERSION + 5 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/newer version/i);
  });

  it('accepts an older schema version and warns about the upgrade', () => {
    const result = parseProject({ ...baseProject(), schemaVersion: 0 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.warnings.join(' ')).toMatch(/Upgraded/);
  });
});

describe('repair rather than reject', () => {
  it('clamps absurd room dimensions into the supported range', () => {
    const result = parseProject({
      ...baseProject(),
      room: {
        ...baseProject().room,
        dimensions: { width: 1e9, length: -4, height: 0, wallThickness: 99 },
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const d = result.project.room.dimensions;
    expect(d.width).toBe(ROOM_LIMITS.maxWidth);
    expect(d.length).toBe(ROOM_LIMITS.minLength);
    expect(d.height).toBe(ROOM_LIMITS.minHeight);
    expect(d.wallThickness).toBe(ROOM_LIMITS.maxWallThickness);
  });

  it('drops one bad furniture entry and keeps the rest', () => {
    const result = parseProject({
      ...baseProject(),
      furniture: [
        { catalogId: validCatalogId, position: { x: 0, z: 0 } },
        { catalogId: 'does-not-exist', position: { x: 1, z: 1 } },
        'not an object',
        { catalogId: validCatalogId, position: { x: 2, z: 0 } },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.furniture).toHaveLength(2);
    expect(result.warnings.length).toBeGreaterThanOrEqual(2);
  });

  it('replaces NaN and missing numbers with safe defaults', () => {
    const result = parseProject({
      ...baseProject(),
      furniture: [
        {
          catalogId: validCatalogId,
          position: { x: 'lots', z: undefined },
          rotation: Number.NaN,
          scale: { x: 999, y: -5, z: null },
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const item = result.project.furniture[0];
    expect(Number.isFinite(item.position.x)).toBe(true);
    expect(Number.isFinite(item.rotation)).toBe(true);
    const [min, max] = CATALOG[0].scaleRange;
    expect(item.scale.x).toBeLessThanOrEqual(max);
    expect(item.scale.y).toBeGreaterThanOrEqual(min);
  });

  it('rejects non-hex colours instead of passing them through', () => {
    const result = parseProject({
      ...baseProject(),
      room: {
        ...baseProject().room,
        walls: { color: 'url(javascript:alert(1))' },
        floor: { color: '#nothex', pattern: 'evil' },
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.room.walls.color).toMatch(/^#[0-9a-f]{6}$/);
    expect(result.project.room.floor.color).toMatch(/^#[0-9a-f]{6}$/);
    expect(result.project.room.floor.pattern).toBe('planks');
  });

  it('de-duplicates repeated instance ids', () => {
    const result = parseProject({
      ...baseProject(),
      furniture: [
        { instanceId: 'same', catalogId: validCatalogId, position: { x: 0, z: 0 } },
        { instanceId: 'same', catalogId: validCatalogId, position: { x: 1, z: 0 } },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [a, b] = result.project.furniture;
    expect(a.instanceId).not.toBe(b.instanceId);
  });

  it('caps long text fields', () => {
    const result = parseProject({
      ...baseProject(),
      name: 'x'.repeat(5000),
      furniture: [
        { catalogId: validCatalogId, position: { x: 0, z: 0 }, note: 'y'.repeat(5000) },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.name.length).toBeLessThanOrEqual(80);
    expect(result.project.furniture[0].note.length).toBeLessThanOrEqual(500);
  });
});

describe('opening invariants', () => {
  it('keeps an opening fully on its wall even when the offset is absurd', () => {
    const result = parseProject({
      ...baseProject(),
      room: {
        ...baseProject().room,
        openings: [
          { kind: 'door', wall: 'north', offset: 9999, width: 0.9, height: 2.05 },
        ],
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const opening = result.project.room.openings[0];
    // North wall is `width` long (4 m); a 0.9 m door must sit within [0.45, 3.55].
    expect(opening.offset).toBeGreaterThanOrEqual(0.45 - 1e-9);
    expect(opening.offset).toBeLessThanOrEqual(3.55 + 1e-9);
  });

  it('drops an opening attached to a wall that does not exist', () => {
    const result = parseProject({
      ...baseProject(),
      room: {
        ...baseProject().room,
        openings: [{ kind: 'door', wall: 'ceiling', offset: 1, width: 0.9, height: 2 }],
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.room.openings).toHaveLength(0);
  });

  it('forces doors to sit on the floor', () => {
    const result = parseProject({
      ...baseProject(),
      room: {
        ...baseProject().room,
        openings: [
          { kind: 'door', wall: 'south', offset: 2, width: 0.9, height: 2, sillHeight: 1.2 },
        ],
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.project.room.openings[0].sillHeight).toBe(0);
  });
});

describe('identity', () => {
  it('mints a fresh id when the supplied one is not a valid project id', () => {
    const result = parseProject({ ...baseProject(), id: '../../etc/passwd' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.project.id).toMatch(/^prj_[a-z0-9]+$/);
  });
});

describe('partitions and lighting', () => {
  it('parses valid partitions and clamps out-of-bounds positions', () => {
    const result = parseProject({
      ...baseProject(),
      room: {
        ...baseProject().room,
        partitions: [
          {
            name: 'Office divider',
            position: { x: 50, z: -50 },
            length: 3.0,
            thickness: 0.15,
            height: 2.4,
            rotation: 45,
            finish: { color: '#f5f4f0', pattern: 'panels' },
          },
        ],
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const p = result.project.room.partitions?.[0];
    expect(p).toBeDefined();
    expect(p?.name).toBe('Office divider');
    expect(p?.length).toBe(3.0);
    expect(p?.finish?.pattern).toBe('panels');
    expect(p?.position.x).toBeLessThanOrEqual(2.1);
    expect(p?.position.z).toBeGreaterThanOrEqual(-2.5);
  });

  it('parses lighting properties on furniture', () => {
    const result = parseProject({
      ...baseProject(),
      furniture: [
        {
          catalogId: 'floor-lamp',
          position: { x: 1, z: 1 },
          lightEnabled: false,
          lightIntensity: 2.2,
          lightColor: '#ffeaad',
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const f = result.project.furniture[0];
    expect(f.lightEnabled).toBe(false);
    expect(f.lightIntensity).toBe(2.2);
    expect(f.lightColor).toBe('#ffeaad');
  });

  it('parses valid wallOverrides (accent walls) and rejects malformed finishes', () => {
    const result = parseProject({
      ...baseProject(),
      room: {
        ...baseProject().room,
        wallOverrides: {
          north: { color: '#2b3a4a', pattern: 'brick' },
          east: { color: 'not-a-color', pattern: 'invalid' },
        },
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const overrides = result.project.room.wallOverrides;
    expect(overrides).toBeDefined();
    expect(overrides?.north?.color).toBe('#2b3a4a');
    expect(overrides?.north?.pattern).toBe('brick');
    expect(overrides?.east?.color).toBe(result.project.room.walls.color);
    expect(overrides?.east?.pattern).toBe('plain');
  });
});
