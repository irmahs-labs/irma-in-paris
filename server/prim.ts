import * as z from "zod/mini";

import { LINES, MODES, lineOf, lineOrder } from "../src/data/lines";
import type { Mode, TransitLine } from "../src/data/lines";
import type {
  BusLine,
  Departures,
  Direction,
  DirectionId,
  LineLevel,
  LineStatus,
  Localized,
  NearbyStop,
  Stop,
  Trip,
} from "../src/lib/api";

/**
 * Île-de-France Mobilités' PRIM, through its Navitia API: the metro, RER,
 * tram and Transilien lines, any bus line, each line's directions and
 * stops, the next departures from a stop, the trains from one stop to
 * another, the bus stops near a point, and the lines' disruptions. Every request carries the PRIM key in its
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
  tram: "physical_mode:Tramway",
  transilien: "physical_mode:LocalTrain",
};

/** The codes each mode's lines carry, so buses, TER and the like stay out. */
const CODES: Record<Mode, RegExp> = {
  metro: /^(?:\d{1,2}|3B|7B)$/u,
  rer: /^[A-E]$/u,
  tram: /^T\d{1,2}[ab]?$/u,
  transilien: /^[F-Z]$/u,
};

/** "3bis" → "3B", "a" → "A"; a tram's code stays as PRIM writes it, "T3a". */
const codeOf = (mode: Mode, code: string) =>
  mode === "tram"
    ? code.trim()
    : code.trim().toUpperCase().replace(/BIS$/u, "B");

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
      const code = codeOf(mode, line.code);

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

/** "Château de Vincennes (Vincennes)" → "Château de Vincennes": the town is noise on a sign. */
export const terminusName = (name: string) => {
  const trimmed = name.trim();

  if (!trimmed.endsWith(")")) {
    return trimmed;
  }

  // The bracket opens at the first "(" since the ")" before the last one.
  const open = trimmed.indexOf(
    "(",
    trimmed.lastIndexOf(")", trimmed.length - 2) + 1
  );

  return open === -1 ? trimmed : trimmed.slice(0, open).trim();
};

/** Navitia writes coordinates as strings. */
const coord = z.object({ lat: z.string(), lon: z.string() });

const stopArea = z.object({ coord, id: z.string(), name: z.string() });

export const stopAreasAnswer = z.object({ stop_areas: z.array(stopArea) });

const toStop = (area: z.infer<typeof stopArea>): Stop => ({
  id: area.id,
  lat: Number(area.coord.lat),
  lon: Number(area.coord.lon),
  name: area.name,
});

/** A line's stops, in alphabetical order as a French reader expects it. */
export const toStops = (answer: z.infer<typeof stopAreasAnswer>): Stop[] =>
  answer.stop_areas
    .map(toStop)
    .toSorted((a, b) => a.name.localeCompare(b.name, "fr"));

export const routesAnswer = z.object({
  routes: z.array(
    z.object({
      direction: z.object({ name: z.string() }),
      direction_type: z.optional(z.string()),
      id: z.string(),
      name: z.string(),
    })
  ),
});

type Routes = z.infer<typeof routesAnswer>;

const isWay = (value: string | undefined): value is DirectionId =>
  value === "inbound" || value === "outbound";

/**
 * Each way's main routes, by terminus: those named after where they go, so
 * a short run ("La Courneuve" towards Place d'Italie) does not count as a
 * terminus of its own. When none is, every route that way counts.
 */
const mainRoutes = (answer: Routes, way: DirectionId) => {
  const routes = answer.routes.filter((route) => route.direction_type === way);

  const main = routes.filter((route) =>
    route.name.includes(terminusName(route.direction.name))
  );

  const byTerminus = new Map<string, string[]>();

  for (const route of main.length > 0 ? main : routes) {
    const terminus = terminusName(route.direction.name);

    byTerminus.set(terminus, [...(byTerminus.get(terminus) ?? []), route.id]);
  }

  return byTerminus;
};

