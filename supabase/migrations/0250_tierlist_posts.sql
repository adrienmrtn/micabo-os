-- Tierlist des slideshows — remplace l'ELO par langue.
--
-- Un slideshow porte désormais UN tier (D, C, B, A, S, S+) et un nombre de
-- passages à effectuer sur le cycle courant. Quand le cycle est fait (et
-- mesuré), le cron de minuit requalifie le post sur la moyenne des vues de ces
-- passages (voir `_shared/tierlist.ts` et `_shared/requalification.ts`).
--
-- `contenu_langues.score` n'est plus lu ni mis à jour par le moteur : la colonne
-- reste en place (historique + reprise du stock ci-dessous), gelée.
--
-- Aucun cron n'est planifié ici. Conforme à AGENTS.md.

-- ---------------------------------------------------------------------------
-- Colonnes tierlist
-- ---------------------------------------------------------------------------
alter table public.contenus
  add column if not exists tier text
    check (tier is null or tier in ('D', 'C', 'B', 'A', 'S', 'S+')),
  add column if not exists passages_cible integer not null default 0
    check (passages_cible >= 0),
  add column if not exists tier_maj_at timestamptz,
  add column if not exists tier_note_import double precision;

comment on column public.contenus.tier is
  'Tier du slideshow (D → S+). NULL = pas encore placé (import en cours / rejeté).';
comment on column public.contenus.passages_cible is
  'Passages à effectuer sur le cycle courant (0 en D). Les passages du cycle sont ceux créés depuis tier_maj_at, hors bonus et hors test.';
comment on column public.contenus.tier_maj_at is
  'Début du cycle courant = dernière requalification (ou premier placement).';
comment on column public.contenus.tier_note_import is
  'Note /100 du premier placement (30 % pertinence + 70 % vues source, régularisée). Trace uniquement.';

create index if not exists contenus_tier_idx on public.contenus (tier);
create index if not exists contenus_cycle_ouvert_idx
  on public.contenus (tier_maj_at)
  where passages_cible > 0;

-- Passages du cycle : lecture par contenu + date de création.
create index if not exists passages_contenu_cycle_idx
  on public.passages (contenu_id, created_at);

-- ---------------------------------------------------------------------------
-- Repost bonus : un passage > 50 000 vues rejoue le MÊME post sur le MÊME
-- compte 7 jours plus tard, hors pool et hors cycle (mais dans le quota du jour
-- du créateur).
-- ---------------------------------------------------------------------------
alter table public.passages
  add column if not exists bonus_repost boolean not null default false;

comment on column public.passages.bonus_repost is
  'Repost automatique J+7 après un carton (> 50 000 vues). Ne compte pas dans le cycle de requalification du slideshow.';

create table if not exists public.reposts_bonus (
  id uuid primary key default gen_random_uuid(),
  passage_source_id uuid not null references public.passages (id) on delete cascade,
  contenu_id uuid not null references public.contenus (id) on delete cascade,
  compte_id uuid not null references public.comptes (id) on delete cascade,
  langue text not null,
  vues_declencheur integer,
  jour_prevu date not null,
  statut text not null default 'prevu'
    check (statut in ('prevu', 'fait', 'abandonne')),
  passage_id uuid references public.passages (id) on delete set null,
  raison text,
  created_at timestamptz not null default now(),
  unique (passage_source_id)
);

create index if not exists reposts_bonus_a_faire_idx
  on public.reposts_bonus (jour_prevu)
  where statut = 'prevu';
create index if not exists reposts_bonus_compte_idx
  on public.reposts_bonus (compte_id, jour_prevu);

alter table public.reposts_bonus enable row level security;

drop policy if exists reposts_bonus_admin on public.reposts_bonus;
create policy reposts_bonus_admin on public.reposts_bonus
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Reprise du stock : ELO de la langue native → tier.
-- <50 D · 50–55 C · 55–60 B · 60–70 A · 70–80 S · ≥80 S+
-- Compteur de passages remis à neuf pour tout le monde.
-- ---------------------------------------------------------------------------
with elo_natif as (
  select
    c.id,
    coalesce(
      (select cl.score from public.contenu_langues cl
        where cl.contenu_id = c.id and cl.langue = c.langue_source
        limit 1),
      -- Pas de ligne dans la langue source : on prend le meilleur ELO connu.
      (select max(cl2.score) from public.contenu_langues cl2
        where cl2.contenu_id = c.id)
    ) as elo
  from public.contenus c
  where c.tier is null
    and c.statut = 'valide'
    and c.import_statut = 'done'
)
update public.contenus c
set tier = t.tier,
    passages_cible = t.cible,
    tier_maj_at = now()
from (
  select
    e.id,
    x.tier,
    case x.tier
      when 'D' then 0
      when 'C' then 1
      when 'B' then 2
      when 'A' then 4
      when 'S' then 8
      when 'S+' then 16
    end as cible
  from elo_natif e
  cross join lateral (
    select case
      when e.elo is null then 'C'          -- slideshow valide sans ELO connu
      when e.elo < 50 then 'D'
      when e.elo < 55 then 'C'
      when e.elo < 60 then 'B'
      when e.elo < 70 then 'A'
      when e.elo < 80 then 'S'
      else 'S+'
    end as tier
  ) x
) t
where c.id = t.id;

-- Vue de suivi : où en est chaque cycle (page Slideshows / Minuit).
create or replace view public.tierlist_cycles
with (security_invoker = off) as
  select
    c.id as contenu_id,
    c.titre,
    c.tier,
    c.passages_cible,
    c.tier_maj_at,
    c.langue_source,
    count(p.id) filter (
      where p.bonus_repost = false and coalesce(po.est_test, false) = false
    ) as passages_faits,
    count(p.id) filter (
      where p.bonus_repost = false and coalesce(po.est_test, false) = false
        and p.statut = 'publie' and p.vues is not null
    ) as passages_mesures,
    avg(p.vues) filter (
      where p.bonus_repost = false and coalesce(po.est_test, false) = false
        and p.statut = 'publie' and p.vues is not null
    ) as vues_moyennes
  from public.contenus c
  left join public.passages p
    on p.contenu_id = c.id
   and c.tier_maj_at is not null
   and p.created_at >= c.tier_maj_at
  left join public.posts po on po.id = p.post_id
  where public.is_admin()
  group by c.id, c.titre, c.tier, c.passages_cible, c.tier_maj_at, c.langue_source;

grant select on public.tierlist_cycles to authenticated;
