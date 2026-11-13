import { useState } from "react";

import { AppWindow } from "../components/app-window";
import { LazyMap } from "../components/lazy-map";
import type { MapMarker } from "../components/lazy-map";
import { LocateButton } from "../components/locate-button";
import type { VelibReport } from "../lib/api";
import { parisTime } from "../lib/clock";
import { metresBetween } from "../lib/geo";
import { Icon } from "../lib/icon";
import { useCopy } from "../lib/language";
import { useApi } from "../lib/use-api";
import { useLocation } from "../lib/use-location";

const COPY = {
  en: {
    asOf: (time: string) => `, as of ${time}`,
    bikes: (name: string, n: number) => `${name}, ${n} bikes`,
    docks: "Free docks",
    ebike: "e-bike",
    ebikes: "E-bikes",
    mechanical: "mechanical",
    mechanicalBikes: "Mechanical bikes",
    metres: (n: number) => `${n} m from you`,
    noneNear: "No open Vélib' station within 1 km of you.",
    station: "station",
    sub: "Bikes and free docks around the centre, or at the stations nearest you.",
    tapPin:
      "Tap a pin to see its bikes and free docks. The number on each pin is bikes available now",
    title: "Vélib'",
    velibDown: "Vélib' could not be reached just now.",
    velibMap: "Map of Vélib' stations",
    you: "You are here",
  },
  fr: {
    asOf: (time: string) => `, à ${time}`,
    bikes: (name: string, n: number) => `${name}, ${n} vélos`,
    docks: "Bornes libres",
    ebike: "électrique",
    ebikes: "Vélos électriques",
    mechanical: "mécanique",
    mechanicalBikes: "Vélos mécaniques",
    metres: (n: number) => `à ${n} m de vous`,
    noneNear: "Aucune station Vélib' ouverte à moins d’1 km.",
    station: "station",
    sub: "Les vélos et les bornes libres autour du centre, ou aux stations les plus proches de vous.",
    tapPin:
      "Touchez une épingle pour voir ses vélos et ses bornes libres. Le nombre sur chaque épingle, ce sont les vélos disponibles",
    title: "Vélib'",
    velibDown: "Vélib' ne répond pas pour le moment.",
    velibMap: "Carte des stations Vélib'",
    you: "Vous êtes ici",
  },
};

/** The rider's own pin, among the stations. */
const YOU = "you";

/** Vélib' stations on a map: around the centre, or the nearest the rider once they ask. */
const Velib = () => {
  const { ask, locating } = useLocation();
  const point = locating.state === "found" ? locating.point : null;

  const { data, error } = useApi<VelibReport>(
    point
      ? `/api/velib?${new URLSearchParams({ lat: String(point.lat), lon: String(point.lon) })}`
      : "/api/velib",
    60_000
  );

  const [picked, setPicked] = useState<string>();
  const stations = data?.stations ?? [];
  const station = stations.find((entry) => entry.id === picked) ?? stations[0];
  const t = useCopy(COPY);

  const capacity = station
    ? station.mechanical + station.ebike + station.docks
    : 0;

  const share = (value: number) =>
    `${capacity ? (value / capacity) * 100 : 0}%`;

  const markers: MapMarker[] = stations.map((entry) => {
    const bikes = entry.mechanical + entry.ebike;

    return {
      id: entry.id,
      lat: entry.lat,
      lon: entry.lon,
      node: (
        <button
          type="button"
          aria-pressed={entry.id === station?.id}
          aria-label={t.bikes(entry.name, bikes)}
          className={`pin${bikes === 0 ? " pin--empty" : ""}`}
          onClick={() => setPicked(entry.id)}
        >
          <Icon name="bike" size={16} />
          {bikes}
        </button>
      ),
    };
  });

  if (point) {
    markers.push({
      id: YOU,
      lat: point.lat,
      lon: point.lon,
      node: (
        <span role="img" aria-label={t.you} className="pin pin--you">
          <Icon name="pin" size={16} />
        </span>
      ),
    });
  }

  return (
    <AppWindow title="velib.map" size="full">
      <LocateButton locating={locating} onPress={ask} />
      {error && !data ? <p className="notice">{t.velibDown}</p> : null}
      {point && data && stations.length === 0 ? (
        <p className="notice">{t.noneNear}</p>
      ) : null}
      <div className="split">
        <LazyMap
          label={t.velibMap}
          markers={markers}
          focus={picked}
          frame={point ? `${point.lat},${point.lon}` : "centre"}
        />
        <div className="aside">
          {station ? (
            <div className="card">
              <span className="tile__label">{t.station}</span>
              <span className="card__name">{station.name}</span>
              {point ? (
                <span className="hint">
                  {t.metres(Math.round(metresBetween(point, station)))}
                </span>
              ) : null}
              <div className="counts">
                <div>
                  {t.mechanicalBikes} <strong>{station.mechanical}</strong>
                </div>
                <div>
                  {t.ebikes} <strong>{station.ebike}</strong>
                </div>
                <div>
                  {t.docks} <strong>{station.docks}</strong>
                </div>
              </div>
              <div aria-hidden="true" className="bar">
                <span style={{ width: share(station.mechanical) }} />
                <span style={{ width: share(station.ebike) }} />
              </div>
              <div className="key">
                <span>
                  <i style={{ background: "var(--moss)" }} />
                  {t.mechanical}
                </span>
                <span>
                  <i style={{ background: "var(--focus)" }} />
                  {t.ebike}
                </span>
              </div>
            </div>
          ) : null}
          <p className="window__text window__text--hint">
            {t.tapPin}
            {data ? t.asOf(parisTime(new Date(data.updatedAt))) : ""}.
          </p>
        </div>
      </div>
    </AppWindow>
  );
};

/** Vélib' bikes and docks, around the centre or near the rider. */
export const VelibScreen = () => {
  const t = useCopy(COPY);

  return (
    <>
      <div className="content__head">
        <h2 className="display page__title">{t.title}</h2>
        <p className="page__sub">{t.sub}</p>
      </div>
      <Velib />
    </>
  );
};
