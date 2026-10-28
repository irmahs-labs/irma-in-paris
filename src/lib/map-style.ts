import { layers, namedFlavor } from "@protomaps/basemaps";
import type { Flavor } from "@protomaps/basemaps";
import type { StyleSpecification } from "maplibre-gl";

import type { Theme } from "./theme";

/**
 * The map in Cute Matcha's colours: Protomaps' own light and dark basemaps
 * with the ground, parks, water, streets, buildings and labels taken from
 * the design system's tokens (tokens.json), so it sits in a panel like the
 * rest of the page. Anything not named here keeps Protomaps' colour.
 */
const LIGHT: Partial<Flavor> = {
  background: "#f3f1c8",
  buildings: "#e8e1bd",
  city_label: "#2f3b34",
  city_label_halo: "#f3f1c8",
  earth: "#f3f1c8",
  highway: "#fff3cf",
  highway_casing_early: "#c9c49a",
  highway_casing_late: "#c9c49a",
  link: "#fffdf0",
  link_casing: "#d9d3a8",
  major: "#fffdf0",
  major_casing_early: "#d9d3a8",
  major_casing_late: "#d9d3a8",
  minor_a: "#fffdf0",
  minor_b: "#fffdf0",
  minor_casing: "#e2dcb4",
  minor_service: "#f7f8de",
  park_a: "#d4dd9c",
  park_b: "#c9d68f",
  pedestrian: "#efebc2",
  railway: "#a8b38a",
  roads_label_major: "#3f6b30",
  roads_label_major_halo: "#fffdf0",
  roads_label_minor: "#3f6b30",
  roads_label_minor_halo: "#fffdf0",
  subplace_label: "#3f6b30",
  subplace_label_halo: "#f3f1c8",
  water: "#c2d8f5",
  wood_a: "#c9d68f",
  wood_b: "#afc584",
};

const DARK: Partial<Flavor> = {
  background: "#46574b",
  buildings: "#52645a",
  city_label: "#f3f1c8",
  city_label_halo: "#2f3d34",
  earth: "#46574b",
  highway: "#3a4a3f",
  highway_casing_early: "#1c2420",
  highway_casing_late: "#1c2420",
  link: "#2f3d34",
  link_casing: "#1c2420",
  major: "#2f3d34",
  major_casing_early: "#1c2420",
  major_casing_late: "#1c2420",
  minor_a: "#3a4a3f",
  minor_b: "#3a4a3f",
  minor_casing: "#2f3d34",
  minor_service: "#3f5045",
  park_a: "#5c7a52",
  park_b: "#58704f",
  pedestrian: "#4d5f52",
  railway: "#6b7d63",
  roads_label_major: "#d4e396",
  roads_label_major_halo: "#2f3d34",
  roads_label_minor: "#d4e396",
  roads_label_minor_halo: "#2f3d34",
  subplace_label: "#d4e396",
  subplace_label_halo: "#2f3d34",
  water: "#4a6470",
  wood_a: "#58704f",
  wood_b: "#5c7a52",
};

/** Icons need a sprite sheet the app does not carry; these layers only draw icons. */
const WITHOUT = new Set(["pois", "roads_shields", "roads_oneway"]);

/** Where the app serves the map of Paris and the label fonts, on its own origin. */
export const MAP_FILE = "/tiles/paris.pmtiles";

export const styleFor = (theme: Theme, origin: string): StyleSpecification => {
  const flavor: Flavor = {
    ...namedFlavor(theme),
    ...(theme === "dark" ? DARK : LIGHT),
  };

  return {
    glyphs: `${origin}/map/fonts/{fontstack}/{range}.pbf`,
    layers: layers("protomaps", flavor, { lang: "en" }).filter(
      (layer) => !WITHOUT.has(layer.id)
    ),
    sources: {
      protomaps: {
        attribution:
          '<a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
        type: "vector",
        url: `pmtiles://${origin}${MAP_FILE}`,
      },
    },
    version: 8,
  };
};
