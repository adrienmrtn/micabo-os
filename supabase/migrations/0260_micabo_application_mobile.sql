-- On ne promeut plus le site « micabo.app » mais l'application mobile « micabo ».
--
-- Même produit, mêmes fonctionnalités : seul le support change. Le nom s'écrit
-- désormais SEUL, en minuscules — pas de « .app », pas de mot de catégorie
-- (« le site », « l'app », « la plateforme »). La règle de ton d'origine
-- (minuscules même en début de phrase, pour que la slide n'ait pas l'air d'une
-- pub) est conservée telle quelle.
--
-- Trois surfaces bougent : les prompts qui écrivent les CTA, les documents lus
-- par les créateurs et les managers, et le texte déjà écrit.

-- ---------------------------------------------------------------------------
-- 1. La règle de réécriture
-- ---------------------------------------------------------------------------
-- Outil de migration : posé, utilisé, retiré en fin de fichier. Il n'a pas à
-- survivre — le moteur n'écrira plus jamais « micabo.app » dans une slide.
create or replace function public.micabo_reecrire_cta(txt text) returns text
language plpgsql immutable as $fn$
declare t text := txt;
begin
  if t is null then return t; end if;

  -- L'adresse e-mail interne (@micabo.app) et les URL ne sont pas des CTA.
  t := replace(t, '@micabo.app', chr(1));
  t := replace(t, '//micabo.app', chr(2));

  -- Le mot de catégorie tombe AVANT tout le reste. L'ordre inverse laissait
  -- « site micabo'yu » : la règle turque des suffixes avait déjà consommé le
  -- nom et le mot « site » restait orphelin.
  -- Le retour à la ligne, lui, est gardé : ces textes sont posés sur une image
  -- et la coupe est voulue.
  t := regexp_replace(t, '(le|la|el|the)[ \t]+(site|sitio)[ \t]*\n[ \t]*micabo\.app', E'\nmicabo.app', 'gi');
  t := regexp_replace(t, '(le|la|el|the)\s+(site|sitio)\s+micabo\.app', 'micabo.app', 'gi');
  t := regexp_replace(t, 'site\s+micabo\.app', 'micabo.app', 'gi');
  t := regexp_replace(t, 'micabo\.app\s+(website|web site)', 'micabo.app', 'gi');

  -- TURC — « micabo.app sitesi » porte le cas grammatical dans son suffixe.
  -- Le suffixe repasse sur le nom, avec l'harmonie vocalique arrière de
  -- « micabo » (o) : sitesini -> 'yu, sitesine -> 'ya, sitesinde -> 'da.
  t := regexp_replace(t, 'micabo\.app\s+sitesindeki', 'micabo''daki', 'gi');
  t := regexp_replace(t, 'micabo\.app\s+sitesinden',  'micabo''dan',  'gi');
  t := regexp_replace(t, 'micabo\.app\s+sitesinde',   'micabo''da',   'gi');
  t := regexp_replace(t, 'micabo\.app\s+sitesini',    'micabo''yu',   'gi');
  t := regexp_replace(t, 'micabo\.app\s+sitesine',    'micabo''ya',   'gi');
  t := regexp_replace(t, 'micabo\.app\s+sitesiyle',   'micabo ile',   'gi');
  t := regexp_replace(t, 'micabo\.app\s+sitesi',      'micabo',       'gi');

  -- TURC — suffixe déjà accolé au nom de domaine.
  t := regexp_replace(t, 'micabo\.app''(ten|tan|den|dan)', 'micabo''dan', 'gi');
  t := regexp_replace(t, 'micabo\.app''(te|ta|de|da)',     'micabo''da',  'gi');
  t := regexp_replace(t, 'micabo\.app''(i|ı)',             'micabo''yu',  'gi');
  t := regexp_replace(t, 'micabo\.app''(e|a)',             'micabo''ya',  'gi');
  t := regexp_replace(t, 'micabo\.app''(le|la)',           'micabo ile',  'gi');

  t := regexp_replace(t, 'micabo\.app', 'micabo', 'gi');

  t := replace(t, chr(1), '@micabo.app');
  t := replace(t, chr(2), '//micabo.app');
  return t;
end $fn$;

-- ---------------------------------------------------------------------------
-- 2. Les prompts
-- ---------------------------------------------------------------------------

-- 2a. Placement — ce qui décrit le produit, et la règle d'écriture du nom.
update public.prompts set contenu =
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(
  replace(contenu,
    $a$PROMPT — Placement publicitaire natif de micabo.app$a$,
    $b$PROMPT — Placement publicitaire natif de micabo$b$),
    $a$Une slide qui parle du site micabo.app sans jamais avoir l'air d'une pub$a$,
    $b$Une slide qui parle de micabo sans jamais avoir l'air d'une pub$b$),
    $a$micabo.app est un site de révision qui utilise l'IA : tu déposes tes cours, tes notes ou un PDF, la date de ton examen et micabo.app génère automatiquement ton plan de révision$a$,
    $b$micabo est une APPLICATION MOBILE de révision qui utilise l'IA : tu déposes tes cours, tes notes ou un PDF, la date de ton examen et micabo génère automatiquement ton plan de révision$b$),
    $a$RÈGLES POSITIVES :

Écris TOUJOURS "le site micabo.app", en minuscules, même en début de phrase. Jamais "Micabo.app", jamais "MICABO.APP", jamais "micabo" tout seul sans le ".app", jamais d'abréviation ou de surnom.
Ne dis jamais "la plateforme micabo.app" (trop corporate). Dis "le site micabo.app" seul.$a$,
    $b$RÈGLES POSITIVES :

Écris TOUJOURS "micabo", le nom SEUL, en minuscules, même en début de phrase. Jamais "Micabo", jamais "MICABO", jamais le nom suivi d'une extension de domaine, jamais d'abréviation ou de surnom.
N'ajoute AUCUN mot de catégorie devant : ni "le site micabo" (c'est faux, c'est une application mobile), ni "l'app micabo", ni "l'appli micabo", ni "la plateforme micabo". Le nom seul suffit — le contexte de la slide fait le reste.$b$),
    $a$14. ATTENTION, PRECISE TOUJOURS QUE micabo.app est un site. genre parle du 'site micabo.app' jamais de micabo.app seul$a$,
    $b$14. micabo est une APPLICATION MOBILE, plus un site. Ne l'appelle donc JAMAIS un site. Mais n'écris pas non plus "l'app micabo" : le nom seul, toujours.$b$),
    $a$15. TU PEUX AUSSI JOUER SUR L'AXE 'avoir des meilleurs notes' et les conseils personnels comme 'perso j'utilise le site micabo.app pour préparer mes examens'$a$,
    $b$15. TU PEUX AUSSI JOUER SUR L'AXE 'avoir des meilleurs notes' et les conseils personnels comme 'perso j'utilise micabo pour préparer mes examens'$b$),
    $a$Ai-je écrit "micabo.app" en minuscules partout, avec le ".app", sans surnom ni "plateforme" ?$a$,
    $b$Ai-je écrit "micabo" en minuscules partout, le nom seul, sans extension de domaine, sans surnom, sans "site" ni "app" ni "plateforme" devant ?$b$)
