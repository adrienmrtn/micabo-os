-- Talks lit les documents OS. Consigne de style éditable sur /admin/upwork.
-- Sauver un champ ne doit plus écraser les autres.

insert into public.documents (cle, titre, titre_en, audience, ordre, contenu, contenu_en)
values (
  'reponses_upwork',
  'Réponses Upwork (HM)',
  'Upwork replies (HM)',
  'manager',
  4,
  $fr$<h2>Comment on démarre ?</h2>
<p>On envoie le contrat Upwork. Tu acceptes, ensuite Slack et l'OS. Pas besoin d'appel, tout se fait ici.</p>
<h2>Faut-il un appel ?</h2>
<p>Non. On fait tout sur le fil Upwork.</p>
<h2>Quel est le rôle ?</h2>
<p>Tu es Hiring Manager pour micabo. Tu montes et suis une équipe de créateurs TikTok dans le pays, depuis le compte Upwork Micabo : poster le job, inviter, envoyer les contrats, onboarder, vérifier chaque jour qu'ils ont posté. Tu ne crées pas le contenu et tu ne te connectes jamais à leurs TikTok.</p>
<h2>Combien ça paie ?</h2>
<p>9 $/heure, heures réellement travaillées. Environ 1 à 2 h pour monter l'équipe, puis environ 10 min/jour.</p>
<h2>Je suis dispo / intéressé</h2>
<p>Parfait. Prochaine étape : le contrat Upwork. Tu acceptes, ensuite Slack et l'OS.</p>$fr$,
  $en$<h2>How do we get started?</h2>
<p>We send the Upwork contract. You accept, then Slack and the OS. No call needed, everything stays on this thread.</p>
<h2>Do we need a call?</h2>
<p>No. We do everything on the Upwork thread.</p>
<h2>What is the role?</h2>
<p>You are a Hiring Manager for micabo. You build and run a team of TikTok creators in the country, from the Micabo Upwork account: post the job, invite, send contracts, onboard, check every day that they posted. You don't create content and you never log into their TikToks.</p>
<h2>What does it pay?</h2>
<p>$9/hour, hours as actually worked. About 1-2h to build the team, then about 10 min/day.</p>
<h2>I'm available / interested</h2>
<p>Great. Next step: the Upwork contract. You accept, then Slack and the OS.</p>$en$
)
on conflict (cle) do nothing;

update public.reglages
set valeur = valeur || jsonb_build_object(
  'consigne',
  coalesce(
    nullif(valeur ->> 'consigne', ''),
    'Pas de tirets cadratins. Ton direct. Un smiley max.'
  )
)
where cle = 'upwork_acces';

