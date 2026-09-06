-- Hook (1ʳᵉ slide) et ugc-ai-video (checkmark) ne sont pas des niches.
-- Un créateur ne peut pas les porter : pas de matching minuit, pas de least-used.

delete from public.compte_labels cl
using public.labels l
where cl.label_id = l.id
  and l.slug in ('hook', 'ugc-ai-video');

delete from public.compte_reference_labels crl
using public.labels l
where crl.label_id = l.id
  and l.slug in ('hook', 'ugc-ai-video');

delete from public.contenu_labels cl
using public.labels l
where cl.label_id = l.id
  and l.slug in ('hook', 'ugc-ai-video');

delete from public.hm_ugc_video_labels h
using public.labels l
where h.label_id = l.id
  and l.slug in ('hook', 'ugc-ai-video');

do $$
declare
  interdits uuid[];
  val jsonb;
  items jsonb;
  par_lang jsonb;
  par_app jsonb;
  lang text;
  app text;
  slice jsonb;
  slice_items jsonb;
  slice_lang jsonb;
  slice_lang_key text;
begin
  select coalesce(array_agg(id), '{}')
  into interdits
  from public.labels
  where slug in ('hook', 'ugc-ai-video');

  select valeur into val
  from public.reglages
  where cle = 'file_labels_comptes';
  if val is null or jsonb_typeof(val) <> 'object' then
    return;
  end if;

  items := (
    select coalesce(jsonb_agg(elem), '[]'::jsonb)
    from jsonb_array_elements(coalesce(val->'items', '[]'::jsonb)) elem
    where nullif(elem->>'label_id', '')::uuid is null
       or not ((elem->>'label_id')::uuid = any (interdits))
  );

  par_lang := '{}'::jsonb;
  for lang in
    select key from jsonb_each(coalesce(val->'par_langue', '{}'::jsonb))
  loop
    par_lang := par_lang || jsonb_build_object(
      lang,
      (
        select coalesce(jsonb_agg(elem), '[]'::jsonb)
        from jsonb_array_elements(coalesce(val->'par_langue'->lang, '[]'::jsonb)) elem
        where nullif(elem->>'label_id', '')::uuid is null
           or not ((elem->>'label_id')::uuid = any (interdits))
      )
    );
  end loop;

  par_app := '{}'::jsonb;
  for app in
    select key from jsonb_each(coalesce(val->'par_application', '{}'::jsonb))
  loop
    slice := val->'par_application'->app;
    slice_items := (
      select coalesce(jsonb_agg(elem), '[]'::jsonb)
      from jsonb_array_elements(coalesce(slice->'items', '[]'::jsonb)) elem
      where nullif(elem->>'label_id', '')::uuid is null
         or not ((elem->>'label_id')::uuid = any (interdits))
    );
    slice_lang := '{}'::jsonb;
    for slice_lang_key in
      select key from jsonb_each(coalesce(slice->'par_langue', '{}'::jsonb))
    loop
      slice_lang := slice_lang || jsonb_build_object(
        slice_lang_key,
        (
          select coalesce(jsonb_agg(elem), '[]'::jsonb)
          from jsonb_array_elements(
            coalesce(slice->'par_langue'->slice_lang_key, '[]'::jsonb)
          ) elem
          where nullif(elem->>'label_id', '')::uuid is null
             or not ((elem->>'label_id')::uuid = any (interdits))
        )
      );
    end loop;
    par_app := par_app || jsonb_build_object(
      app,
      jsonb_build_object('items', slice_items, 'par_langue', slice_lang)
    );
  end loop;

  update public.reglages
  set
    valeur = jsonb_strip_nulls(
      jsonb_build_object(
        'items', items,
        'par_langue', par_lang,
        'par_application', case
          when val ? 'par_application' then par_app
          else null
        end
      )
    ),
    updated_at = now()
  where cle = 'file_labels_comptes';
end
$$;

create or replace function public.label_systeme_non_assignable()
returns trigger
language plpgsql
as $$
declare
  s text;
begin
  select slug into s from public.labels where id = new.label_id;
  if s in ('hook', 'ugc-ai-video') then
    raise exception 'LABEL_SYSTEME_NON_ASSIGNABLE';
  end if;
  return new;
end;
$$;

drop trigger if exists compte_labels_pas_systeme on public.compte_labels;
create trigger compte_labels_pas_systeme
  before insert or update on public.compte_labels
  for each row
  execute function public.label_systeme_non_assignable();

drop trigger if exists compte_reference_labels_pas_systeme
  on public.compte_reference_labels;
create trigger compte_reference_labels_pas_systeme
  before insert or update on public.compte_reference_labels
  for each row
  execute function public.label_systeme_non_assignable();

drop trigger if exists contenu_labels_pas_systeme on public.contenu_labels;
create trigger contenu_labels_pas_systeme
  before insert or update on public.contenu_labels
  for each row
  execute function public.label_systeme_non_assignable();

drop trigger if exists hm_ugc_video_labels_pas_systeme
  on public.hm_ugc_video_labels;
create trigger hm_ugc_video_labels_pas_systeme
  before insert or update on public.hm_ugc_video_labels
  for each row
  execute function public.label_systeme_non_assignable();

create or replace function public.set_labels_source(
  p_compte_reference_id uuid,
  p_label_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_compte_reference_id is null then
    raise exception 'compte_reference_id requis';
  end if;

  if auth.uid() is not null and not public.is_admin() then
    raise exception 'réservé admin';
  end if;

  alter table public.compte_reference_labels
    disable trigger compte_reference_labels_propager;

  begin
    delete from public.compte_reference_labels
    where compte_reference_id = p_compte_reference_id;

    if p_label_ids is not null and cardinality(p_label_ids) > 0 then
      insert into public.compte_reference_labels (compte_reference_id, label_id)
      select p_compte_reference_id, x
      from unnest(p_label_ids) as x
      join public.labels l on l.id = x
      where l.slug not in ('hook', 'ugc-ai-video')
      on conflict do nothing;
    end if;
  exception
    when others then
      alter table public.compte_reference_labels
        enable trigger compte_reference_labels_propager;
      raise;
  end;

  alter table public.compte_reference_labels
    enable trigger compte_reference_labels_propager;

  return public.propager_labels_source(p_compte_reference_id);
end;
$$;

comment on column public.labels.slug is
  'hook et ugc-ai-video sont des marques système : jamais une niche d’assignation.';

notify pgrst, 'reload schema';
