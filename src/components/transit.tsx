import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import type { Departures, Direction, Stop, Trips } from "../lib/api";
import { nearestTo } from "../lib/geo";
import { useCopy } from "../lib/language";
import { useApi } from "../lib/use-api";
import { useLocation } from "../lib/use-location";
import { LocateButton } from "./locate-button";

const NO_KEY = "no-prim-key";

const COPY = {
  en: {
    arrives: (at: string) => `arrives ${at}`,
    direction: "2 · Direction",
    findOne: (n: number) => `Find one of ${n} stops`,
    findStop: (line: string) => `Find a stop on ${line}`,
    from: "3 · From",
    goingTo: "2 · Going to",
    leaves: "leaves",
    loadingStops: "Loading the stops…",
    minAt: (at: string) => `min · ${at}`,
    nearest: (name: string) => `Nearest stop: ${name}`,
    noKey: "Live times are off: the server has no PRIM key yet.",
    noStop: "No stop by that name.",
    noTrains: "Nothing announced from here right now.",
    noTrips:
      "No train from here calls there in the next while. Try another stop.",
    primDown: "PRIM could not be reached just now. It will try again shortly.",
    stop: "3 · Stop",
    stopGroup: "stop",
    timetabled: "timetable",
    towards: (name: string) => `towards ${name}`,
  },
  fr: {
    arrives: (at: string) => `arrive à ${at}`,
    direction: "2 · Direction",
    findOne: (n: number) => `Chercher parmi ${n} arrêts`,
    findStop: (line: string) => `Chercher un arrêt sur ${line}`,
    from: "3 · Départ",
    goingTo: "2 · Destination",
    leaves: "départ",
    loadingStops: "Chargement des arrêts…",
    minAt: (at: string) => `min · ${at}`,
    nearest: (name: string) => `Arrêt le plus proche : ${name}`,
    noKey: "Horaires en direct coupés : le serveur n’a pas encore de clé PRIM.",
    noStop: "Aucun arrêt de ce nom.",
    noTrains: "Rien d’annoncé d’ici pour le moment.",
    noTrips:
      "Aucun train d’ici ne s’y arrête prochainement. Essayez un autre arrêt.",
    primDown: "PRIM ne répond pas pour le moment. Nouvel essai sous peu.",
    stop: "3 · Arrêt",
    stopGroup: "arrêt",
    timetabled: "horaire prévu",
    towards: (name: string) => `vers ${name}`,
  },
};

/** A line as the transport screens pick from it: a metro, RER, tram, Transilien or bus line. */
export interface LineRef {
  /** What the server knows it by: "metro:7", or a bus line's PRIM id. */
  query: string;
  title: string;
  colour: string;
  badge: ReactNode;
}

export const PrimProblem = ({ error }: { error: string }) => {
  const t = useCopy(COPY);

  return <p className="notice">{error === NO_KEY ? t.noKey : t.primDown}</p>;
};

/** Ignores accents and case, so "chatelet" finds "Châtelet". */
const plain = (text: string) =>
  text
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** A line's stops to pick one from, with a search field over them. */
const StopPicker = ({
  line,
  stops,
  picked,
  onPick,
}: {
  line: LineRef;
  stops: readonly Stop[] | undefined;
  picked: Stop | null;
  onPick: (stop: Stop) => void;
}) => {
  const [filter, setFilter] = useState("");
  const t = useCopy(COPY);

  const shown = useMemo(
    () =>
      (stops ?? []).filter((stop) =>
        plain(stop.name).includes(plain(filter.trim()))
      ),
    [stops, filter]
  );

  return (
    <>
      <input
        className="field"
        type="search"
        aria-label={t.findStop(line.title)}
        placeholder={stops ? t.findOne(stops.length) : t.loadingStops}
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
      />
      <div role="group" aria-label={t.stopGroup} className="stops">
        {shown.map((stop) => (
          <button
            key={stop.id}
            type="button"
            aria-pressed={stop.id === picked?.id}
            className="stop"
            onClick={() => onPick(stop)}
          >
            <span
              aria-hidden="true"
              className="stop__dot"
              style={
                stop.id === picked?.id ? { background: line.colour } : undefined
              }
            />
            {stop.name}
          </button>
        ))}
        {stops && shown.length === 0 ? (
          <p className="hint">{t.noStop}</p>
        ) : null}
      </div>
    </>
  );
};

/**
 * The "near me" button for a list of stops: once the rider's position is
 * known, the nearest stop is picked for them.
 */
