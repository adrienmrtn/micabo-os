-- Brief du matin — requêtes figées.
--
-- Lues et exécutées telles quelles par la routine du matin (voir PLAYBOOK.md).
-- Le modèle commente les résultats, il ne réécrit pas les requêtes : c'est ce
-- qui rend les chiffres comparables d'un jour à l'autre. Changer une définition
-- ou un seuil = un commit ici.
--
-- Conventions
--   {{JOUR}}  : jour du brief, date de Paris (ex. 2026-10-01). Le runner le
--               remplace avant exécution. Pour rejouer un jour passé, il suffit
--               d'y mettre la date voulue : rien ne dépend de now() sauf les
--               phases warmup / essai et la santé, qui décrivent l'instant.
--   J         : {{JOUR}} ; J-1 = hier. La rafale de minuit Paris (22:00 UTC)
--               crée les passages de J : à 08:00, ceux de J sont déjà assignés.
--   t_fin     : J à 08:00 Paris ; t_debut = t_fin - 24 h.
--   Passage de test : posts.est_test — exclu partout.
--   Repost bonus : passages.bonus_repost — hors cycle, exclu des comptages de
--               cycle et de concentration.
--   Compte « en process » : comptes.is_active et warmup_ends_at <= now() — la
--               définition de listerComptesSousQuota.
--
-- LECTURE SEULE. Aucune de ces requêtes n'écrit.


-- ===== Q1 par_langue =====
-- Une ligne par langue + TOTAL. Vues : fenêtres MÛRES (J-9..J-3 contre
-- J-16..J-10), jamais la veille — à 08:00 un post d'hier n'a qu'une mesure J+0
-- (médiane 676 contre ~1 500 au plateau) et ferait croire à une chute.
-- Moyenne ET médiane : un seul viral tire la moyenne.
with p as (select date '{{JOUR}}' as j),
pa as (
  select pa.compte_id, pa.date_publication_prevue as d, pa.statut, pa.vues
  from public.passages pa
  left join public.posts po on po.id = pa.post_id
  where not coalesce(po.est_test, false)
),
par_compte as (
  select c.id, c.langue, c.posts_par_jour,
    (c.warmup_ends_at is not null and c.warmup_ends_at <= now()) as en_process,
    c.created_at > now() - interval '5 days' as en_essai,
    count(pa.*) filter (where pa.d = p.j) as assignes_j,
    count(pa.*) filter (where pa.d = p.j - 1) as prevus_j1,
    count(pa.*) filter (where pa.d = p.j - 1 and pa.statut = 'publie') as publies_j1,
    count(pa.*) filter (where pa.d between p.j - 7 and p.j - 1) as prevus_7j,
    count(pa.*) filter (where pa.d between p.j - 7 and p.j - 1 and pa.statut = 'publie') as publies_7j
  from public.comptes c cross join p
  left join pa on pa.compte_id = c.id and pa.d between p.j - 7 and p.j
  where c.is_active
  group by c.id, c.langue, c.posts_par_jour, c.warmup_ends_at, c.created_at
),
vues as (
  select c.langue,
    case when pa.d between p.j - 9 and p.j - 3 then 'recent' else 'precedent' end as fenetre,
    pa.vues
  from pa cross join p
  join public.comptes c on c.id = pa.compte_id
  where pa.statut = 'publie' and pa.vues is not null
    and pa.d between p.j - 16 and p.j - 3
),
vues_agg as (
  select langue,
    sum(vues) filter (where fenetre = 'recent') as vues_7j,
    count(*) filter (where fenetre = 'recent') as mesures_7j,
    round(avg(vues) filter (where fenetre = 'recent')) as moy_7j,
    percentile_cont(0.5) within group (order by vues) filter (where fenetre = 'recent') as med_7j,
    sum(vues) filter (where fenetre = 'precedent') as vues_7j_prec,
    round(avg(vues) filter (where fenetre = 'precedent')) as moy_7j_prec,
    percentile_cont(0.5) within group (order by vues) filter (where fenetre = 'precedent') as med_7j_prec
  from vues group by rollup(langue)
),
comptes_agg as (
  select langue,
    count(*) as comptes_actifs,
    count(*) filter (where not en_process) as en_warmup,
    count(*) filter (where en_essai) as en_essai,
    sum(posts_par_jour) filter (where en_process) as quota_jour,
    sum(assignes_j) filter (where en_process) as assignes_j,
    sum(prevus_j1) as prevus_j1, sum(publies_j1) as publies_j1,
    sum(prevus_7j) as prevus_7j, sum(publies_7j) as publies_7j
  from par_compte group by rollup(langue)
)
select coalesce(c.langue, 'TOTAL') as langue, c.comptes_actifs, c.en_warmup, c.en_essai,
  c.quota_jour, c.assignes_j, c.prevus_j1, c.publies_j1, c.prevus_7j, c.publies_7j,
  v.vues_7j, v.mesures_7j, v.moy_7j, round(v.med_7j) as med_7j,
  v.vues_7j_prec, v.moy_7j_prec, round(v.med_7j_prec) as med_7j_prec
