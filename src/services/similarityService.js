const { Product, Category } = require('../../models');
const PRICE_TOLERANCE = 0.20; //
const SCORE_SAME_CATEGORY = 3;
const SCORE_PER_COMMON_TAG = 2;
const SCORE_PRICE_CLOSE = 1;
const DEFAULT_RESULTS_COUNT = 4;

function calculateSimilarityScore(product1, product2) {
  if (!product1 || !product2) {
    return 0;
  }

  // Un produit n'est jamais "similaire" à lui-même dans ce contexte
  if (product1.id === product2.id) {
    return 0;
  }

  let score = 0;

  //  Même catégorie (+3)
  if (product1.categoryId && product2.categoryId && product1.categoryId === product2.categoryId) {
    score += SCORE_SAME_CATEGORY;
  }

  //  Tags communs (+2 par tag)
  const tags1 = Array.isArray(product1.tags) ? product1.tags : [];
  const tags2 = Array.isArray(product2.tags) ? product2.tags : [];

  if (tags1.length > 0 && tags2.length > 0) {
    // Comparaison insensible à la casse, sans doublons
    const normalizedTags1 = new Set(tags1.map((tag) => tag.toLowerCase().trim()));
    const normalizedTags2 = new Set(tags2.map((tag) => tag.toLowerCase().trim()));

    let commonTagsCount = 0;
    for (const tag of normalizedTags1) {
      if (normalizedTags2.has(tag)) {
        commonTagsCount += 1;
      }
    }

    score += commonTagsCount * SCORE_PER_COMMON_TAG;
  }

  //  Prix proche (±20%) (+1)
  const price1 = parseFloat(product1.price);
  const price2 = parseFloat(product2.price);

  if (!isNaN(price1) && !isNaN(price2) && price1 > 0) {
    const priceDifference = Math.abs(price1 - price2) / price1;
    if (priceDifference <= PRICE_TOLERANCE) {
      score += SCORE_PRICE_CLOSE;
    }
  }

  return score;
}

async function getSimilarProducts(productId, limit = DEFAULT_RESULTS_COUNT) {
  // Récupérer le produit de référence
  const referenceProduct = await Product.findOne({
    where: { id: productId, isActive: true },
    include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }]
  });

  if (!referenceProduct) {
    throw new Error('Produit de référence non trouvé ou inactif');
  }

  // Récupérer tous les autres produits actifs (candidats)
  const candidates = await Product.findAll({
    where: { isActive: true },
    include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }]
  });

  // Calculer le score de chaque candidat par rapport au produit de référence
  const scoredCandidates = candidates
    .filter((candidate) => candidate.id !== referenceProduct.id)
    .map((candidate) => ({
      product: candidate,
      score: calculateSimilarityScore(referenceProduct, candidate)
    }));

  // Trier par score décroissant, puis par note moyenne décroissante en cas d'égalité
  scoredCandidates.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    const ratingA = parseFloat(a.product.ratingAvg) || 0;
    const ratingB = parseFloat(b.product.ratingAvg) || 0;
    return ratingB - ratingA;
  });

  // Ne garder que les N meilleurs, en excluant les scores nuls (aucune similarité)
  const topResults = scoredCandidates
    .filter((entry) => entry.score > 0)
    .slice(0, limit);

  return {
    referenceProduct,
    similarProducts: topResults
  };
}

module.exports = {
  calculateSimilarityScore,
  getSimilarProducts,
  // Constantes exposées pour les tests / réutilisation
  SCORE_SAME_CATEGORY,
  SCORE_PER_COMMON_TAG,
  SCORE_PRICE_CLOSE,
  PRICE_TOLERANCE
};