import { useMemo } from 'react';
import * as THREE from 'three';

/**
 * Building blocks for the procedural furniture models.
 *
 * Every model is authored in a LOCAL FRAME with the origin at the centre of its
 * footprint, sitting on y = 0, and extending to y = h. Local +Z is the
 * direction the object faces. Keeping that contract absolute is what lets the
 * collision rectangle in `utils/placement.ts` be derived from the catalog size
 * alone, with no per-model fudge factors.
 *
 * Note the axis order: three.js BoxGeometry takes (x, y, z) = (width, HEIGHT,
 * depth), while the catalog speaks in (w, d, h). The `Slab` wrapper does that
 * swap once, here, so no model file has to remember it.
 */

export interface Surface {
  color: string;
  roughness: number;
  metalness: number;
}

/** Shifts a colour's lightness. Used for legs, shadows and cushion contrast. */
export function shade(hex: string, amount: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, THREE.MathUtils.clamp(hsl.l + amount, 0.02, 0.98));
  return `#${c.getHexString()}`;
}

/** Desaturated neutral derived from a surface — for metal legs and frames. */
export function neutral(hex: string, lightness = 0.28): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s * 0.25, lightness);
  return `#${c.getHexString()}`;
}

interface SlabProps {
  /** Centre position in local space, three.js order (x, y, z). */
  at: [number, number, number];
  /** Size in catalog order (w, d, h) — width, depth, height. */
  size: [number, number, number];
  color: string;
  roughness?: number;
  metalness?: number;
  /** Rotation about Y in radians, for angled backs and slats. */
  rotY?: number;
  rotX?: number;
  radius?: number;
}

/** An axis-aligned box. The workhorse — most furniture is boxes. */
export function Slab({
  at,
  size,
  color,
  roughness = 0.65,
  metalness = 0,
  rotY = 0,
  rotX = 0,
}: SlabProps) {
  const [w, d, h] = size;
  return (
    <mesh position={at} rotation={[rotX, rotY, 0]} castShadow receiveShadow>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />
    </mesh>
  );
}

interface CylProps {
  at: [number, number, number];
  radius: number;
  height: number;
  color: string;
  roughness?: number;
  metalness?: number;
  segments?: number;
  radiusTop?: number;
  rotX?: number;
  rotZ?: number;
}

export function Cyl({
  at,
  radius,
  height,
  color,
  roughness = 0.6,
  metalness = 0,
  segments = 16,
  radiusTop,
  rotX = 0,
  rotZ = 0,
}: CylProps) {
  return (
    <mesh position={at} rotation={[rotX, 0, rotZ]} castShadow receiveShadow>
      <cylinderGeometry
        args={[radiusTop ?? radius, radius, height, segments]}
      />
      <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />
    </mesh>
  );
}

/**
 * A box with rounded edges, for cushions and upholstery.
 *
 * Built from an extruded rounded rectangle rather than a bevelled box because
 * the geometry is cached per (w, d, h, r) — a room full of dining chairs shares
 * one buffer instead of allocating twenty.
 */
const cushionCache = new Map<string, THREE.ExtrudeGeometry>();

function cushionGeometry(w: number, d: number, h: number, r: number) {
  const key = `${w.toFixed(3)}|${d.toFixed(3)}|${h.toFixed(3)}|${r.toFixed(3)}`;
  const hit = cushionCache.get(key);
  if (hit) return hit;

  const radius = Math.min(r, w / 2 - 0.001, d / 2 - 0.001);
  const shape = new THREE.Shape();
  const hw = w / 2 - radius;
  const hd = d / 2 - radius;
  shape.moveTo(-hw, -d / 2);
  shape.lineTo(hw, -d / 2);
  shape.quadraticCurveTo(w / 2, -d / 2, w / 2, -hd);
  shape.lineTo(w / 2, hd);
  shape.quadraticCurveTo(w / 2, d / 2, hw, d / 2);
  shape.lineTo(-hw, d / 2);
  shape.quadraticCurveTo(-w / 2, d / 2, -w / 2, hd);
  shape.lineTo(-w / 2, -hd);
  shape.quadraticCurveTo(-w / 2, -d / 2, -hw, -d / 2);

  const bevel = Math.min(h * 0.28, radius * 0.8);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, h - bevel * 2),
    bevelEnabled: bevel > 0.002,
    bevelSize: bevel * 0.7,
    bevelThickness: bevel,
    bevelSegments: 2,
    curveSegments: 4,
  });
  // Extrude builds along +Z; stand it up and sit it on its own base.
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, bevel, 0);
  geometry.computeVertexNormals();

  // Bound the cache: a user scaling a wardrobe generates a new key per frame.
  if (cushionCache.size > 220) {
    const oldest = cushionCache.keys().next().value;
    if (oldest) {
      cushionCache.get(oldest)?.dispose();
      cushionCache.delete(oldest);
    }
  }
  cushionCache.set(key, geometry);
  return geometry;
}

