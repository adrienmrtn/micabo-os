-- Une publication naît maintenant d'un seul coup, ou pas du tout.
--
-- Jusqu'ici l'assignation écrivait en quatre appels HTTP séparés :
--   1. INSERT passages
--   2. INSERT posts            ┐ dans materialiserPostDepuisPassage
--   3. INSERT post_slides      │
--   4. UPDATE passages.post_id ┘
-- Aucune transaction ne les couvrait. Les deux chemins d'erreur explicites
-- nettoyaient bien derrière eux, mais rien ne protège la MORT du process :
-- l'invocation Edge est coupée à 150 s (IDLE_TIMEOUT, vu le 16/09 à 22:07) et
-- aucun `catch` ne s'exécute. Il restait un post sans passage — un orphelin —
-- et il s'en fabriquait chaque nuit entre 22:00:1x et 22:00:5x (0264).
--
-- Un orphelin coûte trois fois : il remplit le quota sans passage (le créateur
-- poste une fois au lieu de deux, et rien ne peut le débloquer), il rend un
-- post publié invisible au moteur (ni vues, ni crédit de cycle, ni
-- qualification), et il fait sous-compter le cycle donc **sur-assigner** le
-- slideshow. 0264 soignait après coup ; ici on ferme le robinet.
--
-- ORDRE DES ÉCRITURES — passages d'abord, délibérément.
--
-- La FK `passages.post_id -> posts` n'impose PAS posts en premier : la colonne
-- est nullable, donc un passage peut naître avec post_id null puis être lié.
-- L'ordre ne décide donc pas de la correction (la transaction s'en charge),
-- seulement de QUELLE ERREUR GAGNE quand plusieurs sont possibles — et ça,
-- l'appelant en dépend :
--   * 23505 sur passages_compte_contenu_jour_uidx → il repioche un autre
--     slideshow (`continue`) ;
--   * « quota_posts_jour » (P0001 du trigger posts_enforce_quota_jour) → il
--     arrête le compte (`break`).
-- Insérer posts en premier ferait remonter « quota plein » là où l'ancien code
-- voyait un doublon : le compte s'arrêterait au lieu de repiocher. On garde
-- donc passages → posts → post_slides → lien.
--
-- AUCUN BLOC `exception` ICI, ET C'EST VOLONTAIRE.
--
-- En plpgsql, tout `begin … exception … end` ouvre une sous-transaction :
-- attraper puis poursuivre committe l'état déjà écrit — exactement l'orphelin
-- qu'on supprime. Et le TypeScript reconnaît ses deux cas au SQLSTATE et au
-- texte (`assignation_quota.ts`) : réemballer une erreur lui ferait traiter un
-- quota plein comme une panne. Les erreurs traversent intactes.
--
-- CE QUI RESTE DEHORS : la traduction + Sophia (`assurerDeckPourLangue`) et la
-- résolution des visuels, qui ne font que lire, puis le face swap UGC et
-- l'upscale, qui retouchent les slides après coup par appels réseau longs. Le
-- trigger de quota pose un `select … from comptes … for update` tenu jusqu'au
-- COMMIT : y glisser un appel Gemini sérialiserait tous les workers du compte.

