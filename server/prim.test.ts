import { describe, expect, it } from "vitest";
import type * as z from "zod/mini";

import { lineOf } from "../src/data/lines";
import {
  busDeparturesAnswer,
  departuresAnswer,
  journeysAnswer,
  lineSearchAnswer,
  mergeCalls,
  routesAnswer,
  toBusLines,
  toCalls,
  toDirections,
  toNearbyDepartures,
  toTrips,
  vehicleJourneysAnswer,
  describe as describeDisruption,
  lineReportsAnswer,
  linesAnswer,
  stopAreasAnswer,
  terminusName,
  toDepartures,
  toLines,
  toStatuses,
  toStops,
} from "./prim";
import type { PrimLine } from "./prim";

const METRO_1: PrimLine = {
  ...lineOf("metro", "1", "#ffcd00", "#000000"),
  prim: "line:IDFM:C01371",
};

const METRO_4: PrimLine = {
  ...lineOf("metro", "4", "#cf009e", "#ffffff"),
  prim: "line:IDFM:C01374",
};

const NOW = new Date("2026-10-28T13:30:00Z");

const report = (answer: z.input<typeof lineReportsAnswer>) =>
  lineReportsAnswer.parse(answer);

const works = (id: string, begin: string) => ({
  application_periods: [{ begin, end: "20261110T050000" }],
  cause: "travaux",
  id,
  impacted_objects: [
    {
      impacted_section: {
        from: { name: "La Défense (Grande Arche)" },
        to: { name: "Nanterre-Préfecture" },
      },
      pt_object: { embedded_type: "line", id: "line:IDFM:C01371" },
    },
  ],
  severity: { effect: "NO_SERVICE" },
  status: "future",
});

const departure = (time: string, direction: string) => ({
  display_informations: { direction },
  stop_date_time: { departure_date_time: time },
});

describe("toLines", () => {
  it("keeps each mode's own lines, in order, with PRIM's colours", () => {
    const lines = toLines(
      "metro",
      linesAnswer.parse({
        lines: [
          {
            code: "14",
            color: "62259D",
            id: "line:IDFM:C01384",
            text_color: "FFFFFF",
          },
          {
            code: "3B",
            color: "6EC4E8",
            id: "line:IDFM:C01386",
            text_color: "000000",
          },
          { code: "1", id: "line:IDFM:C01371" },
          { code: "ORLYVAL", id: "line:IDFM:C01388" },
          {
            code: "3",
            color: "837902",
            id: "line:IDFM:C01373",
            text_color: "FFFFFF",
          },
        ],
      })
    );

    expect(lines.map((line) => line.code)).toEqual(["1", "3", "3B", "14"]);
    expect(lines[0]).toMatchObject({
      colour: "#ffcd00",
      key: "metro:1",
      prim: "line:IDFM:C01371",
    });
    expect(lines[3]).toMatchObject({
      colour: "#62259d",
      ink: "#ffffff",
      title: "Metro 14",
    });
  });

  it("keeps a tram's code as PRIM writes it, T3a before T3b", () => {
    const answer = linesAnswer.parse({
      lines: [
        { code: "T3b", id: "t3b" },
        { code: "T10", id: "t10" },
        { code: "T3a", id: "t3a" },
        { code: "1", id: "m1" },
      ],
    });

    expect(toLines("tram", answer).map((line) => line.key)).toEqual([
      "tram:T3a",
      "tram:T3b",
      "tram:T10",
    ]);
  });

  it("keeps trams and TER out of RER and Transilien", () => {
    const answer = linesAnswer.parse({
      lines: [
        { code: "A", id: "a" },
        { code: "T2", id: "t2" },
        { code: "V", id: "v" },
        { code: "TER", id: "ter" },
      ],
    });

    expect(toLines("rer", answer).map((line) => line.code)).toEqual(["A"]);
    expect(toLines("transilien", answer).map((line) => line.code)).toEqual([
      "V",
    ]);
  });
});

describe("toStops", () => {
  it("lists a line's stops alphabetically, accents and all", () => {
    const stops = toStops(
      stopAreasAnswer.parse({
        stop_areas: [
          {
            coord: { lat: "48.8551", lon: "2.3608" },
            id: "3",
            name: "Saint-Paul",
          },
          { coord: { lat: "48.8738", lon: "2.295" }, id: "1", name: "Étoile" },
          {
            coord: { lat: "48.8531", lon: "2.3691" },
            id: "2",
            name: "Bastille",
          },
        ],
      })
    );

    expect(stops.map((stop) => stop.name)).toEqual([
      "Bastille",
      "Étoile",
      "Saint-Paul",
    ]);
    expect(stops[0]).toEqual({
      id: "2",
      lat: 48.8531,
      lon: 2.3691,
      name: "Bastille",
    });
  });
});

