import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { CameraPreset, RoomDimensions } from '@/types';
import { useUI } from '@/store/uiStore';
import { useDrag } from '@/store/dragStore';

/**
 * Camera behaviour: orbit, preset fly-to, top-down 2D, and walkthrough.
 *
 * The fly-to is a critically-damped interpolation run in `useFrame` rather than
 * a GSAP timeline. Tweening the camera with an external animation library while
 * OrbitControls also writes to it produces a fight over the same transform; a
 * single owner per frame avoids that class of bug entirely.
 */

interface Props {
  dims: RoomDimensions;
}

/** Camera position + target for each preset, derived from the room size. */
function presetTransform(
  preset: CameraPreset,
  dims: RoomDimensions
): { position: THREE.Vector3; target: THREE.Vector3 } {
  const { width: w, length: l, height: h } = dims;
  const span = Math.max(w, l);
  const target = new THREE.Vector3(0, h * 0.35, 0);

  switch (preset) {
    case 'top':
      return {
        // Nudged off true vertical: a perfectly axial camera makes OrbitControls
        // gimbal-lock when the user starts to rotate away from it.
        position: new THREE.Vector3(0.001, span * 1.65 + 2, 0.001),
        target: new THREE.Vector3(0, 0, 0),
      };
    case 'front':
      return {
        position: new THREE.Vector3(0, h * 0.75, l * 0.5 + span * 1.15),
        target,
      };
    case 'left':
      return {
        position: new THREE.Vector3(-(w * 0.5 + span * 1.15), h * 0.75, 0),
        target,
      };
    case 'right':
      return {
        position: new THREE.Vector3(w * 0.5 + span * 1.15, h * 0.75, 0),
        target,
      };
    case 'corner':
    default:
      return {
        position: new THREE.Vector3(
          w * 0.5 + span * 0.72,
          h * 1.5 + span * 0.42,
          l * 0.5 + span * 0.78
        ),
        target,
      };
  }
}

