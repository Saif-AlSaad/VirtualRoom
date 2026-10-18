import { create } from 'zustand';
import type {
  CameraPreset,
  Category,
  TimeOfDay,
  ToastMessage,
  ViewMode,
  WallSide,
} from '@/types';
import { DEFAULT_SNAP, type SnapSettings } from '@/utils/snapping';
import { createId } from '@/utils/id';
import { readSettings, writeSettings } from '@/utils/storage';

/**
 * Ephemeral and preference state.
 *
 * Nothing here is part of the design document, so nothing here is undoable or
 * saved into a project file. Preferences (theme, snapping, currency, favourites)
 * persist separately, per-browser, because they belong to the person rather
 * than to the room they happen to be editing.
 */

export type Screen = 'dashboard' | 'editor';

export type PanelId = 'catalog' | 'properties' | 'room' | 'objects' | 'summary';

export type ModalId =
  | null
  | 'new-project'
  | 'room-setup'
  | 'share'
  | 'summary'
  | 'shortcuts'
  | 'confirm-reset'
  | 'confirm-delete-project'
  | 'import'
  | 'about';

/** Persisted slice of the UI store. */
interface Preferences {
  theme: 'light' | 'dark' | 'system';
  currency: string;
  snap: SnapSettings;
  showDimensions: boolean;
  showClearance: boolean;
  showGrid: boolean;
  quality: 'high' | 'balanced' | 'performance';
  soundEnabled: boolean;
  favorites: string[];
  recentCatalog: string[];
  onboardingDone: boolean;
}

const DEFAULT_PREFS: Preferences = {
  theme: 'dark',
  currency: 'USD',
  snap: DEFAULT_SNAP,
  showDimensions: true,
  showClearance: false,
  showGrid: true,
  quality: 'high',
  soundEnabled: false,
  favorites: [],
  recentCatalog: [],
  onboardingDone: false,
};

export interface UIState extends Preferences {
  screen: Screen;
  viewMode: ViewMode;
  cameraPreset: CameraPreset;
  /** Bumped to re-trigger a fly-to even when the preset is unchanged. */
  cameraNonce: number;
  timeOfDay: TimeOfDay;
  lightIntensity: number;

  catalogOpen: boolean;
  propertiesOpen: boolean;
  activeCategory: Category | 'all';
  catalogQuery: string;
  presentationMode: boolean;

  modal: ModalId;
  /** Extra payload for the active modal (e.g. the project id to delete). */
  modalPayload: string | null;

  toasts: ToastMessage[];
  /** Catalog id currently being dragged from the sidebar, if any. */
  dragCatalogId: string | null;
  /** True while a placement drag is invalid, for cursor feedback. */
  dragInvalidReason: string | null;

  reducedMotion: boolean;
  measureToolActive: boolean;
  viewerMode: boolean;
  pointerLockActive: boolean;
  walkJoystick: { forward: number; strafe: number };
  walkLookDelta: { yaw: number; pitch: number };

  setScreen: (screen: Screen) => void;
  setViewMode: (mode: ViewMode) => void;
  setViewerMode: (on: boolean) => void;
  setPointerLockActive: (active: boolean) => void;
  setWalkJoystick: (joystick: { forward: number; strafe: number }) => void;
  addWalkLookDelta: (delta: { yaw: number; pitch: number }) => void;
  consumeWalkLookDelta: () => { yaw: number; pitch: number };
  setCameraPreset: (preset: CameraPreset) => void;
  planViewAngle: number;
  setPlanViewAngle: (angle: number) => void;
  rotatePlanView: (deltaDegrees: number) => void;
  setTimeOfDay: (time: TimeOfDay) => void;
  setLightIntensity: (value: number) => void;
  selectedWallSide: WallSide | 'all';
  setSelectedWallSide: (side: WallSide | 'all') => void;

  toggleCatalog: (open?: boolean) => void;
  setPropertiesOpen: (open: boolean) => void;
  setActiveCategory: (category: Category | 'all') => void;
  setCatalogQuery: (query: string) => void;
  setPresentationMode: (on: boolean) => void;

  openModal: (modal: ModalId, payload?: string | null) => void;
  closeModal: () => void;

