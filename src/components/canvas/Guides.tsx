import { useMemo } from 'react';
import { Html, Line } from '@react-three/drei';
import type { DocumentState } from '@/types';
import { useDrag } from '@/store/dragStore';
import { useEditor } from '@/store/editorStore';
import { useUI } from '@/store/uiStore';
import { formatLengthShort } from '@/utils/units';
import { instanceRect, partitionRect } from '@/utils/placement';
import { resolveCatalogItem } from '@/data/catalog';

/**
 * Non-geometry viewport overlays: snap guides, room dimension labels, and the
 * inline reason when a placement is invalid.
 *
 * The invalid-placement treatment is deliberate. The brief's original idea was
 * a camera shake; this shows a red outline (drawn by FurnitureItem) plus a
 * short text label naming the actual conflict — "Overlaps with Sofa". Motion
 * tells you something is wrong; text tells you what to do about it, and it
 * survives being screenshotted into a bug report.
 */

const ACCENT = '#588157';
const WALL_GUIDE = '#3a5a40';

export function SnapGuides({ doc }: { doc: DocumentState }) {
  const guides = useDrag((s) => s.guides);
  const dims = doc.room.dimensions;

  if (guides.length === 0) return null;

  const hw = dims.width / 2 + 0.4;
  const hl = dims.length / 2 + 0.4;

  return (
    <group name="snap-guides">
      {guides.map((g, i) => (
        <Line
          key={`${g.axis}-${g.value}-${i}`}
          points={
            g.axis === 'x'
              ? [
                  [g.value, 0.02, -hl],
                  [g.value, 0.02, hl],
                ]
              : [
                  [-hw, 0.02, g.value],
                  [hw, 0.02, g.value],
                ]
          }
          color={g.kind === 'wall' ? WALL_GUIDE : ACCENT}
          lineWidth={1.4}
          dashed
          dashSize={0.12}
          gapSize={0.08}
          transparent
          opacity={0.85}
          depthTest={false}
          renderOrder={998}
        />
      ))}
    </group>
  );
}

/** Floating label naming the current conflict, pinned to the dragged object. */
export function InvalidPlacementLabel({ doc }: { doc: DocumentState }) {
  const reason = useDrag((s) => s.invalidReason);
  const targets = useDrag((s) => s.targets);

  const anchor = useMemo(() => {
    const id = targets[0]?.id;
    if (!id) return null;
    const instance = doc.furniture.find((f) => f.instanceId === id);
    if (!instance) return null;
    const catalog = resolveCatalogItem(instance.catalogId);
    return {
      x: instance.position.x,
      y: catalog.elevation + catalog.size.h * instance.scale.y + 0.18,
      z: instance.position.z,
    };
  }, [targets, doc.furniture]);

  if (!reason || !anchor) return null;

  return (
    <Html
      position={[anchor.x, anchor.y, anchor.z]}
      center
      distanceFactor={8}
      zIndexRange={[40, 0]}
      style={{ pointerEvents: 'none' }}
    >
      <div
        role="status"
        className="whitespace-nowrap rounded-control bg-danger px-2 py-1 text-caption font-medium text-white shadow-medium"
      >
        {reason}
      </div>
    </Html>
  );
}

/** Room dimension chips along two edges, in the project's unit. */
export function RoomDimensions({ doc }: { doc: DocumentState }) {
  const show = useUI((s) => s.showDimensions);
  const { width, length } = doc.room.dimensions;
  const unit = doc.unit;

  if (!show) return null;

  const hw = width / 2;
  const hl = length / 2;
  const off = 0.36;

  return (
    <group name="room-dimensions">
      <Line
        points={[
          [-hw, 0.01, hl + off],
          [hw, 0.01, hl + off],
        ]}
        color={WALL_GUIDE}
        lineWidth={1.2}
        transparent
        opacity={0.5}
      />
      <Line
        points={[
          [hw + off, 0.01, -hl],
          [hw + off, 0.01, hl],
        ]}
        color={WALL_GUIDE}
        lineWidth={1.2}
        transparent
        opacity={0.5}
      />
      <Html position={[0, 0.02, hl + off + 0.12]} center distanceFactor={11} style={{ pointerEvents: 'none' }}>
        <div className="rounded-control bg-white/95 px-2 py-0.5 text-caption font-medium text-ink-700 shadow-subtle backdrop-blur-xs border border-ink-200/60 dark:border-ink-700/80 dark:bg-ink-900/95 dark:text-sage-100">
          {formatLengthShort(width, unit)}
        </div>
      </Html>
      <Html position={[hw + off + 0.12, 0.02, 0]} center distanceFactor={11} style={{ pointerEvents: 'none' }}>
        <div className="rounded-control bg-white/95 px-2 py-0.5 text-caption font-medium text-ink-700 shadow-subtle backdrop-blur-xs border border-ink-200/60 dark:border-ink-700/80 dark:bg-ink-900/95 dark:text-sage-100">
          {formatLengthShort(length, unit)}
        </div>
      </Html>
    </group>
  );
}

/** Dimension chip on the selected object, so "how big is that?" is answered. */
export function SelectionDimensions({ doc }: { doc: DocumentState }) {
  const selection = useEditor((s) => s.selection);
  const show = useUI((s) => s.showDimensions);

  const target = useMemo(() => {
    if (!show || selection.length !== 1) return null;
    const selectedId = selection[0];
    const instance = doc.furniture.find((f) => f.instanceId === selectedId);
    if (instance) {
      const catalog = resolveCatalogItem(instance.catalogId);
      const rect = instanceRect(instance, catalog);
      return {
        rect,
        height: catalog.size.h * instance.scale.y + catalog.elevation,
      };
    }
    const partition = (doc.room.partitions ?? []).find((p) => p.id === selectedId);
    if (partition) {
      const rect = partitionRect(partition);
      return {
        rect,
        height: partition.height ?? doc.room.dimensions.height,
      };
    }
    return null;
  }, [selection, doc.furniture, doc.room.partitions, doc.room.dimensions.height, show]);

  if (!target) return null;

  return (
    <Html
      position={[target.rect.cx, target.height + 0.1, target.rect.cz]}
      center
      distanceFactor={10}
      style={{ pointerEvents: 'none' }}
    >
      <div className="whitespace-nowrap rounded-control bg-sage-800/95 px-2 py-1 text-caption font-medium tabular-nums text-sage-50 shadow-medium border border-sage-700/50 backdrop-blur-xs">
        {formatLengthShort(target.rect.w, doc.unit)} ×{' '}
        {formatLengthShort(target.rect.d, doc.unit)}
      </div>
    </Html>
  );
}
