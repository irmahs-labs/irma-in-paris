import { Icon } from "../lib/icon";
import { useCopy } from "../lib/language";
import { chooseTheme, useTheme } from "../lib/theme";

const COPY = {
  en: {
    dark: "dark",
    light: "light",
    switchTo: (name: string) => `Switch to ${name} mode`,
  },
  fr: {
    dark: "sombre",
    light: "clair",
    switchTo: (name: string) => `Passer en mode ${name}`,
  },
};

/** The header's sun/moon pill: names and shows the theme it switches to. */
export const ThemeToggle = () => {
  const theme = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  const t = useCopy(COPY);

  return (
    <button
      type="button"
      className="btn btn--pill"
      aria-label={t.switchTo(t[next])}
      onClick={() => chooseTheme(next)}
    >
      <Icon name={next === "dark" ? "moon" : "sun"} size={16} />
      {t[next]}
    </button>
  );
};
