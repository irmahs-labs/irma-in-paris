import { accountUrl, firstName, useSession } from "../lib/session";

// Google's own four-colour mark: never recoloured or redrawn
const GoogleMark = () => (
  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 48 48">
    <path
      d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z"
      fill="#FFC107"
    />
    <path
      d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      fill="#FF3D00"
    />
    <path
      d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      fill="#4CAF50"
    />
    <path
      d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      fill="#1976D2"
    />
  </svg>
);

/**
 * Cute Matcha's AccountButton, as a header pill: "sign in" with Google's
 * mark, or once signed in, the person's picture and first name. Either way
 * it opens the IrmaHS Labs account page, which signs in, shows who you are
 * or signs out, then comes back here. Nothing shows until the session is
 * known, so it never flickers between the two.
 */
export const AccountButton = () => {
  const user = useSession();

  if (user === undefined) {
    return null;
  }

  const href = accountUrl(window.location.href);

  if (user === null) {
    return (
      <a className="account" href={href} title="sign in with Google">
        <span className="account__icon">
          <GoogleMark />
        </span>
        <span className="account__text">sign in</span>
      </a>
    );
  }

  const name = firstName(user);

  return (
    <a className="account" href={href} title={`Signed in as ${user.email}`}>
      <span className="account__icon">
        {user.image ? (
          // Google's picture host refuses requests that carry a referrer
          <img
            alt=""
            width="30"
            height="30"
            referrerPolicy="no-referrer"
            src={user.image}
          />
        ) : (
          <span aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
        )}
      </span>
      <span className="account__text">{name}</span>
    </a>
  );
};
