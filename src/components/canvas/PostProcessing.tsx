import { useEffect, useRef } from 'react';
import type { EffectComposer as EffectComposerImpl } from 'postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { Bloom, EffectComposer, N8AO, ToneMapping, Vignette } from '@react-three/postprocessing';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useUI } from '@/store/uiStore';
import { registerComposer } from '@/utils/capture';

/**
 * Photorealistic architectural post-processing pipeline.
 *
 * Features:
 * - N8AO: State-of-the-art Screen Space Ambient Occlusion. Grounds furniture,
 *   walls, skirting boards, and corners with realistic contact shadows.
 * - Bloom: Subtle architectural glare and radiance on windows, light bulbs,
 *   and glossy specular highlights.
 * - Vignette: Subtle lens falloff that draws the eye toward the room center.
 * - ToneMapping: ACES Filmic tonemapping inside the composer.
 *
 * Bypassed entirely when quality is set to 'performance' or when postFx is disabled.
 */
export function PostProcessing() {
  const { gl } = useThree();
  const quality = useUI((s) => s.quality);
  const postFx = useUI((s) => s.postFx);
  const timeOfDay = useUI((s) => s.timeOfDay);

  const composerRef = useRef<EffectComposerImpl | null>(null);

  const active = postFx.enabled && quality !== 'performance';

  // Coordinate tone mapping between Canvas and PostProcessing.
  // When postprocessing is active, tone mapping occurs in the composer pass.
  useEffect(() => {
    if (active) {
      gl.toneMapping = THREE.NoToneMapping;
    } else {
      gl.toneMapping = THREE.ACESFilmicToneMapping;
      gl.toneMappingExposure = 1.05;
    }

    return () => {
      gl.toneMapping = THREE.ACESFilmicToneMapping;
      gl.toneMappingExposure = 1.05;
    };
  }, [gl, active]);

  useEffect(() => {
    if (active && composerRef.current) {
      registerComposer(composerRef.current);
    } else {
      registerComposer(null);
    }

    return () => {
      registerComposer(null);
    };
  }, [active]);

  if (!active) return null;

  const isHigh = quality === 'high';

  const effects: JSX.Element[] = [];

  if (postFx.ssao) {
    effects.push(
      <N8AO
        key="n8ao"
        aoRadius={0.9}
        intensity={postFx.aoIntensity}
        quality={isHigh ? 'high' : 'medium'}
        halfRes={!isHigh}
        aoSamples={isHigh ? 16 : 8}
        denoiseSamples={4}
        denoiseRadius={12}
        distanceFalloff={1.0}
        color={timeOfDay === 'night' ? '#0d1117' : '#141c14'}
      />
    );
  }

  if (postFx.bloom) {
    effects.push(
      <Bloom
        key="bloom"
        luminanceThreshold={0.88}
        luminanceSmoothing={0.25}
        intensity={postFx.bloomIntensity}
        mipmapBlur
      />
    );
  }

  if (postFx.vignette) {
    effects.push(
      <Vignette
        key="vignette"
        offset={0.28}
        darkness={0.36}
        eskil={false}
      />
    );
  }

  effects.push(<ToneMapping key="tonemapping" mode={ToneMappingMode.ACES_FILMIC} />);

  return (
    <EffectComposer
      ref={(ref) => {
        const comp = ref as EffectComposerImpl | null;
        composerRef.current = comp;
        registerComposer(comp);
      }}
      multisampling={isHigh ? 4 : 0}
      stencilBuffer={false}
    >
      {effects}
    </EffectComposer>
  );
}
