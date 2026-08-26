-- Un label ne peut être posé que sur un compte de la même application
-- (un posteur micabo ne reçoit jamais un label Sophia, et inversement).
-- File FIFO micabo : study_aes, sans écraser une file déjà saisie.

create or replace function public.compte_label_meme_application()
returns trigger
language plpgsql
as $$
declare
  compte_app uuid;
  label_app uuid;
begin
  select application_id into compte_app from public.comptes where id = new.compte_id;
  select application_id into label_app from public.labels where id = new.label_id;
  if compte_app is distinct from label_app then
    raise exception 'LABEL_MAUVAISE_APPLICATION';
  end if;
  return new;
end;
$$;

drop trigger if exists compte_labels_meme_application on public.compte_labels;
create trigger compte_labels_meme_application
  before insert or update on public.compte_labels
  for each row
  execute function public.compte_label_meme_application();

do $$
declare
  lab uuid;
  item jsonb;
begin
  select l.id into lab
  from public.labels l
  join public.applications a on a.id = l.application_id
  where a.slug = 'micabo' and l.slug = 'study-aes'
  limit 1;
  if lab is null then
    return;
  end if;
  item := jsonb_build_object('label_id', lab, 'ugc', false);
  update public.reglages
  set
    valeur = valeur || jsonb_build_object(
      'par_application',
      coalesce(valeur->'par_application', '{}'::jsonb) || jsonb_build_object(
        'micabo',
        jsonb_build_object(
          'items', jsonb_build_array(item),
          'par_langue', jsonb_build_object(
            'fr', jsonb_build_array(item),
            'en', jsonb_build_array(item)
          )
        )
      )
    ),
    updated_at = now()
  where cle = 'file_labels_comptes'
    and coalesce(valeur#>'{par_application,micabo}', 'null'::jsonb) = 'null'::jsonb;
end
$$;
