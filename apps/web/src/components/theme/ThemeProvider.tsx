'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

type Theme = 'dark' | 'light';
const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void } | null>(null);

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener('neighbors-theme-change', onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener('neighbors-theme-change', onChange);
  };
}

// Fallback when browser storage throws (blocked cookies, some private modes).
let memoryTheme: Theme = 'dark';

function getSnapshot(): Theme {
  try {
    return window.localStorage.getItem('neighbors-theme') === 'light' ? 'light' : 'dark';
  } catch {
    return memoryTheme;
  }
}

function getServerSnapshot(): Theme {
  return 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    memoryTheme = next;
    try {
      window.localStorage.setItem('neighbors-theme', next);
    } catch {
      // The in-memory theme still applies for this page session.
    }
    window.dispatchEvent(new Event('neighbors-theme-change'));
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}
