import * as z from "zod/mini";

/** What the account service says about a session, as far as this app reads it. */
const sessionAnswer = z.nullable(
  z.object({
    user: z.object({
      id: z.uuid(),
    }),
  })
);

export interface Visitor {
  /** The account service's user id, or null when nobody is signed in. */
  id: string | null;
  admin: boolean;
}

export type WhoIs = (cookie: string | undefined) => Promise<Visitor>;

/**
 * The app whose list in the account service's APP_ACCESS secret makes
 * someone an admin here, able to add places and photos. It reuses Alma
 * Housila's list, as Mini Games and the landing page do, so the secret
 * needs no entry of its own. Give Irma in Paris its own list by adding an
 * `irma-in-paris=…` entry to APP_ACCESS and naming it here.
 */
export const ADMIN_APP = "alma-housila";

/**
 * Who sent this request, asked of the IrmaHS Labs account service
 * (irmahs-labs/auth) with the browser's own cookie: their account, from
 * `/api/auth/get-session`, and whether they are an admin, from
 * `/api/access/:app`, the check Caddy makes before opening a private app.
 * Only a 204 there says yes; signed out it redirects to sign in, which is not
 * followed, and anyone not listed gets a 403. Nothing the browser sends is
 * taken as an account id, and when the service cannot be asked, nobody is an
 * admin.
 */
export const askAccountService =
  (authUrl: string): WhoIs =>
  async (cookie) => {
    if (!cookie) {
      return { admin: false, id: null };
    }

    try {
      const [session, access] = await Promise.all([
        fetch(`${authUrl}/api/auth/get-session`, { headers: { cookie } }),
        fetch(`${authUrl}/api/access/${ADMIN_APP}`, {
          headers: { cookie },
          redirect: "manual",
        }),
      ]);

      const parsed = session.ok
        ? sessionAnswer.safeParse(await session.json())
        : null;

      const id = parsed?.success ? (parsed.data?.user.id ?? null) : null;

      return { admin: id !== null && access.status === 204, id };
    } catch {
      return { admin: false, id: null };
    }
  };
