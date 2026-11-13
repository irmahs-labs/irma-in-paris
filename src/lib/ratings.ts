import { RATED } from "./api";
import type { Ratings } from "./api";
import type { Language } from "./language";

/** The mean of the ratings that are set, or null when none is. */
export const averageOf = (ratings: Ratings) => {
  const set = RATED.flatMap((rated) => {
    const value = ratings[rated];

    return value === null ? [] : [value];
  });

  return set.length === 0
    ? null
    : set.reduce((sum, value) => sum + value, 0) / set.length;
};

const oneDecimal = (locale: string) =>
  new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  });

const ONE_DECIMAL = { en: oneDecimal("en-GB"), fr: oneDecimal("fr-FR") };

/** The average to one decimal, "4.3" ("4,3" in French), or null when nothing is rated. */
export const averageText = (ratings: Ratings, language: Language) => {
  const average = averageOf(ratings);

  return average === null ? null : ONE_DECIMAL[language].format(average);
};
