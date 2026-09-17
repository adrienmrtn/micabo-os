-- Le tiret long (—) et le demi-cadratin (–) trahissent un texte d'IA. Les règles
-- de traduction les interdisent depuis toujours, mais rien ne les retirait des
-- decks en LANGUE SOURCE, qui ne traversent pas `translateSlideshow` : au
-- 17/09/2026, 10 decks anglais sur 86.
--
-- Miroir de `retirerTiretsLongs` dans `_shared/marque.ts`, qui tient la
-- production courante ; celui-ci sert à reprendre le stock. Les deux doivent
-- rester d'accord.
--
-- Entre deux chiffres c'est un intervalle (« 3–4h ») : trait d'union. Ailleurs
-- c'est une incise : une virgule fait le même travail sans le signal.
create or replace function public.retirer_tirets_longs(texte text)
returns text
language sql
immutable
as $fn$
  select case when texte is null or texte !~ '[—–]' then texte else
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(texte, '(\d)\s*[—–]\s*(\d)', '\1-\2', 'g'),
                          '\s+[—–]\s+', ', ', 'g'),
                          '[—–]', ', ', 'g'),
                          ' ,', ',', 'g'),
                          ',\s*,', ',', 'g')
  end;
$fn$;

comment on function public.retirer_tirets_longs(text) is
  'Retire les tirets cadratins et demi-cadratins (marqueurs de texte IA). Un intervalle chiffre devient un trait d''union, une incise une virgule. Miroir de retirerTiretsLongs dans _shared/marque.ts.';
