import { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Icon } from './Icon';
import { useUI } from '@/store/uiStore';

/**
 * On-screen navigation controls for Walkthrough mode.
 *
 * Provides:
 * - Virtual on-screen joystick for movement (forward/back, strafe left/right) on mobile/touch.
 * - Virtual look pad and directional buttons (turn left/right, look up/down, center).
 * - Mouse-look (Pointer Lock API) status indicator and activation button for desktop.
 */
export function WalkControls() {
  const viewMode = useUI((s) => s.viewMode);
  const setViewMode = useUI((s) => s.setViewMode);
  const pointerLockActive = useUI((s) => s.pointerLockActive);
  const setWalkJoystick = useUI((s) => s.setWalkJoystick);
  const addWalkLookDelta = useUI((s) => s.addWalkLookDelta);

  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    setIsTouchDevice(
      'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth < 1024
    );
  }, []);

  if (viewMode !== 'walk') return null;

  const togglePointerLock = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    if (document.pointerLockElement === canvas) {
      document.exitPointerLock?.();
    } else {
      canvas.requestPointerLock?.();
    }
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col justify-between p-4 select-none">
      {/* Top Walkthrough HUD banner */}
      <div className="flex items-center justify-between gap-3">
        <div className="glass pointer-events-auto flex items-center gap-2 rounded-control px-3.5 py-1.5 shadow-medium">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-caption font-medium text-ink-800 dark:text-sage-100">
            {pointerLockActive
              ? 'Mouse Look Active (Press ESC to release)'
              : isTouchDevice
                ? 'Walkthrough Mode — Use on-screen controls'
                : 'Click canvas or press button to enable Mouse Look'}
          </span>
          {!isTouchDevice && (
            <button
              type="button"
              onClick={togglePointerLock}
              className={clsx(
                'ml-1 rounded px-2 py-0.5 text-[11px] font-medium transition-colors',
                pointerLockActive
                  ? 'bg-sage-600 text-white hover:bg-sage-700'
                  : 'bg-ink-200 text-ink-800 hover:bg-ink-300 dark:bg-ink-800 dark:text-ink-200'
              )}
            >
              {pointerLockActive ? 'Exit Mouse Look' : 'Enable Mouse Look'}
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setViewMode('3d')}
          className="glass pointer-events-auto flex items-center gap-1.5 rounded-control px-3 py-1.5 text-caption font-medium text-ink-700 shadow-medium hover:bg-ink-100 dark:text-sage-200 dark:hover:bg-ink-800"
        >
          <Icon name="cube" className="h-4 w-4" />
          <span>Exit Walk</span>
        </button>
      </div>

      {/* Bottom controls: Joystick (Left) and Look Pad / D-Pad (Right) */}
      <div className="flex items-end justify-between">
        {/* Movement Joystick */}
        <VirtualJoystick onChange={setWalkJoystick} />

        {/* Look Controls: Touch Pad & D-Pad */}
        <LookControls onLookDelta={addWalkLookDelta} />
      </div>
    </div>
  );
}

/**
 * Touch-friendly 2D analog thumbstick for walking.
 */
function VirtualJoystick({
  onChange,
}: {
  onChange: (vec: { forward: number; strafe: number }) => void;
}) {
  const baseRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });

  const RADIUS = 48;

  const updateFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      if (!baseRef.current) return;
      const rect = baseRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const dx = clientX - centerX;
      const dy = clientY - centerY;
      const dist = Math.hypot(dx, dy);

      const clampedDist = Math.min(dist, RADIUS);
      const angle = Math.atan2(dy, dx);

      const x = Math.cos(angle) * clampedDist;
      const y = Math.sin(angle) * clampedDist;

      setKnobPos({ x, y });

      // In three.js walk coords: dy < 0 is forward, dx > 0 is strafe right
      const forward = -y / RADIUS;
      const strafe = x / RADIUS;
      onChange({ forward, strafe });
    },
    [onChange]
  );

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setActive(true);
    updateFromPointer(e.clientX, e.clientY);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!active) return;
    e.preventDefault();
    updateFromPointer(e.clientX, e.clientY);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    setActive(false);
    setKnobPos({ x: 0, y: 0 });
    onChange({ forward: 0, strafe: 0 });
  };

  return (
    <div className="pointer-events-auto flex flex-col items-center gap-1.5">
      <div
        ref={baseRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={clsx(
          'relative flex h-32 w-32 items-center justify-center rounded-full border-2',
          'touch-none backdrop-blur-md transition-colors',
          active
            ? 'border-sage-400 bg-sage-950/40 shadow-glow'
            : 'border-white/30 bg-ink-950/30 shadow-medium'
        )}
      >
        {/* Center Crosshair / Direction Lines */}
        <div className="absolute h-full w-px bg-white/15" />
        <div className="absolute h-px w-full bg-white/15" />

        {/* Draggable Knob */}
        <div
          className={clsx(
            'flex h-14 w-14 items-center justify-center rounded-full border shadow-lg',
            'transition-transform duration-75',
            active
              ? 'border-sage-300 bg-sage-600 text-white scale-105'
              : 'border-white/40 bg-white/80 text-ink-800 dark:bg-ink-800 dark:text-sage-100'
          )}
          style={{
            transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
          }}
        >
          <Icon name="joystick" className="h-6 w-6 opacity-75" />
        </div>
      </div>
      <span className="text-[11px] font-medium text-ink-400 dark:text-ink-300">
        Move / Strafe
      </span>
    </div>
  );
}

