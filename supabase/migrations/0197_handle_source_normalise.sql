-- Handles de comptes source stockés en URL de profil.
--
-- Le formulaire acceptait « https://www.tiktok.com/@compte » tel quel. Le
-- listing construit ensuite l'URL de la page publique par concaténation
-- (`tiktok.com/@` + handle) : elle partait donc sur une adresse absurde,
-- renvoyait 404, et seule la première tranche Apify remontait. Résultat, des
-- comptes plafonnés à quelques dizaines de slideshows sans message d'erreur.

update public.comptes_reference
set handle_tiktok = substring(handle_tiktok from 'tiktok\.com/@([^/?#]+)')
where handle_tiktok ~* 'tiktok\.com/@'
  and substring(handle_tiktok from 'tiktok\.com/@([^/?#]+)') is not null;

update public.comptes_reference
set handle_tiktok = ltrim(btrim(handle_tiktok), '@')
where btrim(handle_tiktok) <> ltrim(btrim(handle_tiktok), '@');

-- Un handle qui contient encore « / » ou « @ » ne peut pas être scrapé : mieux
-- vaut le voir échouer à l'écriture que silencieusement au listing.
alter table public.comptes_reference
  drop constraint if exists comptes_reference_handle_sans_url;
alter table public.comptes_reference
  add constraint comptes_reference_handle_sans_url
  check (handle_tiktok !~ '[@/[:space:]]')
  not valid;
