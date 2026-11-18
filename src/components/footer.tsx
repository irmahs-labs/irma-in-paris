import { useCopy } from "../lib/language";
import { SiteLinks } from "./site-links";

/**
 * The foot of every page: where the live data comes from, then Cute
 * Matcha's Footer, which says the one thing the Header doesn't: where to
 * find more apps.
 */
const COPY = {
  en: {
    more: "more apps at",
    sources:
      "Live sources: Île-de-France Mobilités PRIM · Open-Meteo · Vélib' Métropole via Paris Data · Google Maps. Maps: Protomaps, © OpenStreetMap contributors",
  },
  fr: {
    more: "plus d’apps sur",
    sources:
      "Sources en direct : Île-de-France Mobilités PRIM · Open-Meteo · Vélib' Métropole via Paris Data · Google Maps. Cartes : Protomaps, © les contributeurs d’OpenStreetMap",
  },
};

export const Footer = () => {
  const t = useCopy(COPY);

  return (
    <footer className="site-end">
      <p className="sources">{t.sources}</p>
      <p className="site-foot">
        {t.more} <a href="https://irmahs.dev">irmahs.dev</a>
      </p>
      <SiteLinks />
    </footer>
  );
};
