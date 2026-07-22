-- Le poster peut mettre à jour SON pseudo TikTok (le @ de son compte de
-- publication) une fois son compte créé sur TikTok — pour que le lien direct
-- côté admin pointe sur le bon compte. Fonction security definer restreinte à sa
-- propre ligne, pour ne pas ouvrir l'écriture de toute la table aux posters.
create or replace function public.maj_mon_handle(nouveau text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.comptes
     set handle_tiktok = nullif(trim(both from replace(nouveau, '@', '')), '')
   where poster_id = auth.uid();
$$;

grant execute on function public.maj_mon_handle(text) to authenticated;