from comptes_agg c
left join vues_agg v on v.langue is not distinct from c.langue
order by c.langue is null, c.langue;


-- ===== Q2 concentration =====
-- Sur-exploitation : passages du JOUR par slideshow, pour J (rafale de cette
-- nuit) et J-1. C'est le seul angle qui révèle un repêchage en boucle — leçon
-- de 0275/0276 : une mesure qui part de tier_maj_at ne voit pas le défaut qui
-- réécrit tier_maj_at.
-- Alerte : un slideshow sur >= 3 comptes le même jour, ou top 5 > 25 %.
with p as (select date '{{JOUR}}' as j),
pa as (
  select pa.date_publication_prevue as d, pa.contenu_id, pa.compte_id
  from public.passages pa
  left join public.posts po on po.id = pa.post_id
  cross join p
  where not coalesce(po.est_test, false)
    and not coalesce(pa.bonus_repost, false)
    and pa.date_publication_prevue in (p.j, p.j - 1)
),
par as (
  select pa.d, pa.contenu_id, count(*) as n, count(distinct pa.compte_id) as comptes,
    array_agg(distinct c.langue) as langues
  from pa join public.comptes c on c.id = pa.compte_id
  group by pa.d, pa.contenu_id
),
rang as (
  select par.*, row_number() over (partition by d order by n desc) as rk from par
)
select d as jour,
  sum(n) as passages,
  count(*) as slideshows_distincts,
  round(100.0 * sum(n) filter (where rk <= 5) / nullif(sum(n), 0), 1) as part_top5_pct,
  max(n) as max_meme_slideshow,
  (select json_agg(json_build_object(
      'contenu', left(r.contenu_id::text, 8), 'titre', left(ct.titre, 60),
      'tier', ct.tier, 'comptes', r.comptes, 'langues', r.langues) order by r.n desc)
   from rang r join public.contenus ct on ct.id = r.contenu_id
   where r.d = rang.d and r.comptes >= 3) as sur_3_comptes_ou_plus
from rang group by d order by d desc;


