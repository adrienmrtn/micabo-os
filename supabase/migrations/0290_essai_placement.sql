-- 0290 — Essai à blanc du placement (01/10/2026) : les 30 résultats et la clé
-- du jugement à l'aveugle.
--
-- `essai-placement` (0289) rend ses résultats en réponse HTTP ; appelée par
-- `kick_edge_micabo`, la réponse atterrit dans `net._http_response`, que pg_net
-- purge au bout de quelques heures. On range ici les 30 réponses du second
-- passage (prompt v2 sans l'exemple « mon prof m'a demandé… », qui se recopiait
-- dans 9 placements sur 22 au premier passage), avec, pour chaque ligne, si la
-- version A montrée à Adrien est l'ancien moteur. La clé n'est PAS dans le doc :
-- le jugement est à l'aveugle.
--
-- Lecture seule pour tout le monde : RLS active, aucune policy.

create table if not exists public.essai_placement_0289 (
  n integer primary key,
  reponse_id bigint not null,
  contenu_id uuid not null,
  langue text not null,
  a_est_avant boolean not null,
  resultat jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.essai_placement_0289 enable row level security;

insert into public.essai_placement_0289 (n, reponse_id, contenu_id, langue, a_est_avant, resultat)
select row_number() over (order by r.id), r.id, (r.content::jsonb->>'contenuId')::uuid, r.content::jsonb->>'langue',
       get_byte(decode(md5('placement-essai-' || r.id::text), 'hex'), 0) % 2 = 0,
       r.content::jsonb
  from net._http_response r
 where r.id between 1464 and 1493 and r.status_code = 200
on conflict (n) do nothing;
