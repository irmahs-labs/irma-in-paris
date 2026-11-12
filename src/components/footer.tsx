import { useCopy } from "../lib/language";

/**
 * The foot of every page: where the live data comes from, then Cute
 * Matcha's Footer, which says the one thing the Header doesn't: where to
 * find more apps.
 */
const COPY = {
  en: {
    more: "more apps at",
    sources:
      "Live sources: Île-de-France Mobilités PRIM · Open-Meteo · Vélib' Métropole open data · Google Maps. Maps: Protomaps, © OpenStreetMap contributors",
  },
  fr: {
    more: "plus d’apps sur",
    sources:
      "Sources en direct : Île-de-France Mobilités PRIM · Open-Meteo · données ouvertes Vélib' Métropole · Google Maps. Cartes : Protomaps, © les contributeurs d’OpenStreetMap",
  },
};

export const Footer = () => {
  const t = useCopy(COPY);

  return (
    <>
      <p className="sources">{t.sources}</p>
      <footer className="site-foot">
        {t.more} <a href="https://irmahs.dev">irmahs.dev</a>
      </footer>
    </>
  );
};
