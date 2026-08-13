import type { Opening } from '@/types';

/**
 * Wall construction around openings.
 *
 * Kept in `utils` rather than beside the renderer so it stays pure and cheap to
 * test — pulling three.js and R3F into a unit test to check arithmetic is a
 * poor trade.
 *
 * Openings are cut by CONSTRUCTION, not CSG: a wall is emitted as solid boxes —
 * full-height piers between openings, plus a sill below and a lintel above each
 * one. Boolean geometry would be heavier, harder to keep watertight, and would
 * need re-running on every frame while a window's width is dragged.
 */

export interface WallSegment {
  /** Centre along the wall, in wall-local X (0 is the wall's midpoint). */
  x: number;
  /** Centre height above the floor. */
  y: number;
  /** Length along the wall. */
  w: number;
  /** Vertical size. */
  h: number;
}

/**
 * Splits one wall of the given length and height into solid segments.
 *
 * INVARIANT: the total area of the returned segments plus the area of the
 * openings equals the wall area. That is what the tests assert, and it catches
 * every realistic bug in the pier/lintel/sill split.
 */
export function buildWallSegments(
  length: number,
  height: number,
  openings: Opening[]
): WallSegment[] {
  const sorted = [...openings].sort((a, b) => a.offset - b.offset);
  const segments: WallSegment[] = [];
  let cursor = 0;

  for (const o of sorted) {
    const start = Math.max(0, o.offset - o.width / 2);
    const end = Math.min(length, o.offset + o.width / 2);
    // Fully swallowed by a previous opening — overlapping openings are invalid
    // input, but must not produce negative or duplicated geometry.
    if (end <= cursor) continue;

    if (start > cursor) {
      segments.push({
        x: (cursor + start) / 2 - length / 2,
        y: height / 2,
        w: start - cursor,
        h: height,
      });
    }

    const openStart = Math.max(cursor, start);
    const spanW = end - openStart;
    const spanX = (openStart + end) / 2 - length / 2;

    // Sill below (windows only — doors carry sillHeight 0).
    if (o.sillHeight > 0.001) {
      segments.push({ x: spanX, y: o.sillHeight / 2, w: spanW, h: o.sillHeight });
    }
    // Lintel above.
    const top = o.sillHeight + o.height;
    if (top < height - 0.001) {
      segments.push({ x: spanX, y: (top + height) / 2, w: spanW, h: height - top });
    }

    cursor = end;
  }

  if (cursor < length) {
    segments.push({
      x: (cursor + length) / 2 - length / 2,
      y: height / 2,
      w: length - cursor,
      h: height,
    });
  }

  return segments.filter((s) => s.w > 0.001 && s.h > 0.001);
}
