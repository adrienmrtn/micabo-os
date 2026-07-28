-- Moteur v-next — Étape 2 : migration des stocks (zéro perte).
--
-- Remplit contenus / contenu_langues / passages depuis sujets / posts / métriques.
-- Idempotent (rejouable). Ne crée PAS de labels (manuels). Ne supprime rien
-- du legacy. Images Storage inchangées ; media_library.contenu_id renseigné.

-- Langues cibles OS (aligné src/features/moteur/langues.ts) :
-- fr, en, de, it, es, pt — inline via VALUES dans les requêtes.

-- ---------------------------------------------------------------------------
-- 1) sujets → contenus
-- ---------------------------------------------------------------------------
insert into public.contenus (
  titre,
  structure_slides,
  compte_reference_id,
  sujet_id,
  source_url,
  langue_source,
  musique_url,
  musique_titre,
  musique_plateforme,
  vues_source,
  pertinence_score,
  pertinence_raison,
  statut,
  import_statut,
  import_etape,
  import_erreur,
  parent_id,
  profondeur,
  created_at
)
select
  coalesce(nullif(trim(s.titre), ''), 'Sans titre'),
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'position', coalesce((slide->>'position')::int, ord.ordinality::int),
          'media_id', nullif(slide->>'media_id', ''),
          'raw_url', slide->>'raw_url',
          'reference_url', coalesce(slide->>'reference_url', slide->>'raw_url')
        )
        order by coalesce((slide->>'position')::int, ord.ordinality::int)
      )
      from jsonb_array_elements(coalesce(s.structure_slides, '[]'::jsonb))
        with ordinality as ord(slide, ordinality)
    ),
    '[]'::jsonb
  ),
  s.compte_reference_id,
  s.id,
  s.source_url,
  coalesce(nullif(trim(s.langue), ''), 'fr'),
  s.musique_url,
  s.musique_titre,
  s.musique_plateforme,
  case
    when s.vues is null then null
    when s.vues > 2147483647 then 2147483647
    else s.vues::integer
  end,
  s.pertinence_score,
  s.pertinence_raison,
  case
    when s.statut = 'rejete' then 'rejete'::public.contenu_statut
    when s.preparation_statut = 'done'
      and s.statut in ('retenu', 'utilise') then 'valide'::public.contenu_statut
    when s.preparation_statut = 'done'
      and coalesce(s.pertinence_score, 0) >= 50 then 'valide'::public.contenu_statut
    else 'brouillon'::public.contenu_statut
  end,
  case s.preparation_statut
    when 'done' then 'done'
    when 'failed' then 'failed'
    when 'running' then 'running'
    else 'pending'
  end,
  null,
  s.preparation_erreur,
  null,
  0,
  s.created_at
from public.sujets s
where not exists (
  select 1 from public.contenus c where c.sujet_id = s.id
);

-- Lier les médias déjà référencés par les slides du contenu.
update public.media_library m
set contenu_id = c.id
from public.contenus c
cross join lateral jsonb_array_elements(c.structure_slides) slide
where c.sujet_id is not null
  and nullif(slide->>'media_id', '') is not null
  and slide->>'media_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and m.id = (slide->>'media_id')::uuid
  and (m.contenu_id is null or m.contenu_id = c.id);

