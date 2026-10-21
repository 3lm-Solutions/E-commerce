'use strict';

/**
 * Construction du prompt système et des messages pour le chatbot IA e-commerce
 *
 * FonctionnalitéHaute #1670 - Prompt système avec contexte produit
 *
 * Module ciblant l'API Claude (Anthropic) /v1/messages. Il fournit :
 *  - buildSystemPrompt(catalogueText) : prompt système complet en français
 *    avec le catalogue produits injecté dynamiquement
 *  - buildMessagesForClaude(conversationHistory, catalogueText) : objet prêt
 *    à être envoyé à l'API Claude ({ system, messages })
 *
 * EXEMPLE D'UTILISATION :
 * ----------------------------------------------------------------------------
 * const { buildMessagesForClaude } = require('./chatbotPrompt');
 * const { getProductCatalogForChatbot } = require('./productCatalogService');
 *
 * // 1. Récupérer le catalogue produits depuis la base (texte lisible)
 * const catalogueText = await getProductCatalogForChatbot();
 *
 * // 2. Construire les messages prêts pour l'API Claude (/v1/messages)
 * const conversationHistory = [
 *   { role: 'user', content: 'Bonjour' },
 *   { role: 'assistant', content: 'Bonjour ! Comment puis-je vous aider ?' }
 * ];
 * const claudeRequest = buildMessagesForClaude(conversationHistory, catalogueText);
 *
 * // 3. Envoyer à l'API Claude
 * // POST https://api.anthropic.com/v1/messages
 * // body: { model: 'claude-...', max_tokens: 1024, ...claudeRequest }
 * // (system = claudeRequest.system, messages = claudeRequest.messages)
 * ----------------------------------------------------------------------------
 */

// Nombre maximum de messages d'historique conservés (10 = 5 échanges)
const MAX_HISTORY_MESSAGES = 10;

// Liste des statuts de commande reconnus par le chatbot (suivi de commande)
const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

/**
 * Construire le prompt système complet en français pour le chatbot.
 *
 * Le prompt définit :
 *  - Le rôle : assistant e-commerce sympathique et professionnel
 *  - Les capacités : recommandations, questions prix/stock/catégories,
 *    aide au suivi de commande (statuts documentés)
 *  - Les limites : jamais inventer un produit / un prix / un stock,
 *    rediriger vers le support humain hors périmètre e-commerce
 *  - Le ton : courtois, concis, orienté conversion sans être insistant
 *
 * @param {string} catalogueText - Texte du catalogue produits (formaté en français)
 * @returns {string} Prompt système complet
 */
function buildSystemPrompt(catalogueText) {
  const catalogueSection = catalogueText || 'Le catalogue est actuellement indisponible.';

  return [
    'Tu es un assistant e-commerce sympathique et professionnel pour notre boutique en ligne.',
    '',
    '## Contexte produit (catalogue)',
    'Voici la liste des produits actuellement disponibles dans notre catalogue. ' +
      'Chaque ligne est au format : "Nom - Prix - Catégorie - Stock - Note (si le produit a des avis) - Description".',
    'Utilise UNIQUEMENT ces informations pour répondre aux questions sur les produits, les prix et les stocks.',
    '',
    catalogueSection,
    '',
    '## Capacités',
    '- Recommander des produits adaptés aux besoins du client en t\'appuyant uniquement sur le catalogue fourni.',
    '- Répondre aux questions sur les prix, les stocks et les catégories de produits.',
    "- Comparer des produits à partir de leur description et de leur note (avec le nombre d'avis : une note sur 1 avis pèse moins qu'une note sur 12 avis).",
    '- Aider au suivi de commande. Les statuts possibles d\'une commande sont : ' +
      ORDER_STATUSES.join(', ') + '.',
    '- Expliquer brièvement ce que signifie chaque statut de commande si le client le demande.',
    '',
    '## Limites',
    '- Ne JAMAIS inventer un produit qui n\'est pas présent dans le catalogue fourni.',
    '- Ne JAMAIS donner un prix ou un stock qui ne figure pas dans le catalogue fourni.',
    '- Ne JAMAIS ajouter de caractéristique technique absente de la description fournie.',
    '- Si une information n\'est pas dans le catalogue ou concerne un sujet hors e-commerce, ' +
      'indique que tu ne peux pas y répondre et redirige le client vers le support humain.',
    '- Ne pas donner d\'avis médical, juridique ou financier.',
    '',
    '## Ton',
    '- Sois courtois, concis et chaleureux.',
    '- Oriente la conversation vers la conversion (proposer des produits pertinents) ' +
      'sans être insistant ni agressif commercialement.',
    '- Réponds toujours en français, sauf si le client écrit dans une autre langue.'
  ].join('\n');
}

/**
 * Valider un message d'historique individuel.
 *
 * @param {*} message - Message à valider
 * @returns {boolean} True si le message est valide ({ role, content })
 */
function isValidHistoryMessage(message) {
  return (
    message &&
    typeof message === 'object' &&
    (message.role === 'user' || message.role === 'assistant') &&
    typeof message.content === 'string'
  );
}

/**
 * Construire l'objet prêt à être envoyé à l'API Claude (Anthropic /v1/messages).
 *
 * Retourne :
 *  - system : le prompt système complet avec le catalogue injecté
 *  - messages : l'historique reconstruit (uniquement les N derniers échanges,
 *    limité à 10 messages maximum pour éviter un contexte trop long)
 *
 * @param {*} conversationHistory - Historique de conversation (array de { role, content })
 * @param {string} catalogueText - Texte du catalogue produits
 * @returns {{ system: string, messages: Array<{ role: string, content: string }> }}
 */
function buildMessagesForClaude(conversationHistory, catalogueText) {
  // Valider que l'historique est bien un tableau, sinon retourner un tableau vide
  const history = Array.isArray(conversationHistory) ? conversationHistory : [];

  // Ne garder que les messages valides
  const validMessages = history.filter(isValidHistoryMessage);

  // Limiter au N derniers messages (éviter un contexte trop long)
  const trimmedMessages = validMessages.slice(-MAX_HISTORY_MESSAGES);

  return {
    system: buildSystemPrompt(catalogueText),
    messages: trimmedMessages.map((message) => ({
      role: message.role,
      content: message.content
    }))
  };
}

module.exports = {
  buildSystemPrompt,
  buildMessagesForClaude,
  MAX_HISTORY_MESSAGES,
  ORDER_STATUSES
};

