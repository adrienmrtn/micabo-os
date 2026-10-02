-- 0298 — Reprise du stock traduit après 0297 (02/10/2026, demande d'Adrien).
--
-- 0297 ne change que les PROCHAINES traductions. Les decks déjà traduits
-- gardaient leurs « brevet », leurs notes sur 20 et leurs Yvan Monka. Ils sont
-- VIDÉS, pas réécrits : changer un examen, une note ou un nom change le sens de
-- la slide, et c'est le cas où le dépôt vide plutôt que réécrire (voir la marque,
-- 0267). `assurerDeckPourLangue` les retraduit à la prochaine assignation, avec
-- les prompts de 0297, puis repasse les concurrents et le placement (v2).
--
-- Sélection : decks traduits (langue ≠ langue source), non vides, de slideshows
-- validés dont le deck SOURCE porte un repère scolaire du pays d'origine
-- (brevet, bac, lycée, collège, prépa, terminale, « les 3èmes », Parcoursup,
-- Pronote, mention, notes sur 20, « j'ai eu 17 », Yvan Monka, Les Bons Profs,
-- spé, majorant · GPA, SAT, A-levels, GCSE, straight A… pour l'anglais ·
-- selectividad, ESO, bachillerato… pour l'espagnol). Le motif trouvé est rangé.
--
-- Résultat du 02/10 : 111 decks sur 48 slideshows — 39 en allemand, 29 en
-- espagnol, 40 en turc, 3 en français (sources anglaises). Les 16 passages déjà
-- assignés qui portent l'ancien texte partent tels quels : ils ont leur propre
-- copie des slides. Les posts publiés ne sont pas touchés.
--
-- Appliquée par `execute_sql`, pas par `apply_migration` (piège du MCP, 0297).
-- Retour arrière : recopier `slides_avant` sur les lignes encore vides.

create table if not exists public.localisation_reprise_0297 (
  contenu_langue_id uuid primary key,
  contenu_id uuid not null,
  langue text not null,
  langue_source text not null,
  motif text,
  slides_avant jsonb not null,
  fait_le timestamptz not null default now()
);
alter table public.localisation_reprise_0297 enable row level security;

with src as (
  select c.id, c.langue_source, string_agg(coalesce(e->>'texte_overlay',''), E'\n') txt
  from contenus c join contenu_langues cl on cl.contenu_id = c.id and cl.langue = c.langue_source, jsonb_array_elements(cl.slides) e
  where c.statut = 'valide'
  group by 1,2
), marque as (
  select s.*,
    case
      when s.langue_source = 'fr' then substring(s.txt from '(?i)(\mbrevet|\mbac\M|baccalaur|lyc[ée]e|lyc[ée]en|coll[èe]ge|pr[ée]pa\M|terminale|(les|en|de|ma|aux) 3 ?[eè](me)?s?\M|parcoursup|pronote|mention (tb|tr[èe]s bien)|/ ?20\M|sur 20|\d{1,2}([,.]\d+)? de moyenne|j.ai eu (un )?\d{1,2}\M|yvan monka|bons profs|\mspé\M|majorant)')
      when s.langue_source = 'en' then substring(s.txt from '(?i)(\mgpa\M|\msat\M|\mact\M|a-?levels?|\mgcse|straight a|\mcbse|\mjee\M|\mneet\M|board exams?|\map (class|exam)|class topper|freshman|sophomore|senior year)')
      when s.langue_source = 'es' then substring(s.txt from '(?i)(selectividad|\mebau\M|\mpau\M|\meso\M|bachiller|sobresaliente|nota media)')
    end as motif
  from src s
)
insert into public.localisation_reprise_0297 (contenu_langue_id, contenu_id, langue, langue_source, motif, slides_avant)
select cl.id, m.id, cl.langue, m.langue_source, m.motif, cl.slides
from marque m join contenu_langues cl on cl.contenu_id = m.id and cl.langue <> m.langue_source
where m.motif is not null
  and exists (select 1 from jsonb_array_elements(cl.slides) e where coalesce(e->>'texte_overlay','') <> '')
on conflict (contenu_langue_id) do nothing;

update public.contenu_langues cl set slides = '[]'::jsonb
from public.localisation_reprise_0297 r
where r.contenu_langue_id = cl.id and cl.slides = r.slides_avant;
