import type { CatalogItem } from '@/types';
import { registerCustomCatalogItem, unregisterCustomCatalogItem } from '@/data/catalog';

const STORAGE_KEY = 'roomcraft:v1:custom_catalog';
const DB_NAME = 'roomcraft_models';
const STORE_NAME = 'models';
const DB_VERSION = 1;

// Session cache of active ObjectURLs keyed by catalogId
const objectUrlCache = new Map<string, string>();

function isIndexedDBAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openDB(): Promise<IDBDatabase | null> {
  if (!isIndexedDBAvailable()) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => resolve(null);
      request.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
    } catch {
      resolve(null);
    }
  });
}

export async function saveModelBinaryToDB(id: string, buffer: ArrayBuffer): Promise<boolean> {
  const db = await openDB();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(buffer, id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export async function getModelBinaryFromDB(id: string): Promise<ArrayBuffer | null> {
  const db = await openDB();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result instanceof ArrayBuffer ? req.result : null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function deleteModelBinaryFromDB(id: string): Promise<boolean> {
  const db = await openDB();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

/** Reads custom catalog item definitions persisted in localStorage */
export function getSavedCustomCatalog(): CatalogItem[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CatalogItem[]) : [];
  } catch {
    return [];
  }
}

/** Saves custom catalog item definitions to localStorage */
export function persistCustomCatalog(items: CatalogItem[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // quota error or private mode — non-fatal
  }
}

/**
 * Initializes the custom catalog: loads definitions from localStorage,
 * registers them in the catalog registry, and preheats ObjectURLs from IndexedDB.
 */
export async function initCustomCatalog(): Promise<void> {
  const saved = getSavedCustomCatalog();
  for (const item of saved) {
    registerCustomCatalogItem(item);
    // Asynchronously create/cache ObjectURL for this model
    await getCustomModelUrl(item.id);
  }
}

function safeCreateObjectURL(blob: Blob): string {
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    return URL.createObjectURL(blob);
  }
  return `blob:fallback-${Math.random().toString(36).slice(2)}`;
}

function safeRevokeObjectURL(url: string): void {
  if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  }
}

/**
 * Saves a newly uploaded model: persists binary in IndexedDB,
 * metadata in localStorage, registers it in the catalog, and creates an ObjectURL.
 */
export async function saveCustomModel(
  item: CatalogItem,
  buffer: ArrayBuffer
): Promise<string> {
  // 1. Save binary in IndexedDB
  await saveModelBinaryToDB(item.id, buffer);

  // 2. Persist in custom catalog list
  const current = getSavedCustomCatalog().filter((c) => c.id !== item.id);
  current.push(item);
  persistCustomCatalog(current);

  // 3. Register in runtime catalog
  registerCustomCatalogItem(item);

  // 4. Cache & return an ObjectURL
  const blob = new Blob([buffer], { type: 'model/gltf-binary' });
  const url = safeCreateObjectURL(blob);
  objectUrlCache.set(item.id, url);
  return url;
}

/**
 * Resolves or restores an ObjectURL for a custom model ID from IndexedDB or memory cache.
 */
export async function getCustomModelUrl(catalogId: string): Promise<string | null> {
  const cached = objectUrlCache.get(catalogId);
  if (cached) return cached;

  const buffer = await getModelBinaryFromDB(catalogId);
  if (!buffer) return null;

  const blob = new Blob([buffer], { type: 'model/gltf-binary' });
  const url = safeCreateObjectURL(blob);
  objectUrlCache.set(catalogId, url);
  return url;
}

/**
 * Removes a custom model from IndexedDB, localStorage, and runtime catalog.
 */
export async function deleteCustomModel(catalogId: string): Promise<void> {
  const cached = objectUrlCache.get(catalogId);
  if (cached) {
    safeRevokeObjectURL(cached);
    objectUrlCache.delete(catalogId);
  }

  await deleteModelBinaryFromDB(catalogId);
  const updated = getSavedCustomCatalog().filter((c) => c.id !== catalogId);
  persistCustomCatalog(updated);
  unregisterCustomCatalogItem(catalogId);
}
