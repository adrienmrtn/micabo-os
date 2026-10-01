-- 0282 — Les verdicts rendus pendant la panne Apify, rejugés sur les vraies vues (01/10/2026).
--
-- Du 28/09 22:16 au 01/10 10:27 UTC, Apify répondait 402 : plus aucun relevé.
-- La requalification a pourtant continué de tourner, sur des vues figées
-- (relevées à J+0 ou J+1, ~70 % du réel) ou sur des cycles visés mais jamais
-- mesurés (défaut corrigé par 0281). 70 verdicts rendus dans la fenêtre.
--
-- Une fois le relevé rattrapé (340 passages le 01/10 entre 10:27 et 10:40
-- UTC), chaque verdict a été recalculé avec les règles du moteur
-- (`bilanCycle` + `requalifier`, répliqués en SQL et recoupés cas par cas avec
-- les fonctions TS) : MÊME cycle (passages créés entre le verdict précédent et
-- celui-ci), MÊME instant de jugement, vues d'aujourd'hui. 21 verdicts
-- diffèrent, tous encore en vigueur (aucune vraie requalification depuis ; un
-- repêchage D→D ne compte pas) :
--   - 12 descentes d'un cran à tort : dix B→C à 1 060 – 4 250 vues de
--     moyenne, deux C→D à 611 et 869 vues (au-dessus des 600 du C) ;
--   - 5 slideshows envoyés ou laissés en D à 1 108 – 2 678 vues : leur place
--     est B (il faut 1 000 vues pour sortir de D, ils les ont) ;
--   - 3 qui devaient monter en S (31 258 à 52 100 vues), laissés en A ;
--   - 1 C maintenu qui devait monter en B (2 521 vues).
--
-- On corrige le TIER et la CIBLE, pas `tier_maj_at` : le cycle en cours n'est
-- pas rouvert, il change seulement de cible. Le trigger de 0272 journalise donc
-- un `ajustement`, pas une requalification — la trace reste lisible.
--
-- Garde : la ligne n'est touchée que si le slideshow porte toujours le tier
-- rendu ET le même `tier_maj_at` qu'au calcul. Un slideshow requalifié entre
-- le calcul et l'application garde son verdict frais.
--
-- Sauvegarde d'abord (leçon de 0262).

create table if not exists public.verdicts_figes_sauvegarde (
  id bigserial primary key,
  fait_le timestamptz not null default now(),
  contenu_id uuid not null,
  tier text,
  passages_cible integer,
  tier_maj_at timestamptz,
  tier_rendu text not null,
  tier_juste text not null,
  m_juste numeric
);

comment on table public.verdicts_figes_sauvegarde is
  'État d''avant la correction 0282 des verdicts de tier rendus pendant la panne Apify (28/09 22:16 → 01/10 10:27 UTC).';

-- Données métier : personne d'autre que le service n'a à la lire.
alter table public.verdicts_figes_sauvegarde enable row level security;

create table if not exists public.verdicts_figes_0282 (
  contenu_id uuid primary key,
  tier_avant text not null,
  tier_rendu text not null,
  tier_juste text not null,
  cible_juste integer not null,
  m_juste numeric not null,
  tier_maj_at timestamptz not null
);
alter table public.verdicts_figes_0282 enable row level security;

insert into public.verdicts_figes_0282
  (contenu_id, tier_avant, tier_rendu, tier_juste, cible_juste, m_juste, tier_maj_at)
