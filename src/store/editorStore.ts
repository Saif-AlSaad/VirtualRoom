import { create } from 'zustand';
import type {
  DocumentState,
  FurnitureInstance,
  HistoryEntry,
  Opening,
  OpeningKind,
  Project,
  RoomDimensions,
  SaveStatus,
  Unit,
  Vec2,
  WallPattern,
  WallSide,
  AlignMode,
  DistributeAxis,
} from '@/types';
import {
  calculateAlignedPositions,
  calculateDistributedPositions,
  calculateSnappedFacePositions,
} from '@/utils/alignment';
import { SCHEMA_VERSION } from '@/types';
import { createId, createProjectId } from '@/utils/id';
import { resolveCatalogItem } from '@/data/catalog';
import { normalizeAngle } from '@/utils/collision';
import { clampRectToRoom } from '@/utils/collision';
import {
  clampOpeningOffset,
  pointOnWall,
  wallFacingRotation,
  wallLength,
} from '@/utils/roomGeometry';
import { findFreeSpot, instanceRect } from '@/utils/placement';
import { createProject, defaultRoom } from '@/utils/schema';

/**
 * The editor store: one document, plus the history that makes it undoable.
 *
 * HISTORY MODEL — snapshots, not diffs.
 * Every mutation is wrapped by `commit(label, mutator)`, which pushes the
 * *previous* document onto the past stack and clears the future. Snapshots are
 * cheap here (a room with 100 objects is a few hundred kB of plain data) and
 * they make undo trivially correct, which matters far more than the memory.
 *
 * Continuous gestures — dragging, scrubbing a slider — must NOT push a snapshot
 * per frame or one drag would eat the entire history. Those use
 * `beginGesture(label)` / `endGesture()`: the snapshot is taken once at the
 * start, intermediate frames mutate freely via `mutateLive`, and the entry is
 * committed on release. That is what "group property changes into meaningful
 * undo operations" means in practice.
 *
 * State is split deliberately: this store holds only PERSISTED domain data plus
 * selection. Camera, panels and preferences live in `uiStore` so that changing
 * the view never dirties the document or lands in undo.
 */

const HISTORY_LIMIT = 60;

function cloneDoc(doc: DocumentState): DocumentState {
  return {
    name: doc.name,
    unit: doc.unit,
    room: {
      dimensions: { ...doc.room.dimensions },
      walls: { ...doc.room.walls },
      floor: { ...doc.room.floor },
      openings: doc.room.openings.map((o) => ({ ...o })),
    },
    furniture: doc.furniture.map((f) => ({
      ...f,
      position: { ...f.position },
      scale: { ...f.scale },
    })),
  };
}

export interface EditorState {
  projectId: string;
  createdAt: number;
  doc: DocumentState;

  past: HistoryEntry[];
  future: HistoryEntry[];
  /** Snapshot captured at the start of an in-progress gesture. */
  gesture: HistoryEntry | null;

  selection: string[];
  /** Set while a gesture is running, so the viewport can suppress heavy work. */
  interacting: boolean;

  saveStatus: SaveStatus;
  /** Incremented on every document change; the autosave hook watches it. */
  revision: number;
  lastSavedRevision: number;

  // ── lifecycle ─────────────────────────────────────────────────────────
  loadProject: (project: Project) => void;
  newProject: (name?: string, unit?: Unit) => void;
  toProject: () => Project;
  markSaved: (revision: number) => void;
  setSaveStatus: (status: SaveStatus) => void;

  // ── history ───────────────────────────────────────────────────────────
  commit: (label: string, mutator: (doc: DocumentState) => void) => void;
  beginGesture: (label: string) => void;
  mutateLive: (mutator: (doc: DocumentState) => void) => void;
  endGesture: () => void;
  cancelGesture: () => void;
  undo: () => string | null;
  redo: () => string | null;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // ── selection ─────────────────────────────────────────────────────────
  select: (id: string | null, additive?: boolean) => void;
  selectMany: (ids: string[]) => void;
  selectAll: () => void;
  clearSelection: () => void;
  isSelected: (id: string) => boolean;

