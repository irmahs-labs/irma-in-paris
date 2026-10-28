import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";

import { AppWindow } from "../components/app-window";
import { LazyMap } from "../components/lazy-map";
import { CUISINES } from "../data/cuisines";
import * as admin from "../lib/admin";
import type { Me, Photo, PickedPlace, Place, Suggestion } from "../lib/api";
import { Icon } from "../lib/icon";
import { useApi } from "../lib/use-api";
import { useConfirm } from "../lib/use-confirm";

const VISITED = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});

/** "2026-10-12" → "12 October 2026" */
const visitedOf = (date: string | null) =>
  date ? VISITED.format(new Date(`${date}T12:00:00Z`)) : "";

const photoUrl = (photo: Photo, size: "large" | "thumb") =>
  `/api/photos/${photo.id}/${size}`;

/** A photo full size, over the page, closed with Escape, the button or a click outside it. */
const Viewer = ({
  photo,
  onClose,
}: {
  photo: Photo | null;
  onClose: () => void;
}) => {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (photo) {
      dialog.current?.showModal();
    } else {
      dialog.current?.close();
    }
  }, [photo]);

  return (
    <dialog
      ref={dialog}
      className="viewer"
      aria-label={photo?.caption || "Photo"}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) {
          onClose();
        }
      }}
    >
      {photo ? (
        <div className="viewer__panel">
          <img
            src={photoUrl(photo, "large")}
            width={photo.width}
            height={photo.height}
            alt={photo.caption}
          />
          <div className="viewer__foot">
            <span>{photo.caption}</span>
            <button type="button" className="btn btn--pill" onClick={onClose}>
              <Icon name="close" size={16} />
              close
            </button>
          </div>
        </div>
      ) : null}
    </dialog>
  );
};

/** How long typing pauses before Google is asked. */
const TYPING_MS = 250;

/**
 * Admins only: the restaurant's name, typed, and Google Maps' restaurants
 * by that name to pick from, as a combobox. Only a place Google lists as
 * somewhere to eat can be picked.
 */