values
  ('b7ce76db-7b69-40a0-baee-e8314d38b363'::uuid, 'C', 'D', 'B', 1, 2678, '2026-09-30T22:01:18.435373+00:00'::timestamptz),
  ('0bcc52c4-cb02-4c0d-ae56-98bb40ba1972'::uuid, 'C', 'C', 'B', 1, 2521, '2026-09-28T22:16:13.211+00:00'::timestamptz),
  ('bcb9d216-e6fe-4885-bb18-f730ec119bfe'::uuid, 'C', 'D', 'C', 1, 869, '2026-09-30T22:01:26.871394+00:00'::timestamptz),
  ('766074b1-379b-432e-8469-c8a805b904af'::uuid, 'C', 'A', 'S', 4, 52100, '2026-09-28T22:16:35.53+00:00'::timestamptz),
  ('a4d61d32-cd9a-483f-b41f-0ad9e061c96f'::uuid, 'C', 'D', 'B', 1, 1108, '2026-09-30T22:01:05.77388+00:00'::timestamptz),
  ('607fe062-d6d2-43b2-a715-de2fd425f0f0'::uuid, 'B', 'C', 'B', 1, 4251, '2026-09-29T22:00:13.313+00:00'::timestamptz),
  ('497f478c-28c9-4ce3-9b55-d52d2e31d00e'::uuid, 'B', 'C', 'B', 1, 2512, '2026-09-29T22:00:13.428+00:00'::timestamptz),
  ('57d07ce9-f743-4b43-9f08-4844aa7fee9e'::uuid, 'C', 'D', 'C', 1, 611, '2026-09-30T22:01:36.864762+00:00'::timestamptz),
  ('f31dbaeb-275d-4104-a0aa-3b308982fe71'::uuid, 'B', 'C', 'B', 1, 1341, '2026-09-29T22:00:13.736+00:00'::timestamptz),
  ('988a867a-bdeb-4616-bbe3-81465a62c87d'::uuid, 'B', 'C', 'B', 1, 2005, '2026-09-29T22:00:15.786+00:00'::timestamptz),
  ('74631e47-8501-4470-a943-60df91c55aff'::uuid, 'B', 'C', 'B', 1, 1569, '2026-09-29T22:00:21.332+00:00'::timestamptz),
  ('85379b9e-3fde-4c0d-ae60-7294cf4c7e18'::uuid, 'A', 'A', 'S', 4, 36554, '2026-09-29T22:00:42.682+00:00'::timestamptz),
  ('60ad5cf8-b17b-4265-8145-813ce203a560'::uuid, 'B', 'C', 'B', 1, 1366, '2026-09-29T22:00:42.775+00:00'::timestamptz),
  ('e1b5ef61-7006-4c34-8f3c-bec9f073e16a'::uuid, 'B', 'C', 'B', 1, 1536, '2026-09-29T22:00:56.569+00:00'::timestamptz),
  ('0949587a-3346-47a6-95f4-e5f62b962ba1'::uuid, 'C', 'D', 'B', 1, 1556, '2026-09-30T22:01:36.067723+00:00'::timestamptz),
  ('c001d578-e391-41e6-9020-9eaf3d79eed1'::uuid, 'B', 'C', 'B', 1, 1060, '2026-09-29T22:00:59.766+00:00'::timestamptz),
  ('ef43fb36-2fce-4967-bc17-b9b194df9aea'::uuid, 'A', 'A', 'S', 4, 31258, '2026-09-29T22:00:59.851+00:00'::timestamptz),
  ('41edd32a-c6a5-414f-9839-f1ac86c87972'::uuid, 'D', 'D', 'B', 1, 1920, '2026-09-30T22:00:19.587+00:00'::timestamptz),
  ('9b5fac17-eef2-4b9d-b797-42e1f7bf8165'::uuid, 'C', 'D', 'B', 1, 1433, '2026-09-30T22:01:35.679944+00:00'::timestamptz),
  ('e5593270-40fe-4a10-a57d-fdd0d765d591'::uuid, 'B', 'C', 'B', 1, 1899, '2026-09-30T22:00:37.711+00:00'::timestamptz),
  ('31cb6b7f-932c-4f01-8592-543877db0fca'::uuid, 'B', 'C', 'B', 1, 2202, '2026-09-30T22:00:53.305+00:00'::timestamptz)
on conflict (contenu_id) do nothing;

insert into public.verdicts_figes_sauvegarde
  (contenu_id, tier, passages_cible, tier_maj_at, tier_rendu, tier_juste, m_juste)
select c.id, c.tier, c.passages_cible, c.tier_maj_at, v.tier_rendu, v.tier_juste, v.m_juste
from public.contenus c
join public.verdicts_figes_0282 v on v.contenu_id = c.id
where c.tier = v.tier_rendu
  and abs(extract(epoch from (c.tier_maj_at - v.tier_maj_at))) < 0.001;

update public.contenus c
   set tier = v.tier_juste,
       passages_cible = v.cible_juste
  from public.verdicts_figes_0282 v
 where c.id = v.contenu_id
   and c.tier = v.tier_rendu
   and abs(extract(epoch from (c.tier_maj_at - v.tier_maj_at))) < 0.001;

drop table public.verdicts_figes_0282;
