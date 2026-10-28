import { useSyncExternalStore } from "react";

/**
 * Light or Dark Matcha. The page always carries one on <html data-theme>:
 * the inline script in index.html sets it before the first paint, from the
 * visitor's saved choice or else their device's setting. Until they pick
 * one with the toggle, the page keeps following the device.
 */
export type Theme = "light" | "dark";

const STORAGE_KEY = "theme";

const darkQuery = () => window.matchMedia?.("(prefers-color-scheme: dark)");

const savedTheme = (): Theme | null => {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);

    return saved === "light" || saved === "dark" ? saved : null;
  } catch {
    return null;
  }
};

const currentTheme = (): Theme =>
  document.documentElement.dataset.theme === "dark" ? "dark" : "light";

const listeners = new Set<() => void>();

const apply = (theme: Theme) => {
  document.documentElement.dataset.theme = theme;

  for (const listener of listeners) {
    listener();
  }
};

// The device setting only leads while no choice has been saved.
const followDevice = (event: MediaQueryListEvent) => {
  if (savedTheme() === null) {
    apply(event.matches ? "dark" : "light");
  }
};

const subscribe = (onChange: () => void) => {
  listeners.add(onChange);

  const query = darkQuery();

  query?.addEventListener("change", followDevice);

  return () => {
    listeners.delete(onChange);
    query?.removeEventListener("change", followDevice);
  };
};

export const useTheme = () => useSyncExternalStore(subscribe, currentTheme);

/** Switches the page and remembers the choice in this browser. */
export const chooseTheme = (theme: Theme) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Not saved, but the page still switches for this visit.
  }

  apply(theme);
};
