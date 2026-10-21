import { estimateShipping } from "../lib/shopPolicy";

// Ligne « Livraison » du récapitulatif (panier, checkout), avec le montant
// restant pour la livraison gratuite.
function ShippingLine({ policy, subtotal, className = "" }) {
    const shipping = estimateShipping(policy, subtotal);
    const missing = policy ? policy.shipping.freeThreshold - subtotal : 0;

    return (
        <div className={className}>
            <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Livraison</span>
                {shipping === null ? (
                    <span className="text-gray-500">Calculée à la commande</span>
                ) : shipping === 0 ? (
                    <span className="font-semibold text-emerald-600">Gratuite</span>
                ) : (
                    <span className="font-semibold text-gray-900">{shipping.toFixed(2)}€</span>
                )}
            </div>
            {shipping > 0 && missing > 0 && (
                <p className="mt-1 text-xs text-indigo-600">
                    Plus que {missing.toFixed(2)}€ pour la livraison gratuite
                </p>
            )}
        </div>
    );
}

export default ShippingLine;
