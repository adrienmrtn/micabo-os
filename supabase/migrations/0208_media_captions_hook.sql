-- Captions visuelles (Florence → Moondream) + label système Hook (1ʳᵉ slide).

alter table public.media_library
  add column if not exists caption text,
  add column if not exists caption_statut text,
  add column if not exists caption_modele text,
  add column if not exists caption_le timestamptz,
  add column if not exists est_hook boolean not null default false;

alter table public.media_library
  drop constraint if exists media_library_caption_statut_check;

alter table public.media_library
  add constraint media_library_caption_statut_check
  check (caption_statut is null or caption_statut in ('ok', 'aucune'));

comment on column public.media_library.caption is
  'Caption visuelle courte (Florence-2, sinon Moondream). Null si aucune reconnue.';
comment on column public.media_library.caption_statut is
  'ok = caption stockée ; aucune = les deux modèles ont échoué ; null = pas encore tenté.';
comment on column public.media_library.caption_modele is
  'florence | moondream | none';
comment on column public.media_library.est_hook is
  'True si cette image est la première slide d’un slideshow (label Hook).';

create index if not exists media_library_caption_pending_idx
  on public.media_library (created_at)
  where caption_statut is null;

create index if not exists media_library_est_hook_idx
  on public.media_library (est_hook)
  where est_hook;

-- Label système : pas une niche d’assignation, uniquement porté par l’image.
insert into public.labels (nom, slug, couleur, genre)
values ('Hook', 'hook', '#f59e0b', null)
on conflict (slug) do nothing;

-- Backfill Hook : 1ʳᵉ slide (structure_slides.position = 1) + chemin …/1.ext
update public.media_library m
set est_hook = true
where m.est_hook = false
  and (
    m.storage_path ~ '(^|/)(propre|brut)/[^/]+/1(\.|$)'
    or exists (
      select 1
      from public.contenus c
      cross join lateral jsonb_array_elements(coalesce(c.structure_slides, '[]'::jsonb)) s
      where (s->>'media_id') = m.id::text
        and coalesce((s->>'position')::int, 0) = 1
    )
  );

insert into public.media_labels (media_id, label_id)
select m.id, l.id
from public.media_library m
join public.labels l on l.slug = 'hook'
where m.est_hook
on conflict do nothing;

-- Propagation source : ne pas effacer le label Hook (spécifique à l’image).
create or replace function public.propager_labels_source(p_compte_reference_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
  hook_id uuid;
begin
  if p_compte_reference_id is null then
    return 0;
  end if;

  select id into hook_id from public.labels where slug = 'hook' limit 1;

  delete from public.contenu_labels cl
  using public.contenus c
  where cl.contenu_id = c.id
    and c.compte_reference_id = p_compte_reference_id
    and (hook_id is null or cl.label_id is distinct from hook_id);

  insert into public.contenu_labels (contenu_id, label_id)
  select c.id, crl.label_id
  from public.contenus c
  join public.compte_reference_labels crl
    on crl.compte_reference_id = c.compte_reference_id
  where c.compte_reference_id = p_compte_reference_id
    and (hook_id is null or crl.label_id is distinct from hook_id)
  on conflict do nothing;

  delete from public.media_labels ml
  using public.media_library m
  where ml.media_id = m.id
    and (hook_id is null or ml.label_id is distinct from hook_id)
    and (
      m.compte_reference_id = p_compte_reference_id
      or exists (
        select 1
        from public.contenus c
        where c.id = m.contenu_id
          and c.compte_reference_id = p_compte_reference_id
      )
    );

  insert into public.media_labels (media_id, label_id)
  select distinct m.id, cl.label_id
  from public.media_library m
  join public.contenu_labels cl on cl.contenu_id = m.contenu_id
  join public.contenus c on c.id = m.contenu_id
  where c.compte_reference_id = p_compte_reference_id
    and (hook_id is null or cl.label_id is distinct from hook_id)
  on conflict do nothing;

  insert into public.media_labels (media_id, label_id)
  select m.id, crl.label_id
  from public.media_library m
  join public.compte_reference_labels crl
    on crl.compte_reference_id = m.compte_reference_id
  where m.compte_reference_id = p_compte_reference_id
    and m.contenu_id is null
    and (hook_id is null or crl.label_id is distinct from hook_id)
  on conflict do nothing;

  -- Recolle Hook sur les 1ʳᵉs slides.
  if hook_id is not null then
    insert into public.media_labels (media_id, label_id)
    select m.id, hook_id
    from public.media_library m
    where m.est_hook
      and (
        m.compte_reference_id = p_compte_reference_id
        or exists (
          select 1 from public.contenus c
          where c.id = m.contenu_id
            and c.compte_reference_id = p_compte_reference_id
        )
      )
    on conflict do nothing;
  end if;

  select count(*)::integer into n
  from public.contenus
  where compte_reference_id = p_compte_reference_id;

  return n;
end;
$$;

notify pgrst, 'reload schema';
