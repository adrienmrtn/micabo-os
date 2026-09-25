-- Le cycle d'un slideshow est arbitré par la transaction (25/09/2026).
--
-- `passages_cible` disait combien de passages un cycle doit produire ; rien ne
-- le faisait respecter. `choisirContenu` LIT les restants (assignation_contenu.ts:974),
-- décide (:983), puis n'ÉCRIT qu'après avoir fabriqué le deck (:450) — 6 à 24
-- secondes plus tard. Entre les deux, aucun verrou sur `contenus` : le
-- `for update` de 0265 porte sur `comptes`. Six créateurs sont traités en
-- parallèle (`LARGEUR_ASSIGNATION = 6`), sur DEUX chaînes d'invocation
-- concurrentes — `minuit-vnext` et `minuit-vnext-journee` tombaient à la même
-- seconde à 22:00 UTC — donc jusqu'à douze workers lisent le même « il reste 1 »
-- et créent chacun un passage. Perte de mise à jour classique.
--
-- Mesuré sur les 98 cycles ouverts au 24/09/2026 : **22 passages en surplus sur
-- 169** (13 %), sur 15 slideshows ; **22 sur 22** créés à moins de 10 s du
-- passage précédent du même cycle, écart médian 2,1 s, minimum 4 ms, tous dans
-- la rafale 22:00–22:01 UTC. Le défaut rejouait chaque nuit : 3 le 21/09, 9 le
-- 22, 4 le 23, 5 le 24.
--
-- Quatre pistes ont été écartées sur données : la requalification qui rouvrirait
-- un cycle (0 cas — les passages naissent à 00:00, les requalifications tombent
-- à 00:02–00:18), le repêchage en D (0 occurrence), les exclusions du comptage
-- (`est_test` vrai nulle part, `post_id` null nulle part), et les chemins hors
-- tirage (orphelins, `revoquer-post`, reprises manuelles : 0 surplus).
--
-- Le correctif suit la règle de 0265 : **ce qui doit être cohérent entre workers
-- vit dans la transaction**, jamais dans un `select` applicatif relu douze fois.
-- Le compteur TS reste un chemin rapide ; il ne peut pas être la garantie.
--
-- Côté appelant, `P0002` est traité comme le doublon du jour : on journalise et
-- on repioche. Le créateur ne perd pas son post, c'est un autre slideshow qui le
-- remplit. Un appelant qui ne connaîtrait pas encore ce code dégrade proprement
-- (`log` + `continue` dans le `catch` existant), donc cette migration peut
-- précéder le redéploiement des chargeurs.
--
-- Aucun cron n'est planifié ici. Conforme à AGENTS.md.

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
  v_cible integer;
  v_depuis timestamptz;
  v_faits integer;
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

  -- 0 bis) Le verrou du SLIDESHOW, puis la cible du cycle.
  --
  --    Le compteur applicatif (`restantsParContenu`) lit les passages déjà
  --    committés, puis le worker fabrique son deck — traduction, placement,
  --    hashtags — pendant 6 à 24 secondes, et n'écrit qu'après. Rien ne
  --    verrouillait `contenus` entre les deux, et six créateurs sont traités
  --    en parallèle, sur deux chaînes d'invocation concurrentes : tous lisent
  --    le même « il reste 1 passage » et en créent chacun un.
  --
  --    Mesuré au 24/09/2026 : 22 passages en surplus sur 169 de cycle (13 %),
  --    22 sur 22 créés à moins de 10 s du précédent, écart médian 2,1 s,
  --    minimum 4 ms, tous dans la rafale du cron de minuit.
  --
  --    L'index ne peut pas porter cette règle : `passages_compte_contenu_jour_uidx`
  --    est un unique sur (compte_id, contenu_id, jour) et la collision est
  --    ENTRE comptes. « Au plus N par cycle » n'est pas un unique, et un
  --    EXCLUDE échouerait à la création sur les surplus historiques.
  --
  --    L'ordre des verrous est fixe pour toutes les transactions — `comptes`
  --    puis `contenus` — donc pas de nouveau 40P01 : c'est la leçon du
  --    deadlock ci-dessus, appliquée au second verrou.
  perform 1 from public.contenus where id = p_contenu_id for update;

  if not coalesce(p_bonus_repost, false) and not coalesce(p_est_test, false) then
    select ct.passages_cible, ct.tier_maj_at
      into v_cible, v_depuis
      from public.contenus ct
     where ct.id = p_contenu_id;

    -- Le comptage reproduit `restantsParContenu` à l'identique : hors reposts
    -- bonus, hors posts test, depuis `tier_maj_at`. Deux compteurs qui
    -- divergent finissent par se contredire — c'est la leçon des trois délais
    -- du cycle.
    if v_cible > 0 and v_depuis is not null then
      select count(*)
        into v_faits
        from public.passages p
        left join public.posts po on po.id = p.post_id
       where p.contenu_id = p_contenu_id
         and p.bonus_repost = false
         and coalesce(po.est_test, false) = false
         and p.created_at >= v_depuis;

      if v_faits >= v_cible then
        raise exception using
          errcode = 'P0002',
          message = format('cycle_complet : contenu=%s %s/%s', p_contenu_id, v_faits, v_cible);
      end if;
    end if;
  end if;

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
  --    Positions : `->>` puis cast, jamais `->` — le deck les porte tantôt en
  --    number, tantôt en string. Deux slides de même position, ou une slide
  --    sans position, signalent un deck malformé : on lève plutôt que de
  --    dédupliquer en silence, ce qui pourrait faire disparaître le CTA. Le
  --    23505 sur post_slides ne matche pas `estDoublonContenuJour` (il teste le
  --    nom de l'index), donc l'appelant repiocherait — mais un message explicite
  --    vaut mieux qu'une violation de contrainte opaque dans les logs.
  if exists (
    select 1 from jsonb_array_elements(p_slides) as s(elem)
    where s.elem->>'position' is null
  ) then
    raise exception 'creer_publication_atomique : slide sans position (contenu=%)', p_contenu_id;
  end if;
  if (select count(distinct (s.elem->>'position')::integer)
        from jsonb_array_elements(p_slides) as s(elem))
     <> jsonb_array_length(p_slides) then
    raise exception 'creer_publication_atomique : positions en double dans le deck (contenu=%)',
      p_contenu_id;
  end if;

  insert into public.post_slides (
    post_id, position, media_id, texte_overlay, position_sophia, reference_url
  )
  select
    v_post_id,
    (s.elem->>'position')::integer,
    m.id,
    coalesce(s.elem->>'texte_overlay', ''),
    coalesce((s.elem->>'position_sophia')::boolean, false),
    v.elem->>'reference_url'
  from jsonb_array_elements(p_slides) as s(elem)
  left join lateral (
    select ve.elem
    from jsonb_array_elements(coalesce(p_visuels, '[]'::jsonb)) as ve(elem)
    where (ve.elem->>'position')::integer = (s.elem->>'position')::integer
    limit 1
  ) v on true
  left join public.media_library m
    on m.id = nullif(v.elem->>'media_id', '')::uuid
  order by ((s.elem->>'position')::integer);

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