/** The line's two ways, each named by its termini: "Mairie d'Ivry / Villejuif - Louis Aragon". */
export const toDirections = (answer: Routes): Direction[] => {
  const ways = [
    ...new Set(answer.routes.map((route) => route.direction_type)),
  ].filter(isWay);

  return ways.flatMap((way) => {
    const termini = [...mainRoutes(answer, way).keys()];

    return termini.length > 0
      ? [{ id: way, towards: termini.join(" / ") }]
      : [];
  });
};

export const vehicleJourneysAnswer = z.object({
  vehicle_journeys: z.array(
    z.object({
      stop_times: z.array(
        z.object({ stop_point: z.object({ stop_area: stopArea }) })
      ),
    })
  ),
});

/** Routes asked for one way, at most. */
const ROUTES_PER_WAY = 8;

/** A route's stops in the order a train calls at them: its longest journey's. */
export const toCalls = (
  answer: z.infer<typeof vehicleJourneysAnswer>
): Stop[] => {
  const [longest] = answer.vehicle_journeys.toSorted(
    (a, b) => b.stop_times.length - a.stop_times.length
  );

  return (longest?.stop_times ?? []).map((time) =>
    toStop(time.stop_point.stop_area)
  );
};

/**
 * One way's stops in order, from each of its routes, the longest first: a
 * branch that splits off goes after the stops it shares, one that joins
 * goes before.
 */
export const mergeCalls = (branches: readonly Stop[][]): Stop[] => {
  const merged: Stop[] = [];

  for (const branch of branches.toSorted((a, b) => b.length - a.length)) {
    let pending: Stop[] = [];

    for (const stop of branch) {
      const at = merged.findIndex((known) => known.id === stop.id);

      if (at === -1) {
        if (!pending.some((known) => known.id === stop.id)) {
          pending.push(stop);
        }

        continue;
      }

      merged.splice(at, 0, ...pending);
      pending = [];
    }

    merged.push(...pending);
  }

  return merged;
};

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
          direction_type: z.optional(z.string()),
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

/** "20261112T192800" → "19:28" */
const clockOf = (time: string) => `${time.slice(9, 11)}:${time.slice(11, 13)}`;

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
  now: Date = new Date(),
  way?: DirectionId
): Departures => {
  const start = minutesOf(parsed.context?.current_datetime ?? parisStamp(now));
  const byTerminus = new Map<string, { minutes: number; at: string }[]>();

  for (const departure of parsed.departures) {
    if (way && departure.route?.direction_type !== way) {
      continue;
    }

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
const EFFECTS = new Map<string, Localized>([
  ["NO_SERVICE", { en: "No trains", fr: "Trafic interrompu" }],
  ["REDUCED_SERVICE", { en: "Fewer trains", fr: "Trafic réduit" }],
  ["SIGNIFICANT_DELAYS", { en: "Delays", fr: "Retards" }],
  ["DETOUR", { en: "Trains diverted", fr: "Trains déviés" }],
  ["MODIFIED_SERVICE", { en: "Changed service", fr: "Service modifié" }],
  ["STOP_MOVED", { en: "Stop moved", fr: "Arrêt déplacé" }],
]);

const DISRUPTED: Localized = { en: "Disrupted", fr: "Trafic perturbé" };

const isWorks = (item: Disruption) =>
  /travaux|works/iu.test(item.cause ?? "") ||
  (item.tags ?? []).some((tag) => /travaux|works/iu.test(tag));

const weekday = (locale: string) =>
  new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    weekday: "short",
  });

const WEEKDAYS = { en: weekday("en-GB"), fr: weekday("fr-FR") };

const NO_START: Localized = { en: "", fr: "" };

/**
 * When a disruption that has not started yet starts: "from 22:30 today",
 * "from Mon 3 Nov", or in French "à partir de 22:30 aujourd’hui".
 */
