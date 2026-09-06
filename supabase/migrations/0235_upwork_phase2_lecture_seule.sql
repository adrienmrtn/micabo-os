-- Phase 2 = le HM. On ne lui écrit plus « je poste ton job »,
-- et on n'a plus de playbook créateur (contrat, accès, messages).

delete from public.upwork_modeles
where role_cible = 'createur';

delete from public.upwork_modeles
where role_cible = 'hm'
  and cle in ('integration', 'job_createur_poste', 'tiktok_cree');
