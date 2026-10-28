/**
 * Every metro, RER and Transilien line, in the order the screen lists them.
 * PRIM gives each line's id and colours when it answers; these colours are
 * the network's own, for when it does not.
 */
export type Mode = "metro" | "rer" | "transilien";

export interface TransitLine {
  /** "metro:3B", "rer:A", "transilien:H": a line's id in this app. */
  key: string;
  mode: Mode;
  /** As riders know it: "1", "3B", "A", "H". */
  code: string;
  title: string;
  colour: string;
  /** The text colour that reads on `colour`. */
  ink: string;
}

const DARK = "#000000";
const LIGHT = "#ffffff";

const MODE_NAMES: Record<Mode, string> = {
  metro: "Metro",
  rer: "RER",
  transilien: "Transilien",
};

export const MODES: readonly Mode[] = ["metro", "rer", "transilien"];

export const modeName = (mode: Mode) => MODE_NAMES[mode];

/** "3B" → "3bis", as the signs write it. */
export const shownCode = (code: string) =>
  code.replace(/^(?<number>\d+)B$/iu, "$<number>bis");

export const lineOf = (
  mode: Mode,
  code: string,
  colour: string,
  ink: string
): TransitLine => ({
  code,
  colour,
  ink,
  key: `${mode}:${code}`,
  mode,
  title: `${modeName(mode)} ${shownCode(code)}`,
});

export const LINES: readonly TransitLine[] = [
  lineOf("metro", "1", "#ffcd00", DARK),
  lineOf("metro", "2", "#003ca6", LIGHT),
  lineOf("metro", "3", "#837902", LIGHT),
  lineOf("metro", "3B", "#6ec4e8", DARK),
  lineOf("metro", "4", "#cf009e", LIGHT),
  lineOf("metro", "5", "#ff7e2e", DARK),
  lineOf("metro", "6", "#6eca97", DARK),
  lineOf("metro", "7", "#fa9aba", DARK),
  lineOf("metro", "7B", "#6eca97", DARK),
  lineOf("metro", "8", "#e19bdf", DARK),
  lineOf("metro", "9", "#b6bd00", DARK),
  lineOf("metro", "10", "#c9910d", DARK),
  lineOf("metro", "11", "#704b1c", LIGHT),
  lineOf("metro", "12", "#007852", LIGHT),
  lineOf("metro", "13", "#6ec4e8", DARK),
  lineOf("metro", "14", "#62259d", LIGHT),
  lineOf("rer", "A", "#e3051c", LIGHT),
  lineOf("rer", "B", "#5291ce", LIGHT),
  lineOf("rer", "C", "#ffce00", DARK),
  lineOf("rer", "D", "#00814f", LIGHT),
  lineOf("rer", "E", "#c04191", LIGHT),
  lineOf("transilien", "H", "#8d5e2a", LIGHT),
  lineOf("transilien", "J", "#d5c900", DARK),
  lineOf("transilien", "K", "#9a9940", LIGHT),
  lineOf("transilien", "L", "#ceadd2", DARK),
  lineOf("transilien", "N", "#00a88f", LIGHT),
  lineOf("transilien", "P", "#f28e42", DARK),
  lineOf("transilien", "R", "#f59ebe", DARK),
  lineOf("transilien", "U", "#b90845", LIGHT),
];

/** A code's leading number: "3B" → 3, "14" → 14, "A" → NaN. */
const numberOf = (code: string) =>
  Number(code.match(/^\d+/u)?.[0] ?? Number.NaN);

/** Metro lines by number, then 3bis after 3 and 7bis after 7; letters A to Z. */
export const lineOrder = (a: TransitLine, b: TransitLine) =>
  MODES.indexOf(a.mode) - MODES.indexOf(b.mode) ||
  numberOf(a.code) - numberOf(b.code) ||
  a.code.localeCompare(b.code);
