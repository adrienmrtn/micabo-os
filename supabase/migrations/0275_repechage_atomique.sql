-- Le repêchage rouvrait le cycle qu'il venait d'ouvrir (0275, 27/09/2026).
--
-- 0274 a fermé la perte de mise à jour du tirage ordinaire : la transaction
-- recompte le cycle et lève `P0002 / cycle_complet` si la cible est atteinte.
-- Le comptage part de `contenus.tier_maj_at`.
--
-- Le REPÊCHAGE, lui, **déplace `tier_maj_at`**. `choisirContenu` finissait par
-- un `update contenus set passages_cible = 1, tier_maj_at = now()` nu — hors
-- transaction, sans verrou, sans condition. Six workers qui repêchent le même
-- slideshow en D écrivent donc six fois `tier_maj_at = now()`, et chacun voit
-- ensuite « 0 fait sur 1 » : le garde-fou de 0274 ne peut pas se déclencher.
-- Ce n'est pas une course perdue, c'est une porte que 0274 ne couvrait pas —
-- il ferme la lecture concurrente, pas la remise à zéro du compteur.
--
-- Mesuré sur la rafale du 27/09 : quatre slideshows en D ont pris **7, 5, 5 et
-- 3 passages** pour une `passages_cible` de 1, soit 20 des 59 passages du jour.
-- Sur `c8b9a2d2` : six passages en 31 secondes (22:01:17 → 22:01:48) et huit
-- écritures de tier pendant la rafale. Conséquence visible : **sept créateurs
-- ont publié le même slideshow le même jour**, et la variété est retombée de
-- 55 slideshows distincts (26/09) à 37, avec le top 5 de 15,3 % à 37,3 %.
--
-- Le dépôt avait écarté cette piste le 24/09 — « le repêchage en D : 0
-- occurrence ». C'était vrai ce jour-là : le pool était assez fourni pour ne
-- jamais tomber dans le repêchage. Il est devenu assez maigre pour y tomber
-- chaque nuit. Une piste écartée sur données se rouvre quand les données
-- changent.
--
-- **Le correctif est dans la transaction**, comme 0265 et 0274 : le verrou
-- `for update` sur `contenus` (même ordre d'acquisition, donc pas de 40P01),
-- puis l'ouverture du cycle SEULEMENT s'il n'y en a pas déjà un d'ouvert.
--
-- `repecher_contenu` rend **true seulement si elle a réellement ouvert le
-- cycle**. Le second worker voit le cycle ouvert par le premier, rend false, et
-- l'appelant repioche. Rendre true dans ce cas ferait reprendre le slot que le
-- premier n'a pas encore consommé — c'est très exactement le doublon qu'on
-- ferme.
--
-- Un cycle « ouvert et inutilisé » ne peut appartenir qu'à un worker
-- concurrent : s'il était réellement disponible, il serait passé par
-- `restantsParContenu` et le tirage ordinaire l'aurait pris avant d'arriver
-- ici. Décliner est donc sans perte.
--
-- Le comptage reproduit `restantsParContenu` à l'identique — hors reposts
-- bonus, hors posts test, depuis `tier_maj_at` — comme 0274. Deux compteurs
-- qui divergent finissent par se contredire.
--
-- Aucun bloc `exception` : règle de 0265. La fonction ne lève pas non plus,
-- elle rend un booléen — un repêchage décliné est un cas NORMAL du tirage, pas
-- une panne, et l'appelant doit simplement essayer le suivant.

create or replace function public.repecher_contenu(
  p_contenu_id uuid,
  p_tier text default 'D'
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

  if v_cible > 0 and v_depuis is not null then
    select count(*)
      into v_faits
      from public.passages p
      left join public.posts po on po.id = p.post_id
     where p.contenu_id = p_contenu_id
       and p.bonus_repost = false
       and coalesce(po.est_test, false) = false
       and p.created_at >= v_depuis;

    -- Cycle déjà ouvert et pas encore rempli : il appartient à un autre
    -- worker. On ne le rouvre pas et on ne le prend pas.
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

comment on function public.repecher_contenu(uuid, text) is
  'Ouvre un cycle d''un passage sur un slideshow repêché, sous verrou. Rend true seulement si elle a réellement ouvert le cycle ; false si un autre worker l''a déjà ouvert (l''appelant repioche). Voir 0275.';

revoke all on function public.repecher_contenu(uuid, text) from public, anon, authenticated;
grant execute on function public.repecher_contenu(uuid, text) to service_role;

-- PostgREST résout les fonctions par NOM de paramètre et garde un cache : sans
-- ce reload, le premier appel rend un PGRST202 « function not found » qui
-- ressemble à une faute de frappe (leçon de 0265).
notify pgrst, 'reload schema';
