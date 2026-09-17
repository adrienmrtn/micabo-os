-- Un compte micabo faisait la publicité d'un concurrent.
--
-- Le 17/09/2026 : « Hustly Focus » dans 14 slideshows source, 23 decks traduits
-- et 22 passages. Les TikTok d'origine portaient un placement payé pour cette
-- app, et le pipeline les a republiés tels quels — slide entière, argumentée,
-- avec témoignage (« elle m'a conseillé l'app X car ceux sur YouTube ne
-- marchent pas »). Le post vendait donc le concurrent, et la mention micabo
-- arrivait deux slides plus loin, greffée sur un conseil sans rapport.
--
-- Le prompt de traduction l'interdit pourtant depuis toujours (« aucune mention
-- d'un produit tiers »). Mais un deck en LANGUE SOURCE ne traverse pas le
-- traducteur (cf. 0268) : rien ne l'attrapait.
--
-- POURQUOI PAS UN SIMPLE REMPLACEMENT DU NOM. Le texte des slides est découpé en
-- lignes courtes et la mention traverse les retours à la ligne :
--
--   "J'utilise l'appli Hustly\nFocus, ceux sur YouTube\nne servent à rien"
--
-- Le nom effacé, il reste « Focus, ceux sur YouTube ne servent à rien » : une
-- recommandation qui ne dit même plus de quoi. Pire que l'original.
--
-- TROIS PASSES, chacune née d'un cas réel du corpus :
--   1. intra-ligne — une slide tient parfois sur UNE ligne de plusieurs phrases
--      (« Burbuja de concentración… Me recomendó la app X… ») ; y retirer « la
--      ligne » viderait la slide ;
--   2. ligne à ligne, avec repli sans remontée si la slide se viderait — sept
--      slides françaises n'ont aucune ponctuation et la remontée avalait tout ;
--   3. retrait de l'amorce restée en suspens (« … je vous conseille l'app »).
--
-- Miroir de `retirerMentionConcurrent` dans `_shared/marque.ts`, qui tient la
-- production courante ; celui-ci a servi à reprendre le stock. Les deux doivent
-- rester d'accord.
--
-- Les passages DÉJÀ PUBLIÉS ne sont pas touchés : c'est le registre de ce qui
-- est réellement parti sur TikTok. Le réécrire ne changerait rien en ligne et
-- falsifierait la trace.
create or replace function public.retirer_mention_concurrent(texte text, marque text default 'hustly')
returns text language plpgsql immutable as $fn$
declare
  lignes text[]; garder boolean[];
  n int; i int; j int; k int;
  sortie text[]; prec text; res text; phrases text[]; gardees text[]; p text;
  amorce constant text :=
    '((l''|une |la |una |the )?app(li|lication)?s?|uygulama(sını|yla)?|comme)\M[[:space:]]*$';
begin
  if texte is null or texte !~* marque then return texte; end if;
  lignes := string_to_array(texte, E'\n');
  for i in 1..array_length(lignes,1) loop
    if lignes[i] !~* marque then continue; end if;
    phrases := regexp_split_to_array(lignes[i], '(?<=[.!?])[[:space:]]+');
    if array_length(phrases,1) > 1 then
      gardees := '{}';
      foreach p in array phrases loop
        if p !~* marque then gardees := gardees || p; end if;
      end loop;
      lignes[i] := btrim(array_to_string(gardees, ' '));
    end if;
  end loop;
  texte := array_to_string(lignes, E'\n');
  if texte !~* marque then return btrim(texte); end if;

  for tentative in 1..2 loop
    lignes := string_to_array(texte, E'\n'); n := array_length(lignes,1);
    garder := array_fill(true, array[n]);
    for i in 1..n loop
      if lignes[i] !~* marque then continue; end if;
      j := i;
      if tentative = 1 then
        while j > 1 and btrim(lignes[j-1]) <> ''
          and btrim(lignes[j-1]) !~ '[.!?:)»"]$' and btrim(lignes[j-1]) !~ '='
        loop j := j - 1; end loop;
      end if;
      k := i;
      while k < n and btrim(lignes[k]) !~ '[.!?]$' and btrim(lignes[k+1]) <> ''
      loop k := k + 1; end loop;
      for i in j..k loop garder[i] := false; end loop;
    end loop;
    sortie := '{}'; prec := null;
    for i in 1..n loop
      if not garder[i] then continue; end if;
      if btrim(lignes[i]) = '' and prec is not null and btrim(prec) = '' then continue; end if;
      sortie := sortie || lignes[i]; prec := lignes[i];
    end loop;
    res := btrim(array_to_string(sortie, E'\n'));
    exit when btrim(res) <> '';
  end loop;

  while res ~* amorce loop
    res := btrim(regexp_replace(res, '(^|\n)[^\n]*$', ''));
    exit when res = '';
  end loop;
  return res;
end; $fn$;

comment on function public.retirer_mention_concurrent(text, text) is
  'Retire la phrase qui nomme un concurrent, en trois passes : intra-ligne, ligne a ligne avec repli si la slide se vide, puis retrait d une amorce en suspens. Miroir de retirerMentionConcurrent dans _shared/marque.ts.';
