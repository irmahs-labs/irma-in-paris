import { useId } from "react";
import type { ReactNode } from "react";

interface AppWindowProps {
  /** The panel's file name on its legend, with an extension that exists. */
  title: string;
  /** How much of the row it takes: see `.window--*` in styles.css. */
  size: "wide" | "narrow" | "third" | "full";
  children: ReactNode;
}

/**
 * Cute Matcha's app panel: flat, a 2px outline, and its file name on a
 * `strong` pill across the top edge, as every irmahs.dev app draws them.
 */
export const AppWindow = ({ title, size, children }: AppWindowProps) => {
  const id = useId();

  return (
    <section aria-labelledby={id} className={`panel window window--${size}`}>
      <h3 id={id} className="legend">
        {title}
      </h3>
      <div className="window__body">{children}</div>
    </section>
  );
};
