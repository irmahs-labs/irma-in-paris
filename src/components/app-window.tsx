import { useId } from "react";
import type { ReactNode } from "react";

interface AppWindowProps {
  /** The window's file name in its title bar, with an extension that exists. */
  title: string;
  /** How much of the row it takes: see `.window--*` in styles.css. */
  size: "wide" | "narrow" | "third" | "full";
  children: ReactNode;
}

/**
 * A window on the desk: a matcha body under a dark title bar, its file
 * name on the left and the three window buttons on the right.
 */
export const AppWindow = ({ title, size, children }: AppWindowProps) => {
  const id = useId();

  return (
    <section aria-labelledby={id} className={`window window--${size}`}>
      <div className="window__bar">
        <h3 id={id} className="window__title">
          {title}
        </h3>
        <div aria-hidden="true" className="window__dots">
          <span />
          <span />
          <span />
        </div>
      </div>
      <div className="window__body">{children}</div>
    </section>
  );
};
