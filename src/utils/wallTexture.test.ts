import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getWallMaterialProperties, getWallTexture } from './wallTexture';

describe('wallTexture', () => {
  it('returns null for plain wall finish', () => {
    const texture = getWallTexture({ color: '#f5f4f0', pattern: 'plain' }, 4, 2.6);
    expect(texture).toBeNull();
  });

  it('provides appropriate material roughness and metalness per pattern', () => {
    const subway = getWallMaterialProperties('subway');
    expect(subway.roughness).toBeLessThan(0.3); // High gloss

    const concrete = getWallMaterialProperties('concrete');
    expect(concrete.roughness).toBeGreaterThan(0.9); // Matte rough

    const panels = getWallMaterialProperties('panels');
    expect(panels.roughness).toBeCloseTo(0.55, 2);

    const plain = getWallMaterialProperties('plain');
    expect(plain.roughness).toBeGreaterThan(0.8);
  });

  describe('with canvas mock', () => {
    const mockCtx = {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
    };

    const originalGetContext = HTMLCanvasElement.prototype.getContext;

    beforeEach(() => {
      HTMLCanvasElement.prototype.getContext = vi.fn((contextId: string) => {
        if (contextId === '2d') return mockCtx as unknown as CanvasRenderingContext2D;
        return null;
      }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    });

    afterEach(() => {
      HTMLCanvasElement.prototype.getContext = originalGetContext;
    });

    it('generates a texture for patterned finishes and caches it', () => {
      const t1 = getWallTexture({ color: '#f5f4f0', pattern: 'brick' }, 4, 2.6);
      expect(t1).not.toBeNull();

      // Second call should return the exact same cached instance
      const t2 = getWallTexture({ color: '#f5f4f0', pattern: 'brick' }, 4, 2.6);
      expect(t2).toBe(t1);
    });

    it('generates panels and subway tile patterns', () => {
      const tPanels = getWallTexture({ color: '#c69c6d', pattern: 'panels' }, 3, 2.4);
      expect(tPanels).not.toBeNull();

      const tSubway = getWallTexture({ color: '#ffffff', pattern: 'subway' }, 2, 2.4);
      expect(tSubway).not.toBeNull();
    });
  });
});
