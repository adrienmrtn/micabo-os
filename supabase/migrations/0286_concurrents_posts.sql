-- 0286 — Les concurrents dans les posts : liste, repérage, correction (01/10/2026).
--
-- Le 01/10, Wilgo apparaissait dans 43 posts sur 14 jours (30 publiés, 10 encore
-- à venir ce jour-là) : « Benutz die WILGO App… dein Cheatcode », « la méthode
-- WILGO », « Wilgo'dan test çöz », et même un reste de fiche App Store de Wilgo
-- derrière le CTA micabo. La cause est à la source : des slideshows importés
-- de comptes concurrents (`jeanne.wilgo`). Au 01/10, 76 decks validés sur 35
-- slideshows citent un concurrent, dont 56 Wilgo. `normaliserMarque` (0268)
-- ne cherche que la marque micabo, et `retirerMentionConcurrent` (0269) ne
-- coupe que Hustly, exprès : une coupe aveugle sur « Anki » détruirait des
-- comparatifs légitimes. Trancher entre classement et recommandation est un
-- travail de lecture, donc d'un modèle.
--
-- Décision d'Adrien : le brief du matin repère les mentions dans les posts
-- publiés la veille (contrôle), et fait une passe LLM sur les posts du jour pas
-- encore publiés. Un classement ou un comparatif qui cite plusieurs applis
-- reste tel quel ; une recommandation d'un concurrent est remplacée.
--
--   - `concurrents` : la liste, éditable. Motifs POSIX en mots entiers (\m \M),
--     insensibles à la casse : « Ranking » contient « anki », c'est le piège
--     vu au premier repérage. ChatGPT, Gemini, Perplexity ne sont pas des
--     concurrents (IA généralistes), et « notion » est un mot français.
--   - `mentions_concurrents(debut, fin)` : lecture seule, une ligne par slide
--     ou légende qui cite un concurrent actif.
--   - `corriger_texte_post` / `corriger_hashtags_post` : la SEULE écriture que
--     le brief s'autorise. Post non publié uniquement (on ne réécrit jamais ce
--     qui est en ligne), avant/après journalisés dans `concurrents_corrections`,
--     et le deck de la même langue corrigé avec s'il porte encore le même
--     texte, pour que les prochains posts naissent propres. Pas de bloc
--     `exception` (règle de 0265) : une garde violée lève, rien n'est écrit.

create table if not exists public.concurrents (
  nom text primary key,
  motif text not null,
  actif boolean not null default true,
  note text,
  created_at timestamptz not null default now()
);
alter table public.concurrents enable row level security;

insert into public.concurrents (nom, motif, note) values
  ('Wilgo', '\mwilgo\M', 'source jeanne.wilgo importée : 25 slideshows du pool le citent au 01/10'),
  ('Astra AI', '\mastra(\s?ai)?\M', null),
  ('Knowunity', '\mknowunity\M', null),
  ('Quizlet', '\mquizlet\M', null),
  ('Anki', '\manki\M', 'mot entier : « Ranking » contient « anki »'),
  ('StudySmarter', '\mstudy\s?smarter\M', null),
  ('Studocu', '\mstudocu\M', null),
  ('Brainly', '\mbrainly\M', null),
  ('Gauth', '\mgauth(math)?\M', null),
  ('Photomath', '\mphotomath\M', null),
  ('Turbo AI', '\mturbo\s?ai\M', null),
  ('StudyFetch', '\mstudy\s?fetch\M', null),
  ('Revisely', '\mrevisely\M', null),
  ('Mindgrasp', '\mmindgrasp\M', null)
on conflict (nom) do nothing;

create table if not exists public.concurrents_corrections (
  id bigserial primary key,
  passage_id uuid,
  post_id uuid,
  contenu_id uuid,
  langue text,
  champ text not null check (champ in ('slide', 'hashtags')),
  position integer,
  avant text,
  apres text,
  motif text,
  deck_corrige boolean not null default false,
  fait_le timestamptz not null default now()
);
alter table public.concurrents_corrections enable row level security;

