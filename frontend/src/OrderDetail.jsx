import { useParams, Link, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { Package, Truck, CheckCircle2, ChevronLeft, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import useCartStore from './store/cartStore'; // Import du store
import OrderTracking from './components/OrderTracking';

function OrderDetail() {
    const { id } = useParams();
    const fetchOrder = useCartStore((state) => state.fetchOrder);
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const fetchOrderTracking = useCartStore((state) => state.fetchOrderTracking);
    const cancelOrder = useCartStore((state) => state.cancelOrder);
    const [tracking, setTracking] = useState(null);
    const [confirmCancel, setConfirmCancel] = useState(false);
    const [canceling, setCanceling] = useState(false);
    const location = useLocation();
    const trackingRef = useRef(null);

    // Charger la commande spécifique depuis le backend au montage
    useEffect(() => {
        let mounted = true;
        async function load() {
            setLoading(true);
            const found = await fetchOrder(id);
            if (mounted) {
                setOrder(found || null);
                setLoading(false);
            }
        }
        load();
        return () => { mounted = false; };
    }, [id, fetchOrder]);

    // Suivi : GET /api/orders/:orderId/tracking
    useEffect(() => {
        let mounted = true;
        fetchOrderTracking(id).then((data) => {
            if (mounted) setTracking(data);
        });
        return () => { mounted = false; };
    }, [id, fetchOrderTracking]);

    // Lien "Suivre" de la liste (/order-detail/:id#suivi) : défiler jusqu'au suivi une fois chargé
    useEffect(() => {
        if (tracking && location.hash === '#suivi') {
            trackingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [tracking, location.hash]);

    async function handleCancel() {
        setCanceling(true);
        const result = await cancelOrder(id);
        setCanceling(false);
        setConfirmCancel(false);
        if (!result.ok) {
            toast.error(result.message);
            return;
        }
        toast.success('Commande annulée.');
        setOrder((prev) => prev && { ...prev, _status: 'cancelled', status: 'Annulé' });
        setTracking(await fetchOrderTracking(id));
    }

    const getStatusColor = (status) => {
        switch(status) {
            case 'Livré': return 'bg-green-100 text-green-700 border-green-200';
            case 'En attente de paiement': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'En préparation': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
            case 'En transit': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'Annulé': return 'bg-red-100 text-red-700 border-red-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

if (loading) {
        return (
            <div className="max-w-7xl mx-auto px-6 py-20 text-center">
                <h2 className="text-2xl font-bold text-gray-900">Chargement...</h2>
                <p className="text-gray-500 mt-2">Récupération de la commande en cours.</p>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="max-w-7xl mx-auto px-6 py-20 text-center">
                <h2 className="text-2xl font-bold text-gray-900">Commande introuvable</h2>
                <Link to="/orders" className="text-indigo-600 mt-4 inline-block font-medium hover:underline">
                    Retour à mes commandes
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            <Link to="/orders" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-6">
                <ChevronLeft size={16} />
                Retour aux commandes
            </Link>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900">Commande {order.id}</h1>
                    <p className="text-gray-500 mt-1">Passée le {order.date}</p>
                </div>
                <span className={`px-4 py-1.5 rounded-full text-sm font-semibold border flex items-center gap-2 w-fit ${getStatusColor(order.status)}`}>
                    {order.status === 'Livré' && <CheckCircle2 size={16} />}
                    {order.status === 'En transit' && <Truck size={16} />}
                    {order.status}
                </span>
            </div>

            {/* Annulation : uniquement pour une commande en attente (règle du backend) */}
            {order._status === 'pending' && (
                <div className="mb-8 flex flex-wrap items-center justify-end gap-3">
                    {!confirmCancel ? (
                        <button
                            type="button"
                            onClick={() => setConfirmCancel(true)}
                            className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
                        >
                            Annuler la commande
                        </button>
                    ) : (
                        <div className="flex flex-wrap items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                            <span className="text-sm text-red-700">Annuler cette commande ? Cette action est définitive.</span>
                            <button
                                type="button"
                                onClick={() => setConfirmCancel(false)}
                                disabled={canceling}
                                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
                            >
                                Non, garder
                            </button>
                            <button
                                type="button"
                                onClick={handleCancel}
                                disabled={canceling}
                                className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                            >
                                {canceling ? 'Annulation...' : 'Oui, annuler'}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {tracking && (
                <div id="suivi" ref={trackingRef} className="mb-8 scroll-mt-24">
                    <OrderTracking tracking={tracking} />
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Liste des articles */}
                <div className="md:col-span-2 space-y-6">
                    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                        <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                            <Package size={20} className="text-indigo-600"/>
                            Articles commandés
                        </h2>
                        
                        <div className="divide-y divide-gray-100">
                            {order.items.map((item, index) => (
                                <div key={index} className="py-4 first:pt-0 last:pb-0 flex items-center gap-4">
                                    <div className="w-20 h-20 bg-gray-50 rounded-xl overflow-hidden flex-shrink-0">
                                        <img 
                                            src={Array.isArray(item.image) ? item.image[0] : item.image} 
                                            alt={item.name} 
                                            className="w-full h-full object-contain" 
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-gray-900">{item.name}</h3>
                                        <p className="text-sm text-gray-500">{item.category}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-gray-900">{(item.price * item.quantity).toFixed(2)} €</p>
                                        <p className="text-sm text-gray-500">Qté: {item.quantity}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Résumé et Infos */}
                <div className="space-y-6">
                    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                        <h2 className="text-lg font-bold text-gray-900 mb-4">Résumé</h2>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between text-gray-600">
                                <span>Sous-total</span>
                                <span>{order.items.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)} €</span>
                            </div>
                            <div className="flex justify-between text-gray-600">
                                <span>Livraison</span>
                                <span>Gratuite</span>
                            </div>
                            <div className="pt-3 border-t border-gray-100 flex justify-between font-bold text-lg text-gray-900">
                                <span>Total (TTC)</span>
                                <span className="text-indigo-600">{order.total.toFixed(2)} €</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <MapPin size={20} className="text-indigo-600"/>
                            Adresse de livraison
                        </h2>
                        <p className="text-sm text-gray-600 leading-relaxed">
                            {order.address}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default OrderDetail;