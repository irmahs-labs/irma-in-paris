import { useEffect, useRef, useState } from "react";

const CONFIRM_MS = 3000;

/**
 * A press-twice guard for buttons that throw work away: the first press arms
 * that button for a few seconds (its label can then ask "Sure?"), and only a
 * second press runs the action. Pressing another guarded button re-arms.
 */
export const useConfirm = () => {
  const [armed, setArmed] = useState<string | null>(null);
  // 0 is never a live timer id, so clearing it is a harmless no-op.
  const timer = useRef(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const press = (key: string, action: () => void) => {
    window.clearTimeout(timer.current);

    if (armed === key) {
      setArmed(null);
      action();

      return;
    }

    setArmed(key);
    timer.current = window.setTimeout(() => setArmed(null), CONFIRM_MS);
  };

  return { armed, press };
};
