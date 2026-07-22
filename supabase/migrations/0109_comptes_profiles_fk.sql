-- Permet d'imbriquer le profil du poster dans une requête sur `comptes`.
--
-- `comptes.poster_id` ne référençait que `auth.users`. PostgREST ne savait donc
-- pas relier `comptes` à `public.profiles`, et tout embed `profiles(...)`
-- partait en 400 — la liste des comptes du test complet, comme le calendrier
-- admin, revenaient vides sans le moindre message.
--
-- `profiles.id` EST déjà l'id de `auth.users`, donc cette contrainte
-- supplémentaire est toujours satisfaite. Les deux FK coexistent.

alter table public.comptes
  drop constraint if exists comptes_poster_id_profiles_fkey;

alter table public.comptes
  add constraint comptes_poster_id_profiles_fkey
  foreign key (poster_id) references public.profiles (id) on delete cascade;
