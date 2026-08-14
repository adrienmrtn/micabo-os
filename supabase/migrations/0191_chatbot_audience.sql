-- Contexte assistant séparé par rôle : un texte « créateur » n'est pas injecté
-- au HM / admin, et inversement. « all » reste visible des trois.
alter table public.chatbot_contexte
  add column if not exists audience text not null default 'all';

alter table public.chatbot_contexte
  drop constraint if exists chatbot_contexte_audience_check;

alter table public.chatbot_contexte
  add constraint chatbot_contexte_audience_check
  check (audience in ('admin', 'hiring_manager', 'poster', 'all'));