create or replace function public.mentions_concurrents(p_debut date, p_fin date)
returns table (
  passage_id uuid,
  post_id uuid,
  contenu_id uuid,
  compte text,
  langue text,
  date_prevue date,
  publie boolean,
  champ text,
  slide integer,
  texte text,
  cites text[],
  micabo_dans_post boolean
)
language sql
stable
set search_path = public
as $$
  with c as (
    select nom, motif from public.concurrents where actif
  ),
  base as (
    select pa.id as pid, po.id as poid, pa.contenu_id as cid, co.handle_tiktok as handle,
      pa.langue as lg, po.date_publication_prevue as d,
      (po.publie_at is not null or pa.statut = 'publie') as en_ligne,
      po.hashtags as tags,
      exists (select 1 from public.post_slides s2
              where s2.post_id = po.id and s2.texte_overlay ~* 'micabo') as a_micabo
    from public.posts po
    join public.passages pa on pa.post_id = po.id
    join public.comptes co on co.id = po.compte_id
    where po.date_publication_prevue between p_debut and p_fin
      and not coalesce(po.est_test, false)
  ),
  textes as (
    select b.*, 'slide'::text as ch, s.position as pos, s.texte_overlay as txt
    from base b join public.post_slides s on s.post_id = b.poid
    union all
    select b.*, 'hashtags'::text, null::integer, b.tags
    from base b where b.tags is not null
  )
  select t.pid, t.poid, t.cid, t.handle, t.lg, t.d, t.en_ligne, t.ch, t.pos, t.txt,
    array(select c.nom from c where t.txt ~* c.motif order by c.nom),
    t.a_micabo
  from textes t
  where exists (select 1 from c where t.txt ~* c.motif)
  order by t.d, t.handle, t.pos nulls last;
$$;

