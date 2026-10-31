import { APP_NAME } from "../lib/brand";
import { useCopy } from "../lib/language";
import { AppIcon } from "./app-icon";

/**
 * The foot of every page, as every irmahs.dev app ends: where the live data
 * comes from, then the train and "Irma in Paris by Irma HS" on a pill, her name
 * linking home.
 */
const COPY = {
  en: {
    by: "by",
    sources:
      "Live sources: Île-de-France Mobilités PRIM · Open-Meteo · Vélib' Métropole open data · Google Maps. Maps: Protomaps, © OpenStreetMap contributors",
  },
  fr: {
    by: "par",
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
        <AppIcon size={20} />
        <span>
          {APP_NAME} {t.by} <a href="https://irmahs.dev">Irma HS</a>
        </span>
      </footer>
    </>
  );
};
