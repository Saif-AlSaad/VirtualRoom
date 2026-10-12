import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { FurnitureThumbnail } from './FurnitureThumbnail';
import { CATALOG } from '@/data/catalog';
import type { CatalogItem } from '@/types';

describe('FurnitureThumbnail component', () => {
  // Test a varied selection of real catalog items
  const sampleIds = [
    'armchair',
    'sofa-3',
    'coffee-table',
    'double-bed',
    'wardrobe-2',
    'dressing-table',
    'desk',
    'dining-table-rect',
    'dining-chair',
    'office-chair',
    'bookshelf',
    'tv-unit',
    'nightstand',
    'monstera',
    'floor-lamp',
    'rug-large',
    'bathtub',
    'toilet',
  ];

  sampleIds.forEach((id) => {
    const item = CATALOG.find((c) => c.id === id);
    if (!item) return;

    it(`renders SVG illustration cleanly for catalog item "${item.id}" (${item.model})`, () => {
      const { container } = render(<FurnitureThumbnail item={item} />);
      const svg = container.querySelector('svg');
      expect(svg).toBeTruthy();
      expect(svg?.getAttribute('viewBox')).toBe('0 0 80 60');

      // Check that geometric shapes were rendered
      const shapes = container.querySelectorAll('rect, circle, line, ellipse');
      expect(shapes.length).toBeGreaterThan(1);
    });
  });

  it('renders all catalog items without throwing', () => {
    CATALOG.forEach((item) => {
      const { container } = render(<FurnitureThumbnail item={item} />);
      const svg = container.querySelector('svg');
      expect(svg).toBeTruthy();
    });
  });

  it('handles custom fallback item safely without crashing', () => {
    const base = CATALOG[0];
    const customItem: CatalogItem = {
      ...base,
      id: 'custom-box',
      name: 'Custom Box',
      model: 'filingCabinet',
      size: { w: 1.0, h: 1.0, d: 1.0 },
    };

    const { container } = render(<FurnitureThumbnail item={customItem} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });
});