-- ===== Q3 boucles =====
-- Réassignations en boucle. Quatre contrôles, chacun devrait rendre 0 depuis
-- 0274/0276 ; une ligne ici est une régression.
--   repechages_jour_multi : slideshow repêché (cycle D à 1 passage) servi
--                           plus d'une fois le même jour (garde de 0276) ;
--   tier_reecrit_multi    : tier_maj_at réécrit plus que le cycle normal d'une
--                           nuit — une requalification puis un repêchage, soit
--                           2 écritures — donc >= 3, ou >= 2 repêchages (0275 en
--                           faisait 8) ;
--   meme_compte_30j       : même slideshow sur le même compte à < 30 jours
--                           (RECUL_MEME_COMPTE_JOURS), hors repost bonus ;
--   surplus_cycle         : cycle courant avec plus de passages que sa cible
--                           (comptage identique à restantsParContenu).
with p as (
  select date '{{JOUR}}' as j,
    ((date '{{JOUR}}')::timestamp + time '08:00') at time zone 'Europe/Paris' as t_fin
),
hist as (
  -- Un `ajustement` (correction manuelle, ex. 0282) ne touche pas tier_maj_at :
  -- ce n'est pas une réécriture du compteur, il n'entre pas dans le contrôle.
  select h.contenu_id, count(*) as ecritures,
    count(*) filter (where h.tier_apres = 'D' and h.passages_cible_apres = 1) as repechages
  from public.contenu_tier_historique h cross join p
  where h.fait_le >= p.t_fin - interval '24 hours' and h.fait_le < p.t_fin
    and h.motif <> 'ajustement'
  group by h.contenu_id
),
pa_j as (
  select pa.contenu_id, pa.compte_id, pa.date_publication_prevue as d
  from public.passages pa
  left join public.posts po on po.id = pa.post_id
  cross join p
  where pa.date_publication_prevue = p.j
    and not coalesce(pa.bonus_repost, false)
    and not coalesce(po.est_test, false)
),
repeches_multi as (
  select h.contenu_id, count(pa_j.*) as passages_j
  from hist h join pa_j on pa_j.contenu_id = h.contenu_id
  where h.repechages > 0
  group by h.contenu_id having count(pa_j.*) > 1
),
meme_compte as (
  select pa_j.compte_id, pa_j.contenu_id, max(h.date_publication_prevue) as precedent
  from pa_j
  join public.passages h on h.compte_id = pa_j.compte_id and h.contenu_id = pa_j.contenu_id
    and h.date_publication_prevue >= pa_j.d - 30 and h.date_publication_prevue < pa_j.d
    and not coalesce(h.bonus_repost, false)
  group by pa_j.compte_id, pa_j.contenu_id
),
cycle as (
  select ct.id, ct.tier, ct.passages_cible, count(pa.*) as faits
  from public.contenus ct
  join public.passages pa on pa.contenu_id = ct.id and pa.created_at >= ct.tier_maj_at
  left join public.posts po on po.id = pa.post_id
  where ct.passages_cible > 0 and ct.tier_maj_at is not null
    and not coalesce(pa.bonus_repost, false)
    and not coalesce(po.est_test, false)
  group by ct.id, ct.tier, ct.passages_cible
  having count(pa.*) > ct.passages_cible
)
select 'repechages_jour_multi' as controle, count(*) as cas,
  json_agg(json_build_object('contenu', left(contenu_id::text, 8), 'passages_j', passages_j)) as detail
from repeches_multi
union all
select 'tier_reecrit_multi', count(*),
  json_agg(json_build_object('contenu', left(contenu_id::text, 8), 'ecritures', ecritures))
from hist where ecritures >= 3 or repechages >= 2
union all
select 'repechages_24h', coalesce(sum(repechages), 0), null from hist
union all
select 'meme_compte_30j', count(*),
  json_agg(json_build_object('compte', left(compte_id::text, 8), 'contenu', left(contenu_id::text, 8), 'precedent', precedent))
from meme_compte
union all
select 'surplus_cycle', count(*),
  json_agg(json_build_object('contenu', left(id::text, 8), 'tier', tier, 'cible', passages_cible, 'faits', faits))
from cycle;


