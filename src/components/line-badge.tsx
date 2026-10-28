import type { TransitLine } from "../data/lines";
import { shownCode } from "../data/lines";

/** A line as the network draws it: a metro's circle, a RER's or Transilien's rounded square. */
export const LineBadge = ({ line }: { line: TransitLine }) => (
  <span
    role="img"
    aria-label={line.title}
    className={`badge badge--${line.mode}`}
    style={{ background: line.colour, color: line.ink }}
  >
    {shownCode(line.code)}
  </span>
);
