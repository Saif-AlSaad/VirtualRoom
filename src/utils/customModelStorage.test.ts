import { beforeEach, describe, expect, it } from 'vitest';
import type { CatalogItem } from '@/types';
import { getCatalogItem } from '@/data/catalog';
import {
  deleteCustomModel,
  getSavedCustomCatalog,
  initCustomCatalog,
  persistCustomCatalog,
  saveCustomModel,
} from './customModelStorage';

const mockItem: CatalogItem = {
  id: 'custom-test-123',
  name: 'Test Custom Model',
  category: 'decor',
  tags: ['custom', 'test'],
  size: { w: 1, d: 1, h: 1 },
  model: 'coffeeTable',
  price: 0,
  finishes: [
    { id: 'orig', name: 'Original', color: '#ffffff', roughness: 0.5, metalness: 0.1 },
  ],
  clearance: { front: 0, back: 0, left: 0, right: 0 },
  elevation: 0,
  wallMounted: false,
  collides: true,
  scaleRange: [0.5, 2],
  availability: 'custom',
};

describe('customModelStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves and reads custom catalog items in localStorage', () => {
    expect(getSavedCustomCatalog()).toEqual([]);
    persistCustomCatalog([mockItem]);
    const saved = getSavedCustomCatalog();
    expect(saved).toHaveLength(1);
    expect(saved[0].id).toBe(mockItem.id);
  });

  it('initCustomCatalog registers saved items into runtime catalog', async () => {
    persistCustomCatalog([mockItem]);
    await initCustomCatalog();
    const item = getCatalogItem(mockItem.id);
    expect(item).toBeDefined();
    expect(item?.name).toBe('Test Custom Model');
  });

  it('saveCustomModel registers item and creates an object URL', async () => {
    const buffer = new ArrayBuffer(16);
    const url = await saveCustomModel(mockItem, buffer);
    expect(url).toBeDefined();
    expect(typeof url).toBe('string');
    expect(getCatalogItem(mockItem.id)).toBeDefined();
    const saved = getSavedCustomCatalog();
    expect(saved.some((i) => i.id === mockItem.id)).toBe(true);
  });

  it('deleteCustomModel unregisters item and removes from storage', async () => {
    const buffer = new ArrayBuffer(16);
    await saveCustomModel(mockItem, buffer);
    expect(getCatalogItem(mockItem.id)).toBeDefined();

    await deleteCustomModel(mockItem.id);
    expect(getCatalogItem(mockItem.id)).toBeUndefined();
    expect(getSavedCustomCatalog().some((i) => i.id === mockItem.id)).toBe(false);
  });
});
