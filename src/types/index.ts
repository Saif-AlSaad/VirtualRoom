/**
 * Domain types for RoomCraft.
 *
 * UNIT CONTRACT — read this before touching geometry anywhere in the app:
 * every stored length is in METRES. `Project.unit` is a *display* preference
 * only; conversion happens at the UI boundary (see `utils/units.ts`). No other
 * module may store or reason about feet.
 *
 * COORDINATE CONTRACT: the room is centred on the world origin. The floor is
 * the XZ plane at y = 0, +Y is up. A room of width w and length l therefore
 * spans x ∈ [-w/2, w/2] and z ∈ [-l/2, l/2].
 */

/** Bumped whenever the persisted shape changes; drives migration on load. */
export const SCHEMA_VERSION = 1;

export type Unit = 'm' | 'ft';

export type Vec2 = { x: number; z: number };
export type Vec3 = { x: number; y: number; z: number };

/** Footprint of an object on the floor plane. */
export type Size3 = { w: number; d: number; h: number };

export type WallSide = 'north' | 'south' | 'east' | 'west';

export type Category =
  | 'living'
  | 'bedroom'
  | 'dining'
  | 'office'
  | 'kitchen'
  | 'bathroom'
  | 'outdoor'
  | 'storage'
  | 'decor';

export type OpeningKind = 'door' | 'window';

/**
 * A door or window. Openings are always attached to a wall and positioned by
 * `offset`: the distance in metres along that wall from its start corner, to
 * the *centre* of the opening. This keeps them valid when a wall is resized —
 * we clamp offset rather than storing a free XZ position.
 */
export interface Opening {
  id: string;
  kind: OpeningKind;
  wall: WallSide;
  /** Distance along the wall (metres) to the opening centre. */
  offset: number;
  width: number;
  height: number;
  /** Height of the sill above the floor. Doors are 0. */
  sillHeight: number;
  /** Door only: which way the leaf swings. */
  hinge: 'left' | 'right';
  /** Door only: swings into the room or out of it. */
  swing: 'in' | 'out';
}

/** Named material/finish a catalog item can be rendered in. */
export interface FinishOption {
  id: string;
  name: string;
  /** Hex colour of the main body. */
  color: string;
  roughness: number;
  metalness: number;
}

/** Extra floor space an item needs to be usable (metres, per local side). */
export interface Clearance {
  front: number;
  back: number;
  left: number;
  right: number;
}

export type ModelKind =
  | 'sofa'
  | 'armchair'
  | 'coffeeTable'
  | 'tvUnit'
  | 'bookshelf'
  | 'rug'
  | 'floorLamp'
  | 'plant'
  | 'bed'
  | 'nightstand'
  | 'wardrobe'
  | 'dresser'
  | 'diningTable'
  | 'diningChair'
  | 'sideboard'
  | 'fridge'
  | 'washingMachine'
  | 'counter'
  | 'sink'
  | 'stove'
  | 'desk'
  | 'officeChair'
  | 'filingCabinet'
  | 'monitor'
  | 'toilet'
  | 'squatToilet'
  | 'basin'
  | 'showerTray'
  | 'bathtub'
  | 'towelRail'
  | 'patioTable'
  | 'patioChair'
  | 'parasol'
  | 'tvScreen'
  | 'mirror'
  | 'wallArt';

/** Immutable catalog definition. Never mutated by the editor. */
export interface CatalogItem {
  id: string;
  name: string;
  category: Category;
  tags: string[];
  /** Default real-world size in metres. */
  size: Size3;
  /** Which procedural mesh builder renders this item. */
  model: ModelKind;
  price: number;
  finishes: FinishOption[];
  clearance: Clearance;
  /** Metres above the floor the item sits (wall art, shelves, etc.). */
  elevation: number;
  /** True when the item must be mounted on a wall. */
  wallMounted: boolean;
  /**
   * False for flat items you are meant to put furniture on top of — rugs,
   * shower trays. They are still bounded by the room but never block placement.
   */
  collides: boolean;
  /** Multiplicative scale bounds, e.g. [0.8, 1.2]. */
  scaleRange: [number, number];
  availability: 'available' | 'discontinued' | 'custom';
  /** True when the item is a light source (lamp, ceiling fixture). */
  isLight?: boolean;
  /** Local offset of the light emitter from object center. */
  lightOffset?: Vec3;
  /** Hex light color (defaults to warm incandescent #ffeaad). */
  lightColor?: string;
  /** Point light intensity multiplier. */
  lightIntensity?: number;
}

/** A catalog item actually placed in a room. Mutable editor state. */
export interface FurnitureInstance {
  instanceId: string;
  catalogId: string;
  /** Centre of the footprint, on the floor plane. */
  position: Vec2;
  /** Rotation about +Y, in DEGREES, normalised to [0, 360). */
  rotation: number;
  /** Per-axis multiplier applied to the catalog size. */
  scale: Vec3;
  finishId: string;
  /** Overrides the finish colour when the user picks a custom swatch. */
  colorOverride: string | null;
  locked: boolean;
  visible: boolean;
  groupId: string | null;
  /** User-authored note pinned to this object. */
  note: string;
  /** Optional custom 3D model asset URL or data URI. */
  customModelUrl?: string | null;
}

export type WallPattern = 'plain' | 'brick' | 'panels' | 'subway' | 'stripes' | 'concrete';

export interface WallFinish {
  color: string;
  pattern?: WallPattern;
}

export interface FloorFinish {
  color: string;
  /** Procedural pattern drawn into the floor texture. */
  pattern: 'plain' | 'planks' | 'tiles' | 'herringbone';
}

export interface RoomDimensions {
  width: number;
  length: number;
  height: number;
  wallThickness: number;
}

export interface Room {
  dimensions: RoomDimensions;
  walls: WallFinish;
  floor: FloorFinish;
  openings: Opening[];
}

/** The full persisted document for one design. */
export interface Project {
  id: string;
  schemaVersion: number;
  name: string;
  unit: Unit;
  room: Room;
  furniture: FurnitureInstance[];
  createdAt: number;
  updatedAt: number;
}

/** The slice of a project that undo/redo snapshots. */
export interface DocumentState {
  name: string;
  unit: Unit;
  room: Room;
  furniture: FurnitureInstance[];
}

/** One entry in the undo stack — a labelled snapshot of the document. */
export interface HistoryEntry {
  label: string;
  doc: DocumentState;
}

export type IssueSeverity = 'error' | 'warning';

/** A placement problem surfaced to the user. Always carries an explanation. */
export interface PlacementIssue {
  instanceId: string;
  severity: IssueSeverity;
  code:
    | 'out-of-bounds'
    | 'overlap'
    | 'clearance'
    | 'blocks-door'
    | 'oversized'
    | 'not-on-wall';
  message: string;
  /** The other object involved, when there is one. */
  otherId?: string;
}

export type ViewMode = '3d' | '2d' | 'walk';

export type CameraPreset = 'corner' | 'front' | 'top' | 'left' | 'right';

export type TimeOfDay = 'day' | 'night';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  tone: 'info' | 'success' | 'error' | 'warning';
}

export type SaveStatus = 'saved' | 'saving' | 'failed' | 'offline';

/** Axis-aligned or oriented rectangle on the floor plane, used for collision. */
export interface Rect {
  cx: number;
  cz: number;
  w: number;
  d: number;
  /** Rotation in degrees. */
  rot: number;
}