  // ── document edits ────────────────────────────────────────────────────
  rename: (name: string) => void;
  setUnit: (unit: Unit) => void;
  setRoomDimensions: (dims: Partial<RoomDimensions>) => void;
  resizeRoomLive: (dims: Partial<RoomDimensions>) => void;
  setWallColor: (color: string) => void;
  setWallPattern: (pattern: WallPattern) => void;
  setFloor: (floor: { color?: string; pattern?: DocumentState['room']['floor']['pattern'] }) => void;

  addOpening: (kind: OpeningKind, wall: WallSide) => string;
  updateOpening: (id: string, patch: Partial<Opening>, live?: boolean) => void;
  removeOpening: (id: string) => void;

  addFurniture: (
    catalogId: string,
    at?: Vec2,
    rotation?: number,
    customModelUrl?: string | null
  ) => string | null;
  updateFurniture: (
    id: string,
    patch: Partial<FurnitureInstance>,
    live?: boolean
  ) => void;
  moveSelection: (delta: Vec2) => void;
  rotateSelection: (deltaDegrees: number) => void;
  duplicateSelection: () => string[];
  deleteSelection: () => void;
  setLocked: (ids: string[], locked: boolean) => void;
  setVisible: (ids: string[], visible: boolean) => void;
  groupSelection: () => void;
  ungroupSelection: () => void;
  alignSelection: (mode: AlignMode) => void;
  distributeSelection: (axis?: DistributeAxis) => void;
  snapSelectionToFace: (axis?: DistributeAxis) => void;
  clearFurniture: () => void;
  applyTemplateFurniture: (
    items: Array<{ catalogId: string; x: number; z: number; rotation: number }>
  ) => void;
}

function emptyDoc(name: string, unit: Unit): DocumentState {
  return { name, unit, room: defaultRoom(), furniture: [] };
}

/** Clamps every opening and every object back inside a resized room. */
function reflowToRoom(doc: DocumentState): void {
  const dims = doc.room.dimensions;
  for (const o of doc.room.openings) {
    const len = wallLength(o.wall, dims);
    o.width = Math.min(o.width, len);
    o.height = Math.min(o.height, dims.height);
    o.sillHeight = Math.min(o.sillHeight, Math.max(0, dims.height - o.height));
    o.offset = clampOpeningOffset(o.offset, o.width, o.wall, dims);
  }
  for (const f of doc.furniture) {
    const next = clampRectToRoom(instanceRect(f), dims.width, dims.length);
    f.position.x = next.x;
    f.position.z = next.z;
  }
}

