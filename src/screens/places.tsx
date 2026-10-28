import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { AppWindow } from "../components/app-window";
import { ParisMap, pinStyle } from "../components/paris-map";
import * as admin from "../lib/admin";
import type { PlaceForm } from "../lib/admin";
import type { Me, Photo, Place } from "../lib/api";
import { Icon } from "../lib/icon";
import { ALL_PARIS } from "../lib/map";
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

const EMPTY: PlaceForm = {
  address: "",
  cuisine: "",
  dish: "",
  name: "",
  visitedOn: "",
};

/** Admins only: a new place, found on the map from its address. */
const AddPlace = ({ onAdded }: { onAdded: (place: Place) => void }) => {
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  const field = (key: keyof PlaceForm) => ({
    onChange: (event: { target: { value: string } }) =>
      setForm({ ...form, [key]: event.target.value }),
    value: form[key],
  });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setProblem("");

    try {
      onAdded(await admin.addPlace(form));
      setForm(EMPTY);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppWindow title="add_place.form" size="full">
      <form className="form" onSubmit={submit}>
        <div className="form__grid">
          <label>
            Name
            <input
              className="field"
              required
              maxLength={80}
              {...field("name")}
            />
          </label>
          <label>
            Address
            <input
              className="field"
              required
              maxLength={200}
              placeholder="12 rue de la Roquette, 75011"
              {...field("address")}
            />
          </label>
          <label>
            Cuisine
            <input
              className="field"
              maxLength={40}
              placeholder="Cambodian"
              {...field("cuisine")}
            />
          </label>
          <label>
            Visited on
            <input className="field" type="date" {...field("visitedOn")} />
          </label>
          <label>
            What I ate
            <input className="field" maxLength={120} {...field("dish")} />
          </label>
        </div>
        <div className="form__actions">
          <button type="submit" className="btn btn--primary" disabled={busy}>
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
          <ParisMap box={ALL_PARIS} minHeight={300}>
            {places.map((entry, i) => (
              <button
                key={entry.id}
                type="button"
                aria-pressed={entry.id === place?.id}
                aria-label={entry.name}
                className="pin pin--place"
                style={pinStyle(ALL_PARIS, entry.lat, entry.lon)}
                onClick={() => setPicked(entry.id)}
              >
                <Icon name="fork" size={16} />
                {i + 1}
              </button>
            ))}
          </ParisMap>
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
