-- 0307 — Ajouter une langue à un white post existant, 06/10/2026.
--
-- 0306 crée un slideshow à texte incrusté avec toutes ses langues d'un coup.
-- Une langue qui arrive après (le turc du premier white post, rendu après son
-- entrée en file) ne peut pas passer par là : recréer le contenu le ferait
-- repartir de zéro en file, avec un nouvel id, et laisserait l'ancien orphelin.
--
-- `ajouter_langues_texte_incruste` range les médias et le deck des langues
-- nouvelles sur le contenu existant, en UNE transaction, avec les mêmes gardes
-- que 0306 :
--   - le contenu existe et porte `texte_incruste` ;
--   - chaque langue a exactement ses n images, positions 1..n, n étant la
--     longueur de `structure_slides` (le deck est comparé à la structure par
--     `positionsOrphelines`, 0279) ;
--   - une langue qui a DÉJÀ un deck est refusée. Remplacer ses images
--     orphelinerait les `media_id` que `passages.slides` garde pour les reposts
--     bonus : une correction de rendu se fait par un nouveau média, à part.
--
-- Le statut n'est pas touché : un contenu en file y reste, et la langue
-- n'est servie qu'une fois le slideshow validé. Sur un contenu déjà validé, la
-- langue est servable tout de suite — l'appel est un geste admin
-- (`service_role` seul), comme la validation elle-même.
--
-- `for update` sur `contenus` : deux ajouts concurrents de la même langue ne
-- peuvent pas passer tous les deux le contrôle « pas encore de deck ». Même
-- ordre d'acquisition que 0274/0275 (le verrou `comptes` n'est pas pris ici,
-- aucune écriture de passage). Aucun bloc `exception` : règle de 0265.

create or replace function public.ajouter_langues_texte_incruste(
  p_contenu_id uuid,
  p_medias jsonb,
  p_decks jsonb
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_incruste boolean;
  v_ref uuid;
  v_n integer;
  v_deck jsonb;
  v_langue text;
begin
  select c.texte_incruste, c.compte_reference_id, jsonb_array_length(coalesce(c.structure_slides, '[]'::jsonb))
    into v_incruste, v_ref, v_n
    from public.contenus c
   where c.id = p_contenu_id
   for update;
  if not found then
    raise exception 'ajouter_langues_texte_incruste : contenu introuvable (%)', p_contenu_id;
  end if;
  if not v_incruste then
    raise exception 'ajouter_langues_texte_incruste : contenu % sans texte incrusté', p_contenu_id;
  end if;
  if v_n < 1 then
    raise exception 'ajouter_langues_texte_incruste : structure vide (contenu=%)', p_contenu_id;
  end if;
  if p_decks is null or jsonb_typeof(p_decks) <> 'array' or jsonb_array_length(p_decks) = 0 then
    raise exception 'ajouter_langues_texte_incruste : aucune langue (contenu=%)', p_contenu_id;
  end if;

  for v_deck in select d from jsonb_array_elements(p_decks) as t(d) loop
    v_langue := v_deck->>'langue';
    if v_langue is null or length(trim(v_langue)) = 0 then
      raise exception 'ajouter_langues_texte_incruste : deck sans langue (contenu=%)', p_contenu_id;
    end if;
    if exists (
      select 1 from public.contenu_langues cl
       where cl.contenu_id = p_contenu_id and cl.langue = v_langue
    ) then
      raise exception 'ajouter_langues_texte_incruste : la langue % existe déjà (contenu=%)',
        v_langue, p_contenu_id;
    end if;
    if (select count(*) from jsonb_array_elements(p_medias) as m(e) where m.e->>'langue' = v_langue) <> v_n
       or (select count(distinct (m.e->>'position')::integer)
             from jsonb_array_elements(p_medias) as m(e)
            where m.e->>'langue' = v_langue
              and (m.e->>'position')::integer between 1 and v_n) <> v_n then
      raise exception 'ajouter_langues_texte_incruste : la langue % n''a pas ses % images (contenu=%)',
        v_langue, v_n, p_contenu_id;
    end if;
  end loop;

  -- Un média d'une langue absente des decks serait orphelin dès sa naissance.
  if exists (
    select 1 from jsonb_array_elements(p_medias) as m(e)
     where not exists (
       select 1 from jsonb_array_elements(p_decks) as d(e) where d.e->>'langue' = m.e->>'langue'
     )
  ) then
    raise exception 'ajouter_langues_texte_incruste : média d''une langue sans deck (contenu=%)', p_contenu_id;
  end if;

  -- Mêmes médias que 0306 : `upscale_le` posé, aucun `media_labels`.
  insert into public.media_library (
    id, contenu_id, compte_reference_id, storage_path, url, source, langue,
    upscale_le, tags
  )
  select
    (m.e->>'id')::uuid,
    p_contenu_id,
    v_ref,
    m.e->>'storage_path',
    m.e->>'url',
    'nettoye_reference'::public.media_source,
    m.e->>'langue',
    now(),
    array['texte_incruste']
  from jsonb_array_elements(p_medias) as m(e);

  insert into public.contenu_langues (contenu_id, langue, slides, hashtags, nb_passages)
  select
    p_contenu_id,
    d.e->>'langue',
    (select jsonb_agg(
              jsonb_build_object(
                'position', (m.e->>'position')::integer,
                'media_id', m.e->>'id',
                'texte_overlay', '',
                'position_sophia', false
              )
              order by (m.e->>'position')::integer)
       from jsonb_array_elements(p_medias) as m(e)
      where m.e->>'langue' = d.e->>'langue'),
    nullif(trim(coalesce(d.e->>'hashtags', '')), ''),
    0
  from jsonb_array_elements(p_decks) as d(e);

  return jsonb_array_length(p_decks);
end;
$function$;

revoke all on function public.ajouter_langues_texte_incruste(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.ajouter_langues_texte_incruste(uuid, jsonb, jsonb) to service_role;
