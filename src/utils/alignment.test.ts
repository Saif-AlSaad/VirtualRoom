import { describe, expect, it } from 'vitest';
import type { FurnitureInstance } from '@/types';
import {
  calculateAlignedPositions,
  calculateDistributedPositions,
  calculateSnappedFacePositions,
  getItemBounds,
} from './alignment';

function createMockItem(
  id: string,
  catalogId: string,
  x: number,
  z: number,
  rotation = 0
): FurnitureInstance {
  return {
    instanceId: id,
    catalogId,
    position: { x, z },
    rotation,
    scale: { x: 1, y: 1, z: 1 },
    finishId: 'default',
    colorOverride: null,
    locked: false,
    visible: true,
    groupId: null,
    note: '',
  };
}

describe('getItemBounds', () => {
  it('calculates bounding box for an unrotated item', () => {
    // dining-chair size is typically 0.5 x 0.5 x 0.85
    const item = createMockItem('c1', 'dining-chair', 1, 2, 0);
    const bounds = getItemBounds(item);
    expect(bounds.cx).toBe(1);
    expect(bounds.cz).toBe(2);
    expect(bounds.minX).toBeCloseTo(1 - bounds.w / 2);
    expect(bounds.maxX).toBeCloseTo(1 + bounds.w / 2);
  });
});

describe('calculateAlignedPositions', () => {
  it('aligns multiple items to the left', () => {
    const item1 = createMockItem('c1', 'dining-chair', 0, 0);
    const item2 = createMockItem('c2', 'dining-chair', 2, 0);
    const item3 = createMockItem('c3', 'dining-chair', 4, 0);

    const aligned = calculateAlignedPositions([item1, item2, item3], 'left');
    const b1 = getItemBounds(item1);

    expect(aligned.get('c1')!.x).toBeCloseTo(b1.minX + b1.w / 2);
    expect(aligned.get('c2')!.x).toBeCloseTo(b1.minX + b1.w / 2);
    expect(aligned.get('c3')!.x).toBeCloseTo(b1.minX + b1.w / 2);
  });

  it('aligns multiple items to center-x', () => {
    const item1 = createMockItem('c1', 'dining-chair', 0, 0);
    const item2 = createMockItem('c2', 'dining-chair', 4, 0);

    const aligned = calculateAlignedPositions([item1, item2], 'center-x');
    expect(aligned.get('c1')!.x).toBeCloseTo(2);
    expect(aligned.get('c2')!.x).toBeCloseTo(2);
  });

  it('aligns multiple items to the right', () => {
    const item1 = createMockItem('c1', 'dining-chair', 0, 0);
    const item2 = createMockItem('c2', 'dining-chair', 4, 0);

    const aligned = calculateAlignedPositions([item1, item2], 'right');
    const b2 = getItemBounds(item2);
    expect(aligned.get('c1')!.x).toBeCloseTo(b2.maxX - b2.w / 2);
    expect(aligned.get('c2')!.x).toBeCloseTo(b2.maxX - b2.w / 2);
  });
});

describe('calculateDistributedPositions', () => {
  it('spaces three items with equal gaps along X', () => {
    const item1 = createMockItem('c1', 'dining-chair', 0, 0);
    const item2 = createMockItem('c2', 'dining-chair', 1, 0); // off-center
    const item3 = createMockItem('c3', 'dining-chair', 6, 0);

    const distributed = calculateDistributedPositions([item1, item2, item3], 'x');
    expect(distributed.has('c2')).toBe(true);

    const pos1 = distributed.get('c1')!.x;
    const pos2 = distributed.get('c2')!.x;
    const pos3 = distributed.get('c3')!.x;

    const gap1 = pos2 - pos1;
    const gap2 = pos3 - pos2;
    expect(gap1).toBeCloseTo(gap2, 3);
  });
});

describe('calculateSnappedFacePositions', () => {
  it('places subsequent items flush against preceding item', () => {
    const item1 = createMockItem('c1', 'dining-chair', 0, 0);
    const item2 = createMockItem('c2', 'dining-chair', 2, 0);

    const snapped = calculateSnappedFacePositions([item1, item2], 'x');
    const b1 = getItemBounds(item1);
    const b2 = getItemBounds(item2);

    const newPos2 = snapped.get('c2')!;
    // item2 left edge should match item1 right edge
    expect(newPos2.x - b2.w / 2).toBeCloseTo(b1.maxX);
  });
});
