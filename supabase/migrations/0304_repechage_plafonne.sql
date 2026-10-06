-- Le repêchage jetait les verdicts et recyclait les D sans fin (0304, 05/10/2026).
--
-- Constat d'Adrien : « les contenus recyclés en boucle font des vues de merde,
-- et pourtant je les vois encore ». Le cas qui l'a fait rire, c8b9a2d2 : passé
-- en D le 23/09, puis repêché 10 fois en quatre jours (dont 8 pendant les rafales
-- buguées des 27 et 28/09, fermées par 0275/0276). Il a fait 79 800 vues chez
-- camille.travail692 le 27/09… et il est resté en D.
--
-- **Pourquoi il est resté en D : le repêchage rouvrait le cycle AVANT le
-- verdict.** Un cycle de repêchage porte un passage (`passages_cible = 1`).
-- Dès que ce passage est inséré, le cycle est plein ; 0276 n'interdisait que
-- deux repêchages le même jour. Le lendemain, `repecher_contenu` rouvrait donc
-- un cycle et remettait `tier_maj_at` à `now()`, alors que le passage de la
-- veille n'avait pas encore été mesuré (la mesure tombe à J+2). Le verdict ne
-- lit que les passages depuis `tier_maj_at` : le passage de la veille sortait
-- du cycle sans avoir été jugé. Un D ne pouvait remonter que si le DERNIER
-- passage avant une pause de deux jours faisait 1 000 vues.
--
-- Mesuré au 05/10 sur les D encore valides : cc30ddf8 a fait 5 688 puis 1 319,
-- 8c3c08db 3 603 puis 1 005 — les quatre au-dessus du seuil de sortie de D, et
-- aucun n'a été jugé. Ils sont restés en D et ont été repêchés 8 et 13 fois.
--
-- 0276 l'écrivait pourtant en tête : « un slideshow doit être JUGÉ avant de
-- revenir ». Il ne l'appliquait qu'au jour près.
--
-- Deux gardes de plus :
--
--   2. (élargie) **un cycle est déjà ouvert** (`passages_cible > 0`) → false.
--      Soit un worker concurrent va le consommer (0275), soit son passage
--      attend son verdict (0304). Un D redevient repêchable quand la
--      requalification l'a jugé : elle remet sa cible à 0 (D = 0 passage).
--
--   3. (nouvelle) **trois repêchages sans remonter** → false. On compte les
--      passages (hors reposts bonus et posts test) créés depuis la dernière
--      ENTRÉE en D (ligne de `contenu_tier_historique` qui va de autre chose
--      vers D). Un D n'a pas de passage dû : tout passage depuis son entrée est
--      un repêchage. S'il remonte, il quitte D ; s'il y retombe plus tard, le
--      compteur repart de cette nouvelle entrée. Décision d'Adrien du 05/10.
--
-- Effet immédiat sur le stock : 8c3c08db (13 repêchages), cc30ddf8 (8),
-- 07630f3b et e0159ade (3) ne sont plus repêchables. Leurs bons passages
-- jetés par le défaut ne sont pas rejugés : leurs médianes restent sous 1 000
-- (8c3c08db ~600, cc30ddf8 ~700), c'est exactement le recyclage visé.
--
-- Rien ne change côté TS : `choisirContenu` parcourt déjà les repêchables
-- jusqu'à ce que la fonction rende true. Pas de chargeur à redéployer.
--
-- Aucun bloc `exception` (règle de 0265). Même ordre de verrou qu'avant.

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
  v_tier text;
  v_cible integer;
  v_entree timestamptz;
  v_repeches integer;
begin
  -- Même ordre de verrou que `creer_publication_atomique` : `contenus` seul
  -- ici, et toujours après `comptes` là-bas. Pas de nouveau deadlock.
  perform 1 from public.contenus where id = p_contenu_id for update;

  select ct.tier, ct.passages_cible
    into v_tier, v_cible
    from public.contenus ct
   where ct.id = p_contenu_id;

  if not found then
    return false;
  end if;

  -- GARDE 1 (0276) — au plus un repêchage par slideshow et par jour.
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

  -- GARDE 2 (0275, élargie en 0304) — un cycle est déjà ouvert. S'il n'est
  -- pas consommé, il appartient à un worker concurrent ; s'il l'est, son
  -- passage attend son verdict. Le rouvrir jetait ce verdict.
  if coalesce(v_cible, 0) > 0 then
    return false;
  end if;

  -- GARDE 3 (0304) — trois repêchages depuis l'entrée en D, sans remonter.
  if v_tier = 'D' then
    select max(h.fait_le)
      into v_entree
      from public.contenu_tier_historique h
     where h.contenu_id = p_contenu_id
       and h.tier_apres = 'D'
       and h.tier_avant is distinct from 'D';

    if v_entree is not null then
      select count(*)
        into v_repeches
        from public.passages p
        left join public.posts po on po.id = p.post_id
       where p.contenu_id = p_contenu_id
         and p.bonus_repost = false
         and coalesce(po.est_test, false) = false
         and p.created_at > v_entree;

      if v_repeches >= 3 then
        return false;
      end if;
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
  'Ouvre un cycle d''un passage sur un slideshow repêché, sous verrou. Refuse (false) : jour déjà servi (0276), cycle déjà ouvert ou en attente de verdict (0275/0304), D déjà repêché 3 fois depuis son entrée en D (0304).';

revoke all on function public.repecher_contenu(uuid, text, date) from public, anon, authenticated;
grant execute on function public.repecher_contenu(uuid, text, date) to service_role;

notify pgrst, 'reload schema';
