import { describe, expect, it } from 'vitest';
import type { Size3, Vec3 } from '@/types';
import {
  calculateNewScale,
  calculateUniformScale,
  formatDualDimension,
  isUniformScale,
} from './furnitureSizing';

describe('furnitureSizing', () => {
  const catalogSize: Size3 = { w: 2.0, d: 1.0, h: 0.8 };
  const initialScale: Vec3 = { x: 1.0, y: 1.0, z: 1.0 };
  const scaleRange: [number, number] = [0.3, 3.0];

  describe('calculateNewScale with locked aspect ratio', () => {
    it('scales all axes proportionally when width changes', () => {
      // 2.0m -> 3.0m is 1.5x factor
      const next = calculateNewScale({
        axis: 'w',
        newDimensionMetres: 3.0,
        currentScale: initialScale,
        catalogSize,
        scaleRange,
        lockRatio: true,
      });

      expect(next.x).toBeCloseTo(1.5);
      expect(next.y).toBeCloseTo(1.5);
      expect(next.z).toBeCloseTo(1.5);
    });

    it('scales all axes proportionally when depth changes', () => {
      // 1.0m -> 0.5m is 0.5x factor
      const next = calculateNewScale({
        axis: 'd',
        newDimensionMetres: 0.5,
        currentScale: initialScale,
        catalogSize,
        scaleRange,
        lockRatio: true,
      });

      expect(next.x).toBeCloseTo(0.5);
      expect(next.y).toBeCloseTo(0.5);
      expect(next.z).toBeCloseTo(0.5);
    });

    it('scales all axes proportionally when height changes', () => {
      // 0.8m -> 1.6m is 2.0x factor
      const next = calculateNewScale({
        axis: 'h',
        newDimensionMetres: 1.6,
        currentScale: initialScale,
        catalogSize,
        scaleRange,
        lockRatio: true,
      });

      expect(next.x).toBeCloseTo(2.0);
      expect(next.y).toBeCloseTo(2.0);
      expect(next.z).toBeCloseTo(2.0);
    });

    it('clamps to scaleRange bounds', () => {
      // Requesting 10m on a 2m object would be 5.0x, but max is 3.0x
      const next = calculateNewScale({
        axis: 'w',
        newDimensionMetres: 10.0,
        currentScale: initialScale,
        catalogSize,
        scaleRange,
        lockRatio: true,
      });

      expect(next.x).toBeCloseTo(3.0);
      expect(next.y).toBeCloseTo(3.0);
      expect(next.z).toBeCloseTo(3.0);
    });
  });

  describe('calculateNewScale with unlocked aspect ratio', () => {
    it('modifies only width (x axis) when aspect ratio is unlocked', () => {
      const next = calculateNewScale({
        axis: 'w',
        newDimensionMetres: 3.0,
        currentScale: initialScale,
        catalogSize,
        scaleRange,
        lockRatio: false,
      });

      expect(next.x).toBeCloseTo(1.5);
      expect(next.y).toBeCloseTo(1.0);
      expect(next.z).toBeCloseTo(1.0);
    });

    it('modifies only depth (z axis) when aspect ratio is unlocked', () => {
      const next = calculateNewScale({
        axis: 'd',
        newDimensionMetres: 1.8,
        currentScale: initialScale,
        catalogSize,
        scaleRange,
        lockRatio: false,
      });

      expect(next.x).toBeCloseTo(1.0);
      expect(next.y).toBeCloseTo(1.0);
      expect(next.z).toBeCloseTo(1.8);
    });

    it('modifies only height (y axis) when aspect ratio is unlocked', () => {
      const next = calculateNewScale({
        axis: 'h',
        newDimensionMetres: 1.2,
        currentScale: initialScale,
        catalogSize,
        scaleRange,
        lockRatio: false,
      });

      expect(next.x).toBeCloseTo(1.0);
      expect(next.y).toBeCloseTo(1.5);
      expect(next.z).toBeCloseTo(1.0);
    });
  });

  describe('calculateUniformScale', () => {
    it('applies uniform scale across all axes', () => {
      const next = calculateUniformScale(1.25, initialScale, scaleRange, false);
      expect(next.x).toBeCloseTo(1.25);
      expect(next.y).toBeCloseTo(1.25);
      expect(next.z).toBeCloseTo(1.25);
    });

    it('preserves proportions when requested on non-uniform scale', () => {
      const nonUniform: Vec3 = { x: 1.0, y: 2.0, z: 1.5 }; // avg = 1.5
      // Target 3.0 is 2x factor
      const next = calculateUniformScale(3.0, nonUniform, scaleRange, true);
      expect(next.x).toBeCloseTo(2.0);
      expect(next.y).toBeCloseTo(3.0); // clamped to maxScale 3.0
      expect(next.z).toBeCloseTo(3.0);
    });
  });

  describe('isUniformScale', () => {
    it('returns true when scale is uniform', () => {
      expect(isUniformScale({ x: 1, y: 1, z: 1 })).toBe(true);
      expect(isUniformScale({ x: 1.5, y: 1.5, z: 1.5 })).toBe(true);
    });

    it('returns false when scale differs across axes', () => {
      expect(isUniformScale({ x: 1.2, y: 1.0, z: 1.0 })).toBe(false);
    });
  });

  describe('formatDualDimension', () => {
    it('formats dual dimensions in metric mode with feet conversion', () => {
      const res = formatDualDimension(2.0, 'm');
      expect(res.primary).toBe('2.00 m');
      expect(res.secondary).toContain('6′');
    });

    it('formats dual dimensions in imperial mode with metric conversion', () => {
      // 1.8288m = 6.0ft
      const res = formatDualDimension(1.8288, 'ft');
      expect(res.primary).toBe('6.00 ft');
      expect(res.secondary).toContain('1.83 m');
    });
  });
});
