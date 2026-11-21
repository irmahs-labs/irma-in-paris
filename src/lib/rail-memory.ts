import * as z from "zod/mini";
// zod's catch(): a schema that falls back to a value, named so it does not
// read as a Promise
import { catch as withFallback } from "zod/mini";

/**
 * The rail screen's memory, in this browser only: the line picked last,
 * and on each RER and Transilien line, the stops of the last trip looked
 * up (where to, and where from), by PRIM's stop area id. Nothing leaves
 * the browser; a stop id the line no longer has is simply not found.
 */

const LINE_KEY = "rail:line";

const TRIPS_KEY = "rail:trips";

/** The most lines whose trips are kept: the oldest go first. */
export const MAX_TRIPS = 20;

export interface SavedTrip {
  to: string | null;
  from: string | null;
}

const read = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const write = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage full or off: the choice lasts for this visit only
  }
};

const id = z.string().check(z.regex(/^[\w:.-]{1,100}$/u));

/** A stop id that doesn't read as one is forgotten, not the whole trip. */
const stopId = withFallback(z.nullable(id), null);

const tripsSchema = z.array(
  z.tuple([id, z.object({ from: z.optional(stopId), to: z.optional(stopId) })])
);

/** Every saved trip, by line key, oldest first; a damaged list is dropped. */
const readTrips = (): [string, SavedTrip][] => {
  try {
    const parsed = tripsSchema.safeParse(JSON.parse(read(TRIPS_KEY) ?? "[]"));

    return parsed.success
      ? parsed.data.map(([line, trip]) => [
          line,
          { from: trip.from ?? null, to: trip.to ?? null },
        ])
      : [];
  } catch {
    return [];
  }
};

export const savedLine = (): string | undefined => {
  const line = id.safeParse(read(LINE_KEY));

  return line.success ? line.data : undefined;
};

export const saveLine = (line: string) => write(LINE_KEY, line);

export const savedTrip = (line: string): SavedTrip =>
  readTrips().find(([key]) => key === line)?.[1] ?? { from: null, to: null };

/** Keeps a line's trip, as the newest. */
export const saveTrip = (line: string, trip: SavedTrip) =>
  write(
    TRIPS_KEY,
    JSON.stringify(
      [...readTrips().filter(([key]) => key !== line), [line, trip]].slice(
        -MAX_TRIPS
      )
    )
  );