create or replace function public.corriger_texte_post(
  p_passage_id uuid,
  p_position integer,
  p_texte text,
  p_motif text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pa record;
  v_avant text;
  v_n integer;
  v_deck boolean := false;
begin
  if p_texte is null or length(trim(p_texte)) = 0 then
    raise exception 'corriger_texte_post : texte vide';
  end if;

  select pa.id, pa.post_id, pa.contenu_id, pa.langue, pa.statut, pa.publie_at,
         po.publie_at as post_publie_at
    into v_pa
  from public.passages pa
  join public.posts po on po.id = pa.post_id
  where pa.id = p_passage_id
  for update of pa;
  if not found then
    raise exception 'corriger_texte_post : passage % introuvable ou sans post', p_passage_id;
  end if;
  if v_pa.statut = 'publie' or v_pa.publie_at is not null or v_pa.post_publie_at is not null then
    raise exception 'corriger_texte_post : post déjà publié — on ne réécrit pas ce qui est en ligne';
  end if;

  select s.texte_overlay into v_avant
  from public.post_slides s
  where s.post_id = v_pa.post_id and s.position = p_position;
  if not found then
    raise exception 'corriger_texte_post : slide % absente du post %', p_position, v_pa.post_id;
  end if;
  if v_avant is not distinct from p_texte then
    return jsonb_build_object('change', false);
  end if;

  -- Le rendu incrusté porte l'ancien texte : on le jette, la slide repart en
  -- classique (image propre + texte) ou sera ré-incrustée.
  update public.post_slides
  set texte_overlay = p_texte, burned_media_id = null, burned_at = null, burn_erreur = null
  where post_id = v_pa.post_id and position = p_position;

  update public.passages pa
  set slides = (
    select jsonb_agg(
      case when (e->>'position')::int = p_position
           then jsonb_set(e, '{texte_overlay}', to_jsonb(p_texte)) else e end
      order by o)
    from jsonb_array_elements(pa.slides) with ordinality as t(e, o))
  where pa.id = v_pa.id and jsonb_typeof(pa.slides) = 'array';

  -- Le deck de la même langue, s'il porte encore le même texte à cette
  -- position : les prochains posts de ce slideshow naissent propres.
  update public.contenu_langues cl
  set slides = (
    select jsonb_agg(
      case when (e->>'position')::int = p_position
           then jsonb_set(e, '{texte_overlay}', to_jsonb(p_texte)) else e end
      order by o)
    from jsonb_array_elements(cl.slides) with ordinality as t(e, o))
  where cl.contenu_id = v_pa.contenu_id and cl.langue = v_pa.langue
    and jsonb_typeof(cl.slides) = 'array'
    and exists (
      select 1 from jsonb_array_elements(cl.slides) e
      where (e->>'position')::int = p_position and e->>'texte_overlay' = v_avant
    );
  get diagnostics v_n = row_count;
  v_deck := v_n > 0;
  if v_deck then
    delete from public.burn_rendus
    where contenu_id = v_pa.contenu_id and langue = v_pa.langue and position = p_position;
  end if;

  insert into public.concurrents_corrections
    (passage_id, post_id, contenu_id, langue, champ, position, avant, apres, motif, deck_corrige)
  values
    (v_pa.id, v_pa.post_id, v_pa.contenu_id, v_pa.langue, 'slide', p_position, v_avant, p_texte, p_motif, v_deck);

  return jsonb_build_object('change', true, 'deck_corrige', v_deck);
end;
$$;

create or replace function public.corriger_hashtags_post(
  p_passage_id uuid,
  p_hashtags text,
  p_motif text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pa record;
  v_avant text;
  v_n integer;
  v_deck boolean := false;
begin
  select pa.id, pa.post_id, pa.contenu_id, pa.langue, pa.statut, pa.publie_at,
         po.publie_at as post_publie_at, po.hashtags as tags
    into v_pa
  from public.passages pa
  join public.posts po on po.id = pa.post_id
  where pa.id = p_passage_id
  for update of pa;
  if not found then
    raise exception 'corriger_hashtags_post : passage % introuvable ou sans post', p_passage_id;
  end if;
  if v_pa.statut = 'publie' or v_pa.publie_at is not null or v_pa.post_publie_at is not null then
    raise exception 'corriger_hashtags_post : post déjà publié — on ne réécrit pas ce qui est en ligne';
  end if;
  v_avant := v_pa.tags;
  if v_avant is not distinct from p_hashtags then
    return jsonb_build_object('change', false);
  end if;

  update public.posts set hashtags = p_hashtags where id = v_pa.post_id;
  update public.passages set hashtags = p_hashtags where id = v_pa.id;
  update public.contenu_langues
  set hashtags = p_hashtags
  where contenu_id = v_pa.contenu_id and langue = v_pa.langue and hashtags = v_avant;
  get diagnostics v_n = row_count;
  v_deck := v_n > 0;

  insert into public.concurrents_corrections
    (passage_id, post_id, contenu_id, langue, champ, position, avant, apres, motif, deck_corrige)
  values
    (v_pa.id, v_pa.post_id, v_pa.contenu_id, v_pa.langue, 'hashtags', null, v_avant, p_hashtags, p_motif, v_deck);

  return jsonb_build_object('change', true, 'deck_corrige', v_deck);
end;
$$;

revoke all on function public.mentions_concurrents(date, date) from public, anon, authenticated;
revoke all on function public.corriger_texte_post(uuid, integer, text, text) from public, anon, authenticated;
revoke all on function public.corriger_hashtags_post(uuid, text, text) from public, anon, authenticated;
grant execute on function public.mentions_concurrents(date, date) to service_role;
grant execute on function public.corriger_texte_post(uuid, integer, text, text) to service_role;
grant execute on function public.corriger_hashtags_post(uuid, text, text) to service_role;
