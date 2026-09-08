-- Un lancement = un nouveau job HM. Les HM déjà recrutés sur le pays
-- restent : ça se cumule. On ne termine une campagne que lorsqu'un HM
-- est embauché sur LE job de cette vague, pas sur n'importe quel job
-- du pays.
--
-- Les modèles deviennent le playbook de l'étape (la suite à couvrir).
-- L'OS compose le brouillon par personne : ce qu'elle a dit, ce qu'il
-- lui manque, puis ce playbook.

create or replace function public.upwork_campagne_lancer(
  p_langue text,
  p_pays_nom text default null,
  p_objectif integer default 1,
  p_delai_h integer default 10
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  nouvelle_id uuid;
begin
  if not public.is_admin() then
    raise exception 'upwork: admin seulement';
  end if;

  if p_langue is null or btrim(p_langue) = '' then
    raise exception 'upwork_campagne: langue manquante';
  end if;

  insert into public.upwork_campagnes (
    langue, pays_nom, objectif_hm, delai_validation_h, lance_par
  )
  values (
    lower(btrim(p_langue)),
    nullif(btrim(p_pays_nom), ''),
    greatest(coalesce(p_objectif, 1), 1),
    greatest(coalesce(p_delai_h, 10), 1),
    auth.uid()
  )
  returning id into nouvelle_id;

  -- Jamais rattacher un job déjà ouvert : chaque vague publie le sien.
  perform public.upwork_campagnes_planifier();
  return nouvelle_id;
exception
  when unique_violation then
    raise exception 'upwork_campagne: une campagne tourne déjà sur ce pays';
end;
$$;

revoke all on function public.upwork_campagne_lancer(text, text, integer, integer) from public, anon;
grant execute on function public.upwork_campagne_lancer(text, text, integer, integer) to authenticated;

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
begin
  for c in
    select * from public.upwork_campagnes
    where statut in ('active', 'en_pause')
    order by lance_at
  loop
    pays := coalesce(c.pays_nom, upper(c.langue));

    -- Compte uniquement les hired du job de CETTE campagne.
    -- Sans job encore, 0 : on ne clôt pas parce qu'un autre HM du pays existe.
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
        || '   Message court, dans la langue de ' || pays
        || ', qui dit micabo et le rôle de Hiring Manager.' || chr(10)
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

-- Playbooks : la suite à couvrir, pas la lettre entière.
-- On ne touche qu'aux génériques encore au seed d'origine.

update public.upwork_modeles set corps =
  'Le rôle : recruter et piloter une petite équipe de créateurs TikTok sur {{pays}}, en autonomie. Environ 10 créateurs à terme.

Pour avancer :
1. Tu as déjà recruté et encadré des créateurs de contenu ?
2. Combien d''heures par semaine peux-tu y consacrer ?
3. Tu démarrerais quand ?',
  maj_at = now()
where cle = 'pourparlers' and role_cible = 'hm' and langue = '*'
  and corps like 'Bonjour {{prenom}},%Merci pour votre retour%';

update public.upwork_modeles set corps =
  'Je t''envoie le contrat sur Upwork dans la foulée. Une fois accepté, je t''ouvre Slack et l''OS micabo.',
  maj_at = now()
where cle = 'contrat_envoye' and role_cible = 'hm' and langue = '*'
  and corps like 'Bonjour {{prenom}},%Parfait, on avance%';

update public.upwork_modeles set corps =
  'Pour démarrer :
1. Slack — l''invitation part sur l''email que tu m''as donné.
2. L''OS micabo — tes codes arrivent par email, connecte-toi une première fois.
3. Réponds-moi ici quand les deux sont faits, je t''ajoute à mon compte Upwork.

Le guide est dans l''OS, onglet Documents.',
  maj_at = now()
where cle = 'acces_envoyes' and role_cible = 'hm' and langue = '*'
  and corps like 'Bonjour {{prenom}},%Bienvenue. Trois choses%';

update public.upwork_modeles set corps =
  'Prochaine étape : je poste ton job créateurs sur {{pays}} pour que tu puisses commencer à recruter. Objectif : une dizaine de créateurs actifs, par paliers.',
  maj_at = now()
where cle = 'integration' and role_cible = 'hm' and langue = '*'
  and corps like 'Bonjour {{prenom}},%On est bons sur les accès%';

update public.upwork_modeles set corps =
  'Ton job créateurs est en ligne sur {{pays}}. Tu peux commencer à trier.

On cherche des profils capables de poster régulièrement en slideshow TikTok, dans la langue du pays. La régularité compte plus que l''expérience.

Dis-moi si tu veux qu''on regarde les premiers profils ensemble.',
  maj_at = now()
where cle = 'job_createur_poste' and role_cible = 'hm' and langue = '*'
  and corps like 'Bonjour {{prenom}},%Votre job créateurs%';

update public.upwork_modeles set corps =
  'On cherche des créateurs TikTok pour micabo sur {{pays}} — une app d''éducation par IA pour les étudiants.

Le format : des slideshows courts, publiés régulièrement, dans la langue du pays. Tout le contenu t''est fourni, tu n''as pas à l''écrire.

Deux questions :
1. Tu postes déjà sur TikTok ? Si oui, ton compte ?
2. Tu peux tenir un rythme de publication quotidien ?',
  maj_at = now()
where cle = 'pourparlers' and role_cible = 'createur' and langue = '*'
  and corps like 'Bonjour {{prenom}},%Merci pour votre candidature%';

update public.upwork_modeles set corps =
  'Pour démarrer :
1. Slack — l''invitation part sur ton email.
2. L''OS micabo — tes codes arrivent par email, connecte-toi une première fois.

Ensuite on crée ton compte TikTok et on lance le warmup.',
  maj_at = now()
where cle = 'acces_envoyes' and role_cible = 'createur' and langue = '*'
  and corps like 'Bonjour {{prenom}},%Bienvenue. Deux choses%';

update public.upwork_modeles set corps =
  'Crée le compte TikTok et renseigne le pseudo dans l''OS (onglet Mon compte).

Dès qu''il est là, on démarre le warmup : 24 h sans publier, le temps que le compte se pose. Après ça, tu reçois tes premiers posts.',
  maj_at = now()
where cle = 'tiktok_cree' and role_cible = 'createur' and langue = '*'
  and corps like 'Bonjour {{prenom}},%Il me manque votre compte TikTok%';
