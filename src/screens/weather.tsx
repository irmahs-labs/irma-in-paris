import { AppWindow } from "../components/app-window";
import { SkyIcon } from "../components/sky-icon";
import type { WeatherReport } from "../lib/api";
import { minutesOf, parisMinutes, useNow } from "../lib/clock";
import { useCopy, useLanguage } from "../lib/language";
import { useApi } from "../lib/use-api";
import {
  AQI_STEPS,
  UV_STEPS,
  aqiLevel,
  compassOf,
  compassWordOf,
  dayOf,
  durationOf,
  sunAt,
  uvLevel,
} from "../lib/weather";

const TEN_MINUTES = 10 * 60_000;

const COPY = {
  en: {
    airQuality: "air quality",
    dayLength: "Day length",
    dewPoint: (n: number) => `Dew point ${n}°`,
    east: "east",
    european: "European AQI",
    feelsLike: (n: number) => `Feels like ${n}°`,
    from: "From",
    gusts: (n: number) => `gusts ${n} km/h`,
    hiLo: (hi: number, lo: number) => ` · H ${hi}° L ${lo}°`,
    humidity: "humidity",
    notAvailable: "Not available right now",
    problem:
      "The weather could not be loaded just now. It will try again in a few minutes.",
    rainUv: (rain: number, uv: number) => `rain ${rain}% · UV ${uv}`,
    sub: "Right now in Paris, and the week ahead.",
    sun: (status: string) => `The sun: ${status}`,
    sunrise: "sunrise",
    sunset: "sunset",
    title: "Weather",
    today: "Today",
    uvIndex: "uv index",
    west: "west",
    wind: "wind",
  },
  fr: {
    airQuality: "qualité de l’air",
    dayLength: "Durée du jour",
    dewPoint: (n: number) => `Point de rosée ${n}°`,
    east: "est",
    european: "Indice européen",
    feelsLike: (n: number) => `Ressenti ${n}°`,
    from: "Provenance",
    gusts: (n: number) => `rafales ${n} km/h`,
    hiLo: (hi: number, lo: number) => ` · max ${hi}° min ${lo}°`,
    humidity: "humidité",
    notAvailable: "Indisponible pour le moment",
    problem:
      "La météo n’a pas pu être chargée. Nouvel essai dans quelques minutes.",
    rainUv: (rain: number, uv: number) => `pluie ${rain} % · UV ${uv}`,
    sub: "Paris en ce moment, et la semaine à venir.",
    sun: (status: string) => `Le soleil : ${status}`,
    sunrise: "lever",
    sunset: "coucher",
    title: "Météo",
    today: "Auj.",
    uvIndex: "indice uv",
    west: "ouest",
    wind: "vent",
  },
};

const Scale = ({ steps, on }: { steps: string[]; on: number }) => (
  <div aria-hidden="true" className="scale">
    {steps.map((colour, step) => (
      <span key={colour} data-on={step === on} style={{ background: colour }} />
    ))}
  </div>
);

const Now = ({ report }: { report: WeatherReport }) => {
  const { now } = report;
  const [today] = report.days;
  const language = useLanguage();
  const t = COPY[language];
  const uv = uvLevel(now.uv, language);
  const aqi = now.aqi === null ? null : aqiLevel(now.aqi, language);

  return (
    <div className="now">
      <div className="now__main">
        <SkyIcon sky={now.sky} size={84} label={now.label[language]} />
        <div className="stack">
          <span className="now__temp">{now.temp}°</span>
          <span className="now__label">{now.label[language]}</span>
          <span className="now__more">
            {t.feelsLike(now.feelsLike)}
            {today ? t.hiLo(today.hi, today.lo) : ""}
          </span>
        </div>
      </div>
      <div className="tiles">
        <div className="tile">
          <span className="tile__label">{t.uvIndex}</span>
          <span className="tile__value">
            {now.uv} <small>{uv.label}</small>
          </span>
          <Scale steps={UV_STEPS} on={uv.step} />
          <span className="tile__note">{uv.advice}</span>
        </div>
        <div className="tile">
          <span className="tile__label">{t.wind}</span>
          <span className="tile__value">
            {now.windKmh} <small>km/h</small>
          </span>
          <span className="tile__note">
            {t.from}{" "}
            <abbr title={compassWordOf(now.windFrom, language)}>
              {compassOf(now.windFrom, language)}
            </abbr>{" "}
            · {t.gusts(now.gustsKmh)}
          </span>
        </div>
        <div className="tile">
          <span className="tile__label">{t.humidity}</span>
          <span className="tile__value">
            {now.humidity}
            <small>%</small>
          </span>
          <div aria-hidden="true" className="meter">
            <span style={{ width: `${now.humidity}%` }} />
          </div>
          <span className="tile__note">{t.dewPoint(now.dewPoint)}</span>
        </div>
        <div className="tile">
          <span className="tile__label">{t.airQuality}</span>
          {aqi && now.aqi !== null ? (
            <>
              <span className="tile__value">
                {Math.round(now.aqi)} <small>{aqi.label}</small>
              </span>
              <Scale steps={AQI_STEPS} on={aqi.step} />
              <span className="tile__note">
                {t.european}
                {now.pm25 === null
                  ? ""
                  : ` · PM2.5 ${Math.round(now.pm25)} µg/m³`}
              </span>
            </>
          ) : (
            <span className="tile__note">{t.notAvailable}</span>
          )}
        </div>
      </div>
    </div>
  );
};

