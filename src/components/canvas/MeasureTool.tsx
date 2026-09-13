import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import { useEditor } from '@/store/editorStore';
import { useUI } from '@/store/uiStore';
import { resolveCatalogItem } from '@/data/catalog';
import { instanceRect } from '@/utils/placement';
import { rectCorners } from '@/utils/collision';
import { formatLength } from '@/utils/units';
import { Icon } from '../ui/Icon';

interface SnapCandidate {
  point: THREE.Vector3;
  label: string;
}

export function MeasureTool() {
  const active = useUI((s) => s.measureToolActive);
  const setMeasureActive = useUI((s) => s.setMeasureToolActive);
  const doc = useEditor((s) => s.doc);
  const unit = doc.unit;

  const { camera, gl } = useThree();
  const [point1, setPoint1] = useState<THREE.Vector3 | null>(null);
  const [point2, setPoint2] = useState<THREE.Vector3 | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [hoverPoint, setHoverPoint] = useState<THREE.Vector3 | null>(null);
  const [snappedLabel, setSnappedLabel] = useState<string | null>(null);

  const plane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const raycaster = useRef(new THREE.Raycaster());
  const ndc = useRef(new THREE.Vector2());
  const hit = useRef(new THREE.Vector3());

  // Collect potential snap points: room corners, furniture corners, centers
  const snapCandidates = useMemo<SnapCandidate[]>(() => {
    const list: SnapCandidate[] = [];
    const { width, length } = doc.room.dimensions;
    const hw = width / 2;
    const hl = length / 2;

    // Room corners
    list.push(
      { point: new THREE.Vector3(-hw, 0, -hl), label: 'NW Corner' },
      { point: new THREE.Vector3(hw, 0, -hl), label: 'NE Corner' },
      { point: new THREE.Vector3(hw, 0, hl), label: 'SE Corner' },
      { point: new THREE.Vector3(-hw, 0, hl), label: 'SW Corner' }
    );

    // Furniture corners & centers
    for (const f of doc.furniture) {
      if (!f.visible) continue;
      const cat = resolveCatalogItem(f.catalogId);
      list.push({
        point: new THREE.Vector3(f.position.x, 0, f.position.z),
        label: cat.name,
      });

      const corners = rectCorners(instanceRect(f, cat));
      for (const c of corners) {
        list.push({
          point: new THREE.Vector3(c.x, 0, c.z),
          label: `${cat.name} corner`,
        });
      }
    }
    return list;
  }, [doc.room.dimensions, doc.furniture]);

  const snapToFeatures = useCallback(
    (raw: THREE.Vector3): { point: THREE.Vector3; label: string | null } => {
      let closest: SnapCandidate | null = null;
      let minDst = 0.25; // 250mm snap threshold

      for (const cand of snapCandidates) {
        const dst = Math.hypot(cand.point.x - raw.x, cand.point.z - raw.z);
        if (dst < minDst) {
          minDst = dst;
          closest = cand;
        }
      }

      if (closest) {
        return {
          point: new THREE.Vector3(closest.point.x, 0.01, closest.point.z),
          label: closest.label,
        };
      }
      return { point: new THREE.Vector3(raw.x, 0.01, raw.z), label: null };
    },
    [snapCandidates]
  );

  useEffect(() => {
    if (!active) {
      setPoint1(null);
      setPoint2(null);
      setIsLocked(false);
      setHoverPoint(null);
      setSnappedLabel(null);
      return;
    }

    const element = gl.domElement;

    const toFloor = (clientX: number, clientY: number): THREE.Vector3 | null => {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      ndc.current.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      ndc.current.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.current.setFromCamera(ndc.current, camera);
      const hitPt = raycaster.current.ray.intersectPlane(plane.current, hit.current);
      return hitPt ? hitPt.clone() : null;
    };

    const onPointerMove = (e: PointerEvent) => {
      const pt = toFloor(e.clientX, e.clientY);
      if (!pt) return;

      const { point: snapped, label } = snapToFeatures(pt);
      setHoverPoint(snapped);
      setSnappedLabel(label);

      if (point1 && !isLocked) {
        setPoint2(snapped);
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return; // Only primary left-click
      const pt = toFloor(e.clientX, e.clientY);
      if (!pt) return;

      const { point: snapped } = snapToFeatures(pt);

      if (!point1 || isLocked) {
        setPoint1(snapped);
        setPoint2(null);
        setIsLocked(false);
      } else {
        setPoint2(snapped);
        setIsLocked(true);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isLocked || point1) {
          setPoint1(null);
          setPoint2(null);
          setIsLocked(false);
        } else {
          setMeasureActive(false);
        }
      }
    };

    element.addEventListener('pointermove', onPointerMove);
    element.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [active, camera, gl, isLocked, point1, setMeasureActive, snapToFeatures]);

  if (!active) return null;

  const currentEnd = isLocked ? point2 : point2 ?? hoverPoint;
  const distance =
    point1 && currentEnd
      ? Math.hypot(currentEnd.x - point1.x, currentEnd.z - point1.z)
      : 0;

  const dx = point1 && currentEnd ? Math.abs(currentEnd.x - point1.x) : 0;
  const dz = point1 && currentEnd ? Math.abs(currentEnd.z - point1.z) : 0;

  const mid =
    point1 && currentEnd
      ? new THREE.Vector3(
          (point1.x + currentEnd.x) / 2,
          0.06,
          (point1.z + currentEnd.z) / 2
        )
      : null;

  return (
    <group name="measure-tool">
      {/* Snap hover indicator */}
      {hoverPoint && !isLocked && (
        <mesh position={[hoverPoint.x, 0.02, hoverPoint.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.04, 0.08, 24]} />
          <meshBasicMaterial color={snappedLabel ? '#10b981' : '#588157'} transparent opacity={0.8} />
        </mesh>
      )}

      {/* Point 1 marker */}
      {point1 && (
        <group position={[point1.x, 0.02, point1.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.07, 24]} />
            <meshBasicMaterial color="#10b981" />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.09, 0.12, 24]} />
            <meshBasicMaterial color="#10b981" transparent opacity={0.5} />
          </mesh>
        </group>
      )}

      {/* Point 2 marker */}
      {currentEnd && (
        <group position={[currentEnd.x, 0.02, currentEnd.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.07, 24]} />
            <meshBasicMaterial color="#10b981" />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.09, 0.12, 24]} />
            <meshBasicMaterial color="#10b981" transparent opacity={0.5} />
          </mesh>
        </group>
      )}

      {/* Measurement line */}
      {point1 && currentEnd && distance > 0.01 && (
        <>
          <Line
            points={[
              [point1.x, 0.03, point1.z],
              [currentEnd.x, 0.03, currentEnd.z],
            ]}
            color="#10b981"
            lineWidth={3}
            dashed
            dashScale={12}
            dashSize={0.12}
            gapSize={0.06}
            depthTest={false}
            renderOrder={999}
          />

          {/* Floating dimension badge */}
          {mid && (
            <Html position={[mid.x, mid.y, mid.z]} center distanceFactor={14}>
              <div className="pointer-events-auto select-none rounded-panel border border-emerald-500/40 bg-ink-950/90 px-3 py-1.5 text-center text-white shadow-xl backdrop-blur-md">
                <div className="flex items-center gap-1.5 text-body font-semibold tracking-wide text-emerald-400">
                  <Icon name="ruler" className="h-3.5 w-3.5" />
                  <span>{formatLength(distance, unit)}</span>
                </div>
                {dx > 0.05 && dz > 0.05 && (
                  <div className="mt-0.5 text-[10px] text-ink-300">
                    ΔX: {formatLength(dx, unit)} · ΔZ: {formatLength(dz, unit)}
                  </div>
                )}
                {isLocked && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPoint1(null);
                      setPoint2(null);
                      setIsLocked(false);
                    }}
                    className="mt-1 block w-full text-[10px] text-ink-400 transition-colors hover:text-white"
                  >
                    Click to reset
                  </button>
                )}
              </div>
            </Html>
          )}
        </>
      )}
    </group>
  );
}
