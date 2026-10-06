-- 0306 — Slideshows à TEXTE INCRUSTÉ (white posts), 06/10/2026.
--
-- Un slideshow ordinaire, ce sont des images propres (`structure_slides`) et,
-- par langue, des textes que le créateur pose par-dessus. Le moteur traduit à
-- la demande et place le CTA micabo.
--
-- Les « white posts » (label `white-post`) ont leur texte DESSINÉ dans l'image :
-- fond blanc, texte noir souligné, photo collée — le style de @amayareading.
-- Traduire n'a donc aucun sens, et une même image ne peut pas servir deux
-- langues. Chaque deck de langue (`contenu_langues.slides`) porte ses PROPRES
-- images, slide par slide (`media_id`), et un `texte_overlay` vide.
--
-- Le drapeau dit au moteur (voir `_shared/texte_incruste.ts`) :
--   - une langue sans deck complet n'est jamais servie : ni traduction à la
--     demande, ni repli sur une autre langue ;
--   - pas de placement micabo, pas de passe concurrents sur le texte : le CTA
--     est dessiné dans l'image de chaque langue ;
--   - le visuel vient du deck de la langue, jamais de la structure ni du
--     garnissage par la bibliothèque du label ;
--   - pas de burn (texte vide) et pas d'upscale (les médias naissent avec
--     `upscale_le` posé : SeedVR redessinerait la typographie) ;
--   - pas de variation (elle réécrit un texte qui est dans l'image).
--
-- `structure_slides` garde seulement les positions 1..n, sans média : c'est ce
-- que `positionsOrphelines` compare au deck. Un `media_id` y serait un piège —
-- tout chemin qui lit la structure servirait l'image d'UNE langue à toutes.

alter table public.contenus
  add column if not exists texte_incruste boolean not null default false;

comment on column public.contenus.texte_incruste is
  'Texte dessiné dans l''image (white posts, 0306) : chaque deck contenu_langues porte ses propres media_id, jamais traduit, jamais placé, jamais brûlé. Une langue sans deck complet n''est pas servie.';

-- Création atomique : contenu + médias + decks + labels dans UNE transaction.
--
-- L'appelant (`import-texte-incruste`) a déjà rangé les fichiers dans le
-- storage. Sans transaction, un process tué entre deux écritures laisserait un
-- slideshow « en file » (`brouillon` + `done`, la paire qui veut dire « en
-- file », 0257) sans ses images ou sans un de ses decks, et l'admin le
-- validerait sans le voir. Aucun bloc `exception` : règle de 0265.
create or replace function public.creer_contenu_texte_incruste(
  p_contenu jsonb,
  p_medias jsonb,
  p_decks jsonb,
  p_label_ids uuid[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid := nullif(p_contenu->>'id', '')::uuid;
  v_n integer := (p_contenu->>'nb_slides')::integer;
  v_ref uuid := nullif(p_contenu->>'compte_reference_id', '')::uuid;
  v_statut public.contenu_statut := 'brouillon';
  v_deck jsonb;
  v_langue text;
begin
  if v_id is null or v_n is null or v_n < 1 then
    raise exception 'creer_contenu_texte_incruste : id et nb_slides requis';
  end if;
  if p_decks is null or jsonb_typeof(p_decks) <> 'array' or jsonb_array_length(p_decks) = 0 then
    raise exception 'creer_contenu_texte_incruste : aucune langue (contenu=%)', v_id;
  end if;

  -- Chaque langue a EXACTEMENT ses n images, positions 1..n. Un deck troué
  -- partirait avec une slide blanche (0279) : on refuse avant d'écrire.
  for v_deck in select d from jsonb_array_elements(p_decks) as t(d) loop
    v_langue := v_deck->>'langue';
    if v_langue is null or length(trim(v_langue)) = 0 then
      raise exception 'creer_contenu_texte_incruste : deck sans langue (contenu=%)', v_id;
    end if;
    if (select count(*) from jsonb_array_elements(p_medias) as m(e) where m.e->>'langue' = v_langue) <> v_n
       or (select count(distinct (m.e->>'position')::integer)
             from jsonb_array_elements(p_medias) as m(e)
            where m.e->>'langue' = v_langue
              and (m.e->>'position')::integer between 1 and v_n) <> v_n then
      raise exception 'creer_contenu_texte_incruste : la langue % n''a pas ses % images (contenu=%)',
        v_langue, v_n, v_id;
    end if;
  end loop;

  -- Une source en court-circuit de file (0266) fait naître ses imports validés.
  if v_ref is not null and exists (
    select 1 from public.comptes_reference r where r.id = v_ref and r.skip_validation
  ) then
    v_statut := 'valide';
  end if;

  insert into public.contenus (
    id, titre, structure_slides, compte_reference_id, source_url, langue_source,
    musique_url, musique_titre, musique_plateforme, vues_source,
    pertinence_score, pertinence_raison, statut, import_statut, import_etape,
    creation_mode, tier, passages_cible, tier_maj_at, tier_note_import,
    texte_incruste, valide_at
  )
  values (
    v_id,
    coalesce(p_contenu->>'titre', ''),
    (select jsonb_agg(jsonb_build_object('position', g, 'media_id', null) order by g)
       from generate_series(1, v_n) as g),
    v_ref,
    p_contenu->>'source_url',
    coalesce(nullif(p_contenu->>'langue_source', ''), 'en'),
    p_contenu->>'musique_url',
    p_contenu->>'musique_titre',
    p_contenu->>'musique_plateforme',
    (p_contenu->>'vues_source')::integer,
    (p_contenu->>'pertinence_score')::integer,
    p_contenu->>'pertinence_raison',
    v_statut,
    'done',
    'texte_incruste',
    'import',
    nullif(p_contenu->>'tier', ''),
    coalesce((p_contenu->>'passages_cible')::integer, 0),
    case when nullif(p_contenu->>'tier', '') is null then null else now() end,
    (p_contenu->>'tier_note_import')::double precision,
    true,
    case when v_statut = 'valide' then now() else null end
  );

  -- `upscale_le` posé d'emblée : l'image est rendue à la résolution TikTok, et
  -- SeedVR redessinerait les lettres. Aucun `media_labels` : ces images ne
  -- doivent jamais garnir la slide d'un autre slideshow.
  insert into public.media_library (
    id, contenu_id, compte_reference_id, storage_path, url, source, langue,
    upscale_le, tags
  )
  select
    (m.e->>'id')::uuid,
    v_id,
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
    v_id,
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

  insert into public.contenu_labels (contenu_id, label_id)
  select v_id, l from unnest(coalesce(p_label_ids, '{}'::uuid[])) as l;

  return v_id;
end;
$function$;

revoke all on function public.creer_contenu_texte_incruste(jsonb, jsonb, jsonb, uuid[]) from public, anon, authenticated;
grant execute on function public.creer_contenu_texte_incruste(jsonb, jsonb, jsonb, uuid[]) to service_role;
