import { describe, expect, it } from 'vitest';
import type { DocumentState, FurnitureInstance } from '@/types';
import { defaultRoom } from './schema';
import {
  evaluatePlacement,
  findFreeSpot,
  isPlacementValid,
  shoppingList,
  totalCost,
  validateRoomDimensions,
} from './placement';
import { getCatalogItem } from '@/data/catalog';

function place(
  catalogId: string,
  x: number,
  z: number,
  rotation = 0
): FurnitureInstance {
  const catalog = getCatalogItem(catalogId)!;
  return {
    instanceId: `itm_${catalogId}_${x}_${z}`,
    catalogId,
    position: { x, z },
    rotation,
    scale: { x: 1, y: 1, z: 1 },
    finishId: catalog.finishes[0].id,
    colorOverride: null,
    locked: false,
    visible: true,
    groupId: null,
    note: '',
  };
}

function doc(furniture: FurnitureInstance[], width = 6, length = 8): DocumentState {
  const room = defaultRoom();
  room.dimensions.width = width;
  room.dimensions.length = length;
  return { name: 'Test', unit: 'm', room, furniture };
}

describe('evaluatePlacement', () => {
  it('reports nothing for a clean layout', () => {
    const issues = evaluatePlacement(doc([place('sofa-3', -1.5, 0), place('armchair', 2, 2)]));
    expect(issues.filter((i) => i.severity === 'error')).toHaveLength(0);
  });

  it('names the other object in an overlap message', () => {
    const issues = evaluatePlacement(doc([place('sofa-3', 0, 0), place('armchair', 0.2, 0)]));
    const overlap = issues.find((i) => i.code === 'overlap');
    expect(overlap).toBeDefined();
    expect(overlap!.message).toMatch(/Overlaps with/);
    expect(overlap!.otherId).toBeDefined();
  });

  it('reports the overlap on BOTH objects, not just one', () => {
    const issues = evaluatePlacement(doc([place('sofa-3', 0, 0), place('armchair', 0.2, 0)]));
    const ids = new Set(issues.filter((i) => i.code === 'overlap').map((i) => i.instanceId));
    expect(ids.size).toBe(2);
  });

  it('flags an object extending through a wall', () => {
    const issues = evaluatePlacement(doc([place('sofa-3', 2.8, 0)]));
    expect(issues.some((i) => i.code === 'out-of-bounds')).toBe(true);
  });

  it('flags an object larger than the room as oversized, not out-of-bounds', () => {
    const issues = evaluatePlacement(doc([place('sofa-3', 0, 0)], 1.5, 1.5));
    expect(issues.some((i) => i.code === 'oversized')).toBe(true);
  });

  it('lets non-colliding items share a footprint with furniture', () => {
    // A rug under a coffee table is correct, not a collision.
    const issues = evaluatePlacement(doc([place('rug-large', 0, 0), place('coffee-table', 0, 0)]));
    expect(issues.filter((i) => i.code === 'overlap')).toHaveLength(0);
  });

  it('lets objects in different height bands share a footprint', () => {
    // A monitor sits at 0.75 m; a desk tops out at 0.75 m.
    const issues = evaluatePlacement(doc([place('desk', 0, 0), place('monitor', 0, 0)]));
    expect(issues.filter((i) => i.code === 'overlap')).toHaveLength(0);
  });

  it('warns about clearance without treating it as an error', () => {
    // A chair jammed against the front of a wardrobe: legal, but unusable.
    const issues = evaluatePlacement(
      doc([place('wardrobe-2', 0, 0), place('dining-chair', 0, 0.75)])
    );
    const clearance = issues.find((i) => i.code === 'clearance');
    expect(clearance?.severity).toBe('warning');
  });

  it('warns when furniture blocks a door swing', () => {
    // Door centred on the south wall (z = +4); its approach zone runs from
    // z = 3.1 to z = 4.0. A sofa at z = 3.4 sits squarely in it.
    const d = doc([place('sofa-3', 0, 3.4)]);
    d.room.openings.push({
      id: 'opn_1',
      kind: 'door',
      wall: 'south',
      offset: 3,
      width: 0.9,
      height: 2.05,
      sillHeight: 0,
      hinge: 'left',
      swing: 'in',
    });
    const issues = evaluatePlacement(d);
    expect(issues.some((i) => i.code === 'blocks-door')).toBe(true);
  });

  it('ignores hidden objects entirely', () => {
    const items = [place('sofa-3', 0, 0), place('armchair', 0.2, 0)];
    items[1].visible = false;
    expect(evaluatePlacement(doc(items)).filter((i) => i.code === 'overlap')).toHaveLength(0);
  });

  it('errorsOnly skips the clearance and door passes', () => {
    const full = evaluatePlacement(
      doc([place('wardrobe-2', 0, 0), place('dining-chair', 0, 0.75)])
    );
    const fast = evaluatePlacement(
      doc([place('wardrobe-2', 0, 0), place('dining-chair', 0, 0.75)]),
      { errorsOnly: true }
    );
    expect(full.some((i) => i.code === 'clearance')).toBe(true);
    expect(fast.some((i) => i.code === 'clearance')).toBe(false);
  });
});

