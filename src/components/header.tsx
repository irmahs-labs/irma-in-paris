import { APP_NAME } from "../lib/brand";
import { parisTime, parisToday, useNow } from "../lib/clock";
import { useCopy, useLanguage } from "../lib/language";
import { Link } from "../lib/router";
import { AccountButton } from "./account-button";
import { AppIcon } from "./app-icon";
import { LanguageToggle } from "./language-toggle";
import { ThemeToggle } from "./theme-toggle";

const COPY = {
  en: { by: "by Irma HS", live: "live" },
  fr: { by: "par Irma HS", live: "en direct" },
};

/**
 * Cute Matcha's app Header: the icon, the name with "by Irma HS" under it,
 * then Paris's date and time, the language pill, the theme toggle and the
 * account pill at the end. The name is the page's heading.
 */
export const Header = () => {
  const now = useNow();
  const language = useLanguage();
  const t = useCopy(COPY);

  return (
    <header className="app-header">
      <Link href="/" className="app-header__home">
        <AppIcon />
        <span>
          <h1 className="app-header__name">{APP_NAME}</h1>
          <span className="app-header__by">{t.by}</span>
        </span>
      </Link>
      <div className="app-header__end">
        <p className="hint">
          {t.live} · {parisToday(now, language)} · <time>{parisTime(now)}</time>
        </p>
        <LanguageToggle />
        <ThemeToggle />
        <AccountButton />
      </div>
    </header>
  );
};
