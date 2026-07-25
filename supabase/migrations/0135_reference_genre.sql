-- Genre du compte de référence : détermine si les posters qui le reprennent ont
-- une identité (prénom) d'HOMME ou de FEMME. Réglé par un toggle sur la page
-- source. Défaut 'femme' (modifiable) ; l'identité n'est posée qu'à la création
-- d'un poster, donc changer le genre n'affecte que les futurs posters.
alter table public.comptes_reference
  add column if not exists genre text not null default 'femme'
    check (genre in ('homme', 'femme'));
