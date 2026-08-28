-- Prompts live : plus aucun nom de l'autre produit.
-- pertinence : le contraste « culture générale » reste, sans le nommer.
-- traduction : le placement aval est micabo, pas un autre produit.

update public.prompts
set contenu = replace(contenu, 'Le remplacement par Sophia', 'Le remplacement par micabo'),
    updated_at = now()
where contenu like '%Le remplacement par Sophia%';

update public.prompts
set contenu = replace(
  replace(
    contenu,
    '- culture générale Sophia (curiosité, éloquence) SANS angle révision / notes / examens',
    '- culture générale (curiosité, éloquence) SANS angle révision / notes / examens'
  ),
  'Ne note jamais comme si c''était Sophia (culture générale).',
  'Ne note jamais comme une app de culture générale.'
),
    updated_at = now()
where cle = 'pertinence_micabo';