-- ---------------------------------------------------------------------------
-- 2) contenu_langues — une ligne par langue OS
--    Score cold-start 50..100 depuis vues source, régularisé (source moins).
-- ---------------------------------------------------------------------------
with params as (
  select
    coalesce((select (valeur->>'score_prior')::float from public.reglages where cle = 'scoring'), 50) as prior,
    coalesce((select (valeur->>'regularisation_k')::float from public.reglages where cle = 'scoring'), 5) as k
),
base as (
  select
    c.id as contenu_id,
    c.langue_source,
    c.vues_source,
    -- base 50..100, log des vues source (évite de mesurer la taille seule en brut)
    least(
      100.0,
      greatest(
        50.0,
        50.0 + ln(1.0 + coalesce(c.vues_source, 0)::float) / ln(1.0 + 5000000.0) * 50.0
      )
    ) as score_base,
    -- slides langue source depuis OCR du sujet (texte_original)
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'position', coalesce((slide->>'position')::int, ord.ordinality::int),
            'texte_overlay', slide->>'texte_original',
            'position_sophia', false
          )
          order by coalesce((slide->>'position')::int, ord.ordinality::int)
        )
        from public.sujets s
        cross join lateral jsonb_array_elements(coalesce(s.structure_slides, '[]'::jsonb))
          with ordinality as ord(slide, ordinality)
        where s.id = c.sujet_id
      ),
      '[]'::jsonb
    ) as slides_source
  from public.contenus c
  where c.sujet_id is not null
)
insert into public.contenu_langues (
  contenu_id, langue, slides, score, nb_passages, score_maj_at
)
select
  b.contenu_id,
  l.code,
  case when l.code = b.langue_source then b.slides_source else '[]'::jsonb end,
  case
    when l.code = b.langue_source then
      -- moins régularisé (k/2)
      ((p.k / 2.0) * p.prior + b.score_base) / ((p.k / 2.0) + 1.0)
    else
      -- plus régularisé (k*2)
      ((p.k * 2.0) * p.prior + b.score_base) / ((p.k * 2.0) + 1.0)
  end,
  0,
  now()
from base b
cross join (values ('fr'), ('en'), ('de'), ('it'), ('es'), ('pt')) as l(code)
cross join params p
where not exists (
  select 1 from public.contenu_langues cl
  where cl.contenu_id = b.contenu_id and cl.langue = l.code
);

-- ---------------------------------------------------------------------------
-- 3) posts historiques → passages (garde l'info ; ignore tests & coquilles vides)
-- ---------------------------------------------------------------------------
insert into public.passages (
  contenu_id,
  compte_id,
  langue,
  date_publication_prevue,
  statut,
  slides,
  musique_url,
  musique_titre,
  musique_plateforme,
  hashtags,
  publie_at,
  publie_url,
  vues,
  likes,
  commentaires,
  partages,
  stats_maj_at,
  post_id,
  created_at
)
select
  c.id,
  p.compte_id,
  coalesce(nullif(trim(cpt.langue), ''), c.langue_source, 'fr'),
  p.date_publication_prevue,
  p.statut::text::public.passage_statut,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'position', ps.position,
          'texte_overlay', ps.texte_overlay,
          'position_sophia', coalesce(ps.position_sophia, false),
          'media_id', ps.media_id,
          'reference_url', ps.reference_url
        )
        order by ps.position
      )
      from public.post_slides ps
      where ps.post_id = p.id
    ),
    '[]'::jsonb
  ),
  p.musique_url,
  p.musique_titre,
  p.musique_plateforme,
  p.hashtags,
  p.publie_at,
  p.publie_url,
  m.vues,
  m.likes,
  m.commentaires,
  m.partages,
  m.collecte_at,
  p.id,
  p.created_at
from public.posts p
join public.contenus c on c.sujet_id = p.sujet_id
join public.comptes cpt on cpt.id = p.compte_id
left join lateral (
  select vues, likes, commentaires, partages, collecte_at
  from public.post_metrics pm
  where pm.post_id = p.id
  order by pm.collecte_at desc
  limit 1
) m on true
where p.sujet_id is not null
  and coalesce(p.est_test, false) = false
  and (
    p.statut in ('publie', 'valide_par_poster')
    or (p.statut = 'assigne' and p.pipeline_statut = 'done')
  )
  and not exists (
    select 1 from public.passages x where x.post_id = p.id
  );

