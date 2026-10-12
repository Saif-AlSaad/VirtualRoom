import '@testing-library/jest-dom/vitest';

/**
 * jsdom does not implement matchMedia, which the theme and reduced-motion hooks
 * read at module scope. Stub it before any store is imported.
 */
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = () => `blob:mock-url-${Math.random().toString(36).slice(2)}`;
}
if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = () => {};
}

