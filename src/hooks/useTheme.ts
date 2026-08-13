import { useEffect } from 'react';
import { useUI, resolveTheme } from '@/store/uiStore';

/**
 * Applies the theme to the document root and keeps `reducedMotion` in sync with
 * the OS setting.
 *
 * The reduced-motion listener is live, not read-once: someone toggling the
 * setting in System Preferences should see the app stop animating immediately,
 * without a reload.
 */
export function useTheme(): void {
  const theme = useUI((s) => s.theme);
  const setReducedMotion = useUI((s) => s.setReducedMotion);

  useEffect(() => {
    const apply = () => {
      const resolved = resolveTheme(theme);
      document.documentElement.classList.toggle('dark', resolved === 'dark');
      document.documentElement.style.colorScheme = resolved;
    };
    apply();

    if (theme !== 'system') return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, [theme]);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [setReducedMotion]);
}