const route = (id: string, name: string, towards: string, way: string) => ({
  direction: { name: towards },
  direction_type: way,
  id,
  name,
});

/** Metro 7's routes as PRIM lists them, a short run and a variant included. */
const METRO_7_ROUTES = routesAnswer.parse({
  routes: [
    route(
      "r1",
      "La Courneuve - 8 Mai 1945",
      "La Courneuve - 8 Mai 1945 (La Courneuve)",
      "inbound"
    ),
    route(
      "r2",
      "La Courneuve - 8 Mai 1945",
      "Place d'Italie (Paris)",
      "inbound"
    ),
    route("r3", "Mairie d'Ivry", "Mairie d'Ivry (Ivry-sur-Seine)", "outbound"),
    route(
      "r4",
      "Villejuif - Louis Aragon",
      "Villejuif - Louis Aragon (Villejuif)",
      "outbound"
    ),
    route(
      "r5",
      "Villejuif - Louis Aragon",
      "Villejuif - Louis Aragon (Villejuif)",
      "outbound"
    ),
  ],
});

describe("toDirections", () => {
  it("names each way by its termini, leaving out short runs and repeats", () => {
    expect(toDirections(METRO_7_ROUTES)).toEqual([
      { id: "inbound", towards: "La Courneuve - 8 Mai 1945" },
      { id: "outbound", towards: "Mairie d'Ivry / Villejuif - Louis Aragon" },
    ]);
  });

  it("takes every route that way when none is named after where it goes", () => {
    const tram = routesAnswer.parse({
      routes: [
        route(
          "r1",
          "Asnières - Noisy",
          "Noisy-le-Sec (Noisy-le-Sec)",
          "inbound"
        ),
      ],
    });

    expect(toDirections(tram)).toEqual([
      { id: "inbound", towards: "Noisy-le-Sec" },
    ]);
  });
});

const stopAt = (id: string) => ({
  stop_point: {
    stop_area: { coord: { lat: "48.85", lon: "2.35" }, id, name: id },
  },
});

/** Stops named by one letter each: "abc" → a, b, c. */
const lettered = (ids: string) =>
  [...ids].map((id) => ({ id, lat: 0, lon: 0, name: id }));