-- ===== Q4 pool_runway =====
-- Pool RÉELLEMENT tirable pour la rafale de cette nuit (J+1) — leçon du 26/09 :
-- compter les « dus » n'est jamais une mesure du pool. Un slideshow est tirable
-- pour un compte s'il est validé, partage un label NON retiré avec le compte,
-- respecte ugc / application, n'est pas passé sur ce compte depuis 30 jours,
-- et doit encore un passage dans son cycle.
-- Runway = passages dus tirables / quota quotidien des comptes en process.
-- Les repêchables (D, sans tier ou cible 0) donnent au plus 1 passage chacun
-- par jour (0276) : ils sont comptés à part, jamais dans le runway.
-- Alerte : runway < 3 jours, ou un compte avec < 10 inédits.
with p as (select date '{{JOUR}}' + 1 as prochain),
c as (
  select id, langue, posts_par_jour, coalesce(ugc_ai, false) as ugc_ai, application_id
  from public.comptes
  where is_active and warmup_ends_at is not null and warmup_ends_at <= now()
),
cl as (
  select cl.compte_id, cl.label_id
  from public.compte_labels cl
  join c on c.id = cl.compte_id
  join public.labels l on l.id = cl.label_id
  where l.retire_le is null
),
ct as (
  select * from public.contenus where statut = 'valide' and import_statut = 'done'
),
faits as (
  select pa.contenu_id, count(*) as n
  from public.passages pa
  join ct on ct.id = pa.contenu_id
  left join public.posts po on po.id = pa.post_id
  where ct.tier_maj_at is not null and pa.created_at >= ct.tier_maj_at
    and not coalesce(pa.bonus_repost, false)
    and not coalesce(po.est_test, false)
  group by pa.contenu_id
),
etat as (
  select ct.id, ct.tier,
    case when ct.passages_cible > 0 and ct.tier_maj_at is not null
         then greatest(0, ct.passages_cible - coalesce(f.n, 0)) else 0 end as restants,
    (ct.tier is null or ct.tier = 'D' or coalesce(ct.passages_cible, 0) = 0) as repechable
  from ct left join faits f on f.contenu_id = ct.id
),
eligible as (
  select distinct c.id as compte_id, ct.id as contenu_id
  from c
  join cl on cl.compte_id = c.id
  join public.contenu_labels x on x.label_id = cl.label_id
  join ct on ct.id = x.contenu_id
    and coalesce(ct.ugc_compatible, false) = c.ugc_ai
    and (c.application_id is null or ct.application_id = c.application_id)
  cross join p
  where not exists (
    select 1 from public.passages h
    where h.compte_id = c.id and h.contenu_id = ct.id
      and h.date_publication_prevue >= p.prochain - 30
  )
),
par_compte as (
  select c.id, c.langue, c.posts_par_jour,
    count(e.contenu_id) as inedits,
    count(e.contenu_id) filter (where et.restants > 0) as tirables,
    count(e.contenu_id) filter (where et.restants > 0 and et.tier in ('B', 'A', 'S', 'S+')) as tirables_bplus,
    count(e.contenu_id) filter (where et.repechable) as repechables
  from c
  left join eligible e on e.compte_id = c.id
  left join etat et on et.id = e.contenu_id
  group by c.id, c.langue, c.posts_par_jour
),
global as (
  select et.*
  from etat et
  where exists (select 1 from eligible e where e.contenu_id = et.id)
)
select 'global' as portee, null::text as langue,
  (select sum(posts_par_jour) from c) as quota_jour,
  count(*) filter (where restants > 0) as slideshows_tirables,
  count(*) filter (where restants > 0 and tier in ('B', 'A', 'S', 'S+')) as tirables_bplus,
  count(*) filter (where restants > 0 and tier = 'C') as tirables_c,
  sum(restants) as passages_dus_tirables,
  sum(restants) filter (where tier in ('B', 'A', 'S', 'S+')) as dus_bplus,
  count(*) filter (where repechable) as repechables,
  round(sum(restants)::numeric / nullif((select sum(posts_par_jour) from c), 0), 1) as runway_jours,
  -- Dus qu'AUCUN compte en process ne peut tirer (label retiré, aucun label,
  -- ugc / application) : ils gonflent les « passages dus » sans jamais sortir.
  (select count(*) from etat et
   where et.restants > 0 and not exists (select 1 from eligible e where e.contenu_id = et.id)) as dus_intirables,
  null::bigint as inedits_min, null::numeric as inedits_med
