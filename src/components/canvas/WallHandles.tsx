import { useCallback, useRef, useState } from 'react';
import * as THREE from 'three';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { RoomDimensions, WallSide } from '@/types';
import { useEditor } from '@/store/editorStore';
import { useUI } from '@/store/uiStore';
import { useDrag } from '@/store/dragStore';
import { ROOM_LIMITS } from '@/utils/placement';
import { formatLength } from '@/utils/units';
import { snapToStep } from '@/utils/snapping';

interface WallHandleProps {
  side: WallSide;
  dims: RoomDimensions;
}

function WallHandle({ side, dims }: WallHandleProps) {
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ mousePos: number; initialDim: number } | null>(null);
  const unit = useEditor((s) => s.doc.unit);
  const resizeRoomLive = useEditor((s) => s.resizeRoomLive);
  const beginGesture = useEditor((s) => s.beginGesture);
  const endGesture = useEditor((s) => s.endGesture);

  const { camera, gl } = useThree();
  const plane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const raycaster = useRef(new THREE.Raycaster());
  const ndc = useRef(new THREE.Vector2());
  const hit = useRef(new THREE.Vector3());

  const isNorthOrSouth = side === 'north' || side === 'south';
  const { width, length, height, wallThickness } = dims;

  // Placement in world space
  const position: [number, number, number] = isNorthOrSouth
    ? [0, height * 0.45, side === 'north' ? -length / 2 - wallThickness : length / 2 + wallThickness]
    : [side === 'west' ? -width / 2 - wallThickness : width / 2 + wallThickness, height * 0.45, 0];

  const rotation: [number, number, number] = isNorthOrSouth
    ? [0, 0, 0]
    : [0, Math.PI / 2, 0];

  const barWidth = Math.min(isNorthOrSouth ? width * 0.6 : length * 0.6, 2.4);

  const onPointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (e.button !== 0) return;
      e.stopPropagation();

      const element = gl.domElement;
      const rect = element.getBoundingClientRect();
      ndc.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.current.setFromCamera(ndc.current, camera);
      const hitPt = raycaster.current.ray.intersectPlane(plane.current, hit.current);
      if (!hitPt) return;

      const initialDim = isNorthOrSouth ? length : width;
      const mousePos = isNorthOrSouth ? hitPt.z : hitPt.x;
      dragStart.current = { mousePos, initialDim };

      beginGesture('Resize room');
      setDragging(true);

      const onWindowPointerMove = (ev: PointerEvent) => {
        if (!dragStart.current) return;
        ndc.current.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
        ndc.current.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.current.setFromCamera(ndc.current, camera);
        const currentHit = raycaster.current.ray.intersectPlane(plane.current, hit.current);
        if (!currentHit) return;

        const currentPos = isNorthOrSouth ? currentHit.z : currentHit.x;
        const delta = (currentPos - dragStart.current.mousePos) * (side === 'north' || side === 'west' ? -2 : 2);
        const rawTarget = dragStart.current.initialDim + delta;

        // Snap to 0.1m increments
        const snapped = snapToStep(rawTarget, 0.1);

        if (isNorthOrSouth) {
          const clamped = THREE.MathUtils.clamp(snapped, ROOM_LIMITS.minLength, ROOM_LIMITS.maxLength);
          resizeRoomLive({ length: clamped });
        } else {
          const clamped = THREE.MathUtils.clamp(snapped, ROOM_LIMITS.minWidth, ROOM_LIMITS.maxWidth);
          resizeRoomLive({ width: clamped });
        }
      };

      const onWindowPointerUp = () => {
        dragStart.current = null;
        setDragging(false);
        endGesture();
        window.removeEventListener('pointermove', onWindowPointerMove);
        window.removeEventListener('pointerup', onWindowPointerUp);
        window.removeEventListener('pointercancel', onWindowPointerUp);
      };

      window.addEventListener('pointermove', onWindowPointerMove);
      window.addEventListener('pointerup', onWindowPointerUp);
      window.addEventListener('pointercancel', onWindowPointerUp);
    },
    [beginGesture, camera, endGesture, gl.domElement, isNorthOrSouth, length, resizeRoomLive, side, width]
  );

  const currentDimValue = isNorthOrSouth ? length : width;

  return (
    <group position={position} rotation={rotation}>
      {/* Visual pill handle */}
      <mesh
        onPointerDown={onPointerDown}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
        renderOrder={100}
      >
        <capsuleGeometry args={[0.04, barWidth, 12, 16]} />
        <meshStandardMaterial
          color={dragging ? '#10b981' : hovered ? '#588157' : '#71717a'}
          roughness={0.3}
          metalness={0.2}
          transparent
          opacity={dragging ? 0.95 : hovered ? 0.8 : 0.45}
        />
      </mesh>

      {/* Hover dimension badge */}
      {(hovered || dragging) && (
        <Html position={[0, 0.18, 0]} center distanceFactor={14}>
          <div className="pointer-events-none select-none rounded-control border border-sage-500/50 bg-ink-950/90 px-2 py-1 text-[11px] font-medium text-sage-100 shadow-md backdrop-blur-sm whitespace-nowrap">
            {formatLength(currentDimValue, unit)} (drag to resize)
          </div>
        </Html>
      )}
    </group>
  );
}

export function WallHandles() {
  const doc = useEditor((s) => s.doc);
  const viewMode = useUI((s) => s.viewMode);
  const presentation = useUI((s) => s.presentationMode);
  const dragMode = useDrag((s) => s.mode);

  if (viewMode === 'walk' || presentation || dragMode !== null) return null;

  return (
    <group name="wall-handles">
      <WallHandle side="north" dims={doc.room.dimensions} />
      <WallHandle side="south" dims={doc.room.dimensions} />
      <WallHandle side="west" dims={doc.room.dimensions} />
      <WallHandle side="east" dims={doc.room.dimensions} />
    </group>
  );
}
