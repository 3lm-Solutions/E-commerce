# Évaluation de la qualité de l'IA

Vérifie que les fonctionnalités IA sont fiables, pas seulement qu'elles répondent :
des cas réalistes et des pièges, vérifiés automatiquement, avec le temps de réponse.

Le code de production est utilisé tel quel (prompts, analyse des réponses) ; seul le
modèle change. Groq et Gemini sont appelés par leur API compatible OpenAI.

| Fonctionnalité | Cas | Code testé | Vérifications |
|---|---|---|---|
| Chatbot | `cases/chatbot.json` (20) | prompt de production (`src/services/chatbotPrompt.js`, identique au Python), catalogue réel, politique de livraison | produits et prix exacts (aucun montant hors catalogue), comparaisons, français, refus hors sujet, produit inexistant, injection, longueur |
| Recherche NLP | `cases/nlp.json` (18) + 2 tests de robustesse | `nlpFilterService` + `searchService` | JSON valide, catégorie existante, prix extraits, pertinence des résultats, requête vague, repli vers la recherche classique si l'IA ne répond pas, requête vide |
| Résumé d'avis | `cases/reviews.json` (15) | `reviewSummaryService.generateReviewSummary` (avis contrôlés) | fidélité aux avis, 0 ou 1 avis, injection dans un avis, avis en anglais, cohérence avec la note |
| Description produit | `cases/descriptions.json` (15) | prompt Python de production (`description_prompt.py`) | français, 2-3 phrases, nom du produit, aucune caractéristique inventée |
| Recommandations | produits de la base | `similarityService`, `recommendationService`, `trendingService` | cohérence (sans IA) |

## Lancer

Prérequis : base locale avec le catalogue (`npm run db:reset`), `chatbot-ia/backend/venv`,
et dans `.env` : `GROQ_API_KEY` (et `GEMINI_API_KEY` pour Gemini).

```bash
node scripts/ai-eval/run.js --provider groq --repeat 3
node scripts/ai-eval/run.js --provider gemini --model gemini-2.5-flash --repeat 3
node scripts/ai-eval/run.js --provider groq --only chatbot,nlp
```

- `--model` : modèle à tester (défaut : `GROQ_MODEL`, ou `GEMINI_MODEL` / `gemini-2.5-flash`).
- `--repeat N` : chaque cas qui appelle l'IA est joué N fois (les réponses varient d'un appel à l'autre) ;
  un cas n'est réussi que s'il passe à chaque essai.
- `--only` : `chatbot`, `nlp`, `reviews`, `descriptions`, `reco`.

Les résultats (`results/<date>-<fournisseur>-<modèle>.md` et `.json`, ignorés par git)
donnent, par cas : réussite, temps moyen, échecs et réponse obtenue.

## Limites

Les vérifications sont automatiques (mots attendus, montants, nombre de phrases) :
elles ne remplacent pas une relecture. Une réponse peut passer les vérifications et
contenir une erreur que rien ne cherche (par exemple deux notes inversées) : relire
les réponses du rapport.