describe("toCalls and mergeCalls", () => {
  it("takes a route's longest journey, in the order it calls", () => {
    const calls = toCalls(
      vehicleJourneysAnswer.parse({
        vehicle_journeys: [
          { stop_times: ["b", "c"].map(stopAt) },
          { stop_times: ["a", "b", "c", "d"].map(stopAt) },
        ],
      })
    );

    expect(calls.map((stop) => stop.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("puts a branch that splits off after the trunk, and one that joins before it", () => {
    // Trunk a-b-c, then on to d-e, or off to x-y.
    expect(
      mergeCalls([lettered("abcde"), lettered("abcxy")]).map((stop) => stop.id)
    ).toEqual([..."abcdexy"]);
    // From d-e or from x-y, then the trunk c-b-a.
    expect(
      mergeCalls([lettered("edcba"), lettered("yxcba")]).map((stop) => stop.id)
    ).toEqual([..."edyxcba"]);
  });
});

const ride = (
  leaves: string,
  arrives: string,
  direction: string,
  freshness = "realtime"
) => ({
  sections: [
    { type: "crow_fly" },
    {
      arrival_date_time: arrives,
      data_freshness: freshness,
      departure_date_time: leaves,
      display_informations: { direction },
      type: "public_transport",
    },
    { type: "crow_fly" },
  ],
});

describe("toTrips", () => {
  it("keeps direct trains only, once each, soonest first, with when they arrive", () => {
    const trips = toTrips(
      journeysAnswer.parse({
        context: { current_datetime: "20261112T192422" },
        journeys: [
          ride(
            "20261112T193000",
            "20261112T193950",
            "Cergy le Haut (Cergy)",
            "base_schedule"
          ),
          ride(
            "20261112T192800",
            "20261112T193410",
            "Saint-Nom-la-Bretèche - Forêt de Marly (L'Étang-la-Ville)"
          ),
          ride("20261112T193000", "20261112T193955", "Cergy le Haut (Cergy)"),
          {
            sections: [
              {
                ...ride("20261112T192600", "20261112T193000", "Asnières")
                  .sections[1],
                type: "public_transport",
              },
              { type: "transfer" },
              {
                ...ride("20261112T193200", "20261112T193800", "Bécon")
                  .sections[1],
                type: "public_transport",
              },
            ],
          },
        ],
      })
    );

    expect(trips).toEqual([
      {
        arrives: "19:34",
        at: "19:28",
        live: true,
        minutes: 3,
        towards: "Saint-Nom-la-Bretèche - Forêt de Marly",
      },
      {
        arrives: "19:39",
        at: "19:30",
        live: false,
        minutes: 5,
        towards: "Cergy le Haut",
      },
    ]);
  });
});

const line = (id: string, code: string, mode: string) => ({
  embedded_type: "line",
  line: {
    code,
    color: "FF1400",
    id,
    network: { name: "Network" },
    physical_modes: [{ id: mode }],
    text_color: "FFFFFF",
  },
});

describe("toBusLines", () => {
  it("keeps buses only, the line whose code is exactly what was typed first", () => {
    const buses = toBusLines(
      "72",
      lineSearchAnswer.parse({
        pt_objects: [
          line("b723", "723", "physical_mode:Bus"),
          line("t72", "T72", "physical_mode:Tramway"),
          line("b72", "72", "physical_mode:Bus"),
        ],
      })
    );

    expect(buses.map((bus) => bus.id)).toEqual(["b72", "b723"]);
    expect(buses[0]).toEqual({
      code: "72",
      colour: "#ff1400",
      id: "b72",
      ink: "#ffffff",
      network: "Network",
    });
  });
});

const bus = (code: string, direction: string, time: string) => ({
  display_informations: {
    code,
    color: "FF1400",
    direction,
    text_color: "FFFFFF",
  },
  stop_date_time: { departure_date_time: time },
});

describe("toNearbyDepartures", () => {
  it("groups a stop's next buses by line and where they go, soonest first, none more than 90 minutes off", () => {
    const departures = toNearbyDepartures(
      busDeparturesAnswer.parse({
        context: { current_datetime: "20261112T192000" },
        departures: [
          bus("72", "Gare de Lyon (Paris)", "20261112T192600"),
          bus("76", "Châtelet (Paris)", "20261112T192300"),
          bus("72", "Gare de Lyon (Paris)", "20261112T193300"),
          bus("N52", "Gare de Cormeilles (Cormeilles)", "20261112T233000"),
        ],
      })
    );

    expect(departures).toEqual([
      {
        line: { code: "76", colour: "#ff1400", ink: "#ffffff" },
        minutes: [3],
        towards: "Châtelet",
      },
      {
        line: { code: "72", colour: "#ff1400", ink: "#ffffff" },
        minutes: [6, 13],
        towards: "Gare de Lyon",
      },
    ]);
  });
});

describe("toDepartures", () => {
  it("groups the next trains by where they go, soonest first, minutes from PRIM's now", () => {
    const answer = departuresAnswer.parse({
      context: { current_datetime: "20261028T143000" },
      departures: [
        departure("20261028T143600", "Château de Vincennes (Vincennes)"),
        departure("20261028T143130", "Château de Vincennes (Vincennes)"),
        departure("20261028T143200", "La Défense (Grande Arche) (Puteaux)"),
        departure("20261028T144100", "Château de Vincennes (Vincennes)"),
        departure("20261028T144900", "Château de Vincennes (Vincennes)"),
      ],
    });

    expect(toDepartures(answer)).toEqual({
      directions: [
        {
          towards: "Château de Vincennes",
          trains: [
            { at: "14:31", minutes: 1 },
            { at: "14:36", minutes: 6 },
            { at: "14:41", minutes: 11 },
          ],
        },
        {
          towards: "La Défense (Grande Arche)",
          trains: [{ at: "14:32", minutes: 2 }],
        },
      ],
    });
  });

  it("keeps only the trains going one way when it is given", () => {
    const answer = departuresAnswer.parse({
      context: { current_datetime: "20261028T143000" },
      departures: [
        {
          ...departure("20261028T143200", "Mairie d'Ivry (Ivry-sur-Seine)"),
          route: { direction_type: "outbound" },
        },
        {
          ...departure("20261028T143300", "La Courneuve - 8 Mai 1945"),
          route: { direction_type: "inbound" },
        },
      ],
    });

    expect(
      toDepartures(answer, NOW, "outbound").directions.map(
        (direction) => direction.towards
      )
    ).toEqual(["Mairie d'Ivry"]);
  });

  it("counts across midnight", () => {
    const answer = departuresAnswer.parse({
      context: { current_datetime: "20261028T235800" },
      departures: [departure("20261029T000300", "Saint-Germain-en-Laye")],
    });

    expect(toDepartures(answer).directions[0]?.trains).toEqual([
      { at: "00:03", minutes: 5 },
    ]);
  });
});

describe("toStatuses", () => {
  it("says traffic is normal on a line with nothing that changes journeys", () => {
    const statuses = toStatuses(
      [METRO_1, METRO_4],
      report({
        disruptions: [
          {
            id: "lift",
            severity: { effect: "OTHER_EFFECT" },
            status: "active",
          },
        ],
        line_reports: [
          {
            line: {
              id: "line:IDFM:C01371",
              links: [{ id: "lift", type: "disruption" }],
            },
          },
        ],
      }),
      NOW
    );

    expect(statuses).toEqual([
      {
        detail: {
          en: "Traffic normal on the whole line",
          fr: "Trafic normal sur l’ensemble de la ligne",
        },
        key: "metro:1",
        level: "ok",
      },
      {
        detail: {
          en: "Traffic normal on the whole line",
          fr: "Trafic normal sur l’ensemble de la ligne",
        },
        key: "metro:4",
        level: "ok",
      },
    ]);
  });

  it("leaves out a lift out of order at a station, whatever effect PRIM gives it", () => {
    const statuses = toStatuses(
      [METRO_1],
      report({
        disruptions: [
          {
            cause: "perturbation",
            id: "lift",
            impacted_objects: [
              {
                pt_object: {
                  embedded_type: "stop_area",
                  id: "stop_area:IDFM:71264",
                },
              },
            ],
            messages: [{ text: "Panne d'un ascenseur" }],
            severity: { effect: "REDUCED_SERVICE" },
            status: "active",
          },
          {
            cause: "perturbation",
            id: "lift-on-line",
            impacted_objects: [
              { pt_object: { embedded_type: "line", id: "line:IDFM:C01371" } },
            ],
            messages: [{ text: "Panne d'un ascenseur" }],
            severity: { effect: "REDUCED_SERVICE" },
            status: "active",
          },
        ],
        line_reports: [
          {
            line: {
              id: "line:IDFM:C01371",
              links: [
                { id: "lift", type: "disruption" },
                { id: "lift-on-line", type: "disruption" },
              ],
            },
          },
        ],
      }),
      NOW
    );

    expect(statuses[0]?.level).toBe("ok");
  });

  it("describes an active disruption in English and French, from its effect and section", () => {
    const [, line4] = toStatuses(
      [METRO_1, METRO_4],
      report({
        disruptions: [
          {
            cause: "perturbation",
            id: "slow",
            impacted_objects: [
              {
                impacted_section: {
                  from: { name: "Châtelet" },
                  to: { name: "Montparnasse - Bienvenüe" },
                },
                pt_object: { embedded_type: "line", id: "line:IDFM:C01374" },
              },
            ],
            severity: { effect: "SIGNIFICANT_DELAYS" },
            status: "active",
          },
        ],
      }),
      NOW
    );

    expect(line4).toEqual({
      detail: {
        en: "Delays between Châtelet and Montparnasse - Bienvenüe",
        fr: "Retards entre Châtelet et Montparnasse - Bienvenüe",
      },
      key: "metro:4",
      level: "warn",
    });
  });

  it("calls works starting tonight works, and leaves out works next week", () => {
    const tonight = toStatuses(
      [METRO_1],
      report({ disruptions: [works("w", "20261028T223000")] }),
      NOW
    );

    const later = toStatuses(
      [METRO_1],
      report({ disruptions: [works("w", "20261104T223000")] }),
      NOW
    );

    expect(tonight[0]).toEqual({
      detail: {
        en: "Works: No trains between La Défense and Nanterre-Préfecture from 22:30 today",
        fr: "Travaux : Trafic interrompu entre La Défense et Nanterre-Préfecture à partir de 22:30 aujourd’hui",
      },
      key: "metro:1",
      level: "works",
    });
    expect(later[0]?.level).toBe("ok");
  });
});

describe("describe", () => {
  it("names the day of works that start another day", () => {
    const item = report({ disruptions: [works("w", "20261029T223000")] })
      .disruptions?.[0];

    expect(item && describeDisruption(item, NOW)).toEqual({
      en: "Works: No trains between La Défense and Nanterre-Préfecture from Thu 29 Oct, 22:30",
      fr: "Travaux : Trafic interrompu entre La Défense et Nanterre-Préfecture à partir du jeu. 29 oct., 22:30",
    });
  });
});

describe("terminusName", () => {
  it("drops the town in brackets at the end", () => {
    expect(terminusName("Château de Vincennes (Vincennes)")).toBe(
      "Château de Vincennes"
    );
    expect(terminusName("  La Défense (Puteaux)  ")).toBe("La Défense");
    expect(terminusName("Gare ((Nord)")).toBe("Gare");
  });

  it("keeps a name with no bracket at its end", () => {
    expect(terminusName("Nation")).toBe("Nation");
    expect(terminusName("Gare (Nord) Sud")).toBe("Gare (Nord) Sud");
    expect(terminusName("Gare (Nord)) ")).toBe("Gare (Nord))");
  });

  it("answers at once for long names", () => {
    expect(terminusName(`A${" ".repeat(50_000)}(x)`)).toBe("A");
    expect(terminusName(`${"(".repeat(50_000)}x`)).toBe(
      `${"(".repeat(50_000)}x`
    );
  });
});