const startOf = (item: Disruption, now: Date): Localized => {
  const begin = item.application_periods?.[0]?.begin;

  if (item.status !== "future" || !begin) {
    return NO_START;
  }

  const clock = `${begin.slice(9, 11)}:${begin.slice(11, 13)}`;

  if (begin.slice(0, 8) === parisStamp(now).slice(0, 8)) {
    return {
      en: ` from ${clock} today`,
      fr: ` à partir de ${clock} aujourd’hui`,
    };
  }

  const day = new Date(
    Date.UTC(
      Number(begin.slice(0, 4)),
      Number(begin.slice(4, 6)) - 1,
      Number(begin.slice(6, 8))
    )
  );

  return {
    en: ` from ${WEEKDAYS.en.format(day).replace(",", "")}, ${clock}`,
    fr: ` à partir du ${WEEKDAYS.fr.format(day)}, ${clock}`,
  };
};

/**
 * A disruption in English and in French, from PRIM's structured fields
 * rather than its own French text, so both read the same: what happens,
 * where, and when it starts if it has not yet.
 * "Works: No trains between La Défense and Nanterre-Préfecture from 22:30 today".
 */
export const describe = (
  item: Disruption,
  now: Date = new Date()
): Localized => {
  const effect = EFFECTS.get(item.severity?.effect ?? "") ?? DISRUPTED;

  const section = item.impacted_objects?.find(
    (object) => object.impacted_section
  )?.impacted_section;

  const from = section?.from?.name;
  const to = section?.to?.name;
  const between = from && to && from !== to;
  const start = startOf(item, now);
  const works = isWorks(item);

  return {
    en: `${works ? "Works: " : ""}${effect.en}${between ? ` between ${terminusName(from)} and ${terminusName(to)}` : ""}${start.en}`,
    fr: `${works ? "Travaux : " : ""}${effect.fr}${between ? ` entre ${terminusName(from)} et ${terminusName(to)}` : ""}${start.fr}`,
  };
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

const NORMAL: Localized = {
  en: "Traffic normal on the whole line",
  fr: "Trafic normal sur l’ensemble de la ligne",
};

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

export const journeysAnswer = z.object({
  context: z.optional(z.object({ current_datetime: z.optional(z.string()) })),
  journeys: z.optional(
    z.array(
      z.object({
        sections: z.array(
          z.object({
            arrival_date_time: z.optional(z.string()),
            data_freshness: z.optional(z.string()),
            departure_date_time: z.optional(z.string()),
            display_informations: z.optional(
              z.object({ direction: z.optional(z.string()) })
            ),
            type: z.string(),
          })
        ),
      })
    )
  ),
});

/** Trips shown from one stop to another. */
const TRIPS = 4;

/**
 * The next trains from one stop that call at another, with no change: the
 * journeys PRIM finds on the one line, each a single train.
 */
export const toTrips = (
  parsed: z.infer<typeof journeysAnswer>,
  now: Date = new Date()
): Trip[] => {
  const start = minutesOf(parsed.context?.current_datetime ?? parisStamp(now));
  const seen = new Set<string>();

  return (parsed.journeys ?? [])
    .flatMap((journey) => {
      const rides = journey.sections.filter(
        (section) => section.type === "public_transport"
      );

      const [ride] = rides;
      const leaves = ride?.departure_date_time;
      const arrives = ride?.arrival_date_time;

      if (rides.length !== 1 || !ride || !leaves || !arrives) {
        return [];
      }

      const towards = terminusName(ride.display_informations?.direction ?? "");
      // One train can come back twice, as timetabled and as running late.
      const key = `${clockOf(leaves)}|${towards}`;

      if (seen.has(key)) {
        return [];
      }

      seen.add(key);

      return [
        {
          arrives: clockOf(arrives),
          at: clockOf(leaves),
          live: ride.data_freshness === "realtime",
          minutes: Math.max(0, Math.floor(minutesOf(leaves) - start)),
          towards,
        },
      ];
    })
    .toSorted((a, b) => a.minutes - b.minutes)
    .slice(0, TRIPS);
};

const BUS = "physical_mode:Bus";

const lineObject = z.object({
  code: z.optional(z.string()),
  color: z.optional(z.string()),
  id: z.string(),
  network: z.optional(z.object({ name: z.optional(z.string()) })),
  physical_modes: z.optional(z.array(z.object({ id: z.string() }))),
  text_color: z.optional(z.string()),
});

const hexOr = (value: string | undefined, fallback: string) =>
  value && HEX.test(value) ? `#${value.toLowerCase()}` : fallback;

/** A line PRIM lists as a bus, as the bus screen shows it; null for anything else. */
export const toBusLine = (line: z.infer<typeof lineObject>): BusLine | null =>
  (line.physical_modes ?? []).some((mode) => mode.id === BUS) && line.code
    ? {
        code: line.code,
        colour: hexOr(line.color, "#d4dd9c"),
        id: line.id,
        ink: hexOr(line.text_color, "#000000"),
        network: line.network?.name ?? "",
      }
    : null;

export const lineSearchAnswer = z.object({
  pt_objects: z.optional(
    z.array(
      z.object({ embedded_type: z.string(), line: z.optional(lineObject) })
    )
  ),
});

/** The bus lines a search finds, the one whose code is exactly what was typed first. */
export const toBusLines = (
  query: string,
  answer: z.infer<typeof lineSearchAnswer>
): BusLine[] => {
  const typed = query.trim().toUpperCase();

  return (answer.pt_objects ?? [])
    .flatMap((object) => {
      const bus = object.line ? toBusLine(object.line) : null;

      return bus ? [bus] : [];
    })
    .toSorted(
      (a, b) =>
        Number(b.code.toUpperCase() === typed) -
          Number(a.code.toUpperCase() === typed) ||
        a.code.length - b.code.length
    );
};

export const lineAnswer = z.object({ lines: z.array(lineObject) });

export const nearbyAnswer = z.object({
  places_nearby: z.optional(
    z.array(
      z.object({
        distance: z.optional(z.string()),
        embedded_type: z.string(),
        id: z.string(),
        name: z.string(),
      })
    )
  ),
});

/** Bus stops looked at around the rider, and lines and times shown at each. */
const NEARBY_STOPS = 3;
const NEARBY_LINES = 8;
const NEARBY_TIMES = 3;

/** Buses further off than this are left out: a night bus at 2 a.m. helps no one at 7 p.m. */
const NEARBY_MINUTES = 90;

export const busDeparturesAnswer = z.object({
  context: z.optional(z.object({ current_datetime: z.optional(z.string()) })),
  departures: z.array(
    z.object({
      display_informations: z.optional(
        z.object({
          code: z.optional(z.string()),
          color: z.optional(z.string()),
          direction: z.optional(z.string()),
          text_color: z.optional(z.string()),
        })
      ),
      stop_date_time: z.object({ departure_date_time: z.string() }),
    })
  ),
});

/** What leaves a stop soonest, by line and where it goes. */
export const toNearbyDepartures = (
  parsed: z.infer<typeof busDeparturesAnswer>,
  now: Date = new Date()
): NearbyStop["departures"] => {
  const start = minutesOf(parsed.context?.current_datetime ?? parisStamp(now));
  const byLine = new Map<string, NearbyStop["departures"][number]>();

  for (const departure of parsed.departures) {
    const info = departure.display_informations;
    const code = info?.code;
    const towards = terminusName(info?.direction ?? "");

    const minutes = Math.floor(
      minutesOf(departure.stop_date_time.departure_date_time) - start
    );

    if (
      !(code && towards && Number.isFinite(minutes)) ||
      minutes > NEARBY_MINUTES
    ) {
      continue;
    }

    const key = `${code}|${towards}`;

    const entry = byLine.get(key) ?? {
      line: {
        code,
        colour: hexOr(info.color, "#d4dd9c"),
        ink: hexOr(info.text_color, "#000000"),
      },
      minutes: [],
      towards,
    };

    if (entry.minutes.length < NEARBY_TIMES) {
      entry.minutes.push(Math.max(0, minutes));
    }

    byLine.set(key, entry);
  }

  return [...byLine.values()]
    .toSorted((a, b) => (a.minutes[0] ?? 0) - (b.minutes[0] ?? 0))
    .slice(0, NEARBY_LINES);
};

export interface Prim {
  lines: () => Promise<PrimLine[]>;
  /** Every stop of a line, by PRIM's line id, in alphabetical order. */
  stops: (lineId: string) => Promise<Stop[]>;
  directions: (lineId: string) => Promise<Direction[]>;
  /** One way's stops, in the order a train calls at them. */
  stopsTowards: (lineId: string, way: DirectionId) => Promise<Stop[]>;
  /** The next departures from a stop, only those going one way when it is given. */
  departures: (
    lineId: string,
    stopId: string,
    way?: DirectionId
  ) => Promise<Departures>;
  /** The next trains from one stop of a line that call at another. */
  trips: (lineId: string, from: string, to: string) => Promise<Trip[]>;
  /** The status of every line given, from one request per mode. */
  statuses: (lines: readonly PrimLine[]) => Promise<LineStatus[]>;
  searchBuses: (query: string) => Promise<BusLine[]>;
  /** The bus line with that id; null when it is not a bus. */
  busLine: (lineId: string) => Promise<BusLine | null>;
  /** The bus stops nearest a point, each with what leaves it soonest. */
  busesNear: (lat: number, lon: number) => Promise<NearbyStop[]>;
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

  const id = encodeURIComponent;

  const routesOf = (lineId: string) =>
    get(`lines/${id(lineId)}/routes?depth=1&count=200`, routesAnswer);

  return {
    busLine: async (lineId) => {
      const { lines } = await get(`lines/${id(lineId)}?depth=1`, lineAnswer);
      const [line] = lines;

      return line ? toBusLine(line) : null;
    },
    busesNear: async (lat, lon) => {
      const query = new URLSearchParams({
        count: String(NEARBY_STOPS),
        depth: "0",
        distance: "500",
        filter: `physical_mode.id=${BUS}`,
        "type[]": "stop_area",
      });

      const nearby = await get(
        `coord/${lon};${lat}/places_nearby?${query}`,
        nearbyAnswer
      );

      const stops = (nearby.places_nearby ?? []).filter(
        (place) => place.embedded_type === "stop_area"
      );

      return Promise.all(
        stops.map(async (stop) => ({
          departures: toNearbyDepartures(
            await get(
              `stop_areas/${id(stop.id)}/physical_modes/${id(BUS)}/departures?count=40&data_freshness=realtime&depth=1`,
              busDeparturesAnswer
            )
          ),
          distance: Math.round(Number(stop.distance ?? 0)),
          id: stop.id,
          name: terminusName(stop.name),
        }))
      );
    },
    departures: async (lineId, stopId, way) =>
      toDepartures(
        await get(
          `stop_areas/${id(stopId)}/lines/${id(lineId)}/departures?count=40&data_freshness=realtime`,
          departuresAnswer
        ),
        new Date(),
        way
      ),
    directions: async (lineId) => toDirections(await routesOf(lineId)),
    lines: async () => {
      const modes = await Promise.all(
        MODES.map(async (mode) =>
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
    searchBuses: async (query) => {
      const params = new URLSearchParams({
        count: "30",
        depth: "1",
        q: query,
        "type[]": "line",
      });

      return toBusLines(
        query,
        await get(`pt_objects?${params}`, lineSearchAnswer)
      );
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
    stops: async (lineId) =>
      toStops(
        await get(`lines/${id(lineId)}/stop_areas?count=500`, stopAreasAnswer)
      ),
    stopsTowards: async (lineId, way) => {
      const routes = [...mainRoutes(await routesOf(lineId), way).values()]
        .flat()
        .slice(0, ROUTES_PER_WAY);

      const branches = await Promise.all(
        routes.map(async (route) =>
          toCalls(
            await get(
              `routes/${id(route)}/vehicle_journeys?count=3&depth=2&disable_geojson=true`,
              vehicleJourneysAnswer
            )
          )
        )
      );

      return mergeCalls(branches);
    },
    trips: async (lineId, from, to) => {
      const query = new URLSearchParams({
        "allowed_id[]": lineId,
        count: String(TRIPS),
        data_freshness: "realtime",
        depth: "0",
        direct_path: "none",
        disable_geojson: "true",
        from,
        max_nb_transfers: "0",
        min_nb_journeys: String(TRIPS),
        to,
      });

      return toTrips(await get(`journeys?${query}`, journeysAnswer));
    },
  };
};
