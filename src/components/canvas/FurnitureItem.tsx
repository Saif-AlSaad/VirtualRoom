import { useCallback, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import type { CatalogItem, FurnitureInstance, IssueSeverity } from '@/types';
import { FurnitureModel } from './models/FurnitureModel';
import { deg2rad } from '@/utils/collision';
import { useEditor } from '@/store/editorStore';
import { useDrag } from '@/store/dragStore';
import { useUI } from '@/store/uiStore';

/**
 * One placed object: geometry, hit testing, selection affordances and the
 * drop-in animation.
 *
 * SELECTION VISUAL — a 2 px accent footprint outline plus four corner handles,
 * drawn on the floor rather than as a glow around the mesh. A floor outline
 * tells you where the object actually *sits*, which is the thing you are
 * reasoning about in a planner; a glow only tells you what is selected, which
 * you already know because you just clicked it.
 *
 * Validity is communicated by outline colour AND by the tooltip the viewport
 * renders — never colour alone.
 */

const ACCENT = '#588157';
const ERROR = '#ef4444';
const WARNING = '#f59e0b';
const LOCKED = '#71717a';

interface Props {
  instance: FurnitureInstance;
  catalog: CatalogItem;
  selected: boolean;
  severity: IssueSeverity | null;
  /** True while this object is the one being dragged. */
  dragging: boolean;
}

export function FurnitureItem({
  instance,
  catalog,
  selected,
  severity,
  dragging,
}: Props) {
  const { gl } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const select = useEditor((s) => s.select);
  const beginGesture = useEditor((s) => s.beginGesture);
  const startDrag = useDrag((s) => s.start);
  const startRotate = useDrag((s) => s.startRotate);
  const dragMode = useDrag((s) => s.mode);
  const dragTargets = useDrag((s) => s.targets);
  const showClearance = useUI((s) => s.showClearance);
  const reducedMotion = useUI((s) => s.reducedMotion);
  const viewMode = useUI((s) => s.viewMode);
  const viewerMode = useUI((s) => s.viewerMode);
  const timeOfDay = useUI((s) => s.timeOfDay);

  const [hovered, setHovered] = useState(false);
  const [rotateHovered, setRotateHovered] = useState(false);

  const isRotating = dragMode === 'rotate' && dragTargets[0]?.id === instance.instanceId;

  const w = catalog.size.w * instance.scale.x;
  const d = catalog.size.d * instance.scale.z;
  const h = catalog.size.h * instance.scale.y;

  // ── Drop-in animation ───────────────────────────────────────────────────
  // 0.8 → 1.05 → 1, ~380 ms. Runs once on mount and is skipped entirely when
  // the user has asked for reduced motion.
  const birth = useRef(reducedMotion ? 1 : 0);
  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    if (birth.current < 1) {
      birth.current = Math.min(1, birth.current + delta / 0.38);
      const t = birth.current;
      // Overshoot curve: eased approach that peaks at 1.05 around t ≈ 0.7.
      const eased = 1 - Math.pow(1 - t, 3);
      const overshoot = Math.sin(t * Math.PI) * 0.05;
      const s = 0.8 + eased * 0.2 + overshoot;
      group.scale.setScalar(s);
    } else if (group.scale.x !== 1) {
      group.scale.setScalar(1);
    }
  });

  // ── Interaction ─────────────────────────────────────────────────────────
  const onPointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      // Walkthrough mode is for looking, not editing.
      if (viewMode === 'walk') return;
      event.stopPropagation();
      (event.target as Element | null)?.releasePointerCapture?.(event.pointerId);

      const additive = event.shiftKey || event.metaKey || event.ctrlKey;
      const state = useEditor.getState();
      const alreadySelected = state.selection.includes(instance.instanceId);

      if (!alreadySelected || additive) {
        select(instance.instanceId, additive);
      }

      if (instance.locked || viewerMode) return;

      // Project the screen ray onto the floor plane (y = 0) so the grab point
      // aligns seamlessly with DragController's analytical floor coordinates,
      // eliminating any initial jumping regardless of which 3D point or face was clicked.
      const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const floorHit = new THREE.Vector3();
      const floorPoint = event.ray ? event.ray.intersectPlane(floorPlane, floorHit) : null;
      const grab = floorPoint ? { x: floorPoint.x, z: floorPoint.z } : { x: event.point.x, z: event.point.z };

      // Drag every selected object together, each keeping its own offset from
      // the grab point — that is what makes group move feel rigid.
      const ids =
        alreadySelected && state.selection.length > 1
          ? state.selection
          : [instance.instanceId];
      const targets = ids
        .map((id) => {
          const f = state.doc.furniture.find((x) => x.instanceId === id);
          if (!f || f.locked) return null;
          return {
            id,
            offset: {
              x: f.position.x - grab.x,
              z: f.position.z - grab.z,
            },
          };
        })
        .filter((t): t is { id: string; offset: { x: number; z: number } } => t !== null);

      if (targets.length === 0) return;

      beginGesture(targets.length > 1 ? 'Move items' : 'Move item');
      startDrag('move', targets);
    },
    [
      beginGesture,
      instance.instanceId,
      instance.locked,
      select,
      startDrag,
      viewMode,
      viewerMode,
    ]
  );

  const onRotateStart = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (viewMode === 'walk') return;
      event.stopPropagation();
      (event.target as Element | null)?.releasePointerCapture?.(event.pointerId);

      const state = useEditor.getState();
      if (!state.selection.includes(instance.instanceId)) {
        select(instance.instanceId, false);
      }

      if (instance.locked || viewerMode) return;

      const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const floorHit = new THREE.Vector3();
      const floorPoint = event.ray ? event.ray.intersectPlane(floorPlane, floorHit) : null;
      const point = floorPoint ?? event.point;

      const startAngle = Math.atan2(
        point.x - instance.position.x,
        point.z - instance.position.z
      );

      beginGesture('Rotate item');
      startRotate(instance.instanceId, startAngle, instance.rotation);
    },
    [
      beginGesture,
      instance.instanceId,
      instance.locked,
      instance.position.x,
      instance.position.z,
      instance.rotation,
      select,
      startRotate,
      viewMode,
      viewerMode,
    ]
  );

  // ── Selection affordances ───────────────────────────────────────────────
  const outlineColor = severity === 'error' ? ERROR : severity === 'warning' ? WARNING : instance.locked ? LOCKED : ACCENT;
  const showOutline = selected || hovered || severity !== null;

  const footprint = useMemo<Array<[number, number, number]>>(() => {
    const hw = w / 2;
    const hd = d / 2;
    const y = 0.008;
    return [
      [-hw, y, -hd],
      [hw, y, -hd],
      [hw, y, hd],
      [-hw, y, hd],
      [-hw, y, -hd],
    ];
  }, [w, d]);

  const corners = useMemo<Array<[number, number, number]>>(() => {
    const hw = w / 2;
    const hd = d / 2;
    return [
      [-hw, 0.012, -hd],
      [hw, 0.012, -hd],
      [hw, 0.012, hd],
      [-hw, 0.012, hd],
    ];
  }, [w, d]);

  const stalkLength = Math.max(0.35, d * 0.28);
  const clearance = catalog.clearance;
  const hasClearanceZone =
    clearance.front + clearance.back + clearance.left + clearance.right > 0;
  const elevation = instance.elevation ?? catalog.elevation;

  return (
    <group
      position={[instance.position.x, elevation, instance.position.z]}
      rotation={[0, deg2rad(instance.rotation), 0]}
      visible={instance.visible}
    >
      {/* Clearance footprint, shown for the selected object or globally when
          the user turns the overlay on. */}
      {hasClearanceZone && (showClearance || selected) && (!dragging || selected) && (
        <mesh
          position={[
            (clearance.right - clearance.left) / 2,
            0.003,
            (clearance.front - clearance.back) / 2,
          ]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry
            args={[w + clearance.left + clearance.right, d + clearance.front + clearance.back]}
          />
          <meshBasicMaterial
            color={severity === 'warning' ? WARNING : ACCENT}
            transparent
            opacity={severity === 'warning' ? 0.24 : 0.12}
            depthWrite={false}
          />
        </mesh>
      )}

      {showOutline && (
        <>
          <Line
            points={footprint}
            color={outlineColor}
            lineWidth={selected ? 2.4 : 1.6}
            transparent
            opacity={selected ? 1 : 0.6}
            depthTest={false}
            renderOrder={999}
          />
          {selected &&
            corners.map((c, i) => (
              <mesh
                key={i}
                position={c}
                rotation={[-Math.PI / 2, 0, 0]}
                renderOrder={1000}
                onPointerDown={onRotateStart}
                onPointerOver={(e) => {
                  e.stopPropagation();
                  gl.domElement.style.cursor = 'crosshair';
                }}
                onPointerOut={() => {
                  gl.domElement.style.cursor = 'auto';
                }}
              >
                <planeGeometry args={[0.08, 0.08]} />
                <meshBasicMaterial color={outlineColor} depthTest={false} transparent />
              </mesh>
            ))}

          {/* Interactive rotation stalk & knob handle extending in front of furniture */}
          {selected && !instance.locked && !viewerMode && (
            <group position={[0, 0.015, d / 2]}>
              <Line
                points={[
                  [0, 0, 0],
                  [0, 0, stalkLength],
                ]}
                color={outlineColor}
                lineWidth={2}
                transparent
                opacity={0.85}
                depthTest={false}
                renderOrder={999}
              />
              <group position={[0, 0, stalkLength]}>
                {/* Visual outer ring */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={1001}>
                  <ringGeometry args={[0.065, 0.088, 32]} />
                  <meshBasicMaterial
                    color={rotateHovered || isRotating ? '#10b981' : outlineColor}
                    depthTest={false}
                    transparent
                  />
                </mesh>
                {/* Visual inner disc */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={1001}>
                  <circleGeometry args={[0.048, 32]} />
                  <meshBasicMaterial
                    color={rotateHovered || isRotating ? '#10b981' : '#ffffff'}
                    depthTest={false}
                    transparent
                    opacity={0.95}
                  />
                </mesh>
                {/* Invisible hit proxy for easy grabbing */}
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
        </>
      )}

      {/* Floating live rotation angle badge */}
      {isRotating && (
        <Html
          position={[0, h + 0.35, 0]}
          center
          distanceFactor={12}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          <div className="flex items-center gap-1.5 rounded-full border border-sage-500/70 bg-ink-950/90 px-3 py-1 text-xs font-semibold text-sage-100 shadow-2xl backdrop-blur-md whitespace-nowrap">
            <span className="text-emerald-400 font-bold">↻</span>
            <span className="tabular-nums">{Math.round(instance.rotation)}°</span>
            <span className="text-[10px] text-ink-400 font-normal ml-1">
              (Shift for free angle)
            </span>
          </div>
        </Html>
      )}

      {/* Animated wrapper — scale lives here so the outline is not squashed by
          the drop-in bounce. Direct pointer down attached so clicking any 3D part moves */}
      <group
        ref={groupRef}
        onPointerDown={onPointerDown}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          gl.domElement.style.cursor = instance.locked ? 'not-allowed' : 'move';
        }}
        onPointerOut={() => {
          setHovered(false);
          gl.domElement.style.cursor = 'auto';
        }}
      >
        <group scale={[instance.scale.x, instance.scale.y, instance.scale.z]}>
          <FurnitureModel catalog={catalog} instance={instance} />
        </group>
      </group>

      {/* Dynamic local light emission for lamps and fixtures */}
      {catalog.isLight && (instance.lightEnabled ?? true) && (
        <pointLight
          position={[
            (catalog.lightOffset?.x ?? 0) * instance.scale.x,
            (catalog.lightOffset?.y ?? h * 0.9),
            (catalog.lightOffset?.z ?? 0) * instance.scale.z,
          ]}
          color={instance.lightColor ?? catalog.lightColor ?? '#ffe5b4'}
          intensity={
            (instance.lightIntensity ?? catalog.lightIntensity ?? 1.5) *
            (timeOfDay === 'night' ? 2.2 : 0.85)
          }
          distance={7.0}
          decay={1.8}
        />
      )}

      {/* Invisible-but-pickable proxy. A `visible={false}` mesh is skipped by
          the raycaster, so this uses a fully transparent material instead —
          it guarantees a hit anywhere in the bounding box, including the gaps
          between a chair's legs. */}
      <mesh
        position={[0, h / 2, 0]}
        onPointerDown={onPointerDown}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          gl.domElement.style.cursor = instance.locked ? 'not-allowed' : 'move';
        }}
        onPointerOut={() => {
          setHovered(false);
          gl.domElement.style.cursor = 'auto';
        }}
      >
        <boxGeometry args={[w, h, d]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Lock badge: a second, non-colour signal that the object cannot move. */}
      {instance.locked && selected && (
        <mesh position={[0, h + 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.1, 0.1]} />
          <meshBasicMaterial color={LOCKED} transparent opacity={0.9} depthTest={false} />
        </mesh>
      )}
    </group>
  );
}
