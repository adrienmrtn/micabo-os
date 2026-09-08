-- Guides : plus de Sophia / culture générale.
-- Recrutement : plus de tables, RPCs, docs ni réglages Upwork dans l'OS.

update public.documents
set
  contenu = replace(replace(replace(replace(replace(replace(
    contenu,
    'SOPHIA CRÉATEURS', 'Micabo créateurs'),
    'SOPHIA CREATORS', 'Micabo créateurs'),
    'équipe Sophia', 'équipe Micabo'),
    'vers Sophia', 'vers micabo'),
    '@sophia.com', '@micabo.app'),
    'comptes de culture générale similaires', 'comptes d''études et de révisions similaires'),
  contenu_en = replace(replace(replace(replace(replace(
    contenu_en,
    'SOPHIA CREATORS', 'Micabo creators'),
    'Sophia team', 'Micabo team'),
    'to Sophia', 'to micabo'),
    '@sophia.com', '@micabo.app'),
    'similar general knowledge accounts', 'similar study and revision accounts')
where cle = 'guide_poster';

update public.documents
set
  contenu = replace(replace(
    contenu,
    'système Sophia', 'OS micabo'),
    'dans sa langue et dans la niche culture générale',
    'dans sa langue et dans la niche études, examens et révisions'),
  contenu_en = replace(replace(
    contenu_en,
    'Sophia system', 'micabo OS'),
    'in the general knowledge niche',
    'in the study, exams and revision niche')
where cle = 'guide_manager';

update public.documents
set
  contenu = replace(contenu, 'Sophia System', 'OS micabo'),
  contenu_en = replace(contenu_en, 'Sophia System', 'micabo OS')
where cle = 'faq_manager';

delete from public.documents where cle = 'reponses_upwork';
delete from public.reglages where cle = 'upwork_acces';

drop table if exists
  public.upwork_actions,
  public.upwork_admin_flags,
  public.upwork_alertes,
  public.upwork_approches,
  public.upwork_campagnes,
  public.upwork_candidats,
  public.upwork_contrats,
  public.upwork_missions,
  public.upwork_modeles,
  public.upwork_sync
cascade;

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname ilike '%upwork%'
      and p.proname <> 'maj_mon_upwork'
  loop
    execute 'drop function if exists ' || r.sig || ' cascade';
  end loop;
end $$;
