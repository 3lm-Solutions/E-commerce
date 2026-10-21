import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Truck, RotateCcw } from "lucide-react";
import { useShopPolicy } from "./lib/shopPolicy";

const euros = (amount) => `${Number(amount).toFixed(2).replace(".", ",")} €`;

// Page d'aide : livraison et retours, tirés de la politique de la boutique (GET /api/shop/policy)
function Help() {
    const policy = useShopPolicy();
    const { hash } = useLocation();

    // Liens du pied de page (/aide#livraison, /aide#retours) : défiler jusqu'à la section
    useEffect(() => {
        if (!policy || !hash) return;
        document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, [hash, policy]);

    if (!policy) {
        return (
            <div className="max-w-3xl mx-auto px-6 py-16 text-center text-gray-500">
                Chargement des informations…
            </div>
        );
    }

    const { shipping, returns } = policy;

    return (
        <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">Aide</h1>

            <section id="livraison" className="scroll-mt-24 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900">
                    <Truck size={22} className="text-indigo-600" />
                    Livraison
                </h2>
                <ul className="mt-4 space-y-2 text-gray-700">
                    <li>
                        Livraison en {shipping.zone} : <strong>{euros(shipping.fee)}</strong>,
                        offerte dès <strong>{shipping.freeThreshold} €</strong> d'achat.
                    </li>
                    <li>Expédition {shipping.dispatchDelay}, livraison en {shipping.deliveryDelay}.</li>
                    <li>Les frais de port sont indiqués dans le panier avant de commander, et inclus dans le total.</li>
                </ul>
            </section>

            <section id="retours" className="scroll-mt-24 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900">
                    <RotateCcw size={22} className="text-indigo-600" />
                    Retours
                </h2>
                <ul className="mt-4 space-y-2 text-gray-700">
                    <li>
                        Vous avez <strong>{returns.days} jours</strong> après la livraison pour retourner un produit
                        {returns.free ? <>, <strong>gratuitement</strong></> : null}.
                    </li>
                </ul>
            </section>

            <p className="text-sm text-gray-500">
                Une question sur un produit ? Posez-la à notre assistant (bulle en bas à droite) ou{" "}
                <Link to="/products" className="text-indigo-600 hover:underline">parcourez le catalogue</Link>.
            </p>
        </div>
    );
}

export default Help;