create or replace function public.creer_publication_atomique(
  p_compte_id uuid,
  p_contenu_id uuid,
  p_langue text,
  p_jour date,
  p_slides jsonb,
  p_visuels jsonb default '[]'::jsonb,
  p_visuels_resolution jsonb default null,
  p_sujet_id uuid default null,
  p_musique_url text default null,
  p_musique_titre text default null,
  p_musique_plateforme text default null,
  p_hashtags text default null,
  p_est_test boolean default false,
  p_bonus_repost boolean default false,
  p_repost_bonus_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_passage_id uuid;
  v_post_id uuid;
begin
  -- `'null'::jsonb` satisfait NOT NULL et stocke un JSON null : seul
  -- jsonb_typeof l'attrape.
  if p_slides is null
     or jsonb_typeof(p_slides) <> 'array'
     or jsonb_array_length(p_slides) = 0 then
    raise exception 'creer_publication_atomique : deck vide (contenu=% compte=%)',
      p_contenu_id, p_compte_id;
  end if;
  if p_langue is null or length(trim(p_langue)) = 0 then
    raise exception 'creer_publication_atomique : langue manquante (contenu=% compte=%)',
      p_contenu_id, p_compte_id;
  end if;

  -- 0) Le verrou du compte, AVANT tout le reste. C'est le point le plus
  --    délicat de cette fonction.
  --
  --    L'INSERT dans `passages` prend un FOR KEY SHARE sur la ligne `comptes`
  --    (FK passages.compte_id), puis le trigger posts_enforce_quota_jour
  --    demande un FOR UPDATE sur CETTE MÊME ligne. Dans une seule transaction
  --    c'est une montée en verrou — et deux transactions concurrentes sur le
  --    même compte se bloquent mutuellement : chacune détient le KEY SHARE que
  --    l'autre doit attendre pour passer en FOR UPDATE. Deadlock 40P01.
  --
  --    Tant que les écritures étaient dans des transactions séparées, le KEY
  --    SHARE tombait au commit du passage et le cas n'existait pas ; la fusion
  --    le crée. On prend donc le verrou le plus fort d'abord, ce qui donne à
  --    toutes les transactions le même ordre d'acquisition. Le FOR KEY SHARE
  --    de la FK devient alors un non-événement, et le FOR UPDATE du trigger
  --    est déjà détenu.
  perform 1 from public.comptes where id = p_compte_id for update;

  -- 1) Le passage. post_id reste null le temps de créer le post : la FK
  --    l'autorise, et c'est ce qui laisse l'index anti-doublon trancher avant
  --    le trigger de quota.
  insert into public.passages (
    contenu_id, compte_id, langue, date_publication_prevue, statut,
    slides, musique_url, musique_titre, musique_plateforme, hashtags,
    bonus_repost, visuels_resolution
  )
  values (
    p_contenu_id, p_compte_id, p_langue, p_jour, 'assigne'::public.passage_statut,
    p_slides, p_musique_url, p_musique_titre, p_musique_plateforme, p_hashtags,
    coalesce(p_bonus_repost, false), p_visuels_resolution
  )
  returning id into v_passage_id;

  -- 2) Le post. C'est ici que posts_enforce_quota_jour se déclenche et pose son
  --    verrou sur la ligne comptes — d'où l'interdiction absolue de mettre quoi
  --    que ce soit de lent après.
  insert into public.posts (
    compte_id, sujet_id, type, statut, date_publication_prevue,
    musique_url, musique_titre, musique_plateforme, hashtags,
    pipeline_statut, pipeline_etape, pipeline_erreur, est_test
  )
  values (
    p_compte_id, p_sujet_id, 'contenu'::public.post_type,
    'assigne'::public.post_statut, p_jour,
    p_musique_url, p_musique_titre, p_musique_plateforme, p_hashtags,
    'done', null, null, coalesce(p_est_test, false)
  )
  returning id into v_post_id;

  -- 3) Les slides. Le texte et la position viennent du deck traduit ; le média
  --    et la référence viennent de la résolution des visuels, appariés par
  --    position.
  --
  --    `left join media_library` : un média supprimé entre la résolution (côté
  --    TypeScript, hors transaction) et maintenant écrit NULL au lieu de violer
  --    la FK. Le TS pré-vérifiait l'existence, mais la fenêtre entre sa lecture
  --    et l'écriture restait ouverte — ici elle est fermée pour de bon, et une
  --    slide sans visuel dégrade le post au lieu de perdre la publication.
  --
  --    `distinct on (position)` : le deck peut porter deux slides de même
  --    position (positions tantôt number tantôt string en JSONB), ce qui
  --    violerait unique (post_id, position) et ferait tomber toute la
  --    transaction sur un 23505 que l'appelant confondrait avec un doublon
  --    du jour.
  insert into public.post_slides (
    post_id, position, media_id, texte_overlay, position_sophia, reference_url
  )
  select distinct on (((s.elem->>'position')::integer))
    v_post_id,
    (s.elem->>'position')::integer,
    m.id,
    coalesce(s.elem->>'texte_overlay', ''),
    coalesce((s.elem->>'position_sophia')::boolean, false),
    v.elem->>'reference_url'
  from jsonb_array_elements(p_slides) with ordinality as s(elem, ord)
  left join lateral (
    select ve.elem
    from jsonb_array_elements(coalesce(p_visuels, '[]'::jsonb)) as ve(elem)
    where (ve.elem->>'position')::integer = (s.elem->>'position')::integer
    limit 1
  ) v on true
  left join public.media_library m
    on m.id = nullif(v.elem->>'media_id', '')::uuid
  where s.elem->>'position' is not null
  order by ((s.elem->>'position')::integer), s.ord;

  -- 4) Le lien. Dans la même transaction, donc jamais dissociable des trois
  --    écritures précédentes — c'est tout l'objet de cette fonction.
  update public.passages
     set post_id = v_post_id
   where id = v_passage_id;

  -- 5) Le repost bonus se refermait APRÈS la matérialisation : une mort entre
  --    les deux le laissait en 'prevu', il était rejoué le lendemain, et
  --    l'index anti-doublon ne le rattrape pas (il exclut bonus_repost). On le
  --    solde ici, dans la même transaction.
  if p_repost_bonus_id is not null then
    -- La garde sur `statut` ferme la course entre deux drains : sans elle, les
    -- deux soldent le même repost et créent chacun leur publication — et
    -- l'index anti-doublon du jour ne les rattrape pas, il exclut les reposts
    -- bonus. Si un autre worker est passé avant, on lève : la transaction
    -- entière est annulée et aucune publication en double n'est créée.
    update public.reposts_bonus
       set statut = 'fait', passage_id = v_passage_id
     where id = p_repost_bonus_id
       and statut = 'prevu';
    if not found then
      raise exception 'creer_publication_atomique : repost bonus % deja solde', p_repost_bonus_id;
    end if;
  end if;

  return jsonb_build_object('passage_id', v_passage_id, 'post_id', v_post_id);
end;
$$;

comment on function public.creer_publication_atomique(
  uuid, uuid, text, date, jsonb, jsonb, jsonb, uuid, text, text, text, text,
  boolean, boolean, uuid
) is
  'Cree passage + post + post_slides (+ solde le repost bonus) en UNE transaction. '
  'Remplace la sequence en quatre appels de assignation_contenu.ts, dont la mort '
  'du process laissait un post orphelin. Ne rattrape aucune exception : le TS '
  'reconnait quota_posts_jour et 23505/passages_compte_contenu_jour_uidx au texte.';

revoke all on function public.creer_publication_atomique(
  uuid, uuid, text, date, jsonb, jsonb, jsonb, uuid, text, text, text, text,
  boolean, boolean, uuid
) from public, anon, authenticated;

grant execute on function public.creer_publication_atomique(
  uuid, uuid, text, date, jsonb, jsonb, jsonb, uuid, text, text, text, text,
  boolean, boolean, uuid
) to service_role;

-- PostgREST résout les fonctions par NOM de paramètre et garde un cache : sans
-- ce reload, le premier appel rend un PGRST202 « function not found » qui
-- ressemble à une faute de frappe.
notify pgrst, 'reload schema';
