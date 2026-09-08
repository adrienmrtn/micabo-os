# micabo — App Store screenshots

Storyboard ASO (App Store Optimizer) + spec de prod (UI Designer).
5 frames, iPhone 6.7" **1290 × 2796**. FR d’abord (marché listing).

Agents : [App Store Optimizer](https://github.com/msitarzewski/agency-agents/blob/main/marketing/marketing-app-store-optimizer.md) → ordre / copy / conversion. [UI Designer](https://github.com/msitarzewski/agency-agents/blob/main/design/design-ui-designer.md) → frames HTML. [Image Prompt Engineer](https://github.com/msitarzewski/agency-agents/blob/main/design/design-image-prompt-engineer.md) → `prompts.md` si on régénère en photo.

## Listing (ASO)

| Champ | FR | EN | Limite |
|---|---|---|---|
| Titre | `micabo — Flashcards IA` | `micabo — AI Flashcards` | 30 |
| Sous-titre | `Tes cours, 10 min par jour` | `Your notes, 10 min a day` | 30 |
| Mots-clés | `flashcards,révision,notes,PDF,examen,cours,fiches,quiz,réviser` | `flashcards,revision,notes,PDF,exam,study,quiz,cards` | 100 |

Nom affiché : **micabo** (minuscules, jamais un autre produit).

Hook listing (description, 1re ligne) :

> Tes cours, tes notes ou un PDF → des flashcards. Révise 10 minutes par jour.

Interdit dans le listing et sur les frames : culture générale, curiosité, le nom d’un autre produit.

## Décision d’ordre

Funnel store : *valeur en 1 seconde → comment → rituel → preuve → jour J*.

1. **Hero** — promesse (cours → flashcards, 10 min). Première image = conversion.
2. **Import** — comment (notes / PDF). Objection « je dois tout retaper ».
3. **Session** — rituel 10 min. Objection « encore une appli qui prend 2 h ».
4. **Source** — tes cours, pas un quiz générique. Différenciation.
5. **Habitude** — un peu tous les jours, prêt le jour de l’examen.

A/B prioritaire plus tard : frame 1 (headline) et icône. Ne pas toucher l’ordre avant d’avoir un baseline de conversion.

## Frames

Matière UI : **Physiologie — CM3 Synapses**, **Droit constitutionnel — S2**, **Stats S2**. Jamais un sujet hors cours / examen.

### 1 — Hero

| | |
|---|---|
| Rôle | Value prop immédiate |
| Fond | Bleu marque `#2F6BFF` |
| Headline | Tes cours deviennent des flashcards. |
| Sub | Révise 10 minutes par jour. |
| UI | Carte recto, deck Physiologie CM3 |
| Carte | « Qu’est-ce qu’une synapse ? » |
| Pourquoi | Thumbnail store : bénéfice + mot-clé *flashcards* |

### 2 — Import

| | |
|---|---|
| Rôle | Feature cœur |
| Fond | Papier `#F4F7FF` |
| Headline | Dépose tes notes. Ou un PDF. |
| Sub | micabo crée les cartes. |
| UI | Drop cours : PDF / notes / photo |
| Fichier | `CM3 — synapses.pdf` · 24 pages |
| Pourquoi | Montre l’entrée (notes, PDF). CTA = micabo. |

### 3 — Session

| | |
|---|---|
| Rôle | Feature cœur |
| Fond | Bleu marque |
| Headline | 10 minutes. Pas une soirée. |
| Sub | Les cartes qu’il te reste à savoir. |
| UI | Session, verso, Je savais / À revoir, 4/12, 8 min |
| Verso | Définition courte de la synapse chimique |
| Pourquoi | Promesse temps : 10 min, pas une nuit de relecture. |

### 4 — Source

| | |
|---|---|
| Rôle | Feature soutien + différenciation |
| Fond | Papier |
| Headline | Tes cours. Pas un quiz générique. |
| Sub | Chaque carte vient de tes notes. |
| UI | Extrait du CM + carte générée |
| Extrait | « La synapse chimique libère un neurotransmetteur dans la fente synaptique. » |
| Pourquoi | Confiance : c’est *ton* cours. |

### 5 — Habitude

| | |
|---|---|
| Rôle | Feature soutien + jour J |
| Fond | Bleu marque |
| Headline | Un peu tous les jours. |
| Sub | Prêt le jour de l’examen. |
| UI | Avant les partiels : 12 cartes · 10 min · 3 decks |
| Decks | Physiologie 5 · Droit const. 4 · Stats S2 3 |
| Pourquoi | Habitude + examen, sans gamification hors sujet. |

## Tokens UI Designer

| Token | Valeur |
|---|---|
| Primaire | `#2F6BFF` |
| Primaire profond | `#1E4FD6` |
| Papier | `#F4F7FF` |
| Encre | `#0B1220` |
| Muet | `#5B6780` |
| Carte | `#FFFFFF` |
| Ok | `#1F9D6A` |
| Police | Inter 400 / 600 / 700 |
| Logo | `public/micabo-logo.png` (stylo 3D, jamais une lettre) |
| Device | iPhone 15, Dynamic Island, 9:41, fond UI blanc |

Contraste texte / fond ≥ 4.5:1. Cibles tactiles ≥ 44 px dans l’UI mock.

## Localisation (même ordre)

| # | EN headline | EN sub |
|---|---|---|
| 1 | Your notes become flashcards. | Review 10 minutes a day. |
| 2 | Drop your notes. Or a PDF. | micabo writes the cards. |
| 3 | 10 minutes. Not a whole night. | The cards you still need. |
| 4 | Your course. Not a generic quiz. | Every card comes from your notes. |
| 5 | A little every day. | Ready on exam day. |

## Prod

```bash
cd docs/app-store
npm install
npm run render
```

Sortie : `out/01-hero-1290x2796.png` … `out/05-habitude-1290x2796.png`.
Source unique : `frames.html`. Prompts photo : `prompts.md`.
