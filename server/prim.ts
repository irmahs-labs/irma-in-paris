import * as z from "zod/mini";

import { LINES, lineOf, lineOrder } from "../src/data/lines";
import type { Mode, TransitLine } from "../src/data/lines";
import type { Departures, LineLevel, LineStatus, Stop } from "../src/lib/api";

/**
 * Île-de-France Mobilités' PRIM, through its Navitia API: the metro, RER
 * and Transilien lines, each line's stops, the next departures from a stop,
 * and the lines' disruptions. Every request carries the PRIM key in its
 * `apikey` header; the key never leaves this server.
 */
export const PRIM_NAVITIA =
  "https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia";

/** A line as this app knows it, with PRIM's id for it. */
export interface PrimLine extends TransitLine {
  prim: string;
}

/** Navitia's physical mode for each of the app's modes. */
const PHYSICAL_MODES: Record<Mode, string> = {
  metro: "physical_mode:Metro",
  rer: "physical_mode:RapidTransit",
  transilien: "physical_mode:LocalTrain",
};

/** The codes each mode's lines carry, so trams, buses and TER stay out. */
const CODES: Record<Mode, RegExp> = {
  metro: /^(?:\d{1,2}|3B|7B)$/u,
  rer: /^[A-E]$/u,
  transilien: /^[F-Z]$/u,
};

export const linesAnswer = z.object({
  lines: z.array(
    z.object({
      code: z.string(),
      color: z.optional(z.string()),
      id: z.string(),
      text_color: z.optional(z.string()),
    })
  ),
});

const HEX = /^[0-9a-f]{6}$/iu;

/** A mode's lines from PRIM, with PRIM's colours where it gives them. */
export const toLines = (
  mode: Mode,
  answer: z.infer<typeof linesAnswer>
): PrimLine[] => {
  const seen = new Set<string>();

  return answer.lines
    .flatMap((line) => {
      const code = line.code.trim().toUpperCase().replace(/BIS$/u, "B");

      if (!CODES[mode].test(code) || seen.has(code)) {
        return [];
      }

      seen.add(code);

      const known = LINES.find(
        (entry) => entry.mode === mode && entry.code === code
      );

      const colour =
        line.color && HEX.test(line.color)
          ? `#${line.color.toLowerCase()}`
          : known?.colour;

      const ink =
        line.text_color && HEX.test(line.text_color)
          ? `#${line.text_color.toLowerCase()}`
          : known?.ink;

      return [
        {
          ...lineOf(mode, code, colour ?? "#d4dd9c", ink ?? "#000000"),
          prim: line.id,
        },
      ];
    })
    .toSorted(lineOrder);
};

export const stopAreasAnswer = z.object({
  stop_areas: z.array(z.object({ id: z.string(), name: z.string() })),
});

/** A line's stops, in alphabetical order as a French reader expects it. */
export const toStops = (answer: z.infer<typeof stopAreasAnswer>): Stop[] =>
  answer.stop_areas
    .map((area) => ({ id: area.id, name: area.name }))
    .toSorted((a, b) => a.name.localeCompare(b.name, "fr"));

export const departuresAnswer = z.object({
  context: z.optional(z.object({ current_datetime: z.optional(z.string()) })),
  departures: z.array(
    z.object({
      display_informations: z.optional(
        z.object({ direction: z.optional(z.string()) })
      ),
      route: z.optional(
        z.object({
          direction: z.optional(z.object({ name: z.optional(z.string()) })),
        })
      ),
      stop_date_time: z.object({ departure_date_time: z.string() }),
    })
  ),
});

/** Navitia's local times, "20261028T143512", as minutes since an arbitrary start. */
const minutesOf = (time: string) => {
  const parts = time.match(
    /^(?<y>\d{4})(?<mo>\d\d)(?<d>\d\d)T(?<h>\d\d)(?<mi>\d\d)(?<s>\d\d)$/u
  )?.groups;

  if (!parts) {
    return Number.NaN;
  }

  const { y, mo, d, h, mi, s } = parts;

  return (
    Date.UTC(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(h),
      Number(mi),
      Number(s)
    ) / 60_000
  );
};

/** A Date as Navitia writes Paris times. */
export const parisStamp = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: "Europe/Paris",
    year: "numeric",
  }).formatToParts(date);

  const part = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "00";

  return `${part("year")}${part("month")}${part("day")}T${part("hour")}${part("minute")}${part("second")}`;
};

/** "Château de Vincennes (Vincennes)" → "Château de Vincennes": the town is noise on a sign. */
const terminusName = (name: string) =>
  name.replace(/\s*\([^)]*\)\s*$/u, "").trim();

/** Trains shown for each direction, and directions for a stop. */
const TRAINS = 3;
const DIRECTIONS = 6;

/**
 * The next trains from a stop, by where they go: a line with branches has
 * as many directions as termini served from there. Times are counted from
 * Navitia's own "now" (or, without one, the server's clock in Paris), both
 * being Paris times.
 */
