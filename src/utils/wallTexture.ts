import * as THREE from 'three';
import type { WallFinish, WallPattern } from '@/types';

/**
 * Procedural wall textures.
 *
 * Like floorTexture.ts, textures are drawn into a 2D canvas and tiled into a
 * THREE.CanvasTexture. They are cached by (pattern, color, width, height) and
 * bounded by an LRU cache to prevent GPU memory leaks.
 */

const cache = new Map<string, THREE.CanvasTexture>();
const CACHE_LIMIT = 32;

const TILE_METRES = 1.0;
const PIXELS = 512;

function shift(hex: string, amount: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, THREE.MathUtils.clamp(hsl.l + amount, 0.03, 0.97));
  return `#${c.getHexString()}`;
}

function drawBrick(ctx: CanvasRenderingContext2D, color: string): void {
  // Mortar background
  ctx.fillStyle = shift(color, -0.15);
  ctx.fillRect(0, 0, PIXELS, PIXELS);

  const rows = 8;
  const rowH = PIXELS / rows;
  const brickW = PIXELS / 4;
  const mortar = 4;

  for (let r = 0; r < rows; r++) {
    const y = r * rowH;
    const offset = (r % 2) * (brickW / 2);

    for (let col = -1; col < 5; col++) {
      const x = col * brickW + offset;
      // Slight brick color variation
      const brickColor = shift(color, ((r * 3 + col * 7) % 5) * 0.02 - 0.04);
      ctx.fillStyle = brickColor;
      ctx.fillRect(x + mortar / 2, y + mortar / 2, brickW - mortar, rowH - mortar);

      // Subtle bevel/texture on brick face
      ctx.fillStyle = shift(brickColor, 0.04);
      ctx.fillRect(x + mortar / 2, y + mortar / 2, brickW - mortar, 2);
    }
  }
}

function drawPanels(ctx: CanvasRenderingContext2D, color: string): void {
  // Deep shadow gap background
  ctx.fillStyle = shift(color, -0.28);
  ctx.fillRect(0, 0, PIXELS, PIXELS);

  const slats = 12;
  const slatW = PIXELS / slats;
  const gap = 3;

  for (let i = 0; i < slats; i++) {
    const x = i * slatW;
    const slatColor = shift(color, ((i * 3) % 4) * 0.015 - 0.02);
    ctx.fillStyle = slatColor;
    ctx.fillRect(x + gap, 0, slatW - gap, PIXELS);

    // Highlight on left edge of slat
    ctx.fillStyle = shift(slatColor, 0.08);
    ctx.fillRect(x + gap, 0, 1.5, PIXELS);

    // Subtle grain lines
    ctx.strokeStyle = shift(slatColor, -0.04);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + slatW * 0.4, 0);
    ctx.lineTo(x + slatW * 0.45, PIXELS);
    ctx.stroke();
  }
}

function drawSubway(ctx: CanvasRenderingContext2D, color: string): void {
  // Grout background
  ctx.fillStyle = shift(color, -0.18);
  ctx.fillRect(0, 0, PIXELS, PIXELS);

  const rows = 6;
  const rowH = PIXELS / rows;
  const tileW = PIXELS / 3;
  const grout = 4;

  for (let r = 0; r < rows; r++) {
    const y = r * rowH;
    const offset = (r % 2) * (tileW / 2);

    for (let c = -1; c < 4; c++) {
      const x = c * tileW + offset;
      const tileColor = shift(color, ((r + c) % 3) * 0.01);
      ctx.fillStyle = tileColor;
      ctx.fillRect(x + grout / 2, y + grout / 2, tileW - grout, rowH - grout);

      // Ceramic bevel highlight (gloss look)
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillRect(x + grout / 2, y + grout / 2, tileW - grout, 2.5);
      ctx.fillRect(x + grout / 2, y + grout / 2, 2.5, rowH - grout);

      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(x + grout / 2, y + rowH - grout / 2 - 2, tileW - grout, 2);
    }
  }
}

function drawStripes(ctx: CanvasRenderingContext2D, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, PIXELS, PIXELS);

  const stripes = 16;
  const stripeW = PIXELS / stripes;
  const accent = shift(color, 0.08);

  for (let i = 0; i < stripes; i += 2) {
    ctx.fillStyle = accent;
    ctx.fillRect(i * stripeW, 0, stripeW, PIXELS);
  }
}

function drawConcrete(ctx: CanvasRenderingContext2D, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, PIXELS, PIXELS);

  // Formwork seams (horizontal panels)
  const panels = 3;
  const panelH = PIXELS / panels;
  ctx.strokeStyle = shift(color, -0.12);
  ctx.lineWidth = 2;

  for (let i = 1; i < panels; i++) {
    const y = i * panelH;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(PIXELS, y);
    ctx.stroke();

    // Tie holes
    for (let h = 0; h < 4; h++) {
      const x = ((h + 0.5) / 4) * PIXELS;
      ctx.fillStyle = shift(color, -0.25);
      ctx.beginPath();
      ctx.arc(x, y - 12, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Aggregate specks
  for (let i = 0; i < 200; i++) {
    const x = (Math.sin(i * 997) * 0.5 + 0.5) * PIXELS;
    const y = (Math.cos(i * 613) * 0.5 + 0.5) * PIXELS;
    ctx.fillStyle = (i % 2 === 0 ? shift(color, 0.05) : shift(color, -0.06));
    ctx.fillRect(x, y, 1.5, 1.5);
  }
}

export function getWallTexture(
  finish: WallFinish,
  wallWidth: number,
  wallHeight: number
): THREE.CanvasTexture | null {
  const pattern: WallPattern = finish.pattern ?? 'plain';
  if (pattern === 'plain') return null;

  const key = `${pattern}:${finish.color}:${wallWidth.toFixed(2)}:${wallHeight.toFixed(2)}`;
  const existing = cache.get(key);
  if (existing) return existing;

  const canvas = document.createElement('canvas');
  canvas.width = PIXELS;
  canvas.height = PIXELS;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  switch (pattern) {
    case 'brick':
      drawBrick(ctx, finish.color);
      break;
    case 'panels':
      drawPanels(ctx, finish.color);
      break;
    case 'subway':
      drawSubway(ctx, finish.color);
      break;
    case 'stripes':
      drawStripes(ctx, finish.color);
      break;
    case 'concrete':
      drawConcrete(ctx, finish.color);
      break;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    Math.max(1, wallWidth / TILE_METRES),
    Math.max(1, wallHeight / TILE_METRES)
  );
  texture.anisotropy = 4;
  texture.needsUpdate = true;

  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest) {
      cache.get(oldest)?.dispose();
      cache.delete(oldest);
    }
  }

  cache.set(key, texture);
  return texture;
}

export function getWallMaterialProperties(pattern?: WallPattern): {
  roughness: number;
  metalness: number;
} {
  switch (pattern) {
    case 'subway':
      return { roughness: 0.18, metalness: 0.02 };
    case 'concrete':
      return { roughness: 0.96, metalness: 0.0 };
    case 'panels':
      return { roughness: 0.55, metalness: 0.0 };
    case 'brick':
      return { roughness: 0.92, metalness: 0.0 };
    case 'stripes':
      return { roughness: 0.75, metalness: 0.0 };
    case 'plain':
    default:
      return { roughness: 0.92, metalness: 0.0 };
  }
}
