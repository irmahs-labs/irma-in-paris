import { Icon } from "../lib/icon";
import { chooseTheme, useTheme } from "../lib/theme";

/** The header's sun/moon pill: names and shows the theme it switches to. */
export const ThemeToggle = () => {
  const theme = useTheme();
  const next = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      className="btn btn--pill"
      aria-label={`Switch to ${next} mode`}
      onClick={() => chooseTheme(next)}
    >
      <Icon name={next === "dark" ? "moon" : "sun"} size={16} />
      {next}
    </button>
  );
};
