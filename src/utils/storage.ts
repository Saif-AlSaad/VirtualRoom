import type { Project } from '@/types';
import { parseProject, serializeProject } from './schema';

/**
 * localStorage persistence.
 *
 * Every access is wrapped: storage can be disabled (private browsing), full
 * (quota), or hold data written by an older build. A storage failure must
 * degrade to "we couldn't save" — never to a lost scene or a thrown render.
 */

const PREFIX = 'roomcraft:v1:';
const INDEX_KEY = `${PREFIX}index`;
const PROJECT_KEY = (id: string) => `${PREFIX}project:${id}`;
const SETTINGS_KEY = `${PREFIX}settings`;
const LAST_OPEN_KEY = `${PREFIX}last-open`;
const AUTOSAVE_KEY = `${PREFIX}autosave`;

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: number;
  createdAt: number;
  furnitureCount: number;
  width: number;
  length: number;
  unit: string;
}

export type StorageResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; quotaExceeded: boolean };

function available(): boolean {
  try {
    const probe = `${PREFIX}__probe__`;
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

export const storageAvailable = (): boolean =>
  typeof window !== 'undefined' && available();

function isQuotaError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  // Browsers disagree on the name; check the ones that actually ship.
  return (
    err.name === 'QuotaExceededError' ||
    err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    // Safari private mode reports a generic error with this code.
    (err as DOMException).code === 22
  );
}

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key: string, value: string): StorageResult<void> {
  try {
    window.localStorage.setItem(key, value);
    return { ok: true, value: undefined };
  } catch (err) {
    const quota = isQuotaError(err);
    return {
      ok: false,
      quotaExceeded: quota,
      error: quota
        ? 'Browser storage is full. Delete an old project or export this one to a file.'
        : 'Could not write to browser storage.',
    };
  }
}

function removeRaw(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* nothing useful to do — the entry stays until the browser clears it */
  }
}

// ── Project index ────────────────────────────────────────────────────────

export function listProjects(): ProjectSummary[] {
  const raw = readRaw(INDEX_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (p): p is ProjectSummary =>
          typeof p === 'object' &&
          p !== null &&
          typeof (p as ProjectSummary).id === 'string'
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

function writeIndex(list: ProjectSummary[]): StorageResult<void> {
  return writeRaw(INDEX_KEY, JSON.stringify(list));
}

function summarize(project: Project): ProjectSummary {
  return {
    id: project.id,
    name: project.name,
    updatedAt: project.updatedAt,
    createdAt: project.createdAt,
    furnitureCount: project.furniture.length,
    width: project.room.dimensions.width,
    length: project.room.dimensions.length,
    unit: project.unit,
  };
}

export function saveProject(project: Project): StorageResult<void> {
  const written = writeRaw(PROJECT_KEY(project.id), serializeProject(project));
  if (!written.ok) return written;

  const index = listProjects().filter((p) => p.id !== project.id);
  index.unshift(summarize(project));
  const indexWritten = writeIndex(index);
  if (!indexWritten.ok) return indexWritten;

  return { ok: true, value: undefined };
}

export function loadProject(id: string): Project | null {
  const raw = readRaw(PROJECT_KEY(id));
  if (!raw) return null;
  try {
    const result = parseProject(JSON.parse(raw));
    return result.ok ? result.project : null;
  } catch {
    return null;
  }
}

export function deleteProject(id: string): void {
  removeRaw(PROJECT_KEY(id));
  writeIndex(listProjects().filter((p) => p.id !== id));
  if (readRaw(LAST_OPEN_KEY) === id) removeRaw(LAST_OPEN_KEY);
}

export function setLastOpenProject(id: string | null): void {
  if (id === null) removeRaw(LAST_OPEN_KEY);
  else writeRaw(LAST_OPEN_KEY, id);
}

export function getLastOpenProject(): string | null {
  return readRaw(LAST_OPEN_KEY);
}

// ── Crash recovery ───────────────────────────────────────────────────────

/**
 * A single rolling autosave slot, written on every debounced change.
 *
 * This is deliberately separate from the named project record: if a save to the
 * project key fails (quota) the autosave slot may still hold the newest work,
 * and "Recover last autosave" can get it back after a refresh or crash.
 */
export function writeAutosave(project: Project): StorageResult<void> {
  return writeRaw(
    AUTOSAVE_KEY,
    JSON.stringify({ savedAt: Date.now(), project })
  );
}

export function readAutosave(): { savedAt: number; project: Project } | null {
  const raw = readRaw(AUTOSAVE_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { savedAt, project } = parsed as { savedAt?: unknown; project?: unknown };
    const result = parseProject(project);
    if (!result.ok) return null;
    return {
      savedAt: typeof savedAt === 'number' ? savedAt : 0,
      project: result.project,
    };
  } catch {
    return null;
  }
}

export function clearAutosave(): void {
  removeRaw(AUTOSAVE_KEY);
}

// ── App settings (theme, units, snapping…) ───────────────────────────────

export function readSettings<T>(fallback: T): T {
  const raw = readRaw(SETTINGS_KEY);
  if (!raw) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return fallback;
    return { ...fallback, ...(parsed as Partial<T>) };
  } catch {
    return fallback;
  }
}

export function writeSettings<T>(settings: T): void {
  writeRaw(SETTINGS_KEY, JSON.stringify(settings));
}

/** Rough bytes used by RoomCraft — surfaced in the storage warning toast. */
export function estimateUsage(): number {
  let total = 0;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(PREFIX)) continue;
      total += key.length + (window.localStorage.getItem(key)?.length ?? 0);
    }
  } catch {
    return 0;
  }
  // UTF-16 code units.
  return total * 2;
}
