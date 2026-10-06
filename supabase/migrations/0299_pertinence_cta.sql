-- 0299 — La pertinence d'import notée sur la place du CTA, pas sur le sujet
-- (02/10/2026, demande d'Adrien).
--
-- Mesuré sur 141 slideshows passés au moins deux fois chez nous : la note de
-- pertinence était corrélée À L'ENVERS avec nos vues (Spearman −0,30). Sous 30
-- de pertinence : 3 497 vues de médiane, à 60 et plus : 1 444. Les faits de
-- médecine et le classement des spécialités (luna.study4), nos meilleurs posts,
-- étaient notés 0 à 5 parce qu'ils ne parlent pas de méthode de révision — ils
-- ne sont entrés que par leurs vues d'origine, et leurs petits frères étaient
-- rejetés à l'import (`elo_insuffisant`).
--
-- Le nouveau prompt note UNE question : peut-on remplacer une slide par une
-- recommandation naturelle de micabo, devant un public d'élèves ou d'étudiants ?
-- Le sujet ne compte plus, le public et la place du CTA si.
--
-- Vérifié à blanc par `essai-pertinence` (lecture seule) avant la bascule :
-- - 140 slideshows importés : corrélation avec nos vues de −0,29 à +0,10 ;
-- - 35 slideshows rejetés : charisme, citations, éloquence, pubs Peech restent
--   entre 0 et 20, les slideshows médecine de luna.study4 passent de 0–10 à
--   85–90.
-- Le nouveau prompt note large (82,7 de moyenne sur les importés contre 52,1) :
-- la note d'import repose donc davantage sur les vues d'origine.
--
-- Le POIDS n'est pas touché (30 % pertinence, 70 % vues, `reglages.scoring`).
-- Simulé sur 312 imports : passer à 15 % ferait entrer 11 slideshows de plus,
-- mais ferait monter les entrées en A de 44 à 77, surtout des sources entre
-- 80 000 et 200 000 vues, qui ne font pas mieux que les petites chez nous.
--
-- `pertinence_micabo_v1_2026_10_02` garde l'ancien prompt : le retour se fait en
-- le recopiant. `pertinence_micabo_v2` reste comme référence de l'essai.
-- Appliquée par `execute_sql` (piège du MCP, 0297).

insert into public.prompts (cle, contenu)
select 'pertinence_micabo_v1_2026_10_02', contenu from public.prompts where cle = 'pertinence_micabo'
on conflict (cle) do nothing;

-- Le texte de `pertinence_micabo_v2` est celui inséré le 02/10 (voir AGENTS,
-- « Pertinence d'import »). Il est recopié sur la clé lue par l'import :
update public.prompts p set contenu = v2.contenu, updated_at = now()
from public.prompts v2 where v2.cle = 'pertinence_micabo_v2' and p.cle = 'pertinence_micabo';