export const useEditor = create<EditorState>((set, get) => ({
  projectId: createProjectId(),
  createdAt: Date.now(),
  doc: emptyDoc('Untitled room', 'm'),
  past: [],
  future: [],
  gesture: null,
  selection: [],
  interacting: false,
  saveStatus: 'saved',
  revision: 0,
  lastSavedRevision: 0,

  // ── lifecycle ───────────────────────────────────────────────────────────
  loadProject: (project) =>
    set({
      projectId: project.id,
      createdAt: project.createdAt,
      doc: {
        name: project.name,
        unit: project.unit,
        room: project.room,
        furniture: project.furniture,
      },
      past: [],
      future: [],
      gesture: null,
      selection: [],
      revision: 0,
      lastSavedRevision: 0,
      saveStatus: 'saved',
    }),

  newProject: (name = 'Untitled room', unit = 'm') => {
    const project = createProject(name, unit);
    get().loadProject(project);
  },

  toProject: () => {
    const { projectId, createdAt, doc } = get();
    return {
      id: projectId,
      schemaVersion: SCHEMA_VERSION,
      name: doc.name,
      unit: doc.unit,
      room: doc.room,
      furniture: doc.furniture,
      createdAt,
      updatedAt: Date.now(),
    };
  },

  markSaved: (revision) =>
    set((s) => ({
      lastSavedRevision: revision,
      // Only report "saved" if nothing changed while the write was in flight.
      saveStatus: s.revision === revision ? 'saved' : 'saving',
    })),

  setSaveStatus: (saveStatus) => set({ saveStatus }),

  // ── history ─────────────────────────────────────────────────────────────
  commit: (label, mutator) =>
    set((s) => {
      const snapshot = cloneDoc(s.doc);
      const next = cloneDoc(s.doc);
      mutator(next);
      const past = [...s.past, { label, doc: snapshot }].slice(-HISTORY_LIMIT);
      return {
        doc: next,
        past,
        future: [],
        revision: s.revision + 1,
        saveStatus: 'saving',
      };
    }),

  beginGesture: (label) =>
    set((s) => ({
      gesture: s.gesture ?? { label, doc: cloneDoc(s.doc) },
      interacting: true,
    })),

  /**
   * Mutates the live document without touching history. Only legal between
   * beginGesture and endGesture — otherwise the change would not be undoable.
   */
  mutateLive: (mutator) =>
    set((s) => {
      const next = cloneDoc(s.doc);
      mutator(next);
      return { doc: next, revision: s.revision + 1, saveStatus: 'saving' };
    }),

  endGesture: () =>
    set((s) => {
      if (!s.gesture) return { interacting: false };
      // A gesture that changed nothing (a click that did not move) must not
      // leave a no-op entry in the undo stack.
      const unchanged =
        JSON.stringify(s.gesture.doc) === JSON.stringify(s.doc);
      if (unchanged) return { gesture: null, interacting: false };
      return {
        past: [...s.past, s.gesture].slice(-HISTORY_LIMIT),
        future: [],
        gesture: null,
        interacting: false,
      };
    }),

  cancelGesture: () =>
    set((s) =>
      s.gesture
        ? { doc: s.gesture.doc, gesture: null, interacting: false, revision: s.revision + 1 }
        : { interacting: false }
    ),

  undo: () => {
    const { past, doc } = get();
    const entry = past[past.length - 1];
    if (!entry) return null;
    set((s) => ({
      doc: entry.doc,
      past: s.past.slice(0, -1),
      future: [...s.future, { label: entry.label, doc: cloneDoc(doc) }].slice(
        -HISTORY_LIMIT
      ),
      revision: s.revision + 1,
      saveStatus: 'saving',
      // Selection may reference objects that no longer exist after the undo.
      selection: s.selection.filter((id) =>
        entry.doc.furniture.some((f) => f.instanceId === id)
      ),
    }));
    return entry.label;
  },

  redo: () => {
    const { future, doc } = get();
    const entry = future[future.length - 1];
    if (!entry) return null;
    set((s) => ({
      doc: entry.doc,
      future: s.future.slice(0, -1),
      past: [...s.past, { label: entry.label, doc: cloneDoc(doc) }].slice(
        -HISTORY_LIMIT
      ),
      revision: s.revision + 1,
      saveStatus: 'saving',
      selection: s.selection.filter((id) =>
        entry.doc.furniture.some((f) => f.instanceId === id)
      ),
    }));
    return entry.label;
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  // ── selection ───────────────────────────────────────────────────────────
  select: (id, additive = false) =>
    set((s) => {
      if (id === null) return { selection: [] };
      if (!additive) return { selection: [id] };
      return s.selection.includes(id)
        ? { selection: s.selection.filter((x) => x !== id) }
        : { selection: [...s.selection, id] };
    }),

  selectMany: (ids) => set({ selection: [...new Set(ids)] }),

  selectAll: () =>
    set((s) => ({
      selection: s.doc.furniture.filter((f) => f.visible).map((f) => f.instanceId),
    })),

  clearSelection: () => set({ selection: [] }),

  isSelected: (id) => get().selection.includes(id),

  // ── document edits ──────────────────────────────────────────────────────
  rename: (name) =>
    get().commit('Rename room', (d) => {
      d.name = name.slice(0, 80);
    }),

  setUnit: (unit) =>
    get().commit('Change units', (d) => {
      // Display preference only — no stored geometry changes.
      d.unit = unit;
    }),

  setRoomDimensions: (dims) =>
    get().commit('Resize room', (d) => {
      Object.assign(d.room.dimensions, dims);
      reflowToRoom(d);
    }),

  resizeRoomLive: (dims) => {
    get().mutateLive((d) => {
      Object.assign(d.room.dimensions, dims);
      reflowToRoom(d);
    });
  },

  setWallColor: (color) =>
    get().commit('Change wall colour', (d) => {
      d.room.walls.color = color;
    }),

  setWallPattern: (pattern) =>
    get().commit('Change wall finish', (d) => {
      d.room.walls.pattern = pattern;
    }),

  setFloor: (floor) =>
    get().commit('Change flooring', (d) => {
      if (floor.color !== undefined) d.room.floor.color = floor.color;
      if (floor.pattern !== undefined) d.room.floor.pattern = floor.pattern;
    }),

  addOpening: (kind, wall) => {
    const id = createId('opn');
    get().commit(`Add ${kind}`, (d) => {
      const dims = d.room.dimensions;
      const width = kind === 'door' ? 0.9 : 1.2;
      const height = kind === 'door' ? Math.min(2.05, dims.height - 0.1) : 1.2;
      const sillHeight = kind === 'door' ? 0 : Math.min(0.9, dims.height - height);
      // Drop it in the middle of the wall, then nudge clear of anything already
      // there so two doors never land on top of each other.
      const len = wallLength(wall, dims);
      let offset = len / 2;
      const onWall = d.room.openings.filter((o) => o.wall === wall);
      let guard = 0;
      while (
        guard++ < 40 &&
        onWall.some((o) => Math.abs(o.offset - offset) < (o.width + width) / 2)
      ) {
        offset += (width + 0.15) * (guard % 2 === 0 ? 1 : -1) * Math.ceil(guard / 2);
        offset = clampOpeningOffset(offset, width, wall, dims);
      }
      d.room.openings.push({
        id,
        kind,
        wall,
        offset: clampOpeningOffset(offset, width, wall, dims),
        width,
        height,
        sillHeight,
        hinge: 'left',
        swing: 'in',
      });
    });
    return id;
  },

  updateOpening: (id, patch, live = false) => {
    const apply = (d: DocumentState) => {
      const opening = d.room.openings.find((o) => o.id === id);
      if (!opening) return;
      Object.assign(opening, patch);
      const dims = d.room.dimensions;
      const len = wallLength(opening.wall, dims);
      opening.width = Math.min(Math.max(opening.width, 0.2), len);
      opening.height = Math.min(Math.max(opening.height, 0.2), dims.height);
      if (opening.kind === 'door') opening.sillHeight = 0;
      opening.sillHeight = Math.min(
        Math.max(opening.sillHeight, 0),
        Math.max(0, dims.height - opening.height)
      );
      // The invariant: an opening is always fully on its wall.
      opening.offset = clampOpeningOffset(
        opening.offset,
        opening.width,
        opening.wall,
        dims
      );
    };
    if (live) get().mutateLive(apply);
    else get().commit('Edit opening', apply);
  },

  removeOpening: (id) =>
    get().commit('Delete opening', (d) => {
      d.room.openings = d.room.openings.filter((o) => o.id !== id);
    }),

  addFurniture: (catalogId, at, rotation, customModelUrl) => {
    const catalog = resolveCatalogItem(catalogId);
    if (catalog.id === '__placeholder__') return null;

    const state = get();
    const instanceId = createId('itm');
    const dims = state.doc.room.dimensions;

    // Wall-mounted items are meaningless floating in space — put them on the
    // nearest wall by default, facing into the room.
    let position: Vec2 = at ?? { x: 0, z: 0 };
    let rot = rotation ?? 0;
    if (catalog.wallMounted && !at) {
      position = pointOnWall('north', dims.width / 2, dims);
      position.z += catalog.size.d / 2;
      rot = wallFacingRotation('north');
    }

    const candidate: FurnitureInstance = {
      instanceId,
      catalogId,
      position,
      rotation: normalizeAngle(rot),
      scale: { x: 1, y: 1, z: 1 },
      finishId: catalog.finishes[0]?.id ?? 'default',
      colorOverride: null,
      locked: false,
      visible: true,
      groupId: null,
      note: '',
      customModelUrl: customModelUrl ?? null,
    };

    if (!catalog.wallMounted) {
      candidate.position = findFreeSpot(candidate, state.doc, position);
    }
    // Whatever the search returned, the object must end up inside the room.
    const clamped = clampRectToRoom(
      instanceRect(candidate, catalog),
      dims.width,
      dims.length
    );
    candidate.position = clamped;

    state.commit(`Add ${catalog.name.toLowerCase()}`, (d) => {
      d.furniture.push(candidate);
    });
    set({ selection: [instanceId] });
    return instanceId;
  },

  updateFurniture: (id, patch, live = false) => {
    const apply = (d: DocumentState) => {
      const target = d.furniture.find((f) => f.instanceId === id);
      if (!target || target.locked) return;
      Object.assign(target, patch);
      if (patch.rotation !== undefined) {
        target.rotation = normalizeAngle(target.rotation);
      }
      const catalog = resolveCatalogItem(target.catalogId);
      if (patch.scale) {
        const [min, max] = catalog.scaleRange;
        target.scale = {
          x: Math.min(Math.max(target.scale.x, min), max),
          y: Math.min(Math.max(target.scale.y, min), max),
          z: Math.min(Math.max(target.scale.z, min), max),
        };
      }
      const dims = d.room.dimensions;
      const clamped = clampRectToRoom(
        instanceRect(target, catalog),
        dims.width,
        dims.length
      );
      target.position = clamped;
    };
    if (live) get().mutateLive(apply);
    else get().commit('Edit item', apply);
  },

  moveSelection: (delta) => {
    const { selection } = get();
    if (selection.length === 0) return;
    get().commit('Move', (d) => {
      const dims = d.room.dimensions;
      for (const id of selection) {
        const f = d.furniture.find((x) => x.instanceId === id);
        if (!f || f.locked) continue;
        f.position = clampRectToRoom(
          {
            ...instanceRect(f),
            cx: f.position.x + delta.x,
            cz: f.position.z + delta.z,
          },
          dims.width,
          dims.length
        );
      }
    });
  },

  rotateSelection: (deltaDegrees) => {
    const { selection } = get();
    if (selection.length === 0) return;
    get().commit('Rotate', (d) => {
      const dims = d.room.dimensions;
      for (const id of selection) {
        const f = d.furniture.find((x) => x.instanceId === id);
        if (!f || f.locked) continue;
        f.rotation = normalizeAngle(f.rotation + deltaDegrees);
        // Rotating can push a corner through a wall; pull it back.
        f.position = clampRectToRoom(instanceRect(f), dims.width, dims.length);
      }
    });
  },

  duplicateSelection: () => {
    const { selection, doc } = get();
    if (selection.length === 0) return [];
    const newIds: string[] = [];
    const clones: FurnitureInstance[] = [];

    for (const id of selection) {
      const source = doc.furniture.find((f) => f.instanceId === id);
      if (!source) continue;
      const clone: FurnitureInstance = {
        ...source,
        instanceId: createId('itm'),
        position: { ...source.position },
        scale: { ...source.scale },
        locked: false,
      };
      // Offset the copy so it is visibly a second object, then find real space.
      const offsetGuess = {
        x: clone.position.x + 0.3,
        z: clone.position.z + 0.3,
      };
      clone.position = findFreeSpot(clone, { ...doc, furniture: [...doc.furniture, ...clones] }, offsetGuess);
      clones.push(clone);
      newIds.push(clone.instanceId);
    }
    if (clones.length === 0) return [];

    get().commit(clones.length > 1 ? 'Duplicate items' : 'Duplicate item', (d) => {
      d.furniture.push(...clones);
    });
    set({ selection: newIds });
    return newIds;
  },

  deleteSelection: () => {
    const { selection, doc } = get();
    if (selection.length === 0) return;
    const removable = selection.filter((id) => {
      const f = doc.furniture.find((x) => x.instanceId === id);
      return f && !f.locked;
    });
    if (removable.length === 0) return;
    const label = removable.length > 1 ? `Delete ${removable.length} items` : 'Delete item';
    get().commit(label, (d) => {
      d.furniture = d.furniture.filter((f) => !removable.includes(f.instanceId));
    });
    set({ selection: [] });
  },

  setLocked: (ids, locked) =>
    get().commit(locked ? 'Lock' : 'Unlock', (d) => {
      for (const f of d.furniture) {
        if (ids.includes(f.instanceId)) f.locked = locked;
      }
    }),

  setVisible: (ids, visible) =>
    get().commit(visible ? 'Show' : 'Hide', (d) => {
      for (const f of d.furniture) {
        if (ids.includes(f.instanceId)) f.visible = visible;
      }
    }),

  groupSelection: () => {
    const { selection } = get();
    if (selection.length < 2) return;
    const groupId = createId('grp');
    get().commit('Group items', (d) => {
      for (const f of d.furniture) {
        if (selection.includes(f.instanceId)) f.groupId = groupId;
      }
    });
  },

  ungroupSelection: () => {
    const { selection } = get();
    if (selection.length === 0) return;
    get().commit('Ungroup items', (d) => {
      for (const f of d.furniture) {
        if (selection.includes(f.instanceId)) f.groupId = null;
      }
    });
  },

  alignSelection: (mode) => {
    const { selection, doc } = get();
    if (selection.length <= 1) return;
    const selectedItems = doc.furniture.filter((f) => selection.includes(f.instanceId));
    const newPositions = calculateAlignedPositions(selectedItems, mode);
    if (newPositions.size === 0) return;

    get().commit(`Align items ${mode}`, (d) => {
      const dims = d.room.dimensions;
      for (const [id, pos] of newPositions.entries()) {
        const item = d.furniture.find((f) => f.instanceId === id);
        if (!item || item.locked) continue;
        const next = clampRectToRoom(
          { ...instanceRect(item), cx: pos.x, cz: pos.z },
          dims.width,
          dims.length
        );
        item.position.x = next.x;
        item.position.z = next.z;
      }
    });
  },

  distributeSelection: (axis = 'auto') => {
    const { selection, doc } = get();
    if (selection.length < 3) return;
    const selectedItems = doc.furniture.filter((f) => selection.includes(f.instanceId));
    const newPositions = calculateDistributedPositions(selectedItems, axis);
    if (newPositions.size === 0) return;

    get().commit('Distribute items', (d) => {
      const dims = d.room.dimensions;
      for (const [id, pos] of newPositions.entries()) {
        const item = d.furniture.find((f) => f.instanceId === id);
        if (!item || item.locked) continue;
        const next = clampRectToRoom(
          { ...instanceRect(item), cx: pos.x, cz: pos.z },
          dims.width,
          dims.length
        );
        item.position.x = next.x;
        item.position.z = next.z;
      }
    });
  },

  snapSelectionToFace: (axis = 'auto') => {
    const { selection, doc } = get();
    if (selection.length < 2) return;
    const selectedItems = doc.furniture.filter((f) => selection.includes(f.instanceId));
    const newPositions = calculateSnappedFacePositions(selectedItems, axis);
    if (newPositions.size === 0) return;

    get().commit('Snap items to face', (d) => {
      const dims = d.room.dimensions;
      for (const [id, pos] of newPositions.entries()) {
        const item = d.furniture.find((f) => f.instanceId === id);
        if (!item || item.locked) continue;
        const next = clampRectToRoom(
          { ...instanceRect(item), cx: pos.x, cz: pos.z },
          dims.width,
          dims.length
        );
        item.position.x = next.x;
        item.position.z = next.z;
      }
    });
  },

  clearFurniture: () =>
    set((s) => {
      const snapshot = cloneDoc(s.doc);
      const next = cloneDoc(s.doc);
      next.furniture = [];
      return {
        doc: next,
        past: [...s.past, { label: 'Clear all furniture', doc: snapshot }].slice(
          -HISTORY_LIMIT
        ),
        future: [],
        selection: [],
        revision: s.revision + 1,
        saveStatus: 'saving',
      };
    }),

  applyTemplateFurniture: (items) =>
    get().commit('Apply template', (d) => {
      for (const t of items) {
        const catalog = resolveCatalogItem(t.catalogId);
        if (catalog.id === '__placeholder__') continue;
        d.furniture.push({
          instanceId: createId('itm'),
          catalogId: t.catalogId,
          position: { x: t.x, z: t.z },
          rotation: normalizeAngle(t.rotation),
          scale: { x: 1, y: 1, z: 1 },
          finishId: catalog.finishes[0].id,
          colorOverride: null,
          locked: false,
          visible: true,
          groupId: null,
          note: '',
        });
      }
      reflowToRoom(d);
    }),
}));

// ── Derived selectors ──────────────────────────────────────────────────────
// Exported as stable function references so components can subscribe narrowly
// and avoid re-rendering on unrelated document changes.

export const selectDoc = (s: EditorState) => s.doc;
export const selectFurniture = (s: EditorState) => s.doc.furniture;
export const selectRoom = (s: EditorState) => s.doc.room;
export const selectSelection = (s: EditorState) => s.selection;
export const selectUnit = (s: EditorState) => s.doc.unit;

/** The single selected instance, or null when 0 or many are selected. */
export function useSelectedInstance(): FurnitureInstance | null {
  return useEditor((s) =>
    s.selection.length === 1
      ? (s.doc.furniture.find((f) => f.instanceId === s.selection[0]) ?? null)
      : null
  );
}
