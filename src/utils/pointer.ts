import type { Vec2 } from '@/types';

/**
 * Screen-to-floor picking, registered from inside the R3F canvas.
 *
 * The catalog sidebar is plain DOM and fires HTML5 drag events; it needs to
 * know where on the floor plane a drop landed. Rather than leak the camera into
 * React context, a component inside the canvas registers this function on mount.
 */

export type FloorPicker = (clientX: number, clientY: number) => Vec2 | null;

let picker: FloorPicker | null = null;

export function registerFloorPicker(fn: FloorPicker | null): void {
  picker = fn;
}

export function pickFloor(clientX: number, clientY: number): Vec2 | null {
  return picker ? picker(clientX, clientY) : null;
}
