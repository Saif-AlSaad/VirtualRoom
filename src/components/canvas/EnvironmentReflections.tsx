import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { useUI } from '@/store/uiStore';

/**
 * Procedural Interior Environment Map & PBR Reflections.
 *
 * Generates an architectural studio/interior radiance map using Three's built-in
 * PMREMGenerator and RoomEnvironment. Zero network downloads, 100% offline,
 * and immediate first-frame readiness.
 *
 * Provides realistic specular reflections, fresnel highlights, and ambient
 * lighting on all metallic, plastic, wooden, ceramic, and glass surfaces.
 */
export function EnvironmentReflections() {
  const { gl, scene } = useThree();
  const timeOfDay = useUI((s) => s.timeOfDay);
  const lightIntensity = useUI((s) => s.lightIntensity);
  const quality = useUI((s) => s.quality);
  const postFx = useUI((s) => s.postFx);

  const renderTargetRef = useRef<THREE.WebGLRenderTarget | null>(null);

  useEffect(() => {
    let active = true;
    const pmrem = new THREE.PMREMGenerator(gl);
    pmrem.compileEquirectangularShader();

    const roomEnv = new RoomEnvironment();
    const renderTarget = pmrem.fromScene(roomEnv, 0.04);
    roomEnv.dispose();
    pmrem.dispose();

    if (active) {
      renderTargetRef.current = renderTarget;
      scene.environment = renderTarget.texture;
    } else {
      renderTarget.dispose();
    }

    return () => {
      active = false;
      scene.environment = null;
      if (renderTargetRef.current) {
        renderTargetRef.current.dispose();
        renderTargetRef.current = null;
      }
    };
  }, [gl, scene]);

  useFrame(() => {
    if (!scene.environment) return;

    if (!postFx.enabled || !postFx.reflections || quality === 'performance') {
      scene.environmentIntensity = 0;
      return;
    }

    const baseIntensity = timeOfDay === 'night' ? 0.16 : 0.62;
    scene.environmentIntensity = baseIntensity * lightIntensity;
  });

  return null;
}
