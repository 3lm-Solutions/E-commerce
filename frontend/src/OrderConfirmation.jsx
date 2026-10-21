import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, MapPin } from 'lucide-react';
import useCartStore from './store/cartStore';

// Mêmes couleurs que Orders.jsx / OrderDetail.jsx (page revisitée après annulation, etc.)
const STATUS_COLORS = {
    pending: 'bg-amber-100 text-amber-700 border-amber-200',
    processing: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    cancelled: 'bg-red-100 text-red-700 border-red-200',
    delivered: 'bg-green-100 text-green-700 border-green-200',
};

/**
 * Page de confirmation affichée après le checkout (/order-confirmation/:id).
 * Le paiement n'est pas encore branché : la commande est « enregistrée » et
 * reste « En attente de paiement », on n'annonce donc pas de paiement reçu.
 */
function OrderConfirmation() {
    const { id } = useParams();
    const fetchOrder = useCartStore((state) => state.fetchOrder);
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        fetchOrder(id).then((found) => {
            if (mounted) {
                setOrder(found || null);
                setLoading(false);
            }
        });
        return () => { mounted = false; };
    }, [id, fetchOrder]);

    if (loading) {
        return (
            <div className="max-w-2xl mx-auto px-6 py-20 text-center">
                <p className="text-gray-500">Chargement de votre commande…</p>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="max-w-2xl mx-auto px-6 py-20 text-center">
                <h2 className="text-2xl font-bold text-gray-900">Commande introuvable</h2>
                <Link to="/orders" className="text-indigo-600 mt-4 inline-block hover:underline">
                    Voir mes commandes
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto px-6 py-12">
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8">
                <div className="text-center">
                    <CheckCircle2 size={64} className="mx-auto text-green-600" aria-hidden="true" />
                    <h1 className="mt-4 text-2xl font-bold text-gray-900">
                        Merci, votre commande est enregistrée
                    </h1>
                    <p className="mt-2 text-gray-500">
                        Commande <span className="font-semibold text-gray-900">{order.id}</span> · {order.date}
                    </p>
                    <span className={`mt-3 inline-block px-3 py-1 rounded-full text-sm font-semibold border ${STATUS_COLORS[order._status] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                        {order.status}
                    </span>
                </div>

                <ul className="mt-8 divide-y divide-gray-100 border-y border-gray-100">
                    {order.items.map((item, index) => (
                        <li key={item.id || index} className="flex items-center gap-4 py-3">
                            {item.image ? (
                                <img src={item.image} alt={item.name} className="w-12 h-12 rounded-lg object-cover bg-gray-50" />
                            ) : (
                                <div className="w-12 h-12 rounded-lg bg-gray-100" />
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900 truncate">{item.name}</p>
                                <p className="text-sm text-gray-500">Qté : {item.quantity}</p>
                            </div>
                            <p className="font-semibold text-gray-900">{item.total.toFixed(2)} €</p>
                        </li>
                    ))}
                </ul>

                <div className="flex justify-between items-center mt-4 text-sm text-gray-600">
                    <span>Livraison</span>
                    <span>{order.shippingCost > 0 ? `${order.shippingCost.toFixed(2)} €` : "Gratuite"}</span>
                </div>

                <div className="flex justify-between items-center mt-2 text-lg font-bold">
                    <span>Total</span>
                    <span className="text-indigo-600">{order.total.toFixed(2)} €</span>
                </div>

                {order.address && (
                    <p className="mt-4 flex items-start gap-2 text-sm text-gray-600">
                        <MapPin size={16} className="mt-0.5 shrink-0 text-gray-400" aria-hidden="true" />
                        <span>
                            Livraison à {order.customer && <span className="font-medium text-gray-900">{order.customer}, </span>}
                            {order.address}
                        </span>
                    </p>
                )}

                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                    <Link
                        to={`/order-detail/${order.id}`}
                        className="flex-1 text-center bg-indigo-600 hover:bg-indigo-700 transition text-white rounded-xl py-3 font-semibold"
                    >
                        Voir ma commande
                    </Link>
                    <Link
                        to="/products"
                        className="flex-1 text-center border border-gray-200 hover:bg-gray-50 transition text-gray-700 rounded-xl py-3 font-semibold"
                    >
                        Continuer mes achats
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default OrderConfirmation;