from global
union all
select 'langue', langue, sum(posts_par_jour), null, null, null, null, null, null, null, null,
  min(inedits), percentile_cont(0.5) within group (order by inedits)::numeric
from par_compte group by langue
order by 1, 2;


-- ===== Q5 percees =====
-- Posts qui ont percé : passages publiés depuis <= 14 jours à >= 10 000 vues,
-- avec le rapport à la moyenne des 10 derniers mesurés du compte. Signal fort
-- à >= 50 000 (seuil du repost bonus). La mémoire dit lesquels ont déjà été
-- annoncés : on ne remonte que les nouveaux et ceux qui ont franchi un palier.
with p as (select date '{{JOUR}}' as j),
moy as (
  select compte_id, round(avg(vues)) as moy10
  from (
    select pa.compte_id, pa.vues,
      row_number() over (partition by pa.compte_id order by pa.publie_at desc) as rk
    from public.passages pa cross join p
    where pa.statut = 'publie' and pa.vues is not null and pa.date_publication_prevue <= p.j - 2
  ) x where rk <= 10 group by compte_id
)
select left(pa.id::text, 8) as passage, pa.date_publication_prevue as jour, c.langue,
  c.handle_tiktok, left(ct.titre, 60) as titre, ct.tier, pa.vues, pa.likes, pa.partages,
  m.moy10, round(pa.vues::numeric / nullif(m.moy10, 0), 1) as x_moyenne_compte,
  pa.bonus_repost, pa.publie_url, pa.stats_maj_at
from public.passages pa cross join p
join public.comptes c on c.id = pa.compte_id
join public.contenus ct on ct.id = pa.contenu_id
left join moy m on m.compte_id = pa.compte_id
where pa.statut = 'publie' and pa.vues >= 10000
  and pa.date_publication_prevue >= p.j - 14
order by pa.vues desc
limit 25;


-- ===== Q5b tiers_24h =====
-- Mouvements de tier sur t_debut..t_fin, hors repêchages (D -> D à 1 passage).
with p as (
  select ((date '{{JOUR}}')::timestamp + time '08:00') at time zone 'Europe/Paris' as t_fin
)
select coalesce(h.tier_avant, '∅') || ' → ' || h.tier_apres as mouvement, count(*) as n,
  json_agg(left(ct.titre, 40) order by h.fait_le) filter (where h.tier_apres in ('S', 'S+')) as vers_s
from public.contenu_tier_historique h cross join p
join public.contenus ct on ct.id = h.contenu_id
where h.fait_le >= p.t_fin - interval '24 hours' and h.fait_le < p.t_fin
  and not (h.tier_apres = 'D' and h.passages_cible_apres = 1)
group by 1 order by 2 desc;