describe('isPlacementValid', () => {
  it('accepts an empty room', () => {
    const candidate = place('sofa-3', 0, 0);
    expect(isPlacementValid(candidate, doc([])).valid).toBe(true);
  });

  it('rejects and explains a collision', () => {
    const existing = place('sofa-3', 0, 0);
    const candidate = place('armchair', 0.3, 0);
    const result = isPlacementValid(candidate, doc([existing]));
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/Overlaps with/);
    expect(result.blockerId).toBe(existing.instanceId);
  });

  it('does not report an object colliding with itself', () => {
    const existing = place('sofa-3', 0, 0);
    expect(isPlacementValid(existing, doc([existing])).valid).toBe(true);
  });
});

describe('findFreeSpot', () => {
  it('returns the preferred point when it is already free', () => {
    const spot = findFreeSpot(place('armchair', 0, 0), doc([]), { x: 1, z: 1 });
    expect(spot.x).toBeCloseTo(1);
    expect(spot.z).toBeCloseTo(1);
  });

  it('finds somewhere clear when the preferred point is taken', () => {
    const existing = place('sofa-3', 0, 0);
    const candidate = place('armchair', 0, 0);
    const spot = findFreeSpot(candidate, doc([existing]), { x: 0, z: 0 });
    const moved = { ...candidate, position: spot };
    expect(isPlacementValid(moved, doc([existing])).valid).toBe(true);
  });
});

describe('costing', () => {
  it('sums catalog prices', () => {
    const sofa = getCatalogItem('sofa-3')!;
    const chair = getCatalogItem('dining-chair')!;
    const total = totalCost([place('sofa-3', 0, 0), place('dining-chair', 2, 2)]);
    expect(total).toBe(sofa.price + chair.price);
  });

  it('groups the shopping list by catalog id with quantities', () => {
    const list = shoppingList([
      place('dining-chair', 0, 0),
      place('dining-chair', 1, 0),
      place('sofa-3', 3, 3),
    ]);
    const chairs = list.find((l) => l.catalogId === 'dining-chair')!;
    expect(chairs.quantity).toBe(2);
    expect(chairs.total).toBe(chairs.unitPrice * 2);
  });

  it('sorts the list by spend, highest first', () => {
    const list = shoppingList([
      place('dining-chair', 0, 0),
      place('sofa-3', 3, 3),
    ]);
    expect(list[0].total).toBeGreaterThanOrEqual(list[1].total);
  });
});

describe('validateRoomDimensions', () => {
  it('accepts a sensible room', () => {
    expect(
      validateRoomDimensions({ width: 4, length: 5, height: 2.6, wallThickness: 0.12 })
    ).toEqual({});
  });

  it('rejects zero and negative dimensions with a message', () => {
    const errors = validateRoomDimensions({ width: 0, length: -3 });
    expect(errors.width).toBeDefined();
    expect(errors.length).toBeDefined();
  });

  it('rejects values beyond the supported range', () => {
    const errors = validateRoomDimensions({ width: 500, height: 100 });
    expect(errors.width).toMatch(/cannot exceed/);
    expect(errors.height).toMatch(/cannot exceed/);
  });

  it('ignores fields that were not supplied', () => {
    expect(validateRoomDimensions({ width: 4 })).toEqual({});
  });
});
