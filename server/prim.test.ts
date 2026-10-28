import { describe, expect, it } from "vitest";
import type * as z from "zod/mini";

import { METRO_LINES } from "../src/data/lines";
import type { FeedLine } from "../src/data/lines";
import {
  departuresAnswer,
  lineReportsAnswer,
  matchStops,
  normalise,
  sameStop,
  stopAreasAnswer,
  toDepartures,
  toLineStatus,
} from "./prim";

const [LINE_1] = METRO_LINES;

const FEED_1: FeedLine = {
  colour: "#ffcd00",
  id: "1",
  ink: "#2f3b34",
  mode: "metro",
  prim: "line:IDFM:C01371",
  title: "Metro 1",
};

const departure = (time: string, direction: string, id: string) => ({
  display_informations: { direction },
  route: { direction: { id, name: direction } },
  stop_date_time: { departure_date_time: time },
});

const report = (
  disruptions: z.input<typeof lineReportsAnswer>["disruptions"]
) => lineReportsAnswer.parse({ disruptions });

const works = (begin: string) => ({
  application_periods: [{ begin, end: "20261110T050000" }],
  cause: "travaux",
  messages: [{ text: "Travaux" }],
  severity: { effect: "NO_SERVICE" },
  status: "future",
});

describe("stop names", () => {
  it("compare without accents, case or punctuation", () => {
    expect(normalise("Charles de Gaulle – Étoile")).toBe(
      "charles de gaulle etoile"
    );
    expect(
      sameStop("Charles de Gaulle - Etoile", "Charles de Gaulle – Étoile")
    ).toBe(true);
    expect(sameStop("La Défense (Grande Arche)", "La Défense")).toBe(true);
    expect(sameStop("Saint-Paul (Le Marais)", "Saint-Paul")).toBe(true);
    expect(sameStop("Concorde", "Bastille")).toBe(false);
  });
});

describe("matchStops", () => {
  it("finds each of the line's stops among PRIM's, the exact name first", () => {
    const ids = matchStops(
      LINE_1,
      stopAreasAnswer.parse({
        stop_areas: [
          { id: "stop_area:IDFM:71517", name: "La Défense (Grande Arche)" },
          { id: "stop_area:IDFM:73794", name: "Esplanade de la Défense" },
          { id: "stop_area:IDFM:71264", name: "Châtelet" },
          { id: "stop_area:IDFM:99999", name: "Châtelet - Les Halles" },
        ],
      })
    );

    expect(ids.get("La Défense")).toBe("stop_area:IDFM:71517");
    expect(ids.get("Châtelet")).toBe("stop_area:IDFM:71264");
    expect(ids.has("Bastille")).toBe(false);
  });
});

describe("toDepartures", () => {
  it("keeps the trains towards the terminus, minutes counted from PRIM's now", () => {
    const answer = departuresAnswer.parse({
      context: { current_datetime: "20261028T143000" },
      departures: [
        departure(
          "20261028T143130",
          "Château de Vincennes",
          "stop_area:vincennes"
        ),
        departure(
          "20261028T143200",
          "La Défense (Grande Arche)",
          "stop_area:defense"
        ),
        departure(
          "20261028T143600",
          "Château de Vincennes",
          "stop_area:vincennes"
        ),
        departure(
          "20261028T144100",
          "Château de Vincennes",
          "stop_area:vincennes"
        ),
        departure(
          "20261028T144900",
          "Château de Vincennes",
          "stop_area:vincennes"
        ),
      ],
    });

    expect(
      toDepartures(answer, {
        id: "stop_area:vincennes",
        name: "Château de Vincennes",
      })
    ).toEqual({
      trains: [
        { at: "14:31", minutes: 1 },
        { at: "14:36", minutes: 6 },
        { at: "14:41", minutes: 11 },
      ],
    });
  });

  it("falls back on the direction's name when PRIM gives no stop area", () => {
    const answer = departuresAnswer.parse({
      context: { current_datetime: "20261028T235800" },
      departures: [
        {
          display_informations: { direction: "La Défense (Grande Arche)" },
          stop_date_time: { departure_date_time: "20261029T000300" },
        },
        {
          display_informations: { direction: "Château de Vincennes" },
          stop_date_time: { departure_date_time: "20261029T000100" },
        },
      ],
    });

    expect(
      toDepartures(answer, { id: undefined, name: "La Défense" }).trains
    ).toEqual([{ at: "00:03", minutes: 5 }]);
  });
});

describe("toLineStatus", () => {
  const NOW = new Date("2026-10-28T13:30:00Z");

  it("says traffic is normal with nothing that changes journeys", () => {
    const status = toLineStatus(
      FEED_1,
      report([
        {
          messages: [{ text: "Ascenseur hors service" }],
          severity: { effect: "OTHER_EFFECT" },
          status: "active",
        },
      ]),
      NOW
    );

    expect(status).toEqual({
      detail: "Traffic normal on the whole line",
      id: "1",
      level: "ok",
    });
  });

  it("shows an active disruption's title, without its HTML", () => {
    const status = toLineStatus(
      FEED_1,
      report([
        {
          cause: "perturbation",
          messages: [
            { channel: { types: ["web"] }, text: "<p>Long text</p>" },
            {
              channel: { types: ["title"] },
              text: "Ralentissements&nbsp;: <b>incident voyageur</b> &amp;quot;",
            },
          ],
          severity: { effect: "SIGNIFICANT_DELAYS" },
          status: "active",
        },
      ]),
      NOW
    );

    expect(status).toEqual({
      detail: "Ralentissements : incident voyageur &quot;",
      id: "1",
      level: "warn",
    });
  });

  it("calls works starting tonight works, and leaves out works next week", () => {
    expect(
      toLineStatus(FEED_1, report([works("20261028T223000")]), NOW).level
    ).toBe("works");
    expect(
      toLineStatus(FEED_1, report([works("20261104T223000")]), NOW).level
    ).toBe("ok");
  });
});
