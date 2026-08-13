import { create } from 'zustand';
import type { SnapGuide } from '@/utils/snapping';
import type { Vec2 } from '@/types';

/**
 * Transient drag state.
 *
 * Deliberately its own store, updated many times per second while a gesture is
 * live. Keeping it out of the editor store means a drag never re-renders the
 * catalog, the top bar or the properties panel — only the handful of components
 * that subscribe here.
 */

export type DragMode = 'move' | 'rotate' | 'scale' | null;

interface DragState {
  mode: DragMode;
  /** Ids being transformed, with each one's offset from the grab point. */
  targets: Array<{ id: string; offset: Vec2 }>;
  /** Pointer angle at grab time, for rotate gestures. */
  startAngle: number;
  startRotation: number;
  /** Guides produced by the last snap resolution, drawn by the viewport. */
  guides: SnapGuide[];
  /** Non-null when the current position would be an illegal placement. */
  invalidReason: string | null;

  start: (mode: DragMode, targets: Array<{ id: string; offset: Vec2 }>) => void;
  startRotate: (id: string, startAngle: number, startRotation: number) => void;
  setGuides: (guides: SnapGuide[]) => void;
  setInvalidReason: (reason: string | null) => void;
  end: () => void;
}

export const useDrag = create<DragState>((set) => ({
  mode: null,
  targets: [],
  startAngle: 0,
  startRotation: 0,
  guides: [],
  invalidReason: null,

  start: (mode, targets) => set({ mode, targets, guides: [], invalidReason: null }),

  startRotate: (id, startAngle, startRotation) =>
    set({
      mode: 'rotate',
      targets: [{ id, offset: { x: 0, z: 0 } }],
      startAngle,
      startRotation,
      guides: [],
      invalidReason: null,
    }),

  setGuides: (guides) => set({ guides }),
  setInvalidReason: (invalidReason) => set({ invalidReason }),

  end: () => set({ mode: null, targets: [], guides: [], invalidReason: null }),
}));
