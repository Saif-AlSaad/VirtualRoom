import { useCallback, useMemo, useState } from 'react';
import * as THREE from 'three';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import type { WallPartition, WallFinish } from '@/types';
import { useEditor } from '@/store/editorStore';
import { useDrag } from '@/store/dragStore';
import { useUI } from '@/store/uiStore';
import { deg2rad } from '@/utils/collision';
import { getWallMaterialProperties, getWallTexture } from '@/utils/wallTexture';
import { formatLengthShort } from '@/utils/units';

const ACCENT = '#588157';

interface PartitionItemProps {
  partition: WallPartition;
  roomWalls: WallFinish;
  selected: boolean;
}

function PartitionItem({ partition, roomWalls, selected }: PartitionItemProps) {
  const { gl } = useThree();
  const select = useEditor((s) => s.select);
  const beginGesture = useEditor((s) => s.beginGesture);
  const startDrag = useDrag((s) => s.start);
  const startRotate = useDrag((s) => s.startRotate);
  const dragMode = useDrag((s) => s.mode);
  const dragTargets = useDrag((s) => s.targets);
  const viewMode = useUI((s) => s.viewMode);
  const viewerMode = useUI((s) => s.viewerMode);
  const unit = useEditor((s) => s.doc.unit);

  const [hovered, setHovered] = useState(false);
  const [rotateHovered, setRotateHovered] = useState(false);

  const isRotating = dragMode === 'rotate' && dragTargets[0]?.id === partition.id;

  const { length, thickness, height, position, rotation } = partition;
  const finish = partition.finish ?? roomWalls;

  // Visual texturing
  const texture = useMemo(
    () => getWallTexture(finish, length, height),
    [finish, length, height]
  );
  const matProps = useMemo(
    () => getWallMaterialProperties(finish.pattern),
    [finish.pattern]
  );

  const isHalfWall = height < 1.8;

  // Footprint outline points on the floor (local coords)
  const footprint = useMemo<Array<[number, number, number]>>(() => {
    const hw = thickness / 2;
    const hl = length / 2;
    const y = 0.008;
    return [
      [-hw, y, -hl],
      [hw, y, -hl],
      [hw, y, hl],
      [-hw, y, hl],
      [-hw, y, -hl],
    ];
  }, [thickness, length]);

  const onPointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (viewMode === 'walk') return;
      event.stopPropagation();
      (event.target as Element | null)?.releasePointerCapture?.(event.pointerId);

      const additive = event.shiftKey || event.metaKey || event.ctrlKey;
      select(partition.id, additive);

      if (viewerMode) return;

      const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const floorHit = new THREE.Vector3();
      const floorPoint = event.ray ? event.ray.intersectPlane(floorPlane, floorHit) : null;
      const grab = floorPoint ? { x: floorPoint.x, z: floorPoint.z } : { x: event.point.x, z: event.point.z };

      beginGesture('Move interior wall');
      startDrag('move', [
        {
          id: partition.id,
          offset: {
            x: position.x - grab.x,
            z: position.z - grab.z,
          },
        },
      ]);
    },
    [beginGesture, partition.id, position.x, position.z, select, startDrag, viewMode, viewerMode]
  );

  const onRotateStart = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (viewMode === 'walk') return;
      event.stopPropagation();
      (event.target as Element | null)?.releasePointerCapture?.(event.pointerId);

      const state = useEditor.getState();
      if (!state.selection.includes(partition.id)) {
        select(partition.id, false);
      }

      if (viewerMode) return;

      const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const floorHit = new THREE.Vector3();
      const floorPoint = event.ray ? event.ray.intersectPlane(floorPlane, floorHit) : null;
      const point = floorPoint ?? event.point;

      const startAngle = Math.atan2(
        point.x - position.x,
        point.z - position.z
      );

      beginGesture('Rotate interior wall');
      startRotate(partition.id, startAngle, rotation);
    },
    [beginGesture, partition.id, position.x, position.z, rotation, select, startRotate, viewMode, viewerMode]
  );

  const stalkLength = Math.max(0.35, length * 0.25);

  return (
    <group
      position={[position.x, 0, position.z]}
      rotation={[0, deg2rad(rotation), 0]}
    >
      {/* Selection outline on floor */}
      {(selected || hovered) && (
        <Line
          points={footprint}
          color={ACCENT}
          lineWidth={selected ? 2.6 : 1.6}
          transparent
          opacity={selected ? 1 : 0.6}
          depthTest={false}
          renderOrder={999}
        />
      )}

      {/* Interactive rotation handle stalk & knob when selected */}
      {selected && !viewerMode && (
        <group position={[0, 0.015, length / 2]}>
          <Line
            points={[
              [0, 0, 0],
              [0, 0, stalkLength],
            ]}
            color={ACCENT}
            lineWidth={2}
            transparent
            opacity={0.85}
            depthTest={false}
            renderOrder={999}
          />
          <group position={[0, 0, stalkLength]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={1001}>
              <ringGeometry args={[0.065, 0.088, 32]} />
              <meshBasicMaterial
                color={rotateHovered || isRotating ? '#10b981' : ACCENT}
                depthTest={false}
                transparent
              />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={1001}>
              <circleGeometry args={[0.048, 32]} />
              <meshBasicMaterial
                color={rotateHovered || isRotating ? '#10b981' : '#ffffff'}
                depthTest={false}
                transparent
                opacity={0.95}
              />
            </mesh>
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              renderOrder={1002}
              onPointerDown={onRotateStart}
              onPointerOver={(e) => {
                e.stopPropagation();
                gl.domElement.style.cursor = 'crosshair';
                setRotateHovered(true);
              }}
              onPointerOut={() => {
                gl.domElement.style.cursor = 'auto';
                setRotateHovered(false);
              }}
            >
              <circleGeometry args={[0.16, 16]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          </group>
        </group>
      )}

      {/* Floating live rotation angle badge */}
      {isRotating && (
        <Html
          position={[0, height + 0.35, 0]}
          center
          distanceFactor={12}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          <div className="flex items-center gap-1.5 rounded-full border border-sage-500/70 bg-ink-950/90 px-3 py-1 text-xs font-semibold text-sage-100 shadow-2xl backdrop-blur-md whitespace-nowrap">
            <span className="text-emerald-400 font-bold">↻</span>
            <span className="tabular-nums">{Math.round(rotation)}°</span>
            <span className="text-[10px] text-ink-400 font-normal ml-1">
              (Shift for free angle)
            </span>
          </div>
        </Html>
      )}

      {/* Main volumetric wall mesh */}
      <mesh
        position={[0, height / 2, 0]}
        castShadow
        receiveShadow
        onPointerDown={onPointerDown}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          gl.domElement.style.cursor = 'move';
        }}
        onPointerOut={() => {
          setHovered(false);
          gl.domElement.style.cursor = 'auto';
        }}
      >
        <boxGeometry args={[thickness, height, length]} />
        <meshStandardMaterial
          color={finish.color}
          map={texture}
          roughness={matProps.roughness}
          metalness={matProps.metalness}
        />
      </mesh>

      {/* Baseboards (skirting trim) on both faces */}
      <group>
        <mesh position={[thickness / 2 + 0.008, 0.045, 0]} castShadow>
          <boxGeometry args={[0.015, 0.09, length]} />
          <meshStandardMaterial color="#f0eee9" roughness={0.4} />
        </mesh>
        <mesh position={[-thickness / 2 - 0.008, 0.045, 0]} castShadow>
          <boxGeometry args={[0.015, 0.09, length]} />
          <meshStandardMaterial color="#f0eee9" roughness={0.4} />
        </mesh>
      </group>

      {/* Top cap: stylish architectural cap for half-walls or crisp coping */}
      <mesh
        position={[0, height + 0.012, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry
          args={[
            thickness + (isHalfWall ? 0.03 : 0.006),
            0.024,
            length + (isHalfWall ? 0.02 : 0.006),
          ]}
        />
        <meshStandardMaterial
          color={isHalfWall ? '#d4b996' : '#dedad2'}
          roughness={isHalfWall ? 0.5 : 0.7}
        />
      </mesh>

      {/* 2D dimension label when selected or in 2D mode */}
      {selected && viewMode === '2d' && (
        <Html
          position={[0, height + 0.1, 0]}
          center
          style={{ pointerEvents: 'none' }}
        >
          <div className="rounded bg-ink-900/80 px-1.5 py-0.5 text-[11px] font-semibold text-white shadow">
            {formatLengthShort(length, unit)}
          </div>
        </Html>
      )}
    </group>
  );
}

export function Partitions() {
  const partitions = useEditor((s) => s.doc.room.partitions);
  const roomWalls = useEditor((s) => s.doc.room.walls);
  const selection = useEditor((s) => s.selection);

  if (!partitions || partitions.length === 0) return null;

  return (
    <group name="interior-partitions">
      {partitions.map((p) => (
        <PartitionItem
          key={p.id}
          partition={p}
          roomWalls={roomWalls}
          selected={selection.includes(p.id)}
        />
      ))}
    </group>
  );
}
