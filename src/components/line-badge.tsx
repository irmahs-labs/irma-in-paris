import type { FeedLine } from "../data/lines";

/** A line as the network draws it: a metro's circle, a RER's square, a tram's pill. */
export const LineBadge = ({ line }: { line: FeedLine }) => (
  <span
    aria-label={line.title}
    className={`badge badge--${line.mode}`}
    style={{ background: line.colour, color: line.ink }}
  >
    {line.id}
  </span>
);
