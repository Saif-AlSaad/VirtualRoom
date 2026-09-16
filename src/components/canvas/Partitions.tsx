import { useCallback, useMemo, useState } from 'react';
import { type ThreeEvent } from '@react-three/fiber';
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
  const select = useEditor((s) => s.select);
  const beginGesture = useEditor((s) => s.beginGesture);
  const startDrag = useDrag((s) => s.start);
  const viewMode = useUI((s) => s.viewMode);
  const viewerMode = useUI((s) => s.viewerMode);
  const unit = useEditor((s) => s.doc.unit);

  const [hovered, setHovered] = useState(false);

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

      const grab = { x: event.point.x, z: event.point.z };
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

      {/* Main volumetric wall mesh */}
      <mesh
        position={[0, height / 2, 0]}
        castShadow
        receiveShadow
        onPointerDown={onPointerDown}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
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