const NearestStop = ({
  stops,
  onPick,
}: {
  stops: readonly Stop[] | undefined;
  onPick: (stop: Stop) => void;
}) => {
  const { ask, locating } = useLocation();
  const [found, setFound] = useState<Stop>();
  const t = useCopy(COPY);

  useEffect(() => {
    if (locating.state !== "found" || !stops) {
      return;
    }

    const nearest = nearestTo(locating.point, stops);

    if (nearest) {
      setFound(nearest);
      onPick(nearest);
    }
    // Only when a new position comes, not each time the stops refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locating, stops]);

  return (
    <>
      <LocateButton locating={locating} onPress={ask} />
      {found && locating.state === "found" ? (
        <p className="hint">{t.nearest(found.name)}</p>
      ) : null}
    </>
  );
};

/** The next departures from a stop, by where they go, one way only when it is given. */
const Departure = ({
  line,
  stop,
  direction,
}: {
  line: LineRef;
  stop: Stop;
  direction?: Direction;
}) => {
  const query = new URLSearchParams({ line: line.query, stop: stop.id });

  if (direction) {
    query.set("direction", direction.id);
  }

  const { data, error } = useApi<Departures>(
    `/api/transport/departures?${query}`,
    30_000
  );

  const t = useCopy(COPY);

  return (
    <div className="result" aria-live="polite">
      <div className="result__head">
        {line.badge}
        <span className="result__stop">{stop.name}</span>
      </div>
      {error ? <PrimProblem error={error} /> : null}
      {data && data.directions.length === 0 ? (
        <p className="notice">{t.noTrains}</p>
      ) : null}
      {data?.directions.map((way) => (
        <div key={way.towards} className="direction">
          <span className="direction__name">→ {way.towards}</span>
          <div className="trains">
            {way.trains.map((train) => (
              <div key={`${train.at}-${train.minutes}`} className="train">
                <span className="train__min">{train.minutes}</span>
                <span className="train__at">{t.minAt(train.at)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Metro, tram and bus: pick the direction, then the stop on that way, in
 * the order the line runs, then see what leaves from there.
 */
export const DirectionFlow = ({ line }: { line: LineRef }) => {
  const [direction, setDirection] = useState<Direction | null>(null);
  const [stop, setStop] = useState<Stop | null>(null);
  const t = useCopy(COPY);

  const directions = useApi<Direction[]>(
    `/api/transport/directions?${new URLSearchParams({ line: line.query })}`
  );

  const stops = useApi<Stop[]>(
    direction
      ? `/api/transport/stops?${new URLSearchParams({ direction: direction.id, line: line.query })}`
      : null
  );

  return (
    <>
      <div className="step">
        <span className="step__label">{t.direction}</span>
        {directions.error ? <PrimProblem error={directions.error} /> : null}
        <div className="choices">
          {directions.data?.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className="choice"
              aria-pressed={entry.id === direction?.id}
              onClick={() => {
                setDirection(entry);
                setStop(null);
              }}
            >
              → {entry.towards}
            </button>
          ))}
        </div>
      </div>
      {direction ? (
        <div className="step">
          <span className="step__label">{t.stop}</span>
          {stops.error ? (
            <PrimProblem error={stops.error} />
          ) : (
            <>
              <NearestStop stops={stops.data} onPick={setStop} />
              <StopPicker
                line={line}
                stops={stops.data}
                picked={stop}
                onPick={setStop}
              />
            </>
          )}
        </div>
      ) : null}
      {direction && stop ? (
        <Departure line={line} stop={stop} direction={direction} />
      ) : null}
    </>
  );
};

/** The next trains from one stop that call at another. */
const TripTimes = ({
  line,
  from,
  to,
}: {
  line: LineRef;
  from: Stop;
  to: Stop;
}) => {
  const query = new URLSearchParams({
    from: from.id,
    line: line.query,
    to: to.id,
  });

  const { data, error } = useApi<Trips>(
    `/api/transport/trips?${query}`,
    30_000
  );

  const t = useCopy(COPY);

  return (
    <div className="result" aria-live="polite">
      <div className="result__head">
        {line.badge}
        <span className="result__stop">
          {from.name} → {to.name}
        </span>
      </div>
      {error ? <PrimProblem error={error} /> : null}
      {data && data.trips.length === 0 ? (
        <p className="notice">{t.noTrips}</p>
      ) : null}
      {data && data.trips.length > 0 ? (
        <div className="trips">
          {data.trips.map((trip) => (
            <div key={`${trip.at}-${trip.towards}`} className="train trip">
              <span className="train__min">{trip.minutes}</span>
              <span className="train__at">
                {t.minAt(trip.at)}
                {trip.live ? "" : ` · ${t.timetabled}`}
              </span>
              <span className="trip__arrives">{t.arrives(trip.arrives)}</span>
              <span className="trip__towards">{t.towards(trip.towards)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

/**
 * RER and Transilien: pick where you are going, then where you leave
 * from, and see only the trains that call at both, since on a line with
 * branches not every train stops everywhere.
 */
export const TripFlow = ({ line }: { line: LineRef }) => {
  const [to, setTo] = useState<Stop | null>(null);
  const [from, setFrom] = useState<Stop | null>(null);
  const t = useCopy(COPY);

  const stops = useApi<Stop[]>(
    `/api/transport/stops?${new URLSearchParams({ line: line.query })}`
  );

  const others = useMemo(
    () => stops.data?.filter((stop) => stop.id !== to?.id),
    [stops.data, to]
  );

  if (stops.error) {
    return <PrimProblem error={stops.error} />;
  }

  return (
    <>
      <div className="step">
        <span className="step__label">{t.goingTo}</span>
        <StopPicker
          line={line}
          stops={stops.data}
          picked={to}
          onPick={(stop) => {
            setTo(stop);

            if (stop.id === from?.id) {
              setFrom(null);
            }
          }}
        />
      </div>
      {to ? (
        <div className="step">
          <span className="step__label">{t.from}</span>
          <NearestStop stops={others} onPick={setFrom} />
          <StopPicker
            line={line}
            stops={others}
            picked={from}
            onPick={setFrom}
          />
        </div>
      ) : null}
      {to && from ? <TripTimes line={line} from={from} to={to} /> : null}
    </>
  );
};
