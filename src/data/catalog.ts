import type { CatalogItem, Category, Clearance, FinishOption } from '@/types';
import {
  APPLIANCE_FINISHES,
  CERAMIC_FINISHES,
  FABRIC_FINISHES,
  METAL_FINISHES,
  TEXTILE_FINISHES,
  WOOD_FINISHES,
} from './finishes';

/**
 * The furniture catalog.
 *
 * Every size is a real-world manufacturing dimension in metres (w × d × h), not
 * an eyeballed value — the whole point of the planner is that "will this fit?"
 * has a truthful answer. Clearances come from standard residential circulation
 * guidance: ~750 mm to open a wardrobe or pull out a dining chair, ~900 mm in
 * front of appliances, ~600 mm as a walkway.
 *
 * This module is pure immutable data. The editor never mutates it; placing an
 * item creates a `FurnitureInstance` that references a catalog id.
 */

const NO_CLEARANCE: Clearance = { front: 0, back: 0, left: 0, right: 0 };

function clear(
  front = 0,
  back = 0,
  left = 0,
  right = 0
): Clearance {
  return { front, back, left, right };
}

type ItemInput = Omit<
  CatalogItem,
  'clearance' | 'elevation' | 'wallMounted' | 'collides' | 'scaleRange' | 'availability'
> &
  Partial<
    Pick<
      CatalogItem,
      'clearance' | 'elevation' | 'wallMounted' | 'collides' | 'scaleRange' | 'availability'
    >
  >;

function item(input: ItemInput): CatalogItem {
  return {
    clearance: NO_CLEARANCE,
    elevation: 0,
    wallMounted: false,
    collides: true,
    scaleRange: [0.8, 1.2],
    availability: 'available',
    ...input,
  };
}

const size = (w: number, d: number, h: number) => ({ w, d, h });

const wood = (): FinishOption[] => WOOD_FINISHES;
const fabricThenWood = (): FinishOption[] => FABRIC_FINISHES;

export const CATEGORIES: Array<{
  id: Category;
  label: string;
  /** Inline SVG path data, 24×24 viewBox. */
  icon: string;
}> = [
  {
    id: 'living',
    label: 'Living',
    icon: 'M4 11V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3M3 11h18v6H3zM6 17v2M18 17v2',
  },
  {
    id: 'bedroom',
    label: 'Bedroom',
    icon: 'M3 18v-8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8M3 14h18M7 8V6h5v2M3 18v2M21 18v2',
  },
  {
    id: 'dining',
    label: 'Dining',
    icon: 'M3 9h18M5 9v10M19 9v10M8 3v6M11 3v6M8 5h3',
  },
  {
    id: 'kitchen',
    label: 'Kitchen',
    icon: 'M4 4h16v16H4zM4 10h16M9 4v6M8 14h4',
  },
  {
    id: 'office',
    label: 'Office',
    icon: 'M3 10h18M4 10V7a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v3M6 10v9M18 10v9M9 14h6',
  },
  {
    id: 'bathroom',
    label: 'Bath',
    icon: 'M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM7 12V6a2 2 0 0 1 4 0M6 19l-1 2M18 19l1 2',
  },
  {
    id: 'storage',
    label: 'Storage',
    icon: 'M5 3h14v18H5zM12 3v18M9 11h1M14 11h1',
  },
  {
    id: 'outdoor',
    label: 'Outdoor',
    icon: 'M12 3l8 6H4zM12 9v12M7 14h10',
  },
  {
    id: 'decor',
    label: 'Decor',
    icon: 'M5 4h14v12H5zM5 16l4-5 3 3 2-2 5 4M9 8h.01',
  },
];

