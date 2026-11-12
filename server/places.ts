import type { Pool } from "pg";

import type { Photo, Place, Ratings } from "../src/lib/api";

export interface NewPlace {
  googlePlaceId: string;
  mapsUrl: string;
  name: string;
  cuisine: string;
  address: string;
  area: string;
  ratings: Ratings;
  lat: number;
  lon: number;
}

export interface NewPhoto {
  id: string;
  placeId: string;
  notes: string;
  width: number;
  height: number;
  uploadedBy: string;
}

interface PlaceRow {
  id: string;
  google_maps_url: string | null;
  name: string;
  cuisine: string;
  address: string;
  area: string;
  rating_service: number | null;
  rating_food: number | null;
  rating_value: number | null;
  rating_toilet: number | null;
  lat: number;
  lon: number;
  photos: Photo[];
}

const toPlace = (row: PlaceRow): Place => ({
  address: row.address,
  area: row.area,
  cuisine: row.cuisine,
  id: row.id,
  lat: row.lat,
  lon: row.lon,
  mapsUrl: row.google_maps_url,
  name: row.name,
  photos: row.photos,
  ratings: {
    food: row.rating_food,
    service: row.rating_service,
    toilet: row.rating_toilet,
    value: row.rating_value,
  },
});

const SELECT_PLACES = `
  select p.id::text, p.google_maps_url, p.name, p.cuisine, p.address, p.area,
         p.rating_service, p.rating_food, p.rating_value, p.rating_toilet, p.lat, p.lon,
         coalesce(
           json_agg(
             json_build_object('id', ph.id, 'notes', ph.notes, 'width', ph.width, 'height', ph.height)
             order by ph.created_at
           ) filter (where ph.id is not null),
           '[]'
         ) as photos
    from places p
    left join place_photos ph on ph.place_id = p.id`;

/** Every place, the most recently added first, each with its photos in the order they were added. */
export const readPlaces = async (pool: Pool): Promise<Place[]> => {
  const { rows } = await pool.query<PlaceRow>(
    `${SELECT_PLACES}
     group by p.id
     order by p.id desc`
  );

  return rows.map(toPlace);
};

/** The new place, or null when that Google place is already on the map. */
export const addPlace = async (
  pool: Pool,
  place: NewPlace
): Promise<Place | null> => {
  const { rows } = await pool.query<{ id: string }>(
    `insert into places (google_place_id, google_maps_url, name, cuisine, address, area,
                         rating_service, rating_food, rating_value, rating_toilet, lat, lon)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     on conflict (google_place_id) do nothing
     returning id::text`,
    [
      place.googlePlaceId,
      place.mapsUrl,
      place.name,
      place.cuisine,
      place.address,
      place.area,
      place.ratings.service,
      place.ratings.food,
      place.ratings.value,
      place.ratings.toilet,
      place.lat,
      place.lon,
    ]
  );

  const [row] = rows;

  if (!row) {
    return null;
  }

  const { googlePlaceId: _id, ...shown } = place;

  return { ...shown, id: row.id, photos: [] };
};

/** False when there is no such place. */
export const rate = async (
  pool: Pool,
  id: string,
  ratings: Ratings
): Promise<boolean> => {
  const { rowCount } = await pool.query(
    `update places
        set rating_service = $2, rating_food = $3, rating_value = $4, rating_toilet = $5
      where id = $1`,
    [id, ratings.service, ratings.food, ratings.value, ratings.toilet]
  );

  return rowCount === 1;
};

/** The ids of the photos that went with it, so their files can go too; null when there was no such place. */
export const removePlace = async (
  pool: Pool,
  id: string
): Promise<string[] | null> => {
  const { rows } = await pool.query<{ id: string }>(
    "select id from place_photos where place_id = $1",
    [id]
  );

  const { rowCount } = await pool.query("delete from places where id = $1", [
    id,
  ]);

  return rowCount ? rows.map((row) => row.id) : null;
};

/** False when there is no such place. */
export const addPhoto = async (
  pool: Pool,
  photo: NewPhoto
): Promise<boolean> => {
  const { rowCount } = await pool.query(
    `insert into place_photos (id, place_id, notes, width, height, uploaded_by)
     select $1, id, $3, $4, $5, $6 from places where id = $2`,
    [
      photo.id,
      photo.placeId,
      photo.notes,
      photo.width,
      photo.height,
      photo.uploadedBy,
    ]
  );

  return rowCount === 1;
};

/** False when there is no such photo. */
export const removePhoto = async (pool: Pool, id: string): Promise<boolean> => {
  const { rowCount } = await pool.query(
    "delete from place_photos where id = $1",
    [id]
  );

  return rowCount === 1;
};

export const photoExists = async (pool: Pool, id: string): Promise<boolean> => {
  const { rowCount } = await pool.query(
    "select 1 from place_photos where id = $1",
    [id]
  );

  return rowCount === 1;
};
