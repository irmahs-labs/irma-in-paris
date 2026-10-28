import { useEffect, useState } from "react";

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

const TODAY = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  timeZone: "Europe/Paris",
  weekday: "long",
});

/** "14:05", in Paris whatever the visitor's own time zone. */
export const parisTime = (date: Date) => TIME.format(date);

/** "Tuesday 28 October", in Paris. */
export const parisToday = (date: Date) => TODAY.format(date).replace(",", "");

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
