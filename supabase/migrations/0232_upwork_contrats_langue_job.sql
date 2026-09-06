-- Un contrat sans langue (créateurs surtout) ne doit pas inventer un pays « xx ».
-- On recopie la langue du job, et on ignore les codes vides au prochain sync.

create or replace function public.upwork_contrats_langue_depuis_job()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.langue is null or btrim(new.langue) = '' then
    select m.langue into new.langue
    from public.upwork_missions m
    where m.job_posting_id = new.job_posting_id;
  end if;
  return new;
end;
$$;

drop trigger if exists upwork_contrats_langue_depuis_job on public.upwork_contrats;
create trigger upwork_contrats_langue_depuis_job
  before insert or update on public.upwork_contrats
  for each row
  execute function public.upwork_contrats_langue_depuis_job();

update public.upwork_contrats uc
set langue = m.langue
from public.upwork_missions m
where uc.job_posting_id = m.job_posting_id
  and m.langue is not null
  and (uc.langue is null or btrim(uc.langue) = '');