export function Cushion({
  at,
  size,
  color,
  roughness = 0.9,
  radius = 0.05,
  rotX = 0,
  rotY = 0,
}: {
  at: [number, number, number];
  size: [number, number, number];
  color: string;
  roughness?: number;
  radius?: number;
  rotX?: number;
  rotY?: number;
}) {
  const [w, d, h] = size;
  const geometry = useMemo(() => cushionGeometry(w, d, h, radius), [w, d, h, radius]);
  return (
    <mesh position={at} rotation={[rotX, rotY, 0]} geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={roughness} metalness={0} />
    </mesh>
  );
}

/** Four legs at the corners of a (w × d) footprint, inset by `inset`. */
export function Legs({
  w,
  d,
  height,
  color,
  thickness = 0.05,
  inset = 0.06,
  round = false,
}: {
  w: number;
  d: number;
  height: number;
  color: string;
  thickness?: number;
  inset?: number;
  round?: boolean;
}) {
  const x = w / 2 - inset - thickness / 2;
  const z = d / 2 - inset - thickness / 2;
  const positions: Array<[number, number, number]> = [
    [x, height / 2, z],
    [-x, height / 2, z],
    [x, height / 2, -z],
    [-x, height / 2, -z],
  ];
  return (
    <>
      {positions.map((p, i) =>
        round ? (
          <Cyl
            key={i}
            at={p}
            radius={thickness / 2}
            height={height}
            color={color}
            roughness={0.5}
            metalness={0.3}
            segments={8}
          />
        ) : (
          <Slab key={i} at={p} size={[thickness, thickness, height]} color={color} />
        )
      )}
    </>
  );
}

/** Evenly spaced door/drawer fronts across a carcass face. */
export function Panels({
  count,
  w,
  h,
  z,
  y,
  color,
  gap = 0.012,
  depth = 0.02,
  handleColor,
  horizontal = false,
}: {
  count: number;
  w: number;
  h: number;
  z: number;
  y: number;
  color: string;
  gap?: number;
  depth?: number;
  handleColor?: string;
  horizontal?: boolean;
}) {
  const items = [];
  if (horizontal) {
    const each = (h - gap * (count + 1)) / count;
    for (let i = 0; i < count; i++) {
      const cy = y - h / 2 + gap * (i + 1) + each * (i + 0.5);
      items.push(
        <group key={i}>
          <Slab at={[0, cy, z]} size={[w - gap * 2, depth, each]} color={color} />
          {handleColor && (
            <Slab
              at={[0, cy, z + depth * 0.8]}
              size={[w * 0.28, 0.016, 0.016]}
              color={handleColor}
              roughness={0.35}
              metalness={0.7}
            />
          )}
        </group>
      );
    }
  } else {
    const each = (w - gap * (count + 1)) / count;
    for (let i = 0; i < count; i++) {
      const cx = -w / 2 + gap * (i + 1) + each * (i + 0.5);
      items.push(
        <group key={i}>
          <Slab at={[cx, y, z]} size={[each, depth, h - gap * 2]} color={color} />
          {each > 0.18 && (
            <Slab
              at={[cx, y, z + 0.003]}
              size={[each - 0.07, depth + 0.002, Math.max(0.1, h - gap * 2 - 0.12)]}
              color={shade(color, -0.05)}
            />
          )}
          {handleColor && (
            <Slab
              at={[
                cx + (i % 2 === 0 ? each * 0.36 : -each * 0.36),
                y,
                z + depth * 0.8,
              ]}
              size={[0.016, 0.016, Math.min(0.22, h * 0.3)]}
              color={handleColor}
              roughness={0.35}
              metalness={0.7}
            />
          )}
        </group>
      );
    }
  }
  return <>{items}</>;
}
