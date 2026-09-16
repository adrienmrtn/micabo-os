-- Deux défauts du même symptôme : « 1/2 post(s) » dans le panneau des
-- incomplets, mais « Quota déjà rempli (2/2) » quand on clique Assigner.
--
-- 1) POSTS ORPHELINS. `materialiserPostDepuisPassage` écrit le `posts`, puis
--    les `post_slides`, puis lie `passages.post_id`. Les deux premiers échecs
--    rollbackent le post — mais rien ne protège la MORT du process entre les
--    slides et le lien : l'invocation Edge meurt à 150 s d'inactivité
--    (`IDLE_TIMEOUT`, vu le 16/09 à 22:07). Le post reste, le passage reste
--    sans `post_id`, et `purgerAssignationIncomplete` le supprime à la passe
--    suivante. Résultat : un post orphelin, sans passage.
--
--    Le compteur de quota lit `Math.max(passages, posts)` — pour rester
--    cohérent avec le trigger `posts_enforce_quota_jour()` — donc l'orphelin
--    remplit le quota alors qu'il n'a pas de passage. Le panneau compte les
--    passages et signale « 1/2 » ; le bouton compte 2 et refuse. Le créateur
--    poste une fois au lieu de deux, et personne ne peut le débloquer.
--
--    Pire : un orphelin PUBLIÉ (le créateur le voit dans son app et le poste)
--    est invisible au moteur — pas de relevé de vues, aucun crédit de cycle,
--    rien dans la qualification. Du travail publié, perdu pour le système.
--
--    `rattacher_posts_orphelins()` recolle ces posts. Le lien vers le contenu
--    a disparu (`posts.sujet_id` est null sur tous les orphelins), on le
--    retrouve par les MÉDIAS : le contenu dont `structure_slides` contient
--    tous les `post_slides.media_id` du post. Sur les 19 orphelins du 10 au
--    17/09, la règle en résout 18 sans ambiguïté et n'en laisse aucun ambigu.
--
-- 2) MÊME SLIDESHOW DEUX FOIS LE MÊME JOUR. `choisirContenu` exclut les
--    doublons du jour par une lecture en base + une liste en mémoire, toutes
--    deux locales à un appel : deux workers concurrents sur le même compte
--    lisent avant que l'autre n'ait committé et tirent le même slideshow. Le
--    trigger `posts_enforce_quota_jour()` compte les posts, pas lesquels.
--    Vu le 15/09 à 22:00:41 et 22:00:43 sur hugo.notes813.
--
--    L'index unique ci-dessous ferme la course au niveau base.
--
--    Il ne porte QUE sur le futur (>= 2026-09-18). Deux doublons historiques
--    existent, et l'un d'eux — louise.revisions565 le 08/09 — a ses DEUX
--    posts réellement publiés, avec 4 540 et 1 042 vues. Ce sont des faits ;
--    on ne réécrit pas l'histoire pour faire passer une contrainte.

-- ---------------------------------------------------------------------------
-- 1) Rattrapage des posts orphelins
-- ---------------------------------------------------------------------------
create or replace function public.rattacher_posts_orphelins(p_depuis date default null)
returns table (rattaches integer, doublons_supprimes integer, non_resolus integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rattaches integer := 0;
  v_doublons integer := 0;
  v_non_resolus integer := 0;
  r record;
  v_contenu uuid;
  v_n integer;
begin
  for r in
    select po.id, po.compte_id, po.date_publication_prevue as jour,
           po.statut::text as statut, po.created_at, po.publie_at, po.publie_url,
           po.musique_url, po.musique_titre, po.musique_plateforme, po.hashtags
    from public.posts po
    where po.est_test = false
      and po.date_publication_prevue is not null
      and (p_depuis is null or po.date_publication_prevue >= p_depuis)
      and not exists (select 1 from public.passages p where p.post_id = po.id)
    order by po.date_publication_prevue, po.created_at
  loop
    -- Contenu dont les médias CONTIENNENT tous ceux du post. Strict : on
    -- préfère ne rien faire plutôt que d'attribuer un passage au mauvais
    -- slideshow, ce qui fausserait son cycle.
    -- `min(uuid)` n'existe pas : v_n garantit l'unicité, le premier suffit.
    select count(*), (array_agg(mc.contenu_id))[1] into v_n, v_contenu
    from (
      select c.id as contenu_id, array_agg(distinct (s->>'media_id')::uuid) as medias
      from public.contenus c, lateral jsonb_array_elements(c.structure_slides) s
      where s->>'media_id' is not null
      group by c.id
    ) mc
    where mc.medias @> (
      select array_agg(distinct ps.media_id)
      from public.post_slides ps
      where ps.post_id = r.id and ps.media_id is not null
    );

    if v_n is distinct from 1 then
      v_non_resolus := v_non_resolus + 1;
      continue;
    end if;

    -- Le slideshow est déjà assigné ce jour-là sur ce compte : l'orphelin est
    -- un doublon (cause n°2), pas un passage manquant. On le supprime pour
    -- rendre son créneau — sauf s'il a été publié, auquel cas c'est un fait.
    if exists (
      select 1 from public.passages p
      where p.compte_id = r.compte_id
        and p.contenu_id = v_contenu
        and p.date_publication_prevue = r.jour
    ) then
      if r.statut = 'publie' then
        v_non_resolus := v_non_resolus + 1;
      else
        delete from public.posts where id = r.id;
        v_doublons := v_doublons + 1;
      end if;
      continue;
    end if;

    insert into public.passages (
      contenu_id, compte_id, langue, date_publication_prevue, statut,
      slides, musique_url, musique_titre, musique_plateforme, hashtags,
      publie_at, publie_url, post_id, created_at
    )
    select
      v_contenu,
      r.compte_id,
      coalesce(cp.langue, 'fr'),
      r.jour,
      (case r.statut
         when 'publie' then 'publie'
         when 'valide_par_poster' then 'valide_par_poster'
         when 'brouillon' then 'brouillon'
         else 'assigne' end)::public.passage_statut,
      coalesce(
        (select jsonb_agg(jsonb_build_object(
                  'position', ps.position,
                  'texte_overlay', ps.texte_overlay,
                  'position_sophia', coalesce(ps.position_sophia, false))
                order by ps.position)
         from public.post_slides ps where ps.post_id = r.id),
        '[]'::jsonb),
      r.musique_url, r.musique_titre, r.musique_plateforme, r.hashtags,
      r.publie_at, r.publie_url, r.id,
      -- created_at du post : le passage retombe dans le cycle auquel il
      -- appartenait, pas dans celui d'aujourd'hui.
      r.created_at
    from public.comptes cp
    where cp.id = r.compte_id;

    v_rattaches := v_rattaches + 1;
  end loop;

  return query select v_rattaches, v_doublons, v_non_resolus;
end;
$$;

comment on function public.rattacher_posts_orphelins(date) is
  'Recolle les posts sans passage (mort du process entre post_slides et le lien). '
  'Contenu retrouvé par les médias ; supprime les orphelins non publiés qui '
  'doublonnent un passage du jour. Idempotent.';

revoke all on function public.rattacher_posts_orphelins(date) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) Un slideshow ne sort plus deux fois le même jour sur le même compte
-- ---------------------------------------------------------------------------
-- Les reposts bonus rejouent volontairement le même contenu sur le même
-- compte : ils sont exclus. Le plancher de date laisse l'historique intact.
create unique index if not exists passages_compte_contenu_jour_uidx
  on public.passages (compte_id, contenu_id, date_publication_prevue)
  where date_publication_prevue >= date '2026-09-18'
    and bonus_repost is not true;
