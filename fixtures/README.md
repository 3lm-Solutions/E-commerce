# Fixtures partagées

Données JSON réalistes et cohérentes entre elles, utilisées par les mocks MSW
du frontend (`frontend/src/mocks/`) et par les tests (`src/tests/fixtures.test.js`).
Cahier général (00), §3.2 et §6.2.

| Fichier | Contenu | Clés |
|---|---|---|
| `categories.json` | 5 catégories | `c_001` à `c_005` |
| `products.json` | 20 produits (dont 1 inactif, 1 en rupture) | `p_001` à `p_020` |
| `users.json` | 10 utilisateurs (1 admin, 1 compte désactivé) | `u_001` à `u_010` |
| `reviews.json` | 47 avis | `r_001` à `r_047` |
| `orders.json` | 6 commandes, une par état, avec leur historique | `o_001` à `o_006` |

## Identifiants

Le cahier fixe les identifiants `p_001`… et `u_001`…, mais les colonnes `id`
de la base sont des UUID. Chaque objet a donc :

- `id` : un UUID v4 **fixe**, dont le premier chiffre indique le type
  (`1…` produit, `2…` utilisateur, `3…` catégorie, `4…` commande, `5…` avis) et
  dont le numéro final correspond à la clé : `p_011` → `10000000-0000-4000-8000-000000000011` ;
- `fixture_key` : la clé du cahier (`p_011`).

Les références entre fichiers (`category_id`, `product_id`, `user_id`,
`items[].productId`) utilisent les UUID. Ne pas créer d'identifiant en dehors
de ces fichiers.

## Format

- Champs en `snake_case`, comme le schéma du cahier et la base. Les mocks MSW
  les convertissent au format de l'API (`camelCase`).
- `rating_avg` et `rating_count` sont calculés à partir de `reviews.json`.
- `items` des commandes : snapshot au moment de l'achat (nom, prix, image).
- `status_history` des commandes : `changed_by` vaut `null` pour le système
  (paiement confirmé par le webhook).

## Comptes

Les mots de passe de `users.json` sont des valeurs de test, en clair, pour les
mocks uniquement : `AdminPassword123` (u_001), `UserPassword123` (u_002),
`Password123` pour les autres. Ne jamais les réutiliser ailleurs.

## Mode mock (frontend sans backend)

Dans `frontend/.env.local` : `VITE_USE_MOCK=true`, puis redémarrer `npm run dev`.
MSW simule alors toute l'API utilisée par le site, à partir de ces fichiers :

- `frontend/src/mocks/catalog.js` : catalogue, authentification, avis ;
- `shop.js` : panier, wishlist, politique de livraison, commandes, paiement simulé ;
- `reco.js` : recommandations, événements, recherche ;
- `admin.js` : tableau de bord admin ;
- `ai.js` : chatbot et génération de description (réponses par règles, sans IA).

Les modifications (panier, commandes, actions admin) sont gardées dans
`sessionStorage` : elles survivent à un rechargement et disparaissent à la
fermeture de l'onglet. La politique de livraison est lue dans
`src/config/shopPolicy.json`, comme le backend.
