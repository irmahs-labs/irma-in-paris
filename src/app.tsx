import type { ReactNode } from "react";

import { Footer } from "./components/footer";
import { Header } from "./components/header";
import { APP_NAME } from "./lib/brand";
import { Icon } from "./lib/icon";
import type { IconName } from "./lib/icon";
import { useCopy, useLanguage } from "./lib/language";
import type { Language } from "./lib/language";
import { Link, usePath, withoutTrailingSlashes } from "./lib/router";
import { BusesScreen } from "./screens/buses";
import { PlacesScreen } from "./screens/places";
import { RailScreen } from "./screens/rail";
import { RegionScreen } from "./screens/region";
import { VelibScreen } from "./screens/velib";
import { WeatherScreen } from "./screens/weather";

interface Section {
  path: string;
  /** Its name and the line under it, in each language. */
  name: Record<Language, string>;
  hint: Record<Language, string>;
  icon: IconName;
  Screen: () => ReactNode;
}

const SECTIONS: readonly Section[] = [
  {
    Screen: WeatherScreen,
    hint: {
      en: "Now and the next 7 days",
      fr: "Maintenant et les 7 prochains jours",
    },
    icon: "weather",
    name: { en: "weather", fr: "météo" },
    path: "/",
  },
  {
    Screen: RailScreen,
    hint: {
      en: "Metro, RER, tram, Transilien",
      fr: "Métro, RER, tram, Transilien",
    },
    icon: "train",
    name: { en: "rail", fr: "rail" },
    path: "/transport",
  },
  {
    Screen: BusesScreen,
    hint: {
      en: "Any line, or the stops near you",
      fr: "Toutes les lignes, ou les arrêts près de vous",
    },
    icon: "bus",
    name: { en: "buses", fr: "bus" },
    path: "/buses",
  },
  {
    Screen: VelibScreen,
    hint: {
      en: "Bikes and free docks",
      fr: "Vélos et bornes libres",
    },
    icon: "bike",
    name: { en: "Vélib'", fr: "Vélib'" },
    path: "/velib",
  },
  {
    Screen: RegionScreen,
    hint: {
      en: "Pollen, pollution, weather by town",
      fr: "Pollen, pollution, météo par ville",
    },
    icon: "map",
    name: { en: "Île-de-France", fr: "Île-de-France" },
    path: "/region",
  },
  {
    Screen: PlacesScreen,
    hint: { en: "Restaurants on a map", fr: "Les restaurants sur une carte" },
    icon: "pin",
    name: { en: "places I've been", fr: "où j’ai mangé" },
    path: "/places",
  },
];

const MENU_COPY = {
  en: { menu: "menu", sections: "sections" },
  fr: { menu: "menu", sections: "rubriques" },
};

/** The sections, as a side menu on a wide screen and a row of buttons on a phone. */
const Menu = ({ path }: { path: string }) => {
  const language = useLanguage();
  const t = useCopy(MENU_COPY);

  return (
    <fieldset className="panel side">
      <legend className="legend">{t.menu}</legend>
      <nav aria-label={t.sections}>
        <ul className="side__list">
          {SECTIONS.map((section) => (
            <li key={section.path}>
              <Link
                href={section.path}
                className="side__item"
                aria-current={section.path === path ? "page" : undefined}
              >
                <Icon name={section.icon} size={20} />
                <span className="side__text">
                  <span>{section.name[language]}</span>
                  <span className="side__hint">{section.hint[language]}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </fieldset>
  );
};

/** Every page: the header, the menu and the section, and the footer under them. */
export const App = () => {
  // "/places/" and "/places" are the same page; anything unknown is the weather.
  const asked = withoutTrailingSlashes(usePath()) || "/";
  const section = SECTIONS.find((entry) => entry.path === asked) ?? SECTIONS[0];
  const language = useLanguage();

  if (!section) {
    return null;
  }

  return (
    <>
      {section.path === "/" ? null : (
        <title>{`${section.name[language]} · ${APP_NAME}`}</title>
      )}
      <Header />
      <main className="page">
        <Menu path={section.path} />
        <div className="content">
          <section.Screen />
        </div>
      </main>
      <Footer />
    </>
  );
};
