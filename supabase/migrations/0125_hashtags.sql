-- Description/hashtags du slideshow, dans la langue du compte : le poster la
-- copie dans TikTok. Générée à la composition (pas d'appel IA : jeu localisé).
alter table public.posts
  add column if not exists hashtags text;