export const toDepartures = (
  parsed: z.infer<typeof departuresAnswer>,
  now: Date = new Date()
): Departures => {
  const start = minutesOf(parsed.context?.current_datetime ?? parisStamp(now));
  const byTerminus = new Map<string, { minutes: number; at: string }[]>();

  for (const departure of parsed.departures) {
    const towards = terminusName(
      departure.display_informations?.direction ??
        departure.route?.direction?.name ??
        ""
    );

    const time = departure.stop_date_time.departure_date_time;
    const minutes = Math.floor(minutesOf(time) - start);

    if (!towards || !Number.isFinite(minutes)) {
      continue;
    }

    const trains = byTerminus.get(towards) ?? [];

    trains.push({
      at: `${time.slice(9, 11)}:${time.slice(11, 13)}`,
      minutes: Math.max(0, minutes),
    });
    byTerminus.set(towards, trains);
  }

  const directions = [...byTerminus]
    .map(([towards, trains]) => ({
      towards,
      trains: trains.toSorted((a, b) => a.minutes - b.minutes).slice(0, TRAINS),
    }))
    .toSorted(
      (a, b) => (a.trains[0]?.minutes ?? 0) - (b.trains[0]?.minutes ?? 0)
    )
    .slice(0, DIRECTIONS);

  return { directions };
};

const disruption = z.object({
  application_periods: z.optional(
    z.array(z.object({ begin: z.string(), end: z.string() }))
  ),
  cause: z.optional(z.string()),
  id: z.string(),
  impacted_objects: z.optional(
    z.array(
      z.object({
        impacted_section: z.optional(
          z.object({
            from: z.optional(z.object({ name: z.optional(z.string()) })),
            to: z.optional(z.object({ name: z.optional(z.string()) })),
          })
        ),
        pt_object: z.optional(
          z.object({
            embedded_type: z.optional(z.string()),
            id: z.optional(z.string()),
          })
        ),
      })
    )
  ),
  messages: z.optional(z.array(z.object({ text: z.string() }))),
  severity: z.optional(z.object({ effect: z.optional(z.string()) })),
  status: z.optional(z.string()),
  tags: z.optional(z.array(z.string())),
});

type Disruption = z.infer<typeof disruption>;

const links = z.optional(
  z.array(
    z.object({ id: z.optional(z.string()), type: z.optional(z.string()) })
  )
);

export const lineReportsAnswer = z.object({
  disruptions: z.optional(z.array(disruption)),
  line_reports: z.optional(
    z.array(
      z.object({
        line: z.object({ id: z.string(), links }),
      })
    )
  ),
});

/** Each effect that changes a journey, in words; elevators out of order and notices are left out. */
const EFFECTS = new Map([
  ["NO_SERVICE", "No trains"],
  ["REDUCED_SERVICE", "Fewer trains"],
  ["SIGNIFICANT_DELAYS", "Delays"],
  ["DETOUR", "Trains diverted"],
  ["MODIFIED_SERVICE", "Changed service"],
  ["STOP_MOVED", "Stop moved"],
]);

const isWorks = (item: Disruption) =>
  /travaux|works/iu.test(item.cause ?? "") ||
  (item.tags ?? []).some((tag) => /travaux|works/iu.test(tag));

const WEEKDAY = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  weekday: "short",
});

/** When a disruption that has not started yet starts: "from 22:30 today", "from Mon 3 Nov". */
const startOf = (item: Disruption, now: Date) => {
  const begin = item.application_periods?.[0]?.begin;

  if (item.status !== "future" || !begin) {
    return "";
  }

  const clock = `${begin.slice(9, 11)}:${begin.slice(11, 13)}`;

  if (begin.slice(0, 8) === parisStamp(now).slice(0, 8)) {
    return ` from ${clock} today`;
  }

  const day = new Date(
    Date.UTC(
      Number(begin.slice(0, 4)),
      Number(begin.slice(4, 6)) - 1,
      Number(begin.slice(6, 8))
    )
  );

  return ` from ${WEEKDAY.format(day).replace(",", "")}, ${clock}`;
};

/**
 * A disruption in English, from PRIM's structured fields rather than its
 * French text: what happens, where, and when it starts if it has not yet.
 * "Works: No trains between La Défense and Nanterre-Préfecture from 22:30 today".
 */
export const describe = (item: Disruption, now: Date = new Date()) => {
  const effect = EFFECTS.get(item.severity?.effect ?? "") ?? "Disrupted";

  const section = item.impacted_objects?.find(
    (object) => object.impacted_section
  )?.impacted_section;

  const from = section?.from?.name;
  const to = section?.to?.name;

  const where =
    from && to && from !== to
      ? ` between ${terminusName(from)} and ${terminusName(to)}`
      : "";

  return `${isWorks(item) ? "Works: " : ""}${effect}${where}${startOf(item, now)}`;
};

/** Whether a future disruption begins within the next day. */
const beginsSoon = (item: Disruption, now: Date) => {
  const begin = item.application_periods?.[0]?.begin;

  return (
    Boolean(begin) &&
    minutesOf(begin ?? "") - minutesOf(parisStamp(now)) < 24 * 60
  );
};

