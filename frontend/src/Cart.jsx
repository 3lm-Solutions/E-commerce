import { useEffect } from "react";
import { Trash, Calculator, Lock, ShieldCheck, RotateCcw, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import useCartStore from "./store/cartStore";

function Cart() {
 
 const cart=useCartStore(state=>state.cart);
 const clearCart=useCartStore(state=>state.clearCart);
 const deleteProductFromCart=useCartStore(state=>state.deleteProductFromCart);
 const increaseQuantity=useCartStore(state=>state.increaseQuantity);
 const decreaseQuantity=useCartStore(state=>state.decreaseQuantity);
 const fetchCart=useCartStore(state=>state.fetchCart);

    // Charger le panier depuis le backend au montage du composant
    useEffect(() => {
        fetchCart();
    }, [fetchCart]);
    
    const subtotal = cart.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
    );

    const totalItems = cart.reduce(
        (sum, item) => sum + item.quantity,
        0
    );
    // Les prix des produits sont TTC : le total est la somme des articles, comme côté backend
    const total=subtotal;
    
    if (cart.length === 0) {
    return (
        <div className="text-center py-24">
            <h2 className="text-3xl font-bold">
                Your cart is empty
            </h2>

            <Link to="/products">
            <p className="text-gray-500 mt-4">
                Start shopping to add products.
            </p>
            </Link>
        </div>
    );
}

    return (  
        <div className="max-w-7xl mx-auto px-6 py-10">

            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-4xl font-extrabold tracking-tight">
                    Your Cart
                </h1>

                <button
                    onClick={clearCart}
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-xl shadow transition"
                >
                    <Trash size={18} />
                    Clear Cart
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

                <div className="lg:col-span-2 space-y-6">

                    {cart.map((p) => (
                        <div
                            key={p.id}
                            className="grid grid-cols-[120px_1fr_180px_140px_70px] items-center gap-8 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-lg transition"
                        >
                            {/* Image */}
                            <div className="w-28 h-28 bg-gray-50 rounded-2xl flex items-center justify-center">
                                <img
                                    src={p.image[0]}
                                    alt={p.name}
                                    className="h-24 object-contain"
                                />
                            </div>

                            {/* Product */}
                            <div className="space-y-2">
                                <p className="text-xs uppercase tracking-wide text-indigo-600">
                                    {p.category}
                                </p>

                                <h2 className="text-xl font-bold">
                                    {p.name}
                                </h2>

                                <div className="flex items-center gap-4">
                                    <span className="text-2xl font-extrabold text-indigo-600">
                                        {p.price}€
                                    </span>

                                    <span className="text-yellow-500">
                                        ⭐{p.rating}
                                    </span>
                                </div>
                            </div>

                            {/* Quantity */}
                            <div className="flex items-center justify-center border rounded-xl overflow-hidden shadow-sm">
                                <button
                                    onClick={() => decreaseQuantity(p.id)}
                                    className="w-12 h-12 text-xl hover:bg-gray-100 transition"
                                >
                                    −
                                </button>

                                <span className="w-14 text-center font-semibold text-lg">
                                    {p.quantity}
                                </span>

                                <button
                                    onClick={() => increaseQuantity(p.id)}
                                    className="w-12 h-12 text-xl hover:bg-gray-100 transition"
                                >
                                    +
                                </button>
                            </div>

                            {/* Product Total */}
                            <div className="text-right">
                                <h3 className="text-xl font-bold">
                                    {(p.price * p.quantity).toFixed(2)} €
                                </h3>

                                <p className="text-sm text-gray-500">
                                    {p.price} € × {p.quantity}
                                </p>
                            </div>

                            {/* Delete */}
                            <button
                                onClick={() => deleteProductFromCart(p.id)}
                                className="w-12 h-12 rounded-xl border border-red-200 flex items-center justify-center text-red-600 hover:bg-red-600 hover:text-white transition"
                            >
                                <Trash size={20} />
                            </button>
                        </div>
                    ))}

                    {/* Subtotal banner */}
                    <div className="mt-8 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl px-8 py-6 flex items-center justify-between shadow-lg">
                        <div className="flex items-center gap-5">
                            <div className="bg-white/20 rounded-xl p-4">
                                <Calculator className="text-white" />
                            </div>

                            <div>
                                <h2 className="text-2xl font-bold text-white">
                                    Subtotal
                                </h2>

                                <p className="text-indigo-100">
                                    {totalItems} {totalItems > 1 ? "items" : "item"}
                                </p>
                            </div>
                        </div>

                        <h1 className="text-4xl font-extrabold text-white">
                            {subtotal.toFixed(2)} €
                        </h1>
                    </div>
                </div>

                    
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm sticky top-6">
                    <h2 className="text-xl font-bold mb-5">Order Summary</h2>

                    <div className="divide-y divide-gray-100">
                        <div className="flex items-center justify-between py-3 text-sm">
                            <p className="text-gray-500">Subtotal</p>
                            <p className="font-semibold text-gray-900">{subtotal.toFixed(2)}€</p>
                        </div>

                        <div className="flex items-center justify-between py-3 text-sm">
                            <p className="text-gray-500">Shipping</p>
                            <p className="font-semibold text-emerald-600">Free</p>
                        </div>

                    </div>

                    <div className="flex items-center justify-between border-t border-gray-200 mt-2 pt-4">
                        <h3 className="text-lg font-bold text-gray-900">Total</h3>
                        <p className="text-2xl font-extrabold text-indigo-600">{total.toFixed(2)}€</p>
                    </div>
                    <p className="mt-1 mb-6 text-right text-xs text-gray-500">TVA incluse</p>

                    <Link to="/checkout">
                        <button className="w-full flex items-center justify-center gap-2 bg-indigo-700 hover:bg-indigo-800 text-white font-semibold py-3.5 rounded-xl shadow transition">
                                <Lock size={16} />
                                Checkout
                        </button>
                    </Link>

                    <div className="grid grid-cols-3 gap-2 mt-5 pt-5 border-t border-gray-100">
                        <div className="flex flex-col items-center text-center gap-1.5">
                            <ShieldCheck size={18} className="text-gray-400" />
                            <p className="text-[11px] text-gray-500 leading-tight">Secure Checkout</p>
                        </div>
                        <div className="flex flex-col items-center text-center gap-1.5">
                            <RotateCcw size={18} className="text-gray-400" />
                            <p className="text-[11px] text-gray-500 leading-tight">30-Day Returns</p>
                        </div>
                        <div className="flex flex-col items-center text-center gap-1.5">
                            <Clock size={18} className="text-gray-400" />
                            <p className="text-[11px] text-gray-500 leading-tight">24/7 Support</p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}

export default Cart;