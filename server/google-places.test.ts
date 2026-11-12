import { describe, expect, it } from "vitest";

import {
  GoogleKeyRefusedError,
  areaOf,
  autocompleteAnswer,
  createGooglePlaces,
  detailsAnswer,
  toGooglePlace,
  toGoogleError,
  toSuggestions,
} from "./google-places";

const DETAILS = {
  addressComponents: [
    { longText: "12", types: ["street_number"] },
    { longText: "75011", types: ["postal_code"] },
    { longText: "Paris", types: ["locality", "political"] },
  ],
  displayName: { text: "Le Petit Cambodge" },
  formattedAddress: "20 Rue Alibert, 75010 Paris, France",
  googleMapsUri: "https://maps.google.com/?cid=1",
  id: "ChIJ-petit-cambodge",
  location: { latitude: 48.8714, longitude: 2.3672 },
  primaryType: "cambodian_restaurant",
  types: [
    "cambodian_restaurant",
    "asian_restaurant",
    "restaurant",
    "food",
    "point_of_interest",
  ],
};

describe("areaOf", () => {
  it("names Paris's arrondissements in English, and other towns by name", () => {
    expect(areaOf("75001", "Paris")).toBe("1st");
    expect(areaOf("75002", "Paris")).toBe("2nd");
    expect(areaOf("75003", "Paris")).toBe("3rd");
    expect(areaOf("75011", "Paris")).toBe("11th");
    expect(areaOf("75116", "Paris")).toBe("16th");
    expect(areaOf("93100", "Montreuil")).toBe("Montreuil");
  });
});

describe("toSuggestions", () => {
  it("keeps only somewhere to eat", () => {
    const suggestions = toSuggestions(
      autocompleteAnswer.parse({
        suggestions: [
          {
            placePrediction: {
              placeId: "a",
              structuredFormat: {
                mainText: { text: "Le Petit Cambodge" },
                secondaryText: { text: "Rue Alibert, Paris" },
              },
              text: { text: "Le Petit Cambodge, Rue Alibert, Paris" },
              types: ["restaurant", "food"],
            },
          },
          {
            placePrediction: {
              placeId: "b",
              text: { text: "Petite Ceinture" },
              types: ["park"],
            },
          },
          { queryPrediction: { text: { text: "petit" } } },
        ],
      })
    );

    expect(suggestions).toEqual([
      {
        address: "Rue Alibert, Paris",
        name: "Le Petit Cambodge",
        placeId: "a",
      },
    ]);
  });
});

describe("toGooglePlace", () => {
  it("takes the name, address, area, place and a cuisine from Google's types", () => {
    expect(toGooglePlace(detailsAnswer.parse(DETAILS))).toEqual({
      address: "20 Rue Alibert, 75010 Paris, France",
      area: "11th",
      cuisine: "Asian",
      lat: 48.8714,
      lon: 2.3672,
      mapsUrl: "https://maps.google.com/?cid=1",
      name: "Le Petit Cambodge",
      placeId: "ChIJ-petit-cambodge",
    });
  });

  it("refuses a place that is not somewhere to eat", () => {
    expect(
      toGooglePlace(
        detailsAnswer.parse({
          ...DETAILS,
          primaryType: "museum",
          types: ["museum"],
        })
      )
    ).toBeNull();
  });
});

describe("createGooglePlaces", () => {
  it("sends the key and the session token, never to the browser", async () => {
    const asked: { url: string; init: RequestInit | undefined }[] = [];

    const google = createGooglePlaces({
      apiKey: "secret",
      fetcher: (url, init) => {
        asked.push({ init, url: String(url) });

        return Promise.resolve(
          Response.json(
            String(url).includes(":autocomplete")
              ? { suggestions: [] }
              : DETAILS
          )
        );
      },
    });

    await google.search("petit", "11111111-2222-4333-8444-555555555555");
    await google.details(
      "ChIJ-petit-cambodge",
      "11111111-2222-4333-8444-555555555555"
    );

    expect(new Headers(asked[0]?.init?.headers).get("x-goog-api-key")).toBe(
      "secret"
    );
    expect(JSON.parse(String(asked[0]?.init?.body))).toMatchObject({
      input: "petit",
      sessionToken: "11111111-2222-4333-8444-555555555555",
    });
    expect(asked[1]?.url).toContain(
      "sessionToken=11111111-2222-4333-8444-555555555555"
    );
    expect(
      new Headers(asked[1]?.init?.headers).get("x-goog-fieldmask")
    ).toContain("location");
  });
});

describe("toGooglePlace", () => {
  it("reads an address with a part Google sends without types or text", () => {
    const place = toGooglePlace(
      detailsAnswer.parse({
        ...DETAILS,
        addressComponents: [
          { longText: "Bâtiment B" },
          { types: ["subpremise"] },
          ...DETAILS.addressComponents,
        ],
      })
    );

    expect(place?.area).toBe("11th");
  });
});

/** Google's JSON for a refusal, as the Places API (New) sends it. */
const refusal = (status: string, reason: string, message: string) =>
  JSON.stringify({
    error: {
      code: 403,
      details: [
        { "@type": "type.googleapis.com/google.rpc.ErrorInfo", reason },
      ],
      message,
      status,
    },
  });

describe("toGoogleError", () => {
  it("tells a refused key from Google being down, and keeps what Google said", () => {
    const disabled = toGoogleError(
      403,
      refusal(
        "PERMISSION_DENIED",
        "SERVICE_DISABLED",
        "Places API (New) has not been used in project 1 before or it is disabled."
      )
    );

    expect(disabled).toBeInstanceOf(GoogleKeyRefusedError);
    expect(disabled.message).toContain("SERVICE_DISABLED");
    expect(disabled.message).toContain("Places API (New) has not been used");

    expect(
      toGoogleError(
        400,
        refusal("INVALID_ARGUMENT", "API_KEY_INVALID", "API key not valid.")
      )
    ).toBeInstanceOf(GoogleKeyRefusedError);

    const down = toGoogleError(500, "<html>Server Error</html>");

    expect(down).not.toBeInstanceOf(GoogleKeyRefusedError);
    expect(down.message).toBe(
      "Google Places answered 500: <html>Server Error</html>"
    );
  });

  it("is what a search throws when Google says no", async () => {
    const google = createGooglePlaces({
      apiKey: "secret",
      fetcher: () =>
        Promise.resolve(
          new Response(
            refusal(
              "PERMISSION_DENIED",
              "API_KEY_SERVICE_BLOCKED",
              "Requests to this API are blocked."
            ),
            { status: 403 }
          )
        ),
    });

    await expect(
      google.search("petit", "11111111-2222-4333-8444-555555555555")
    ).rejects.toThrow(GoogleKeyRefusedError);
  });
});
