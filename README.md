# micabo OS

OS interne de **micabo** : appli + site d’éducation IA pour étudiants.
Tu déposes tes cours, tes notes ou un PDF → micabo génère les flashcards
et te fait réviser environ **10 minutes par jour**.

Ton : étude, examens, notes, révisions. Jamais de culture générale.
Jamais le nom d’un autre produit dans un CTA.

Cet OS est **greenfield et cloisonné** :

- repo : `adrienmrtn/micabo-os`
- Supabase : `qkmiwnmiwsvwkttldqgb` uniquement
- Vercel : projet `micabo-os`

Aucune donnée, aucun secret, aucun cron, aucun utilisateur d’un autre OS.

## Démarrage local

```bash
npm install
cp .env.example .env   # VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev
```

Les secrets moteur (`GEMINI`, `FAL`, `APIFY`, `CRON_SECRET`, `service_role`)
restent **uniquement** dans les Edge Function Secrets du projet Supabase
`qkmiwnmiwsvwkttldqgb`. Jamais sur Vercel.

## Moteur

Le moteur (schema + Edge Functions + UI) extrait de la matière, la nettoie,
traduit, y place un CTA micabo (flashcards / cours IA), et assigne les posts.

UGC AI VIDEO : **dormant** sur micabo. Ne pas l’allumer.
File Settings / fallback least-used : jamais de label `ugc_ai_video` sur un
créateur slideshow.

Les crons pg_cron ne sont **pas** activés tant qu’un test manuel n’a pas
été validé. Aucun job ne doit pointer hors de
`https://qkmiwnmiwsvwkttldqgb.supabase.co`.

## Auth

Signups publics désactivés. Le premier admin est créé à la main.
Domaine des mails internes : `micabo.app`.
