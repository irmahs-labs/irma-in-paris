import { useState } from "react";

import { AppWindow } from "../components/app-window";
import { LazyMap } from "../components/lazy-map";
import type { RegionReport, TownNow } from "../lib/api";
import { LAYERS, SCALES, bandOf, shown } from "../lib/region-scales";
import type { Layer } from "../lib/region-scales";
import { useApi } from "../lib/use-api";
import { aqiLevel, compassOf } from "../lib/weather";

const FIFTEEN_MINUTES = 15 * 60_000;

/** Which way the wind blows to, as an arrow: it comes from `from`, so it points the other way. */
const WindArrow = ({ from }: { from: number }) => (
  <svg
    aria-hidden="true"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ transform: `rotate(${from + 180}deg)` }}
  >
    <path d="M12 20V4M6 10l6-6 6 6" />
  </svg>
);

/** A value's colour: a swatch with the dark outline, so it reads on either map. */
const Swatch = ({ layer, town }: { layer: Layer; town: TownNow }) => {
  const value = SCALES[layer].value(town);

  return (
    <span
      aria-hidden="true"
      className="swatch"
      style={{
        background:
          value === null ? "transparent" : bandOf(layer, value).colour,
      }}
    />
  );
};

const pollenOf = (town: TownNow) =>
  town.pollen && town.pollen.grains > 0
    ? `${town.pollen.grains} grains/m³, mostly ${town.pollen.kind}`
    : "none";

const TownCard = ({ town }: { town: TownNow }) => (
  <div className="card">
    <span className="tile__label">town</span>
    <span className="card__name">{town.name}</span>
    <dl className="readings">
      <div>
        <dt>Temperature</dt>
        <dd>{town.temp}°</dd>
      </div>
      <div>
        <dt>Humidity</dt>
        <dd>{town.humidity}%</dd>
      </div>
      <div>
        <dt>Wind</dt>
        <dd>
          {town.windKmh} km/h from {compassOf(town.windFrom)}
        </dd>
      </div>
      <div>
        <dt>Air pollution</dt>
        <dd>
          {town.aqi === null
            ? "–"
            : `${town.aqi} AQI, ${aqiLevel(town.aqi).label}`}
        </dd>
      </div>
      <div>
        <dt>Pollen</dt>
        <dd>{town.pollen ? pollenOf(town) : "–"}</dd>
      </div>
    </dl>
  </div>
);

const Legend = ({ layer }: { layer: Layer }) => (
  <div className="legend-key">
    <span className="tile__label">{SCALES[layer].name}</span>
    <ul>
      {SCALES[layer].bands.map((entry) => (
        <li key={entry.label}>
          <span
            aria-hidden="true"
            className="swatch"
            style={{ background: entry.colour }}
          />
          {entry.label}
        </li>
      ))}
    </ul>
  </div>
);

/** Every town and every value, for reading without the map. */
const Table = ({ towns }: { towns: readonly TownNow[] }) => (
  <details className="table-view">
    <summary>Show as a table</summary>
    <div className="table-view__scroll">
      <table>
        <thead>
          <tr>
            <th scope="col">Town</th>
            <th scope="col">Temperature</th>
            <th scope="col">Humidity</th>
            <th scope="col">Wind</th>
            <th scope="col">Air (AQI)</th>
            <th scope="col">Pollen</th>
          </tr>
        </thead>
        <tbody>
          {towns.map((town) => (
            <tr key={town.name}>
              <th scope="row">{town.name}</th>
              <td>{town.temp}°</td>
              <td>{town.humidity}%</td>
              <td>
                {town.windKmh} km/h {compassOf(town.windFrom)}
              </td>
              <td>{town.aqi ?? "–"}</td>
              <td>{town.pollen ? pollenOf(town) : "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </details>
);

/**
 * Île-de-France now, town by town: pollen, air pollution, humidity,
 * temperature or wind, one at a time, on a map of the region.
 */
export const RegionScreen = () => {
  const { data, error } = useApi<RegionReport>("/api/region", FIFTEEN_MINUTES);
  const [layer, setLayer] = useState<Layer>("temperature");
  const [picked, setPicked] = useState<string>();
  const towns = data?.towns ?? [];
  const town = towns.find((entry) => entry.name === picked) ?? towns[0];

  return (
    <>
      <div className="content__head">
        <h2 className="display page__title">Île-de-France</h2>
        <p className="page__sub">
          Pollen, air pollution, humidity, temperature and wind, town by town.
        </p>
      </div>
      <AppWindow title="idf_now.map" size="full">
        <div className="feed__head">
          <div
            role="group"
            aria-label="show on the map"
            className="segmented segmented--fit segmented--wrap"
          >
            {LAYERS.map((entry) => (
              <button
                key={entry}
                type="button"
                aria-pressed={entry === layer}
                onClick={() => setLayer(entry)}
              >
                {SCALES[entry].name.toLowerCase()}
              </button>
            ))}
          </div>
          {data ? (
            <p className="window__text window__text--hint">
              Open-Meteo, as of {data.updatedAt.slice(11, 16)}
            </p>
          ) : null}
        </div>
        {error && !data ? (
          <p className="notice">
            The region's weather could not be loaded just now.
          </p>
        ) : null}
        <div className="split">
          <LazyMap
            file="idf"
            label={`Map of Île-de-France: ${SCALES[layer].name.toLowerCase()} by town`}
            focus={picked}
            markers={towns.map((entry) => ({
              id: entry.name,
              lat: entry.lat,
              lon: entry.lon,
              node: (
                <button
                  type="button"
                  aria-pressed={entry.name === town?.name}
                  aria-label={`${entry.name}: ${shown(layer, entry)}`}
                  className="pin pin--reading"
                  onClick={() => setPicked(entry.name)}
                >
                  <Swatch layer={layer} town={entry} />
                  {layer === "wind" ? (
                    <WindArrow from={entry.windFrom} />
                  ) : null}
                  {shown(layer, entry)
                    .replace(" grains/m³", "")
                    .replace(" AQI", "")
                    .replace(" km/h", "")}
                </button>
              ),
            }))}
          />
          <div className="aside">
            {town ? <TownCard town={town} /> : null}
            <Legend layer={layer} />
          </div>
        </div>
        {towns.length > 0 ? <Table towns={towns} /> : null}
      </AppWindow>
    </>
  );
};
