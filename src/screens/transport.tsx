import { useState } from "react";

import { AppWindow } from "../components/app-window";
import { LineBadge } from "../components/line-badge";
import { ParisMap, pinStyle } from "../components/paris-map";
import {
  FEED_LINES,
  METRO_LINES,
  boardableStops,
  terminusOf,
} from "../data/lines";
import type { Direction } from "../data/lines";
import type { Departures, TrafficReport, VelibReport } from "../lib/api";
import { parisTime } from "../lib/clock";
import { Icon } from "../lib/icon";
import { CENTRAL_PARIS } from "../lib/map";
import { useApi } from "../lib/use-api";

const NO_KEY = "no-prim-key";

const PrimProblem = ({ error }: { error: string }) => (
  <p className="notice">
    {error === NO_KEY
      ? "Live times are off: the server has no PRIM key yet."
      : "PRIM could not be reached just now. It will try again shortly."}
  </p>
);

const NextMetro = () => {
  const [lineId, setLineId] = useState("1");
  const [direction, setDirection] = useState<Direction>(0);
  const [stopIndex, setStopIndex] = useState(0);

  const line =
    METRO_LINES.find((entry) => entry.id === lineId) ?? METRO_LINES[0];

  const stops = boardableStops(line, direction);
  const stop = stops[Math.min(stopIndex, stops.length - 1)] ?? "";

  const query = new URLSearchParams({
    dir: String(direction),
    line: line.id,
    stop,
  });

  const { data, error } = useApi<Departures>(
    `/api/transport/departures?${query}`,
    30_000
  );

  return (
    <AppWindow title="next_metro.exe" size="third">
      <div className="step">
        <span className="step__label">1 · Line</span>
        <div role="group" aria-label="metro line" className="lines">
          {METRO_LINES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              aria-label={`Line ${entry.id}`}
              aria-pressed={entry.id === line.id}
              className="badge badge--metro badge--pick"
              style={{ background: entry.colour, color: entry.ink }}
              onClick={() => {
                setLineId(entry.id);
                setDirection(0);
                setStopIndex(0);
              }}
            >
              {entry.id}
            </button>
          ))}
        </div>
      </div>
      <div className="step">
        <span className="step__label">2 · Direction</span>
        <div role="group" aria-label="direction" className="segmented">
          {([0, 1] as const).map((way) => (
            <button
              key={way}
              type="button"
              aria-pressed={way === direction}
              onClick={() => {
                setDirection(way);
                setStopIndex(0);
              }}
            >
              → {terminusOf(line, way)}
            </button>
          ))}
        </div>
      </div>
      <div className="step">
        <span className="step__label">3 · Stop</span>
        <div role="group" aria-label="stop" className="stops">
          {stops.map((name, i) => (
            <button
              key={name}
              type="button"
              aria-pressed={name === stop}
              className="stop"
              onClick={() => setStopIndex(i)}
            >
              <span
                aria-hidden="true"
                className="stop__dot"
                style={name === stop ? { background: line.colour } : undefined}
              />
              {name}
            </button>
          ))}
        </div>
      </div>
      <div className="result" aria-live="polite">
        <div className="result__head">
          <span
            aria-hidden="true"
            className="badge badge--metro badge--big"
            style={{ background: line.colour, color: line.ink }}
          >
            {line.id}
          </span>
          <div className="stack">
            <span className="result__stop">{stop}</span>
            <span className="tile__note">
              towards {terminusOf(line, direction)}
            </span>
          </div>
        </div>
        {error ? <PrimProblem error={error} /> : null}
        {data && data.trains.length > 0 ? (
          <div className="trains">
            {data.trains.map((train) => (
              <div key={`${train.at}-${train.minutes}`} className="train">
                <span className="train__min">{train.minutes}</span>
                <span className="train__at">min · {train.at}</span>
              </div>
            ))}
          </div>
        ) : null}
        {data && data.trains.length === 0 ? (
          <p className="notice">No trains announced from here right now.</p>
        ) : null}
      </div>
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
        <ParisMap box={CENTRAL_PARIS} minHeight={380}>
          {stations.map((entry) => {
            const bikes = entry.mechanical + entry.ebike;

            return (
              <button
                key={entry.id}
                type="button"
                aria-pressed={entry.id === station?.id}
                aria-label={`${entry.name}, ${bikes} bikes`}
                className={`pin${bikes === 0 ? " pin--empty" : ""}`}
                style={pinStyle(CENTRAL_PARIS, entry.lat, entry.lon)}
                onClick={() => setPicked(entry.id)}
              >
                <Icon name="bike" size={16} />
                {bikes}
              </button>
            );
          })}
        </ParisMap>
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
          <p className="window__text">
            Tap a pin to see its bikes and free docks. The number on each pin is
            bikes available now
            {data ? `, as of ${parisTime(new Date(data.updatedAt))}` : ""}.
          </p>
        </div>
      </div>
    </AppWindow>
  );
};

const Traffic = () => {
  const { data, error } = useApi<TrafficReport>(
    "/api/transport/status",
    2 * 60_000
  );

  const [issuesOnly, setIssuesOnly] = useState(false);
  const statusOf = new Map(data?.lines.map((line) => [line.id, line]));
  const known = FEED_LINES.filter((line) => statusOf.has(line.id));
  const issues = known.filter((line) => statusOf.get(line.id)?.level !== "ok");
  const shown = issuesOnly ? issues : known;
  const labels = { ok: "normal", warn: "disrupted", works: "works" } as const;

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
            const status = statusOf.get(line.id);

            return status ? (
              <div key={line.id} className="feed__row">
                <LineBadge line={line} />
                <div className="feed__text">
                  <span className="feed__title">{line.title}</span>
                  <span className="feed__detail">{status.detail}</span>
                </div>
                <span className={`status status--${status.level}`}>
                  {labels[status.level]}
                </span>
              </div>
            ) : null;
          })}
          {shown.length === 0 ? (
            <div className="feed__row">
              <span className="feed__detail">
                No disruptions on these lines.
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
    </AppWindow>
  );
};

/** The next metro from any stop, Vélib' around the centre, and the lines' status. */
export const TransportScreen = () => (
  <>
    <div className="content__head">
      <h2 className="display page__title">Public transport</h2>
      <p className="page__sub">Next trains, line status and Vélib' stations.</p>
    </div>
    <div className="row">
      <NextMetro />
      <Velib />
    </div>
    <Traffic />
  </>
);