  toast: (
    title: string,
    opts?: { description?: string; tone?: ToastMessage['tone'] }
  ) => string;
  dismissToast: (id: string) => void;

  setDragCatalogId: (id: string | null) => void;
  setDragInvalidReason: (reason: string | null) => void;

  setTheme: (theme: Preferences['theme']) => void;
  setCurrency: (currency: string) => void;
  setSnap: (patch: Partial<SnapSettings>) => void;
  setShowDimensions: (on: boolean) => void;
  setShowClearance: (on: boolean) => void;
  setShowGrid: (on: boolean) => void;
  setQuality: (q: Preferences['quality']) => void;
  setSoundEnabled: (on: boolean) => void;
  toggleFavorite: (catalogId: string) => void;
  noteCatalogUse: (catalogId: string) => void;
  completeOnboarding: () => void;
  setReducedMotion: (on: boolean) => void;
  setMeasureToolActive: (active: boolean) => void;
  toggleMeasureTool: () => void;
}

const PERSISTED_KEYS: Array<keyof Preferences> = [
  'theme',
  'currency',
  'snap',
  'showDimensions',
  'showClearance',
  'showGrid',
  'quality',
  'soundEnabled',
  'favorites',
  'recentCatalog',
  'onboardingDone',
];

function persist(state: UIState): void {
  const prefs = {} as Preferences;
  for (const key of PERSISTED_KEYS) {
    // Index assignment across a heterogeneous union needs the cast; the key
    // list above is the real guarantee that only preferences are written.
    (prefs as unknown as Record<string, unknown>)[key] = state[key];
  }
  writeSettings(prefs);
}

const loaded =
  typeof window === 'undefined'
    ? DEFAULT_PREFS
    : readSettings<Preferences>(DEFAULT_PREFS);

/** How many toasts can stack before the oldest is pushed out. */
const MAX_TOASTS = 4;
const TOAST_MS = 4200;