export const CATALOG: CatalogItem[] = [
  // ── Living room ───────────────────────────────────────────────────────
  item({
    id: 'sofa-3',
    name: 'Three-seat sofa',
    category: 'living',
    tags: ['sofa', 'couch', 'seating', 'settee', 'lounge'],
    size: size(2.1, 0.9, 0.85),
    model: 'sofa',
    price: 899,
    finishes: fabricThenWood(),
    clearance: clear(0.6),
  }),
  item({
    id: 'sofa-2',
    name: 'Two-seat sofa',
    category: 'living',
    tags: ['sofa', 'loveseat', 'couch', 'seating'],
    size: size(1.55, 0.88, 0.85),
    model: 'sofa',
    price: 699,
    finishes: fabricThenWood(),
    clearance: clear(0.6),
  }),
  item({
    id: 'armchair',
    name: 'Armchair',
    category: 'living',
    tags: ['chair', 'seating', 'accent', 'lounge'],
    size: size(0.85, 0.85, 0.8),
    model: 'armchair',
    price: 349,
    finishes: fabricThenWood(),
    clearance: clear(0.5),
  }),
  item({
    id: 'coffee-table',
    name: 'Coffee table',
    category: 'living',
    tags: ['table', 'centre', 'living'],
    size: size(1.1, 0.6, 0.42),
    model: 'coffeeTable',
    price: 219,
    finishes: wood(),
    clearance: clear(0.35, 0.35, 0.35, 0.35),
  }),
  item({
    id: 'tv-unit',
    name: 'TV console',
    category: 'living',
    tags: ['tv', 'media', 'console', 'sideboard'],
    size: size(1.6, 0.4, 0.5),
    model: 'tvUnit',
    price: 329,
    finishes: wood(),
    clearance: clear(0.4),
  }),
  item({
    id: 'tv-screen',
    name: 'Wall TV (55")',
    category: 'living',
    tags: ['tv', 'screen', 'media', 'wall'],
    size: size(1.23, 0.07, 0.71),
    model: 'tvScreen',
    price: 549,
    finishes: METAL_FINISHES,
    elevation: 1.0,
    wallMounted: true,
    collides: false,
    scaleRange: [0.7, 1.3],
  }),
  item({
    id: 'bookshelf',
    name: 'Bookshelf',
    category: 'living',
    tags: ['shelf', 'storage', 'books', 'shelving'],
    size: size(0.8, 0.3, 1.8),
    model: 'bookshelf',
    price: 259,
    finishes: wood(),
    clearance: clear(0.7),
  }),
  item({
    id: 'rug-large',
    name: 'Area rug',
    category: 'living',
    tags: ['rug', 'carpet', 'floor', 'textile'],
    size: size(2.4, 1.7, 0.015),
    model: 'rug',
    price: 189,
    finishes: TEXTILE_FINISHES,
    collides: false,
    scaleRange: [0.5, 1.6],
  }),
  item({
    id: 'floor-lamp',
    name: 'Floor lamp',
    category: 'living',
    tags: ['lamp', 'light', 'lighting'],
    size: size(0.4, 0.4, 1.6),
    model: 'floorLamp',
    price: 129,
    finishes: METAL_FINISHES,
    isLight: true,
    lightOffset: { x: 0, y: 1.45, z: 0 },
    lightColor: '#ffe5b4',
    lightIntensity: 1.8,
  }),
  item({
    id: 'plant',
    name: 'Potted plant',
    category: 'decor',
    tags: ['plant', 'green', 'pot', 'decor'],
    size: size(0.55, 0.55, 1.2),
    model: 'plant',
    price: 69,
    finishes: CERAMIC_FINISHES,
    scaleRange: [0.6, 1.4],
  }),

  // ── Bedroom ───────────────────────────────────────────────────────────
  item({
    id: 'bed-single',
    name: 'Single bed',
    category: 'bedroom',
    tags: ['bed', 'single', 'sleep', 'mattress'],
    size: size(0.9, 2.0, 0.55),
    model: 'bed',
    price: 399,
    finishes: fabricThenWood(),
    clearance: clear(0.6, 0, 0.55, 0.55),
  }),
  item({
    id: 'bed-double',
    name: 'Double bed',
    category: 'bedroom',
    tags: ['bed', 'double', 'sleep', 'mattress'],
    size: size(1.4, 2.0, 0.55),
    model: 'bed',
    price: 599,
    finishes: fabricThenWood(),
    clearance: clear(0.7, 0, 0.6, 0.6),
  }),
  item({
    id: 'bed-queen',
    name: 'Queen bed',
    category: 'bedroom',
    tags: ['bed', 'queen', 'sleep', 'mattress'],
    size: size(1.6, 2.1, 0.55),
    model: 'bed',
    price: 749,
    finishes: fabricThenWood(),
    clearance: clear(0.7, 0, 0.6, 0.6),
  }),
  item({
    id: 'bed-king',
    name: 'King bed',
    category: 'bedroom',
    tags: ['bed', 'king', 'sleep', 'mattress'],
    size: size(1.8, 2.1, 0.55),
    model: 'bed',
    price: 899,
    finishes: fabricThenWood(),
    clearance: clear(0.7, 0, 0.6, 0.6),
  }),
  item({
    id: 'nightstand',
    name: 'Nightstand',
    category: 'bedroom',
    tags: ['bedside', 'table', 'drawer', 'storage'],
    size: size(0.45, 0.4, 0.55),
    model: 'nightstand',
    price: 99,
    finishes: wood(),
    clearance: clear(0.4),
  }),
  item({
    id: 'wardrobe-2',
    name: 'Wardrobe (2-door)',
    category: 'storage',
    tags: ['wardrobe', 'closet', 'storage', 'almirah', 'cupboard'],
    size: size(1.0, 0.6, 2.1),
    model: 'wardrobe',
    price: 649,
    finishes: wood(),
    clearance: clear(0.75),
    // Wardrobes are the item people most often want custom-sized.
    scaleRange: [0.6, 2.0],
  }),
  item({
    id: 'wardrobe-3',
    name: 'Wardrobe (3-door)',
    category: 'storage',
    tags: ['wardrobe', 'closet', 'storage', 'almirah', 'cupboard'],
    size: size(1.5, 0.6, 2.1),
    model: 'wardrobe',
    price: 899,
    finishes: wood(),
    clearance: clear(0.75),
    scaleRange: [0.6, 1.8],
  }),
  item({
    id: 'dressing-table',
    name: 'Dressing table',
    category: 'bedroom',
    tags: ['dresser', 'vanity', 'mirror', 'makeup'],
    size: size(1.1, 0.45, 1.5),
    model: 'dresser',
    price: 379,
    finishes: wood(),
    clearance: clear(0.7),
  }),
  item({
    id: 'chest-drawers',
    name: 'Chest of drawers',
    category: 'storage',
    tags: ['drawers', 'storage', 'dresser', 'chest'],
    size: size(0.8, 0.45, 0.9),
    model: 'nightstand',
    price: 279,
    finishes: wood(),
    clearance: clear(0.65),
  }),
  item({
    id: 'mirror-wall',
    name: 'Wall mirror',
    category: 'decor',
    tags: ['mirror', 'wall', 'decor'],
    size: size(0.6, 0.04, 1.4),
    model: 'mirror',
    price: 149,
    finishes: METAL_FINISHES,
    elevation: 0.7,
    wallMounted: true,
    collides: false,
  }),

  // ── Dining ────────────────────────────────────────────────────────────
  item({
    id: 'dining-table-4',
    name: 'Dining table (4)',
    category: 'dining',
    tags: ['table', 'dining', 'eat', 'four'],
    size: size(1.4, 0.85, 0.75),
    model: 'diningTable',
    price: 549,
    finishes: wood(),
    // Chairs need to pull out on every side.
    clearance: clear(0.75, 0.75, 0.75, 0.75),
  }),
  item({
    id: 'dining-table-6',
    name: 'Dining table (6)',
    category: 'dining',
    tags: ['table', 'dining', 'eat', 'six'],
    size: size(1.8, 0.9, 0.75),
    model: 'diningTable',
    price: 749,
    finishes: wood(),
    clearance: clear(0.75, 0.75, 0.75, 0.75),
  }),
  item({
    id: 'dining-chair',
    name: 'Dining chair',
    category: 'dining',
    tags: ['chair', 'seat', 'dining'],
    size: size(0.45, 0.5, 0.9),
    model: 'diningChair',
    price: 89,
    finishes: wood(),
    clearance: clear(0.3),
  }),
  item({
    id: 'sideboard',
    name: 'Sideboard',
    category: 'dining',
    tags: ['sideboard', 'buffet', 'storage', 'cabinet'],
    size: size(1.4, 0.42, 0.8),
    model: 'sideboard',
    price: 459,
    finishes: wood(),
    clearance: clear(0.7),
  }),

  // ── Kitchen / utility ─────────────────────────────────────────────────
  item({
    id: 'fridge',
    name: 'Refrigerator',
    category: 'kitchen',
    tags: ['fridge', 'freezer', 'appliance', 'refrigerator', 'friz'],
    size: size(0.7, 0.7, 1.8),
    model: 'fridge',
    price: 899,
    finishes: APPLIANCE_FINISHES,
    clearance: clear(0.9),
  }),
  item({
    id: 'washing-machine',
    name: 'Washing machine',
    category: 'kitchen',
    tags: ['washer', 'laundry', 'appliance', 'washing'],
    size: size(0.6, 0.6, 0.85),
    model: 'washingMachine',
    price: 499,
    finishes: APPLIANCE_FINISHES,
    clearance: clear(0.9),
  }),
  item({
    id: 'kitchen-counter',
    name: 'Base cabinet run',
    category: 'kitchen',
    tags: ['counter', 'worktop', 'cabinet', 'kitchen'],
    size: size(1.2, 0.6, 0.9),
    model: 'counter',
    price: 429,
    finishes: wood(),
    clearance: clear(0.9),
    scaleRange: [0.5, 2.5],
  }),
  item({
    id: 'kitchen-sink',
    name: 'Sink unit',
    category: 'kitchen',
    tags: ['sink', 'wash', 'kitchen', 'basin'],
    size: size(0.9, 0.6, 0.9),
    model: 'sink',
    price: 389,
    finishes: APPLIANCE_FINISHES,
    clearance: clear(0.9),
  }),
  item({
    id: 'stove',
    name: 'Cooker',
    category: 'kitchen',
    tags: ['stove', 'oven', 'cooker', 'hob', 'range'],
    size: size(0.6, 0.6, 0.9),
    model: 'stove',
    price: 649,
    finishes: APPLIANCE_FINISHES,
    clearance: clear(0.9),
  }),

  // ── Office ────────────────────────────────────────────────────────────
  item({
    id: 'desk',
    name: 'Writing desk',
    category: 'office',
    tags: ['desk', 'work', 'study', 'table'],
    size: size(1.4, 0.7, 0.75),
    model: 'desk',
    price: 359,
    finishes: wood(),
    clearance: clear(0.8),
  }),
  item({
    id: 'gaming-table',
    name: 'Gaming desk',
    category: 'office',
    tags: ['gaming', 'desk', 'computer', 'setup', 'table'],
    size: size(1.6, 0.8, 0.75),
    model: 'desk',
    price: 449,
    finishes: METAL_FINISHES,
    clearance: clear(0.85),
  }),
  item({
    id: 'office-chair',
    name: 'Office chair',
    category: 'office',
    tags: ['chair', 'desk', 'swivel', 'task'],
    size: size(0.65, 0.65, 1.1),
    model: 'officeChair',
    price: 249,
    finishes: METAL_FINISHES,
    clearance: clear(0.3, 0.3, 0.2, 0.2),
  }),
  item({
    id: 'filing-cabinet',
    name: 'Filing cabinet',
    category: 'office',
    tags: ['cabinet', 'storage', 'files', 'drawers'],
    size: size(0.45, 0.6, 1.32),
    model: 'filingCabinet',
    price: 219,
    finishes: METAL_FINISHES,
    clearance: clear(0.7),
  }),
  item({
    id: 'monitor',
    name: 'Monitor',
    category: 'office',
    tags: ['monitor', 'screen', 'display', 'computer'],
    size: size(0.62, 0.2, 0.45),
    model: 'monitor',
    price: 279,
    finishes: METAL_FINISHES,
    // Sits on a 750 mm desk.
    elevation: 0.75,
    collides: false,
  }),
  item({
    id: 'desk-lamp',
    name: 'Task desk lamp',
    category: 'office',
    tags: ['lamp', 'light', 'desk', 'work', 'study'],
    size: size(0.28, 0.28, 0.46),
    model: 'deskLamp',
    price: 79,
    finishes: METAL_FINISHES,
    elevation: 0.75,
    collides: false,
    isLight: true,
    lightOffset: { x: 0.08, y: 0.4, z: 0.08 },
    lightColor: '#fff3d6',
    lightIntensity: 1.5,
  }),

  // ── Bathroom ──────────────────────────────────────────────────────────
  item({
    id: 'toilet',
    name: 'Toilet (high commode)',
    category: 'bathroom',
    tags: ['toilet', 'wc', 'commode', 'high', 'bathroom'],
    size: size(0.38, 0.7, 0.78),
    model: 'toilet',
    price: 289,
    finishes: CERAMIC_FINISHES,
    clearance: clear(0.6, 0, 0.2, 0.2),
  }),
  item({
    id: 'squat-pan',
    name: 'Squat pan (low commode)',
    category: 'bathroom',
    tags: ['toilet', 'squat', 'commode', 'low', 'bathroom'],
    size: size(0.6, 0.75, 0.08),
    model: 'squatToilet',
    price: 119,
    finishes: CERAMIC_FINISHES,
    clearance: clear(0.5),
    collides: false,
  }),
  item({
    id: 'basin',
    name: 'Wash basin',
    category: 'bathroom',
    tags: ['basin', 'sink', 'wash', 'vanity', 'bathroom'],
    size: size(0.55, 0.45, 0.85),
    model: 'basin',
    price: 199,
    finishes: CERAMIC_FINISHES,
    clearance: clear(0.7),
  }),
  item({
    id: 'shower',
    name: 'Shower tray',
    category: 'bathroom',
    tags: ['shower', 'bathroom', 'wash', 'cubicle'],
    size: size(0.9, 0.9, 0.15),
    model: 'showerTray',
    price: 349,
    finishes: CERAMIC_FINISHES,
    clearance: clear(0.6),
    collides: false,
  }),
  item({
    id: 'bathtub',
    name: 'Bathtub',
    category: 'bathroom',
    tags: ['bath', 'tub', 'bathroom', 'soak'],
    size: size(1.7, 0.75, 0.55),
    model: 'bathtub',
    price: 599,
    finishes: CERAMIC_FINISHES,
    clearance: clear(0.7),
  }),
  item({
    id: 'towel-rail',
    name: 'Towel rail',
    category: 'bathroom',
    tags: ['towel', 'rail', 'radiator', 'bathroom'],
    size: size(0.6, 0.12, 0.8),
    model: 'towelRail',
    price: 89,
    finishes: METAL_FINISHES,
    elevation: 0.9,
    wallMounted: true,
    collides: false,
  }),

  // ── Outdoor ───────────────────────────────────────────────────────────
  item({
    id: 'patio-table',
    name: 'Patio table',
    category: 'outdoor',
    tags: ['patio', 'garden', 'table', 'outdoor'],
    size: size(1.2, 0.75, 0.74),
    model: 'patioTable',
    price: 299,
    finishes: wood(),
    clearance: clear(0.7, 0.7, 0.7, 0.7),
  }),
  item({
    id: 'patio-chair',
    name: 'Patio chair',
    category: 'outdoor',
    tags: ['patio', 'garden', 'chair', 'outdoor'],
    size: size(0.55, 0.58, 0.88),
    model: 'patioChair',
    price: 119,
    finishes: wood(),
    clearance: clear(0.3),
  }),
  item({
    id: 'parasol',
    name: 'Parasol',
    category: 'outdoor',
    tags: ['umbrella', 'parasol', 'shade', 'garden'],
    size: size(2.4, 2.4, 2.3),
    model: 'parasol',
    price: 179,
    finishes: TEXTILE_FINISHES,
    collides: false,
  }),

  // ── Decor ─────────────────────────────────────────────────────────────
  item({
    id: 'pendant-lamp',
    name: 'Pendant ceiling light',
    category: 'decor',
    tags: ['lamp', 'light', 'ceiling', 'pendant', 'chandelier', 'fixture'],
    size: size(0.45, 0.45, 0.65),
    model: 'pendantLamp',
    price: 189,
    finishes: METAL_FINISHES,
    elevation: 1.95,
    collides: false,
    isLight: true,
    lightOffset: { x: 0, y: -0.15, z: 0 },
    lightColor: '#ffeaad',
    lightIntensity: 2.2,
  }),
  item({
    id: 'wall-sconce',
    name: 'Wall sconce light',
    category: 'decor',
    tags: ['lamp', 'light', 'sconce', 'wall', 'fixture'],
    size: size(0.14, 0.16, 0.38),
    model: 'wallSconce',
    price: 95,
    finishes: METAL_FINISHES,
    elevation: 1.6,
    wallMounted: true,
    collides: false,
    isLight: true,
    lightOffset: { x: 0, y: 0.05, z: 0.08 },
    lightColor: '#ffddaa',
    lightIntensity: 1.6,
  }),
  item({
    id: 'plant',
    name: 'Potted indoor plant',
    category: 'decor',
    tags: ['plant', 'pot', 'flower', 'greenery', 'decor', 'nature'],
    size: size(0.45, 0.45, 0.85),
    model: 'plant',
    price: 65,
    finishes: CERAMIC_FINISHES,
    collides: true,
  }),
  item({
    id: 'rug-large',
    name: 'Woven area rug',
    category: 'decor',
    tags: ['rug', 'carpet', 'mat', 'floor', 'decor'],
    size: size(2.2, 1.5, 0.015),
    model: 'rug',
    price: 219,
    finishes: TEXTILE_FINISHES,
    collides: false,
  }),
  item({
    id: 'wall-mirror',
    name: 'Framed wall mirror',
    category: 'decor',
    tags: ['mirror', 'glass', 'wall', 'reflection', 'decor'],
    size: size(0.7, 0.05, 1.1),
    model: 'mirror',
    price: 129,
    finishes: METAL_FINISHES,
    elevation: 0.85,
    wallMounted: true,
    collides: false,
  }),
  item({
    id: 'wall-art',
    name: 'Framed art',
    category: 'decor',
    tags: ['art', 'picture', 'frame', 'wall', 'decor'],
    size: size(0.8, 0.04, 0.6),
    model: 'wallArt',
    price: 79,
    finishes: WOOD_FINISHES,
    elevation: 1.45,
    wallMounted: true,
    collides: false,
  }),
];

