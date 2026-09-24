-- Un label retiré ne revient jamais sur un compte (cold_study, 24/09/2026).
--
-- Le 18/09, les huit comptes `cold_study` sont passés en `classic_study` : la
-- niche faisait 11 fois moins de vues que l'autre à volume égal (241 972 vues
-- contre 2 783 167 sur 126 passages mesurés chacune). Six jours plus tard, le
-- label était **de retour sur sept comptes**, tous créés entre-temps.
--
-- Retirer les lignes ne suffit donc pas : il faut fermer la porte. Un label
-- porte maintenant une date de retrait, et un trigger garantit qu'un label
-- retiré n'atterrit sur aucun compte, par aucun chemin (file de labels à la
-- création, éditeur de labels de la fiche créateur, script, reprise manuelle).
--
-- **Le trigger ignore la ligne, il ne lève pas.** C'est délibéré et c'est la
-- seule décision non évidente ici : la création d'un compte pose son label
-- depuis `manage-users`, une Edge Function épinglée sur un chargeur. Une
-- exception y ferait échouer la création entière pour un label mal choisi,
-- et corriger l'appelant demanderait un redéploiement. Ignorer la ligne
-- dégrade proprement : le compte naît, simplement sans ce label, et
-- l'assignation le dira (« aucun label sur ce compte »).
--
-- Ce qui n'est PAS touché : `contenu_labels` et `media_labels`. Les 58
-- slideshows et 287 médias `cold_study` gardent leur label, c'est
-- l'historique et il sert encore à les retrouver. Ils ne seront simplement
-- plus distribués, puisque l'assignation croise les labels du compte avec
-- ceux du contenu et qu'aucun compte ne porte plus celui-là.
--
-- Aucun cron n'est planifié ici. Conforme à AGENTS.md.

-- ---------------------------------------------------------------------------
-- La date de retrait
-- ---------------------------------------------------------------------------
alter table public.labels
  add column if not exists retire_le timestamptz;

comment on column public.labels.retire_le is
  'Label sorti de la circulation : plus jamais posé sur un compte, plus proposé dans l''éditeur. Les contenus et médias qui le portent le gardent.';

-- ---------------------------------------------------------------------------
-- Le garde-fou
-- ---------------------------------------------------------------------------
create or replace function public.label_retire_jamais_sur_compte()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.labels l
    where l.id = new.label_id and l.retire_le is not null
  ) then
    -- Ligne ignorée, pas refusée : voir l'en-tête de la migration.
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists compte_labels_pas_retire on public.compte_labels;
create trigger compte_labels_pas_retire
  before insert or update on public.compte_labels
  for each row
  execute function public.label_retire_jamais_sur_compte();

-- ---------------------------------------------------------------------------
-- La file de labels des nouveaux comptes : purger ce qui est retiré
--
-- `reglages.file_labels_comptes` distribue un label à chaque compte créé.
-- Un id retiré qui y dormirait serait tiré puis silencieusement ignoré par le
-- trigger : le compte naîtrait sans label. On le sort de la file.
-- ---------------------------------------------------------------------------
create or replace function public.purger_file_labels_retires()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  val jsonb;
  items jsonb;
  par_langue jsonb;
  k text;
  retires uuid[];
  avant integer;
  apres integer;
begin
  select array_agg(id) into retires from public.labels where retire_le is not null;
  if retires is null or array_length(retires, 1) is null then
    return 0;
  end if;

  select r.valeur into val from public.reglages r where r.cle = 'file_labels_comptes';
  if val is null then
    return 0;
  end if;

  items := coalesce(val -> 'items', '[]'::jsonb);
  avant := jsonb_array_length(items);
  select coalesce(jsonb_agg(x), '[]'::jsonb) into items
  from jsonb_array_elements_text(items) x
  where not (x::uuid = any (retires));
  apres := jsonb_array_length(items);

  par_langue := coalesce(val -> 'par_langue', '{}'::jsonb);
  for k in select jsonb_object_keys(par_langue) loop
    avant := avant + jsonb_array_length(par_langue -> k);
    par_langue := jsonb_set(
      par_langue,
      array[k],
      (
        select coalesce(jsonb_agg(x), '[]'::jsonb)
        from jsonb_array_elements_text(par_langue -> k) x
        where not (x::uuid = any (retires))
      )
    );
    apres := apres + jsonb_array_length(par_langue -> k);
  end loop;

  update public.reglages r
  set valeur = jsonb_build_object('items', items, 'par_langue', par_langue),
      updated_at = now()
  where r.cle = 'file_labels_comptes';

  return avant - apres;
end;
$$;

comment on function public.purger_file_labels_retires() is
  'Sort de la file des nouveaux comptes les labels retirés. À rejouer après chaque retrait.';

-- ---------------------------------------------------------------------------
-- cold_study sort de la circulation
-- ---------------------------------------------------------------------------
update public.labels
set retire_le = now()
where slug = 'cold-study' and retire_le is null;

select public.purger_file_labels_retires();
