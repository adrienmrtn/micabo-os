-- Discussions Upwork : français pour la France, anglais partout ailleurs.
-- Les playbooks `*` deviennent l'anglais. Le français passe sur `fr`.
-- Invitations et job posts suivent la même règle.

insert into public.upwork_modeles (cle, role_cible, langue, corps, maj_at)
select cle, role_cible, 'fr', corps, now()
from public.upwork_modeles
where langue = '*'
on conflict (cle, role_cible, langue) do nothing;

update public.upwork_modeles set corps =
  'The role: recruit and run a small team of TikTok creators in {{pays}}, independently. About 10 creators over time.

To move forward:
1. Have you already hired and managed content creators?
2. How many hours a week can you put in?
3. When would you start?',
  maj_at = now()
where cle = 'pourparlers' and role_cible = 'hm' and langue = '*';

update public.upwork_modeles set corps =
  'I''m sending the Upwork contract next. Once you accept it, I''ll open Slack and the micabo OS for you.',
  maj_at = now()
where cle = 'contrat_envoye' and role_cible = 'hm' and langue = '*';

update public.upwork_modeles set corps =
  'To get started:
1. Slack — the invite goes to the email you gave me.
2. The micabo OS — login codes arrive by email, sign in once to activate the account.
3. Reply here when both are done, I''ll add you to my Upwork account.

The full guide is in the OS, Documents tab.',
  maj_at = now()
where cle = 'acces_envoyes' and role_cible = 'hm' and langue = '*';

update public.upwork_modeles set corps =
  'Next step: I post your creator job for {{pays}} so you can start recruiting. Goal: about ten active creators, in stages.',
  maj_at = now()
where cle = 'integration' and role_cible = 'hm' and langue = '*';

update public.upwork_modeles set corps =
  'Your creator job is live for {{pays}}. You can start reviewing people.

We want profiles who can post TikTok slideshows regularly, in the country''s language. Consistency matters more than experience.

Tell me if you want to look at the first profiles together.',
  maj_at = now()
where cle = 'job_createur_poste' and role_cible = 'hm' and langue = '*';

update public.upwork_modeles set corps =
  'We''re looking for TikTok creators for micabo in {{pays}} — an AI education app for students.

The format: short slideshows, posted regularly, in the country''s language. All the content is provided, you don''t write it.

Two questions:
1. Do you already post on TikTok? If so, what''s the account?
2. Can you keep a daily posting rhythm?',
  maj_at = now()
where cle = 'pourparlers' and role_cible = 'createur' and langue = '*';

update public.upwork_modeles set corps =
  'To get started:
1. Slack — the invite goes to your email.
2. The micabo OS — login codes arrive by email, sign in once.

Then we create your TikTok account and start the warmup.',
  maj_at = now()
where cle = 'acces_envoyes' and role_cible = 'createur' and langue = '*';

update public.upwork_modeles set corps =
  'Create the TikTok account and add the handle in the OS (My account).

Once it''s there, we start the warmup: 24 hours without posting, so the account can settle. After that you get your first posts.',
  maj_at = now()
where cle = 'tiktok_cree' and role_cible = 'createur' and langue = '*';

create or replace function public.upwork_campagnes_planifier()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  pays text;
  nouvelle_id uuid;
  texte text;
  type_action text;
  embauches integer;
  langue_msg text;