const BY_ID = new Map(CATALOG.map((c) => [c.id, c]));

export function getCatalogItem(id: string): CatalogItem | undefined {
  return BY_ID.get(id);
}

export function registerCustomCatalogItem(newItem: CatalogItem): void {
  BY_ID.set(newItem.id, newItem);
  if (!CATALOG.some((c) => c.id === newItem.id)) {
    CATALOG.unshift(newItem);
  }
}

/**
 * Resolves a catalog item, falling back to a neutral placeholder when the id is
 * unknown (an old share link, a hand-edited JSON import). Returning a
 * placeholder rather than throwing is what keeps one bad reference from taking
 * down the whole scene.
 */
export function resolveCatalogItem(id: string): CatalogItem {
  return BY_ID.get(id) ?? PLACEHOLDER_ITEM;
}

export const PLACEHOLDER_ITEM: CatalogItem = item({
  id: '__placeholder__',
  name: 'Unknown item',
  category: 'decor',
  tags: [],
  size: size(0.6, 0.6, 0.6),
  model: 'nightstand',
  price: 0,
  finishes: [
    { id: 'unknown', name: 'Unresolved', color: '#a1a1aa', roughness: 0.9, metalness: 0 },
  ],
  availability: 'custom',
});

/** Case- and tag-aware search used by the catalog sidebar. */
export function searchCatalog(query: string, category: Category | 'all'): CatalogItem[] {
  const q = query.trim().toLowerCase();
  return CATALOG.filter((c) => {
    if (category !== 'all' && c.category !== category) return false;
    if (q === '') return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.tags.some((t) => t.includes(q)) ||
      c.category.includes(q)
    );
  });
}

