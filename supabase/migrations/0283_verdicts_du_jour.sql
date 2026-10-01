-- 0283 — Verdicts rendus le jour même sur les cycles pleins (01/10/2026).
--
-- Après le rattrapage du relevé (0281/0282), 116 slideshows avaient un cycle
-- plein en attente de verdict : leurs passages des 28 au 30/09 n'avaient été
-- mesurés que le 01/10, et la requalification attend 2 jours de recul
-- (MESURE_JOURS). Le pool tirable était à 0,2 jour. Décision d'Adrien : juger
-- aujourd'hui avec les vues relevées, quel que soit leur âge.
--
-- requalifier() de tierlist.ts est répliqué à l'identique (bandes absolues,
-- un cran de descente au plus, 1 000 vues pour sortir de D), sur la moyenne
-- des vues relevées du cycle. Trois décisions :
--
--   juge              (38) le verdict est appliqué ;
--   descente_reportee (33) le verdict serait une DESCENTE fondée sur au moins
--                          une vue de moins de 2 jours : le tier est gardé et
--                          le cycle rouvert. Une vue à J+0 vaut ~45 % de la
--                          valeur à J+2 (médianes 676 contre 1 491) : une
--                          montée sur vues jeunes reste vraie, une descente est
--                          probablement fausse — c'est la classe d'erreur que
--                          0282 venait de corriger ;
--   rouvert            (5) aucun passage publié, créneau passé : tier inchangé,
--                          cycle rouvert (la règle du moteur pour un cycle
--                          entièrement périmé, appliquée sans attendre 4 jours).
--
-- Les 39 cycles dont un passage du jour n'est pas encore publié ou mesuré ne
-- sont pas touchés : ils n'ont rien à juger.
--
-- Chaque ligne est gardée par le tier ET le tier_maj_at lus au calcul : un
-- slideshow requalifié entre-temps par le moteur n'est pas réécrit. Le trigger
-- de 0272 journalise une `requalification` (tier_maj_at bouge).

create table if not exists public.verdicts_du_jour_sauvegarde (
  contenu_id uuid not null,
  tier text,
  passages_cible integer,
  tier_maj_at timestamptz,
  decision text not null,
  moyenne_vues integer,
  sauve_le timestamptz not null default now()
);
alter table public.verdicts_du_jour_sauvegarde enable row level security;

create temp table verdicts_0283 (
  contenu_id uuid primary key,
  tier_avant text not null,
  tier_apres text not null,
  cible_apres integer not null,
  tier_maj_at_avant timestamptz not null,
  decision text not null,
  moyenne_vues integer
) on commit drop;

