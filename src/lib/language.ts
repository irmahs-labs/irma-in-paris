import { useSyncExternalStore } from "react";

/**
 * English or French. Every irmahs.dev app reads and writes the same choice:
 * a `lang` cookie on irmahs.dev, so picking French on one app opens the others
 * in French too, and in localStorage for this app alone (localhost included,
 * where the cookie can't be shared). English until a visitor picks. The
 * inline script in index.html puts it on <html lang> before the first paint.
 */
export type Language = "en" | "fr";

export const LANGUAGES: readonly Language[] = ["en", "fr"];

export const DEFAULT_LANGUAGE: Language = "en";

/** Each language by its own name, as the header's pill labels it. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: "English",
  fr: "Français",
};

/** For Intl: dates and numbers as each language writes them. */
export const LOCALES: Record<Language, string> = {
  en: "en-GB",
  fr: "fr-FR",
};

const STORAGE_KEY = "lang";
const COOKIE = "lang";
const SHARED_DOMAIN = "irmahs.dev";
const YEAR = 60 * 60 * 24 * 365;

const isLanguage = (value: string | null | undefined): value is Language =>
  value === "en" || value === "fr";

const onSharedDomain = () => {
  const host = window.location.hostname;

  return host === SHARED_DOMAIN || host.endsWith(`.${SHARED_DOMAIN}`);
};

const readCookie = (): string | null => {
  try {
    const match = document.cookie
      .split("; ")
      .find((part) => part.startsWith(`${COOKIE}=`));

    return match ? match.slice(COOKIE.length + 1) : null;
  } catch {
    return null;
  }
};

const readStorage = (): string | null => {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

/** The shared cookie first, as the latest choice on any app, then this app's own. */
export const savedLanguage = (): Language | null => {
  const cookie = readCookie();

  if (isLanguage(cookie)) {
    return cookie;
  }

  const saved = readStorage();

  return isLanguage(saved) ? saved : null;
};

let current: Language | null = null;

const listeners = new Set<() => void>();

/** The page's language, for code outside React (a reducer, a formatter). */
export const currentLanguage = (): Language => {
  current ??= savedLanguage() ?? DEFAULT_LANGUAGE;

  return current;
};

const apply = (language: Language) => {
  current = language;
  document.documentElement.lang = language;

  for (const listener of listeners) {
    listener();
  }
};

// Another tab of this app picked a language.
const onStorage = (event: StorageEvent) => {
  if (event.key === STORAGE_KEY && isLanguage(event.newValue)) {
    apply(event.newValue);
  }
};

const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
};

export const useLanguage = () =>
  useSyncExternalStore(subscribe, currentLanguage);

/** The copy for the page's language, from one object per language. */
export const useCopy = <T>(copy: Record<Language, T>): T => copy[useLanguage()];

/** Switches the page, and remembers the choice here and on every irmahs.dev app. */
export const chooseLanguage = (language: Language) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Not saved, but the page still switches for this visit.
  }

  if (onSharedDomain()) {
    // oxlint-disable-next-line unicorn/no-document-cookie -- the one cookie every irmahs.dev app shares
    document.cookie = `${COOKIE}=${language}; Domain=${SHARED_DOMAIN}; Path=/; Max-Age=${YEAR}; SameSite=Lax; Secure`;
  }

  apply(language);
};