export function CameraRig({ dims }: Props) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, gl } = useThree();

  const viewMode = useUI((s) => s.viewMode);
  const preset = useUI((s) => s.cameraPreset);
  const nonce = useUI((s) => s.cameraNonce);
  const reducedMotion = useUI((s) => s.reducedMotion);
  const dragMode = useDrag((s) => s.mode);

  const flying = useRef(false);
  const goalPosition = useRef(new THREE.Vector3());
  const goalTarget = useRef(new THREE.Vector3());

  // Walkthrough state: an eye-height camera driven by WASD + mouse look / joystick.
  const walk = useRef({
    position: new THREE.Vector3(0, 1.6, 0),
    yaw: 0,
    pitch: 0,
    keys: new Set<string>(),
    // Reused each frame rather than allocated in the render loop.
    lookTarget: new THREE.Vector3(),
  });

  useEffect(() => {
    const { position, target } = presetTransform(preset, dims);
    goalPosition.current.copy(position);
    goalTarget.current.copy(target);

    if (reducedMotion) {
      camera.position.copy(position);
      controls.current?.target.copy(target);
      controls.current?.update();
      flying.current = false;
    } else {
      flying.current = true;
    }
    // `nonce` is in the dependency list so re-selecting the same preset
    // re-triggers the fly-to rather than doing nothing.
  }, [preset, nonce, dims, camera, reducedMotion]);

  // ── Walkthrough input & Pointer Lock ───────────────────────────────────
  useEffect(() => {
    if (viewMode !== 'walk') {
      if (document.pointerLockElement === gl.domElement) {
        document.exitPointerLock();
      }
      useUI.getState().setPointerLockActive(false);
      return;
    }

    const state = walk.current;
    state.position.set(0, 1.6, dims.length * 0.35);
    state.yaw = Math.PI;
    state.pitch = 0;

    const down = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      state.keys.add(e.key.toLowerCase());
    };
    const up = (e: KeyboardEvent) => state.keys.delete(e.key.toLowerCase());
    const blur = () => state.keys.clear();

    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === gl.domElement) {
        const sensitivity = 0.0022;
        state.yaw -= e.movementX * sensitivity;
        state.pitch = THREE.MathUtils.clamp(
          state.pitch - e.movementY * sensitivity,
          -1.2,
          1.2
        );
      }
    };

    const onPointerLockChange = () => {
      const locked = document.pointerLockElement === gl.domElement;
      useUI.getState().setPointerLockActive(locked);
    };

    const canvas = gl.domElement;
    const onCanvasClick = (e: MouseEvent) => {
      // If clicking inside the canvas without pointer lock, request it
      if (e.button === 0 && document.pointerLockElement !== canvas) {
        canvas.requestPointerLock?.();
      }
    };

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    window.addEventListener('mousemove', onMouseMove);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    canvas.addEventListener('click', onCanvasClick);

    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      window.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      canvas.removeEventListener('click', onCanvasClick);
      if (document.pointerLockElement === canvas) {
        document.exitPointerLock();
      }
      useUI.getState().setPointerLockActive(false);
      state.keys.clear();
    };
  }, [viewMode, dims.length, gl.domElement]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);

    if (viewMode === 'walk') {
      const state = walk.current;
      const speed = state.keys.has('shift') ? 3.4 : 1.9;
      const turn = 2.1;

      // Pitch tilting via keyboard
      if (state.keys.has('r') || state.keys.has('pageup')) {
        state.pitch = Math.min(1.2, state.pitch + turn * 0.7 * dt);
      }
      if (state.keys.has('f') || state.keys.has('pagedown')) {
        state.pitch = Math.max(-1.2, state.pitch - turn * 0.7 * dt);
      }

      // Yaw rotation via keyboard
      if (state.keys.has('arrowleft') || state.keys.has('q')) state.yaw += turn * dt;
      if (state.keys.has('arrowright') || state.keys.has('e')) state.yaw -= turn * dt;

      // External look delta (from virtual look pad / touch drag)
      const lookDelta = useUI.getState().consumeWalkLookDelta();
      if (lookDelta.yaw !== 0 || lookDelta.pitch !== 0) {
        state.yaw += lookDelta.yaw;
        state.pitch = THREE.MathUtils.clamp(state.pitch + lookDelta.pitch, -1.2, 1.2);
      }

      // Forward/backward & strafe from keyboard + virtual joystick
      let forward = 0;
      let strafe = 0;
      if (state.keys.has('w') || state.keys.has('arrowup')) forward += 1;
      if (state.keys.has('s') || state.keys.has('arrowdown')) forward -= 1;
      if (state.keys.has('a')) strafe -= 1;
      if (state.keys.has('d')) strafe += 1;

      const joystick = useUI.getState().walkJoystick;
      forward += joystick.forward;
      strafe += joystick.strafe;

      if (forward !== 0 || strafe !== 0) {
        const len = Math.hypot(forward, strafe);
        const fx = (forward / Math.max(len, 1)) * speed * dt;
        const sx = (strafe / Math.max(len, 1)) * speed * dt;
        state.position.x += Math.sin(state.yaw) * fx + Math.cos(state.yaw) * sx;
        state.position.z += Math.cos(state.yaw) * fx - Math.sin(state.yaw) * sx;

        // Keep the walker inside the room, 250 mm off the walls.
        const margin = 0.25;
        state.position.x = THREE.MathUtils.clamp(
          state.position.x,
          -dims.width / 2 + margin,
          dims.width / 2 - margin
        );
        state.position.z = THREE.MathUtils.clamp(
          state.position.z,
          -dims.length / 2 + margin,
          dims.length / 2 - margin
        );
      }

      camera.position.lerp(state.position, 1 - Math.exp(-dt * 18));
      const cosPitch = Math.cos(state.pitch);
      const sinPitch = Math.sin(state.pitch);
      state.lookTarget.set(
        state.position.x + Math.sin(state.yaw) * cosPitch,
        state.position.y + sinPitch,
        state.position.z + Math.cos(state.yaw) * cosPitch
      );
      camera.lookAt(state.lookTarget);
      return;
    }

    if (!flying.current || !controls.current) return;

    const k = 1 - Math.exp(-dt * 6.5);
    camera.position.lerp(goalPosition.current, k);
    controls.current.target.lerp(goalTarget.current, k);
    controls.current.update();

    if (
      camera.position.distanceTo(goalPosition.current) < 0.02 &&
      controls.current.target.distanceTo(goalTarget.current) < 0.02
    ) {
      camera.position.copy(goalPosition.current);
      controls.current.target.copy(goalTarget.current);
      controls.current.update();
      flying.current = false;
    }
  });

  if (viewMode === 'walk') return null;

  const span = Math.max(dims.width, dims.length);
  const topDown = viewMode === '2d';

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      // Orbit and object-drag both start with a left press on the canvas, so
      // the controls must stand down for the duration of a furniture gesture —
      // otherwise the room spins while you are trying to move a chair.
      enabled={dragMode === null}
      enableDamping
      dampingFactor={0.09}
      // Any manual input takes ownership of the camera back from the fly-to.
      onStart={() => {
        flying.current = false;
      }}
      enableRotate={!topDown}
      enablePan
      screenSpacePanning={false}
      minDistance={1.2}
      maxDistance={span * 5 + 12}
      // Never let the camera go below the floor.
      maxPolarAngle={topDown ? 0.001 : Math.PI * 0.495}
      minPolarAngle={topDown ? 0 : 0.05}
      target={[0, dims.height * 0.35, 0]}
      mouseButtons={{
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      }}
    />
  );
}
