import { memo, useEffect, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { CatalogItem, FurnitureInstance } from '@/types';
import { MODEL_BUILDERS, PlaceholderModel } from './builders';

/**
 * Resolves a placed instance to geometry.
 *
 * This is the single seam between the editor and how furniture is *drawn*. It
 * takes a catalog item plus the instance's finish/colour and returns meshes —
 * nothing above it knows whether those meshes came from a procedural builder,
 * a glTF file, or an instanced pool. Swapping the strategy for any model kind
 * is a one-line change to the switch inside `MODEL_BUILDERS`.
 *
 * Memoised on the fields that actually affect geometry, because this subtree
 * re-renders on every frame of a drag otherwise.
 */

interface Props {
  catalog: CatalogItem;
  instance: FurnitureInstance;
}

function CustomGLTFModel({ url, w, d, h }: { url: string; w: number; d: number; h: number }) {
  const [modelGroup, setModelGroup] = useState<THREE.Group | null>(null);

  useEffect(() => {
    let active = true;
    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        if (!active) return;
        const root = gltf.scene.clone(true);
        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        // Center on XZ and ground at Y=0
        root.position.x -= center.x;
        root.position.y -= box.min.y;
        root.position.z -= center.z;

        const sx = size.x > 0 ? w / size.x : 1;
        const sy = size.y > 0 ? h / size.y : 1;
        const sz = size.z > 0 ? d / size.z : 1;
        root.scale.set(sx, sy, sz);

        setModelGroup(root);
      },
      undefined,
      () => {
        if (active) setModelGroup(null);
      }
    );

    return () => {
      active = false;
    };
  }, [url, w, d, h]);

  if (!modelGroup) {
    return <PlaceholderModel w={w} d={d} h={h} />;
  }

  return <primitive object={modelGroup} />;
}

function FurnitureModelImpl({ catalog, instance }: Props) {
  if (instance.customModelUrl) {
    return (
      <CustomGLTFModel
        url={instance.customModelUrl}
        w={catalog.size.w}
        d={catalog.size.d}
        h={catalog.size.h}
      />
    );
  }

  if (catalog.id === '__placeholder__') {
    return (
      <PlaceholderModel w={catalog.size.w} d={catalog.size.d} h={catalog.size.h} />
    );
  }

  const finish =
    catalog.finishes.find((f) => f.id === instance.finishId) ?? catalog.finishes[0];
  const build = MODEL_BUILDERS[catalog.model];

  if (!build) {
    // A catalog entry naming a model kind with no builder is a bug, but it must
    // not take the scene down — render the placeholder and keep going.
    return (
      <PlaceholderModel w={catalog.size.w} d={catalog.size.d} h={catalog.size.h} />
    );
  }

  return build({
    w: catalog.size.w,
    d: catalog.size.d,
    h: catalog.size.h,
    color: instance.colorOverride ?? finish.color,
    roughness: finish.roughness,
    metalness: finish.metalness,
    lightOn: instance.lightEnabled ?? true,
    lightColor: instance.lightColor ?? catalog.lightColor,
    lightIntensity: instance.lightIntensity ?? catalog.lightIntensity,
  });
}

export const FurnitureModel = memo(
  FurnitureModelImpl,
  (prev, next) =>
    prev.catalog.id === next.catalog.id &&
    prev.instance.finishId === next.instance.finishId &&
    prev.instance.colorOverride === next.instance.colorOverride &&
    prev.instance.customModelUrl === next.instance.customModelUrl &&
    prev.instance.lightEnabled === next.instance.lightEnabled &&
    prev.instance.lightColor === next.instance.lightColor &&
    prev.instance.lightIntensity === next.instance.lightIntensity
);
