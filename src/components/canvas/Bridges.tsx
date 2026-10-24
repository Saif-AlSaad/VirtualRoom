import { useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { getComposer, registerCapture } from '@/utils/capture';
import { registerFloorPicker } from '@/utils/pointer';

/**
 * Wires canvas-only capabilities to the plain-DOM UI outside it.
 *
 * Two things need this: PNG export (needs the renderer) and drag-and-drop from
 * the catalog (needs the camera to unproject a drop point). Both register a
 * function on mount and tear it down on unmount, so nothing outside the canvas
 * ever holds a live reference to GL state.
 */
export function Bridges() {
  const { gl, scene, camera, size } = useThree();

  // ── PNG capture ─────────────────────────────────────────────────────────
  useEffect(() => {
    registerCapture((scale: number) => {
      const clamped = Math.min(Math.max(scale, 1), 4);
      const prevPixelRatio = gl.getPixelRatio();
      const target = Math.min(clamped, 4);
      const composer = getComposer();

      try {
        // Render once at the requested pixel ratio. `preserveDrawingBuffer` is
        // set on the Canvas, but the buffer is only guaranteed valid right
        // after a draw — so we force one rather than trusting the last frame.
        gl.setPixelRatio(target);
        gl.setSize(size.width, size.height, false);

        if (composer) {
          composer.setSize(size.width * target, size.height * target);
          composer.render(0.016);
        } else {
          gl.render(scene, camera);
        }

        return gl.domElement.toDataURL('image/png');
      } catch {
        return null;
      } finally {
        gl.setPixelRatio(prevPixelRatio);
        gl.setSize(size.width, size.height, false);

        if (composer) {
          composer.setSize(size.width * prevPixelRatio, size.height * prevPixelRatio);
          composer.render(0.016);
        } else {
          gl.render(scene, camera);
        }
      }
    });
    return () => registerCapture(null);
  }, [gl, scene, camera, size]);

  // ── Floor picking for external drag-and-drop ────────────────────────────
  useEffect(() => {
    const raycaster = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const ndc = new THREE.Vector2();
    const hit = new THREE.Vector3();

    registerFloorPicker((clientX, clientY) => {
      const rect = gl.domElement.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const point = raycaster.ray.intersectPlane(plane, hit);
      // A camera looking along the floor plane never intersects it.
      return point ? { x: point.x, z: point.z } : null;
    });
    return () => registerFloorPicker(null);
  }, [gl, camera]);

  return null;
}