const SunClock = ({ report }: { report: WeatherReport }) => {
  const now = useNow();
  const language = useLanguage();
  const t = COPY[language];
  const sunrise = minutesOf(report.sun.sunrise);
  const sunset = minutesOf(report.sun.sunset);
  const sun = sunAt(parisMinutes(now), sunrise, sunset, language);
  // Along the dashed half circle, in the drawing's 200 × 110 box.
  const x = 100 - 90 * Math.cos(Math.PI * sun.share);
  const y = 100 - 90 * Math.sin(Math.PI * sun.share);

  return (
    <>
      <div className="tile">
        <div className="sun-arc">
          <svg aria-hidden="true" viewBox="0 0 200 110">
            <path
              d="M10 100 A90 90 0 0 1 190 100"
              fill="none"
              stroke="var(--outline)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            <path d="M2 100 H198" stroke="var(--outline)" strokeWidth="1.5" />
          </svg>
          <div
            role="img"
            aria-label={t.sun(sun.status)}
            className={`sun-arc__sun${sun.up ? "" : " sun-arc__sun--down"}`}
            style={{ left: `${x / 2}%`, top: `${y / 1.1}%` }}
          />
        </div>
        <div className="sun-arc__foot">
          <span>{t.east}</span>
          <span>{sun.status}</span>
          <span>{t.west}</span>
        </div>
      </div>
      <div className="pair">
        <div className="tile">
          <span className="tile__label">{t.sunrise}</span>
          <span className="tile__value">{report.sun.sunrise}</span>
        </div>
        <div className="tile">
          <span className="tile__label">{t.sunset}</span>
          <span className="tile__value">{report.sun.sunset}</span>
        </div>
      </div>
      <p className="window__text">
        {t.dayLength} <strong>{durationOf(sunset - sunrise)}</strong> ·{" "}
        {sun.summary}
      </p>
    </>
  );
};

const Problem = () => <p className="notice">{useCopy(COPY).problem}</p>;

/** Paris right now and the week ahead, from Open-Meteo, refreshed every ten minutes. */
export const WeatherScreen = () => {
  const { data, error } = useApi<WeatherReport>("/api/weather", TEN_MINUTES);
  const failed = error && !data;
  const language = useLanguage();
  const t = COPY[language];

  return (
    <>
      <div className="content__head">
        <h2 className="display page__title">{t.title}</h2>
        <p className="page__sub">{t.sub}</p>
      </div>
      <div className="row">
        <AppWindow title="weather.app" size="wide">
          {data ? <Now report={data} /> : null}
          {data ? (
            <div className="tile hours">
              {data.hourly.map((hour) => (
                <div key={hour.time} className="hour">
                  <span className="hour__time">
                    {hour.time.replace(":00", "h")}
                  </span>
                  <span className="hour__temp">{hour.temp}°</span>
                  <span className="hour__rain">{hour.rain}%</span>
                </div>
              ))}
            </div>
          ) : null}
          {failed ? <Problem /> : null}
          {data || failed ? null : <div className="loading" aria-busy="true" />}
        </AppWindow>
        <AppWindow title="sun.clock" size="narrow">
          {data ? <SunClock report={data} /> : null}
          {failed ? <Problem /> : null}
        </AppWindow>
      </div>
      <AppWindow title="forecast_7days.txt" size="full">
        {data ? (
          <div className="days">
            {data.days.map((day, i) => {
              const { day: name, date } = dayOf(day.date, language);

              return (
                <div
                  key={day.date}
                  className={`tile day${i === 0 ? " day--today" : ""}`}
                >
                  <span className="day__name">{i === 0 ? t.today : name}</span>
                  <span className="tile__note">{date}</span>
                  <SkyIcon sky={day.sky} />
                  <span className="day__label">{day.label[language]}</span>
                  <span>
                    <span className="day__hi">{day.hi}°</span>{" "}
                    <span className="day__lo">{day.lo}°</span>
                  </span>
                  <span className="tile__note">
                    {t.rainUv(day.rain, day.uv)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : null}
        {failed ? <Problem /> : null}
      </AppWindow>
    </>
  );
};
