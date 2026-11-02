import type { ApiError, Photo, PickedPlace, Place, Suggestion } from "./api";
import { currentLanguage } from "./language";
import { LARGE_SIDE, THUMB_SIDE, shrink } from "./resize";

/** What the add-a-place form sends: the restaurant is Google's, by its id. */
export interface PlaceForm {
  placeId: string;
  session: string;
  cuisine: string;
  visitedOn: string;
  dish: string;
}

const REASONS = {
  en: new Map(
    Object.entries({
      admin: "Only admins can change places. Sign in with an admin account.",
      "already-added": "That restaurant is already on the map.",
      cuisine: "Pick a cuisine from the menu.",
      date: "The date does not look right.",
      google: "Google Maps is not answering. Try again in a minute.",
      "no-google-key": "Adding restaurants needs the server's Google Maps key.",
      "not-a-restaurant": "Google Maps does not list that as somewhere to eat.",
      origin: "That came from another site, so it was refused.",
      photo: "That photo could not be read. Try a JPEG or PNG.",
      place: "Pick a restaurant from the list first.",
      "slow-down": "That's a lot of searching. Wait a minute and try again.",
      "too-big": "That photo is too big.",
    })
  ),
  fr: new Map(
    Object.entries({
      admin:
        "Seuls les admins peuvent modifier les lieux. Connectez-vous avec un compte admin.",
      "already-added": "Ce restaurant est déjà sur la carte.",
      cuisine: "Choisissez une cuisine dans le menu.",
      date: "La date ne semble pas correcte.",
      google: "Google Maps ne répond pas. Réessayez dans une minute.",
      "no-google-key":
        "Ajouter des restaurants demande la clé Google Maps du serveur.",
      "not-a-restaurant":
        "Google Maps ne le classe pas parmi les endroits où manger.",
      origin: "Cela venait d’un autre site, c’est donc refusé.",
      photo: "Cette photo n’a pas pu être lue. Essayez un JPEG ou un PNG.",
      place: "Choisissez d’abord un restaurant dans la liste.",
      "slow-down":
        "Ça fait beaucoup de recherches. Attendez une minute et réessayez.",
      "too-big": "Cette photo est trop grande.",
    })
  ),
};

const FAILED = {
  en: "Something went wrong. Try again.",
  fr: "Une erreur est survenue. Réessayez.",
};

export const reasonOf = (error: string, language = currentLanguage()) =>
  REASONS[language].get(error) ?? FAILED[language];

const send = async <T>(path: string, init: RequestInit): Promise<T> => {
  const response = await fetch(path, init);

  if (!response.ok) {
    // SAFETY: /api answers an ApiError when it refuses
    const body = (await response
      .json()
      .catch(() => ({ error: "server" }))) as ApiError;

    throw new Error(reasonOf(body.error));
  }

  // SAFETY: /api answers what src/lib/api.ts describes
  return (response.status === 204 ? undefined : await response.json()) as T;
};

/** Restaurants Google Maps knows by that name, near Paris. */
export const searchPlaces = (query: string, session: string) =>
  send<Suggestion[]>(
    `/api/places/search?${new URLSearchParams({ q: query, session })}`,
    { method: "GET" }
  );

/** The picked restaurant's address and the cuisine Google gives it. */
export const pickPlace = (placeId: string, session: string) =>
  send<PickedPlace>(
    `/api/places/pick?${new URLSearchParams({ id: placeId, session })}`,
    {
      method: "GET",
    }
  );

export const addPlace = (form: PlaceForm) =>
  send<Place>("/api/places", {
    body: JSON.stringify(form),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

export const removePlace = (id: string) =>
  send<undefined>(`/api/places/${id}`, { method: "DELETE" });

/** Shrinks the photo in the browser, then sends both sizes. */
export const addPhoto = async (
  placeId: string,
  file: File,
  caption: string
) => {
  const [large, thumb] = await Promise.all([
    shrink(file, LARGE_SIDE),
    shrink(file, THUMB_SIDE, 0.8),
  ]);

  const body = new FormData();

  body.set("large", large.blob, "large.jpg");
  body.set("thumb", thumb.blob, "thumb.jpg");
  body.set("caption", caption);

  return send<Photo>(`/api/places/${placeId}/photos`, { body, method: "POST" });
};

export const removePhoto = (id: string) =>
  send<undefined>(`/api/photos/${id}`, { method: "DELETE" });
