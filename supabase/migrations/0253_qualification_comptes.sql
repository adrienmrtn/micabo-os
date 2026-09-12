-- Qualification des comptes — l'ELO compte est retiré, remplacé par cinq cases.
--
-- L'ELO compte était un nombre : lisible par la machine, illisible par un
-- humain. « 41,3 » ne dit pas s'il faut relancer le créateur, changer son
-- quota, ou ne pas renouveler son contrat. Cinq cases le disent :
--
--   INACTIF < MAUVAISES_VUES < PASSABLE < BIEN < STAR
--
-- Les règles (calcul dans `_shared/qualification.ts`, jamais en SQL — elles
-- doivent être testables) :
--   INACTIF        ≤ 6 posts réellement publiés sur les 10 derniers prévus
--   MAUVAISES_VUES moyenne de vues < 600 sur les 10 derniers publiés
--   BIEN           moyenne ≥ 1 000 et ≥ 8 publiés sur 10 prévus
--   STAR           moyenne > 10 000 et ≥ 9 publiés sur 10 prévus
--   PASSABLE       tout le reste
-- Un compte qui coche plusieurs cases prend **la moins bonne**.
--
-- La requalification tourne à la FIN du drain `rattrapage-elo`, pas au cron de
-- minuit : le relevé des vues est asynchrone et se termine bien après minuit.
-- Requalifier à minuit noterait les comptes sur les vues de la veille.
--
-- Aucun cron n'est planifié ici. Conforme à AGENTS.md.

-- ---------------------------------------------------------------------------
-- La case, sur le compte
-- ---------------------------------------------------------------------------
alter table public.comptes
  add column if not exists qualification text not null default 'PASSABLE',
  add column if not exists qualification_maj_at timestamptz,
  add column if not exists qualification_manuelle boolean not null default false,
  add column if not exists qualification_manuelle_at timestamptz,
  add column if not exists qualification_manuelle_par uuid
    references public.profiles (id) on delete set null;

alter table public.comptes
  drop constraint if exists comptes_qualification_valide;
alter table public.comptes
  add constraint comptes_qualification_valide
  check (qualification in ('INACTIF', 'MAUVAISES_VUES', 'PASSABLE', 'BIEN', 'STAR'));

comment on column public.comptes.qualification is
  'Case du compte, recalculée en fin de drain rattrapage : INACTIF < MAUVAISES_VUES < PASSABLE < BIEN < STAR.';
comment on column public.comptes.qualification_manuelle is
  'Case posée à la main par un admin. Verrouillée : la requalification de nuit ne la réécrit pas.';

-- ---------------------------------------------------------------------------
-- La file de surveillance
-- ---------------------------------------------------------------------------
alter table public.comptes
  -- « Skip » : le compte sort de la file pour 7 jours. Une date, pas un
  -- booléen — sinon il faudrait un balai pour les rallumer.
  add column if not exists surveillance_skip_jusqu_a timestamptz,
  add column if not exists ne_pas_renouveler boolean not null default false,
  add column if not exists ne_pas_renouveler_at timestamptz,
  add column if not exists ne_pas_renouveler_par uuid
    references public.profiles (id) on delete set null,
  -- La checklist : « j'ai demandé au HM de ne pas renouveler ce compte ».
  -- Rien n'est coupé automatiquement, c'est une liste de suivi.
  add column if not exists hm_prevenu boolean not null default false,
  add column if not exists hm_prevenu_at timestamptz,
  add column if not exists hm_prevenu_par uuid
    references public.profiles (id) on delete set null;

comment on column public.comptes.surveillance_skip_jusqu_a is
  'Le compte est écarté de la file de surveillance jusqu''à cette date (bouton « skip », 7 jours).';
comment on column public.comptes.ne_pas_renouveler is
  'Le compte est sur la liste « ne pas renouveler ». Purement du suivi : rien n''est coupé dans le process.';
comment on column public.comptes.hm_prevenu is
  'Checklist admin : le HM a bien été prévenu de ne pas renouveler ce compte.';

create index if not exists comptes_surveillance_idx
  on public.comptes (qualification)
  where is_active and qualification in ('INACTIF', 'MAUVAISES_VUES');

create index if not exists comptes_ne_pas_renouveler_idx
  on public.comptes (ne_pas_renouveler_at desc)
  where ne_pas_renouveler;

-- ---------------------------------------------------------------------------
-- Nudge — messages prédéfinis
-- ---------------------------------------------------------------------------
-- Il n'existe aucun canal vers les créateurs en dehors de l'OS : pas d'e-mail,
-- pas de SMS, pas de Slack. Le nudge est donc un message INTERNE, affiché au
-- créateur à sa prochaine connexion.
create table if not exists public.nudges_modeles (
  id uuid primary key default gen_random_uuid(),
  cle text not null unique,
  ordre integer not null default 0,
  actif boolean not null default true,
  titre text not null,
  corps text not null,
  -- Les créateurs ne parlent pas tous français : l'OS est déjà bilingue côté
  -- poster, un nudge en français chez un créateur anglophone ne sert à rien.
  titre_en text,
  corps_en text,
  created_at timestamptz not null default now()
);

comment on table public.nudges_modeles is
  'Messages prédéfinis que l''admin peut envoyer depuis la file de surveillance.';

alter table public.nudges_modeles enable row level security;
drop policy if exists nudges_modeles_admin on public.nudges_modeles;
create policy nudges_modeles_admin on public.nudges_modeles
  for all using (public.is_admin()) with check (public.is_admin());

