import type { ApiError, Photo, Place } from "./api";
import { LARGE_SIDE, THUMB_SIDE, shrink } from "./resize";

/** What the admin forms send, and the server's reasons put in words. */
export interface PlaceForm {
  name: string;
  cuisine: string;
  address: string;
  visitedOn: string;
  dish: string;
}

const REASONS = new Map(
  Object.entries({
    address: "That address could not be found. Try adding the postcode.",
    admin: "Only admins can change places. Sign in with an admin account.",
    date: "The date does not look right.",
    geocoder: "The address search is not answering. Try again in a minute.",
    origin: "That came from another site, so it was refused.",
    photo: "That photo could not be read. Try a JPEG or PNG.",
    place: "A place needs a name and an address.",
    "too-big": "That photo is too big.",
  })
);

export const reasonOf = (error: string) =>
  REASONS.get(error) ?? "Something went wrong. Try again.";

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
