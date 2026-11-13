-- migrate:up
-- Each restaurant is rated out of five for its service, its food, its price
-- for that food and its toilets; each may stay unrated. The visit's date and
-- dish are no longer kept, and a photo's caption is now its notes.
alter table places
  add column rating_service smallint check (rating_service between 1 and 5),
  add column rating_food smallint check (rating_food between 1 and 5),
  add column rating_value smallint check (rating_value between 1 and 5),
  add column rating_toilet smallint check (rating_toilet between 1 and 5),
  drop column visited_on,
  drop column dish;

alter table place_photos rename column caption to notes;

alter table place_photos
  drop constraint place_photos_caption_check,
  add constraint place_photos_notes_check check (char_length(notes) <= 500);

-- migrate:down
-- Only the notes too long for the old caption limit are shortened.
update place_photos set notes = left(notes, 120) where char_length(notes) > 120;

alter table place_photos
  drop constraint place_photos_notes_check,
  add constraint place_photos_caption_check check (char_length(notes) <= 120);

alter table place_photos rename column notes to caption;

alter table places
  add column visited_on date,
  add column dish text not null default '' check (char_length(dish) <= 120),
  drop column rating_toilet,
  drop column rating_value,
  drop column rating_food,
  drop column rating_service;
