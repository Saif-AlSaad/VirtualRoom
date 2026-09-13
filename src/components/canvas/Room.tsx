import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Room as RoomModel, WallSide } from '@/types';
import { getFloorTexture } from '@/utils/floorTexture';
import { getWallMaterialProperties, getWallTexture } from '@/utils/wallTexture';
import { wallLength } from '@/utils/roomGeometry';
import { buildWallSegments } from '@/utils/wallSegments';
import { useUI } from '@/store/uiStore';

/**
 * The room shell: floor, ceiling-less walls, skirting and real openings.
 *
 * The opening cut-outs themselves are computed by `utils/wallSegments.ts`; this
 * file turns those segments into meshes and places each wall in world space.
 *
 * Walls between the camera and the room fade out automatically. Without that,
 * an orbit camera spends half its arc staring at the back of a wall — every
 * serious planner does this, and fading rather than hard-hiding keeps the
 * room's shape legible while it happens.
 */

/** Per-wall placement in world space. */
function wallTransform(
  side: WallSide,
  width: number,
  length: number,
  thickness: number
): { position: [number, number, number]; rotation: number; geomLength: number } {
  switch (side) {
    case 'north':
      return {
        position: [0, 0, -length / 2 - thickness / 2],
        rotation: 0,
        // Extended to cover the corners left open by the side walls.
        geomLength: width + thickness * 2,
      };
    case 'south':
      return {
        position: [0, 0, length / 2 + thickness / 2],
        rotation: 0,
        geomLength: width + thickness * 2,
      };
    case 'west':
      return {
        position: [-width / 2 - thickness / 2, 0, 0],
        rotation: -Math.PI / 2,
        geomLength: length,
      };
    case 'east':
      return {
        position: [width / 2 + thickness / 2, 0, 0],
        rotation: -Math.PI / 2,
        geomLength: length,
      };
  }
}

/** Outward normal, used to decide which walls the camera is looking through. */
const OUTWARD: Record<WallSide, THREE.Vector3> = {
  north: new THREE.Vector3(0, 0, -1),
  south: new THREE.Vector3(0, 0, 1),
  west: new THREE.Vector3(-1, 0, 0),
  east: new THREE.Vector3(1, 0, 0),
};

function Wall({
  side,
  room,
  fade,
}: {
  side: WallSide;
  room: RoomModel;
  fade: boolean;
}) {
  const { width, length, height, wallThickness } = room.dimensions;
  const { position, rotation, geomLength } = wallTransform(
    side,
    width,
    length,
    wallThickness
  );
  const innerLength = wallLength(side, room.dimensions);

  const openings = useMemo(
    () => room.openings.filter((o) => o.wall === side),
    [room.openings, side]
  );

  // Segments are computed against the INNER length, then offset into the
  // extended geometry so the extra corner material stays solid.
  const segments = useMemo(
    () => buildWallSegments(innerLength, height, openings),
    [innerLength, height, openings]
  );

  const cornerPad = (geomLength - innerLength) / 2;
  const groupRef = useRef<THREE.Group>(null);

  const wallTexture = useMemo(
    () => getWallTexture(room.walls, innerLength, height),
    [room.walls, innerLength, height]
  );
  const wallProps = useMemo(
    () => getWallMaterialProperties(room.walls.pattern),
    [room.walls.pattern]
  );

  // One material instance shared by every segment of this wall, so the fade
  // animates the wall as a single surface instead of piece by piece.
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        roughness: 0.94,
        metalness: 0,
        transparent: true,
        opacity: 1,
      }),
    []
  );
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => {
    material.map = wallTexture ?? null;
    material.color.set(wallTexture ? '#ffffff' : room.walls.color);
    material.roughness = wallProps.roughness;
    material.metalness = wallProps.metalness;
    material.needsUpdate = true;
  }, [material, room.walls.color, wallTexture, wallProps]);

  useFrame((state, delta) => {
    const mat = material;
    const group = groupRef.current;
    if (!group) return;

    let target = 1;
    if (fade) {
      // Hide the wall when the camera sits on its outside face. Computed from
      // the raw components rather than a cloned, normalised vector so the hot
      // path allocates nothing.
      const { x, y, z } = state.camera.position;
      const length = Math.hypot(x, y, z) || 1;
      const normal = OUTWARD[side];
      const dot = (x * normal.x + y * normal.y + z * normal.z) / length;
      if (dot > 0.12) target = 0;
      else if (dot > -0.05) target = 0.25;
    }
    // 150–200 ms feel, frame-rate independent.
    const k = 1 - Math.exp(-delta * 9);
    mat.opacity += (target - mat.opacity) * k;
    mat.transparent = mat.opacity < 0.995;
    mat.depthWrite = mat.opacity > 0.6;
    group.visible = mat.opacity > 0.01;
  });

  return (
    <group ref={groupRef} position={position} rotation={[0, rotation, 0]}>
      {segments.map((s, i) => (
        <mesh key={i} position={[s.x, s.y, 0]} material={material} castShadow receiveShadow>
          <boxGeometry args={[s.w, s.h, wallThickness]} />
        </mesh>
      ))}
      {/* Corner returns, always solid. */}
      {cornerPad > 0.001 &&
        [-1, 1].map((s) => (
          <mesh
            key={s}
            position={[s * (innerLength / 2 + cornerPad / 2), height / 2, 0]}
            material={material}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[cornerPad, height, wallThickness]} />
          </mesh>
        ))}
    </group>
  );
}

export function Room({ room }: { room: RoomModel }) {
  const { width, length } = room.dimensions;
  const viewMode = useUI((s) => s.viewMode);

  const texture = useMemo(
    () => getFloorTexture(room.floor, width, length),
    [room.floor, width, length]
  );

  // Walls stay solid in the top-down and walkthrough views: overhead you are
  // looking down into the box anyway, and in walkthrough you are inside it.
  const fade = viewMode === '3d';

  return (
    <group name="room">
      {/* Floor */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
        name="floor"
      >
        <planeGeometry args={[width, length]} />
        <meshStandardMaterial
          map={texture ?? undefined}
          color={texture ? '#ffffff' : room.floor.color}
          roughness={0.82}
          metalness={0.02}
        />
      </mesh>

      {/* Skirting board — a 70 mm detail that does more for realism than
          anything else in this file. */}
      {(['north', 'south', 'west', 'east'] as WallSide[]).map((side) => {
        const horizontal = side === 'north' || side === 'south';
        const len = horizontal ? width : length;
        const pos: [number, number, number] = horizontal
          ? [0, 0.035, side === 'north' ? -length / 2 + 0.012 : length / 2 - 0.012]
          : [side === 'west' ? -width / 2 + 0.012 : width / 2 - 0.012, 0.035, 0];
        const size: [number, number, number] = horizontal
          ? [len, 0.07, 0.024]
          : [0.024, 0.07, len];
        return (
          <mesh key={side} position={pos}>
            <boxGeometry args={size} />
            <meshStandardMaterial color="#f4f3ef" roughness={0.6} />
          </mesh>
        );
      })}

      {(['north', 'south', 'west', 'east'] as WallSide[]).map((side) => (
        <Wall key={side} side={side} room={room} fade={fade} />
      ))}

      {/* Outer ground plane so the room does not float in a void. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[width + 24, length + 24]} />
        <meshStandardMaterial color="#e9e8e3" roughness={1} />
      </mesh>
      {/* No ceiling: a closed box cannot be seen into from an orbit camera. */}
    </group>
  );
}
