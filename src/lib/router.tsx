import { useSyncExternalStore } from "react";
import type { AnchorHTMLAttributes, MouseEvent } from "react";

/**
 * A router small enough to read in one go: the path is the browser's own,
 * and a Link pushes onto history instead of reloading. The server answers
 * every path with index.html, so a refresh or a shared link lands right too.
 */
const subscribe = (onChange: () => void) => {
  window.addEventListener("popstate", onChange);

  return () => window.removeEventListener("popstate", onChange);
};

const currentPath = () => window.location.pathname;

export const usePath = () => useSyncExternalStore(subscribe, currentPath);

const navigate = (to: string) => {
  if (to === window.location.pathname) {
    return;
  }

  window.history.pushState(null, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo(0, 0);
};

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

export const Link = ({ href, onClick, children, ...rest }: LinkProps) => {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);

    // A modified click (new tab, new window) is the browser's to handle.
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    navigate(href);
  };

  return (
    <a href={href} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
};
