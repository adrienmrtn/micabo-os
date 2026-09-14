-- Retour en arrière sur 0260 : on promeut de nouveau le SITE micabo.app.
--
-- Plus de « micabo » nu, plus d'application mobile. Le nom reprend son domaine
-- et son mot de catégorie : « le site micabo.app », « el sitio micabo.app »,
-- « the site micabo.app », et en turc la forme agglutinée « micabo.app
-- sitesi / sitesini / sitesine / sitesiyle ».
--
-- Ce que 0260 avait vidé ne revient pas : les 176 decks traduits ont été
-- effacés pour retraduction. Ils se refont à l'assignation, et comme le prompt
-- redit « le site micabo.app », ils repartiront justes. Rien à rattraper ici.

-- ---------------------------------------------------------------------------
-- 1. Les prompts
-- ---------------------------------------------------------------------------

-- 1a. Placement. L'inverse exact de 0260 : le nom retrouve d'abord son domaine
--     partout (dans ce prompt, presque toutes les occurrences étaient nues),
--     puis les sections que 0260 avait réécrites en entier reprennent leur
--     texte d'origine. L'ordre compte : faire les sections d'abord, puis la
--     passe générique, donnerait « micabo.app.app ».
update public.prompts
set contenu = replace(contenu, 'micabo', 'micabo.app')
where cle = 'placement_micabo';

update public.prompts set contenu =
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(contenu,
    $a$Une slide qui parle de micabo.app sans jamais avoir l'air d'une pub$a$,
    $b$Une slide qui parle du site micabo.app sans jamais avoir l'air d'une pub$b$),
    $a$micabo.app est une APPLICATION MOBILE de révision qui utilise l'IA$a$,
    $b$micabo.app est un site de révision qui utilise l'IA$b$),
    $a$Écris TOUJOURS "micabo.app", le nom SEUL, en minuscules, même en début de phrase. Jamais "Micabo", jamais "MICABO", jamais le nom suivi d'une extension de domaine, jamais d'abréviation ou de surnom.
N'ajoute AUCUN mot de catégorie devant : ni "le site micabo.app" (c'est faux, c'est une application mobile), ni "l'app micabo.app", ni "l'appli micabo.app", ni "la plateforme micabo.app". Le nom seul suffit — le contexte de la slide fait le reste.$a$,
    $b$Écris TOUJOURS "le site micabo.app", en minuscules, même en début de phrase. Jamais "Micabo.app", jamais "MICABO.APP", jamais "micabo" tout seul sans le ".app", jamais d'abréviation ou de surnom.
Ne dis jamais "la plateforme micabo.app" (trop corporate). Dis "le site micabo.app" seul.$b$),
    $a$14. micabo.app est une APPLICATION MOBILE, plus un site. Ne l'appelle donc JAMAIS un site. Mais n'écris pas non plus "l'app micabo.app" : le nom seul, toujours.$a$,
    $b$14. ATTENTION, PRECISE TOUJOURS QUE micabo.app est un site. genre parle du 'site micabo.app' jamais de micabo.app seul$b$),
    $a$'perso j'utilise micabo.app pour préparer mes examens'$a$,
    $b$'perso j'utilise le site micabo.app pour préparer mes examens'$b$),
    $a$Ai-je écrit "micabo.app" en minuscules partout, le nom seul, sans extension de domaine, sans surnom, sans "site" ni "app" ni "plateforme" devant ?$a$,
    $b$Ai-je écrit "micabo.app" en minuscules partout, avec le ".app", sans surnom ni "plateforme" ?$b$),
    $a$micabo.app parfait pour ça, il les crée à partir de tes cours$a$,
    $b$Le site micabo.app parfait pour ça, il les crée à partir de tes cours$b$),
    $a$Perso j'utilise micabo.app tu te testes et là ça reste.$a$,
    $b$Perso j'utilise le site micabo.app tu te testes et là ça reste.$b$),
    $a$sur micabo.app tu déposes ton pdf de cours$a$,
    $b$sur le site micabo.app tu déposes ton pdf de cours$b$)
where cle = 'placement_micabo';

