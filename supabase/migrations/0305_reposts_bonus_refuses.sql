-- Un slideshow refusé ne revient plus par son repost bonus (0305, 05/10/2026).
--
-- Vu en relisant c8b9a2d2 (0304) : refusé dans la file, il est quand même
-- reparti le 04/10 chez camille.travail692, par le repost bonus de son post à
-- 79 800 vues du 27/09. Le repost rejoue le post à J+7 sur le même compte
-- (`reposts_bonus`), et `assignerRepostsBonusDuJour` ne lit que la table des
-- reposts : jamais `contenus.statut`. Décision d'Adrien : « bloque aussi les
-- reposts bonus des refusés ».
--
-- Tout se passe en base, sans changement côté TS donc sans chargeur à
-- redéployer : le moteur ne prend que les reposts `prevu`, il suffit qu'un
-- repost d'un slideshow refusé ne le soit plus.
--
--   - `reposts_bonus_slideshow_refuse` (BEFORE INSERT OR UPDATE sur
--     `reposts_bonus`) : un repost qui naît ou repasse `prevu` sur un
--     slideshow `rejete` devient `abandonne`, raison « Slideshow refusé ».
--     Couvre la planification de fin de drain (`planifierRepostsBonus`).
--   - `contenus_refus_abandonne_reposts` (AFTER UPDATE OF statut sur
--     `contenus`) : un slideshow qui passe `rejete` abandonne ses reposts
--     encore `prevu`. Couvre le refus après planification.
--
-- La course entre la lecture du TS et la création est déjà fermée par 0265 :
-- `creer_publication_atomique` ne solde un repost que s'il est encore
-- `prevu`, sinon elle lève et la transaction entière est annulée. Un repost
-- abandonné entre les deux ne part donc pas.
--
-- Seul `rejete` bloque. Un slideshow remis en file (`brouillon`) garde ses
-- reposts : la décision n'est pas prise. Un slideshow supprimé emporte les
-- siens par la FK en CASCADE.
--
-- La règle vit dans une fonction à part, `repost_bonus_a_abandonner`, que les
-- deux triggers appellent : elle se vérifie en lecture, sans rien écrire.
--
-- Au 05/10 : aucun repost `prevu` sur un slideshow refusé (les deux qui
-- existent sont déjà `fait`). La reprise en fin de fichier ne touche donc
-- rien aujourd'hui ; elle reste pour le jour où on rejoue la migration.
--
-- Aucun bloc `exception` (règle de 0265). `create or replace trigger` (PG 14+)
-- plutôt qu'un `drop` : l'outil MCP bloque sur les `drop` (0287, 0302).

create or replace function public.repost_bonus_a_abandonner(p_contenu_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.contenus c
     where c.id = p_contenu_id
       and c.statut = 'rejete'
  )
$$;

comment on function public.repost_bonus_a_abandonner(uuid) is
  'Vrai si le slideshow est refusé : ses reposts bonus ne doivent plus partir (0305).';

create or replace function public.reposts_bonus_slideshow_refuse()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.statut = 'prevu' and public.repost_bonus_a_abandonner(new.contenu_id) then
    new.statut := 'abandonne';
    new.raison := 'Slideshow refusé';
  end if;
  return new;
end;
$$;

create or replace trigger reposts_bonus_slideshow_refuse
  before insert or update on public.reposts_bonus
  for each row execute function public.reposts_bonus_slideshow_refuse();

create or replace function public.contenus_refus_abandonne_reposts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.statut = 'rejete' and old.statut is distinct from 'rejete' then
    update public.reposts_bonus
       set statut = 'abandonne', raison = 'Slideshow refusé'
     where contenu_id = new.id
       and statut = 'prevu';
  end if;
  return new;
end;
$$;

create or replace trigger contenus_refus_abandonne_reposts
  after update of statut on public.contenus
  for each row execute function public.contenus_refus_abandonne_reposts();

revoke all on function public.repost_bonus_a_abandonner(uuid) from public, anon, authenticated;
grant execute on function public.repost_bonus_a_abandonner(uuid) to service_role;

-- Reprise : les reposts encore prévus sur un slideshow déjà refusé.
update public.reposts_bonus r
   set statut = 'abandonne', raison = 'Slideshow refusé'
 where r.statut = 'prevu'
   and public.repost_bonus_a_abandonner(r.contenu_id);
