import { Package, ChevronRight, Search, Filter, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import useCartStore from './store/cartStore'; // Import du store

function Orders() {
    // Lecture directe depuis Zustand
    const orders = useCartStore((state) => state.orders) || [];
    const fetchOrders = useCartStore((state) => state.fetchOrders);

    // Charger les commandes depuis le backend au montage du composant
    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

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

    return (
        <div className="max-w-7xl mx-auto px-6 py-10">
            {/* En-tête */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight text-gray-900">
                        Mes Commandes
                    </h1>
                    <p className="text-gray-500 mt-2">
                        Consultez et suivez vos commandes passées.
                    </p>
                </div>
                
                <div className="flex gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Rechercher..."
                            className="pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 w-full sm:w-64"
                        />
                    </div>
                </div>
            </div>

            {/* Liste des commandes */}
            <div className="space-y-6">
                {orders.map((order) => (
                    <div key={order.id} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                        
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-lg font-bold text-gray-900">Commande {order.id}</h3>
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(order.status)}`}>
                                    {order.status}
                                </span>
                            </div>
                            <p className="text-sm text-gray-500 mb-1">Passée le {order.date}</p>
                            <p className="text-sm font-medium text-gray-900">Total : {order.total.toFixed(2)} €</p>
                        </div>
                        
                        <div className="flex items-center gap-4 w-full md:w-auto">
                            <div className="flex -space-x-3">
                                {order.items.slice(0, 3).map((item, index) => (
                                    <div key={index} className="w-12 h-12 rounded-full border-2 border-white bg-gray-50 overflow-hidden">
                                        {/* On gère si item.image est un array ou une string */}
                                        <img src={Array.isArray(item.image) ? item.image[0] : item.image} alt={item.name} className="w-full h-full object-cover" />
                                    </div>
                                ))}
                                {order.items.length > 3 && (
                                    <div className="w-12 h-12 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600">
                                        +{order.items.length - 3}
                                    </div>
                                )}
                            </div>
                            
                            <Link
                                to={`/order-detail/${order.id}#suivi`}
                                className="flex items-center gap-1 border border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl font-medium hover:bg-gray-50 transition-colors ml-4 whitespace-nowrap"
                            >
                                <Truck size={18} />
                                Suivre
                            </Link>
                            <Link to={`/order-detail/${order.id}`}>
                                <button className="flex items-center gap-1 bg-indigo-50 text-indigo-700 px-4 py-2.5 rounded-xl font-medium hover:bg-indigo-100 transition-colors ml-4 whitespace-nowrap">
                                    Détails
                                    <ChevronRight size={18} />
                                </button>
                            </Link>
                        </div>
                    </div>
                ))}
            </div>
            
            {/* État vide si l'utilisateur n'a aucune commande */}
            {orders.length === 0 && (
                <div className="text-center py-20 bg-white border border-gray-200 rounded-2xl mt-8">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Package size={32} className="text-gray-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">Aucune commande</h2>
                    <p className="text-gray-500 mt-2 max-w-md mx-auto">
                        Vous n'avez pas encore passé de commande.
                    </p>
                    <Link to="/products">
                        <button className="mt-6 bg-indigo-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors">
                            Découvrir nos produits
                        </button>
                    </Link>
                </div>
            )}
        </div>
    );
}

export default Orders;