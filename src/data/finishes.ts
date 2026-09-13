import type { FinishOption } from '@/types';

/**
 * Shared material palettes.
 *
 * Finishes are defined once and referenced by several catalog items so that a
 * "Walnut" sofa leg and a "Walnut" bookshelf are literally the same colour —
 * consistency here is what stops a rendered room looking like a sample book.
 */

const wood = (id: string, name: string, color: string): FinishOption => ({
  id,
  name,
  color,
  roughness: 0.62,
  metalness: 0.0,
});

const fabric = (id: string, name: string, color: string): FinishOption => ({
  id,
  name,
  color,
  roughness: 0.92,
  metalness: 0.0,
});

const painted = (id: string, name: string, color: string): FinishOption => ({
  id,
  name,
  color,
  roughness: 0.45,
  metalness: 0.02,
});

export const WOOD_FINISHES: FinishOption[] = [
  wood('oak', 'Oak', '#c69c6d'),
  wood('walnut', 'Walnut', '#6b4a32'),
  wood('ash', 'Pale ash', '#dcc7a8'),
  wood('ebony', 'Ebony', '#3a3230'),
  painted('white', 'White', '#f2f1ec'),
  painted('sage', 'Sage', '#a3b18a'),
];

export const FABRIC_FINISHES: FinishOption[] = [
  fabric('sage', 'Sage linen', '#a3b18a'),
  fabric('moss', 'Moss', '#588157'),
  fabric('forest', 'Forest', '#3a5a40'),
  fabric('sand', 'Sand', '#dad7cd'),
  fabric('charcoal', 'Charcoal', '#3f3f46'),
  fabric('clay', 'Clay', '#b07d62'),
  fabric('navy', 'Navy', '#2f4058'),
];

export const APPLIANCE_FINISHES: FinishOption[] = [
  { id: 'steel', name: 'Brushed steel', color: '#b6bbc0', roughness: 0.32, metalness: 0.72 },
  { id: 'graphite', name: 'Graphite', color: '#4a4d52', roughness: 0.38, metalness: 0.5 },
  { id: 'white', name: 'White', color: '#f0f0ee', roughness: 0.4, metalness: 0.08 },
];

export const CERAMIC_FINISHES: FinishOption[] = [
  { id: 'white', name: 'Gloss white', color: '#f6f7f5', roughness: 0.12, metalness: 0.04 },
  { id: 'bone', name: 'Bone', color: '#e8e2d6', roughness: 0.16, metalness: 0.04 },
  { id: 'slate', name: 'Slate', color: '#8a9199', roughness: 0.2, metalness: 0.06 },
];

export const METAL_FINISHES: FinishOption[] = [
  { id: 'black', name: 'Matte black', color: '#2b2b2e', roughness: 0.5, metalness: 0.45 },
  { id: 'chrome', name: 'Chrome', color: '#c9ced4', roughness: 0.18, metalness: 0.88 },
  { id: 'brass', name: 'Brass', color: '#b08d4f', roughness: 0.3, metalness: 0.8 },
];

export const TEXTILE_FINISHES: FinishOption[] = [
  fabric('sand', 'Sand', '#dad7cd'),
  fabric('sage', 'Sage', '#a3b18a'),
  fabric('forest', 'Forest', '#3a5a40'),
  fabric('charcoal', 'Charcoal', '#52525b'),
];

/** Wall paint options offered in the room panel. */
export const WALL_COLORS: Array<{ name: string; color: string }> = [
  { name: 'Chalk', color: '#f5f4f0' },
  { name: 'Bone', color: '#eae7de' },
  { name: 'Linen', color: '#dad7cd' },
  { name: 'Sage mist', color: '#c7d0bb' },
  { name: 'Olive', color: '#a3b18a' },
  { name: 'Deep forest', color: '#3a5a40' },
  { name: 'Warm grey', color: '#cfcbc4' },
  { name: 'Charcoal', color: '#4a4d52' },
];

export interface WallPatternInfo {
  id: 'plain' | 'brick' | 'panels' | 'subway' | 'stripes' | 'concrete';
  name: string;
  description: string;
}

export const WALL_PATTERNS: WallPatternInfo[] = [
  { id: 'plain', name: 'Plaster', description: 'Smooth interior wall paint' },
  { id: 'brick', name: 'Brick', description: 'Exposed staggered brickwork' },
  { id: 'panels', name: 'Slats', description: 'Vertical acoustic wood panels' },
  { id: 'subway', name: 'Tile', description: 'Ceramic subway wall tile' },
  { id: 'stripes', name: 'Stripes', description: 'Pinstripe designer wallpaper' },
  { id: 'concrete', name: 'Concrete', description: 'Industrial architectural concrete' },
];

/** Floor finishes: colour plus the procedural pattern drawn into the texture. */
export const FLOOR_PRESETS: Array<{
  name: string;
  color: string;
  pattern: 'plain' | 'planks' | 'tiles' | 'herringbone';
}> = [
  { name: 'Oak planks', color: '#c69c6d', pattern: 'planks' },
  { name: 'Walnut planks', color: '#8a5f42', pattern: 'planks' },
  { name: 'Pale ash', color: '#ddc9ab', pattern: 'planks' },
  { name: 'Herringbone oak', color: '#c9a578', pattern: 'herringbone' },
  { name: 'Stone tile', color: '#cfcdc7', pattern: 'tiles' },
  { name: 'Slate tile', color: '#8d9298', pattern: 'tiles' },
  { name: 'Concrete', color: '#c4c2bd', pattern: 'plain' },
  { name: 'Sage carpet', color: '#9aa88b', pattern: 'plain' },
];

/** Free-form swatches offered alongside a finish, for quick recolouring. */
export const QUICK_SWATCHES: string[] = [
  '#dad7cd',
  '#a3b18a',
  '#588157',
  '#3a5a40',
  '#344e41',
  '#c69c6d',
  '#6b4a32',
  '#f2f1ec',
  '#3f3f46',
  '#b07d62',
  '#2f4058',
  '#b6bbc0',
];
