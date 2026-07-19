# Sophia's Creative Studio — Brief de reconstruction (v2)

## 1. Contexte

Reconstruction complète, en code natif (pas de builder no-code), de la plateforme
existante "Sophia's Creative Studio" : un outil de gestion de contenu pour
créateurs TikTok. Objectifs de cette v2 :

- **Fiabilité** : gestion d'erreurs, retries, logs, monitoring — pas de "ça marche
  sur mon poste"
- **Intégration API officielle TikTok** (OAuth par créateur), au lieu de flux
  manuels/approximatifs
- **Architecture propre** : séparation claire back/front, schéma de données
  normalisé, tests

## 2. Rôles utilisateurs

### Admin
- Consulte, valide ou rejette les contenus soumis par les créateurs
- Note/évalue les créateurs (système de rating)
- Envoie des messages ciblés ou en broadcast (pop-ups) aux créateurs
- Accès aux statistiques agrégées (performance par créateur, taux de validation)

### Créateur
- Onboarding avec vidéo d'introduction au premier login
- Connecte son propre compte TikTok (OAuth officiel)
- Soumet du contenu (texte + visuels) pour validation
- Reçoit messages/notifications de l'admin
- Consulte son historique de soumissions et son rating

## 3. Fonctionnalités cœur

1. **Auth & onboarding** — comptes admin/créateur, vidéo d'intro au premier login
2. **Soumission de contenu** — formulaire créateur (texte, images, lien TikTok)
3. **File de validation admin** — vue liste/kanban des soumissions en attente,
   actions valider/rejeter/commenter
4. **Messagerie** — 1:1 admin↔créateur + annonces broadcast/ciblées (pop-up à la
   connexion)
5. **Rating** — admin note chaque créateur sur des critères définis
   (qualité, régularité, réactivité), historique des notes
6. **Intégration TikTok réelle** (détails section 4)
7. **i18n** — FR/EN, détection langue + sélecteur manuel
8. **Notifications** — in-app (et email en option) pour nouveaux messages,
   validations, annonces

## 4. Intégration API TikTok — spécifications

**Principe** : chaque créateur autorise l'app via OAuth sur *son propre* compte.
Aucun scraping, aucun accès à du contenu tiers — c'est la seule approche que
TikTok autorise pour la publication/lecture programmatique, et la seule qui
tient dans la durée (les contournements se font bannir).

- **Produits TikTok for Developers à activer** : Login Kit + Content Posting API
  (+ Display API si besoin de stats en lecture seule)
- **OAuth 2.0** : flow standard authorization code, un token par créateur,
  refresh token à gérer (les access tokens expirent en 24h — prévoir le
  refresh dans le pipeline, pas seulement au login)
- **Publication** : `POST /v2/post/publish/video/init/` — deux modes possibles :
  - *Direct Post* : publication immédiate sur le profil du créateur
  - *Upload to Inbox* : envoi dans l'inbox TikTok du créateur pour validation
    manuelle avant publication (recommandé pour garder le créateur dans la boucle)
- **Champs obligatoires** : `privacy_level` sur chaque publication (pas de
  valeur par défaut), toggles de disclosure pour le contenu sponsorisé/branded
  content si applicable, contrôles duet/stitch/commentaires exposés dans l'UI
- **Limites à anticiper** : quotas de publication par jour/par créateur fixés
  par TikTok à l'audit (pas de chiffre universel), max ~5 comptes en mode
  sandbox tant que l'app n'est pas validée
- **Process d'audit** : compter 2 à 6 semaines de review TikTok ; dossier à
  préparer en amont : URL de politique de confidentialité, vidéo de démo du
  flow OAuth + publication complet, description précise de l'usage des données
- **Mode sandbox** : utilisable pendant l'attente d'audit (posts en `SELF_ONLY`,
  5 comptes autorisables/24h) — prévoir de développer et tester dessus avant la
  validation officielle

## 5. Modèle de données (suggestion — Postgres/Supabase)

```
users            (id, email, role[admin|creator], locale, created_at)
creators         (user_id, display_name, tiktok_account_id, oauth_token_ref,
                  onboarding_completed_at, current_rating)
submissions      (id, creator_id, status[pending|approved|rejected], text,
                  media_urls[], tiktok_post_url, created_at, reviewed_by,
                  reviewed_at, admin_comment)
ratings          (id, creator_id, admin_id, score, criteria_json, created_at)
messages         (id, sender_id, recipient_id, body, attachments[], read_at,
                  created_at)
announcements    (id, admin_id, audience[all|targeted], target_creator_ids[],
                  body, active_from, active_until)
tiktok_tokens    (creator_id, access_token_enc, refresh_token_enc, expires_at)
```

Chiffrer les tokens TikTok au repos (`_enc`). RLS Supabase strict : un créateur
ne voit que ses propres lignes, l'admin voit tout.

## 6. Stack recommandée

- **Frontend** : React + TypeScript, Vite (ou Next.js si SSR/SEO nécessaire),
  Tailwind + shadcn/ui
- **Backend/DB** : Supabase (Postgres + Auth + Storage + RLS) — cohérent avec
  l'existant, migration plus simple
- **i18n** : `react-i18next` ou équivalent léger, fichiers `locales/fr.ts` /
  `locales/en.ts`
- **Jobs/retries** : file d'attente légère (ex. Supabase Edge Functions +
  cron) pour les refresh de tokens et les publications différées
- **Monitoring** : Sentry (ou équivalent) pour les erreurs front/back dès le
  départ, pas en rustine plus tard

## 7. Exigences non-fonctionnelles

- Toute action externe (TikTok API, envoi email) doit avoir un retry avec
  backoff + logging structuré de l'échec
- Tests automatisés au minimum sur : flow OAuth, validation de soumission,
  permissions RLS
- Variables sensibles (client secret TikTok, clés Supabase) uniquement
  côté serveur, jamais exposées au client

## 8. Feuille de route suggérée pour Claude Code

1. **Scaffolding** — projet + auth (admin/créateur) + schéma DB de base
2. **Cœur métier** — soumission de contenu + file de validation admin
3. **Messagerie & rating** — 1:1, annonces broadcast, système de notation
4. **Intégration TikTok** — OAuth, sandbox, publication (à développer en
   parallèle de la demande d'audit TikTok, qui prend plusieurs semaines)
5. **i18n, notifications, polish** — traductions, emails, monitoring
6. **Déploiement**

## 9. Astuce pratique

Si le projet Lovable actuel est connecté à un repo GitHub, exporte/clone-le et
donne-le en référence à Claude Code (`"voici l'ancienne version, inspire-toi de
la structure mais corrige X, Y, Z"`) plutôt que de reconstruire uniquement à
partir de ce brief — Claude Code pourra comparer directement l'ancien code et
éviter de recréer les mêmes limitations.

## 10. Prompt de démarrage (à coller dans Claude Code)

```
Je veux reconstruire une plateforme de gestion de contenu créateurs TikTok
("Sophia's Creative Studio v2") en repartant de zéro, en code propre et testé.
Voici le brief complet : [coller ce fichier].

Commence par le scaffolding : projet React + TypeScript + Vite, Supabase
(auth, DB, RLS), Tailwind + shadcn/ui, structure de dossiers claire
(features/ ou modules/ plutôt que tout dans lib/). Mets en place le schéma
de données de la section 5 en migrations Supabase. Ensuite on avancera
phase par phase selon la section 8.
```
