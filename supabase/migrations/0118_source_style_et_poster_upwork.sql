-- Deux clarifications de modèle :
--  1) Le « prompt adapté » (voix / ton de traduction) appartient au COMPTE
--     SOURCE, pas au compte de publication du poster : c'est la niche de la
--     source qui dicte le ton. On l'ajoute donc sur comptes_reference.
--  2) Le poster peut mettre à jour SON lien de conversation Upwork depuis son
--     espace (comme son @ TikTok), pour que l'admin ait toujours le bon lien.

alter table public.comptes_reference
  add column if not exists style_profile text;

create or replace function public.maj_mon_upwork(nouveau text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
     set upwork_url = nullif(trim(both from nouveau), '')
   where id = auth.uid();
$$;

grant execute on function public.maj_mon_upwork(text) to authenticated;
