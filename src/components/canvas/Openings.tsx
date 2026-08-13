import { useMemo } from 'react';
import * as THREE from 'three';
import type { Opening, RoomDimensions } from '@/types';
import { openingTransform } from '@/utils/roomGeometry';
import { deg2rad } from '@/utils/collision';

/**
 * Door and window joinery.
 *
 * The hole itself is already cut by `Room.tsx`; this draws what sits in it —
 * lining, sill, glazing, and for doors an open leaf plus the swing arc on the
 * floor. The arc matters more than it looks: it is the visual answer to "will
 * this door hit the wardrobe?", which is the single most common planning
 * mistake this app exists to prevent.
 */

const FRAME = '#e6e3da';
const FRAME_DARK = '#cfcabd';
const GLASS = '#bcd6e0';

function WindowUnit({ opening, dims }: { opening: Opening; dims: RoomDimensions }) {
  const { position, rotation } = openingTransform(opening, dims);
  const t = dims.wallThickness;
  const { width: w, height: h, sillHeight: sill } = opening;
  const frame = 0.055;

  return (
    <group position={[position.x, 0, position.z]} rotation={[0, deg2rad(rotation), 0]}>
      {/* Lining around the reveal */}
      <mesh position={[0, sill + h / 2, 0]}>
        <boxGeometry args={[w + frame, h + frame, t * 0.92]} />
        <meshStandardMaterial color={FRAME} roughness={0.7} />
      </mesh>
      {/* Glazing */}
      <mesh position={[0, sill + h / 2, 0]}>
        <boxGeometry args={[w - frame, h - frame, 0.012]} />
        <meshStandardMaterial
          color={GLASS}
          roughness={0.06}
          metalness={0.1}
          transparent
          opacity={0.42}
        />
      </mesh>
      {/* Central mullion + transom */}
      <mesh position={[0, sill + h / 2, 0]}>
        <boxGeometry args={[0.03, h - frame, 0.02]} />
        <meshStandardMaterial color={FRAME} roughness={0.7} />
      </mesh>
      {/* Outer sill, projecting into the room */}
      <mesh position={[0, sill - 0.02, 0]}>
        <boxGeometry args={[w + frame * 2.2, 0.04, t * 1.5]} />
        <meshStandardMaterial color={FRAME_DARK} roughness={0.65} />
      </mesh>
    </group>
  );
}

function DoorUnit({ opening, dims }: { opening: Opening; dims: RoomDimensions }) {
  const { position, rotation } = openingTransform(opening, dims);
  const t = dims.wallThickness;
  const { width: w, height: h } = opening;
  const frame = 0.06;
  const hingeSign = opening.hinge === 'left' ? -1 : 1;
  const swingSign = opening.swing === 'in' ? 1 : -1;

  // The leaf is drawn ~75° open, which reads unambiguously as "door" and shows
  // the true swept area rather than a flat panel that could be anything.
  const openAngle = deg2rad(75) * swingSign * -hingeSign;

  // Quarter-circle swept by the leaf: hinged at one jamb, radius = leaf width,
  // closed back to the hinge so it reads as a filled sector outline.
  const arc = useMemo(() => {
    const steps = 20;
    const hx = hingeSign * (w / 2);
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * deg2rad(90);
      points.push(
        new THREE.Vector3(
          hx - hingeSign * w * Math.cos(a),
          0.004,
          swingSign * w * Math.sin(a)
        )
      );
    }
    points.push(new THREE.Vector3(hx, 0.004, 0));
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [w, hingeSign, swingSign]);

  return (
    <group position={[position.x, 0, position.z]} rotation={[0, deg2rad(rotation), 0]}>
      {/* Lining */}
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w + frame, h + frame / 2, t * 0.92]} />
        <meshStandardMaterial color={FRAME} roughness={0.7} />
      </mesh>
      {/* The opening itself, punched back out of the lining */}
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, t * 1.1]} />
        <meshStandardMaterial color="#8f8d86" roughness={1} side={THREE.BackSide} />
      </mesh>
      {/* Threshold */}
      <mesh position={[0, 0.006, 0]}>
        <boxGeometry args={[w + frame, 0.012, t * 1.05]} />
        <meshStandardMaterial color={FRAME_DARK} roughness={0.6} />
      </mesh>

      {/* Leaf, hinged at one jamb */}
      <group position={[hingeSign * (w / 2), 0, 0]} rotation={[0, openAngle, 0]}>
        <mesh position={[-hingeSign * (w / 2), h / 2, 0]} castShadow>
          <boxGeometry args={[w - 0.01, h - 0.02, 0.04]} />
          <meshStandardMaterial color="#f0ede4" roughness={0.55} />
        </mesh>
        <mesh position={[-hingeSign * (w * 0.9), h * 0.46, 0.035]}>
          <sphereGeometry args={[0.028, 12, 10]} />
          <meshStandardMaterial color="#b6bbc0" roughness={0.25} metalness={0.8} />
        </mesh>
      </group>

      {/* Swing arc on the floor */}
      <line>
        <primitive object={arc} attach="geometry" />
        <lineBasicMaterial color="#a3b18a" transparent opacity={0.75} />
      </line>
    </group>
  );
}

export function Openings({
  openings,
  dims,
}: {
  openings: Opening[];
  dims: RoomDimensions;
}) {
  return (
    <group name="openings">
      {openings.map((o) =>
        o.kind === 'door' ? (
          <DoorUnit key={o.id} opening={o} dims={dims} />
        ) : (
          <WindowUnit key={o.id} opening={o} dims={dims} />
        )
      )}
    </group>
  );
}
