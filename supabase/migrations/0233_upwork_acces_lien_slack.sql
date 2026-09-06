-- Le lien Slack managers fait partie du message d'accès, pas une invitation
-- « sur l'email que tu m'as donné ». L'admin peut aussi cocher l'étape à la main.

update public.reglages
set valeur = jsonb_set(
  coalesce(valeur, '{}'::jsonb),
  '{slack_invite_manager}',
  '"https://join.slack.com/t/micaboapp/shared_invite/zt-48nrw6z5x-Cdeo6CPVDldMYUBsQEzs8A"'
),
updated_at = now()
where cle = 'upwork_acces';

create or replace function public.upwork_acces_planifier()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  a record;
  compte jsonb;
  cfg jsonb;
  slack_url text;
  os_url text;
  fr boolean;
  prenom text;
  pays text;
  blocs text[] := '{}';
  corps text;
  prompt text;
  nouvelle_id uuid;
  envoi_slack boolean;
  envoi_email boolean;
  envoi_codes boolean;
begin
  cfg := public.upwork_acces_reglages();
  slack_url := coalesce(
    nullif(btrim(coalesce(cfg ->> 'slack_invite_manager', '')), ''),
    'https://join.slack.com/t/micaboapp/shared_invite/zt-48nrw6z5x-Cdeo6CPVDldMYUBsQEzs8A'
  );
  os_url := coalesce(nullif(btrim(cfg ->> 'os_url'), ''), 'https://os.micabo.app/login');

  for a in
    select
      ap.upwork_proposal_id,
      ap.nom,
      ap.role,
      ap.resume_discussions,
      ap.slack_envoye_ok,
      ap.email_demande_ok,
      ap.codes_ok,
      ap.job_posting_id,
      m.langue
    from public.upwork_approches ap
    left join public.upwork_missions m on m.job_posting_id = ap.job_posting_id
    where ap.role = 'hm'
      and ap.contrat_signe_ok
      and (
        not ap.slack_envoye_ok
        or not ap.email_demande_ok
        or not ap.codes_ok
      )
  loop
    if exists (
      select 1 from public.upwork_actions
      where upwork_proposal_id = a.upwork_proposal_id
        and type in ('envoyer_acces_hm', 'envoyer_message')
        and statut = 'en_attente'
    ) then
      continue;
    end if;

    envoi_slack := not a.slack_envoye_ok;
    envoi_email := not a.email_demande_ok;
    envoi_codes := not a.codes_ok;

    if not envoi_slack and not envoi_email and not envoi_codes then
      continue;
    end if;

    compte := public.upwork_hm_provisionner(a.upwork_proposal_id);

    fr := coalesce(a.langue, '') = 'fr';
    prenom := split_part(btrim(a.nom), ' ', 1);
    pays := case a.langue
      when 'fr' then 'France'
      when 'es' then 'Spain'
      when 'de' then 'Germany'
      when 'it' then 'Italy'
      when 'pt' then 'Portugal'
      when 'tr' then 'Turkey'
      when 'nl' then 'Netherlands'
      when 'pl' then 'Poland'
      else coalesce(upper(a.langue), '')
    end;

    if fr then
      blocs := array['Bonjour ' || prenom || ','];
      if nullif(btrim(a.resume_discussions), '') is not null then
        blocs := blocs || array['', 'J''ai bien noté : ' || btrim(a.resume_discussions)];
      end if;
      blocs := blocs || array['', 'Bienvenue dans l''équipe micabo sur ' || pays || '.'];
      if envoi_slack then
        blocs := blocs || array[
          '',
          '1. Slack managers — rejoins-nous ici :',
          slack_url
        ];
      end if;
      if envoi_codes then
        blocs := blocs || array[
          '',
          '2. OS micabo — j''ai créé ton compte. Connecte-toi sur ' || os_url,
          '   email : ' || coalesce(compte ->> 'email', '—'),
          '   mot de passe : ' || coalesce(compte ->> 'password', '(celui déjà reçu)')
        ];
      end if;
      if envoi_email then
        blocs := blocs || array[
          '',
          '3. Réponds-moi avec l''email que tu veux utiliser au quotidien.'
        ];
      end if;
      blocs := blocs || array['', 'Adrien'];
    else
      blocs := array['Hi ' || prenom || ','];
      if nullif(btrim(a.resume_discussions), '') is not null then
        blocs := blocs || array['', 'Noted: ' || btrim(a.resume_discussions)];
      end if;
      blocs := blocs || array['', 'Welcome to the micabo team for ' || pays || '.'];
      if envoi_slack then
        blocs := blocs || array[
          '',
          '1. Slack for managers — join here:',
          slack_url
        ];
      end if;
      if envoi_codes then
        blocs := blocs || array[
          '',
          '2. micabo OS — I created your account. Sign in at ' || os_url,
          '   email: ' || coalesce(compte ->> 'email', '—'),
          '   password: ' || coalesce(compte ->> 'password', '(the one you already received)')
        ];
      end if;
      if envoi_email then
        blocs := blocs || array[
          '',
          '3. Reply with the email you want to use day to day.'
        ];
      end if;
      blocs := blocs || array['', 'Adrien'];
    end if;

    corps := array_to_string(blocs, chr(10));

    prompt :=
      'Envoie les accès à ' || a.nom
      || ' (hm' || coalesce(' ' || a.langue, '') || ') sur Upwork.' || chr(10)
      || '1. list_accounts → org Micabo ' || public.upwork_org_uid_micabo()
      || ' uniquement. Sinon stop.' || chr(10)
      || '2. send_message action=message_proposal, job_posting_id='
      || a.job_posting_id || ', proposal_id=' || a.upwork_proposal_id || '.' || chr(10)
      || '   Le message est le champ `message` de cette action, à envoyer'
      || ' **tel quel**. N''y touche pas, ne le traduis pas, n''ajoute rien.' || chr(10)
      || '   Il contient déjà le lien Slack et les codes OS.' || chr(10)
      || '3. select public.upwork_action_terminer(''<id>'', ''<résumé>'');' || chr(10)
      || 'Si l''envoi échoue, dis-le dans le résumé et n''essaie pas de reformuler.';

    insert into public.upwork_actions (
      type, upwork_proposal_id, cible_nom, cible_role, langue,
      prompt, message, note, demande_par
    )
    values (
      'envoyer_acces_hm',
      a.upwork_proposal_id,
      a.nom,
      'hm',
      a.langue,
      prompt,
      corps,
      jsonb_build_object(
        'slack', envoi_slack, 'email', envoi_email, 'codes', envoi_codes
      )::text,
      null
    )
    returning id into nouvelle_id;

    update public.upwork_actions
    set prompt = replace(prompt, '''<id>''', quote_literal(nouvelle_id::text))
    where id = nouvelle_id;
  end loop;