-- ---------------------------------------------------------------------------
-- 4) Enrichir contenu_langues depuis les slides déjà composés (trad + Sophia)
-- ---------------------------------------------------------------------------
update public.contenu_langues cl
set slides = src.slides
from (
  select distinct on (pass.contenu_id, pass.langue)
    pass.contenu_id,
    pass.langue,
    pass.slides
  from public.passages pass
  where jsonb_typeof(pass.slides) = 'array'
    and jsonb_array_length(pass.slides) > 0
  order by
    pass.contenu_id,
    pass.langue,
    case pass.statut
      when 'publie' then 0
      when 'valide_par_poster' then 1
      else 2
    end,
    pass.publie_at desc nulls last,
    pass.created_at desc
) src
where cl.contenu_id = src.contenu_id
  and cl.langue = src.langue
  and (
    cl.slides = '[]'::jsonb
    or not exists (
      select 1
      from jsonb_array_elements(cl.slides) s
      where coalesce(s->>'position_sophia', 'false') = 'true'
    )
  );

-- ---------------------------------------------------------------------------
-- 5) MAJ scores contenu_langues depuis passages publiés avec stats
-- ---------------------------------------------------------------------------
with params as (
  select
    coalesce((select (valeur->>'score_prior')::float from public.reglages where cle = 'scoring'), 50) as prior,
    coalesce((select (valeur->>'regularisation_k')::float from public.reglages where cle = 'scoring'), 5) as k
),
perf as (
  select
    pass.contenu_id,
    pass.langue,
    count(*)::int as n,
    avg(
      least(
        100.0,
        greatest(
          20.0,
          40.0 + ln(1.0 + coalesce(pass.vues, 0)::float) / ln(1.0 + 1000000.0) * 60.0
        )
      )
    ) as perf_moy
  from public.passages pass
  where pass.statut = 'publie'
    and pass.vues is not null
  group by pass.contenu_id, pass.langue
),
counts as (
  select
    pass.contenu_id,
    pass.langue,
    count(*)::int as n_all
  from public.passages pass
  where pass.statut in ('publie', 'valide_par_poster', 'assigne')
  group by pass.contenu_id, pass.langue
)
update public.contenu_langues cl
set
  nb_passages = c.n_all,
  score = case
    when p.n is null then cl.score
    else (params.k * params.prior + p.n * p.perf_moy) / (params.k + p.n)
  end,
  score_maj_at = now()
from counts c
cross join params
left join perf p
  on p.contenu_id = c.contenu_id and p.langue = c.langue
where cl.contenu_id = c.contenu_id
  and cl.langue = c.langue;

-- ---------------------------------------------------------------------------
-- 6) Score de compte = moyenne simple des perfs récentes (EWMA approx init)
-- ---------------------------------------------------------------------------
with perf_compte as (
  select
    pass.compte_id,
    avg(
      least(
        100.0,
        greatest(
          20.0,
          40.0 + ln(1.0 + coalesce(pass.vues, 0)::float) / ln(1.0 + 1000000.0) * 60.0
        )
      )
    ) as score_init
  from public.passages pass
  where pass.statut = 'publie'
    and pass.vues is not null
    and pass.publie_at > now() - interval '60 days'
  group by pass.compte_id
)
update public.comptes c
set
  score = pc.score_init,
  score_maj_at = now()
from perf_compte pc
where c.id = pc.compte_id;

-- ---------------------------------------------------------------------------
-- 7) Journal léger (lisible dans les logs migration / SQL editor)
-- ---------------------------------------------------------------------------
do $$
declare
  n_contenus int;
  n_langues int;
  n_passages int;
  n_media int;
begin
  select count(*) into n_contenus from public.contenus where sujet_id is not null;
  select count(*) into n_langues from public.contenu_langues;
  select count(*) into n_passages from public.passages where post_id is not null;
  select count(*) into n_media from public.media_library where contenu_id is not null;
  raise notice
    'v-next migrate: contenus=% contenu_langues=% passages=% medias_lies=%',
    n_contenus, n_langues, n_passages, n_media;
end $$;
