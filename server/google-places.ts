import * as z from "zod/mini";

import { cuisineOf } from "../src/data/cuisines";
import type { Cuisine } from "../src/data/cuisines";

/**
 * Google's Places API (New): restaurants as Google Maps knows them. Only
 * this server holds the key; the page asks /api/places/search, which asks
 * Google. A search and the pick that ends it share a session token, so
 * Google bills them as one.
 */
const AUTOCOMPLETE = "https://places.googleapis.com/v1/places:autocomplete";
const DETAILS = "https://places.googleapis.com/v1/places";

/** The types that make a place somewhere to eat or drink. */
const EATERIES = new Set([
  "restaurant",
  "food",
  "cafe",
  "bakery",
  "bar",
  "meal_takeaway",
  "coffee_shop",
]);

export const autocompleteAnswer = z.object({
  suggestions: z.optional(
    z.array(
      z.object({
        placePrediction: z.optional(
          z.object({
            placeId: z.string(),
            structuredFormat: z.optional(
              z.object({
                mainText: z.object({ text: z.string() }),
                secondaryText: z.optional(z.object({ text: z.string() })),
              })
            ),
            text: z.object({ text: z.string() }),
            types: z.optional(z.array(z.string())),
          })
        ),
      })
    )
  ),
});

export const detailsAnswer = z.object({
  addressComponents: z.optional(
    z.array(z.object({ longText: z.string(), types: z.array(z.string()) }))
  ),
  displayName: z.object({ text: z.string() }),
  formattedAddress: z.string(),
  googleMapsUri: z.optional(z.string()),
  id: z.string(),
  location: z.object({ latitude: z.number(), longitude: z.number() }),
  primaryType: z.optional(z.string()),
  types: z.optional(z.array(z.string())),
});

export interface Suggestion {
  placeId: string;
  name: string;
  address: string;
}

export interface GooglePlace {
  placeId: string;
  name: string;
  address: string;
  /** "11th" in Paris, the town's name outside it. */
  area: string;
  lat: number;
  lon: number;
  /** The cuisine Google's type points to, to start the menu on. */
  cuisine: Cuisine | null;
  mapsUrl: string;
}

const isEatery = (types: readonly string[] | undefined) =>
  (types ?? []).some((type) => EATERIES.has(type));

/** Google's predictions, kept only when they are somewhere to eat. */
export const toSuggestions = (
  answer: z.infer<typeof autocompleteAnswer>
): Suggestion[] =>
  (answer.suggestions ?? []).flatMap(({ placePrediction: place }) =>
    place && isEatery(place.types)
      ? [
          {
            address: place.structuredFormat?.secondaryText?.text ?? "",
            name: place.structuredFormat?.mainText.text ?? place.text.text,
            placeId: place.placeId,
          },
        ]
      : []
  );

/** The arrondissements whose ordinal is not "th". */
const ORDINALS = new Map([
  [1, "st"],
  [2, "nd"],
  [3, "rd"],
]);

/** A Paris postcode's arrondissement, in English: 75011 → "11th", 75001 → "1st", 75116 → "16th". */
export const areaOf = (
  postcode: string | undefined,
  city: string | undefined
) => {
  const paris = postcode?.match(/^75(?:0(?<low>\d\d)|1(?<high>16))$/u);
  const number = Number(paris?.groups?.low ?? paris?.groups?.high ?? 0);

  if (number >= 1 && number <= 20) {
    return `${number}${ORDINALS.get(number) ?? "th"}`;
  }

  return city ?? "";
};

/** A place's details, or null when it is not somewhere to eat. */
export const toGooglePlace = (
  answer: z.infer<typeof detailsAnswer>
): GooglePlace | null => {
  const types = [answer.primaryType ?? "", ...(answer.types ?? [])];

  if (!isEatery(types)) {
    return null;
  }

  const part = (type: string) =>
    answer.addressComponents?.find((component) =>
      component.types.includes(type)
    )?.longText;

  return {
    address: answer.formattedAddress,
    area: areaOf(part("postal_code"), part("locality")),
    cuisine: cuisineOf(types),
    lat: answer.location.latitude,
    lon: answer.location.longitude,
    mapsUrl:
      answer.googleMapsUri ??
      `https://www.google.com/maps/place/?q=place_id:${answer.id}`,
    name: answer.displayName.text,
    placeId: answer.id,
  };
};

export interface GooglePlaces {
  search: (input: string, session: string) => Promise<Suggestion[]>;
  /** Null when Google has no such place, or it is not somewhere to eat. */
  details: (placeId: string, session?: string) => Promise<GooglePlace | null>;
}

/** Paris, the Hôtel de Ville: searches favour places within 15 km of it. */
const NEAR_PARIS = {
  circle: { center: { latitude: 48.8566, longitude: 2.3522 }, radius: 15_000 },
};

export const createGooglePlaces = ({
  apiKey,
  fetcher = fetch,
}: {
  apiKey: string;
  fetcher?: typeof fetch;
}): GooglePlaces => {
  const ask = async (url: string, init: RequestInit) => {
    const response = await fetcher(url, {
      ...init,
      headers: { ...init.headers, "x-goog-api-key": apiKey },
      signal: AbortSignal.timeout(8000),
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Google Places answered ${response.status}`);
    }

    const body: unknown = await response.json();

    return body;
  };

  return {
    details: async (placeId, session) => {
      const query = new URLSearchParams({
        languageCode: "en",
        regionCode: "FR",
      });

      if (session) {
        query.set("sessionToken", session);
      }

      const answer = await ask(
        `${DETAILS}/${encodeURIComponent(placeId)}?${query}`,
        {
          headers: {
            "x-goog-fieldmask":
              "id,displayName,formattedAddress,location,addressComponents,types,primaryType,googleMapsUri",
          },
        }
      );

      return answer === null
        ? null
        : toGooglePlace(detailsAnswer.parse(answer));
    },
    search: async (input, session) => {
      const answer = await ask(AUTOCOMPLETE, {
        body: JSON.stringify({
          input,
          languageCode: "en",
          locationBias: NEAR_PARIS,
          regionCode: "FR",
          sessionToken: session,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });

      return answer === null
        ? []
        : toSuggestions(autocompleteAnswer.parse(answer));
    },
  };
};
