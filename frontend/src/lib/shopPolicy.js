import { useEffect, useState } from "react";

// Politique de livraison et de retour (GET /api/shop/policy), chargée une seule fois.
let policyPromise = null;

function loadShopPolicy() {
    if (!policyPromise) {
        policyPromise = fetch("/api/shop/policy")
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then((data) => data.data)
            .catch((err) => {
                policyPromise = null; // nouvel essai au prochain affichage
                throw err;
            });
    }
    return policyPromise;
}

// null tant que la politique n'est pas chargée (ou si le chargement échoue)
export function useShopPolicy() {
    const [policy, setPolicy] = useState(null);

    useEffect(() => {
        let cancelled = false;
        loadShopPolicy()
            .then((p) => { if (!cancelled) setPolicy(p); })
            .catch((err) => console.error("Politique de livraison :", err));
        return () => { cancelled = true; };
    }, []);

    return policy;
}

// Frais de port affichés avant la commande. Le montant définitif est calculé
// par le backend à la création de la commande, avec la même règle.
export function estimateShipping(policy, subtotal) {
    if (!policy) return null;
    const { fee, freeThreshold } = policy.shipping;
    return subtotal <= 0 || subtotal >= freeThreshold ? 0 : fee;
}
