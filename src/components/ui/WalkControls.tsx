import { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Icon } from './Icon';
import { useUI } from '@/store/uiStore';

// ── Walkthrough Controls Component ──────────────────────────────────────

export function WalkControls() {
  const viewMode = useUI((s) => s.viewMode);
  const setViewMode = useUI((s) => s.setViewMode);
  const pointerLockActive = useUI((s) => s.pointerLockActive);
  const setWalkJoystick = useUI((s) => s.setWalkJoystick);
  const addWalkLookDelta = useUI((s) => s.addWalkLookDelta);

  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [showTouchControls, setShowTouchControls] = useState(false);

  useEffect(() => {
    const isTouch =
      'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth < 1024;
    setIsTouchDevice(isTouch);
    setShowTouchControls(isTouch);
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

  const resetPitch = () => {
    addWalkLookDelta({ yaw: 0, pitch: -999 });
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col justify-between p-3.5 select-none sm:p-4">
      {/* ── Top Walkthrough Navigation Bar ────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {/* Left: Status & Pointer Lock */}
        <div className="glass pointer-events-auto flex items-center gap-2 rounded-panel px-3 py-1.5 shadow-medium">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[12px] font-medium text-ink-800 dark:text-sage-100">
            {pointerLockActive
              ? 'Mouse Look Active'
              : isTouchDevice
                ? 'Walkthrough'
                : 'Click canvas to look'}
          </span>
          {!isTouchDevice && (
            <button
              type="button"
              onClick={togglePointerLock}
              className={clsx(
                'ml-1 rounded px-2 py-0.5 text-[11px] font-semibold transition-colors',
                pointerLockActive
                  ? 'bg-sage-600 text-white hover:bg-sage-700'
                  : 'bg-ink-200 text-ink-800 hover:bg-ink-300 dark:bg-ink-800 dark:text-ink-200'
              )}
            >
              {pointerLockActive ? 'ESC to Unlock' : 'Enable Mouse Look'}
            </button>
          )}
        </div>

        {/* Center: Functional actions (Level View & On-screen toggle) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={resetPitch}
            title="Level camera pitch to horizon"
            className="glass pointer-events-auto flex items-center gap-1.5 rounded-panel px-2.5 py-1.5 text-[12px] font-medium text-ink-700 shadow-medium hover:bg-ink-100 dark:text-sage-200 dark:hover:bg-ink-800"
          >
            <Icon name="eye" className="h-3.5 w-3.5" />
            <span>Level View</span>
          </button>

          {!isTouchDevice && (
            <button
              type="button"
              onClick={() => setShowTouchControls((v) => !v)}
              title={showTouchControls ? 'Hide on-screen controls' : 'Show on-screen touch controls'}
              className={clsx(
                'glass pointer-events-auto hidden sm:flex items-center gap-1.5 rounded-panel px-2.5 py-1.5 text-[12px] font-medium shadow-medium transition-colors',
                showTouchControls
                  ? 'bg-sage-600/20 text-sage-700 dark:text-sage-200 border border-sage-500/30'
                  : 'text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800'
              )}
            >
              <Icon name="joystick" className="h-3.5 w-3.5" />
              <span>{showTouchControls ? 'Hide Controls' : 'On-Screen D-Pad'}</span>
            </button>
          )}
        </div>

        {/* Right: Exit Walk */}
        <button
          type="button"
          onClick={() => setViewMode('3d')}
          className="glass pointer-events-auto flex items-center gap-1.5 rounded-panel px-3 py-1.5 text-[12px] font-medium text-ink-700 shadow-medium hover:bg-ink-100 dark:text-sage-200 dark:hover:bg-ink-800"
        >
          <Icon name="cube" className="h-4 w-4" />
          <span>Exit Walk</span>
        </button>
      </div>

      {/* ── Center Reticle (Subtle Visual Orientation) ────────────────── */}
      <WalkReticle />

      {/* ── Bottom Section: Floating Keymap or Touch Joysticks ───────── */}
      <div className="flex items-end justify-between">
        {/* Movement Joystick (on touch or when toggled) */}
        {showTouchControls ? (
          <VirtualJoystick onChange={setWalkJoystick} />
        ) : (
          <div className="w-1" />
        )}

        {/* Desktop floating keymap guide */}
        {!showTouchControls && !isTouchDevice && (
          <div className="glass pointer-events-auto flex items-center gap-2.5 rounded-panel px-3.5 py-1.5 shadow-medium text-[11px] text-ink-500 dark:text-ink-300">
            <span>
              <kbd className="rounded bg-ink-200/80 px-1 py-0.5 font-mono text-[10px] font-semibold text-ink-800 dark:bg-ink-800 dark:text-sage-200">
                WASD
              </kbd>{' '}
              Move
            </span>
            <span>·</span>
            <span>
              <kbd className="rounded bg-ink-200/80 px-1 py-0.5 font-mono text-[10px] font-semibold text-ink-800 dark:bg-ink-800 dark:text-sage-200">
                Shift
              </kbd>{' '}
              Run
            </span>
            <span>·</span>
            <span>
              <kbd className="rounded bg-ink-200/80 px-1 py-0.5 font-mono text-[10px] font-semibold text-ink-800 dark:bg-ink-800 dark:text-sage-200">
                Q / E
              </kbd>{' '}
              Turn
            </span>
            <span>·</span>
            <span>
              <kbd className="rounded bg-ink-200/80 px-1 py-0.5 font-mono text-[10px] font-semibold text-ink-800 dark:bg-ink-800 dark:text-sage-200">
                R / F
              </kbd>{' '}
              Tilt
            </span>
          </div>
        )}

        {/* Look Controls: Touch Pad & D-Pad (on touch or when toggled) */}
        {showTouchControls ? (
          <LookControls onLookDelta={addWalkLookDelta} />
        ) : (
          <div className="w-1" />
        )}
      </div>
    </div>
  );
}

// ── Subtle Center Reticle ────────────────────────────────────────────────

function WalkReticle() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="relative flex items-center justify-center opacity-60">
        <div className="h-1.5 w-1.5 rounded-full bg-white shadow-sm" />
        <div className="absolute -left-3 h-px w-1.5 bg-white/50" />
        <div className="absolute -right-3 h-px w-1.5 bg-white/50" />
        <div className="absolute -top-3 h-1.5 w-px bg-white/50" />
        <div className="absolute -bottom-3 h-1.5 w-px bg-white/50" />
      </div>
    </div>
  );
}

