import { APP_NAME } from "../lib/brand";
import { AppIcon } from "./app-icon";

/**
 * The foot of every page, as every irmahs.dev app ends: where the live data
 * comes from, then the train and "Irma in Paris by Irma HS" on a pill, her name
 * linking home.
 */
export const Footer = () => (
  <>
    <p className="sources">
      Live sources: Île-de-France Mobilités PRIM · Open-Meteo · Vélib' Métropole
      open data · Google Maps. Maps: Protomaps, © OpenStreetMap contributors
    </p>
    <footer className="site-foot">
      <AppIcon size={20} />
      <span>
        {APP_NAME} by <a href="https://irmahs.dev">Irma HS</a>
      </span>
    </footer>
  </>
);