export const useUI = create<UIState>((set, get) => ({
  ...DEFAULT_PREFS,
  ...loaded,
  // Merge defensively: a settings blob from an older build may be missing keys.
  snap: { ...DEFAULT_SNAP, ...(loaded.snap ?? {}) },
  favorites: Array.isArray(loaded.favorites) ? loaded.favorites : [],
  recentCatalog: Array.isArray(loaded.recentCatalog) ? loaded.recentCatalog : [],

  screen: 'dashboard',
  viewMode: '3d',
  cameraPreset: 'corner',
  cameraNonce: 0,
  timeOfDay: 'day',
  lightIntensity: 1,

  catalogOpen: true,
  propertiesOpen: true,
  activeCategory: 'all',
  catalogQuery: '',
  presentationMode: false,

  modal: null,
  modalPayload: null,
  toasts: [],
  dragCatalogId: null,
  dragInvalidReason: null,
  reducedMotion:
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  measureToolActive: false,
  viewerMode:
    typeof window !== 'undefined' &&
    (window.innerWidth < 1024 || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0)),
  pointerLockActive: false,
  walkJoystick: { forward: 0, strafe: 0 },
  walkLookDelta: { yaw: 0, pitch: 0 },

  setScreen: (screen) => set({ screen }),
  setViewerMode: (viewerMode) => set({ viewerMode }),
  setPointerLockActive: (pointerLockActive) => set({ pointerLockActive }),
  setWalkJoystick: (walkJoystick) => set({ walkJoystick }),
  addWalkLookDelta: (delta) =>
    set((s) => ({
      walkLookDelta: {
        yaw: s.walkLookDelta.yaw + delta.yaw,
        pitch: s.walkLookDelta.pitch + delta.pitch,
      },
    })),
  consumeWalkLookDelta: () => {
    const current = get().walkLookDelta;
    if (current.yaw !== 0 || current.pitch !== 0) {
      set({ walkLookDelta: { yaw: 0, pitch: 0 } });
    }
    return current;
  },

  setViewMode: (viewMode) =>
    set((s) => ({
      viewMode,
      cameraPreset:
        viewMode === '2d'
          ? // The top-down view is only coherent from directly above.
            'top'
          : // Leaving 2D must also leave the overhead camera behind, or "3D"
            // shows the same flat plan and looks like the toggle did nothing.
            s.cameraPreset === 'top'
            ? 'corner'
            : s.cameraPreset,
      cameraNonce: s.cameraNonce + 1,
    })),

  setCameraPreset: (cameraPreset) =>
    set((s) => ({
      cameraPreset,
      cameraNonce: s.cameraNonce + 1,
      viewMode: s.viewMode === '2d' && cameraPreset !== 'top' ? '3d' : s.viewMode,
    })),

  planViewAngle: 0,
  setPlanViewAngle: (planViewAngle) =>
    set((s) => ({
      planViewAngle: ((planViewAngle % 360) + 360) % 360,
      cameraPreset: 'top',
      cameraNonce: s.cameraNonce + 1,
    })),

  rotatePlanView: (delta) =>
    set((s) => {
      const nextAngle = ((s.planViewAngle + delta) % 360 + 360) % 360;
      return {
        planViewAngle: nextAngle,
        cameraPreset: 'top',
        cameraNonce: s.cameraNonce + 1,
      };
    }),

  setTimeOfDay: (timeOfDay) => set({ timeOfDay }),
  setLightIntensity: (lightIntensity) =>
    set({ lightIntensity: Math.min(Math.max(lightIntensity, 0), 2) }),
  selectedWallSide: 'all',
  setSelectedWallSide: (selectedWallSide) => set({ selectedWallSide }),

  toggleCatalog: (open) =>
    set((s) => ({ catalogOpen: open ?? !s.catalogOpen })),
  setPropertiesOpen: (propertiesOpen) => set({ propertiesOpen }),
  setActiveCategory: (activeCategory) => set({ activeCategory }),
  setCatalogQuery: (catalogQuery) => set({ catalogQuery }),
  setPresentationMode: (presentationMode) =>
    set({ presentationMode, modal: null }),

  openModal: (modal, payload = null) => set({ modal, modalPayload: payload }),
  closeModal: () => set({ modal: null, modalPayload: null }),

  toast: (title, opts = {}) => {
    const id = createId('tst');
    const message: ToastMessage = {
      id,
      title,
      description: opts.description,
      tone: opts.tone ?? 'info',
    };
    set((s) => ({ toasts: [...s.toasts, message].slice(-MAX_TOASTS) }));
    // Errors stay until dismissed — they usually need the user to do something.
    if (message.tone !== 'error') {
      window.setTimeout(() => get().dismissToast(id), TOAST_MS);
    }
    return id;
  },

  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  setDragCatalogId: (dragCatalogId) => set({ dragCatalogId }),
  setDragInvalidReason: (dragInvalidReason) => set({ dragInvalidReason }),

  setTheme: (theme) => {
    set({ theme });
    persist(get());
  },
  setCurrency: (currency) => {
    set({ currency });
    persist(get());
  },
  setSnap: (patch) => {
    set((s) => ({ snap: { ...s.snap, ...patch } }));
    persist(get());
  },
  setShowDimensions: (showDimensions) => {
    set({ showDimensions });
    persist(get());
  },
  setShowClearance: (showClearance) => {
    set({ showClearance });
    persist(get());
  },
  setShowGrid: (showGrid) => {
    set({ showGrid });
    persist(get());
  },
  setQuality: (quality) => {
    set({ quality });
    persist(get());
  },
  setSoundEnabled: (soundEnabled) => {
    set({ soundEnabled });
    persist(get());
  },
  toggleFavorite: (catalogId) => {
    set((s) => ({
      favorites: s.favorites.includes(catalogId)
        ? s.favorites.filter((f) => f !== catalogId)
        : [...s.favorites, catalogId],
    }));
    persist(get());
  },
  noteCatalogUse: (catalogId) => {
    set((s) => ({
      recentCatalog: [catalogId, ...s.recentCatalog.filter((c) => c !== catalogId)].slice(
        0,
        12
      ),
    }));
    persist(get());
  },
  completeOnboarding: () => {
    set({ onboardingDone: true });
    persist(get());
  },
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  setMeasureToolActive: (measureToolActive) => set({ measureToolActive }),
  toggleMeasureTool: () => set((s) => ({ measureToolActive: !s.measureToolActive })),
}));

/** Resolves the `system` theme choice against the OS setting. */
export function resolveTheme(theme: Preferences['theme']): 'light' | 'dark' {
  if (theme !== 'system') return theme;
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}
