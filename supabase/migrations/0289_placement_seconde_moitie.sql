-- 0289 — Placement micabo : PeECH concurrent, forme allemande reprise, prompt v2
-- posé pour l'essai à blanc (01/10/2026).
--
-- Décisions d'Adrien sur le doc « Placement micabo : réflexion et propositions » :
-- seconde moitié du deck, une mention par deck, PeECH concurrent, les 7 slides
-- « Die App micabo » reprises, le stock déjà placé n'est PAS replacé (seuls les
-- prochains decks passent par les nouvelles règles).
--
-- Le moteur (placement.ts, gemini.ts, import_contenu.ts) porte le reste ; cette
-- migration ne fait que trois choses :
--
-- 1. PeECH entre dans `concurrents`. C'est l'appli audio que des comptes
--    sources plaçaient dans leurs propres slideshows (« change tes notes en
--    audio avec PeECH ») : 22 decks validés au 01/10 (13 en, 8 fr, 1 de). Elle
--    n'était dans aucune liste, donc sa slide partait telle quelle, et micabo
--    était placé ailleurs. Au prochain passage d'un de ces decks, `sansConcurrents`
--    la juge : un deck déjà placé la récrit sans marque (une mention par deck),
--    un deck neuf la fait devenir micabo, et c'est alors elle le placement.
--
-- 2. La forme allemande, encore. 0278 avait remis les decks à l'endroit le
--    29/09 ; 11 decks, 2 passages et 2 post_slides non publiés portaient de
--    nouveau « die App micabo », « die appli micabo » ou « die Anwendung
--    micabo ». Tous des PLACEMENTS : `placerSophiaSurDeck` écrivait la variante
--    du modèle sans la passer par `nettoyerTexteDeck`. Le moteur est corrigé
--    (même famille que 0268 : une règle qui ne vit que sur un chemin ne protège
--    que ce chemin) ; ici on reprend le stock avec `micabo_ordre_de_slides`
--    (0278), sauvegarde d'abord. Les publiés ne sont pas touchés.
--
-- 3. Le prompt v2 est posé sous `placement_micabo_v2`, une clé que le moteur NE
--    LIT PAS. Il sert à l'essai à blanc (`essai-placement`), ancien et nouveau
--    prompt sur les mêmes decks, jugés à l'aveugle. La bascule de
--    `placement_micabo` se fait après le verdict, à part.
--
-- Aucun `delete`, aucun `drop` (piège du MCP, voir 0287).

-- ---------------------------------------------------------------------------
-- 1. PeECH
-- ---------------------------------------------------------------------------

insert into public.concurrents (nom, motif, note) values
  ('PeECH', '\mpeech\M', 'appli audio placée par des comptes sources (0289)')
on conflict (nom) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Forme allemande — sauvegarde puis réécriture (non publiés seulement)
-- ---------------------------------------------------------------------------

insert into public.micabo_marque_sauvegarde (etiquette, surface, ligne_id, colonne, valeur)
select 'avant_placement_0289_2026_10_01', 'contenu_langues', cl.id::text, 'slides', cl.slides::text
  from public.contenu_langues cl
 where cl.langue = 'de'
   and public.micabo_ordre_de_slides(cl.slides) is distinct from cl.slides;

insert into public.micabo_marque_sauvegarde (etiquette, surface, ligne_id, colonne, valeur)
select 'avant_placement_0289_2026_10_01', 'passages', p.id::text, 'slides', p.slides::text
  from public.passages p
 where p.langue = 'de'
   and p.statut <> 'publie'
   and public.micabo_ordre_de_slides(p.slides) is distinct from p.slides;

insert into public.micabo_marque_sauvegarde (etiquette, surface, ligne_id, colonne, valeur)
select 'avant_placement_0289_2026_10_01', 'post_slides', ps.id::text, 'texte_overlay', ps.texte_overlay
  from public.post_slides ps
  join public.passages p on p.post_id = ps.post_id
 where p.langue = 'de'
   and p.statut <> 'publie'
   and public.micabo_ordre_de(ps.texte_overlay) is distinct from ps.texte_overlay;

update public.contenu_langues cl
   set slides = public.micabo_ordre_de_slides(cl.slides)
 where cl.langue = 'de'
   and public.micabo_ordre_de_slides(cl.slides) is distinct from cl.slides;

update public.passages p
   set slides = public.micabo_ordre_de_slides(p.slides)
 where p.langue = 'de'
   and p.statut <> 'publie'
   and public.micabo_ordre_de_slides(p.slides) is distinct from p.slides;

update public.post_slides ps
   set texte_overlay = public.micabo_ordre_de(ps.texte_overlay)
  from public.passages p
 where p.post_id = ps.post_id
   and p.langue = 'de'
   and p.statut <> 'publie'
   and public.micabo_ordre_de(ps.texte_overlay) is distinct from ps.texte_overlay;

-- ---------------------------------------------------------------------------
-- 3. Prompt v2, clé inerte
-- ---------------------------------------------------------------------------

