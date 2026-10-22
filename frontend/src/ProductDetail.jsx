import { useState, useEffect, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { ShoppingCart, Heart, CheckCircle2, AlertTriangle, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import useCartStore from "./store/cartStore";
import useAuth from "./store/useAuth";
import { apiFetch } from "./lib/api";
import ReviewForm from "./components/ReviewForm";
import NoReviews from "./components/NoReviews";

function ProductDetail() {
    const addToCart = useCartStore((state) => state.addProductToCart);
    const cart = useCartStore((state) => state.cart);
    const wish = useCartStore((state) => state.wish);
    const handleWish = useCartStore((state) => state.handleWish);
    const clearWish = useCartStore((state) => state.clearWish);

    const { id } = useParams();

    // Produit
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Avis
    const [reviews, setReviews] = useState([]);
    const [loadingReviews, setLoadingReviews] = useState(true);
    const [errorReviews, setErrorReviews] = useState(null);
    const [showReviewForm, setShowReviewForm] = useState(false);

    // Produits similaires
    const [produitSimilaire, setProduitSimilaire] = useState([]);

    const [quantity, setQuantity] = useState(1);
    const [images, setImage] = useState(0);
    const [ratingFilter, setRatingFilter] = useState(0);

    // Résumé IA des avis (GET /api/products/:id/review-summary, Groq côté serveur)
    // status : "idle" (pas d'avis) | "loading" | "ready" | "error" (bloc masqué)
    const [aiSummary, setAiSummary] = useState({ status: "idle", pros: [], cons: [], ratingSummary: "" });

    const containerRef = useRef(null);
    const [isHovering, setIsHovering] = useState(false);
    const [bgPos, setBgPos] = useState({ x: 0, y: 0 });
    const zoom = 2.5;

    const handleMouseMove = (e) => {
        const rect = containerRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        setBgPos({ x, y });
    };

    // Quantité entre 1 et le stock disponible
    const stock = Number(product?.stock) || 0;
    const outOfStock = stock <= 0;
    const handleQuantityPlus = () => {
        setQuantity((q) => Math.min(q + 1, Math.max(stock, 1)));
    };
    const handleQuantityMinus = () => {
        setQuantity((q) => Math.max(q - 1, 1));
    };

    const handleImage = (index) => {
        setImage(index);
    };

    // Récupère le détail du produit via GET /api/products/:id
    useEffect(() => {
        if (!id) return;

        let cancelled = false;
        setLoading(true);
        setError(null);
        setProduct(null);
        setImage(0);

        async function loadProduct() {
            try {
                const response = await fetch(`/api/products/${id}`);
                const data = await response.json();

                if (cancelled) return;

                if (response.status === 404 || response.status === 400) {
                    setError("Produit introuvable.");
                    setLoading(false);
                    return;
                }

                if (!response.ok) {
                    setError(data?.message || "Erreur lors du chargement du produit.");
                    setLoading(false);
                    return;
                }

                // { success, data: { product } }
                const p = data?.data?.product || data?.product || null;
                if (!p) {
                    setError("Produit introuvable.");
                } else {
                    setProduct(p);
                }
            } catch (err) {
                if (!cancelled) {
                    console.error("Erreur chargement produit:", err);
                    setError("Erreur réseau. Veuillez réessayer.");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        loadProduct();
        return () => {
            cancelled = true;
        };
    }, [id]);

    // Enregistre la consultation (POST /events/view) pour alimenter "Vous aimerez aussi".
    // Utilisateurs connectés uniquement ; une seule fois par produit (le ref évite le
    // double envoi du double rendu de React StrictMode en développement).
    const isAuthenticated = useAuth((state) => state.isAuthenticated);
    const currentUser = useAuth((state) => state.user);
    const loggedViewRef = useRef(null);
    useEffect(() => {
        if (!isAuthenticated || !product?.id || loggedViewRef.current === product.id) return;
        loggedViewRef.current = product.id;

        apiFetch("/events/view", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ product_id: product.id }),
        })
            .then((response) => {
                if (!response.ok) console.error("events/view error: HTTP", response.status);
            })
            .catch((err) => console.error("events/view error:", err));
    }, [isAuthenticated, product?.id]);

    // Résumé IA : recalculé quand la liste des avis change (chargement, nouvel avis).
    // Le serveur garde le résumé en cache tant que les avis ne changent pas.
    const reviewsKey = reviews.map((r) => r.id).join(",");
    useEffect(() => {
        if (!id || loadingReviews || reviewsKey === "") {
            setAiSummary({ status: "idle", pros: [], cons: [], ratingSummary: "" });
            return;
        }

        let cancelled = false;
        setAiSummary((prev) => ({ ...prev, status: "loading" }));

        async function loadAiSummary() {
            try {
                const response = await fetch(`/api/products/${id}/review-summary`);
                const data = await response.json();
                if (cancelled) return;
                if (!response.ok) throw new Error(data?.message || `HTTP ${response.status}`);

                const summary = data?.data?.summary ?? {};
                setAiSummary({
                    status: "ready",
                    pros: summary.pros ?? [],
                    cons: summary.cons ?? [],
                    ratingSummary: summary.rating_summary ?? "",
                });
            } catch (err) {
                if (!cancelled) {
                    console.error("review-summary error:", err);
                    setAiSummary({ status: "error", pros: [], cons: [], ratingSummary: "" });
                }
            }
        }

        loadAiSummary();
        return () => { cancelled = true; };
    }, [id, loadingReviews, reviewsKey]);

    // Récupère les avis via GET /api/products/:id/reviews?limit=50 (indépendant du produit)
    useEffect(() => {
        if (!id) return;

        let cancelled = false;
        setLoadingReviews(true);
        setErrorReviews(null);
        setReviews([]);
        setShowReviewForm(false);

        async function loadReviews() {
            try {
                const response = await fetch(`/api/products/${id}/reviews?limit=50`);
                const data = await response.json();

                if (cancelled) return;

                if (!response.ok) {
                    setErrorReviews(data?.message || "Erreur lors du chargement des avis.");
                    return;
                }

                // { success, data: { reviews: [{ id, rating, comment, createdAt, user }] , stats } }
                const list = data?.data?.reviews ?? data?.reviews ?? [];
                setReviews(list);
            } catch (err) {
                if (!cancelled) {
                    console.error("Erreur chargement avis:", err);
                    setErrorReviews("Erreur réseau. Veuillez réessayer.");
                }
            } finally {
                if (!cancelled) setLoadingReviews(false);
            }
        }

        loadReviews();
        return () => {
            cancelled = true;
        };
    }, [id]);

    // Produits similaires : GET /recommendations/similar/:id (4 meilleurs scores :
    // même catégorie, tags communs, prix proche), une fois le produit chargé
    useEffect(() => {
        if (!product?.id) {
            setProduitSimilaire([]);
            return;
        }

        let cancelled = false;

        async function loadSimilar() {
            try {
                const response = await fetch(`/recommendations/similar/${product.id}`);
                const data = await response.json();
                if (cancelled) return;
                if (!response.ok) {
                    setProduitSimilaire([]);
                    return;
                }
                setProduitSimilaire(data?.data?.similarProducts ?? []);
            } catch (err) {
                if (!cancelled) {
                    console.error("Erreur chargement produits similaires:", err);
                    setProduitSimilaire([]);
                }
            }
        }

        loadSimilar();
        return () => {
            cancelled = true;
        };
    }, [product?.id]);

    const wished = wish.some((item) => item.id === product?.id);

    if (loading) {
        return <p className="text-center text-gray-500 py-20">Chargement...</p>;
    }

    if (error) {
        return <p className="text-center text-gray-500 py-20">{error}</p>;
    }

    if (!product) {
        return <p className="text-center text-gray-500 py-20">Produit introuvable.</p>;
    }

    // Sécurité : s'assurer qu'`images` est bien un tableau
    const productImages = Array.isArray(product.images) ? product.images : [];

    const totalReviews = reviews.length;
    const avgRating = totalReviews
        ? (reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / totalReviews).toFixed(1)
        : 0;
    const ratingCounts = [5, 4, 3, 2, 1].map((star) => ({
        star,
        count: reviews.filter((r) => Math.round(Number(r.rating) || 0) === star).length,
    }));
    const filteredReviews = ratingFilter === 0
        ? reviews
        : reviews.filter((r) => Math.round(Number(r.rating) || 0) === ratingFilter);
    // Le backend refuse un 2e avis (409) ; on masque le bouton si le sien est déjà dans la liste.
    const hasReviewed = !!currentUser?.id && reviews.some((r) => r.user?.id === currentUser.id);

    function handleReviewCreated(review) {
        setShowReviewForm(false);
        if (review) setReviews((prev) => [review, ...prev]);
    }

    return (
        <div className="max-w-7xl mx-auto px-2 py-8">
            <nav className="flex items-center gap-1.5 text-xs text-gray-500 ">
                <Link to="/" className="hover:text-gray-900">Acceuil</Link>
                <span>/</span>
                <Link to="/products" className="hover:text-gray-900">Produits</Link>
                <span>/</span>
                <p>{product.name}</p>
            </nav>
            <div>
                <div className="mt-8">

                    <div className="grid grid-cols-2 gap-16 lg:grid-cols-2">
                        <div>
                            <div
                                ref={containerRef}
                                onMouseEnter={() => setIsHovering(true)}
                                onMouseLeave={() => setIsHovering(false)}
                                onMouseMove={handleMouseMove}
                                className="relative bg-gray-50 border border-gray-200 rounded-3xl h-[500px] overflow-hidden cursor-crosshair"
                            >
                                <img
                                    src={productImages[images]}
                                    alt={product.name}
                                    className="w-full h-full object-cover rounded-xl transition-transform duration-150 ease-out"
                                    style={{
                                        transform: isHovering ? `scale(${zoom})` : "scale(1)",
                                        transformOrigin: `${bgPos.x}% ${bgPos.y}%`,
                                    }}
                                />
                            </div>

                            <div className="flex gap-4 mt-5">
                                {productImages.map((img, index) => (
                                    <button
                                        key={index}
                                        onClick={() => handleImage(index)}
                                        className={`w-16 h-16 rounded-xl border flex items-center justify-center
                                            ${
                                                images === index
                                                ? "border-2 border-indigo-500"
                                                : "border-gray-200 hover:border-indigo-400"
                                            }`}
                                    >
                                        <img
                                            src={img}
                                            alt={`${product.name} - image ${index + 1}`}
                                            className="w-9 object-contain rounded-xl"
                                        />
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* RIGHT */}
                        <div>
                            <div className="flex items-center gap-3">
                                <p className="uppercase tracking-widest text-xs text-gray-400 font-semibold">
                                    {product.category?.name || "Catégorie"}
                                </p>
                            </div>
                            <h1 className="font-bold text-5xl mt-5">
                                {product.name}
                            </h1>
                            <div className="flex items-center gap-2 mt-5">
                                {Number(product.ratingAvg) > 0 ? (
                                    <>
                                        <span className="text-yellow-400 text-lg">
                                            {"⭐".repeat(Math.round(Number(product.ratingAvg)))}
                                        </span>
                                        <span className="text-gray-600">
                                            {Number(product.ratingAvg)}
                                        </span>
                                        <span className="text-gray-400">
                                            • {totalReviews} avis
                                        </span>
                                    </>
                                ) : (
                                    <NoReviews className="text-base" />
                                )}
                            </div>
                            <h2 className="font-bold text-5xl mt-8">
                                {product.price} €
                            </h2>
                            <p className="text-gray-600 leading-8 mt-7">
                                {product.description}
                            </p>
                            <div className="flex items-center gap-2 mt-7">
                                {outOfStock ? (
                                    <p className="text-red-600 font-medium">Rupture de stock</p>
                                ) : (
                                    <>
                                        <CheckCircle2
                                            size={18}
                                            className="text-green-600"
                                        />
                                        <p className="text-green-600 font-medium">
                                            En stock ({product.stock} disponibles)
                                        </p>
                                    </>
                                )}
                            </div>

                            {/* Buttons */}
                            <div className="flex gap-4 mt-8">
                                <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                                    <button className="px-5 py-4 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent" onClick={handleQuantityMinus} disabled={quantity <= 1}>
                                        -
                                    </button>
                                    <span className="px-5 font-medium">
                                        {quantity}
                                    </span>
                                    <button className="px-5 py-4 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent" onClick={handleQuantityPlus} disabled={outOfStock || quantity >= stock}>
                                        +
                                    </button>
                                </div>

                                <button className="flex-1 bg-slate-900 text-white rounded-xl flex items-center justify-center gap-2 font-semibold hover:bg-indigo-600 transition disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-900" onClick={() => addToCart(product, quantity)} disabled={outOfStock}>
                                    <ShoppingCart size={18} />
                                    {outOfStock ? "Indisponible" : "Ajouter au panier"}
                                </button>
                                <button className={`w-14 h-14 border rounded-xl flex items-center justify-center transition
                                        ${
                                          wished ? "bg-red-500 text-white border-red-500" : "border-gray-200 hover:bg-red-500 hover:text-white"
                                     }`} onClick={() => handleWish(product)}>
                                    <Heart size={18} fill={wished ? "currentColor" : "none"} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-9">
                <div className="flex items-center justify-between mt-10">
                    <h2 className="text-2xl font-bold text-gray-900">
                        Avis clients
                    </h2>
                    {!isAuthenticated ? (
                        <Link to="/login" className="text-sm text-indigo-600 hover:text-indigo-700">
                            Connectez-vous pour laisser un avis
                        </Link>
                    ) : hasReviewed ? (
                        <span className="text-sm text-gray-500">Vous avez déjà donné votre avis</span>
                    ) : !showReviewForm && (
                        <button
                            type="button"
                            onClick={() => setShowReviewForm(true)}
                            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700"
                        >
                            Rédiger un avis
                        </button>
                    )}
                </div>

                {showReviewForm && isAuthenticated && !hasReviewed && (
                    <ReviewForm
                        productId={product.id}
                        onCreated={handleReviewCreated}
                        onCancel={() => setShowReviewForm(false)}
                    />
                )}

                {/* Note globale + répartition par étoile, cliquable pour filtrer */}
                <div className="flex flex-col md:flex-row gap-8 mt-6 bg-white border border-gray-200 rounded-2xl p-6">
                    <div className="flex flex-col items-center justify-center md:w-48 md:border-r md:border-gray-100">
                        <span className="text-5xl font-bold text-gray-900">{avgRating}</span>
                        {totalReviews > 0 ? (
                            <>
                                <span className="text-yellow-400 text-lg mt-1">{"⭐".repeat(Math.round(Number(avgRating)))}</span>
                                <span className="text-gray-500 text-sm mt-1">{totalReviews} avis</span>
                            </>
                        ) : (
                            <NoReviews className="flex-col mt-1" />
                        )}
                    </div>

                    <div className="flex-1 flex flex-col gap-2 justify-center">
                        {ratingCounts.map(({ star, count }) => (
                            <button
                                key={star}
                                onClick={() => setRatingFilter(ratingFilter === star ? 0 : star)}
                                className="flex items-center gap-3 text-sm w-full"
                            >
                                <span className={`w-10 text-left ${ratingFilter === star ? "font-semibold text-indigo-600" : "text-gray-600"}`}>
                                    {star} ⭐
                                </span>
                                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full transition-all ${ratingFilter === star ? "bg-indigo-500" : "bg-yellow-400"}`}
                                        style={{ width: `${totalReviews ? (count / totalReviews) * 100 : 0}%` }}
                                    />
                                </div>
                                <span className="w-8 text-gray-400 text-right">{count}</span>
                            </button>
                        ))}
                        {ratingFilter !== 0 && (
                            <button
                                onClick={() => setRatingFilter(0)}
                                className="text-xs text-indigo-600 self-start mt-1 hover:underline"
                            >
                                Réinitialiser le filtre
                            </button>
                        )}
                    </div>
                </div>

                {/* pros/cons */}
                {aiSummary.status === "loading" && (
                    <div className="mt-6 bg-indigo-50 border border-indigo-100 rounded-2xl p-6 flex items-center gap-2 text-sm text-indigo-700">
                        <Sparkles size={18} className="text-indigo-600 animate-pulse" />
                        Analyse des avis…
                    </div>
                )}
                {aiSummary.status === "ready" && (aiSummary.pros.length > 0 || aiSummary.cons.length > 0 || aiSummary.ratingSummary) && (
                    <div className="mt-6 bg-indigo-50 border border-indigo-100 rounded-2xl p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Sparkles size={18} className="text-indigo-600" />
                            <h3 className="font-semibold text-indigo-900">Résumé généré par IA</h3>
                        </div>
                        {aiSummary.ratingSummary && (
                            <p className="text-sm text-gray-700 mb-4">{aiSummary.ratingSummary}</p>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <p className="text-sm font-medium text-green-700 mb-2">Points forts</p>
                                <ul className="space-y-1.5 text-sm text-gray-700">
                                    {aiSummary.pros.length > 0 ? aiSummary.pros.map((p, i) => (
                                        <li key={i} className="flex items-start gap-2">
                                            <CheckCircle2 size={14} className="text-green-600 mt-0.5 shrink-0" />
                                            {p}
                                        </li>
                                    )) : <li className="text-gray-400">Pas assez d'avis pour dégager une tendance.</li>}
                                </ul>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-red-700 mb-2">Points faibles</p>
                                <ul className="space-y-1.5 text-sm text-gray-700">
                                    {aiSummary.cons.length > 0 ? aiSummary.cons.map((c, i) => (
                                        <li key={i} className="flex items-start gap-2">
                                            <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
                                            {c}
                                        </li>
                                    )) : <li className="text-gray-400">Aucun point négatif majeur relevé.</li>}
                                </ul>
                            </div>
                        </div>
                    </div>
                )}

                {/* filtre note */}
                {!loadingReviews && filteredReviews.length === 0 && (
                    <p className="text-gray-400 text-sm mt-6">Aucun avis pour cette note.</p>
                )}

                {loadingReviews && (
                    <p className="text-gray-400 text-sm mt-6">Chargement des avis...</p>
                )}

                {errorReviews && (
                    <p className="text-gray-400 text-sm mt-6">{errorReviews}</p>
                )}

                {filteredReviews.map((review) => {
                    const rating = Number(review.rating) || 0;
                    const dateText = review.createdAt
                        ? new Date(review.createdAt).toLocaleDateString("fr-FR", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                          })
                        : "";
                    return (
                        <div key={review.id} className="bg-gray-100 border border-gray-100 rounded-xl p-4 mt-3">
                            <div className="flex items-center justify-between mt-4">
                                <h3 className="font-semibold text-gray-900">
                                    {review.user?.name || "Utilisateur anonyme"}
                                </h3>
                                <p className="text-gray-600 text-sm">{dateText}</p>
                            </div>
                            <div>
                                <span className="text-yellow-400 text-sm">
                                    {"⭐".repeat(Math.round(rating))}
                                </span>
                                <span className="text-gray-600 text-sm ml-1">
                                    {rating}
                                </span>
                                <p className="mt-2">{review.comment}</p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Section masquée s'il n'y a aucun produit similaire */}
            {produitSimilaire.length > 0 && (
            <>
            <div className="mt-10">
                <h2 className="text-2xl font-bold text-gray-900">Produits similaires</h2>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
                {produitSimilaire.map((p) => {
                    return (
                        <Link
                            key={p.id}
                            to={`/product-detail/${p.id}`}
                            className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition"
                        >
                            <img
                                src={p.image}
                                alt={p.name}
                                className="w-full h-52 object-cover"
                            />
                            <div className="p-4">
                                <h3 className="font-semibold">
                                    {p.name}
                                </h3>
                                <p className="text-gray-500 text-sm">
                                    {p.category?.name || ""}
                                </p>
                                <div className="flex justify-between mt-3">
                                    <span className="font-bold">
                                        {p.price} €
                                    </span>
                                    {Number(p.ratingAvg) > 0 ? (
                                        <span>
                                            ⭐ {Number(p.ratingAvg)}
                                        </span>
                                    ) : (
                                        <NoReviews />
                                    )}
                                </div>
                            </div>
                        </Link>
                    );
                })}
            </div>
            </>
            )}
        </div>
    );
}

export default ProductDetail;