/**
 * Whether it is about the line itself, all of it or a section between two
 * stations, rather than one station: a lift out of order at a station is
 * on every line that stops there, and changes no journey on any of them.
 */
const affectsLine = (item: Disruption) =>
  (item.impacted_objects ?? []).some(
    (object) => object.pt_object?.embedded_type === "line"
  );

/** Lifts and escalators, which PRIM files under the lines whose stations have them. */
const LIFTS = /ascenseur|escalator|escalier m[ée]canique|elevator|\blift\b/iu;

const isAboutLifts = (item: Disruption) =>
  [
    item.cause ?? "",
    ...(item.tags ?? []),
    ...(item.messages ?? []).map((message) => message.text),
  ].some((text) => LIFTS.test(text));

const matters = (item: Disruption, now: Date) =>
  affectsLine(item) &&
  !isAboutLifts(item) &&
  (EFFECTS.has(item.severity?.effect ?? "") || isWorks(item)) &&
  (item.status === "active" ||
    (item.status === "future" && isWorks(item) && beginsSoon(item, now)));

const NORMAL = "Traffic normal on the whole line";

/**
 * Every line's status from one mode's line reports: disrupted while
 * something that changes journeys is on, works when that is works, on now
 * or starting within the day. A line with no report runs normally.
 */
export const toStatuses = (
  lines: readonly PrimLine[],
  answer: z.infer<typeof lineReportsAnswer>,
  now: Date = new Date()
): LineStatus[] => {
  const byId = new Map(
    (answer.disruptions ?? []).map((item) => [item.id, item])
  );

  const forLine = new Map<string, Disruption[]>();

  const add = (lineId: string, item: Disruption | undefined) => {
    if (item && matters(item, now)) {
      forLine.set(lineId, [
        ...(forLine.get(lineId) ?? []).filter((known) => known.id !== item.id),
        item,
      ]);
    }
  };

  for (const report of answer.line_reports ?? []) {
    for (const link of report.line.links ?? []) {
      if (link.type === "disruption" && link.id) {
        add(report.line.id, byId.get(link.id));
      }
    }
  }

  for (const item of byId.values()) {
    for (const object of item.impacted_objects ?? []) {
      if (object.pt_object?.embedded_type === "line" && object.pt_object.id) {
        add(object.pt_object.id, item);
      }
    }
  }

  return lines.map((line) => {
    const items = forLine.get(line.prim) ?? [];

    const active = items.find(
      (item) => item.status === "active" && !isWorks(item)
    );

    const shown = active ?? items[0];

    if (!shown) {
      return { detail: NORMAL, key: line.key, level: "ok" };
    }

    const level: LineLevel = active ? "warn" : "works";

    return { detail: describe(shown, now), key: line.key, level };
  });
};

export interface Prim {
  lines: () => Promise<PrimLine[]>;
  stops: (line: PrimLine) => Promise<Stop[]>;
  departures: (line: PrimLine, stopId: string) => Promise<Departures>;
  /** The status of every line given, from one request per mode. */
  statuses: (lines: readonly PrimLine[]) => Promise<LineStatus[]>;
}

const physical = (mode: Mode) => encodeURIComponent(PHYSICAL_MODES[mode]);

export const createPrim = ({
  apiKey,
  baseUrl = PRIM_NAVITIA,
  fetcher = fetch,
}: {
  apiKey: string;
  baseUrl?: string;
  fetcher?: typeof fetch;
}): Prim => {
  const get = async <T>(path: string, schema: z.ZodMiniType<T>): Promise<T> => {
    const response = await fetcher(`${baseUrl}/${path}`, {
      headers: { accept: "application/json", apikey: apiKey },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      throw new Error(
        `PRIM answered ${response.status} for ${path.split("?")[0]}`
      );
    }

    return schema.parse(await response.json());
  };

  return {
    departures: async (line, stopId) =>
      toDepartures(
        await get(
          `stop_areas/${encodeURIComponent(stopId)}/lines/${encodeURIComponent(line.prim)}/departures?count=30&data_freshness=realtime`,
          departuresAnswer
        )
      ),
    lines: async () => {
      const modes = await Promise.all(
        (["metro", "rer", "transilien"] as const).map(async (mode) =>
          toLines(
            mode,
            await get(
              `physical_modes/${physical(mode)}/lines?count=200&depth=1`,
              linesAnswer
            )
          )
        )
      );

      return modes.flat();
    },
    statuses: async (lines) => {
      const modes = [...new Set(lines.map((line) => line.mode))];

      const answers = await Promise.all(
        modes.map(async (mode) =>
          toStatuses(
            lines.filter((line) => line.mode === mode),
            await get(
              `physical_modes/${physical(mode)}/line_reports?count=200`,
              lineReportsAnswer
            )
          )
        )
      );

      return answers.flat();
    },
    stops: async (line) =>
      toStops(
        await get(
          `lines/${encodeURIComponent(line.prim)}/stop_areas?count=500`,
          stopAreasAnswer
        )
      ),
  };
};
