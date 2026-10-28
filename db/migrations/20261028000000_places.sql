-- migrate:up
-- The restaurants Irma has eaten at, and the photos of each. The photos
-- themselves are in Garage, under photos/<id>/large.jpg and thumb.jpg; a
-- row here is what makes one show.
create table places (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 80),
  cuisine text not null default '' check (char_length(cuisine) <= 40),
  address text not null check (char_length(address) between 1 and 200),
  -- The arrondissement or town, from the geocoded address: "11e", "Montreuil".
  area text not null default '',
  visited_on date,
  dish text not null default '' check (char_length(dish) <= 120),
  lat double precision not null,
  lon double precision not null,
  created_at timestamptz not null default now()
);

create table place_photos (
  id uuid primary key,
  place_id bigint not null references places (id) on delete cascade,
  caption text not null default '' check (char_length(caption) <= 120),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  -- The account service's user id of the admin who added it.
  uploaded_by uuid not null,
  created_at timestamptz not null default now()
);

create index place_photos_place_id on place_photos (place_id, created_at);

-- migrate:down
drop table place_photos;
drop table places;