where cle = 'placement_micabo';

-- Les exemples restants (sections 6 et 13) : la règle générale suffit.
update public.prompts
set contenu = public.micabo_reecrire_cta(contenu)
where cle = 'placement_micabo';

-- 2b. Pertinence — ce que le modèle croit noter.
update public.prompts set contenu = replace(contenu,
  $a$micabo est une application et un site d'éducation IA pour les étudiants$a$,
  $b$micabo est une application mobile d'éducation IA pour les étudiants$b$)
where cle = 'pertinence_micabo';

-- 2c. Traduction turque — la consigne disait exactement l'inverse de la
--     nouvelle règle : elle imposait « sitesi » et interdisait « uygulama ».
update public.prompts set contenu = replace(contenu,
  $a$- micabo.app est un SITE web. Le spectateur doit comprendre qu'il ouvre un site, pas l'App Store.
- Formules : « micabo.app sitesi », « micabo.app sitesiyle », « micabo.app sitesini », « micabo.app sitesine ».
- INTERDIT : uygulama, indir, App Store, « micabo.app ile » sans « sitesi », « site micabo.app » (le mot site AVANT le nom).$a$,
  $b$- micabo est une APPLICATION MOBILE. Écris le nom SEUL, en minuscules : « micabo ».
- Le cas grammatical s'accole au nom par une apostrophe : micabo'yu, micabo'ya, micabo'da, micabo'dan, ou « micabo ile ».
- INTERDIT : « micabo.app », le mot « site » / « sitesi » sous toutes ses formes, « micabo uygulaması » (le nom seul suffit), et « indir / App Store » en formule publicitaire.$b$)
where cle = 'traduction_tr';

-- ---------------------------------------------------------------------------
-- 3. Les documents
-- ---------------------------------------------------------------------------
-- Seules les phrases qui décrivent le produit bougent. Les adresses e-mail en
-- @micabo.app et les liens (OS, Slack) sont l'infrastructure, pas la marque.

update public.documents set contenu = replace(contenu,
  $a$Tu aides à promouvoir micabo.app, un site de flashcards : on y dépose ses cours, ses notes ou un PDF, et micabo.app génère les flashcards pour réviser$a$,
  $b$Tu aides à promouvoir micabo, une application mobile de flashcards : on y dépose ses cours, ses notes ou un PDF, et micabo génère les flashcards pour réviser$b$)
where titre = 'Guide du créateur';

update public.documents set contenu =
  replace(
  replace(contenu,
    $a$Micabo.app HMs — Onboarding$a$,
    $b$Micabo HMs — Onboarding$b$),
    $a$Tu aides à promouvoir <b>Micabo.app , un site pour t'aider à réviser plus efficacement.</b>$a$,
    $b$Tu aides à promouvoir <b>micabo, une application mobile pour t'aider à réviser plus efficacement.</b>$b$)
where titre = 'Guide du manager';

-- ---------------------------------------------------------------------------
-- 4. Le texte déjà écrit
-- ---------------------------------------------------------------------------

-- 4a. Decks SOURCE (33 : fr et en) — le texte de référence, celui que l'admin
--     relit dans la file. Il est réécrit sur place.
update public.contenu_langues cl
set slides = (
  select coalesce(
    jsonb_agg(
      case
        when e->>'texte_overlay' is not null
        then jsonb_set(e, '{texte_overlay}',
               to_jsonb(public.micabo_reecrire_cta(e->>'texte_overlay')))
        else e
      end
      order by ord),
    '[]'::jsonb)
  from jsonb_array_elements(cl.slides) with ordinality as t(e, ord))
from public.contenus c
where c.id = cl.contenu_id
  and cl.langue = c.langue_source
  and cl.slides::text ilike '%micabo.app%';

-- 4b. Decks TRADUITS (176) — vidés, pas réécrits. Ils traduisent un texte
--     source qui vient de changer : les réécrire les laisserait vrais sur la
--     marque et faux sur le reste. `assurerDeckPourLangue` les refait à la
--     prochaine assignation, avec le nouveau prompt — et ne coûte rien pour
--     les slideshows que l'admin rejettera d'ici là.
update public.contenu_langues cl
set slides = '[]'::jsonb
from public.contenus c
where c.id = cl.contenu_id
  and cl.langue <> c.langue_source
  and cl.slides::text ilike '%micabo.app%';

-- 4c. Posts ASSIGNÉS (60 slides) — déjà chez les créateurs, prévus aujourd'hui
--     ou en retard. Réécrits sur décision explicite.
--     Les 172 posts PUBLIÉS ne sont pas touchés : ils sont en ligne, les
--     réécrire ferait mentir l'historique.
update public.post_slides ps
set texte_overlay = public.micabo_reecrire_cta(ps.texte_overlay)
from public.posts p
where p.id = ps.post_id
  and p.statut = 'assigne'
  and ps.texte_overlay ilike '%micabo.app%';

-- Deux phrases appellent micabo « le site » une SECONDE fois, loin du nom :
-- aucune règle générale ne peut les voir. À la main, et seulement elles.
update public.post_slides ps
set texte_overlay = replace(ps.texte_overlay,
  'Es el sitio perfecto para prepararte',
  'Es la app perfecta para prepararte')
from public.posts p
where p.id = ps.post_id and p.statut = 'assigne'
  and ps.texte_overlay like '%Es el sitio perfecto para prepararte%';

update public.post_slides ps
set texte_overlay = replace(ps.texte_overlay,
  'site sana çalışma planı hazırlıyor',
  'micabo sana çalışma planı hazırlıyor')
from public.posts p
where p.id = ps.post_id and p.statut = 'assigne'
  and ps.texte_overlay like '%site sana çalışma planı hazırlıyor%';

-- 4d. Passages ASSIGNÉS — la copie gelée de ce qui a été envoyé. Sans ça, le
--     relevé de l'OS contredirait la page du créateur.
update public.passages pa
set slides = (
  select coalesce(
    jsonb_agg(
      case
        when e->>'texte_overlay' is not null
        then jsonb_set(e, '{texte_overlay}',
               to_jsonb(public.micabo_reecrire_cta(e->>'texte_overlay')))
        else e
      end
      order by ord),
    '[]'::jsonb)
  from jsonb_array_elements(pa.slides) with ordinality as t(e, ord))
where pa.statut = 'assigne'
  and pa.slides::text ilike '%micabo.app%';

drop function public.micabo_reecrire_cta(text);
