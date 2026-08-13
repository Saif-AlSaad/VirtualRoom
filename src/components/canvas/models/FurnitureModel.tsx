import { memo } from 'react';
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

function FurnitureModelImpl({ catalog, instance }: Props) {
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
  });
}

export const FurnitureModel = memo(
  FurnitureModelImpl,
  (prev, next) =>
    prev.catalog.id === next.catalog.id &&
    prev.instance.finishId === next.instance.finishId &&
    prev.instance.colorOverride === next.instance.colorOverride
);
