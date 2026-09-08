-- Un job créateurs = un HM. Le sweep ne doit pas coller le job du pays
-- à tous les hired. Si plusieurs approches HM pointent le même
-- job_createur_id, on garde le HM le plus avancé (créateurs OS, puis
-- contrat le plus ancien) et on retire le lien aux autres.

create or replace function public.upwork_approches_un_job_par_hm()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.upwork_approches a
  set job_createur_id = null
  from (
    select
      x.id,
      row_number() over (
        partition by x.job_createur_id
        order by
          coalesce(uc.createurs_n, 0) desc,
          uc.contrat_at asc nulls last,
          (x.os_ok::int + x.slack_ok::int) desc,
          x.nom
      ) as rang
    from public.upwork_approches x
    left join public.upwork_contrats uc on uc.contract_id = x.contract_id
    where x.role = 'hm'
      and x.job_createur_id is not null
  ) classe
  where a.id = classe.id
    and classe.rang > 1;
end;
$$;

revoke all on function public.upwork_approches_un_job_par_hm() from public, anon, authenticated;
grant execute on function public.upwork_approches_un_job_par_hm() to service_role;

create or replace function public.upwork_approches_un_job_par_hm_trig()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.upwork_approches_un_job_par_hm();
  return null;
end;
$$;

drop trigger if exists upwork_approches_un_job_par_hm on public.upwork_approches;
create trigger upwork_approches_un_job_par_hm
  after insert on public.upwork_approches
  for each statement
  execute function public.upwork_approches_un_job_par_hm_trig();

select public.upwork_approches_un_job_par_hm();