create or replace function public.upwork_acces_reglages_sauver(p_valeur jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'upwork: admin seulement';
  end if;
  insert into public.reglages (cle, valeur)
  values ('upwork_acces', coalesce(p_valeur, '{}'::jsonb))
  on conflict (cle) do update set
    valeur = coalesce(public.reglages.valeur, '{}'::jsonb) || excluded.valeur,
    updated_at = now();
end;
$$;

create or replace function public.upwork_consigne()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select nullif(btrim(coalesce(public.upwork_acces_reglages() ->> 'consigne', '')), '');
$$;

revoke all on function public.upwork_consigne() from public, anon;
grant execute on function public.upwork_consigne() to authenticated, service_role;

create or replace function public.upwork_message_envoyer(
  p_proposal_id text,
  p_corps text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  a record;
  nouvelle_id uuid;
  texte text;
  consigne text := public.upwork_consigne();
begin
  if not public.is_admin() then
    raise exception 'upwork: admin seulement';
  end if;

  if p_corps is null or btrim(p_corps) = '' then
    raise exception 'upwork_message: corps vide';
  end if;

  if length(p_corps) > 10000 then
    raise exception 'upwork_message: trop long pour Upwork (10 000 caractères max)';
  end if;

  select ap.nom, ap.role, ap.job_posting_id, ap.upwork_proposal_id, m.langue
  into a
  from public.upwork_approches ap
  left join public.upwork_missions m on m.job_posting_id = ap.job_posting_id
  where ap.upwork_proposal_id = p_proposal_id;

  if not found then
    raise exception 'upwork_message: approche introuvable (%)', p_proposal_id;
  end if;

  texte :=
    'Envoie ce message à ' || a.nom
    || ' (' || coalesce(a.role, '?') || coalesce(' ' || a.langue, '') || ') sur Upwork.' || chr(10)
    || '1. list_accounts → org Micabo ' || public.upwork_org_uid_micabo()
    || ' uniquement. Sinon stop.' || chr(10)
    || '2. send_message action=message_proposal, job_posting_id=' || a.job_posting_id
    || ', proposal_id=' || p_proposal_id || '.' || chr(10)
    || '   Le message est le champ `message` de cette action, à envoyer'
    || ' **tel quel**. N''y touche pas, ne le traduis pas, n''ajoute rien.' || chr(10);

  if consigne is not null then
    texte := texte
      || '   Consigne de style déjà appliquée dans l''OS : ' || consigne || chr(10);
  end if;

  texte := texte
    || '3. select public.upwork_action_terminer(''<id>'', ''<résumé>'');' || chr(10)
    || 'Si l''envoi échoue, dis-le dans le résumé et n''essaie pas de reformuler.';

  insert into public.upwork_actions (
    type, upwork_proposal_id, cible_nom, cible_role, langue, prompt, message, demande_par
  )
  values (
    'envoyer_message', p_proposal_id, a.nom, a.role, a.langue, texte, p_corps, auth.uid()
  )
  returning id into nouvelle_id;

  update public.upwork_actions
  set prompt = replace(prompt, '''<id>''', quote_literal(nouvelle_id::text))
  where id = nouvelle_id;

  return nouvelle_id;
end;
$$;

revoke all on function public.upwork_message_envoyer(text, text) from public, anon;
grant execute on function public.upwork_message_envoyer(text, text) to authenticated;

create or replace function public.upwork_contrat_preparer(p_proposal_id text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  a record;
  nouvelle_id uuid;
  texte text;
  consigne text := public.upwork_consigne();
begin
  if not public.is_admin() then
    raise exception 'upwork: admin seulement';
  end if;

  select ap.nom, ap.role, ap.job_posting_id, ap.upwork_freelancer_id, m.langue
  into a
  from public.upwork_approches ap
  left join public.upwork_missions m on m.job_posting_id = ap.job_posting_id
  where ap.upwork_proposal_id = p_proposal_id;

  if not found then
    raise exception 'upwork_contrat: approche introuvable (%)', p_proposal_id;
  end if;

  if exists (
    select 1 from public.upwork_actions
    where upwork_proposal_id = p_proposal_id
      and type = 'preparer_contrat' and statut = 'en_attente'
  ) then
    raise exception 'upwork_contrat: brouillon déjà demandé';
  end if;

  texte :=
    'Prépare le contrat de ' || a.nom
    || ' (' || coalesce(a.role, '?') || coalesce(' ' || a.langue, '') || ').'
    || ' Brouillon seulement : c''est l''admin qui envoie.' || chr(10)
    || '1. list_accounts → org Micabo ' || public.upwork_org_uid_micabo()
    || ' uniquement. Sinon stop.' || chr(10)
    || '2. list_contracts action=search puis get sur le dernier contrat '
    || coalesce(a.role, 'hm') || ' signé : reprends son taux horaire et son'
    || ' plafond hebdomadaire. Mêmes termes que l''équipe en place.' || chr(10)
    || '3. find_freelancers action=get_profile, person_id='
    || coalesce(a.upwork_freelancer_id, '<inconnu>')
    || ' → récupère vendor_org_uid.' || chr(10)
    || '4. manage_offers action=create_draft, org_uid='
    || public.upwork_org_uid_micabo()
    || ', vendor_user_id=' || coalesce(a.upwork_freelancer_id, '<inconnu>')
    || ', metadata {sourceType: JobApplication, sourceId: ' || p_proposal_id
    || ', jobPostingId: ' || a.job_posting_id || '}.' || chr(10)
    || '5. Le brouillon rend une finalize_url. Enregistre-la :' || chr(10)
    || '   select public.upwork_contrat_lien(' || quote_literal(p_proposal_id)
    || ', ''<finalize_url>'');' || chr(10)
    || '6. N''envoie PAS l''offre et ne confirme aucun preview d''envoi.'
    || ' L''admin relit et envoie depuis Upwork.' || chr(10)
    || '7. select public.upwork_action_terminer(''<id>'', ''<résumé>'');';

  if consigne is not null then
    texte := texte || chr(10)
      || 'Consigne de style (tout texte écrit sur l''offre) : ' || consigne;
  end if;

  insert into public.upwork_actions (
    type, upwork_proposal_id, cible_nom, cible_role, langue, prompt, demande_par
  )
  values (
    'preparer_contrat', p_proposal_id, a.nom, a.role, a.langue, texte, auth.uid()
  )
  returning id into nouvelle_id;

  update public.upwork_actions
  set prompt = replace(prompt, '''<id>''', quote_literal(nouvelle_id::text))
  where id = nouvelle_id;

  return nouvelle_id;
end;
$$;

revoke all on function public.upwork_contrat_preparer(text) from public, anon;
grant execute on function public.upwork_contrat_preparer(text) to authenticated;
