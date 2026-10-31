import type { TransitLine } from "../data/lines";
import { lineTitle, shownCode } from "../data/lines";
import { useLanguage } from "../lib/language";

/** A line as the network draws it: a metro's circle, a RER's or Transilien's rounded square. */
export const LineBadge = ({ line }: { line: TransitLine }) => (
  <span
    role="img"
    aria-label={lineTitle(line, useLanguage())}
    className={`badge badge--${line.mode}`}
    style={{ background: line.colour, color: line.ink }}
  >
    {shownCode(line.code)}
  </span>
);
