import type { Pool } from "pg";

import type { Photo, Place } from "../src/lib/api";

export interface NewPlace {
  name: string;
  cuisine: string;
  address: string;
  area: string;
  visitedOn: string | null;
  dish: string;
  lat: number;
  lon: number;
}

export interface NewPhoto {
  id: string;
  placeId: string;
  caption: string;
  width: number;
  height: number;
  uploadedBy: string;
}

interface PlaceRow {
  id: string;
  name: string;
  cuisine: string;
  address: string;
  area: string;
  visited_on: string | null;
  dish: string;
  lat: number;
  lon: number;
  photos: Photo[];
}

const toPlace = (row: PlaceRow): Place => ({
  address: row.address,
  area: row.area,
  cuisine: row.cuisine,
  dish: row.dish,
  id: row.id,
  lat: row.lat,
  lon: row.lon,
  name: row.name,
  photos: row.photos,
  visitedOn: row.visited_on,
});

const SELECT_PLACES = `
  select p.id::text, p.name, p.cuisine, p.address, p.area,
         to_char(p.visited_on, 'YYYY-MM-DD') as visited_on, p.dish, p.lat, p.lon,
         coalesce(
           json_agg(
             json_build_object('id', ph.id, 'caption', ph.caption, 'width', ph.width, 'height', ph.height)
             order by ph.created_at
           ) filter (where ph.id is not null),
           '[]'
         ) as photos
    from places p
    left join place_photos ph on ph.place_id = p.id`;

/** Every place, the most recently visited first, each with its photos in the order they were added. */
export const readPlaces = async (pool: Pool): Promise<Place[]> => {
  const { rows } = await pool.query<PlaceRow>(
    `${SELECT_PLACES}
     group by p.id
     order by p.visited_on desc nulls last, p.id desc`
  );

  return rows.map(toPlace);
};

export const addPlace = async (pool: Pool, place: NewPlace): Promise<Place> => {
  const { rows } = await pool.query<{ id: string }>(
    `insert into places (name, cuisine, address, area, visited_on, dish, lat, lon)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning id::text`,
    [
      place.name,
      place.cuisine,
      place.address,
      place.area,
      place.visitedOn,
      place.dish,
      place.lat,
      place.lon,
    ]
  );

  return { ...place, id: rows[0]?.id ?? "", photos: [] };
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
    `insert into place_photos (id, place_id, caption, width, height, uploaded_by)
     select $1, id, $3, $4, $5, $6 from places where id = $2`,
    [
      photo.id,
      photo.placeId,
      photo.caption,
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