-- ===== Q6 createurs =====
-- Une ligne par compte actif. Source de « posters actifs », « font des vues »,
-- « comptes qui baissent ». Moyenne sur les 10 derniers publiés MESURÉS
-- (publiés depuis >= 2 jours, MESURE_JOURS) — règle de qualification.ts.
-- Alertes : 0 publié sur J-2..J-1 alors que prévu ; moy10 < 600 ;
-- médiane 7 j mûrs < 60 % des 7 j précédents ; qualification changée en 48 h ;
-- ne_pas_renouveler sans hm_prevenu.
with p as (select date '{{JOUR}}' as j),
pa as (
  select pa.compte_id, pa.date_publication_prevue as d, pa.statut, pa.vues, pa.publie_at
  from public.passages pa
  left join public.posts po on po.id = pa.post_id
  where not coalesce(po.est_test, false)
),
dix as (
  select compte_id, round(avg(vues)) as moy10, count(*) as n10
  from (
    select pa.compte_id, pa.vues,
      row_number() over (partition by pa.compte_id order by pa.publie_at desc) as rk
    from pa cross join p
    where pa.statut = 'publie' and pa.vues is not null and pa.d <= p.j - 2
  ) x where rk <= 10 group by compte_id
),
agg as (
  select pa.compte_id,
    count(*) filter (where pa.d = p.j) as assignes_j,
    count(*) filter (where pa.d between p.j - 2 and p.j - 1) as prevus_2j,
    count(*) filter (where pa.d between p.j - 2 and p.j - 1 and pa.statut = 'publie') as publies_2j,
    count(*) filter (where pa.d between p.j - 7 and p.j - 1) as prevus_7j,
    count(*) filter (where pa.d between p.j - 7 and p.j - 1 and pa.statut = 'publie') as publies_7j,
    -- Médianes, pas moyennes : un seul viral (968 500 vues sur ela.sinav959
    -- le 19/09) ferait lire « −94 % » la semaine suivante.
    round(percentile_cont(0.5) within group (order by pa.vues)
      filter (where pa.d between p.j - 9 and p.j - 3 and pa.statut = 'publie' and pa.vues is not null)) as med_7j,
    round(percentile_cont(0.5) within group (order by pa.vues)
      filter (where pa.d between p.j - 16 and p.j - 10 and pa.statut = 'publie' and pa.vues is not null)) as med_7j_prec,
    max(pa.publie_at) as dernier_publie_at
  from pa cross join p
  where pa.d between p.j - 16 and p.j
  group by pa.compte_id
),
qualif as (
  select distinct on (compte_id) compte_id, qualification_avant, qualification_apres, fait_le
  from public.compte_qualification_historique cross join p
  where fait_le >= (p.j::timestamp at time zone 'Europe/Paris') - interval '40 hours'
  order by compte_id, fait_le desc
)
select c.langue, c.handle_tiktok, coalesce(c.persona_nom, '') as persona,
  trim(coalesce(pr.prenom, '') || ' ' || coalesce(pr.nom, '')) as poster,
  coalesce(hm.prenom, '—') as manager,
  case when c.warmup_ends_at is null or c.warmup_ends_at > now() then 'warmup'
       when c.created_at > now() - interval '5 days' then 'essai'
       else 'process' end as phase,
  c.posts_par_jour, coalesce(a.assignes_j, 0) as assignes_j,
  coalesce(a.publies_2j, 0) || '/' || coalesce(a.prevus_2j, 0) as publies_2j,
  coalesce(a.publies_7j, 0) || '/' || coalesce(a.prevus_7j, 0) as publies_7j,
  d.moy10, d.n10, a.med_7j, a.med_7j_prec,
  case when a.med_7j_prec > 0 then round(100.0 * a.med_7j / a.med_7j_prec) end as tendance_pct,
  a.dernier_publie_at,
  c.qualification,
  case when q.compte_id is not null then q.qualification_avant || ' → ' || q.qualification_apres end as qualif_changee_48h,
  c.ne_pas_renouveler, c.hm_prevenu,
  c.surveillance_skip_jusqu_a > now() as surveillance_skip
from public.comptes c cross join p
left join public.profiles pr on pr.id = c.poster_id
left join public.profiles hm on hm.id = pr.manager_id
left join agg a on a.compte_id = c.id
left join dix d on d.compte_id = c.id
left join qualif q on q.compte_id = c.id
where c.is_active
order by c.langue, d.moy10 desc nulls last;


