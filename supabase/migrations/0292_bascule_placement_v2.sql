-- 0292 — Bascule du prompt de placement sur la v2 (01/10/2026).
--
-- Verdict d'Adrien sur l'essai à blanc : « globalement A est un peu mieux que
-- B ». A et B étaient tirés au hasard par deck ; démasqués, ses 9 choix donnent
-- 4 au nouveau, 3 à l'ancien, 2 égalités. Avec les compteurs du passage final
-- (fiche produit 16 → 1, double mention 13 → 0), la v2 passe.
--
-- Son critère, écrit en toutes lettres : « surtout voir sur un post entier :
-- pas de bafouillement (si classement, les chiffres du classement restent),
-- pas d'emmêlement, clarté, sens ». Relu sur les 30 posts entiers, les deux
-- versions cassaient la numérotation (ancien 7 fois, nouveau 5) : ce n'est pas
-- un prompt qui le règle, c'est `choisirVariante` (placement.ts, même commit),
-- qui remet le numéro de la slide remplacée, retire un numéro ajouté, écarte une
-- variante qui recopie le titre d'une voisine ou perd la note d'un classement.
--
-- L'ancien prompt est rangé sous `placement_micabo_v1_2026_10_01` : le retour
-- se fait en le recopiant. Seuls les prochains decks sont placés avec la v2
-- (décision d'Adrien : le stock n'est pas replacé).

insert into public.prompts (cle, contenu, updated_at)
select 'placement_micabo_v1_2026_10_01', contenu, now()
  from public.prompts where cle = 'placement_micabo'
on conflict (cle) do nothing;

update public.prompts p
   set contenu = v2.contenu, updated_at = now()
  from public.prompts v2
 where p.cle = 'placement_micabo' and v2.cle = 'placement_micabo_v2';
