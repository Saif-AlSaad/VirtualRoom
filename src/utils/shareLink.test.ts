import { describe, expect, it } from 'vitest';
import type { DocumentState } from '@/types';
import { buildShareUrl, decodeShareData, encodeShareData } from './shareLink';
import { defaultRoom } from './schema';
import { getCatalogItem } from '@/data/catalog';

function sampleDoc(): DocumentState {
  const room = defaultRoom();
  room.dimensions = { width: 4.25, length: 5.5, height: 2.7, wallThickness: 0.15 };
  room.walls.color = '#a3b18a';
  room.floor = { color: '#6b4a32', pattern: 'herringbone' };
  room.openings.push({
    id: 'opn_1',
    kind: 'window',
    wall: 'east',
    offset: 2.75,
    width: 1.2,
    height: 1.1,
    sillHeight: 0.9,
    hinge: 'left',
    swing: 'in',
  });

  const sofa = getCatalogItem('sofa-3')!;
  return {
    name: 'Shared room',
    unit: 'ft',
    room,
    furniture: [
      {
        instanceId: 'itm_1',
        catalogId: 'sofa-3',
        position: { x: -1.125, z: 2.25 },
        rotation: 180,
        scale: { x: 1.1, y: 1.1, z: 1.1 },
        finishId: sofa.finishes[1].id,
        colorOverride: '#3a5a40',
        locked: true,
        visible: false,
        groupId: null,
        note: '',
      },
    ],
  };
}

describe('encode / decode', () => {
  it('preserves the room and every placed item', () => {
    const source = sampleDoc();
    const result = decodeShareData(encodeShareData(source));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { project } = result;
    expect(project.name).toBe('Shared room');
    expect(project.unit).toBe('ft');
    expect(project.room.dimensions.width).toBeCloseTo(4.25, 3);
    expect(project.room.dimensions.wallThickness).toBeCloseTo(0.15, 3);
    expect(project.room.floor.pattern).toBe('herringbone');
    expect(project.room.walls.color).toBe('#a3b18a');

    expect(project.room.openings).toHaveLength(1);
    expect(project.room.openings[0].wall).toBe('east');
    expect(project.room.openings[0].sillHeight).toBeCloseTo(0.9, 3);

    expect(project.furniture).toHaveLength(1);
    const item = project.furniture[0];
    expect(item.catalogId).toBe('sofa-3');
    expect(item.position.x).toBeCloseTo(-1.125, 3);
    expect(item.rotation).toBe(180);
    expect(item.scale.x).toBeCloseTo(1.1, 3);
    expect(item.colorOverride).toBe('#3a5a40');
    expect(item.locked).toBe(true);
    expect(item.visible).toBe(false);
  });

  it('preserves accent wall overrides across share link round-trip', () => {
    const source = sampleDoc();
    source.room.wallOverrides = {
      north: { color: '#2b3a4a', pattern: 'brick' },
      west: { color: '#ffffff', pattern: 'panels' },
    };
    const result = decodeShareData(encodeShareData(source));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { project } = result;
    expect(project.room.wallOverrides?.north?.color).toBe('#2b3a4a');
    expect(project.room.wallOverrides?.north?.pattern).toBe('brick');
    expect(project.room.wallOverrides?.west?.color).toBe('#ffffff');
    expect(project.room.wallOverrides?.west?.pattern).toBe('panels');
  });

  it('survives a name with non-ASCII characters', () => {
    const source = sampleDoc();
    source.name = 'Sitzécke — 客厅 🛋';
    const result = decodeShareData(encodeShareData(source));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.project.name).toBe('Sitzécke — 客厅 🛋');
  });

  it('gives the decoded project a fresh id, so a link never overwrites a project', () => {
    const a = decodeShareData(encodeShareData(sampleDoc()));
    const b = decodeShareData(encodeShareData(sampleDoc()));
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(a.project.id).not.toBe(b.project.id);
  });
});

describe('hostile input', () => {
  it('rejects garbage rather than throwing', () => {
    expect(decodeShareData('!!!not base64!!!').ok).toBe(false);
    expect(decodeShareData('').ok).toBe(false);
    // Valid base64, invalid payload.
    expect(decodeShareData(btoa('hello there')).ok).toBe(false);
  });

  it('refuses an oversized payload without parsing it', () => {
    const result = decodeShareData('A'.repeat(1_000_001));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/too large/i);
  });

  it('refuses a newer pack version', () => {
    const encoded = btoa(JSON.stringify({ v: 99, n: 'x', d: [4, 5, 2.6, 0.1] }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const result = decodeShareData(encoded);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/newer version/i);
  });

  it('sanitises hostile values inside a well-formed payload', () => {
    const packed = {
      v: 1,
      n: 'x'.repeat(500),
      u: 0,
      d: [1e9, -5, 0, 99],
      wc: 'javascript',
      fc: 'zzzzzz',
      fp: 42,
      o: [],
      f: [['not-a-real-item', 0, 0, 0, 1, 1, 1, 'x', '', 0]],
    };
    const encoded = btoa(JSON.stringify(packed))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const result = decodeShareData(encoded);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.name.length).toBeLessThanOrEqual(80);
    expect(result.project.room.walls.color).toMatch(/^#[0-9a-f]{6}$/);
    expect(result.project.room.floor.pattern).toBe('planks');
    expect(result.project.room.dimensions.width).toBeLessThanOrEqual(40);
    // The unknown catalog id is dropped, not rendered as a mystery box.
    expect(result.project.furniture).toHaveLength(0);
  });
});

describe('buildShareUrl', () => {
  it('puts the payload in the fragment, never the query string', () => {
    const url = buildShareUrl(sampleDoc(), 'https://example.com/app');
    expect(url).toContain('#s=');
    expect(url.split('#')[0]).not.toContain('s=');
  });
});
