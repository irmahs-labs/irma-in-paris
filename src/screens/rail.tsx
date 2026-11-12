import { useState } from "react";

import { AppWindow } from "../components/app-window";
import { LineBadge } from "../components/line-badge";
import { DirectionFlow, PrimProblem, TripFlow } from "../components/transit";
import type { LineRef } from "../components/transit";
import { LINES, MODES, lineTitle, modeName, shownCode } from "../data/lines";
import type { TransitLine } from "../data/lines";
import type { LinesReport, TrafficReport } from "../lib/api";
import { parisTime } from "../lib/clock";
import type { Language } from "../lib/language";
import { useCopy, useLanguage } from "../lib/language";
import { useApi } from "../lib/use-api";

const COPY = {
  en: {
    issues: (n: number) => `${n === 1 ? "line" : "lines"} with disruptions`,
    levels: { ok: "normal", warn: "disrupted", works: "works" },
    line: "1 · Line",
    lineStatus: "Line status",
    noDisruptions: "No disruptions on any metro, RER, tram or Transilien line.",
    pickLine: "Pick a line to see its next trains.",
    sub: "The next trains on every metro, RER, tram and Transilien line, and the lines that are disrupted.",
    title: "Rail",
    updated: (time: string) => `updated ${time}`,
  },
  fr: {
    issues: (n: number) => (n > 1 ? "lignes perturbées" : "ligne perturbée"),
    levels: { ok: "normal", warn: "perturbé", works: "travaux" },
    line: "1 · Ligne",
    lineStatus: "État des lignes",
    noDisruptions:
      "Aucune perturbation sur les lignes de métro, RER, tram et Transilien.",
    pickLine: "Choisissez une ligne pour voir ses prochains trains.",
    sub: "Les prochains trains sur toutes les lignes de métro, RER, tram et Transilien, et les lignes perturbées.",
    title: "Rail",
    updated: (time: string) => `mis à jour à ${time}`,
  },
};

const refOf = (line: TransitLine, language: Language): LineRef => ({
  badge: <LineBadge line={line} />,
  colour: line.colour,
  query: line.key,
  title: lineTitle(line, language),
});

/**
 * Pick a line, then: on the metro and the tram, its direction and the
 * stop; on the RER and Transilien, where you are going and where you
 * leave from, since not every train calls everywhere on their branches.
 */
const NextTrain = ({ lines }: { lines: readonly TransitLine[] }) => {
  const [lineKey, setLineKey] = useState<string>();
  const line = lines.find((entry) => entry.key === lineKey);
  const language = useLanguage();
  const t = COPY[language];
  const byTrip = line?.mode === "rer" || line?.mode === "transilien";

  return (
    <AppWindow title="next_train.exe" size="full">
      <div className="step">
        <span className="step__label">{t.line}</span>
        {MODES.map((mode) => (
          <div
            key={mode}
            role="group"
            aria-label={modeName(mode, language)}
            className="lines"
          >
            <span className="lines__mode">{modeName(mode, language)}</span>
            {lines
              .filter((entry) => entry.mode === mode)
              .map((entry) => (
                <button
                  key={entry.key}
                  type="button"
                  aria-label={lineTitle(entry, language)}
                  aria-pressed={entry.key === line?.key}
                  className={`badge badge--${entry.mode} badge--pick`}
                  style={{ background: entry.colour, color: entry.ink }}
                  onClick={() => setLineKey(entry.key)}
                >
                  {shownCode(entry.code)}
                </button>
              ))}
          </div>
        ))}
      </div>
      {line ? null : <p className="hint">{t.pickLine}</p>}
      {line && byTrip ? (
        <TripFlow key={line.key} line={refOf(line, language)} />
      ) : null}
      {line && !byTrip ? (
        <DirectionFlow key={line.key} line={refOf(line, language)} />
      ) : null}
    </AppWindow>
  );
};

/** The lines with something wrong right now, or works starting within the day: only those. */
const Traffic = ({ lines }: { lines: readonly TransitLine[] }) => {
  const { data, error } = useApi<TrafficReport>(
    "/api/transport/status",
    2 * 60_000
  );

  const language = useLanguage();
  const t = COPY[language];
  const statusOf = new Map(data?.lines.map((status) => [status.key, status]));

  const issues = lines.filter((line) => {
    const level = statusOf.get(line.key)?.level;

    return level !== undefined && level !== "ok";
  });

  return (
    <AppWindow title="traffic_live.feed" size="full">
      <p className="window__text">
        {data ? (
          <>
            <strong>{issues.length}</strong> {t.issues(issues.length)} ·{" "}
            {t.updated(parisTime(new Date(data.updatedAt)))}
          </>
        ) : (
          t.lineStatus
        )}
      </p>
      {error && !data ? <PrimProblem error={error} /> : null}
      {data ? (
        <div className="feed">
          {issues.map((line) => {
            const status = statusOf.get(line.key);

            return status ? (
              <div key={line.key} className="feed__row">
                <LineBadge line={line} />
                <div className="feed__text">
                  <span className="feed__title">
                    {lineTitle(line, language)}
                  </span>
                  <span className="feed__detail">
                    {status.detail[language]}
                  </span>
                </div>
                <span className={`status status--${status.level}`}>
                  {t.levels[status.level]}
                </span>
              </div>
            ) : null;
          })}
          {issues.length === 0 ? (
            <div className="feed__row">
              <span className="feed__detail">{t.noDisruptions}</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </AppWindow>
  );
};

/** The next train from any stop of any metro, RER, tram or Transilien line, and the lines in trouble. */
export const RailScreen = () => {
  const { data } = useApi<LinesReport>("/api/transport/lines");
  const lines = data?.lines ?? LINES;
  const t = useCopy(COPY);

  return (
    <>
      <div className="content__head">
        <h2 className="display page__title">{t.title}</h2>
        <p className="page__sub">{t.sub}</p>
      </div>
      <NextTrain key={data ? "live" : "static"} lines={lines} />
      <Traffic lines={lines} />
    </>
  );
};