-- ===== Q7 hm =====
-- Par hiring manager : ses créateurs, leurs comptes, et ce qui l'attend.
with hms as (
  select ur.user_id, pr.prenom, pr.nom, pr.manager_id
  from public.user_roles ur join public.profiles pr on pr.id = ur.user_id
  where ur.role::text = 'hiring_manager'
),
comptes as (
  select pr.manager_id, c.*
  from public.comptes c join public.profiles pr on pr.id = c.poster_id
)
select trim(coalesce(h.prenom, '') || ' ' || coalesce(h.nom, '')) as hm,
  (select count(*) from public.profiles x where x.manager_id = h.user_id) as createurs,
  count(c.id) filter (where c.is_active) as comptes_actifs,
  count(c.id) filter (where c.is_active and (c.warmup_ends_at is null or c.warmup_ends_at > now())) as en_warmup,
  count(c.id) filter (where c.is_active and c.created_at > now() - interval '5 days') as en_essai,
  count(c.id) filter (where c.created_at > now() - interval '7 days') as nouveaux_7j,
  count(c.id) filter (where c.is_active and c.qualification in ('INACTIF', 'MAUVAISES_VUES')) as en_difficulte,
  count(c.id) filter (where c.ne_pas_renouveler and not coalesce(c.hm_prevenu, false)) as a_prevenir,
  string_agg(distinct c.langue, ', ') as langues
from hms h left join comptes c on c.manager_id = h.user_id
group by h.user_id, h.prenom, h.nom
order by comptes_actifs desc;


-- ===== Q8 recrutement_essais =====
-- Parrainages en attente, nouveaux comptes, sorties de warmup, fins d'essai.
-- Essai = 5 jours après comptes.created_at (essai.ts). Alerte : fin d'essai
-- dans les 48 h, parrainage en attente depuis plus de 3 jours.
with p as (select date '{{JOUR}}' as j)
select 'parrainage_en_attente' as type, r.prenom || ' ' || coalesce(r.nom, '') as qui,
  r.pays as detail, r.created_at as depuis, null::text as resultat
from public.creator_referrals r where r.statut::text = 'en_attente'
union all
select 'nouveau_compte_7j', c.handle_tiktok, c.langue, c.created_at, null
from public.comptes c where c.created_at > now() - interval '7 days'
union all
select 'sortie_warmup_aujourdhui', c.handle_tiktok, c.langue, c.warmup_ends_at, null
from public.comptes c cross join p
where c.is_active and (c.warmup_ends_at at time zone 'Europe/Paris')::date = p.j
union all
select 'fin_essai_48h', c.handle_tiktok, c.langue, c.created_at + interval '5 days',
  (select count(*) filter (where pa.statut = 'publie') || '/' || count(*) || ' publiés, '
          || coalesce(sum(pa.vues), 0) || ' vues'
   from public.passages pa where pa.compte_id = c.id)
from public.comptes c
where c.is_active and c.created_at + interval '5 days' between now() and now() + interval '48 hours'
order by 1, 4;


-- ===== Q9 sante =====
-- Santé du moteur, court. Chaque ligne non nulle est à lire.
with p as (
  select date '{{JOUR}}' as j,
    ((date '{{JOUR}}')::timestamp + time '08:00') at time zone 'Europe/Paris' as t_fin
),
c as (
  select id, posts_par_jour from public.comptes
  where is_active and warmup_ends_at is not null and warmup_ends_at <= now()
)
-- Le relevé d'abord : sans vues, aucun cycle ne se clôt, aucune requalification
-- ne rouvre de cycle, et le pool se vide jusqu'au repêchage. Le 30/09 le drain
-- s'est déclaré « terminé, erreurs : [] » alors que chaque scrape rendait
-- Apify 402 : seul l'horodatage des relevés le montre. releves_24h = 0 avec des
-- posts publiés = 🔴, et la cause se lit dans les logs (PLAYBOOK.md).
select 'releves_24h' as controle,
  (select count(*) from public.passages pa cross join p
   where pa.stats_maj_at >= p.t_fin - interval '24 hours' and pa.stats_maj_at < p.t_fin)::text as valeur,
  (select 'dernier relevé : ' || coalesce(to_char(max(stats_maj_at) at time zone 'Europe/Paris', 'DD/MM HH24:MI'), 'jamais')
   from public.passages)::text as detail
