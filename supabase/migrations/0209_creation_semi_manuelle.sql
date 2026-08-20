-- Création semi-manuelle : style/prompt/feed par label + origine des slideshows.

alter table public.labels
  add column if not exists style_theme text,
  add column if not exists prompt_creation text,
  add column if not exists exemples_feed jsonb not null default '[]'::jsonb;

comment on column public.labels.style_theme is
  'Thème / style du label, rédigé par l’admin (création semi-manuelle).';
comment on column public.labels.prompt_creation is
  'Prompt dédié pour rédiger les slides de ce label.';
comment on column public.labels.exemples_feed is
  'Exemples de textes déjà rédigés (feed few-shot) — tableau JSON de chaînes.';

alter table public.contenus
  add column if not exists creation_mode text not null default 'import',
  add column if not exists hook_contenu_id uuid references public.contenus (id) on delete set null;

alter table public.contenus
  drop constraint if exists contenus_creation_mode_check;

alter table public.contenus
  add constraint contenus_creation_mode_check
  check (creation_mode in ('import', 'manuel'));

comment on column public.contenus.creation_mode is
  'import = pipeline TikTok ; manuel = création semi-manuelle admin.';
comment on column public.contenus.hook_contenu_id is
  'Slideshow d’origine du hook (musique reprise).';

create index if not exists contenus_creation_mode_idx
  on public.contenus (creation_mode, created_at desc);

alter table public.passages
  add column if not exists visuels_resolution jsonb;

comment on column public.passages.visuels_resolution is
  'Logs de résolution d’images (critère caption / fallback aléatoire) à l’assignation.';

insert into public.prompts (cle, contenu)
values (
  'creation_semi_manuelle',
  $p$Tu rédiges des slides TikTok pour un label (niche) donné.

Règles :
- Slide 1 = le hook, déjà fixé : ne le réécris pas, ne le traduis pas.
- Chaque slide suivante = UN conseil, phrase courte, punchy, lisible au pouce.
- Pas de tiret long. Pas de vocabulaire marketing creux. Pas d'emoji ajouté.
- Voix du label (style + exemples fournis). Langue = celle du hook.
- Pour chaque slide 2..N, donne un critère d'image : 2 à 5 mots-clés (sujet + ton visuel), en anglais, ex. "coffee dark tones".

Réponds UNIQUEMENT en JSON valide, sans markdown :
{"slides":[{"position":2,"texte":"...","critere":"coffee dark tones"}]}
$p$
)
on conflict (cle) do nothing;

notify pgrst, 'reload schema';
