-- Bio du compte de référence (capturée une fois via Apify) : sert d'inspiration
-- pour générer la bio du poster « dans la même veine ».
alter table public.comptes_reference
  add column if not exists bio text;
