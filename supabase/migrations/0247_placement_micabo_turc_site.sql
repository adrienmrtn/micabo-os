-- Placement turc : micabo.app est un site (jamais une appli / App Store).
-- Le moteur lit ce prompt en base ; pas de cron à relancer.

update public.prompts
set
  contenu = contenu || $t$

16. TURC — micabo.app EST UN SITE (règle absolue)

Si la LANGUE DE SORTIE est le turc :
- micabo.app est un SITE web. Le spectateur doit comprendre qu'il ouvre un site, pas l'App Store.
- Formules : « micabo.app sitesi », « micabo.app sitesiyle », « micabo.app sitesini », « micabo.app sitesine ».
- INTERDIT : uygulama, indir, App Store, « micabo.app ile » sans « sitesi », « site micabo.app » (le mot site AVANT le nom).
$t$,
  updated_at = now()
where cle = 'placement_micabo'
  and contenu not like '%16. TURC — micabo.app EST UN SITE%';
