import { useEffect, useState } from "react";

import { AppWindow } from "../components/app-window";
import { LocateButton } from "../components/locate-button";
import { DirectionFlow, PrimProblem } from "../components/transit";
import type { BusLine, NearbyStop } from "../lib/api";
import { useCopy } from "../lib/language";
import { useApi } from "../lib/use-api";
import { useLocation } from "../lib/use-location";

const COPY = {
  en: {
    bus: (code: string) => `Bus ${code}`,
    busNetwork: (code: string, network: string) =>
      network ? `Bus ${code}, ${network}` : `Bus ${code}`,
    find: "1 · Line",
    metres: (n: number) => `${n} m away`,
    min: "min",
    nearHint:
      "Press “near me” to see the bus stops around you and what leaves each one next.",
    noBus: "No bus line with that number.",
    noBusesNear: "No bus stop within 500 m of you.",
    nothing: "Nothing announced here right now.",
    search: "Bus number, like 72 or N01",
    sub: "Any bus in Île-de-France: the stops around you, or a line by its number.",
    title: "Buses",
    towards: (name: string) => `→ ${name}`,
  },
  fr: {
    bus: (code: string) => `Bus ${code}`,
    busNetwork: (code: string, network: string) =>
      network ? `Bus ${code}, ${network}` : `Bus ${code}`,
    find: "1 · Ligne",
    metres: (n: number) => `à ${n} m`,
    min: "min",
    nearHint:
      "Appuyez sur « près de moi » pour voir les arrêts de bus autour de vous et les prochains départs de chacun.",
    noBus: "Aucune ligne de bus avec ce numéro.",
    noBusesNear: "Aucun arrêt de bus à moins de 500 m.",
    nothing: "Rien d’annoncé ici pour le moment.",
    search: "Numéro de bus, comme 72 ou N01",
    sub: "Tous les bus d’Île-de-France : les arrêts autour de vous, ou une ligne par son numéro.",
    title: "Bus",
    towards: (name: string) => `→ ${name}`,
  },
};

/** A bus line as the network draws it: its number on its colour. */
const BusBadge = ({
  code,
  colour,
  ink,
  label,
}: {
  code: string;
  colour: string;
  ink: string;
  label?: string;
}) => (
  <span
    role={label ? "img" : undefined}
    aria-label={label}
    className="badge badge--bus"
    style={{ background: colour, color: ink }}
  >
    {code}
  </span>
);

/** The bus stops nearest the rider, each with what leaves it soonest. */
const NearMe = () => {
  const { ask, locating } = useLocation();
  const t = useCopy(COPY);
  const point = locating.state === "found" ? locating.point : null;

  const { data, error } = useApi<NearbyStop[]>(
    point
      ? `/api/transport/near?${new URLSearchParams({ lat: String(point.lat), lon: String(point.lon) })}`
      : null,
    30_000
  );

  return (
    <AppWindow title="buses_near_me.app" size="full">
      <LocateButton locating={locating} onPress={ask} />
      {point ? null : <p className="hint">{t.nearHint}</p>}
      {error ? <PrimProblem error={error} /> : null}
      {data && data.length === 0 ? (
        <p className="notice">{t.noBusesNear}</p>
      ) : null}
      <div className="nearby">
        {data?.map((stop) => (
          <div key={stop.id} className="result">
            <div className="result__head">
              <span className="result__stop">{stop.name}</span>
              <span className="hint">{t.metres(stop.distance)}</span>
            </div>
            {stop.departures.length === 0 ? (
              <p className="hint">{t.nothing}</p>
            ) : null}
            <ul className="nearby__list">
              {stop.departures.map((departure) => (
                <li
                  key={`${departure.line.code}|${departure.towards}`}
                  className="nearby__row"
                >
                  <BusBadge
                    {...departure.line}
                    label={t.bus(departure.line.code)}
                  />
                  <span className="nearby__towards">
                    {t.towards(departure.towards)}
                  </span>
                  <span className="nearby__minutes">
                    {departure.minutes.join(" · ")} {t.min}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </AppWindow>
  );
};

/** How long typing pauses before the server is asked. */
const TYPING_MS = 300;

/** Any bus line by its number, then its direction and stop. */
const FindBus = () => {
  const [typed, setTyped] = useState("");
  const [query, setQuery] = useState("");
  const [bus, setBus] = useState<BusLine | null>(null);
  const t = useCopy(COPY);

  useEffect(() => {
    const timer = setTimeout(
      () => setQuery(typed.trim().toUpperCase()),
      TYPING_MS
    );

    return () => clearTimeout(timer);
  }, [typed]);

  const found = useApi<BusLine[]>(
    /^[0-9A-Z]{1,6}$/u.test(query)
      ? `/api/transport/buses?${new URLSearchParams({ q: query })}`
      : null
  );

  return (
    <AppWindow title="find_a_bus.exe" size="full">
      <div className="step">
        <label className="step__label" htmlFor="bus-number">
          {t.find}
        </label>
        <input
          id="bus-number"
          className="field"
          type="search"
          inputMode="text"
          autoComplete="off"
          placeholder={t.search}
          value={typed}
          onChange={(event) => {
            setTyped(event.target.value);
            setBus(null);
          }}
        />
        {found.error ? <PrimProblem error={found.error} /> : null}
        {found.data && found.data.length === 0 ? (
          <p className="hint">{t.noBus}</p>
        ) : null}
        <div className="choices">
          {(bus ? [bus] : (found.data ?? []).slice(0, 12)).map((entry) => (
            <button
              key={entry.id}
              type="button"
              className="choice choice--bus"
              aria-pressed={entry.id === bus?.id}
              aria-label={t.busNetwork(entry.code, entry.network)}
              onClick={() => setBus(entry.id === bus?.id ? null : entry)}
            >
              <BusBadge {...entry} />
              <span>{entry.network}</span>
            </button>
          ))}
        </div>
      </div>
      {bus ? (
        <DirectionFlow
          key={bus.id}
          line={{
            badge: <BusBadge {...bus} label={t.bus(bus.code)} />,
            colour: bus.colour,
            query: bus.id,
            title: t.bus(bus.code),
          }}
        />
      ) : null}
    </AppWindow>
  );
};

/** Every bus in Île-de-France: what leaves the stops near the rider, or any line's next buses. */
export const BusesScreen = () => {
  const t = useCopy(COPY);

  return (
    <>
      <div className="content__head">
        <h2 className="display page__title">{t.title}</h2>
        <p className="page__sub">{t.sub}</p>
      </div>
      <NearMe />
      <FindBus />
    </>
  );
};