insert into public.nudges_modeles (cle, ordre, titre, corps, titre_en, corps_en)
values
  (
    'relance_publication', 10,
    'Tu as des posts en attente',
    'Il te reste des TikToks assignés que tu n''as pas encore publiés. Publie-les depuis ton calendrier : chaque jour sauté compte dans ton suivi.',
    'You have posts waiting',
    'Some assigned TikToks are still unpublished. Post them from your calendar — every skipped day counts in your review.'
  ),
  (
    'regularite', 20,
    'La régularité compte plus que le reste',
    'Poster tous les jours, même sans pic de vues, fait plus pour le compte qu''un gros post de temps en temps. Tiens le rythme du calendrier.',
    'Consistency matters most',
    'Posting every day, even without a spike in views, does more for the account than one big post now and then. Keep to the calendar.'
  ),
  (
    'vues_basses', 30,
    'Tes vues sont basses en ce moment',
    'La moyenne de tes derniers TikToks est en dessous de ce qu''on attend. Soigne la première slide et l''accroche, c''est là que tout se joue.',
    'Your views are low right now',
    'Your recent TikToks average below what we expect. Focus on the first slide and the hook — that is where it is decided.'
  ),
  (
    'contact_manager', 40,
    'Prends contact avec ton manager',
    'On aimerait faire le point avec toi sur ton compte. Réponds à ton manager dès que tu peux.',
    'Get in touch with your manager',
    'We would like to review your account with you. Reply to your manager as soon as you can.'
  )
on conflict (cle) do nothing;

-- ---------------------------------------------------------------------------
-- Nudge — messages envoyés
-- ---------------------------------------------------------------------------
-- Le corps est COPIÉ au lieu d'être référencé : réécrire un modèle ne doit pas
-- réécrire l'historique de ce qui a réellement été envoyé.
create table if not exists public.comptes_nudges (
  id uuid primary key default gen_random_uuid(),
  compte_id uuid not null references public.comptes (id) on delete cascade,
  poster_id uuid not null references public.profiles (id) on delete cascade,
  modele_cle text,
  titre text not null,
  corps text not null,
  envoye_par uuid references public.profiles (id) on delete set null,
  envoye_at timestamptz not null default now(),
  lu_at timestamptz
);

comment on table public.comptes_nudges is
  'Messages internes envoyés à un créateur depuis la file de surveillance. Le corps est copié du modèle, pas référencé.';

create index if not exists comptes_nudges_a_lire_idx
  on public.comptes_nudges (poster_id, envoye_at desc)
  where lu_at is null;

create index if not exists comptes_nudges_compte_idx
  on public.comptes_nudges (compte_id, envoye_at desc);

alter table public.comptes_nudges enable row level security;

drop policy if exists comptes_nudges_admin on public.comptes_nudges;
create policy comptes_nudges_admin on public.comptes_nudges
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists comptes_nudges_poster_lit on public.comptes_nudges;
create policy comptes_nudges_poster_lit on public.comptes_nudges
  for select using (poster_id = auth.uid());

-- Le créateur n'a le droit que de marquer son message lu. RLS ne sait pas
-- restreindre une colonne : c'est le GRANT qui le fait.
drop policy if exists comptes_nudges_poster_marque_lu on public.comptes_nudges;
create policy comptes_nudges_poster_marque_lu on public.comptes_nudges
  for update using (poster_id = auth.uid()) with check (poster_id = auth.uid());

grant select on public.comptes_nudges to authenticated;
grant update (lu_at) on public.comptes_nudges to authenticated;

-- ---------------------------------------------------------------------------
-- L'ELO compte s'en va — drop complet
-- ---------------------------------------------------------------------------
-- `stats_comptes` exposait `c.score as elo` : la vue est recréée à l'identique,
-- la colonne `elo` cédant la place à `qualification`.
drop view if exists public.stats_comptes cascade;
-- `security_invoker = off` est repris de 0168 : la vue applique elle-même le
-- filtre admin / poster, changer ce réglage changerait qui voit quoi.
create view public.stats_comptes
with (security_invoker = off) as
select
  c.id as compte_id,
  c.persona_nom,
  c.handle_tiktok,
  c.langue,
  c.is_active,
  c.qualification,
  p.prenom as poster_prenom,
  p.nom as poster_nom,
  count(sp.id) as posts_total,
  count(sp.id) filter (where sp.publie_at is not null) as posts_publies,
  count(sp.id) filter (where sp.publie_at is not null and sp.publie_url is null) as posts_sans_lien,
  count(sp.id) filter (where sp.statut = 'assigne'::post_statut) as posts_en_attente,
  coalesce(
    (select cm.vues from public.compte_metrics cm
      where cm.compte_id = c.id order by cm.collecte_at desc limit 1),
    sum(sp.vues), 0::bigint
  ) as vues_totales,
  coalesce(
    (select cm.likes from public.compte_metrics cm
      where cm.compte_id = c.id order by cm.collecte_at desc limit 1),
    sum(sp.likes), 0::bigint
  ) as likes_totaux,
  coalesce(round(avg(sp.vues) filter (where sp.vues is not null)), 0::numeric) as vues_moyennes
from public.comptes c
  left join public.profiles p on p.id = c.poster_id
  left join public.stats_posts sp on sp.compte_id = c.id
where (public.is_admin() or c.poster_id = auth.uid())
  and c.warmup_ends_at is not null
  and c.warmup_ends_at <= now()
group by c.id, c.persona_nom, c.handle_tiktok, c.langue, c.is_active, c.qualification, p.prenom, p.nom;

grant select on public.stats_comptes to authenticated;

alter table public.comptes
  drop column if exists score,
  drop column if exists score_maj_at;
