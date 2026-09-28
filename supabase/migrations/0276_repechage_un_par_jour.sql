-- Le repêchage rouvrait son propre cycle en chaîne (0276, 28/09/2026).
--
-- 0275 a mis l'ouverture du cycle sous verrou et refuse de rouvrir un cycle
-- « ouvert et non consommé ». **Ça n'a pas suffi, et l'erreur est dans la
-- condition, pas dans le verrou.**
--
-- Dès que le premier worker a inséré SON passage, le cycle est PLEIN
-- (`faits >= cible`), et 0275 autorise alors la réouverture. Chaque worker
-- rouvre donc à son tour, en chaîne, et le compteur repart de zéro à chaque
-- fois. 0275 a fermé la fenêtre de course et laissé la porte principale
-- ouverte.
--
-- Mesuré sur la rafale du 28/09, AVEC 0275 déployé : cinq slideshows en D ont
-- pris **34 des 52 passages du jour** (8, 7, 7, 6, 6), avec 8 réécritures de
-- tier chacun. La variété est tombée à **22 slideshows distincts** et le top 5
-- à **65,4 %** — pire que les 39 / 34,5 % de la veille, et loin des 50 / 15,1 %
-- du 26/09.
--
-- **La bonne règle est celle que le dépôt applique partout ailleurs : un
-- slideshow doit être JUGÉ avant de revenir.** Un cycle plein dont le passage
-- n'est pas encore mesuré n'est pas un cycle à rouvrir, c'est un cycle en
-- attente de verdict. Traduit au plus étroit et au plus vérifiable : **au plus
-- un passage de repêchage par slideshow et par jour**.
--
-- Les deux gardes sont nécessaires et ne se remplacent pas :
--
--   1. `déjà un passage aujourd'hui` → plafonne à 1 par jour. C'est la porte
--      principale, celle que 0275 avait laissée ouverte.
--   2. `cycle ouvert et non consommé` (0275) → couvre la fenêtre entre la
--      réouverture d'un worker et son insertion, pendant laquelle la garde 1
--      ne voit encore aucun passage.
--
-- Déroulé avec les deux : A rouvre (cible 1, faits 0) et insère. B, concurrent,
-- ne voit pas encore de passage du jour mais voit `faits < cible` → garde 2 →
-- false. C, après le commit de A, voit le passage du jour → garde 1 → false.
-- Le slideshow sort une fois, pas huit.
--
-- **Conséquence assumée** : avec un pool maigre, le repêchage ne peut plus
-- fournir qu'un passage par slideshow repêchable et par nuit. Des créateurs
-- finiront sous quota au lieu de publier tous le même slideshow. C'est
-- l'arbitrage du 19/09, écrit noir sur blanc dans le dépôt : « un post de moins
-- vaut mieux qu'un doublon ». Huit créateurs sur le même slideshow le même jour
-- est un doublon vu de l'audience.
--
-- `p_jour` est le jour de publication prévu, pas `now()` : c'est la clé que
-- porte `passages.date_publication_prevue` et celle que lit l'index
-- anti-doublon. Compter sur `created_at` ferait dériver le plafond dès qu'une
-- rafale traverse minuit UTC.
--
-- Le comptage exclut les reposts bonus et les posts test, comme 0274 et 0275 :
-- trois compteurs qui divergent finiraient par se contredire.
--
-- Aucun bloc `exception` : règle de 0265. La fonction rend un booléen, un
-- repêchage décliné est un cas normal du tirage.

create or replace function public.repecher_contenu(
  p_contenu_id uuid,
  p_tier text default 'D',
  p_jour date default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cible integer;
  v_depuis timestamptz;
  v_faits integer;
begin
  -- Même ordre de verrou que `creer_publication_atomique` : `contenus` seul
  -- ici, et toujours après `comptes` là-bas. Pas de nouveau deadlock.
  perform 1 from public.contenus where id = p_contenu_id for update;

  select ct.passages_cible, ct.tier_maj_at
    into v_cible, v_depuis
    from public.contenus ct
   where ct.id = p_contenu_id;

  if not found then
    return false;
  end if;

  -- GARDE 1 (0276) — au plus un repêchage par slideshow et par jour.
  -- C'est elle qui ferme le défaut : sans elle, un cycle plein est rouvrable,
  -- donc rouvert par chaque worker à son tour.
  if p_jour is not null and exists (
    select 1
      from public.passages p
      left join public.posts po on po.id = p.post_id
     where p.contenu_id = p_contenu_id
       and p.date_publication_prevue = p_jour
       and p.bonus_repost = false
       and coalesce(po.est_test, false) = false
  ) then
    return false;
  end if;

  -- GARDE 2 (0275) — cycle ouvert et pas encore consommé : il appartient à un
  -- worker concurrent qui n'a pas encore inséré. On ne le rouvre pas et on ne
  -- le prend pas.
  if v_cible > 0 and v_depuis is not null then
    select count(*)
      into v_faits
      from public.passages p
      left join public.posts po on po.id = p.post_id
     where p.contenu_id = p_contenu_id
       and p.bonus_repost = false
       and coalesce(po.est_test, false) = false
       and p.created_at >= v_depuis;

    if v_faits < v_cible then
      return false;
    end if;
  end if;

  update public.contenus
     set tier = case
                  when p_tier in ('D','C','B','A','S','S+') then p_tier
                  else 'D'
                end,
         passages_cible = 1,
         tier_maj_at = now()
   where id = p_contenu_id;

  return true;
end;
$$;

comment on function public.repecher_contenu(uuid, text, date) is
  'Ouvre un cycle d''un passage sur un slideshow repêché, sous verrou. Au plus un repêchage par slideshow et par jour (0276) ; rend false si le jour est déjà servi ou si un autre worker vient d''ouvrir ce cycle (l''appelant repioche).';

-- L'ancienne signature à deux arguments est supprimée pour ne pas laisser deux
-- surcharges que PostgREST résoudrait par nom de paramètre sans rien signaler.
--
-- **Ça ne casse pas un chargeur non encore redéployé** : `p_jour` porte une
-- valeur par défaut, donc un appel à deux arguments tombe sur la nouvelle
-- fonction avec `p_jour = null`, ce qui saute la garde 1 et redonne exactement
-- le comportement de 0275. La migration peut donc précéder le redéploiement
-- sans fenêtre d'échec — même raisonnement qu'en 0274, mais ici c'est le
-- paramètre par défaut qui l'assure, pas un `catch` générique.
drop function if exists public.repecher_contenu(uuid, text);

revoke all on function public.repecher_contenu(uuid, text, date) from public, anon, authenticated;
grant execute on function public.repecher_contenu(uuid, text, date) to service_role;

-- PostgREST résout les fonctions par NOM de paramètre et garde un cache : sans
-- ce reload, le premier appel rend un PGRST202 « function not found » qui
-- ressemble à une faute de frappe (leçon de 0265).
notify pgrst, 'reload schema';
