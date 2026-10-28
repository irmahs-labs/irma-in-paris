import { useEffect, useState } from "react";

/** The IrmaHS Labs account service every irmahs.dev site signs in through */
export const AUTH_URL =
  import.meta.env.VITE_AUTH_URL ?? "https://auth.irmahs.dev";

export interface SessionUser {
  email: string;
  image: string | null;
  name: string;
}

/** The account page, set to bring the visitor back to where they are */
export const accountUrl = (returnTo: string) =>
  `${AUTH_URL}/sign-in?redirect=${encodeURIComponent(returnTo)}`;

/** The first name to greet someone by, or their email without one */
export const firstName = (user: SessionUser) =>
  user.name.trim().split(/\s+/u)[0] || user.email;

/**
 * Who is signed in, asked once of the account service. Its session cookie
 * is set for every *.irmahs.dev site, so the browser sends it along.
 * `undefined` while asking, `null` when nobody is signed in or it can't be
 * reached (on localhost, say, which it doesn't answer).
 */
export const useSession = () => {
  const [user, setUser] = useState<SessionUser | null | undefined>();

  useEffect(() => {
    let alive = true;

    const load = async () => {
      let next: SessionUser | null = null;

      try {
        const res = await fetch(`${AUTH_URL}/api/auth/get-session`, {
          cache: "no-store",
          credentials: "include",
        });

        // SAFETY: Better Auth's get-session answers null or { user, session }
        const body = res.ok
          ? ((await res.json()) as { user?: SessionUser } | null)
          : null;

        next = body?.user ?? null;
      } catch {
        next = null;
      }

      if (alive) {
        setUser(next);
      }
    };

    void load();

    return () => {
      alive = false;
    };
  }, []);

  return user;
};