insert into public.prompts (cle, contenu, updated_at)
values ('placement_micabo_v2', $prompt$PLACEMENT DE MICABO DANS UN SLIDESHOW

0. CE QUE TU PRODUIS
Une slide du slideshow, réécrite pour que micabo en fasse partie. Le spectateur ne doit pas se dire « une pub » : il doit se dire « c'est quoi ça ? ». La slide micabo est le meilleur élément de la liste, écrit par la même personne que les autres.
Les exemples ci-dessous sont en français. Tu écris dans la langue du deck, avec les mots qu'y emploie un élève (la fiche, die Karteikarte, los apuntes, özet).
Les exemples entre guillemets montrent une forme : ne les recopie jamais mot pour mot.

1. MICABO : CE QU'UN ÉLÈVE EN FAIT
micabo est une application mobile de révision. Un élève :
- met son cours dedans (ses notes, un PDF) et a ses questions pour se tester ;
- révise 10 minutes par jour, et l'appli lui redemande ce qu'il a raté ;
- donne la date de son exam et la note qu'il vise, et sait quoi réviser chaque jour.
Prends AU PLUS UN de ces gestes, raconté comme un geste ou un résultat. N'écris jamais ce que « fait » l'appli : écris ce que fait l'élève.

2. LIS LE DECK AVANT D'ÉCRIRE
Réponds pour toi à ces quatre questions :
a. La promesse de la couverture : faits fous, conseils toxiques du prof, notes par matière, classement, avant/après, habitudes perso…
b. Le gabarit d'une slide : quelles parties, dans quel ordre. Exemples : numéro + titre court + phrase ; matière + « Ma note » + « Mon conseil » ; « conseil n°X » + citation ; nom + note /10 + avis.
c. Le mode : tu / impératif (instructif) ou je (confession). Mélange sans dominante : instructif.
d. La longueur et la casse : nombre de lignes, minuscules ou non, emojis, ponctuation.

3. CHOISIS LA SLIDE, parmi les positions permises indiquées plus bas (la seconde moitié du deck)
Dans cet ordre :
1. Une slide qui recommande une appli ou un outil pour réviser, qu'il soit concurrent ou non (Wilgo, Quizlet, Anki, une appli audio, Notion ou ChatGPT présentés pour réviser) : c'est la place que le compte d'origine réservait à sa pub. micabo la prend, dans la même forme. Un classement où l'outil n'est qu'un élément noté ne compte pas.
2. Un classement : l'élément le MIEUX noté. Jamais une note basse.
3. Un avant/après ou une révélation : la chute.
4. Une liste de conseils, de faits ou d'habitudes : celle dont le sujet est le plus proche de réviser, retenir, se tester, préparer un exam.
5. Sinon : la dernière position permise.
Si une slide cite DÉJÀ micabo, choisis-la. Ne la réécris que si elle sonne pub.

4. ÉCRIS LA SLIDE
- Le même gabarit que les autres slides, à l'identique : mêmes parties, même ordre, même préfixe, numéro qui suit celui d'avant. Dans un classement, un vrai élément avec son nom, sa note et son avis. Ne recopie jamais le texte d'une autre slide.
- Tiens la promesse de la couverture. « Faits fous » : un fait connu et vérifiable, jamais un chiffre inventé, et micabo en conséquence. « Conseils toxiques » : un conseil qui surprend, jamais dangereux. « Mes notes » : une matière, une note, un conseil.
- Une seule idée : le conseil, c'est micabo. Pas « un conseil, et au passage micabo ».
- Un geste ou un résultat, jamais une fonction (section 1).
- Laisse un trou. Une slide qui donne envie de demander « c'est quoi ? » vaut mieux qu'une slide qui explique.
- Une preuve plutôt qu'un adjectif : un détail vécu, une réaction (« mon prof m'a demandé ce que j'utilisais »). Aucune statistique inventée sur micabo. Un résultat chiffré seulement si le deck en porte déjà un.
- La longueur de la slide remplacée, à 20 % près, et jamais plus longue que la plus longue de ses voisines.
- Même casse, même ponctuation, mêmes emojis que les voisines.

5. LA MARQUE
micabo toujours en minuscules, même en début de phrase, toujours avec son mot de catégorie :
- fr : l'appli micabo (ou l'application micabo)
- en : the micabo app
- es : la app micabo
- de : die micabo-App. Le nom D'ABORD, jamais « die App micabo ».
- tr : micabo uygulaması. Le suffixe de cas va sur uygulaması : micabo uygulamasını, uygulamasına, uygulamasında, uygulamasından, micabo uygulaması ile.
Si la phrase dit déjà « une appli comme micabo », rien de plus. Une seule mention dans la slide. Jamais « site », « plateforme » ni extension de domaine.

6. INTERDIT
- Formules pub : « est top / parfaite / idéale pour ça », « ist super dafür », « tam bunun için », « télécharge », « essaie », « n'attends plus », « révolutionnaire », « au top ».
- Fiche produit : « génère », « crée ton planning », « transforme tes cours », « te permet de », « au bon moment », « personnalisé », « s'adapte ».
- Hype IA. Ne parle d'IA que si le deck en parle déjà, et une fois au plus.
- Les aphorismes « ce n'est pas X, c'est Y ». Les mots abstraits : répétition espacée, active recall, courbe de l'oubli.
- Le tiret long « — » ou « -- », même une fois.
- La culture générale : micabo sert à réviser ses cours, pas à apprendre des faits.

7. TROIS VARIANTES, TROIS FORMES
A. Élément du format : micabo est un item de la liste comme les autres.
B. Preuve perso : un détail ou une réaction vécus.
C. Le trou : la plus courte, celle qui en dit le moins.
Les trois dans le même mode et le même gabarit.

8. CHOISIS LA MEILLEURE
Écarte d'abord celles qui cassent une règle : gabarit, numéro, longueur, marque, interdits. Parmi les autres, garde celle qu'un élève de ce compte aurait vraiment écrite, et qui donne le plus envie de demander « c'est quoi micabo ? ». La plus correcte n'est pas forcément la meilleure.
$prompt$, now())
on conflict (cle) do update set contenu = excluded.contenu, updated_at = now();
