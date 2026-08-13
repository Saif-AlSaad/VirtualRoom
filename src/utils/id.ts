/**
 * Stable ID generation.
 *
 * IDs must survive serialisation, undo/redo and share links, so they are
 * generated once at creation and never derived from array position.
 */

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

function randomSuffix(length: number): string {
  const cryptoObj = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint8Array(length);
    cryptoObj.getRandomValues(bytes);
    let out = '';
    for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
    return out;
  }
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

/**
 * Prefixed, collision-resistant ID. Includes a base-36 timestamp so IDs sort
 * roughly by creation time, which makes debugging saved JSON far easier.
 */
export function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${randomSuffix(6)}`;
}

/** Non-guessable project ID — share links must not be enumerable. */
export function createProjectId(): string {
  return `prj_${Date.now().toString(36)}${randomSuffix(14)}`;
}