-- 1b. Pertinence.
update public.prompts set contenu = replace(contenu,
  $a$micabo est une application mobile d'éducation IA pour les étudiants$a$,
  $b$micabo est une application et un site d'éducation IA pour les étudiants$b$)
where cle = 'pertinence_micabo';

-- 1c. Traduction turque.
update public.prompts set contenu = replace(contenu,
  $a$- micabo est une APPLICATION MOBILE. Écris le nom SEUL, en minuscules : « micabo ».
- Le cas grammatical s'accole au nom par une apostrophe : micabo'yu, micabo'ya, micabo'da, micabo'dan, ou « micabo ile ».
- INTERDIT : « micabo.app », le mot « site » / « sitesi » sous toutes ses formes, « micabo uygulaması » (le nom seul suffit), et « indir / App Store » en formule publicitaire.$a$,
  $b$- micabo.app est un SITE web. Le spectateur doit comprendre qu'il ouvre un site, pas l'App Store.
- Formules : « micabo.app sitesi », « micabo.app sitesiyle », « micabo.app sitesini », « micabo.app sitesine ».
- INTERDIT : uygulama, indir, App Store, « micabo.app ile » sans « sitesi », « site micabo.app » (le mot site AVANT le nom).$b$)
where cle = 'traduction_tr';

-- ---------------------------------------------------------------------------
-- 2. Les documents
-- ---------------------------------------------------------------------------
update public.documents set contenu = replace(contenu,
  $a$Tu aides à promouvoir micabo, une application mobile de flashcards : on y dépose ses cours, ses notes ou un PDF, et micabo génère les flashcards pour réviser$a$,
  $b$Tu aides à promouvoir micabo.app, un site de flashcards : on y dépose ses cours, ses notes ou un PDF, et micabo.app génère les flashcards pour réviser$b$)
where titre = 'Guide du créateur';

update public.documents set contenu =
  replace(
  replace(contenu,
    $a$Micabo HMs — Onboarding$a$,
    $b$Micabo.app HMs — Onboarding$b$),
    $a$Tu aides à promouvoir <b>micabo, une application mobile pour t'aider à réviser plus efficacement.</b>$a$,
    $b$Tu aides à promouvoir <b>Micabo.app , un site pour t'aider à réviser plus efficacement.</b>$b$)
where titre = 'Guide du manager';

-- ---------------------------------------------------------------------------
-- 3. Le texte écrit
-- ---------------------------------------------------------------------------
-- 0260 avait effacé l'information « quel mot de catégorie précédait le nom » :
-- « le site micabo.app » et « micabo.app » nu donnaient tous deux « micabo ».
-- On ne peut donc pas restituer l'octet d'origine — on remet la forme que le
-- prompt impose, « le site micabo.app », qui est de toute façon la forme
-- canonique. Le turc reprend « micabo.app sitesi… » et non « site micabo.app »,
-- l'ordre français que l'ancien prompt interdisait explicitement.
create or replace function public.micabo_retour_site(txt text, langue text) returns text
language plpgsql immutable as $fn$
declare t text := txt;
begin
  if t is null then return t; end if;
  if t !~* '\mmicabo\M' then return t; end if;

  -- Les deux phrases reprises à la main l'ont été EN DERNIER dans 0260 : on
  -- les défait en premier, sinon la règle générale les aurait déjà avalées.
  t := replace(t, 'Es la app perfecta para prepararte', 'Es el sitio perfecto para prepararte');
  t := replace(t, 'micabo sana çalışma planı hazırlıyor', 'site sana çalışma planı hazırlıyor');

  -- Le nom passe par une sentinelle avant de reprendre son domaine. Sans ça,
  -- la règle suivante remord sur le « micabo » que la précédente vient
  -- d'écrire : « micabo ile » devenait « micabo.app sitesi.app sitesiyle ».
  if langue = 'tr' then
    t := regexp_replace(t, 'micabo''daki', chr(1) || 'sitesindeki', 'gi');
    t := regexp_replace(t, 'micabo''dan',  chr(1) || 'sitesinden',  'gi');
    t := regexp_replace(t, 'micabo''da',   chr(1) || 'sitesinde',   'gi');
    t := regexp_replace(t, 'micabo''yu',   chr(1) || 'sitesini',    'gi');
    t := regexp_replace(t, 'micabo''ya',   chr(1) || 'sitesine',    'gi');
    t := regexp_replace(t, '\mmicabo\s+ile\M', chr(1) || 'sitesiyle', 'gi');
    t := regexp_replace(t, '\mmicabo\M',   chr(1) || 'sitesi',      'g');
    return replace(t, chr(1), 'micabo.app ');
  end if;

  t := regexp_replace(t, '\mmicabo\M', chr(1), 'g');
  if langue = 'fr' then
    return replace(t, chr(1), 'le site micabo.app');
  elsif langue = 'es' then
    return replace(t, chr(1), 'el sitio micabo.app');
  elsif langue = 'en' then
    return replace(t, chr(1), 'the site micabo.app');
  end if;
  -- Langue non vérifiée : on remet le domaine, on n'invente pas d'article.
  return replace(t, chr(1), 'micabo.app');
end $fn$;

-- Tous les decks, source ET traduits : depuis 0260, l'assignation a pu en
-- refabriquer avec la marque « micabo ». Le filtre porte sur le texte, pas sur
-- une liste figée.
update public.contenu_langues cl
set slides = (
  select coalesce(
    jsonb_agg(
      case
        when e->>'texte_overlay' is not null
        then jsonb_set(e, '{texte_overlay}',
               to_jsonb(public.micabo_retour_site(e->>'texte_overlay', cl.langue)))
        else e
      end
      order by ord),
    '[]'::jsonb)
  from jsonb_array_elements(cl.slides) with ordinality as t(e, ord))
where cl.slides::text ~* '"[^"]*\mmicabo\M[^"]*"';

update public.post_slides ps
set texte_overlay = public.micabo_retour_site(ps.texte_overlay, co.langue)
from public.posts p, public.comptes co
where p.id = ps.post_id
  and co.id = p.compte_id
  and p.statut = 'assigne'
  and ps.texte_overlay ~* '\mmicabo\M';

update public.passages pa
set slides = (
  select coalesce(
    jsonb_agg(
      case
        when e->>'texte_overlay' is not null
        then jsonb_set(e, '{texte_overlay}',
               to_jsonb(public.micabo_retour_site(e->>'texte_overlay', pa.langue)))
        else e
      end
      order by ord),
    '[]'::jsonb)
  from jsonb_array_elements(pa.slides) with ordinality as t(e, ord))
where pa.statut = 'assigne'
  and pa.slides::text ~* '"[^"]*\mmicabo\M[^"]*"';

drop function public.micabo_retour_site(text, text);

-- ---------------------------------------------------------------------------
-- 4. Au-delà du retour strict
-- ---------------------------------------------------------------------------
-- Ces lignes existaient AVANT 0260 et appelaient déjà micabo une
-- « application ». Elles contredisent « le site micabo.app partout, plus jamais
-- l'appli », donc elles s'alignent aussi.

update public.prompts set contenu = replace(
  replace(contenu,
    $a$micabo est une application et un site d'éducation IA pour les étudiants$a$,
    $b$micabo.app est un site d'éducation IA pour les étudiants$b$),
  $a$et micabo génère automatiquement un plan de révision$a$,
  $b$et micabo.app génère automatiquement un plan de révision$b$)
where cle = 'pertinence_micabo';

update public.prompts set contenu = replace(
  replace(
  replace(contenu,
    $a$pour PROMOUVOIR micabo avec un CTA$a$,
    $b$pour PROMOUVOIR micabo.app avec un CTA$b$),
    $a$10 min par jour — micabo le fait pour toi$a$,
    $b$10 min par jour — micabo.app le fait pour toi$b$),
    $a$comme une app de culture générale. micabo = progrès en cours$a$,
    $b$comme une app de culture générale. micabo.app = progrès en cours$b$)
where cle = 'pertinence_micabo';

update public.prompts set contenu = replace(contenu,
  $a$Le remplacement par micabo est geré par un autre prompt$a$,
  $b$Le remplacement par micabo.app est geré par un autre prompt$b$)
where cle = 'traduction_tr';
