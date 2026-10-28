import { describe, expect, it } from "vitest";
import type * as z from "zod/mini";

import { lineOf } from "../src/data/lines";
import {
  departuresAnswer,
  describe as describeDisruption,
  lineReportsAnswer,
  linesAnswer,
  stopAreasAnswer,
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
          { id: "3", name: "Saint-Paul" },
          { id: "1", name: "Étoile" },
          { id: "2", name: "Bastille" },
        ],
      })
    );

    expect(stops.map((stop) => stop.name)).toEqual([
      "Bastille",
      "Étoile",
      "Saint-Paul",
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
        detail: "Traffic normal on the whole line",
        key: "metro:1",
        level: "ok",
      },
      {
        detail: "Traffic normal on the whole line",
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

  it("describes an active disruption in English, from its effect and section", () => {
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
      detail: "Delays between Châtelet and Montparnasse - Bienvenüe",
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
      detail:
        "Works: No trains between La Défense and Nanterre-Préfecture from 22:30 today",
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

    expect(item && describeDisruption(item, NOW)).toBe(
      "Works: No trains between La Défense and Nanterre-Préfecture from Thu 29 Oct, 22:30"
    );
  });
});
