import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Heart, Menu, X, ShoppingCart, User, Search } from "lucide-react";
import useCartStore from "./store/cartStore";
import useAuth from "./store/useAuth";

function Navbar() {
    const location = useLocation();
    const navigate = useNavigate();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    
    const cart = useCartStore(state => state.cart);
    const wishList = useCartStore(state => state.wish);
    const resetCart = useCartStore(state => state.reset);
    const { isAuthenticated, user, logout } = useAuth();
    
    const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalQuantityWish = wishList.length;

    // Fermer les menus quand on change de page
    useEffect(() => {
        setIsMobileMenuOpen(false);
        setIsUserMenuOpen(false);
    }, [location.pathname]);

    // Fermer le menu utilisateur en cliquant à l'extérieur
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (isUserMenuOpen && !event.target.closest('.user-menu')) {
                setIsUserMenuOpen(false);
            }
        };
        
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [isUserMenuOpen]);

    const handleLogout = async () => {
        await logout();
        resetCart();
        setIsUserMenuOpen(false);
        navigate("/");
    };

    // Recherche rapide : le catalogue lit ?q= et applique la recherche par nom
    const [searchTerm, setSearchTerm] = useState("");
    const handleSearch = (e) => {
        e.preventDefault();
        const term = searchTerm.trim();
        navigate(term ? `/products?q=${encodeURIComponent(term)}` : "/products");
        setSearchTerm("");
    };

    const navLinks = [
        { to: "/", label: "Accueil" },
        { to: "/products", label: "Produits" },
        { to: "/orders", label: "Commandes", protected: true }
    ];

    return (
        <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <div className="flex-shrink-0">
                        <Link 
                            to="/" 
                            className="text-2xl font-extrabold tracking-tight hover:opacity-80 transition-opacity"
                            aria-label="Accueil 3LM Solutions"
                        >
                            3lm<span className="text-indigo-600">solutions</span>
                        </Link>
                    </div>

                    {/* Navigation desktop */}
                    <div className="hidden md:flex items-center space-x-8">
                        {navLinks.map(link => (
                            (!link.protected || isAuthenticated) && (
                                <Link
                                    key={link.to}
                                    to={link.to}
                                    className={`text-sm font-medium transition-colors hover:text-indigo-600 ${
                                        location.pathname === link.to 
                                            ? 'text-indigo-600' 
                                            : 'text-gray-700'
                                    }`}
                                >
                                    {link.label}
                                </Link>
                            )
                        ))}
                    </div>

                    {/* Actions desktop */}
                    <div className="hidden md:flex items-center space-x-4">
                        {/* Barre de recherche rapide : ouvre le catalogue filtré (/products?q=…) */}
                        <form role="search" onSubmit={handleSearch} className="relative">
                            <input
                                type="search"
                                placeholder="Rechercher..."
                                aria-label="Rechercher un produit"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-48 pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        </form>

                        {!isAuthenticated ? (
                            <>
                                <Link to="/login">
                                    <button className="text-sm text-gray-700 hover:text-indigo-600 transition-colors px-3 py-2">
                                        Connexion
                                    </button>
                                </Link>
                                <Link to="/register">
                                    <button className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
                                        Inscription
                                    </button>
                                </Link>
                            </>
                        ) : (
                            <div className="relative user-menu">
                                <button
                                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                                    className="flex items-center space-x-2 text-sm text-gray-700 hover:text-indigo-600 transition-colors p-2 rounded-lg hover:bg-gray-50"
                                    aria-expanded={isUserMenuOpen}
                                    aria-haspopup="true"
                                >
                                    <User size={18} />
                                    <span className="hidden lg:block">{user?.name || 'Mon compte'}</span>
                                </button>

                                {isUserMenuOpen && (
                                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
                                        <Link to="/orders" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                                            Mes commandes
                                        </Link>
                                        {user?.role === 'admin' && (
                                            <Link to="/admin" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                                                Administration
                                            </Link>
                                        )}
                                        <div className="border-t border-gray-100 my-1"></div>
                                        <button
                                            onClick={handleLogout}
                                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                        >
                                            Déconnexion
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Panier */}
                        <Link to="/cart" className="relative">
                            <button 
                                className="flex items-center space-x-2 bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-indigo-600 transition-colors shadow-sm"
                                aria-label={`Panier avec ${totalQuantity} articles`}
                            >
                                <ShoppingCart size={18} />
                                <span className="text-sm font-medium">Panier</span>
                                {totalQuantity > 0 && (
                                    <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 min-w-[20px] text-center">
                                        {totalQuantity}
                                    </span>
                                )}
                            </button>
                        </Link>

                        {/* Wishlist */}
                        <Link to="/wishlist" className="relative">
                            <button 
                                className="p-2 text-gray-600 hover:text-red-500 transition-colors"
                                aria-label={`Liste de souhaits avec ${totalQuantityWish} articles`}
                            >
                                <Heart size={20} className={totalQuantityWish > 0 ? 'fill-red-500 text-red-500' : ''} />
                                {totalQuantityWish > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                                        {totalQuantityWish}
                                    </span>
                                )}
                            </button>
                        </Link>
                    </div>

                    {/* Menu mobile toggle */}
                    <div className="md:hidden flex items-center space-x-2">
                        {/* Panier mobile */}
                        <Link to="/cart" className="relative">
                            <button 
                                className="p-2 text-gray-600 hover:text-indigo-600 transition-colors"
                                aria-label={`Panier avec ${totalQuantity} articles`}
                            >
                                <ShoppingCart size={20} />
                                {totalQuantity > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                                        {totalQuantity}
                                    </span>
                                )}
                            </button>
                        </Link>

                        {/* Menu burger */}
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="p-2 text-gray-600 hover:text-indigo-600 transition-colors"
                            aria-expanded={isMobileMenuOpen}
                            aria-label="Menu de navigation"
                        >
                            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                    </div>
                </div>

                {/* Menu mobile */}
                {isMobileMenuOpen && (
                    <div className="md:hidden border-t border-gray-100 py-4 space-y-2">
                        {/* Recherche mobile */}
                        <div className="px-2 pb-4">
                            <form role="search" onSubmit={handleSearch} className="relative">
                                <input
                                    type="search"
                                    placeholder="Rechercher des produits..."
                                    aria-label="Rechercher un produit"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                />
                                <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                            </form>
                        </div>

                        {/* Navigation links */}
                        {navLinks.map(link => (
                            (!link.protected || isAuthenticated) && (
                                <Link
                                    key={link.to}
                                    to={link.to}
                                    className={`block px-4 py-3 text-base font-medium transition-colors hover:bg-gray-50 hover:text-indigo-600 ${
                                        location.pathname === link.to 
                                            ? 'text-indigo-600 bg-indigo-50' 
                                            : 'text-gray-700'
                                    }`}
                                >
                                    {link.label}
                                </Link>
                            )
                        ))}

                        {/* Wishlist mobile */}
                        <Link
                            to="/wishlist"
                            className="flex items-center justify-between px-4 py-3 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-indigo-600 transition-colors"
                        >
                            <div className="flex items-center space-x-3">
                                <Heart size={20} className={totalQuantityWish > 0 ? 'fill-red-500 text-red-500' : ''} />
                                <span>Liste de souhaits</span>
                            </div>
                            {totalQuantityWish > 0 && (
                                <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1">
                                    {totalQuantityWish}
                                </span>
                            )}
                        </Link>

                        {/* Auth mobile */}
                        <div className="border-t border-gray-100 mt-4 pt-4">
                            {!isAuthenticated ? (
                                <>
                                    <Link
                                        to="/login"
                                        className="block px-4 py-3 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-indigo-600 transition-colors"
                                    >
                                        Connexion
                                    </Link>
                                    <Link
                                        to="/register"
                                        className="block mx-4 my-2 py-3 text-center text-base font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                                    >
                                        Créer un compte
                                    </Link>
                                </>
                            ) : (
                                <>
                                    <div className="px-4 py-2 text-sm text-gray-500">
                                        Connecté en tant que <span className="font-medium">{user?.name}</span>
                                    </div>
                                    {user?.role === 'admin' && (
                                        <Link
                                            to="/admin"
                                            className="block px-4 py-3 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-indigo-600 transition-colors"
                                        >
                                            Administration
                                        </Link>
                                    )}
                                    <button
                                        onClick={handleLogout}
                                        className="block w-full text-left px-4 py-3 text-base font-medium text-red-600 hover:bg-red-50 transition-colors"
                                    >
                                        Déconnexion
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </nav>
    );
}
export default Navbar;