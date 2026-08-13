import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { Opening, RoomDimensions } from '@/types';
import { openingTransform } from '@/utils/roomGeometry';
import { useUI } from '@/store/uiStore';

/**
 * Scene lighting, including the day/night transition.
 *
 * Daylight is driven by the room's actual windows: each window gets a soft area
 * source just inside its opening, aimed into the room. That means moving a
 * window visibly changes where the light falls, which is the entire reason
 * someone would model window placement in the first place.
 *
 * The day→night change is a tween on colour and intensity rather than a swap,
 * because an instant cut reads as a bug and a gradual shift reads as time
 * passing.
 */

interface Palette {
  sky: string;
  ground: string;
  sun: string;
  ambient: number;
  sunIntensity: number;
  windowIntensity: number;
  background: string;
  fog: string;
  interior: number;
}

const DAY: Palette = {
  sky: '#e8eef5',
  ground: '#cfc9bd',
  sun: '#fff5e3',
  ambient: 0.62,
  sunIntensity: 1.55,
  windowIntensity: 0.55,
  background: '#e7ecf1',
  fog: '#e7ecf1',
  interior: 0.12,
};

const NIGHT: Palette = {
  sky: '#1d2635',
  ground: '#171a20',
  sun: '#8ea7cc',
  ambient: 0.2,
  sunIntensity: 0.22,
  windowIntensity: 0.1,
  background: '#141922',
  fog: '#141922',
  interior: 1.0,
};

function lerpPalette(a: Palette, b: Palette, t: number): Palette {
  const mix = (x: string, y: string) =>
    `#${new THREE.Color(x).lerp(new THREE.Color(y), t).getHexString()}`;
  const num = (x: number, y: number) => x + (y - x) * t;
  return {
    sky: mix(a.sky, b.sky),
    ground: mix(a.ground, b.ground),
    sun: mix(a.sun, b.sun),
    ambient: num(a.ambient, b.ambient),
    sunIntensity: num(a.sunIntensity, b.sunIntensity),
    windowIntensity: num(a.windowIntensity, b.windowIntensity),
    background: mix(a.background, b.background),
    fog: mix(a.fog, b.fog),
    interior: num(a.interior, b.interior),
  };
}

export function Lighting({
  dims,
  openings,
}: {
  dims: RoomDimensions;
  openings: Opening[];
}) {
  const timeOfDay = useUI((s) => s.timeOfDay);
  const intensity = useUI((s) => s.lightIntensity);
  const quality = useUI((s) => s.quality);
  const reducedMotion = useUI((s) => s.reducedMotion);
  const { scene } = useThree();

  const hemisphere = useRef<THREE.HemisphereLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const interior = useRef<THREE.PointLight>(null);
  const windowLights = useRef<Array<THREE.PointLight | null>>([]);

  // Animated 0 (day) → 1 (night).
  const blend = useRef(timeOfDay === 'night' ? 1 : 0);

  const fog = useMemo(() => new THREE.Fog('#e7ecf1', 18, 60), []);
  // Reused across frames — allocating a Color per frame is pure GC churn.
  const backgroundColor = useMemo(() => new THREE.Color('#e7ecf1'), []);
  useEffect(() => {
    scene.fog = fog;
    return () => {
      scene.fog = null;
    };
  }, [scene, fog]);

  const windows = openings.filter((o) => o.kind === 'window');
  const diagonal = Math.hypot(dims.width, dims.length);

  useFrame((state, delta) => {
    const target = timeOfDay === 'night' ? 1 : 0;
    // ~1.2 s crossfade; instant when the user prefers reduced motion.
    const k = reducedMotion ? 1 : 1 - Math.exp(-delta * 3.2);
    blend.current += (target - blend.current) * k;

    const p = lerpPalette(DAY, NIGHT, blend.current);

    if (hemisphere.current) {
      hemisphere.current.color.set(p.sky);
      hemisphere.current.groundColor.set(p.ground);
      hemisphere.current.intensity = p.ambient * intensity;
    }
    if (sun.current) {
      sun.current.color.set(p.sun);
      sun.current.intensity = p.sunIntensity * intensity;
    }
    if (interior.current) {
      interior.current.intensity = p.interior * intensity * 1.6;
    }
    for (const light of windowLights.current) {
      if (light) light.intensity = p.windowIntensity * intensity;
    }

    backgroundColor.set(p.background);
    state.scene.background = backgroundColor;
    fog.color.set(p.fog);
  });

  return (
    <>
      <hemisphereLight ref={hemisphere} intensity={0.6} />

      {/* Sun: positioned off one corner so shadows fall diagonally across the
          floor, which reads as depth far better than a top-down light. */}
      <directionalLight
        ref={sun}
        position={[diagonal * 0.9, dims.height * 3.2, diagonal * 0.7]}
        castShadow={quality !== 'performance'}
        shadow-mapSize-width={quality === 'high' ? 2048 : 1024}
        shadow-mapSize-height={quality === 'high' ? 2048 : 1024}
        shadow-bias={-0.0008}
        shadow-normalBias={0.02}
        shadow-camera-near={0.5}
        shadow-camera-far={diagonal * 6}
        shadow-camera-left={-diagonal}
        shadow-camera-right={diagonal}
        shadow-camera-top={diagonal}
        shadow-camera-bottom={-diagonal}
      />

      {/* Ceiling light, the dominant source after dark. */}
      <pointLight
        ref={interior}
        position={[0, dims.height - 0.15, 0]}
        color="#ffe6bd"
        distance={diagonal * 2.2}
        decay={1.6}
        castShadow={quality === 'high'}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.001}
      />

      {/* Daylight spilling through each window. */}
      {windows.map((o, i) => {
        const { position, normal } = openingTransform(o, dims);
        return (
          <pointLight
            key={o.id}
            ref={(el) => {
              windowLights.current[i] = el;
            }}
            position={[
              position.x + normal.x * 0.35,
              o.sillHeight + o.height * 0.6,
              position.z + normal.z * 0.35,
            ]}
            color="#dbe9f5"
            distance={Math.max(dims.width, dims.length) * 1.4}
            decay={1.4}
            intensity={0.5}
          />
        );
      })}

      {/* Fill from the open side so nothing goes fully black in 3D view. */}
      <directionalLight position={[-diagonal, dims.height * 2, -diagonal]} intensity={0.18} />
    </>
  );
}
