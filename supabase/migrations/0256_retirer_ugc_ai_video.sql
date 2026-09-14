-- Retrait des modules « Create a post », « CM paper », « AI slideshows » et
-- « AI Videos » (14/09/2026).
--
-- Le schéma reste DORMANT : aucune table n'est droppée, aucune colonne n'est
-- retirée. `papier_*` (5 tables, 0 ligne), `ugc_video_posts`, `comptes.type_compte`,
-- `comptes.ugc_ai_video`, `labels.ugc_ai_video`, `profiles.hm_ugc_ai_video` et
-- `hm_ugc_video_labels` restent en place ; plus personne ne les écrit.
--
-- Ce qui change ici, c'est la seule chose que le code ne peut pas faire seul :
-- la marque système `ugc-ai-video` disparaît de la table `labels`. Elle portait
-- 0 slideshow et 0 créateur, donc rien ne casse en cascade. `hook` reste.
--
-- Les personas UGC et le face swap slideshow (`comptes.ugc_ai`,
-- `contenus.ugc_compatible`) sont GARDÉS — ils ne font pas partie du retrait.

-- ---------------------------------------------------------------------------
-- 1. La marque système UGC AI VIDEO s'en va
-- ---------------------------------------------------------------------------
delete from public.hm_ugc_video_labels
where label_id in (select id from public.labels where slug = 'ugc-ai-video');

delete from public.labels where slug = 'ugc-ai-video';

-- ---------------------------------------------------------------------------
-- 2. Les gardes système ne parlent plus que de `hook`
--
-- Laisser `'ugc-ai-video'` dans ces listes serait sans effet (plus aucun label
-- ne porte ce slug), mais un slug libre est un slug reprenable : autant que la
-- garde dise ce qu'elle protège vraiment.
-- ---------------------------------------------------------------------------
create or replace function public.label_systeme_non_assignable()
returns trigger
language plpgsql
as $$
declare
  s text;
begin
  select slug into s from public.labels where id = new.label_id;
  if s = 'hook' then
    raise exception 'LABEL_SYSTEME_NON_ASSIGNABLE';
  end if;
  return new;
end;
$$;

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
      where l.slug <> 'hook'
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
  'hook est une marque système : jamais une niche d’assignation.';

-- ---------------------------------------------------------------------------
-- 3. Prompts morts avec le pipeline vidéo
-- ---------------------------------------------------------------------------
delete from public.prompts
where cle in (
  'ugc_video_face_ref',
  'ugc_video_kling_prompt',
  'ugc_video_kling_negative',
  'ugc_video_caption'
);

-- ---------------------------------------------------------------------------
-- 4. Réglage `papier` : plus personne ne le lit
-- ---------------------------------------------------------------------------
delete from public.reglages where cle in ('papier', 'papier_fal_usage');

notify pgrst, 'reload schema';
