import { useState } from "react";

import { AppWindow } from "../components/app-window";
import { LazyMap } from "../components/lazy-map";
import type { RegionReport, TownNow } from "../lib/api";
import { useCopy, useLanguage } from "../lib/language";
import type { Language } from "../lib/language";
import {
  LAYERS,
  POLLEN_NAMES,
  SCALES,
  bandLabel,
  bandOf,
  scaleName,
  shown,
} from "../lib/region-scales";
import type { Layer } from "../lib/region-scales";
import { useApi } from "../lib/use-api";
import { aqiLevel, compassOf } from "../lib/weather";

const FIFTEEN_MINUTES = 15 * 60_000;

const COPY = {
  en: {
    air: "Air pollution",
    airCol: "Air (AQI)",
    asOf: (time: string) => `Open-Meteo, as of ${time}`,
    failed: "The region's weather could not be loaded just now.",
    humidity: "Humidity",
    map: (layer: string) => `Map of Île-de-France: ${layer} by town`,
    none: "none",
    pollen: "Pollen",
    pollenOf: (grains: number, kind: string) =>
      `${grains} grains/m³, mostly ${kind}`,
    showOn: "show on the map",
    sub: "Pollen, air pollution, humidity, temperature and wind, town by town.",
    table: "Show as a table",
    temperature: "Temperature",
    town: "town",
    townCol: "Town",
    wind: "Wind",
    windFrom: (kmh: number, from: string) => `${kmh} km/h from ${from}`,
  },
  fr: {
    air: "Pollution de l’air",
    airCol: "Air (indice)",
    asOf: (time: string) => `Open-Meteo, à ${time}`,
    failed: "La météo de la région n’a pas pu être chargée pour le moment.",
    humidity: "Humidité",
    map: (layer: string) => `Carte de l’Île-de-France : ${layer} par ville`,
    none: "aucun",
    pollen: "Pollen",
    pollenOf: (grains: number, kind: string) =>
      `${grains} grains/m³, surtout ${kind}`,
    showOn: "afficher sur la carte",
    sub: "Pollen, pollution de l’air, humidité, température et vent, ville par ville.",
    table: "Afficher en tableau",
    temperature: "Température",
    town: "ville",
    townCol: "Ville",
    wind: "Vent",
    windFrom: (kmh: number, from: string) => `${kmh} km/h, provenance ${from}`,
  },
};

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

const pollenOf = (town: TownNow, language: Language) => {
  const t = COPY[language];

  return town.pollen && town.pollen.grains > 0
    ? t.pollenOf(town.pollen.grains, POLLEN_NAMES[language][town.pollen.kind])
    : t.none;
};

const TownCard = ({ town }: { town: TownNow }) => {
  const language = useLanguage();
  const t = COPY[language];

  return (
    <div className="card">
      <span className="tile__label">{t.town}</span>
      <span className="card__name">{town.name}</span>
      <dl className="readings">
        <div>
          <dt>{t.temperature}</dt>
          <dd>{town.temp}°</dd>
        </div>
        <div>
          <dt>{t.humidity}</dt>
          <dd>{town.humidity}%</dd>
        </div>
        <div>
          <dt>{t.wind}</dt>
          <dd>
            {t.windFrom(town.windKmh, compassOf(town.windFrom, language))}
          </dd>
        </div>
        <div>
          <dt>{t.air}</dt>
          <dd>
            {town.aqi === null
              ? "–"
              : `${town.aqi} AQI, ${aqiLevel(town.aqi, language).label}`}
          </dd>
        </div>
        <div>
          <dt>{t.pollen}</dt>
          <dd>{town.pollen ? pollenOf(town, language) : "–"}</dd>
        </div>
      </dl>
    </div>
  );
};

const Legend = ({ layer }: { layer: Layer }) => {
  const language = useLanguage();

  return (
    <div className="legend-key">
      <span className="tile__label">{scaleName(layer, language)}</span>
      <ul>
        {SCALES[layer].bands.map((entry) => (
          <li key={entry.label}>
            <span
              aria-hidden="true"
              className="swatch"
              style={{ background: entry.colour }}
            />
            {bandLabel(layer, entry, language)}
          </li>
        ))}
      </ul>
    </div>
  );
};

/** Every town and every value, for reading without the map. */
const Table = ({ towns }: { towns: readonly TownNow[] }) => {
  const language = useLanguage();
  const t = COPY[language];

  return (
    <details className="table-view">
      <summary>{t.table}</summary>
      <div className="table-view__scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">{t.townCol}</th>
              <th scope="col">{t.temperature}</th>
              <th scope="col">{t.humidity}</th>
              <th scope="col">{t.wind}</th>
              <th scope="col">{t.airCol}</th>
              <th scope="col">{t.pollen}</th>
            </tr>
          </thead>
          <tbody>
            {towns.map((town) => (
              <tr key={town.name}>
                <th scope="row">{town.name}</th>
                <td>{town.temp}°</td>
                <td>{town.humidity}%</td>
                <td>
                  {town.windKmh} km/h {compassOf(town.windFrom, language)}
                </td>
                <td>{town.aqi ?? "–"}</td>
                <td>{town.pollen ? pollenOf(town, language) : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
};

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
  const language = useLanguage();
  const t = useCopy(COPY);

  return (
    <>
      <div className="content__head">
        <h2 className="display page__title">Île-de-France</h2>
        <p className="page__sub">{t.sub}</p>
      </div>
      <AppWindow title="idf_now.map" size="full">
        <div className="feed__head">
          <div
            role="group"
            aria-label={t.showOn}
            className="segmented segmented--fit segmented--wrap"
          >
            {LAYERS.map((entry) => (
              <button
                key={entry}
                type="button"
                aria-pressed={entry === layer}
                onClick={() => setLayer(entry)}
              >
                {scaleName(entry, language).toLowerCase()}
              </button>
            ))}
          </div>
          {data ? (
            <p className="window__text window__text--hint">
              {t.asOf(data.updatedAt.slice(11, 16))}
            </p>
          ) : null}
        </div>
        {error && !data ? <p className="notice">{t.failed}</p> : null}
        <div className="split">
          <LazyMap
            file="idf"
            label={t.map(scaleName(layer, language).toLowerCase())}
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
