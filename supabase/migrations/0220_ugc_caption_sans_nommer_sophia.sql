-- Garde-fou UGC : interdiction d'un autre produit, sans le nommer.

update public.prompts
set contenu = replace(
      contenu,
      'Ne mentionne JAMAIS Sophia, ni aucun nom de marque interne.',
      'Ne mentionne JAMAIS un autre produit, ni aucun nom de marque interne.'
    ),
    updated_at = now()
where cle = 'ugc_video_caption'
  and contenu like '%Ne mentionne JAMAIS Sophia%';
