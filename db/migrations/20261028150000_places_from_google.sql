-- migrate:up
-- Places are now picked from Google Maps: its id for each restaurant, so
-- one goes on the map once, and its link. Places added before, from an
-- address, have neither. Google's names and addresses run longer than the
-- first limits allowed.
alter table places
  add column google_place_id text unique,
  add column google_maps_url text;

alter table places
  drop constraint places_name_check,
  add constraint places_name_check check (char_length(name) between 1 and 200),
  drop constraint places_address_check,
  add constraint places_address_check check (char_length(address) between 1 and 300);

-- migrate:down
alter table places
  drop constraint places_name_check,
  add constraint places_name_check check (char_length(name) between 1 and 80),
  drop constraint places_address_check,
  add constraint places_address_check check (char_length(address) between 1 and 200);

alter table places
  drop column google_maps_url,
  drop column google_place_id;
