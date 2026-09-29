-- La forme allemande de la marque était à l'envers (0278, 29/09/2026).
--
-- 0267 a posé la règle « l'appli micabo » : le nom en minuscules, précédé de son
-- mot de catégorie. En allemand la forme documentée est `die micabo-App` — un
-- COMPOSÉ, donc le nom D'ABORD, là où le français, l'espagnol et le turc mettent
-- la catégorie devant (« l'appli micabo », « micabo uygulaması »).
--
-- Un modèle qui traduit « l'appli micabo » mot à mot rend « die App micabo » :
-- correct en français, faux en allemand. Et rien ne l'attrapait, parce que le
-- garde « ne pas doubler la catégorie » **bénit toute forme qui en contient
-- une**, sans jamais regarder l'ordre. Le garde n'était pas trop large : il ne
-- posait aucune question sur ce qu'il laissait passer.
--
-- Mesuré au 29/09 sur `contenu_langues` en `de` : **77 lignes sur 150 en
-- « App/Anwendung/appli micabo »**, 22 de plus en « micabo App » sans trait
-- d'union, **4 correctes**. Trois formes fausses cohabitaient — dont
-- « die appli micabo », le mot FRANÇAIS resté dans la traduction.
--
-- Deux défauts distincts, tous deux fermés ici et dans `_shared/marque.ts` :
--
--  1. l'ORDRE n'était jamais vérifié (ci-dessus) ;
--  2. `Anwendung` ne comptait pas comme mot de catégorie, donc
--     « die Anwendung micabo » passait pour NON qualifié et repartait dans le
--     remplacement final, qui produit « die Anwendung die micabo-App ». Le
--     corpus n'en porte aucun cas, mais rien ne l'empêchait.
--
-- **On ne touche pas à l'article.** « die App micabo » → « die micabo-App »,
-- « der App micabo » → « der micabo-App » : la déclinaison est imposée par la
-- phrase, que ce code ne lit pas. La réécrire casserait le cas grammatical.
--
-- `[ \t]` et non `\s` : vérifié en base, **aucun saut de ligne ne sépare jamais
-- la catégorie du nom**. En tolérer un ferait fusionner deux lignes d'une
-- slide — on corrigerait la marque en cassant la mise en page, qui est le
-- produit.
--
-- Les deux passes ne se remordent pas : la première rend `micabo-App`, avec un
-- trait d'union, que la seconde (espace obligatoire) ne peut plus voir. C'est la
-- leçon de 0262 — « une suite de regexp_replace remord sur sa propre sortie » —
-- réglée ici par la forme de la sortie plutôt que par une sentinelle `chr(1)`,
-- qui n'est pas nécessaire quand la sortie ne rentre dans aucun motif.
--
-- **0278 réécrit au lieu de vider**, comme 0267 : remettre un composé à l'endroit
-- ne change pas le sens du texte, donc payer une retraduction complète
-- n'achèterait rien. Les passages et `post_slides` NON PUBLIÉS sont réécrits ;
-- **les publiés, jamais** — on ne réécrit pas ce qui est en ligne.

-- ---------------------------------------------------------------------------
-- 1. La règle, isolée et testable.
-- ---------------------------------------------------------------------------

create or replace function public.micabo_ordre_de(texte text)
returns text
language sql
immutable
as $$
  select case
    when texte is null or texte !~* 'micabo' then texte
    else regexp_replace(
           regexp_replace(texte,
             '\m(App(likation)?|Anwendung|appli(cation)?)[ \t]+micabo\M', 'micabo-App', 'gi'),
             '\mmicabo[ \t]+(App(likation)?|Anwendung)\M',                'micabo-App', 'gi')
  end;
$$;

comment on function public.micabo_ordre_de(text) is
  'Allemand : remet le nom devant le mot de catégorie et pose le trait d''union (die micabo-App). Ne touche pas à l''article, dont la déclinaison vient de la phrase. Idempotente. Miroir de normaliserOrdreDe dans _shared/marque.ts.';

-- Le deck est un tableau d'objets `{position, texte_overlay, position_sophia}`.
-- On passe champ par champ plutôt que sur `slides::text` : un `regexp_replace`
-- sur le JSON sérialisé ne peut pas distinguer une valeur d'une clé, et il
-- suffirait d'une clé future contenant « micabo » pour corrompre la ligne.
create or replace function public.micabo_ordre_de_slides(slides jsonb)
returns jsonb
language sql
immutable
as $$
  select case
    when slides is null or jsonb_typeof(slides) <> 'array' then slides
    else coalesce((
      select jsonb_agg(
               case when e ? 'texte_overlay' and jsonb_typeof(e->'texte_overlay') = 'string'
                    then jsonb_set(e, '{texte_overlay}',
                           to_jsonb(public.micabo_ordre_de(e->>'texte_overlay')))
                    else e
               end
               order by ord)
        from jsonb_array_elements(slides) with ordinality as t(e, ord)
    ), slides)
  end;
$$;

comment on function public.micabo_ordre_de_slides(jsonb) is
  'Applique micabo_ordre_de au texte_overlay de chaque slide, en conservant l''ordre du tableau.';

-- ---------------------------------------------------------------------------
-- 2. `micabo_avec_article` remise d'accord avec `_shared/marque.ts`.
-- ---------------------------------------------------------------------------

create or replace function public.micabo_avec_article(texte text, langue text)
returns text
language sql
immutable
as $function$
  select case
    when texte is null or texte !~ '[Mm][Ii][Cc][Aa][Bb][Oo]' then texte
    when langue = 'tr' and texte ~* 'uygulama'                    then texte
    when langue = 'fr' and texte ~* '\mapp(li|lication)?\M'       then texte
    when langue = 'es' and texte ~* '\m(app|aplicaci[oó]n)\M'     then texte
    when langue = 'en' and texte ~* '\mapps?\M'                   then texte
    -- 0278 : l'allemand passe d'abord par la remise en ordre, PUIS par le garde.
    -- Sans ça, « die App micabo » sortait intact et « die Anwendung micabo »
    -- repartait dans le remplacement final, qui le doublait.
    when langue = 'de' and public.micabo_ordre_de(texte) ~* '\m(App(likation)?|Anwendung|appli)\M'
      then public.micabo_ordre_de(texte)
    when langue = 'fr' then
      regexp_replace(texte, '[Mm][Ii][Cc][Aa][Bb][Oo]', 'l''appli micabo', 'g')
    when langue = 'es' then
      regexp_replace(texte, '[Mm][Ii][Cc][Aa][Bb][Oo]', 'la app micabo', 'g')
    when langue = 'en' then
      regexp_replace(
        regexp_replace(texte,
          '(^|\n)(\s*\d+[\.\)]\s*)?[Mm][Ii][Cc][Aa][Bb][Oo]', '\1\2micabo app', 'g'),
        '[Mm][Ii][Cc][Aa][Bb][Oo](?! app)', 'the micabo app', 'g')
    when langue = 'de' then
      regexp_replace(texte, '[Mm][Ii][Cc][Aa][Bb][Oo]', 'die micabo-App', 'g')
    when langue = 'tr' then
      regexp_replace(
      regexp_replace(
      regexp_replace(
      regexp_replace(
      regexp_replace(
      regexp_replace(texte,
        '[Mm]icabo[''’]ya',  'micabo uygulamasına',  'g'),
        '[Mm]icabo[''’]yu',  'micabo uygulamasını',  'g'),
        '[Mm]icabo[''’]dan', 'micabo uygulamasından','g'),
        '[Mm]icabo[''’]da',  'micabo uygulamasında', 'g'),
        '[Mm][Ii][Cc][Aa][Bb][Oo](?![''’]|\s*uygulama)(?=(\s+\S+){0,2}\s+kullan)', 'micabo uygulamasını', 'g'),
        '[Mm][Ii][Cc][Aa][Bb][Oo](?![''’]|\s*uygulama)', 'micabo uygulaması', 'g')
    else texte
  end;
$function$;

-- ---------------------------------------------------------------------------
-- 3. Sauvegarder AVANT de réécrire (leçon de 0262).
--
-- La réécriture fusionne trois formes en une — « die App micabo », « die
-- Anwendung micabo » et « micabo App » donnent tous « micabo-App » — donc
-- l'inverse ne pourrait être qu'une reconstruction, jamais une restitution.
-- Avec la sauvegarde, le retour se fait en relisant la valeur d'avant.
-- ---------------------------------------------------------------------------

insert into public.micabo_marque_sauvegarde (etiquette, surface, ligne_id, colonne, valeur)
select 'avant_micabo_app_de_2026_09_29', 'contenu_langues', cl.id::text, 'slides', cl.slides::text
  from public.contenu_langues cl
 where cl.langue = 'de'
   and public.micabo_ordre_de_slides(cl.slides) is distinct from cl.slides;

insert into public.micabo_marque_sauvegarde (etiquette, surface, ligne_id, colonne, valeur)
select 'avant_micabo_app_de_2026_09_29', 'passages', p.id::text, 'slides', p.slides::text
  from public.passages p
 where p.langue = 'de'
   and p.statut <> 'publie'
   and public.micabo_ordre_de_slides(p.slides) is distinct from p.slides;

insert into public.micabo_marque_sauvegarde (etiquette, surface, ligne_id, colonne, valeur)
select 'avant_micabo_app_de_2026_09_29', 'post_slides', ps.id::text, 'texte_overlay', ps.texte_overlay
  from public.post_slides ps
  join public.passages p on p.post_id = ps.post_id
 where p.langue = 'de'
   and p.statut <> 'publie'
   and public.micabo_ordre_de(ps.texte_overlay) is distinct from ps.texte_overlay;

-- ---------------------------------------------------------------------------
-- 4. Réécrire — decks, et passages / post_slides NON PUBLIÉS seulement.
-- ---------------------------------------------------------------------------

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

notify pgrst, 'reload schema';
