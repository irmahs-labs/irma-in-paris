import type { ReactNode } from "react";

import { Footer } from "./components/footer";
import { Header } from "./components/header";
import { APP_NAME } from "./lib/brand";
import { Icon } from "./lib/icon";
import type { IconName } from "./lib/icon";
import { Link, usePath } from "./lib/router";
import { PlacesScreen } from "./screens/places";
import { RegionScreen } from "./screens/region";
import { TransportScreen } from "./screens/transport";
import { WeatherScreen } from "./screens/weather";

interface Section {
  path: string;
  name: string;
  hint: string;
  icon: IconName;
  Screen: () => ReactNode;
}

const SECTIONS: readonly Section[] = [
  {
    Screen: WeatherScreen,
    hint: "Now and the next 7 days",
    icon: "weather",
    name: "weather",
    path: "/",
  },
  {
    Screen: TransportScreen,
    hint: "Metro, line status, Vélib'",
    icon: "train",
    name: "public transport",
    path: "/transport",
  },
  {
    Screen: RegionScreen,
    hint: "Pollen, pollution, weather by town",
    icon: "map",
    name: "Île-de-France",
    path: "/region",
  },
  {
    Screen: PlacesScreen,
    hint: "Restaurants on a map",
    icon: "pin",
    name: "places I've been",
    path: "/places",
  },
];

/** The three sections, as a side menu on a wide screen and a row of buttons on a phone. */
const Menu = ({ path }: { path: string }) => (
  <fieldset className="panel side">
    <legend className="legend">menu</legend>
    <nav aria-label="sections">
      <ul className="side__list">
        {SECTIONS.map((section) => (
          <li key={section.path}>
            <Link
              href={section.path}
              className="side__item"
              aria-current={section.path === path ? "page" : undefined}
            >
              <Icon name={section.icon} size={20} weight={2} />
              <span className="side__text">
                <span>{section.name}</span>
                <span className="side__hint">{section.hint}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  </fieldset>
);

/** Every page: the header, the menu and the section, and the footer under them. */
export const App = () => {
  // "/places/" and "/places" are the same page; anything unknown is the weather.
  const asked = usePath().replace(/\/+$/u, "") || "/";
  const section = SECTIONS.find((entry) => entry.path === asked) ?? SECTIONS[0];

  if (!section) {
    return null;
  }

  return (
    <>
      {section.path === "/" ? null : (
        <title>{`${section.name} · ${APP_NAME}`}</title>
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
