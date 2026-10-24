import type { Size3, Unit, Vec3 } from '@/types';
import { formatLength, fromDisplay, toDisplay } from './units';

// ── Math & Precision ──────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function roundScale(val: number): number {
  return Math.round(val * 10000) / 10000;
}

// ── Dimension & Scale Calculations ────────────────────────────────────────

export interface SizingAxisParams {
  axis: 'w' | 'd' | 'h';
  newDimensionMetres: number;
  currentScale: Vec3;
  catalogSize: Size3;
  scaleRange: [number, number];
  lockRatio: boolean;
}

/**
 * Calculates updated 3D scale vector when a single dimension is edited,
 * respecting aspect-ratio locking and catalog scale constraints.
 */
export function calculateNewScale({
  axis,
  newDimensionMetres,
  currentScale,
  catalogSize,
  scaleRange,
  lockRatio,
}: SizingAxisParams): Vec3 {
  const [minScale, maxScale] = scaleRange;

  if (axis === 'w') {
    const rawScaleX = catalogSize.w > 0 ? newDimensionMetres / catalogSize.w : 1;
    const targetX = clamp(rawScaleX, minScale, maxScale);

    if (lockRatio) {
      const factor = currentScale.x > 0 ? targetX / currentScale.x : 1;
      return {
        x: roundScale(targetX),
        y: roundScale(clamp(currentScale.y * factor, minScale, maxScale)),
        z: roundScale(clamp(currentScale.z * factor, minScale, maxScale)),
      };
    }
    return {
      x: roundScale(targetX),
      y: currentScale.y,
      z: currentScale.z,
    };
  }

  if (axis === 'd') {
    // Depth corresponds to local Z
    const rawScaleZ = catalogSize.d > 0 ? newDimensionMetres / catalogSize.d : 1;
    const targetZ = clamp(rawScaleZ, minScale, maxScale);

    if (lockRatio) {
      const factor = currentScale.z > 0 ? targetZ / currentScale.z : 1;
      return {
        x: roundScale(clamp(currentScale.x * factor, minScale, maxScale)),
        y: roundScale(clamp(currentScale.y * factor, minScale, maxScale)),
        z: roundScale(targetZ),
      };
    }
    return {
      x: currentScale.x,
      y: currentScale.y,
      z: roundScale(targetZ),
    };
  }

  // Height corresponds to local Y
  const rawScaleY = catalogSize.h > 0 ? newDimensionMetres / catalogSize.h : 1;
  const targetY = clamp(rawScaleY, minScale, maxScale);

  if (lockRatio) {
    const factor = currentScale.y > 0 ? targetY / currentScale.y : 1;
    return {
      x: roundScale(clamp(currentScale.x * factor, minScale, maxScale)),
      y: roundScale(targetY),
      z: roundScale(clamp(currentScale.z * factor, minScale, maxScale)),
    };
  }
  return {
    x: currentScale.x,
    y: roundScale(targetY),
    z: currentScale.z,
  };
}

/**
 * Calculates uniform scale vector or proportional scale based on target ratio.
 */
export function calculateUniformScale(
  targetRatio: number,
  currentScale: Vec3,
  scaleRange: [number, number],
  preserveProportions = false
): Vec3 {
  const [minScale, maxScale] = scaleRange;
  const clampedRatio = clamp(targetRatio, minScale, maxScale);

  if (!preserveProportions) {
    const s = roundScale(clampedRatio);
    return { x: s, y: s, z: s };
  }

  const currentAverage = (currentScale.x + currentScale.y + currentScale.z) / 3;
  const factor = currentAverage > 0 ? clampedRatio / currentAverage : 1;

  return {
    x: roundScale(clamp(currentScale.x * factor, minScale, maxScale)),
    y: roundScale(clamp(currentScale.y * factor, minScale, maxScale)),
    z: roundScale(clamp(currentScale.z * factor, minScale, maxScale)),
  };
}

/**
 * Returns whether all 3 axes are currently uniform within a small delta.
 */
export function isUniformScale(scale: Vec3, epsilon = 0.005): boolean {
  return (
    Math.abs(scale.x - scale.y) < epsilon &&
    Math.abs(scale.y - scale.z) < epsilon
  );
}

// ── Dual-Unit Presentation ────────────────────────────────────────────────

export interface DualDimension {
  primary: string;
  secondary: string;
  primaryValue: number;
  secondaryValue: number;
}

/**
 * Formats a metric length in dual units (e.g. primary in metres, secondary in feet/inches, or vice versa).
 */
export function formatDualDimension(metres: number, activeUnit: Unit): DualDimension {
  if (activeUnit === 'm') {
    return {
      primary: `${metres.toFixed(2)} m`,
      secondary: formatLength(metres, 'ft'),
      primaryValue: metres,
      secondaryValue: toDisplay(metres, 'ft'),
    };
  }

  const feetValue = toDisplay(metres, 'ft');
  return {
    primary: `${feetValue.toFixed(2)} ft`,
    secondary: formatLength(metres, 'm'),
    primaryValue: feetValue,
    secondaryValue: metres,
  };
}

export { fromDisplay, toDisplay };
