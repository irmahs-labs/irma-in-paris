import { LOCALES } from "./language";
import type { Language } from "./language";

/**
 * How the weather screen words and colours its numbers. The scales are the
 * WHO's for the UV index and the European Environment Agency's for the
 * European Air Quality Index.
 */
export interface Level {
  /** Which step of the scale the value is on, from 0. */
  step: number;
  label: string;
}

export const UV_STEPS = [
  "var(--moss)",
  "var(--gold)",
  "var(--terracotta)",
  "var(--danger)",
  "var(--strong)",
];

/** The WHO's five UV levels, each with its label and advice, in each language. */
const UV_LEVELS = {
  en: [
    { advice: "No sun protection needed", label: "low" },
    { advice: "Sunglasses and sun cream at midday", label: "moderate" },
    { advice: "Cover up, find shade at midday", label: "high" },
    { advice: "Stay out of the midday sun", label: "very high" },
    { advice: "Avoid the sun", label: "extreme" },
  ],
  fr: [
    { advice: "Pas besoin de protection solaire", label: "faible" },
    { advice: "Lunettes et crème solaire à midi", label: "modéré" },
    { advice: "Couvrez-vous, cherchez l’ombre à midi", label: "élevé" },
    { advice: "Évitez le soleil de midi", label: "très élevé" },
    { advice: "Évitez le soleil", label: "extrême" },
  ],
};

const uvStep = (uv: number) => {
  if (uv < 3) {
    return 0;
  }

  if (uv < 6) {
    return 1;
  }

  if (uv < 8) {
    return 2;
  }

  return uv < 11 ? 3 : 4;
};

export const uvLevel = (
  uv: number,
  language: Language = "en"
): Level & { advice: string } => {
  const step = uvStep(uv);
  const level = UV_LEVELS[language][step] ?? { advice: "", label: "" };

  return { ...level, step };
};

export const AQI_STEPS = [
  "var(--moss)",
  "var(--accent-soft)",
  "var(--gold)",
  "var(--terracotta)",
  "var(--danger)",
  "var(--strong)",
];

/** The European AQI's six levels, as the EEA names them in each language. */
export const AQI_LABELS = {
  en: ["good", "fair", "moderate", "poor", "very poor", "extremely poor"],
  fr: [
    "bon",
    "moyen",
    "dégradé",
    "mauvais",
    "très mauvais",
    "extrêmement mauvais",
  ],
};

export const aqiLevel = (aqi: number, language: Language = "en"): Level => {
  const step = Math.min(5, Math.max(0, Math.ceil(aqi / 20) - 1));

  return { label: AQI_LABELS[language][step] ?? "", step };
};

const COMPASS = {
  en: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"],
  fr: ["N", "NE", "E", "SE", "S", "SO", "O", "NO"],
};

const COMPASS_WORDS = {
  en: [
    "north",
    "north-east",
    "east",
    "south-east",
    "south",
    "south-west",
    "west",
    "north-west",
  ],
  fr: [
    "nord",
    "nord-est",
    "est",
    "sud-est",
    "sud",
    "sud-ouest",
    "ouest",
    "nord-ouest",
  ],
};

const sector = (degrees: number) =>
  Math.round((((degrees % 360) + 360) % 360) / 45) % 8;

/** Where the wind comes from: 225 → "SW". */
export const compassOf = (degrees: number, language: Language = "en") =>
  COMPASS[language][sector(degrees)] ?? "N";

export const compassWordOf = (degrees: number, language: Language = "en") =>
  COMPASS_WORDS[language][sector(degrees)] ?? COMPASS_WORDS[language][0];

const formats = (language: Language) => ({
  date: new Intl.DateTimeFormat(LOCALES[language], {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }),
  day: new Intl.DateTimeFormat(LOCALES[language], {
    timeZone: "UTC",
    weekday: "short",
  }),
});

const DAY_FORMATS = { en: formats("en"), fr: formats("fr") };

/** "2026-10-29" → "Thu" and "29 Oct" ("jeu." and "29 oct." in French). The dates are already Paris's. */
export const dayOf = (date: string, language: Language = "en") => {
  const at = new Date(`${date}T12:00:00Z`);
  const format = DAY_FORMATS[language];

  return { date: format.date.format(at), day: format.day.format(at) };
};

/** 597 → "9 h 57" */
export const durationOf = (minutes: number) =>
  `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;

/**
 * Where the sun is on its arc between sunrise and sunset, as a share of the
 * day from 0 to 1, and how long is left. Before sunrise and after sunset it
 * sits on the horizon.
 */
const SUN_WORDS = {
  en: {
    after: "after sunset",
    before: "before sunrise",
    daytime: "daytime",
    left: (duration: string) => `${duration} of daylight left`,
    rises: (duration: string) => `sunrise in ${duration}`,
    set: "the sun has set",
  },
  fr: {
    after: "après le coucher",
    before: "avant le lever",
    daytime: "en journée",
    left: (duration: string) => `encore ${duration} de jour`,
    rises: (duration: string) => `lever du soleil dans ${duration}`,
    set: "le soleil est couché",
  },
};

export const sunAt = (
  minutes: number,
  sunrise: number,
  sunset: number,
  language: Language = "en"
) => {
  const words = SUN_WORDS[language];

  const share = Math.max(
    0,
    Math.min(1, (minutes - sunrise) / (sunset - sunrise))
  );

  const left = sunset - minutes;

  if (minutes < sunrise) {
    return {
      share,
      status: words.before,
      summary: words.rises(durationOf(sunrise - minutes)),
      up: false,
    };
  }

  if (left > 0) {
    return {
      share,
      status: words.daytime,
      summary: words.left(durationOf(left)),
      up: true,
    };
  }

  return {
    share,
    status: words.after,
    summary: words.set,
    up: false,
  };
};
