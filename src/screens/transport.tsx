import { useMemo, useState } from "react";

import { AppWindow } from "../components/app-window";
import { LazyMap } from "../components/lazy-map";
import { LineBadge } from "../components/line-badge";
import { LINES, MODES, modeName, shownCode } from "../data/lines";
import type { TransitLine } from "../data/lines";
import type {
  Departures,
  LinesReport,
  Stop,
  TrafficReport,
  VelibReport,
} from "../lib/api";
import { parisTime } from "../lib/clock";
import { Icon } from "../lib/icon";
import { useApi } from "../lib/use-api";

const NO_KEY = "no-prim-key";

const PrimProblem = ({ error }: { error: string }) => (
  <p className="notice">
    {error === NO_KEY
      ? "Live times are off: the server has no PRIM key yet."
      : "PRIM could not be reached just now. It will try again shortly."}
  </p>
);

/** Ignores accents and case, so "chatelet" finds "Châtelet". */
const plain = (text: string) =>
  text
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .toLowerCase();

const Departure = ({ line, stop }: { line: TransitLine; stop: Stop }) => {
  const query = new URLSearchParams({ line: line.key, stop: stop.id });

  const { data, error } = useApi<Departures>(
    `/api/transport/departures?${query}`,
    30_000
  );

  return (
    <div className="result" aria-live="polite">
      <div className="result__head">
        <LineBadge line={line} />
        <span className="result__stop">{stop.name}</span>
      </div>
      {error ? <PrimProblem error={error} /> : null}
      {data && data.directions.length === 0 ? (
        <p className="notice">No trains announced from here right now.</p>
      ) : null}
      {data?.directions.map((direction) => (
        <div key={direction.towards} className="direction">
          <span className="direction__name">→ {direction.towards}</span>
          <div className="trains">
            {direction.trains.map((train) => (
              <div key={`${train.at}-${train.minutes}`} className="train">
                <span className="train__min">{train.minutes}</span>
                <span className="train__at">min · {train.at}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const Stops = ({
  line,
  onPick,
  picked,
}: {
  line: TransitLine;
  picked: Stop | null;
  onPick: (stop: Stop) => void;
}) => {
  const { data, error } = useApi<Stop[]>(
    `/api/transport/stops?${new URLSearchParams({ line: line.key })}`
  );

  const [filter, setFilter] = useState("");

  const shown = useMemo(
    () =>
      (data ?? []).filter((stop) =>
        plain(stop.name).includes(plain(filter.trim()))
      ),
    [data, filter]
  );

  if (error) {
    return <PrimProblem error={error} />;
  }

  return (
    <>
      <input
        className="field"
        type="search"
        aria-label={`Find a stop on ${line.title}`}
        placeholder={
          data ? `Find one of ${data.length} stops` : "Loading the stops…"
        }
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
      />
      <div role="group" aria-label="stop" className="stops">
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
        {data && shown.length === 0 ? (
          <p className="hint">No stop by that name.</p>
        ) : null}
      </div>
    </>
  );
};

const NextTrain = ({ lines }: { lines: readonly TransitLine[] }) => {
  const [lineKey, setLineKey] = useState(lines[0]?.key ?? "");
  const [stop, setStop] = useState<Stop | null>(null);
  const line = lines.find((entry) => entry.key === lineKey) ?? lines[0];

  return (
    <AppWindow title="next_train.exe" size="third">
      <div className="step">
        <span className="step__label">1 · Line</span>
        {MODES.map((mode) => (
          <div
            key={mode}
            role="group"
            aria-label={modeName(mode)}
            className="lines"
          >
            <span className="lines__mode">{modeName(mode)}</span>
            {lines
              .filter((entry) => entry.mode === mode)
              .map((entry) => (
                <button
                  key={entry.key}
                  type="button"
                  aria-label={entry.title}
                  aria-pressed={entry.key === line?.key}
                  className={`badge badge--${entry.mode} badge--pick`}
                  style={{ background: entry.colour, color: entry.ink }}
                  onClick={() => {
                    setLineKey(entry.key);
                    setStop(null);
                  }}
                >
                  {shownCode(entry.code)}
                </button>
              ))}
          </div>
        ))}
      </div>
      {line ? (
        <div className="step">
          <span className="step__label">2 · Stop</span>
          <Stops key={line.key} line={line} picked={stop} onPick={setStop} />
        </div>
      ) : null}
      {line && stop ? <Departure line={line} stop={stop} /> : null}
    </AppWindow>
  );
};

const Velib = () => {
  const { data, error } = useApi<VelibReport>("/api/velib", 60_000);
  const [picked, setPicked] = useState<string>();
  const stations = data?.stations ?? [];
  const station = stations.find((entry) => entry.id === picked) ?? stations[0];

  const capacity = station
    ? station.mechanical + station.ebike + station.docks
    : 0;

  const share = (value: number) =>
    `${capacity ? (value / capacity) * 100 : 0}%`;

  return (
    <AppWindow title="velib.map" size="wide">
      {error && !data ? (
        <p className="notice">Vélib' could not be reached just now.</p>
      ) : null}
      <div className="split">
        <LazyMap
          label="Map of Vélib' stations"
          markers={stations.map((entry) => {
            const bikes = entry.mechanical + entry.ebike;

            return {
              id: entry.id,
              lat: entry.lat,
              lon: entry.lon,
              node: (
                <button
                  type="button"
                  aria-pressed={entry.id === station?.id}
                  aria-label={`${entry.name}, ${bikes} bikes`}
                  className={`pin${bikes === 0 ? " pin--empty" : ""}`}
                  onClick={() => setPicked(entry.id)}
                >
                  <Icon name="bike" size={16} />
                  {bikes}
                </button>
              ),
            };
          })}
        />
        <div className="aside">
          {station ? (
            <div className="card">
              <span className="tile__label">station</span>
              <span className="card__name">{station.name}</span>
              <div className="counts">
                <div>
                  Mechanical bikes <strong>{station.mechanical}</strong>
                </div>
                <div>
                  E-bikes <strong>{station.ebike}</strong>
                </div>
                <div>
                  Free docks <strong>{station.docks}</strong>
                </div>
              </div>
              <div aria-hidden="true" className="bar">
                <span style={{ width: share(station.mechanical) }} />
                <span style={{ width: share(station.ebike) }} />
              </div>
              <div className="key">
                <span>
                  <i style={{ background: "var(--moss)" }} />
                  mechanical
                </span>
                <span>
                  <i style={{ background: "var(--focus)" }} />
                  e-bike
                </span>
              </div>
            </div>
          ) : null}
          <p className="window__text window__text--hint">
            Tap a pin to see its bikes and free docks. The number on each pin is
            bikes available now
            {data ? `, as of ${parisTime(new Date(data.updatedAt))}` : ""}.
          </p>
        </div>
      </div>
    </AppWindow>
  );
};

const LABELS = { ok: "normal", warn: "disrupted", works: "works" } as const;

const Traffic = ({ lines }: { lines: readonly TransitLine[] }) => {
  const { data, error } = useApi<TrafficReport>(
    "/api/transport/status",
    2 * 60_000
  );

  const [issuesOnly, setIssuesOnly] = useState(false);
  const statusOf = new Map(data?.lines.map((status) => [status.key, status]));
  const known = lines.filter((line) => statusOf.has(line.key));
  const issues = known.filter((line) => statusOf.get(line.key)?.level !== "ok");
  const shown = issuesOnly ? issues : known;

  return (
    <AppWindow title="traffic_live.feed" size="full">
      <div className="feed__head">
        <p className="window__text">
          {data ? (
            <>
              <strong>{issues.length}</strong>{" "}
              {issues.length === 1 ? "line" : "lines"} with disruptions ·
              updated {parisTime(new Date(data.updatedAt))}
            </>
          ) : (
            "Line status"
          )}
        </p>
        <div
          role="group"
          aria-label="filter"
          className="segmented segmented--fit"
        >
          <button
            type="button"
            aria-pressed={!issuesOnly}
            onClick={() => setIssuesOnly(false)}
          >
            All lines
          </button>
          <button
            type="button"
            aria-pressed={issuesOnly}
            onClick={() => setIssuesOnly(true)}
          >
            Issues only
          </button>
        </div>
      </div>
      {error && !data ? <PrimProblem error={error} /> : null}
      {data ? (
        <div className="feed">
          {shown.map((line) => {
            const status = statusOf.get(line.key);

            return status ? (
              <div key={line.key} className="feed__row">
                <LineBadge line={line} />
                <div className="feed__text">
                  <span className="feed__title">{line.title}</span>
                  <span className="feed__detail">{status.detail}</span>
                </div>
                <span className={`status status--${status.level}`}>
                  {LABELS[status.level]}
                </span>
              </div>
            ) : null;
          })}
          {shown.length === 0 ? (
            <div className="feed__row">
              <span className="feed__detail">No disruptions on any line.</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </AppWindow>
  );
};

/** The next train from any stop of any metro, RER or Transilien line, Vélib', and every line's status. */
export const TransportScreen = () => {
  const { data } = useApi<LinesReport>("/api/transport/lines");
  const lines = data?.lines ?? LINES;

  return (
    <>
      <div className="content__head">
        <h2 className="display page__title">Public transport</h2>
        <p className="page__sub">
          Next trains on every metro, RER and Transilien line, line status and
          Vélib'.
        </p>
      </div>
      <div className="row">
        <NextTrain key={data ? "live" : "static"} lines={lines} />
        <Velib />
      </div>
      <Traffic lines={lines} />
    </>
  );
};
