import type { DocumentState, Project } from '@/types';
import { SCHEMA_VERSION } from '@/types';
import { parseProject, type ParseResult } from './schema';

/**
 * Share links.
 *
 * A layout is packed into a compact array form, JSON-encoded and base64url'd
 * into the URL fragment. Two decisions worth calling out:
 *
 *  1. It goes in the FRAGMENT (`#s=`), not the query string. Fragments are not
 *     sent to the server and stay out of access logs and Referer headers.
 *  2. Decoding runs the result through `parseProject`, the same validator used
 *     for file imports. A share link is a stranger's data pasted into your
 *     browser — it gets no more trust than an uploaded file.
 *
 * The compact form exists purely to keep URLs under the ~2000-character limit
 * that older proxies and chat clients impose.
 */

export const SHARE_PARAM = 's';
const PACK_VERSION = 1;

/** Rounds to millimetre precision — beyond that is noise that costs URL bytes. */
const r = (n: number): number => Math.round(n * 1000) / 1000;

type PackedOpening = [
  kind: 0 | 1,
  wall: number,
  offset: number,
  width: number,
  height: number,
  sill: number,
  hinge: 0 | 1,
  swing: 0 | 1,
];

type PackedFurniture = [
  catalogId: string,
  x: number,
  z: number,
  rotation: number,
  sx: number,
  sy: number,
  sz: number,
  finishId: string,
  colorOverride: string,
  flags: number,
];

interface Packed {
  v: number;
  n: string;
  u: 0 | 1;
  d: [number, number, number, number];
  wc: string;
  fc: string;
  fp: number;
  o: PackedOpening[];
  f: PackedFurniture[];
}

const WALL_ORDER = ['north', 'south', 'east', 'west'] as const;
const PATTERN_ORDER = ['plain', 'planks', 'tiles', 'herringbone'] as const;

const FLAG_LOCKED = 1;
const FLAG_HIDDEN = 2;

function pack(doc: DocumentState): Packed {
  const d = doc.room.dimensions;
  return {
    v: PACK_VERSION,
    n: doc.name.slice(0, 80),
    u: doc.unit === 'ft' ? 1 : 0,
    d: [r(d.width), r(d.length), r(d.height), r(d.wallThickness)],
    wc: doc.room.walls.color.replace('#', ''),
    fc: doc.room.floor.color.replace('#', ''),
    fp: Math.max(0, PATTERN_ORDER.indexOf(doc.room.floor.pattern)),
    o: doc.room.openings.map((o) => [
      o.kind === 'window' ? 1 : 0,
      Math.max(0, WALL_ORDER.indexOf(o.wall)),
      r(o.offset),
      r(o.width),
      r(o.height),
      r(o.sillHeight),
      o.hinge === 'right' ? 1 : 0,
      o.swing === 'out' ? 1 : 0,
    ]),
    f: doc.furniture.map((f) => [
      f.catalogId,
      r(f.position.x),
      r(f.position.z),
      Math.round(f.rotation * 10) / 10,
      r(f.scale.x),
      r(f.scale.y),
      r(f.scale.z),
      f.finishId,
      f.colorOverride ? f.colorOverride.replace('#', '') : '',
      (f.locked ? FLAG_LOCKED : 0) | (f.visible ? 0 : FLAG_HIDDEN),
    ]),
  };
}

/** Expands the packed form back into the loose shape `parseProject` accepts. */
function unpack(p: Packed): unknown {
  const dims = Array.isArray(p.d) ? p.d : [4, 5, 2.6, 0.12];
  return {
    schemaVersion: SCHEMA_VERSION,
    name: p.n,
    unit: p.u === 1 ? 'ft' : 'm',
    room: {
      dimensions: {
        width: dims[0],
        length: dims[1],
        height: dims[2],
        wallThickness: dims[3],
      },
      walls: { color: `#${p.wc}` },
      floor: {
        color: `#${p.fc}`,
        pattern: PATTERN_ORDER[p.fp] ?? 'planks',
      },
      openings: (Array.isArray(p.o) ? p.o : []).map((o) => ({
        kind: o[0] === 1 ? 'window' : 'door',
        wall: WALL_ORDER[o[1]] ?? 'north',
        offset: o[2],
        width: o[3],
        height: o[4],
        sillHeight: o[5],
        hinge: o[6] === 1 ? 'right' : 'left',
        swing: o[7] === 1 ? 'out' : 'in',
      })),
    },
    furniture: (Array.isArray(p.f) ? p.f : []).map((f) => ({
      catalogId: f[0],
      position: { x: f[1], z: f[2] },
      rotation: f[3],
      scale: { x: f[4], y: f[5], z: f[6] },
      finishId: f[7],
      colorOverride: f[8] ? `#${f[8]}` : null,
      locked: (f[9] & FLAG_LOCKED) !== 0,
      visible: (f[9] & FLAG_HIDDEN) === 0,
      groupId: null,
      note: '',
    })),
  };
}

/** UTF-8 safe base64url encode. */
function toBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function encodeShareData(doc: DocumentState): string {
  return toBase64Url(JSON.stringify(pack(doc)));
}

/** Full shareable URL for the current document. */
export function buildShareUrl(doc: DocumentState, origin?: string): string {
  const base =
    origin ??
    (typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}`
      : '');
  return `${base}#${SHARE_PARAM}=${encodeShareData(doc)}`;
}

/**
 * Decodes share data. Returns the same discriminated result as file import, so
 * callers handle failure identically.
 */
export function decodeShareData(encoded: string): ParseResult {
  // 1 MB of base64 is already far beyond any legitimate layout; refuse early
  // rather than handing an unbounded string to the JSON parser.
  if (encoded.length > 1_000_000) {
    return { ok: false, error: 'That share link is too large to open.' };
  }
  let json: string;
  try {
    json = fromBase64Url(encoded);
  } catch {
    return { ok: false, error: 'That share link is damaged or incomplete.' };
  }

  let packed: Packed;
  try {
    packed = JSON.parse(json) as Packed;
  } catch {
    return { ok: false, error: 'That share link is damaged or incomplete.' };
  }

  if (typeof packed !== 'object' || packed === null) {
    return { ok: false, error: 'That share link does not contain a room.' };
  }
  if (packed.v > PACK_VERSION) {
    return {
      ok: false,
      error: 'That link was created by a newer version of RoomCraft.',
    };
  }

  return parseProject(unpack(packed));
}

/** Reads and clears a share payload from `location.hash`, if present. */
export function consumeShareFromUrl(): ParseResult | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const data = params.get(SHARE_PARAM);
  if (!data) return null;

  // Clear the fragment so a refresh does not silently re-import the link over
  // whatever the user has since edited.
  window.history.replaceState(
    null,
    '',
    `${window.location.pathname}${window.location.search}`
  );
  return decodeShareData(data);
}

/** Approximate URL length, so the UI can warn before a link gets truncated. */
export function shareUrlLength(doc: DocumentState): number {
  return buildShareUrl(doc, 'https://example.com/').length;
}

export function projectToDocument(project: Project): DocumentState {
  return {
    name: project.name,
    unit: project.unit,
    room: project.room,
    furniture: project.furniture,
  };
}