/** Starter layouts offered on the dashboard. */
export interface RoomTemplate {
  id: string;
  name: string;
  description: string;
  width: number;
  length: number;
  height: number;
  /** Catalog id + placement, in metres/degrees. */
  furniture: Array<{ catalogId: string; x: number; z: number; rotation: number }>;
}

export const ROOM_TEMPLATES: RoomTemplate[] = [
  {
    id: 'blank',
    name: 'Empty room',
    description: 'Start from bare walls and place everything yourself.',
    width: 4.2,
    length: 5.0,
    height: 2.6,
    furniture: [],
  },
  {
    id: 'living',
    name: 'Living room',
    description: 'Sofa, armchair, coffee table, media wall and a rug.',
    width: 4.6,
    length: 5.4,
    height: 2.7,
    furniture: [
      { catalogId: 'rug-large', x: 0, z: 0.1, rotation: 0 },
      { catalogId: 'sofa-3', x: 0, z: 2.05, rotation: 180 },
      { catalogId: 'armchair', x: -1.75, z: 0.1, rotation: 90 },
      { catalogId: 'coffee-table', x: 0, z: 0.6, rotation: 0 },
      { catalogId: 'tv-unit', x: 0, z: -2.5, rotation: 0 },
      { catalogId: 'tv-screen', x: 0, z: -2.7, rotation: 0 },
      { catalogId: 'bookshelf', x: 1.9, z: -1.2, rotation: 270 },
      { catalogId: 'plant', x: -1.95, z: -2.15, rotation: 0 },
    ],
  },
  {
    id: 'bedroom',
    name: 'Bedroom',
    description: 'Double bed, nightstands, wardrobe and a dressing table.',
    width: 3.8,
    length: 4.4,
    height: 2.6,
    furniture: [
      { catalogId: 'bed-double', x: 0, z: -1.1, rotation: 0 },
      { catalogId: 'nightstand', x: -0.95, z: -1.98, rotation: 0 },
      { catalogId: 'nightstand', x: 0.95, z: -1.98, rotation: 0 },
      { catalogId: 'wardrobe-3', x: -1.15, z: 1.9, rotation: 180 },
      { catalogId: 'dressing-table', x: 1.68, z: 0.4, rotation: 270 },
    ],
  },
  {
    id: 'studio',
    name: 'Studio flat',
    description: 'Bed, kitchen run, dining set and seating in one space.',
    width: 5.2,
    length: 6.4,
    height: 2.7,
    furniture: [
      { catalogId: 'bed-double', x: -1.6, z: -2.15, rotation: 0 },
      { catalogId: 'nightstand', x: -0.45, z: -2.9, rotation: 0 },
      { catalogId: 'wardrobe-2', x: 2.0, z: -2.7, rotation: 0 },
      { catalogId: 'kitchen-counter', x: -1.9, z: 2.9, rotation: 180 },
      { catalogId: 'kitchen-sink', x: -0.55, z: 2.9, rotation: 180 },
      { catalogId: 'stove', x: 0.35, z: 2.9, rotation: 180 },
      { catalogId: 'fridge', x: 1.3, z: 2.85, rotation: 180 },
      { catalogId: 'dining-table-4', x: 1.2, z: 0.6, rotation: 0 },
      { catalogId: 'dining-chair', x: 1.2, z: 1.35, rotation: 0 },
      { catalogId: 'dining-chair', x: 1.2, z: -0.15, rotation: 180 },
      { catalogId: 'sofa-2', x: -1.6, z: 0.4, rotation: 90 },
    ],
  },
  {
    id: 'office',
    name: 'Home office',
    description: 'Desk, task chair, storage and shelving.',
    width: 3.4,
    length: 3.8,
    height: 2.6,
    furniture: [
      { catalogId: 'desk', x: 0, z: -1.5, rotation: 0 },
      { catalogId: 'monitor', x: 0, z: -1.6, rotation: 0 },
      { catalogId: 'office-chair', x: 0, z: -0.75, rotation: 180 },
      { catalogId: 'bookshelf', x: -1.45, z: 0.9, rotation: 90 },
      { catalogId: 'filing-cabinet', x: 1.4, z: -1.35, rotation: 270 },
      { catalogId: 'plant', x: 1.35, z: 1.4, rotation: 0 },
    ],
  },
  {
    id: 'bathroom',
    name: 'Bathroom',
    description: 'Basin, WC, shower and towel rail in a compact footprint.',
    width: 2.2,
    length: 2.8,
    height: 2.5,
    furniture: [
      { catalogId: 'basin', x: -0.75, z: -1.15, rotation: 0 },
      { catalogId: 'toilet', x: 0.6, z: -1.0, rotation: 0 },
      { catalogId: 'shower', x: 0.6, z: 0.9, rotation: 0 },
      { catalogId: 'towel-rail', x: -1.05, z: 0.5, rotation: 90 },
    ],
  },
];
