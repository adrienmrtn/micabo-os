-- « Could not embed because more than one relationship was found for 'comptes'
-- and 'profiles' » — sur la surveillance, la fiche créateur, le calendrier, la
-- QA TikTok… partout où l'OS lit un compte avec son poster.
--
-- C'est 0253 qui a cassé ça. J'y ai ajouté trois colonnes d'audit —
-- `qualification_manuelle_par`, `ne_pas_renouveler_par`, `hm_prevenu_par` — et
-- je leur ai mis, par réflexe, une clé étrangère vers `profiles`. `comptes`
-- pointait donc vers `profiles` par QUATRE chemins au lieu d'un.
--
-- PostgREST résout `comptes(… profiles(…))` par la clé étrangère. Avec
-- plusieurs candidates il refuse de choisir et renvoie une erreur — pas une
-- ligne de moins, l'écran entier. Une colonne ajoutée dans un coin a donc
-- éteint des pages qui n'ont rien à voir avec la qualification.
--
-- Deux façons d'en sortir :
--
--   a) nommer la clé dans chacune des sept requêtes concernées
--      (`profiles!comptes_poster_id_profiles_fkey(…)`) — ça marche, mais ça
--      recopie un nom de contrainte dans sept fichiers et la prochaine colonne
--      d'audit rouvrira le même trou ailleurs ;
--   b) supprimer l'ambiguïté à la source.
--
-- (b). Ces trois colonnes sont des TAMPONS : « qui a cliqué, quand ». Elles ne
-- servent à aucune jointure, aucun écran ne les suit jusqu'au profil. Leur
-- intégrité référentielle ne vaut pas la peine de casser tous les embeds de
-- l'application : un uuid orphelin après suppression d'un admin est sans
-- conséquence, une page blanche non.
--
-- `comptes_nudges` portait le même piège en germe (`poster_id` ET
-- `envoye_par`) : la deuxième part aussi, avant que quelqu'un n'embarque le
-- profil de l'expéditeur et ne rouvre le même bug.
--
-- Règle à retenir : **une table ne doit avoir qu'une seule clé étrangère vers
-- une table qu'on embarque en PostgREST.** Une colonne « qui a fait ça » se
-- stocke en uuid nu.
--
-- Aucun cron n'est planifié ici. Conforme à AGENTS.md.

alter table public.comptes
  drop constraint if exists comptes_qualification_manuelle_par_fkey,
  drop constraint if exists comptes_ne_pas_renouveler_par_fkey,
  drop constraint if exists comptes_hm_prevenu_par_fkey;

alter table public.comptes_nudges
  drop constraint if exists comptes_nudges_envoye_par_fkey;

comment on column public.comptes.qualification_manuelle_par is
  'Qui a posé la case à la main. Uuid nu, SANS clé étrangère : une deuxième clé vers profiles rendrait tous les embeds comptes → profiles ambigus.';
comment on column public.comptes.ne_pas_renouveler_par is
  'Qui a mis le compte sur la liste. Uuid nu, sans clé étrangère (voir qualification_manuelle_par).';
comment on column public.comptes.hm_prevenu_par is
  'Qui a coché « HM prévenu ». Uuid nu, sans clé étrangère (voir qualification_manuelle_par).';
comment on column public.comptes_nudges.envoye_par is
  'Qui a envoyé le nudge. Uuid nu, sans clé étrangère : poster_id est le seul lien comptes_nudges → profiles.';
