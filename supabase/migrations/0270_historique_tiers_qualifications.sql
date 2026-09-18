-- Historique des changements de cycle — slideshows et comptes.
--
-- `contenus.tier` / `contenus.tier_maj_at` et `comptes.qualification` ne
-- gardaient que l'état courant : on lisait « B, cycle 1/1 » sans savoir d'où
-- venait ce B, ni depuis quand. Deux journaux le disent :
--
--   contenu_tier_historique          B → B le 17/09, cible 1 → 1
--   compte_qualification_historique  BIEN → STAR le 17/09
--
-- Les lignes sont posées par **trigger**, pas par le moteur : la
-- requalification tourne dans une Edge Function épinglée sur un chargeur
-- (`rattrapage-elo`, `minuit-vnext`), et une case posée à la main depuis l'UI
-- écrit la colonne en direct. Le trigger attrape les deux sans redéploiement.
--
-- Un tier **inchangé** fait quand même une ligne : « B → B » est l'information
-- utile (le cycle a été réglé, la moyenne n'a pas bougé de bande).
--
-- Colonne « qui a fait ça » en uuid nu, sans clé étrangère vers `profiles`
-- (0255 : deux FK vers la même cible cassent l'embed PostgREST).
--
-- Aucun cron n'est planifié ici. Conforme à AGENTS.md.

-- ---------------------------------------------------------------------------
-- Journal des tiers (slideshows)
-- ---------------------------------------------------------------------------
create table if not exists public.contenu_tier_historique (
  id uuid primary key default gen_random_uuid(),
  contenu_id uuid not null references public.contenus (id) on delete cascade,
  tier_avant text,
  tier_apres text,
  passages_cible_avant integer,
  passages_cible_apres integer,
  -- 'placement'       : premier tier posé à l'import
  -- 'requalification' : fin de cycle (tier_maj_at repart)
  -- 'ajustement'      : tier changé sans rouvrir de cycle (main humaine, script)
  motif text not null default 'requalification',
  fait_le timestamptz not null default now()
);

comment on table public.contenu_tier_historique is
  'Un cycle de tierlist par ligne : d''où part le slideshow, où il arrive, quand. Écrit par trigger.';
comment on column public.contenu_tier_historique.tier_avant is
  'NULL au premier placement (import) ou sur les lignes de reprise.';
comment on column public.contenu_tier_historique.motif is
  'placement | requalification | ajustement.';

create index if not exists contenu_tier_historique_contenu_idx
  on public.contenu_tier_historique (contenu_id, fait_le desc);

alter table public.contenu_tier_historique enable row level security;
drop policy if exists contenu_tier_historique_admin on public.contenu_tier_historique;
create policy contenu_tier_historique_admin on public.contenu_tier_historique
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Journal des qualifications (comptes)
-- ---------------------------------------------------------------------------
create table if not exists public.compte_qualification_historique (
  id uuid primary key default gen_random_uuid(),
  compte_id uuid not null references public.comptes (id) on delete cascade,
  qualification_avant text,
  qualification_apres text not null,
  -- Case posée à la main (verrouillée) ou calculée par le drain.
  manuelle boolean not null default false,
  -- uuid nu : surtout pas de clé étrangère vers profiles (0255).
  par uuid,
  fait_le timestamptz not null default now()
);

comment on table public.compte_qualification_historique is
  'Un changement de case par ligne (INACTIF → STAR). Écrit par trigger, à la main comme au drain.';
comment on column public.compte_qualification_historique.par is
  'Admin qui a posé la case à la main. uuid nu, sans clé étrangère (0255).';

create index if not exists compte_qualification_historique_compte_idx
  on public.compte_qualification_historique (compte_id, fait_le desc);

alter table public.compte_qualification_historique enable row level security;
drop policy if exists compte_qualification_historique_admin
  on public.compte_qualification_historique;
create policy compte_qualification_historique_admin
  on public.compte_qualification_historique
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Les triggers
-- ---------------------------------------------------------------------------

-- Un tier qui bouge, ou un cycle qui repart à tier égal : une ligne.
create or replace function public.journaliser_tier_contenu()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  motif text;
begin
  if tg_op = 'INSERT' then
    if new.tier is null then
      return new;
    end if;
    motif := 'placement';
  else
    if new.tier is null then
      return new;
    end if;
    if new.tier is not distinct from old.tier
       and new.tier_maj_at is not distinct from old.tier_maj_at then
      return new;
    end if;
    if old.tier is null then
      motif := 'placement';
    elsif new.tier_maj_at is distinct from old.tier_maj_at then
      motif := 'requalification';
    else
      motif := 'ajustement';
    end if;
  end if;

  insert into public.contenu_tier_historique (
    contenu_id, tier_avant, tier_apres,
    passages_cible_avant, passages_cible_apres, motif, fait_le
  )
  values (
    new.id,
    case when tg_op = 'INSERT' then null else old.tier end,
    new.tier,
    case when tg_op = 'INSERT' then null else old.passages_cible end,
    new.passages_cible,
    motif,
    coalesce(new.tier_maj_at, now())
  );

  return new;
end;
$$;

drop trigger if exists contenus_journal_tier on public.contenus;
create trigger contenus_journal_tier
  after insert or update of tier, tier_maj_at, passages_cible on public.contenus
  for each row
  execute function public.journaliser_tier_contenu();

-- Une case de compte qui change : une ligne. Un recalcul qui retombe sur la
-- même case n'en fait pas (contrairement aux tiers, il n'y a pas de cycle).
create or replace function public.journaliser_qualification_compte()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.qualification is not distinct from old.qualification then
    return new;
  end if;

  insert into public.compte_qualification_historique (
    compte_id, qualification_avant, qualification_apres, manuelle, par, fait_le
  )
  values (
    new.id,
    case when tg_op = 'INSERT' then null else old.qualification end,
    new.qualification,
    coalesce(new.qualification_manuelle, false),
    case
      when coalesce(new.qualification_manuelle, false) then new.qualification_manuelle_par
      else null
    end,
    coalesce(new.qualification_maj_at, now())
  );

  return new;
end;
$$;

drop trigger if exists comptes_journal_qualification on public.comptes;
create trigger comptes_journal_qualification
  after insert or update of qualification on public.comptes
  for each row
  execute function public.journaliser_qualification_compte();

-- ---------------------------------------------------------------------------
-- Reprise de l'existant : une ligne d'état par slideshow / par compte, pour ne
-- pas afficher un journal vide sur ce qui tourne déjà.
-- ---------------------------------------------------------------------------
insert into public.contenu_tier_historique (
  contenu_id, tier_avant, tier_apres,
  passages_cible_avant, passages_cible_apres, motif, fait_le
)
select c.id, null, c.tier, null, c.passages_cible, 'placement',
       coalesce(c.tier_maj_at, c.created_at, now())
from public.contenus c
where c.tier is not null
  and not exists (
    select 1 from public.contenu_tier_historique h where h.contenu_id = c.id
  );

insert into public.compte_qualification_historique (
  compte_id, qualification_avant, qualification_apres, manuelle, par, fait_le
)
select c.id, null, c.qualification, coalesce(c.qualification_manuelle, false),
       case when coalesce(c.qualification_manuelle, false)
            then c.qualification_manuelle_par else null end,
       coalesce(c.qualification_maj_at, c.created_at, now())
from public.comptes c
where not exists (
    select 1 from public.compte_qualification_historique h where h.compte_id = c.id
  );
