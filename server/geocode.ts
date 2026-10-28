import * as z from "zod/mini";

/**
 * The French government's address search (the Géoplateforme's geocoder,
 * which took over from api-adresse.data.gouv.fr), which needs no key.
 */
const SEARCH = "https://data.geopf.fr/geocodage/search";

export const searchAnswer = z.object({
  features: z.array(
    z.object({
      geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }),
      properties: z.object({
        city: z.optional(z.string()),
        label: z.string(),
        postcode: z.optional(z.string()),
        score: z.number(),
      }),
    })
  ),
});

export interface Found {
  /** The address as the geocoder writes it: "12 Rue de la Roquette 75011 Paris". */
  address: string;
  /** "11e" in Paris, the town's name outside it. */
  area: string;
  lat: number;
  lon: number;
}

/** Below this, the geocoder is guessing. */
const MIN_SCORE = 0.5;

/** A Paris postcode's arrondissement: 75011 → "11e", 75001 → "1er", 75116 → "16e". */
export const areaOf = (
  postcode: string | undefined,
  city: string | undefined
) => {
  const paris = postcode?.match(/^75(?:0(?<low>\d\d)|1(?<high>16))$/u);
  const number = Number(paris?.groups?.low ?? paris?.groups?.high ?? 0);

  if (number >= 1 && number <= 20) {
    return number === 1 ? "1er" : `${number}e`;
  }

  return city ?? "";
};

/** The best match for an address, or null when there is no good one. */
export type SearchAnswer = z.infer<typeof searchAnswer>;

export const toFound = (answer: SearchAnswer): Found | null => {
  const [best] = answer.features;

  if (!best || best.properties.score < MIN_SCORE) {
    return null;
  }

  const [lon, lat] = best.geometry.coordinates;

  return {
    address: best.properties.label,
    area: areaOf(best.properties.postcode, best.properties.city),
    lat,
    lon,
  };
};

export type Geocode = (address: string) => Promise<Found | null>;

export const geocode =
  (fetcher: typeof fetch = fetch): Geocode =>
  async (address) => {
    const url = `${SEARCH}?${new URLSearchParams({ limit: "1", q: address })}`;
    const response = await fetcher(url, { signal: AbortSignal.timeout(8000) });

    if (!response.ok) {
      throw new Error(`The geocoder answered ${response.status}`);
    }

    return toFound(searchAnswer.parse(await response.json()));
  };