/**
 * Touch Lookpad and D-pad for tilting and turning the first-person camera.
 */
function LookControls({
  onLookDelta,
}: {
  onLookDelta: (delta: { yaw: number; pitch: number }) => void;
}) {
  const lastTouch = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!lastTouch.current || e.touches.length === 0) return;
    const touch = e.touches[0];
    const dx = touch.clientX - lastTouch.current.x;
    const dy = touch.clientY - lastTouch.current.y;
    lastTouch.current = { x: touch.clientX, y: touch.clientY };

    const sensitivity = 0.005;
    onLookDelta({ yaw: -dx * sensitivity, pitch: -dy * sensitivity });
  };

  const onTouchEnd = () => {
    lastTouch.current = null;
  };

  const stepLook = (yawDeg: number, pitchDeg: number) => {
    const toRad = Math.PI / 180;
    onLookDelta({ yaw: yawDeg * toRad, pitch: pitchDeg * toRad });
  };

  return (
    <div className="pointer-events-auto flex flex-col items-end gap-2">
      {/* Touch swipe zone for look */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="flex h-24 w-32 flex-col items-center justify-center rounded-panel border border-white/20 bg-ink-950/30 p-2 text-center backdrop-blur-md shadow-medium touch-none"
      >
        <Icon name="touch" className="h-5 w-5 text-sage-300 opacity-80" />
        <span className="mt-1 text-[11px] font-medium text-white/80">
          Swipe to look
        </span>
      </div>

      {/* Quick Look Direction Buttons */}
      <div className="grid grid-cols-3 gap-1 rounded-control bg-ink-950/40 p-1.5 backdrop-blur-md shadow-medium">
        <span />
        <button
          type="button"
          onClick={() => stepLook(0, 8)}
          aria-label="Look up"
          className="flex h-8 w-8 items-center justify-center rounded bg-white/10 text-white hover:bg-white/20 active:bg-sage-600"
        >
          ▲
        </button>
        <span />
        <button
          type="button"
          onClick={() => stepLook(12, 0)}
          aria-label="Turn left"
          className="flex h-8 w-8 items-center justify-center rounded bg-white/10 text-white hover:bg-white/20 active:bg-sage-600"
        >
          ◀
        </button>
        <button
          type="button"
          onClick={() => onLookDelta({ yaw: 0, pitch: -0 })}
          aria-label="Center view"
          className="flex h-8 w-8 items-center justify-center rounded bg-white/10 text-caption font-bold text-sage-300 hover:bg-white/20"
        >
          ●
        </button>
        <button
          type="button"
          onClick={() => stepLook(-12, 0)}
          aria-label="Turn right"
          className="flex h-8 w-8 items-center justify-center rounded bg-white/10 text-white hover:bg-white/20 active:bg-sage-600"
        >
          ▶
        </button>
        <span />
        <button
          type="button"
          onClick={() => stepLook(0, -8)}
          aria-label="Look down"
          className="flex h-8 w-8 items-center justify-center rounded bg-white/10 text-white hover:bg-white/20 active:bg-sage-600"
        >
          ▼
        </button>
        <span />
      </div>
    </div>
  );
}
