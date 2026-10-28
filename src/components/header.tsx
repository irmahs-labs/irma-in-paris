import { APP_NAME } from "../lib/brand";
import { parisTime, parisToday, useNow } from "../lib/clock";
import { Link } from "../lib/router";
import { AccountButton } from "./account-button";
import { AppIcon } from "./app-icon";
import { ThemeToggle } from "./theme-toggle";

/**
 * Cute Matcha's app Header: the icon, the name with "by Irma HS" under it,
 * then Paris's date and time, the theme toggle and the account pill at the
 * end. The name is the page's heading.
 */
export const Header = () => {
  const now = useNow();

  return (
    <header className="app-header">
      <Link href="/" className="app-header__home">
        <AppIcon />
        <span>
          <h1 className="app-header__name">{APP_NAME}</h1>
          <span className="app-header__by">by Irma HS</span>
        </span>
      </Link>
      <div className="app-header__end">
        <p className="hint">
          live · {parisToday(now)} · <time>{parisTime(now)}</time>
        </p>
        <ThemeToggle />
        <AccountButton />
      </div>
    </header>
  );
};