insert into verdicts_0283 values
  ('09c607a2-d0a7-4a18-8ea4-7968f7b68558'::uuid, 'C', 'C', 1, '2026-09-29 22:00:13.897+00'::timestamptz, 'descente_reportee', 497),
  ('0c61339e-a406-4b32-9dc7-15d723289870'::uuid, 'C', 'C', 1, '2026-09-27 22:13:19.771+00'::timestamptz, 'descente_reportee', 215),
  ('0cec3333-03a3-4ea4-bc68-d64675ae8f16'::uuid, 'B', 'B', 1, '2026-09-28 22:16:35.252+00'::timestamptz, 'descente_reportee', 799),
  ('17277702-d488-492e-8adc-4f465a492a5e'::uuid, 'S', 'S', 4, '2026-09-27 22:09:35.51+00'::timestamptz, 'descente_reportee', 3040),
  ('2ec701c9-960f-48e6-b9ac-c3f217141ea2'::uuid, 'A', 'A', 2, '2026-09-30 11:00:35.254+00'::timestamptz, 'descente_reportee', 2200),
  ('36cb4e8a-1ebc-447a-bd3a-3fbbee9e098c'::uuid, 'C', 'C', 1, '2026-09-28 11:15:07.291+00'::timestamptz, 'descente_reportee', 376),
  ('3bd80908-7451-4bd6-8716-6abed1bf77cf'::uuid, 'C', 'C', 1, '2026-09-29 22:00:44.419+00'::timestamptz, 'descente_reportee', 582),
  ('436a59e2-8a0f-4bb5-abf3-0145048c9b1c'::uuid, 'B', 'B', 1, '2026-09-28 11:03:32.432+00'::timestamptz, 'descente_reportee', 654),
  ('466bb7ba-8f18-4430-9148-55d8c51f7c18'::uuid, 'B', 'B', 1, '2026-09-28 22:16:35.097+00'::timestamptz, 'descente_reportee', 38),
  ('4c01fdfb-6e78-43a1-acca-e01b6cd3ef80'::uuid, 'B', 'B', 1, '2026-09-26 21:47:37.899+00'::timestamptz, 'descente_reportee', 511),
  ('4cdc5247-98c5-4deb-91ec-35139d9900e3'::uuid, 'C', 'C', 1, '2026-09-23 22:06:38.944+00'::timestamptz, 'descente_reportee', 598),
  ('4e0ef857-d35d-4b44-b6f9-371e615b9f76'::uuid, 'B', 'B', 1, '2026-09-29 22:00:13.628+00'::timestamptz, 'descente_reportee', 271),
  ('5276a285-0b0f-4d96-8d7e-6a9d86139625'::uuid, 'A', 'A', 2, '2026-09-29 22:00:59.726+00'::timestamptz, 'descente_reportee', 934),
  ('55f45633-adbd-449f-ac72-d9cedfc4fc76'::uuid, 'B', 'B', 1, '2026-09-29 22:00:21.473+00'::timestamptz, 'descente_reportee', 569),
  ('60ad5cf8-b17b-4265-8145-813ce203a560'::uuid, 'B', 'B', 1, '2026-09-29 22:00:42.775+00'::timestamptz, 'descente_reportee', 721),
  ('74631e47-8501-4470-a943-60df91c55aff'::uuid, 'B', 'B', 1, '2026-09-29 22:00:21.332+00'::timestamptz, 'descente_reportee', 630),
  ('8457a346-bcaa-48ad-a069-5799ba72bfec'::uuid, 'B', 'B', 1, '2026-09-27 22:08:10.456+00'::timestamptz, 'descente_reportee', 546),
  ('86230506-05cd-46e2-abd9-cccea2ccd488'::uuid, 'C', 'C', 1, '2026-09-29 11:00:10.13+00'::timestamptz, 'descente_reportee', 535),
  ('8cc091c3-198f-4b3c-b709-306f9fed144a'::uuid, 'B', 'B', 1, '2026-09-29 22:00:48.175+00'::timestamptz, 'descente_reportee', 685),
  ('92c17bf6-3f4f-48c9-a6c0-b0eb5da1e8d2'::uuid, 'A', 'A', 2, '2026-09-28 11:04:30.471+00'::timestamptz, 'descente_reportee', 3650),
  ('9422050b-869c-43d3-8e71-a410007ff40e'::uuid, 'S', 'S', 4, '2026-09-28 11:03:32.391+00'::timestamptz, 'descente_reportee', 2562),
  ('9778a9db-b38d-4f6e-a187-1423c97f84e8'::uuid, 'B', 'B', 1, '2026-09-29 11:00:11.573+00'::timestamptz, 'descente_reportee', 76),
  ('9c9238c6-51b5-4af2-95a8-ab35cbd59476'::uuid, 'B', 'B', 1, '2026-09-29 22:00:15.723+00'::timestamptz, 'descente_reportee', 266),
  ('b11dbc97-f151-4726-b087-02e677c3840c'::uuid, 'B', 'B', 1, '2026-09-28 22:16:35.429+00'::timestamptz, 'descente_reportee', 450),
  ('b947da0c-14d5-442f-b918-52b927a7e55a'::uuid, 'S', 'S', 4, '2026-09-28 11:11:25.373+00'::timestamptz, 'descente_reportee', 21595),
  ('bc546a2d-fe63-4b69-8867-186871a5f767'::uuid, 'B', 'B', 1, '2026-09-28 22:16:35.575+00'::timestamptz, 'descente_reportee', 543),
  ('bedecf53-a6af-4a81-b387-99a84679006f'::uuid, 'B', 'B', 1, '2026-09-29 22:00:17.096+00'::timestamptz, 'descente_reportee', 25),
  ('dda3c488-9c6e-4847-85ca-7f872f1e05cc'::uuid, 'B', 'B', 1, '2026-09-28 22:14:29.625+00'::timestamptz, 'descente_reportee', 349),
  ('dec0365e-3983-4d9b-86cf-4f118a067c03'::uuid, 'B', 'B', 1, '2026-09-28 22:16:35.48+00'::timestamptz, 'descente_reportee', 966),
  ('dee3219b-a078-4765-8f21-9abc2091381c'::uuid, 'A', 'A', 2, '2026-09-27 22:08:30.136+00'::timestamptz, 'descente_reportee', 2999),
  ('df5445f3-2312-4735-be1d-7bfe4e9c3c40'::uuid, 'A', 'A', 2, '2026-09-27 22:09:07.198+00'::timestamptz, 'descente_reportee', 1956),
  ('e7422935-c02e-4420-92bd-04fa6d25ea5d'::uuid, 'C', 'C', 1, '2026-09-27 22:13:21.104+00'::timestamptz, 'descente_reportee', 422),
  ('eb647307-93d9-4aa4-bcdb-b2d667a4b450'::uuid, 'B', 'B', 1, '2026-09-29 11:00:23.939+00'::timestamptz, 'descente_reportee', 744),
  ('01afbec2-2f82-4cb1-97e2-9ded14c5b8f1'::uuid, 'C', 'B', 1, '2026-09-28 22:01:02.922+00'::timestamptz, 'juge', 1071),
  ('04ccfb51-e57f-4425-b83e-fdb6265e9667'::uuid, 'B', 'S', 4, '2026-09-28 11:13:36.181+00'::timestamptz, 'juge', 54100),
  ('10c662f6-3802-4639-89e5-f2a50af88deb'::uuid, 'C', 'B', 1, '2026-09-22 11:35:05.843+00'::timestamptz, 'juge', 1309),
  ('2cd5ac77-b7e5-4a3b-b19c-6fd58f4a53c5'::uuid, 'B', 'A', 2, '2026-09-27 22:10:12.826+00'::timestamptz, 'juge', 6792),
  ('2e4ddf31-9026-40c0-896e-bdfd45e5be8f'::uuid, 'B', 'B', 1, '2026-09-29 22:00:15.666+00'::timestamptz, 'juge', 1345),
  ('35ff7bf9-7756-4d37-852c-b63434562d11'::uuid, 'C', 'B', 1, '2026-09-22 11:32:53.127+00'::timestamptz, 'juge', 1274),
  ('3b2933dc-91dc-4967-912c-4cfce6f07d3e'::uuid, 'B', 'B', 1, '2026-09-30 22:00:25.54+00'::timestamptz, 'juge', 1307),
  ('3b7b8acd-1db9-4eb3-abca-1c3c0f31ceb6'::uuid, 'B', 'B', 1, '2026-09-23 22:02:59.52+00'::timestamptz, 'juge', 4419),
  ('4211027a-df9f-40d5-b4ed-549199d77a4b'::uuid, 'B', 'B', 1, '2026-09-29 22:00:15.593+00'::timestamptz, 'juge', 1187),
  ('42c35251-eba3-4cff-93a2-41316e51a5fb'::uuid, 'A', 'S', 4, '2026-09-27 11:04:33.167+00'::timestamptz, 'juge', 31962),
  ('497f478c-28c9-4ce3-9b55-d52d2e31d00e'::uuid, 'B', 'B', 1, '2026-09-29 22:00:13.428+00'::timestamptz, 'juge', 2028),
  ('550542d9-b245-415d-aa5b-36e0bff17be7'::uuid, 'A', 'A', 2, '2026-09-26 21:37:56.164+00'::timestamptz, 'juge', 5651),
  ('5cc2bb38-cd4d-49f3-94bb-d54663a7efcc'::uuid, 'B', 'B', 1, '2026-09-28 11:11:42.694+00'::timestamptz, 'juge', 1239),
  ('607fe062-d6d2-43b2-a715-de2fd425f0f0'::uuid, 'B', 'B', 1, '2026-09-29 22:00:13.313+00'::timestamptz, 'juge', 3202),
  ('71c14d71-753a-446c-a328-01843710dce5'::uuid, 'C', 'C', 1, '2026-09-22 11:26:30.306+00'::timestamptz, 'juge', 791),
  ('71fa02d1-cd9e-435d-bcb1-19eda1ea6557'::uuid, 'C', 'C', 1, '2026-09-22 11:20:56.004+00'::timestamptz, 'juge', 985),
  ('78e85e05-1672-4730-aa1c-6b985b2f72a8'::uuid, 'B', 'B', 1, '2026-09-28 11:02:25.129+00'::timestamptz, 'juge', 2031),
  ('7e4b6ec0-d768-4aa0-9f11-0bf90397c452'::uuid, 'B', 'B', 1, '2026-09-30 22:00:15.82+00'::timestamptz, 'juge', 2460),
  ('7e80f0f5-bd3b-4204-a931-6f6739eff98e'::uuid, 'B', 'B', 1, '2026-09-28 22:11:18.487+00'::timestamptz, 'juge', 1250),
  ('8264527a-26fb-4d2f-bfd3-d3a097d4eb2d'::uuid, 'C', 'B', 1, '2026-09-25 22:00:52.591+00'::timestamptz, 'juge', 1186),
  ('835c1781-1f6b-416c-89eb-c94f96aba416'::uuid, 'A', 'A', 2, '2026-09-26 21:49:59.75+00'::timestamptz, 'juge', 5048),
  ('87d8b906-aef7-4466-aab5-de61dfe4c0c0'::uuid, 'B', 'B', 1, '2026-09-28 11:09:11.672+00'::timestamptz, 'juge', 1723),
  ('8ebb5041-2b66-463c-8b70-fe4ebe33178c'::uuid, 'B', 'A', 2, '2026-09-30 11:00:10.666+00'::timestamptz, 'juge', 9856),
  ('90dbf522-20c8-478b-b1da-fb3ad7570eb5'::uuid, 'B', 'B', 1, '2026-09-29 22:00:59.809+00'::timestamptz, 'juge', 2995),
  ('9165c9c8-ac22-428c-9286-1a92e6b0992a'::uuid, 'C', 'B', 1, '2026-09-30 11:00:10.797+00'::timestamptz, 'juge', 1389),
  ('9257417d-9805-4185-9e91-5d725f42833c'::uuid, 'B', 'B', 1, '2026-09-29 22:00:21.701+00'::timestamptz, 'juge', 1096),
  ('a3389b9b-a5cc-4803-8863-04939804d472'::uuid, 'B', 'B', 1, '2026-09-26 21:48:00.364+00'::timestamptz, 'juge', 1503),
  ('ad9a4090-f85d-4bd3-823b-6cd5b9da4b88'::uuid, 'B', 'B', 1, '2026-09-28 22:11:58.957+00'::timestamptz, 'juge', 1367),
  ('b054d611-fcb6-4178-bf13-69ca2b8d821a'::uuid, 'C', 'B', 1, '2026-09-28 11:10:15.87+00'::timestamptz, 'juge', 1750),
  ('c206f363-c2ac-422b-9227-6a492d17fbbc'::uuid, 'B', 'A', 2, '2026-09-28 22:12:22.633+00'::timestamptz, 'juge', 6090),
  ('cacf04c7-3f5a-44f7-8144-e8d93058afde'::uuid, 'B', 'B', 1, '2026-09-28 22:16:33.656+00'::timestamptz, 'juge', 2193),
  ('d628759d-ac4e-4d53-9a72-b8d59ebf877b'::uuid, 'C', 'B', 1, '2026-09-30 22:00:21.807+00'::timestamptz, 'juge', 4598),
  ('e1b5ef61-7006-4c34-8f3c-bec9f073e16a'::uuid, 'B', 'B', 1, '2026-09-29 22:00:56.569+00'::timestamptz, 'juge', 1972),
  ('f31dbaeb-275d-4104-a0aa-3b308982fe71'::uuid, 'B', 'B', 1, '2026-09-29 22:00:13.736+00'::timestamptz, 'juge', 1048),
  ('f4e37908-608a-4788-a77e-6742776d315d'::uuid, 'B', 'C', 1, '2026-09-27 22:13:21.03+00'::timestamptz, 'juge', 935),
  ('f579bdae-2eae-4e58-9a77-f85bbc53135d'::uuid, 'B', 'B', 1, '2026-09-28 22:04:18.761+00'::timestamptz, 'juge', 1471),
  ('fb298bf4-9a0a-4318-8a33-799c754bbe8e'::uuid, 'C', 'C', 1, '2026-09-22 08:41:34.858+00'::timestamptz, 'juge', 804),
  ('fc397d09-c2b9-4ded-af11-32f2af44f046'::uuid, 'B', 'B', 1, '2026-09-27 22:09:35.549+00'::timestamptz, 'juge', 1953),
  ('23ab67f8-7f89-4eba-9985-9172e376a5e3'::uuid, 'C', 'C', 1, '2026-09-28 11:17:03.666+00'::timestamptz, 'rouvert', null),
  ('988a867a-bdeb-4616-bbe3-81465a62c87d'::uuid, 'B', 'B', 1, '2026-09-29 22:00:15.786+00'::timestamptz, 'rouvert', null),
  ('d19c4ff8-2955-4f30-89c2-2150365248a2'::uuid, 'B', 'B', 1, '2026-09-27 11:04:33.092+00'::timestamptz, 'rouvert', null),
  ('e59d032c-78f6-4a56-8549-958fbdad36e1'::uuid, 'C', 'C', 1, '2026-09-27 11:02:51.795+00'::timestamptz, 'rouvert', null),
  ('ff91768b-2f54-4b18-9e4e-a70acf86d5ba'::uuid, 'B', 'B', 1, '2026-09-29 22:00:40.623+00'::timestamptz, 'rouvert', null);

-- L'état d'avant d'abord (leçon de 0262).
insert into public.verdicts_du_jour_sauvegarde
  (contenu_id, tier, passages_cible, tier_maj_at, decision, moyenne_vues)
select c.id, c.tier, c.passages_cible, c.tier_maj_at, v.decision, v.moyenne_vues
from verdicts_0283 v
join public.contenus c on c.id = v.contenu_id
where c.tier = v.tier_avant and c.tier_maj_at = v.tier_maj_at_avant;

update public.contenus c
set tier = v.tier_apres,
    passages_cible = v.cible_apres,
    tier_maj_at = now()
from verdicts_0283 v
where c.id = v.contenu_id
  and c.tier = v.tier_avant
  and c.tier_maj_at = v.tier_maj_at_avant;
