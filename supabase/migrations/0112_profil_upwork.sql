-- Lien vers la conversation Upwork du poster, pour que l'admin aille checker vite
-- (le lien vers son compte TikTok se déduit du pseudo de son compte de publication).
alter table public.profiles add column if not exists upwork_url text;
