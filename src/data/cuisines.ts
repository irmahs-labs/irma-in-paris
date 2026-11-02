import type { Language } from "../lib/language";

/**
 * The cuisines a place can be filed under, in the order the menu lists
 * them: broad families first, then by country, then the rest.
 */
export const CUISINES = [
  "Asian",
  "Cambodian",
  "Chinese",
  "Japanese",
  "Korean",
  "Thai",
  "Vietnamese",
  "Indian",
  "Middle Eastern",
  "Lebanese",
  "African",
  "European",
  "French",
  "Italian",
  "Spanish",
  "Greek",
  "Latino",
  "Mexican",
  "Peruvian",
  "Brazilian",
  "American",
  "Seafood",
  "Vegetarian",
  "Café",
  "Bakery",
  "Fusion",
  "Other",
] as const;

export type Cuisine = (typeof CUISINES)[number];

/** Each cuisine as the French menu names it; the stored value stays English. */
export const CUISINES_FR: Record<Cuisine, string> = {
  African: "Africaine",
  American: "Américaine",
  Asian: "Asiatique",
  Bakery: "Boulangerie",
  Brazilian: "Brésilienne",
  Café: "Café",
  Cambodian: "Cambodgienne",
  Chinese: "Chinoise",
  European: "Européenne",
  French: "Française",
  Fusion: "Fusion",
  Greek: "Grecque",
  Indian: "Indienne",
  Italian: "Italienne",
  Japanese: "Japonaise",
  Korean: "Coréenne",
  Latino: "Latino",
  Lebanese: "Libanaise",
  Mexican: "Mexicaine",
  "Middle Eastern": "Moyen-Orient",
  Other: "Autre",
  Peruvian: "Péruvienne",
  Seafood: "Fruits de mer",
  Spanish: "Espagnole",
  Thai: "Thaïe",
  Vegetarian: "Végétarienne",
  Vietnamese: "Vietnamienne",
};

const NAMES: ReadonlySet<string> = new Set(CUISINES);

export const isCuisine = (value: string): value is Cuisine => NAMES.has(value);

/**
 * Google's place types (`primaryType`) for the cuisines it knows, so the
 * menu starts on the right one when a restaurant is picked.
 */
const FROM_GOOGLE = new Map<string, Cuisine>([
  ["afghani_restaurant", "Middle Eastern"],
  ["african_restaurant", "African"],
  ["american_restaurant", "American"],
  ["asian_restaurant", "Asian"],
  ["bakery", "Bakery"],
  ["brazilian_restaurant", "Brazilian"],
  ["cafe", "Café"],
  ["chinese_restaurant", "Chinese"],
  ["coffee_shop", "Café"],
  ["french_restaurant", "French"],
  ["greek_restaurant", "Greek"],
  ["indian_restaurant", "Indian"],
  ["italian_restaurant", "Italian"],
  ["japanese_restaurant", "Japanese"],
  ["korean_restaurant", "Korean"],
  ["lebanese_restaurant", "Lebanese"],
  ["mediterranean_restaurant", "European"],
  ["mexican_restaurant", "Mexican"],
  ["middle_eastern_restaurant", "Middle Eastern"],
  ["pizza_restaurant", "Italian"],
  ["ramen_restaurant", "Japanese"],
  ["seafood_restaurant", "Seafood"],
  ["spanish_restaurant", "Spanish"],
  ["sushi_restaurant", "Japanese"],
  ["thai_restaurant", "Thai"],
  ["vegan_restaurant", "Vegetarian"],
  ["vegetarian_restaurant", "Vegetarian"],
  ["vietnamese_restaurant", "Vietnamese"],
]);

export const cuisineOf = (googleTypes: readonly string[]): Cuisine | null => {
  for (const type of googleTypes) {
    const cuisine = FROM_GOOGLE.get(type);

    if (cuisine) {
      return cuisine;
    }
  }

  return null;
};

/** A cuisine's name in the page's language; one it doesn't know reads as it is. */
export const cuisineName = (value: string, language: Language) =>
  language === "fr" && isCuisine(value) ? CUISINES_FR[value] : value;