union all
-- Consommation Apify du cycle de facturation, écrite par rattrapage-elo à
-- chaque départ de passe (0281). Le 28/09, le crédit s'est épuisé sans que
-- rien dans l'OS ne le montre.
select 'apify_usage',
  (select coalesce(round(100.0 * (valeur->>'usage_usd')::numeric
            / nullif((valeur->>'limite_usd')::numeric, 0))::text || ' %', 'inconnu')
   from public.reglages where cle = 'apify_usage'),
  (select coalesce(valeur->>'usage_usd', '?') || ' $ / ' || coalesce(valeur->>'limite_usd', '?')
          || ' $ · cycle jusqu''au ' || coalesce(left(valeur->>'cycle_fin', 10), '?')
          || coalesce(' · erreur : ' || (valeur->>'erreur'), '')
          || ' · lu le ' || left(valeur->>'at', 16)
   from public.reglages where cle = 'apify_usage')
union all
select 'cron_echecs_24h',
  (select count(*) from cron.job_run_details d cross join p
   where d.start_time >= p.t_fin - interval '24 hours' and d.start_time < p.t_fin
     and d.status <> 'succeeded')::text as valeur,
  (select json_agg(distinct j.jobname) from cron.job_run_details d join cron.job j on j.jobid = d.jobid cross join p
   where d.start_time >= p.t_fin - interval '24 hours' and d.start_time < p.t_fin
     and d.status <> 'succeeded')::text as detail
union all
select 'comptes_sous_quota_j',
  (select count(*) from c cross join p
   where (select count(*) from public.passages pa where pa.compte_id = c.id and pa.date_publication_prevue = p.j) < c.posts_par_jour)::text,
  (select sum(c.posts_par_jour - (select count(*) from public.passages pa where pa.compte_id = c.id and pa.date_publication_prevue = p.j))
   from c cross join p
   where (select count(*) from public.passages pa where pa.compte_id = c.id and pa.date_publication_prevue = p.j) < c.posts_par_jour)::text || ' posts manquants'
union all
select 'passages_j_sans_post',
  (select count(*) from public.passages pa cross join p where pa.date_publication_prevue = p.j and pa.post_id is null)::text, null
union all
select 'slides_sans_image_j',
  (select count(*) from public.post_slides s join public.posts po on po.id = s.post_id cross join p
   where po.date_publication_prevue = p.j and s.media_id is null and s.burned_media_id is null)::text, null
union all
-- Un post se mesure une fois, à J+2 (0285) : passé 3 jours (J+2 + l'écart
-- entre deux passes), un post publié sans mesure de J+2 est un relevé raté.
select 'publies_sans_mesure_j2',
  (select count(*) from public.passages pa
   where pa.statut = 'publie' and pa.publie_at < now() - interval '3 days'
     and pa.publie_at > now() - interval '30 days'
     and (pa.stats_maj_at is null or pa.stats_maj_at - pa.publie_at < interval '2 days'))::text,
  (select coalesce(count(*), 0) || ' abandonné(s) après 3 échecs' from public.passages pa
   where pa.statut = 'publie' and pa.stats_echecs >= 3 and pa.publie_at > now() - interval '30 days')
union all
select 'file_validation',
  (select count(*) from public.contenus where statut = 'brouillon' and import_statut = 'done')::text,
  (select 'plus ancien : ' || min(created_at)::date from public.contenus where statut = 'brouillon' and import_statut = 'done')
union all
select 'imports_echoues_7j',
  (select count(*) from public.contenus where import_etape = 'failed' and created_at > now() - interval '7 days')::text, null
union all
select 'vues_globales_3j',
  (select string_agg(jour::text || ':' || vues_delta, ' ' order by jour desc)
   from (select * from public.vues_globales_jour order by jour desc limit 3) v), 'delta 0 répété = collecte profil figée';
