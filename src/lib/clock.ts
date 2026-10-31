import { useEffect, useState } from "react";

import { LOCALES } from "./language";
import type { Language } from "./language";

/** The time now, ticking every `everyMs`, for clocks and countdowns. */
export const useNow = (everyMs = 30_000) => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), everyMs);

    return () => clearInterval(timer);
  }, [everyMs]);

  return now;
};

const TIME = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  hourCycle: "h23",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

const today = (language: Language) =>
  new Intl.DateTimeFormat(LOCALES[language], {
    day: "numeric",
    month: "long",
    timeZone: "Europe/Paris",
    weekday: "long",
  });

const TODAY = { en: today("en"), fr: today("fr") };

/** "14:05", in Paris whatever the visitor's own time zone. */
export const parisTime = (date: Date) => TIME.format(date);

/** "Tuesday 28 October" (or "mardi 28 octobre"), in Paris. */
export const parisToday = (date: Date, language: Language = "en") =>
  TODAY[language].format(date).replace(",", "");

/** Minutes since midnight in Paris. */
export const parisMinutes = (date: Date) => {
  const [hours = 0, minutes = 0] = parisTime(date).split(":").map(Number);

  return hours * 60 + minutes;
};

/** "07:30" → 450 */
export const minutesOf = (clock: string) => {
  const [hours = 0, minutes = 0] = clock.split(":").map(Number);

  return hours * 60 + minutes;
};