end;
$$;

create or replace function public.upwork_marquer_flag(
  p_proposal_id text,
  p_flag text,
  p_ok boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'upwork: admin seulement';
  end if;

  if p_flag not in ('upwork_ajoute_ok', 'contrat_envoye_ok', 'acces_envoyes') then
    raise exception 'upwork_flag: inconnu (%)', p_flag;
  end if;

  insert into public.upwork_admin_flags (upwork_proposal_id, maj_par, maj_at)
  values (p_proposal_id, auth.uid(), now())
  on conflict (upwork_proposal_id) do update set
    maj_par = excluded.maj_par,
    maj_at = now();

  if p_flag = 'upwork_ajoute_ok' then
    update public.upwork_admin_flags
    set upwork_ajoute_ok = coalesce(p_ok, false)
    where upwork_proposal_id = p_proposal_id;
    update public.upwork_approches
    set upwork_ajoute_ok = coalesce(p_ok, false)
    where upwork_proposal_id = p_proposal_id;
  elsif p_flag = 'contrat_envoye_ok' then
    update public.upwork_admin_flags
    set contrat_envoye_ok = coalesce(p_ok, false)
    where upwork_proposal_id = p_proposal_id;
    update public.upwork_approches
    set contrat_envoye_ok = coalesce(p_ok, false)
    where upwork_proposal_id = p_proposal_id;
  else
    update public.upwork_admin_flags
    set
      slack_envoye_ok = coalesce(p_ok, false),
      email_demande_ok = coalesce(p_ok, false),
      codes_ok = coalesce(p_ok, false)
    where upwork_proposal_id = p_proposal_id;
    update public.upwork_approches
    set
      slack_envoye_ok = coalesce(p_ok, false),
      email_demande_ok = coalesce(p_ok, false),
      codes_ok = coalesce(p_ok, false)
    where upwork_proposal_id = p_proposal_id;
  end if;
end;
$$;

insert into public.upwork_admin_flags (
  upwork_proposal_id, slack_envoye_ok, email_demande_ok, codes_ok, maj_at
)
values ('2094513157074717998', true, true, true, now())
on conflict (upwork_proposal_id) do update set
  slack_envoye_ok = true,
  email_demande_ok = true,
  codes_ok = true,
  maj_at = now();

update public.upwork_approches
set slack_envoye_ok = true, email_demande_ok = true, codes_ok = true
where upwork_proposal_id = '2094513157074717998';
