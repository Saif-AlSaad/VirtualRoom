import * as THREE from 'three';
import type { FloorFinish } from '@/types';

/**
 * Procedural floor textures.
 *
 * Drawn into a 2D canvas rather than shipped as image files: a plank texture is
 * ~40 lines of canvas code versus a 500 kB seamless JPEG, and generating it
 * means the plank colour can follow the user's chosen finish exactly instead of
 * being tinted approximately.
 *
 * Textures are cached by (pattern, colour) and reused across renders — without
 * the cache, every floor-colour tweak would leak a GPU texture per frame.
 */

const cache = new Map<string, THREE.CanvasTexture>();
const CACHE_LIMIT = 24;

/** One texture tile covers this many metres of floor. */
const TILE_METRES = 1.0;
const PIXELS = 512;

function shift(hex: string, amount: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, THREE.MathUtils.clamp(hsl.l + amount, 0.03, 0.97));
  return `#${c.getHexString()}`;
}

function drawPlanks(ctx: CanvasRenderingContext2D, color: string): void {
  const plankH = PIXELS / 5;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, PIXELS, PIXELS);

  for (let row = 0; row < 5; row++) {
    const y = row * plankH;
    // Stagger every other row so the seams do not line up into a grid.
    const offset = (row % 2) * (PIXELS / 3);
    ctx.fillStyle = shift(color, (row % 3) * 0.018 - 0.018);
    ctx.fillRect(0, y, PIXELS, plankH - 1);

    ctx.strokeStyle = shift(color, -0.14);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, y + plankH - 1);
    ctx.lineTo(PIXELS, y + plankH - 1);
    ctx.stroke();

    // Butt joints between boards.
    for (let j = 0; j < 2; j++) {
      const x = (offset + j * (PIXELS / 2)) % PIXELS;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + plankH);
      ctx.stroke();
    }

    // Grain.
    ctx.strokeStyle = shift(color, -0.05);
    ctx.lineWidth = 0.8;
    for (let g = 0; g < 5; g++) {
      const gy = y + ((g + 1) / 6) * plankH;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.bezierCurveTo(PIXELS * 0.3, gy + 3, PIXELS * 0.6, gy - 3, PIXELS, gy);
      ctx.stroke();
    }
  }
}

function drawTiles(ctx: CanvasRenderingContext2D, color: string): void {
  const n = 2;
  const size = PIXELS / n;
  ctx.fillStyle = shift(color, -0.16);
  ctx.fillRect(0, 0, PIXELS, PIXELS);
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) {
      ctx.fillStyle = shift(color, ((x + y) % 2) * 0.02);
      ctx.fillRect(x * size + 3, y * size + 3, size - 6, size - 6);
    }
  }
}

function drawHerringbone(ctx: CanvasRenderingContext2D, color: string): void {
  ctx.fillStyle = shift(color, -0.1);
  ctx.fillRect(0, 0, PIXELS, PIXELS);
  const len = PIXELS / 3;
  const wide = len / 2.6;
  ctx.save();
  for (let row = -2; row < 6; row++) {
    for (let col = -2; col < 6; col++) {
      const flip = (row + col) % 2 === 0;
      ctx.save();
      ctx.translate(col * len * 0.72, row * len * 0.72);
      ctx.rotate(flip ? Math.PI / 4 : -Math.PI / 4);
      ctx.fillStyle = shift(color, flip ? 0.025 : -0.025);
      ctx.fillRect(0, 0, len, wide);
      ctx.strokeStyle = shift(color, -0.2);
      ctx.lineWidth = 1.2;
      ctx.strokeRect(0, 0, len, wide);
      ctx.restore();
    }
  }
  ctx.restore();
}

function drawPlain(ctx: CanvasRenderingContext2D, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, PIXELS, PIXELS);
  // Very light noise so a flat colour still catches the light unevenly.
  const image = ctx.getImageData(0, 0, PIXELS, PIXELS);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() - 0.5) * 10;
    data[i] += n;
    data[i + 1] += n;
    data[i + 2] += n;
  }
  ctx.putImageData(image, 0, 0);
}

/**
 * Returns a repeating floor texture sized to the room.
 *
 * The caller owns nothing — do NOT dispose the returned texture; it is shared.
 */
export function getFloorTexture(
  floor: FloorFinish,
  roomWidth: number,
  roomLength: number
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;

  const key = `${floor.pattern}|${floor.color}`;
  let texture = cache.get(key);

  if (!texture) {
    const canvas = document.createElement('canvas');
    canvas.width = PIXELS;
    canvas.height = PIXELS;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    switch (floor.pattern) {
      case 'planks':
        drawPlanks(ctx, floor.color);
        break;
      case 'tiles':
        drawTiles(ctx, floor.color);
        break;
      case 'herringbone':
        drawHerringbone(ctx, floor.color);
        break;
      default:
        drawPlain(ctx, floor.color);
    }

    texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;

    if (cache.size >= CACHE_LIMIT) {
      const oldest = cache.keys().next().value;
      if (oldest) {
        cache.get(oldest)?.dispose();
        cache.delete(oldest);
      }
    }
    cache.set(key, texture);
  }

  // Repeat is per-room, so it is set on every call rather than at creation.
  texture.repeat.set(roomWidth / TILE_METRES, roomLength / TILE_METRES);
  texture.needsUpdate = true;
  return texture;
}
