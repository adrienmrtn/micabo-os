-- « micabo » ne se dit plus nu : on précise toujours l'appli.
--
-- Quatrième passage sur ce texte (0260 → 0261 → 0263 → ici). Les trois premiers
-- ont perdu de l'information à chaque fois, parce qu'une réécriture FUSIONNE des
-- formes distinctes : « le site micabo.app » et « micabo.app » nu donnaient tous
-- deux « micabo », et le retour ne pouvait être qu'une reconstruction. D'où deux
-- précautions ici : la règle vit dans une FONCTION (donc rejouable à l'identique
-- sur du texte neuf, et lisible par le prochain qui passera), et l'état d'avant
-- est rangé dans `micabo_marque_sauvegarde` sous une étiquette.
--
-- Le vrai piège est le TURC. C'est une langue agglutinante : le cas se colle au
-- nom par une apostrophe (micabo'yu, micabo'ya, micabo'da, micabo'dan). En
-- insérant « uygulaması » (izafet : « l'application de micabo »), le suffixe de
-- cas DOIT migrer sur le possessif, sinon la phrase est fausse :
--
--   micabo'ya yükle   →  micabo uygulamasına yükle    (datif)
--   micabo'yu kullan  →  micabo uygulamasını kullan   (accusatif)
--   micabo'da test    →  micabo uygulamasında test    (locatif)
--   micabo'dan yardım →  micabo uygulamasından yardım (ablatif)
--
-- Un simple remplacement de « micabo » par « micabo uygulaması » produirait
-- « micabo uygulaması'yu », qui n'existe pas. Les formes suffixées sont donc
-- traitées AVANT la forme nue, et la forme nue devant un verbe « kullan- »
-- prend l'accusatif, sinon l'objet défini reste bancal.
create or replace function public.micabo_avec_article(texte text, langue text)
returns text
language sql
immutable
as $$
  select case
    when texte is null or texte !~ '[Mm][Ii][Cc][Aa][Bb][Oo]' then texte

    -- Déjà qualifié dans la slide : ne rien doubler.
    when langue = 'tr' and texte ~* 'uygulama'                    then texte
    when langue = 'fr' and texte ~* '\mapp(li|lication)?\M'       then texte
    when langue = 'es' and texte ~* '\m(app|aplicaci[oó]n)\M'     then texte
    when langue = 'en' and texte ~* '\mapps?\M'                   then texte

    when langue = 'fr' then
      regexp_replace(texte, '[Mm][Ii][Cc][Aa][Bb][Oo]', 'l''appli micabo', 'g')

    when langue = 'es' then
      regexp_replace(texte, '[Mm][Ii][Cc][Aa][Bb][Oo]', 'la app micabo', 'g')

    when langue = 'en' then
      -- En tête de ligne ou d'item numéroté, l'article alourdit un titre :
      -- « 4. MICABO (AI Tool) » devient « 4. micabo app », pas « 4. the micabo app ».
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
        -- Objet défini d'un « kullan- » : accusatif obligatoire. Le garde
        -- `(?!\s*uygulama)` est indispensable : sans lui, cette règle refire sur
        -- le résultat des règles de suffixe ci-dessus et produit
        -- « micabo uygulamasını uygulamasını kullan ».
        '[Mm][Ii][Cc][Aa][Bb][Oo](?![''’]|\s*uygulama)(?=(\s+\S+){0,2}\s+kullan)', 'micabo uygulamasını', 'g'),
        '[Mm][Ii][Cc][Aa][Bb][Oo](?![''’]|\s*uygulama)', 'micabo uygulaması', 'g')

    else texte
  end;
$$;

comment on function public.micabo_avec_article(text, text) is
  'Reecrit « micabo » nu en « l''appli micabo » (et equivalents par langue). '
  'Saute les textes qui qualifient deja la marque. Le turc migre le suffixe de '
  'cas sur le possessif : micabo''ya -> micabo uygulamasina.';
