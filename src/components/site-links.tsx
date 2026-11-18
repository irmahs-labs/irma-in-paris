import { useCopy } from "../lib/language";

/**
 * The legal pages, which live on irmahs.dev, as every app's footer ends:
 * the legal notice, the privacy policy, the terms of use and the cookies.
 */
const COPY = {
  en: {
    legal: "Legal",
    pages: [
      { name: "Legal notice", slug: "legal" },
      { name: "Privacy", slug: "privacy" },
      { name: "Terms of use", slug: "terms" },
      { name: "Cookies", slug: "cookies" },
    ],
  },
  fr: {
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
    <nav aria-label={t.legal} className="site-links">
      <ul>
        {t.pages.map((page) => (
          <li key={page.slug}>
            <a href={`https://irmahs.dev/${page.slug}`}>{page.name}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
};
