'use strict';

const { Product, Category } = require('../../models');

/**
 * Service de récupération et formatage du catalogue produits pour le chatbot IA
 *
 * FonctionnalitéHaute #1670 - Prompt système avec contexte produit
 *
 * Ce service interroge la base de données (via Sequelize) pour récupérer les
 * produits actifs les plus pertinents, puis les formate en un texte lisible
 * en français, prêt à être injecté dans le prompt système du chatbot.
 */

// Nombre maximum de produits injectés dans le contexte du chatbot
const MAX_CATALOG_PRODUCTS = 20;

// Devise utilisée pour l'affichage des prix dans le catalogue
const CURRENCY = '€'; // même devise que le site et le PaymentIntent (eur)

// Longueur maximale de la description injectée (le prompt reste court)
const MAX_DESCRIPTION_LENGTH = 150;

// Message de fallback renvoyé si la requête échoue
const FALLBACK_CATALOG_TEXT =
  'Le catalogue est temporairement indisponible. Veuillez rediriger le client vers le support humain pour toute demande concernant les produits, les prix ou les stocks.';

/**
 * Récupérer le nom de la catégorie d'un produit (gère raw: true et instances Sequelize).
 *
 * Avec `raw: true`, les colonnes de l'association sont aplaties
 * (`product['category.name']`), alors qu'une instance Sequelize expose
 * `product.category.name`.
 *
 * @param {Object} product - Produit brut (raw) ou instance Sequelize
 * @returns {string} Nom de la catégorie (ou libellé par défaut)
 */
function getCategoryName(product) {
  if (product.category && product.category.name) {
    return product.category.name;
  }
  if (product['category.name']) {
    return product['category.name'];
  }
  return 'Non catégorisé';
}

/**
 * Raccourcir une description sur une limite de mot, sur une seule ligne.
 *
 * @param {string|null} description
 * @returns {string} Description d'au plus MAX_DESCRIPTION_LENGTH caractères (+ « … »)
 */
function shortenDescription(description) {
  const text = String(description || '').replace(/\s+/g, ' ').trim();
  if (text.length <= MAX_DESCRIPTION_LENGTH) return text;
  const cut = text.slice(0, MAX_DESCRIPTION_LENGTH);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.]+$/, '') + '…';
}

/**
 * Formater un produit brut Sequelize en objet simple et lisible
 *
 * @param {Object} product - Instance Sequelize d'un produit (avec catégorie incluse)
 * @returns {{ name: string, price: number, category: string, stock: number,
 *   ratingAvg: number, ratingCount: number, description: string }}
 */
function formatProductForChatbot(product) {
  const rawPrice = product.price;
  const parsedPrice = typeof rawPrice === 'string' ? parseFloat(rawPrice) : rawPrice;

  return {
    name: product.name,
    price: Number.isFinite(parsedPrice) ? Math.round(parsedPrice * 100) / 100 : 0,
    category: getCategoryName(product),
    stock: Number.isInteger(product.stock) ? product.stock : parseInt(product.stock, 10) || 0,
    ratingAvg: Math.round((parseFloat(product.ratingAvg) || 0) * 10) / 10,
    ratingCount: parseInt(product.ratingCount, 10) || 0,
    description: shortenDescription(product.description)
  };
}

/**
 * Transformer une liste de produits formatés en texte lisible (français)
 *
 * Format d'une ligne : « Nom - Prix - Catégorie - Stock: N - Note: X/5 (N avis) - Description ».
 * La note n'apparaît que si le produit a des avis, la description que si elle existe.
 *
 * @param {Array<{ name: string, price: number, category: string, stock: number,
 *   ratingAvg?: number, ratingCount?: number, description?: string }>} products
 * @returns {string} Liste numérotée prête à être injectée dans un prompt
 */
function formatProductsAsText(products) {
  if (!products || products.length === 0) {
    return 'Le catalogue ne contient actuellement aucun produit disponible.';
  }

  const lines = products.map((product, index) => {
    const price = product.price.toFixed(2);
    let line = `${index + 1}. ${product.name} - ${price} ${CURRENCY} - ${product.category} - Stock: ${product.stock}`;
    if (product.ratingCount > 0) {
      line += ` - Note: ${product.ratingAvg}/5 (${product.ratingCount} avis)`;
    }
    if (product.description) {
      line += ` - ${product.description}`;
    }
    return line;
  });

  return lines.join('\n');
}

/**
 * Récupérer les produits actifs les plus pertinents et les formater
 * en un texte lisible prêt à être injecté dans le prompt du chatbot.
 *
 * - Filtre les produits actifs (isActive: true)
 * - Inclut la catégorie pour obtenir son nom
 * - Tri par note moyenne décroissante (pertinence), puis nom
 * - Limite à 20 produits
 * - Arrondit les prix à 2 décimales et force le stock en entier
 *
 * @async
 * @returns {Promise<string>} Texte formaté du catalogue (liste en français)
 */
async function getProductCatalogForChatbot() {
  try {
    const products = await Product.findAll({
      where: {
        isActive: true
      },
      include: [
        {
          model: Category,
          as: 'category',
          attributes: ['name'],
          required: false // LEFT JOIN : un produit sans catégorie reste affiché
        }
      ],
      attributes: ['name', 'price', 'stock', 'ratingAvg', 'ratingCount', 'description'],
      order: [
        ['ratingAvg', 'DESC'],
        ['name', 'ASC']
      ],
      limit: MAX_CATALOG_PRODUCTS,
      raw: true
    });

    const formattedProducts = products.map(formatProductForChatbot);

    return formatProductsAsText(formattedProducts);
  } catch (error) {
    console.error('Erreur lors de la récupération du catalogue pour le chatbot:', error);
    return FALLBACK_CATALOG_TEXT;
  }
}

module.exports = {
  getProductCatalogForChatbot,
  formatProductForChatbot,
  formatProductsAsText,
  shortenDescription,
  MAX_CATALOG_PRODUCTS,
  MAX_DESCRIPTION_LENGTH
};

