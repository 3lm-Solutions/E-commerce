/**
 * Politique de livraison et de retour de la boutique : seule source de vérité.
 * Utilisée par la création de commande (frais de port), GET /api/shop/policy
 * (panier, checkout, pages du site) et le prompt du chatbot.
 *
 * Les valeurs sont dans shopPolicy.json, lu aussi par les mocks MSW du frontend.
 * Les prix sont TTC, en euros. Tarifs internationaux : à définir avec le paiement.
 */
const policy = require('./shopPolicy.json');

const SHOP_POLICY = Object.freeze({
  currency: policy.currency,
  shipping: Object.freeze({ ...policy.shipping }),
  returns: Object.freeze({ ...policy.returns })
});

/**
 * Frais de port d'une commande, d'après le montant des articles (TTC).
 * Gratuits à partir du seuil (50 € inclus).
 */
function computeShippingCost(subtotal) {
  const amount = Number(subtotal) || 0;
  if (amount <= 0 || amount >= SHOP_POLICY.shipping.freeThreshold) return 0;
  return SHOP_POLICY.shipping.fee;
}

// 4.9 -> « 4,90 € », 50 -> « 50 € »
const formatEuros = (amount) =>
  `${Number.isInteger(amount) ? amount : amount.toFixed(2).replace('.', ',')} €`;

/**
 * Texte de la politique, en français (chatbot, pages du site).
 */
function describeShopPolicy() {
  const { shipping, returns } = SHOP_POLICY;
  return [
    `Livraison en ${shipping.zone} : ${formatEuros(shipping.fee)}, offerte dès ${formatEuros(shipping.freeThreshold)} d'achat.`,
    `Expédition ${shipping.dispatchDelay}, livraison en ${shipping.deliveryDelay}.`,
    `Retours : ${returns.days} jours après la livraison pour retourner un produit${returns.free ? ', retour gratuit' : ''}.`
  ].join('\n');
}

module.exports = { SHOP_POLICY, computeShippingCost, describeShopPolicy };
