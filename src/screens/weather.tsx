import { AppWindow } from "../components/app-window";
import { SkyIcon } from "../components/sky-icon";
import type { WeatherReport } from "../lib/api";
import { minutesOf, parisMinutes, useNow } from "../lib/clock";
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
  const uv = uvLevel(now.uv);
  const aqi = now.aqi === null ? null : aqiLevel(now.aqi);

  return (
    <div className="now">
      <div className="now__main">
        <SkyIcon sky={now.sky} size={84} label={now.label} />
        <div className="stack">
          <span className="now__temp">{now.temp}°</span>
          <span className="now__label">{now.label}</span>
          <span className="now__more">
            Feels like {now.feelsLike}°
            {today ? ` · H ${today.hi}° L ${today.lo}°` : ""}
          </span>
        </div>
      </div>
      <div className="tiles">
        <div className="tile">
          <span className="tile__label">uv index</span>
          <span className="tile__value">
            {now.uv} <small>{uv.label}</small>
          </span>
          <Scale steps={UV_STEPS} on={uv.step} />
          <span className="tile__note">{uv.advice}</span>
        </div>
        <div className="tile">
          <span className="tile__label">wind</span>
          <span className="tile__value">
            {now.windKmh} <small>km/h</small>
          </span>
          <span className="tile__note">
            From{" "}
            <abbr title={compassWordOf(now.windFrom)}>
              {compassOf(now.windFrom)}
            </abbr>{" "}
            · gusts {now.gustsKmh} km/h
          </span>
        </div>
        <div className="tile">
          <span className="tile__label">humidity</span>
          <span className="tile__value">
            {now.humidity}
            <small>%</small>
          </span>
          <div aria-hidden="true" className="meter">
            <span style={{ width: `${now.humidity}%` }} />
          </div>
          <span className="tile__note">Dew point {now.dewPoint}°</span>
        </div>
        <div className="tile">
          <span className="tile__label">air quality</span>
          {aqi && now.aqi !== null ? (
            <>
              <span className="tile__value">
                {Math.round(now.aqi)} <small>{aqi.label}</small>
              </span>
              <Scale steps={AQI_STEPS} on={aqi.step} />
              <span className="tile__note">
                European AQI
                {now.pm25 === null
                  ? ""
                  : ` · PM2.5 ${Math.round(now.pm25)} µg/m³`}
              </span>
            </>
          ) : (
            <span className="tile__note">Not available right now</span>
          )}
        </div>
      </div>
    </div>
  );
};

const SunClock = ({ report }: { report: WeatherReport }) => {
  const now = useNow();
  const sunrise = minutesOf(report.sun.sunrise);
  const sunset = minutesOf(report.sun.sunset);
  const sun = sunAt(parisMinutes(now), sunrise, sunset);
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
            aria-label={`The sun: ${sun.status}`}
            className={`sun-arc__sun${sun.up ? "" : " sun-arc__sun--down"}`}
            style={{ left: `${x / 2}%`, top: `${y / 1.1}%` }}
          />
        </div>
        <div className="sun-arc__foot">
          <span>east</span>
          <span>{sun.status}</span>
          <span>west</span>
        </div>
      </div>
      <div className="pair">
        <div className="tile">
          <span className="tile__label">sunrise</span>
          <span className="tile__value">{report.sun.sunrise}</span>
        </div>
        <div className="tile">
          <span className="tile__label">sunset</span>
          <span className="tile__value">{report.sun.sunset}</span>
        </div>
      </div>
      <p className="window__text">
        Day length <strong>{durationOf(sunset - sunrise)}</strong> ·{" "}
        {sun.summary}
      </p>
    </>
  );
};

const Problem = () => (
  <p className="notice">
    The weather could not be loaded just now. It will try again in a few
    minutes.
  </p>
);

/** Paris right now and the week ahead, from Open-Meteo, refreshed every ten minutes. */
export const WeatherScreen = () => {
  const { data, error } = useApi<WeatherReport>("/api/weather", TEN_MINUTES);
  const failed = error && !data;

  return (
    <>
      <div className="content__head">
        <h2 className="display page__title">Weather</h2>
        <p className="page__sub">Right now in Paris, and the week ahead.</p>
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
              const { day: name, date } = dayOf(day.date);

              return (
                <div
                  key={day.date}
                  className={`tile day${i === 0 ? " day--today" : ""}`}
                >
                  <span className="day__name">{i === 0 ? "Today" : name}</span>
                  <span className="tile__note">{date}</span>
                  <SkyIcon sky={day.sky} />
                  <span className="day__label">{day.label}</span>
                  <span>
                    <span className="day__hi">{day.hi}°</span>{" "}
                    <span className="day__lo">{day.lo}°</span>
                  </span>
                  <span className="tile__note">
                    rain {day.rain}% · UV {day.uv}
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
