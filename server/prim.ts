import * as z from "zod/mini";

import type { Direction, FeedLine, MetroLine } from "../src/data/lines";
import { terminusOf } from "../src/data/lines";
import type { Departures, LineLevel, LineStatus } from "../src/lib/api";

/**
 * Île-de-France Mobilités' PRIM, through its Navitia API: the stops of each
 * line, the next departures from a stop, and each line's disruptions. Every
 * request carries the PRIM key in its `apikey` header; the key never leaves
 * this server.
 */
export const PRIM_NAVITIA =
  "https://prim.iledefrance-mobilites.fr/marketplace/v2/navitia";

/** Lower case, no accents, every run of anything but letters and digits one space. */
export const normalise = (name: string) =>
  name
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, " ")
    .trim();

/** Whether two stop names are the same stop: PRIM adds "(Grande Arche)" and the like. */
export const sameStop = (a: string, b: string) => {
  const one = normalise(a);
  const other = normalise(b);

  return (
    one === other || one.startsWith(`${other} `) || other.startsWith(`${one} `)
  );
};

export const stopAreasAnswer = z.object({
  stop_areas: z.array(z.object({ id: z.string(), name: z.string() })),
});

/** The stop area id of each of the line's stops, by the name the app knows it by. */
export const matchStops = (
  line: MetroLine,
  { stop_areas: areas }: z.infer<typeof stopAreasAnswer>
): Map<string, string> => {
  const ids = new Map<string, string>();

  for (const stop of line.stops) {
    const exact = areas.find(
      (area) => normalise(area.name) === normalise(stop)
    );

    const area =
      exact ?? areas.find((candidate) => sameStop(candidate.name, stop));

    if (area) {
      ids.set(stop, area.id);
    }
  }

  return ids;
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
          direction: z.optional(
            z.object({
              id: z.optional(z.string()),
              name: z.optional(z.string()),
            })
          ),
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
const parisStamp = (date: Date) => {
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

/** How many trains the screen shows. */
const TRAINS = 3;

/**
 * The next trains towards the terminus, from Navitia's departures at a stop.
 * A departure is kept when its route runs to the terminus's stop area, or,
 * when Navitia does not say, when its direction is named after the terminus.
 * Times are counted from Navitia's own "now" (or, without one, the server's
 * clock in Paris), both being Paris times.
 */
export const toDepartures = (
  parsed: z.infer<typeof departuresAnswer>,
  terminus: { id: string | undefined; name: string },
  now: Date = new Date()
): Departures => {
  const start = minutesOf(parsed.context?.current_datetime ?? parisStamp(now));

  const trains = parsed.departures
    .filter((departure) => {
      const towards = departure.route?.direction;

      if (towards?.id && terminus.id) {
        return towards.id === terminus.id;
      }

      const name =
        towards?.name ?? departure.display_informations?.direction ?? "";

      return sameStop(name, terminus.name);
    })
    .map((departure) => {
      const time = departure.stop_date_time.departure_date_time;
      const at = `${time.slice(9, 11)}:${time.slice(11, 13)}`;
      const minutes = Math.floor(minutesOf(time) - start);

      return { at, minutes: Math.max(0, minutes) };
    })
    .filter((train) => Number.isFinite(train.minutes))
    .slice(0, TRAINS);

  return { trains };
};

const disruption = z.object({
  application_periods: z.optional(
    z.array(z.object({ begin: z.string(), end: z.string() }))
  ),
  cause: z.optional(z.string()),
  messages: z.optional(
    z.array(
      z.object({
        channel: z.optional(
          z.object({ types: z.optional(z.array(z.string())) })
        ),
        text: z.string(),
      })
    )
  ),
  severity: z.optional(z.object({ effect: z.optional(z.string()) })),
  status: z.optional(z.string()),
  tags: z.optional(z.array(z.string())),
});

type Disruption = z.infer<typeof disruption>;

export const lineReportsAnswer = z.object({
  disruptions: z.optional(z.array(disruption)),
});

/** The effects that change a journey; elevators out of order and notices do not. */
const DISRUPTING = new Set([
  "NO_SERVICE",
  "REDUCED_SERVICE",
  "SIGNIFICANT_DELAYS",
  "DETOUR",
  "MODIFIED_SERVICE",
  "STOP_MOVED",
]);

const isWorks = (item: Disruption) =>
  /travaux|works/iu.test(item.cause ?? "") ||
  (item.tags ?? []).some((tag) => /travaux|works/iu.test(tag));

/** Whether a future disruption begins within the next day. */
const beginsSoon = (item: Disruption, now: Date) => {
  const begin = item.application_periods?.[0]?.begin;

  if (!begin) {
    return false;
  }

  const starts = minutesOf(begin) * 60_000;
  const parisNow = minutesOf(parisStamp(now)) * 60_000;

  return starts - parisNow < 24 * 60 * 60 * 1000;
};

/** A message's text without its HTML, on one line. */
const plain = (text: string) =>
  text
    .replaceAll(/<[^>]*>/gu, " ")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll(/&#39;|&apos;/gu, "'")
    .replaceAll("&quot;", '"')
    .replaceAll(/\s+/gu, " ")
    .trim();

const titleOf = (item: Disruption) => {
  const messages = item.messages ?? [];

  const title = messages.find((message) =>
    message.channel?.types?.includes("title")
  );

  return plain((title ?? messages[0])?.text ?? "");
};

const NORMAL = "Traffic normal on the whole line";

/**
 * A line's status from its line reports: disrupted while something that
 * changes journeys is on, works when that is works, on now or starting
 * within the day.
 */
export const toLineStatus = (
  line: FeedLine,
  answer: z.infer<typeof lineReportsAnswer>,
  now: Date = new Date()
): LineStatus => {
  const items = (answer.disruptions ?? []).filter(
    (item) =>
      (DISRUPTING.has(item.severity?.effect ?? "") || isWorks(item)) &&
      (item.status === "active" ||
        (item.status === "future" && isWorks(item) && beginsSoon(item, now)))
  );

  const active = items.find(
    (item) => item.status === "active" && !isWorks(item)
  );

  const shown = active ?? items[0];

  if (!shown) {
    return { detail: NORMAL, id: line.id, level: "ok" };
  }

  const level: LineLevel = active ? "warn" : "works";

  return { detail: titleOf(shown) || "Disrupted", id: line.id, level };
};

export interface Prim {
  departures: (
    line: MetroLine,
    direction: Direction,
    stop: string
  ) => Promise<Departures>;
  status: (line: FeedLine) => Promise<LineStatus>;
}

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

  // A line's stops rarely change: asked once a day.
  const stopIds = new Map<string, { at: number; ids: Map<string, string> }>();
  const DAY = 24 * 60 * 60 * 1000;

  const stopsOf = async (line: MetroLine) => {
    const known = stopIds.get(line.id);

    if (known && Date.now() - known.at < DAY) {
      return known.ids;
    }

    const ids = matchStops(
      line,
      await get(
        `lines/${encodeURIComponent(line.prim)}/stop_areas?count=200`,
        stopAreasAnswer
      )
    );

    stopIds.set(line.id, { at: Date.now(), ids });

    return ids;
  };

  return {
    departures: async (line, direction, stop) => {
      const ids = await stopsOf(line);
      const from = ids.get(stop);
      const terminus = terminusOf(line, direction);

      if (!from) {
        throw new Error(`PRIM has no stop named ${stop} on line ${line.id}`);
      }

      const answer = await get(
        `stop_areas/${encodeURIComponent(from)}/lines/${encodeURIComponent(line.prim)}/departures?count=20&data_freshness=realtime`,
        departuresAnswer
      );

      return toDepartures(answer, { id: ids.get(terminus), name: terminus });
    },
    status: async (line) =>
      toLineStatus(
        line,
        await get(
          `lines/${encodeURIComponent(line.prim)}/line_reports?count=50`,
          lineReportsAnswer
        )
      ),
  };
};