begin
  for c in
    select * from public.upwork_campagnes
    where statut in ('active', 'en_pause')
    order by lance_at
  loop
    pays := coalesce(c.pays_nom, upper(c.langue));
    langue_msg := case when c.langue = 'fr' then 'français' else 'anglais' end;

    if c.job_posting_id is null then
      embauches := 0;
    else
      select count(*) into embauches
      from public.upwork_approches a
      where a.role = 'hm'
        and a.statut = 'hired'
        and a.job_posting_id = c.job_posting_id;
    end if;

    if embauches >= c.objectif_hm then
      update public.upwork_campagnes
      set statut = 'terminee', fin_at = now(),
          detail = format('%s HM embauché(s) sur ce job', embauches)
      where id = c.id;
      update public.upwork_actions
      set statut = 'annule', fait_at = now()
      where campagne_id = c.id and statut = 'en_attente';
      continue;
    end if;

    if exists (
      select 1 from public.upwork_actions
      where campagne_id = c.id and statut = 'en_attente'
    ) then
      continue;
    end if;

    if c.job_posting_id is null then
      type_action := 'publier_job_hm';
    elsif not exists (
      select 1 from public.upwork_missions
      where job_posting_id = c.job_posting_id and statut = 'PUBLISHED'
    ) then
      update public.upwork_campagnes
      set statut = 'en_pause', detail = 'job non PUBLISHED'
      where id = c.id;
      continue;
    elsif exists (
      select 1 from public.upwork_candidats
      where campagne_id = c.id
        and (statut = 'valide' or (statut = 'propose' and now() >= echeance_at))
    ) then
      type_action := 'inviter_hm';
    elsif exists (
      select 1 from public.upwork_candidats
      where campagne_id = c.id and statut = 'propose'
    ) then
      continue;
    else
      type_action := 'sourcer_hm';
    end if;

    if c.statut = 'en_pause' then
      update public.upwork_campagnes set statut = 'active', detail = null where id = c.id;
    end if;

    if type_action = 'publier_job_hm' then
      texte :=
        'Publie un NOUVEAU job post Hiring Manager pour ' || pays || '.' || chr(10)
        || 'Même s''il existe déjà un job HM PUBLISHED sur ce pays, publie un'
        || ' post neuf. Ne réutilise pas un job existant : les HM déjà'
        || ' recrutés restent, cette vague en ajoute un.' || chr(10)
        || '1. list_accounts → org Micabo ' || public.upwork_org_uid_micabo()
        || ' uniquement. Si ce n''est pas cette org, stop.' || chr(10)
        || '2. get_job_posting action=list puis action=get sur le job HM le plus'
        || ' récent : reprends sa structure (titre, description, skills, budget)'
        || ' et adapte-la à ' || pays || '.' || chr(10)
        || '   Rédige le job en ' || langue_msg
        || ' — pas dans une autre langue.' || chr(10)
        || '   Le texte parle de micabo (minuscules), éducation IA pour étudiants.'
        || ' Jamais le nom d''un autre produit.' || chr(10)
        || '3. post_job action=create, org_uid=' || public.upwork_org_uid_micabo()
        || '. Le create rend un preview : confirm_preview pour publier.'
        || ' L''admin a déjà validé en lançant cette campagne dans l''OS.' || chr(10)
        || '4. select public.upwork_campagne_job_publie('
        || quote_literal(c.id::text) || ', ''<job_posting_id>'');' || chr(10)
        || '5. select public.upwork_action_terminer(''<id>'', ''<résumé>'');';

    elsif type_action = 'sourcer_hm' then
      texte :=
        'Sélectionne des Hiring Managers pour ' || pays
        || ' — recommandations seulement, aucune invitation.' || chr(10)
        || '1. list_accounts → org Micabo ' || public.upwork_org_uid_micabo()
        || ' uniquement. Sinon stop.' || chr(10)
        || '2. find_freelancers action=smart_search, job_id='
        || c.job_posting_id || ', limit=' || c.profils_par_passage
        || '. C''est le classement Upwork pour ce job.' || chr(10)
        || '   Garde ceux qui collent à ' || pays
        || ' et qui savent recruter et piloter des créateurs.' || chr(10)
        || '3. Enregistre-les, sans inviter personne :' || chr(10)
        || '   select public.upwork_candidats_enregistrer('
        || quote_literal(c.id::text) || ', ''<jsonb>''::jsonb);' || chr(10)
        || '   Un objet par profil : upwork_person_id (= person_id), profile_key,'
        || ' nom, titre_profil, photo_url, upwork_profile_url, pays,'
        || ' taux_horaire, job_success, pourquoi (une phrase).' || chr(10)
        || '4. N''envoie AUCUNE invitation ici : l''admin valide dans l''OS,'
        || ' et sans réponse sous ' || c.delai_validation_h
        || ' h les profils partent tout seuls au passage suivant.' || chr(10)
        || '5. select public.upwork_action_terminer(''<id>'', ''<résumé>'');';

    else
      texte :=
        'Invite les Hiring Managers retenus pour ' || pays || '.' || chr(10)
        || '1. list_accounts → org Micabo ' || public.upwork_org_uid_micabo()
        || ' uniquement. Sinon stop.' || chr(10)
        || '2. select * from public.upwork_candidats_a_inviter('
        || quote_literal(c.id::text) || ');' || chr(10)
        || '   Cette liste et rien d''autre : profils validés par l''admin,'
        || ' plus ceux laissés sans réponse depuis ' || c.delai_validation_h
        || ' h (validation tacite).' || chr(10)
        || '3. Pour chacun : invite_freelancer action=send, job '
        || c.job_posting_id || ', freelancerId = upwork_person_id,'
        || ' puis confirm_preview type=''invitation''.' || chr(10)
        || '   Message d''invitation en ' || langue_msg
        || ' uniquement — pas dans une autre langue.'
        || ' Il dit micabo et le rôle de Hiring Manager.' || chr(10)
        || '4. Après chaque invitation partie :'
        || ' select public.upwork_candidat_invite(''<candidat_id>'');' || chr(10)
        || '5. select public.upwork_action_terminer(''<id>'', ''<résumé>'');';
    end if;

    insert into public.upwork_actions (
      type, campagne_id, cible_nom, cible_role, langue, prompt, demande_par
    )
    values (
      type_action, c.id, pays, 'hm', c.langue, texte, c.lance_par
    )
    returning id into nouvelle_id;

    update public.upwork_actions
    set prompt = replace(prompt, '''<id>''', quote_literal(nouvelle_id::text))
    where id = nouvelle_id;
  end loop;
end;
$$;

revoke all on function public.upwork_campagnes_planifier() from public, anon, authenticated;
grant execute on function public.upwork_campagnes_planifier() to service_role;