const RestaurantSearch = ({
  session,
  onPick,
}: {
  session: string;
  onPick: (place: PickedPlace) => void;
}) => {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const listId = useId();

  useEffect(() => {
    const typed = query.trim();

    if (typed.length < 2) {
      setSuggestions([]);

      return;
    }

    let alive = true;

    const timer = setTimeout(async () => {
      try {
        const found = await admin.searchPlaces(typed, session);

        if (alive) {
          setSuggestions(found);
          setProblem(
            found.length === 0
              ? "No restaurant by that name on Google Maps."
              : ""
          );
        }
      } catch (error) {
        if (alive) {
          setProblem(error instanceof Error ? error.message : "");
        }
      }
    }, TYPING_MS);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, session]);

  const pick = async (suggestion: Suggestion) => {
    setBusy(true);
    setProblem("");

    try {
      onPick(await admin.pickPlace(suggestion.placeId, session));
      setQuery("");
      setSuggestions([]);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="search">
      <label>
        Restaurant
        <input
          className="field"
          type="search"
          role="combobox"
          aria-expanded={suggestions.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          placeholder="Search Google Maps by name"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {suggestions.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="search__list"
          aria-busy={busy}
        >
          {suggestions.map((suggestion) => (
            <li key={suggestion.placeId} role="option" aria-selected="false">
              <button
                type="button"
                className="search__option"
                disabled={busy}
                onClick={() => pick(suggestion)}
              >
                <span className="place-row__name">{suggestion.name}</span>
                <span className="place-row__more">{suggestion.address}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="form__error" role="status">
        {problem}
      </p>
    </div>
  );
};

/** Admins only: a new place, picked from Google Maps, with its cuisine, date and dish. */
const AddPlace = ({ onAdded }: { onAdded: (place: Place) => void }) => {
  // One Google session per restaurant searched for and added.
  const [session, setSession] = useState(() => crypto.randomUUID());
  const [chosen, setChosen] = useState<PickedPlace | null>(null);
  const [cuisine, setCuisine] = useState("");
  const [visitedOn, setVisitedOn] = useState("");
  const [dish, setDish] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  const choose = (place: PickedPlace) => {
    setChosen(place);
    setCuisine(place.cuisine ?? "");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    if (!chosen) {
      return;
    }

    setBusy(true);
    setProblem("");

    try {
      onAdded(
        await admin.addPlace({
          cuisine,
          dish,
          placeId: chosen.placeId,
          session,
          visitedOn,
        })
      );
      setChosen(null);
      setCuisine("");
      setVisitedOn("");
      setDish("");
      setSession(crypto.randomUUID());
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppWindow title="add_place.form" size="full">
      <form className="form" onSubmit={submit}>
        {chosen ? (
          <div className="chosen">
            <span className="tile__label">restaurant</span>
            <span className="selected__name">{chosen.name}</span>
            <span>{chosen.address}</span>
            <button
              type="button"
              className="btn btn--pill"
              onClick={() => setChosen(null)}
            >
              change
            </button>
          </div>
        ) : (
          <RestaurantSearch session={session} onPick={choose} />
        )}
        <div className="form__grid">
          <label>
            Cuisine
            <select
              className="field"
              required
              value={cuisine}
              onChange={(event) => setCuisine(event.target.value)}
            >
              <option value="" disabled>
                Pick one
              </option>
              {CUISINES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label>
            Visited on
            <input
              className="field"
              type="date"
              value={visitedOn}
              onChange={(event) => setVisitedOn(event.target.value)}
            />
          </label>
          <label>
            What I ate
            <input
              className="field"
              maxLength={120}
              value={dish}
              onChange={(event) => setDish(event.target.value)}
            />
          </label>
        </div>
        <div className="form__actions">
          <button
            type="submit"
            className="btn btn--primary"
            disabled={busy || !chosen || !cuisine}
          >
            <Icon name="plus" size={16} />
            {busy ? "adding…" : "add place"}
          </button>
          <p className="form__error" role="status">
            {problem}
          </p>
        </div>
      </form>
    </AppWindow>
  );
};

/** Admins only: a photo for the selected place, shrunk in the browser before it is sent. */
const AddPhoto = ({
  place,
  onAdded,
}: {
  place: Place;
  onAdded: (photo: Photo) => void;
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    if (!file) {
      return;
    }

    setBusy(true);
    setProblem("");

    try {
      onAdded(await admin.addPhoto(place.id, file, caption));
      setFile(null);
      setCaption("");

      if (input.current) {
        input.current.value = "";
      }
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form" onSubmit={submit}>
      <label>
        Add a photo
        <input
          ref={input}
          className="file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      </label>
      <label>
        Caption
        <input
          className="field"
          maxLength={120}
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
        />
      </label>
      <div className="form__actions">
        <button
          type="submit"
          className="btn btn--primary"
          disabled={!file || busy}
        >
          <Icon name="plus" size={16} />
          {busy ? "uploading…" : "add photo"}
        </button>
        <p className="form__error" role="status">
          {problem}
        </p>
      </div>
    </form>
  );
};

/** The restaurants Irma has eaten at, on a map and in a list, with photos. */
export const PlacesScreen = () => {
  const { data, error } = useApi<Place[]>("/api/places");
  const { data: me } = useApi<Me>("/api/me");
  const [places, setPlaces] = useState<Place[]>([]);
  const [picked, setPicked] = useState<string>();
  const [viewing, setViewing] = useState<Photo | null>(null);
  const [problem, setProblem] = useState("");
  const { armed, press } = useConfirm();
  const isAdmin = me?.admin === true;

  useEffect(() => {
    if (data) {
      setPlaces(data);
    }
  }, [data]);

  const place = places.find((entry) => entry.id === picked) ?? places[0];

  const update = (id: string, change: (old: Place) => Place) =>
    setPlaces((old) =>
      old.map((entry) => (entry.id === id ? change(entry) : entry))
    );

  const deletePlace = async (target: Place) => {
    setProblem("");

    try {
      await admin.removePlace(target.id);
      setPlaces((old) => old.filter((entry) => entry.id !== target.id));
    } catch (error_) {
      setProblem(error_ instanceof Error ? error_.message : "");
    }
  };

  const deletePhoto = async (target: Place, photo: Photo) => {
    setProblem("");

    try {
      await admin.removePhoto(photo.id);
      update(target.id, (old) => ({
        ...old,
        photos: old.photos.filter((entry) => entry.id !== photo.id),
      }));
    } catch (error_) {
      setProblem(error_ instanceof Error ? error_.message : "");
    }
  };

  return (
    <>
      <div className="content__head">
        <h2 className="display page__title">Places I've been</h2>
        <p className="page__sub">
          Restaurants I've eaten at in Paris. Tap a pin or a name.
        </p>
      </div>
      <AppWindow title="places_ive_been.map" size="full">
        {error && !data ? (
          <p className="notice">The places could not be loaded just now.</p>
        ) : null}
        <div className="split">
          <LazyMap
            label="Map of the restaurants"
            focus={picked}
            markers={places.map((entry, i) => ({
              id: entry.id,
              lat: entry.lat,
              lon: entry.lon,
              node: (
                <button
                  type="button"
                  aria-pressed={entry.id === place?.id}
                  aria-label={entry.name}
                  className="pin pin--place"
                  onClick={() => setPicked(entry.id)}
                >
                  <Icon name="fork" size={16} />
                  {i + 1}
                </button>
              ),
            }))}
          />
          <fieldset className="panel places">
            <legend className="legend">restaurants</legend>
            {data && places.length === 0 ? (
              <p className="hint">
                No places yet{isAdmin ? ": add the first one below." : "."}
              </p>
            ) : null}
            <ul className="places__list">
              {places.map((entry, i) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    aria-pressed={entry.id === place?.id}
                    className="place-row"
                    onClick={() => setPicked(entry.id)}
                  >
                    <span aria-hidden="true" className="place-row__num">
                      {i + 1}
                    </span>
                    <span className="place-row__text">
                      <span className="place-row__name">{entry.name}</span>
                      <span className="place-row__more">
                        {[entry.area, entry.cuisine]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {place ? (
              <div className="selected">
                <span className="tile__label">selected</span>
                <span className="selected__name">{place.name}</span>
                <span>{place.address}</span>
                <span>
                  {place.cuisine} ·{" "}
                  <a href={place.mapsUrl} target="_blank" rel="noreferrer">
                    open in Google Maps
                  </a>
                </span>
                {place.visitedOn || place.dish ? (
                  <span>
                    {[
                      place.visitedOn
                        ? `Visited ${visitedOf(place.visitedOn)}`
                        : "",
                      place.dish,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                ) : null}
                {place.photos.length > 0 ? (
                  <ul className="photos" aria-label={`Photos of ${place.name}`}>
                    {place.photos.map((photo) => (
                      <li key={photo.id}>
                        <button
                          type="button"
                          className="photo"
                          aria-label={
                            photo.caption
                              ? `Open photo: ${photo.caption}`
                              : "Open photo"
                          }
                          onClick={() => setViewing(photo)}
                        >
                          <img
                            src={photoUrl(photo, "thumb")}
                            alt=""
                            loading="lazy"
                          />
                        </button>
                        {isAdmin ? (
                          <button
                            type="button"
                            className="btn btn--pill btn--danger photo__remove"
                            aria-label={
                              armed === photo.id
                                ? "Sure? Press again to remove this photo"
                                : "Remove this photo"
                            }
                            onClick={() =>
                              press(photo.id, () => deletePhoto(place, photo))
                            }
                          >
                            {armed === photo.id ? (
                              "sure?"
                            ) : (
                              <Icon name="trash" size={16} />
                            )}
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {isAdmin ? (
                  <>
                    <AddPhoto
                      key={place.id}
                      place={place}
                      onAdded={(photo) =>
                        update(place.id, (old) => ({
                          ...old,
                          photos: [...old.photos, photo],
                        }))
                      }
                    />
                    <button
                      type="button"
                      className="btn btn--danger"
                      onClick={() =>
                        press(`place-${place.id}`, () => deletePlace(place))
                      }
                    >
                      <Icon name="trash" size={16} />
                      {armed === `place-${place.id}`
                        ? "sure? press again"
                        : `remove ${place.name}`}
                    </button>
                    <p className="form__error" role="status">
                      {problem}
                    </p>
                  </>
                ) : null}
              </div>
            ) : null}
          </fieldset>
        </div>
      </AppWindow>
      {isAdmin ? (
        <AddPlace
          onAdded={(added) => {
            setPlaces((old) => [added, ...old]);
            setPicked(added.id);
          }}
        />
      ) : null}
      <Viewer photo={viewing} onClose={() => setViewing(null)} />
    </>
  );
};