// ── Virtual Joystick for Walking ─────────────────────────────────────────

function VirtualJoystick({
  onChange,
}: {
  onChange: (vec: { forward: number; strafe: number }) => void;
}) {
  const baseRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });

  const RADIUS = 44;

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
          'relative flex h-28 w-28 items-center justify-center rounded-full border-2',
          'touch-none backdrop-blur-md transition-colors',
          active
            ? 'border-sage-400 bg-sage-950/40 shadow-glow'
            : 'border-white/30 bg-ink-950/30 shadow-medium'
        )}
      >
        <div className="absolute h-full w-px bg-white/15" />
        <div className="absolute h-px w-full bg-white/15" />

        <div
          className={clsx(
            'flex h-12 w-12 items-center justify-center rounded-full border shadow-lg',
            'transition-transform duration-75',
            active
              ? 'border-sage-300 bg-sage-600 text-white scale-105'
              : 'border-white/40 bg-white/80 text-ink-800 dark:bg-ink-800 dark:text-sage-100'
          )}
          style={{
            transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
          }}
        >
          <Icon name="joystick" className="h-5 w-5 opacity-75" />
        </div>
      </div>
      <span className="text-[10px] font-medium text-ink-400 dark:text-ink-300">
        Move / Strafe
      </span>
    </div>
  );
}

// ── Touch Lookpad and D-pad ──────────────────────────────────────────────

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

  const levelLook = () => {
    onLookDelta({ yaw: 0, pitch: -999 });
  };

  return (
    <div className="pointer-events-auto flex flex-col items-end gap-2">
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="flex h-20 w-28 flex-col items-center justify-center rounded-panel border border-white/20 bg-ink-950/30 p-2 text-center backdrop-blur-md shadow-medium touch-none"
      >
        <Icon name="touch" className="h-4 w-4 text-sage-300 opacity-80" />
        <span className="mt-1 text-[10px] font-medium text-white/80">
          Swipe to look
        </span>
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-control bg-ink-950/40 p-1 backdrop-blur-md shadow-medium">
        <span />
        <button
          type="button"
          onClick={() => stepLook(0, 8)}
          aria-label="Look up"
          className="flex h-7 w-7 items-center justify-center rounded bg-white/10 text-[10px] text-white hover:bg-white/20 active:bg-sage-600"
        >
          ▲
        </button>
        <span />
        <button
          type="button"
          onClick={() => stepLook(12, 0)}
          aria-label="Turn left"
          className="flex h-7 w-7 items-center justify-center rounded bg-white/10 text-[10px] text-white hover:bg-white/20 active:bg-sage-600"
        >
          ◀
        </button>
        <button
          type="button"
          onClick={levelLook}
          aria-label="Level view to horizon"
          title="Level view"
          className="flex h-7 w-7 items-center justify-center rounded bg-white/10 text-[10px] font-bold text-sage-300 hover:bg-white/20 active:bg-sage-600"
        >
          ●
        </button>
        <button
          type="button"
          onClick={() => stepLook(-12, 0)}
          aria-label="Turn right"
          className="flex h-7 w-7 items-center justify-center rounded bg-white/10 text-[10px] text-white hover:bg-white/20 active:bg-sage-600"
        >
          ▶
        </button>
        <span />
        <button
          type="button"
          onClick={() => stepLook(0, -8)}
          aria-label="Look down"
          className="flex h-7 w-7 items-center justify-center rounded bg-white/10 text-[10px] text-white hover:bg-white/20 active:bg-sage-600"
        >
          ▼
        </button>
        <span />
      </div>
    </div>
  );
}
