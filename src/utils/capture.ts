/**
 * Screenshot bridge between the React UI and the WebGL renderer.
 *
 * The export button lives in the top bar, outside the R3F <Canvas>, so it has
 * no access to the renderer. A small component inside the canvas registers a
 * capture function here on mount; the UI calls it through this module. This is
 * a deliberate one-way registry rather than a context, so nothing outside the
 * canvas ever holds a reference to the GL objects.
 */

export type CaptureFn = (scale: number) => string | null;

export type ComposerLike = {
  render: (delta?: number) => void;
  setSize: (width: number, height: number) => void;
};

let capture: CaptureFn | null = null;
let activeComposer: ComposerLike | null = null;

export function registerCapture(fn: CaptureFn | null): void {
  capture = fn;
}

export function registerComposer(composer: ComposerLike | null): void {
  activeComposer = composer;
}

export function getComposer(): ComposerLike | null {
  return activeComposer;
}

export function captureViewport(scale = 2): string | null {
  if (!capture) return null;
  try {
    return capture(scale);
  } catch {
    return null;
  }
}

export function isCaptureReady(): boolean {
  return capture !== null;
}
