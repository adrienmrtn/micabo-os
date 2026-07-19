# Sophia Marketing Orga

Plateforme interne d'industrialisation de slideshows TikTok pour la promotion de
l'app Sophia.

## Rôles

- **Admin** — gère les comptes TikTok de référence, les assignations, les
  utilisateurs, les slideshows et le prompt Sophia.
- **Poster** — reçoit ses slideshows du jour, copie les textes, télécharge les
  visuels et la musique, publie sur TikTok.

Le poster ne voit **jamais** le compte de référence dont provient un slideshow.
Cette règle est appliquée au niveau des données : les vues `poster_slideshows`
et `poster_accounts` n'exposent pas la colonne, et `tiktok_accounts` est
admin-only en RLS.

## Démarrage

```bash
npm install
cp .env.example .env   # renseigner VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev
```

## Base de données

Migrations dans `supabase/migrations/`, appliquées dans l'ordre numérique.

| Table | Rôle |
|---|---|
| `profiles` | profil utilisateur (jamais le rôle) |
| `user_roles` | rôle applicatif, enum `app_role`, lu via `has_role()` |
| `tiktok_accounts` | comptes de référence + pseudo à créer |
| `assignments` | poster ↔ compte (max 4, imposé par trigger) |
| `slideshows` | contenu produit, statut de pipeline, assignation datée |
| `slideshow_frames` | slides, textes extraits et traduits |
| `sophia_variants` | textes pub générés |
| `sophia_corrections` | 40 dernières corrections, réinjectées en few-shot |
| `sophia_prompts` | master prompt éditable |
| `mobile_tokens` | liens de livraison mobile |
| `discovery_runs` | journal des scans Apify |

## Secrets

Les clés d'API vivent dans les **secrets Supabase** (Edge Functions), jamais
dans le `.env` du frontend — tout ce qui est préfixé `VITE_` est exposé au
navigateur.

- `APIFY_TOKEN` — scraping des comptes de référence
- `GEMINI_API_KEY` — nettoyage d'images, OCR, traduction, génération Sophia

## Edge Functions

Déployées sur le projet, dans `supabase/functions/` :

- **`discovery`** — scanne les comptes de référence via Apify, crée les
  slideshows et leurs slides. Priorise les comptes dont le poster n'a rien
  aujourd'hui.
- **`pipeline`** — nettoyage Gemini (+ vérification et retry), OCR, traduction
  FR en tutoiement, génération du texte Sophia, assignation, puis backfill.

Deux appelants autorisés : pg_cron via l'en-tête `x-cron-secret`, ou un admin
depuis l'interface via son JWT (le rôle est revérifié côté serveur). Test :

```bash
curl -X POST "$SUPABASE_URL/functions/v1/discovery" -H "x-cron-secret: $CRON_SECRET"
```

## État

**Fait** — schéma + RLS, auth et rôles, écrans admin (slideshows, comptes,
assignations, utilisateurs, prompts), import manuel, éditeur de slides,
dashboard poster, page de livraison, onboarding poster, Edge Functions
discovery et pipeline déployées et déclenchables depuis l'admin.

**À faire** — activer les crons (`0005_crons.sql.disabled`, volontairement non
appliqué : dépense récurrente), livraison mobile par token (`m/:token`) et
export ZIP, écrans annexes (analytics, messages, calendrier).

## Scripts

- `npm run dev` — serveur de développement
- `npm run build` — typecheck + build de production
- `npm run test` — tests
- `npm run lint` — lint
