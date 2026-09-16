import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useEditor } from '@/store/editorStore';
import { useDrag } from '@/store/dragStore';
import { useUI } from '@/store/uiStore';
import { computeSnap } from '@/utils/snapping';
import { instanceRect, isPlacementValid } from '@/utils/placement';
import { clampRectToRoom, normalizeAngle } from '@/utils/collision';
import { resolveCatalogItem } from '@/data/catalog';
import type { Rect } from '@/types';

/**
 * Drives move and rotate gestures.
 *
 * Pointer tracking is attached to the WINDOW rather than to a mesh. Dragging
 * furniture past the edge of the room — or off the canvas entirely — must not
 * drop the gesture, and mesh-level pointermove stops firing the moment the
 * cursor leaves the mesh. The floor position is computed analytically against
 * the y = 0 plane, so there is no invisible ground mesh to raycast either.
 *
 * Every frame writes through `mutateLive`, which does NOT touch history; the
 * single undo entry was captured by `beginGesture` when the drag started.
 */
export function DragController() {
  const { camera, gl } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const plane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const ndc = useRef(new THREE.Vector2());
  const hit = useRef(new THREE.Vector3());

  useEffect(() => {
    const element = gl.domElement;

    const toFloor = (clientX: number, clientY: number) => {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      ndc.current.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      ndc.current.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.current.setFromCamera(ndc.current, camera);
      return raycaster.current.ray.intersectPlane(plane.current, hit.current);
    };

    const onPointerMove = (event: PointerEvent) => {
      const drag = useDrag.getState();
      if (drag.mode !== 'move' && drag.mode !== 'rotate') return;

      const point = toFloor(event.clientX, event.clientY);
      if (!point) return;

      const editor = useEditor.getState();
      const doc = editor.doc;
      const dims = doc.room.dimensions;
      const snapSettings = useUI.getState().snap;
      // Holding Alt is the universal "ignore snapping" modifier.
      const settings = event.altKey
        ? { ...snapSettings, grid: false, wall: false, furniture: false, rotationStep: 0 }
        : snapSettings;

      if (drag.mode === 'rotate') {
        const target = drag.targets[0];
        if (!target) return;
        const instance = doc.furniture.find((f) => f.instanceId === target.id);
        const partition = (doc.room.partitions ?? []).find((p) => p.id === target.id);
        if (!instance && !partition) return;

        const center = instance ? instance.position : partition!.position;
        const angle = Math.atan2(
          point.x - center.x,
          point.z - center.z
        );
        const deltaDeg = ((angle - drag.startAngle) * 180) / Math.PI;
        let next = normalizeAngle(drag.startRotation + deltaDeg);
        if (settings.rotationStep > 0) {
          next =
            normalizeAngle(
              Math.round(next / settings.rotationStep) * settings.rotationStep
            );
        }

        editor.mutateLive((d) => {
          if (instance) {
            const f = d.furniture.find((x) => x.instanceId === target.id);
            if (!f || f.locked) return;
            f.rotation = next;
            f.position = clampRectToRoom(instanceRect(f), dims.width, dims.length);
          } else if (partition) {
            const p = (d.room.partitions ?? []).find((x) => x.id === target.id);
            if (p) p.rotation = next;
          }
        });
        return;
      }

      // ── Move ──────────────────────────────────────────────────────────
      const primary = drag.targets[0];
      if (!primary) return;

      const primaryPartition = (doc.room.partitions ?? []).find((p) => p.id === primary.id);
      if (primaryPartition) {
        const rawX = point.x + primary.offset.x;
        const rawZ = point.z + primary.offset.z;
        const halfW = dims.width / 2;
        const halfL = dims.length / 2;
        const snapX = settings.grid ? Math.round(rawX / 0.1) * 0.1 : rawX;
        const snapZ = settings.grid ? Math.round(rawZ / 0.1) * 0.1 : rawZ;
        const nextX = THREE.MathUtils.clamp(snapX, -halfW, halfW);
        const nextZ = THREE.MathUtils.clamp(snapZ, -halfL, halfL);

        editor.mutateLive((d) => {
          const p = (d.room.partitions ?? []).find((x) => x.id === primary.id);
          if (p) {
            p.position.x = nextX;
            p.position.z = nextZ;
          }
        });
        return;
      }

      const primaryInstance = doc.furniture.find((f) => f.instanceId === primary.id);
      if (!primaryInstance) return;

      const desiredPrimary = {
        x: point.x + primary.offset.x,
        z: point.z + primary.offset.z,
      };

      // Snapping is resolved against the primary object only; the rest of the
      // selection rides along on the same delta so the group stays rigid.
      const movingIds = new Set(drag.targets.map((t) => t.id));
      const others: Rect[] = doc.furniture
        .filter((f) => f.visible && !movingIds.has(f.instanceId))
        .filter((f) => resolveCatalogItem(f.catalogId).collides)
        .map((f) => instanceRect(f));

      const desiredRect: Rect = {
        ...instanceRect(primaryInstance),
        cx: desiredPrimary.x,
        cz: desiredPrimary.z,
      };
      const snapped =
        drag.targets.length === 1
          ? computeSnap(desiredRect, others, dims, settings)
          : {
              position: desiredPrimary,
              rotation: primaryInstance.rotation,
              guides: [],
              snappedToWall: false,
            };

      const delta = {
        x: snapped.position.x - primaryInstance.position.x,
        z: snapped.position.z - primaryInstance.position.z,
      };

      editor.mutateLive((d) => {
        for (const target of drag.targets) {
          const f = d.furniture.find((x) => x.instanceId === target.id);
          if (!f || f.locked) continue;
          const next =
            target.id === primary.id
              ? snapped.position
              : { x: f.position.x + delta.x, z: f.position.z + delta.z };
          f.position = clampRectToRoom(
            { ...instanceRect(f), cx: next.x, cz: next.z },
            dims.width,
            dims.length
          );
        }
      });

      // Report validity so the viewport can show the reason inline. The move is
      // still applied — blocking the drag mid-gesture feels broken; telling the
      // user precisely what is wrong does not.
      const after = useEditor.getState().doc;
      const moved = after.furniture.find((f) => f.instanceId === primary.id);
      const check = moved
        ? isPlacementValid(moved, after)
        : { valid: true, reason: null };
      useDrag.setState({
        guides: snapped.guides,
        invalidReason: check.valid ? null : check.reason,
      });
    };

    const finish = () => {
      if (useDrag.getState().mode === null) return;
      useEditor.getState().endGesture();
      useDrag.getState().end();
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    // A drag that outlives a tab switch is a drag the user has forgotten about.
    window.addEventListener('blur', finish);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      window.removeEventListener('blur', finish);
    };
  }, [camera, gl]);

  return null;
}
