import { useCopy } from "../lib/language";

/**
 * Every irmahs.dev app, then the legal pages, which live on irmahs.dev, as
 * every app's footer ends. The same list in every app, in the same order
 * (irmahs-labs/landing-page `src/lib/site-links.ts`).
 */
const APPS = [
  { href: "https://irmahs.dev", name: "Landing Page" },
  { href: "https://pantry-spinner.irmahs.dev", name: "Pantry Spinner" },
  { href: "https://realms.irmahs.dev", name: "Realms" },
  { href: "https://minigames.irmahs.dev", name: "Mini Games" },
  { href: "https://tools.irmahs.dev", name: "Tools" },
  { href: "https://alma-housila.irmahs.dev", name: "Alma" },
  { href: "https://irma-in-paris.irmahs.dev", name: "Irma in Paris" },
] as const;

const COPY = {
  en: {
    apps: "Irma HS’s apps",
    legal: "Legal",
    pages: [
      { name: "Legal notice", slug: "legal" },
      { name: "Privacy", slug: "privacy" },
      { name: "Terms of use", slug: "terms" },
      { name: "Cookies", slug: "cookies" },
    ],
  },
  fr: {
    apps: "Les applications d’Irma HS",
    legal: "Juridique",
    pages: [
      { name: "Mentions légales", slug: "legal" },
      { name: "Confidentialité", slug: "privacy" },
      { name: "Conditions d’utilisation", slug: "terms" },
      { name: "Cookies", slug: "cookies" },
    ],
  },
};

export const SiteLinks = () => {
  const t = useCopy(COPY);

  return (
    <div className="site-links">
      <nav aria-label={t.apps}>
        <ul>
          {APPS.map((app) => (
            <li key={app.href}>
              <a href={app.href}>{app.name}</a>
            </li>
          ))}
        </ul>
      </nav>
      <nav aria-label={t.legal}>
        <ul>
          {t.pages.map((page) => (
            <li key={page.slug}>
              <a href={`https://irmahs.dev/${page.slug}`}>{page.name}</a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
};
