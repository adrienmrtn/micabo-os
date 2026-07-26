-- Un recruteur (hiring_manager) peut gérer PLUSIEURS langues : on s'appuie sur
-- profiles.langues (text[]) déjà existant. Backfill : les recruteurs qui avaient
-- une seule `nationalite` gardent cette langue comme ensemble de départ.
update public.profiles p
  set langues = array[p.nationalite]
  where p.nationalite is not null
    and exists (
      select 1 from public.user_roles ur
      where ur.user_id = p.id and ur.role = 'hiring_manager'
    )
    and (p.langues is null or p.langues = '{fr}' or array_length(p.langues, 1) <= 1);
