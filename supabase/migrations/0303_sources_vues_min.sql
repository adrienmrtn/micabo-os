-- 0303 — Seuil de vues par source, appliqué à la naissance du contenu (02/10/2026).
--
-- Consigne d'Adrien pendant l'import d'emir.study : « garde que les slideshows
-- > 5k vues, même pas besoin de calculer pertinence pour quand < 5k ». Au moment
-- de la consigne, 72 contenus étaient scrapés, dont 51 sous 5 000 vues, et aucun
-- n'avait encore commencé le pipeline (les workers scrapent d'abord) : rien
-- n'avait été payé au-delà du scrape.
--
-- Le seuil vit dans une table (`sources_vues_min`), pas dans une colonne de
-- `comptes_reference` : un `alter table … add column` fait attendre l'outil MCP
-- sa confirmation humaine (0291). Il sert à la prochaine source qui en demande un.
--
-- Le trigger agit AVANT l'insertion : le contenu naît `rejete` + `done` +
-- `elo_insuffisant`, le couple que `claimContenu` ne reprend jamais. Il ne
-- coûte donc ni OCR, ni pertinence, ni nettoyage. Le scrape, lui, est payé : il
-- faut lire le post pour connaître ses vues. `file_note` dit pourquoi.
--
-- Il ne joue qu'à l'insertion et que sur un `brouillon` : une réouverture pour
-- réimport (`reouvrirContenuPourReimport`, un UPDATE) et une réinjection à la
-- main ne sont pas touchées.
--
-- Appliqué par `apply_migration` : le corps plpgsql (points-virgules entre
-- `$f$`) est passé. Le même texte par `execute_sql`, précédé d'un
-- `drop trigger if exists`, avait attendu les 60 s sans rien appliquer.

create table if not exists public.sources_vues_min (
  compte_reference_id uuid primary key references public.comptes_reference(id) on delete cascade,
  vues_min integer not null,
  note text,
  created_at timestamptz not null default now()
);
alter table public.sources_vues_min enable row level security;

insert into public.sources_vues_min (compte_reference_id, vues_min, note)
values ('fcd24bfb-0e0a-4915-8a0f-09f3515c39b6', 5000, 'emir.study : garder seulement plus de 5 000 vues, consigne d’Adrien du 02/10')
on conflict (compte_reference_id) do update set vues_min = excluded.vues_min, note = excluded.note;

create or replace function public.contenus_vues_min_source() returns trigger language plpgsql as $f$
declare
  v_min integer;
begin
  if new.compte_reference_id is null or new.vues_source is null or new.statut is distinct from 'brouillon' then
    return new;
  end if;
  select v.vues_min into v_min from public.sources_vues_min v where v.compte_reference_id = new.compte_reference_id;
  if v_min is not null and new.vues_source < v_min then
    new.statut := 'rejete';
    new.import_statut := 'done';
    new.import_etape := 'elo_insuffisant';
    new.file_note := 'Non importé : ' || new.vues_source || ' vues sur le TikTok d’origine, sous le seuil de ' || v_min || ' posé pour cette source (sources_vues_min). Ni OCR, ni pertinence, ni nettoyage.';
  end if;
  return new;
end
$f$;

create or replace trigger contenus_vues_min_source
  before insert on public.contenus
  for each row execute function public.contenus_vues_min_source();
