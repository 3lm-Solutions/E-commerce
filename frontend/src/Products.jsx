import { SlidersHorizontal, ArrowUpDown, Sparkles, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import NoReviews from './components/NoReviews';

// Nouveaux composants UX/UI
import { ProductGridSkeleton, LazyImage, SearchInput, AnimatedContainer } from './components';

// Normalise les champs pour correspondre à l'affichage attendu
// (image -> images, rating -> ratingAvg, category objet -> string).
// Utilisé pour /api/products et pour les résultats de /search/nlp.
function normalizeProduct(product) {
    const category =
        typeof product.category === "string"
            ? product.category
            : product.category?.name ?? "";

    const images = product.images ?? product.image ?? [];

    return {
        ...product,
        image: Array.isArray(images) ? images[0] : images,
        rating: product.rating ?? product.ratingAvg ?? 0,
        category,
    };
}

// Date de création en millisecondes (0 si absente) pour le tri « Nouveautés »
function createdTime(product) {
    const time = Date.parse(product.createdAt ?? product.created_at ?? "");
    return Number.isNaN(time) ? 0 : time;
}

// Popularité : nombre d'avis, puis note
function comparePopularity(a, b) {
    return (Number(b.ratingCount) || 0) - (Number(a.ratingCount) || 0) || b.rating - a.rating;
}

// Texte du bandeau décrivant les filtres extraits par la recherche NLP
function describeNlpFilters(filters) {
    if (!filters) return [];
    const parts = [];
    if (filters.category) parts.push(`Catégorie : ${filters.category}`);
    if (filters.min_price !== null && filters.min_price !== undefined) parts.push(`Prix min : ${filters.min_price} €`);
    if (filters.max_price !== null && filters.max_price !== undefined) parts.push(`Prix max : ${filters.max_price} €`);
    if (Array.isArray(filters.tags) && filters.tags.length > 0) parts.push(`Mots-clés : ${filters.tags.join(", ")}`);
    return parts;
}

function Products() {

    const [page, setPage] = useState(1);
    // ?category=... : lien depuis les catégories de l'accueil
    const [searchParams] = useSearchParams();
    const categoryParam = searchParams.get("category");
    const [category, setCategory] = useState(categoryParam || "Tout");
    const [categories, setCategories] = useState([{ id: "all", name: "Tout" }]);
    const [priceMax, setPriceMax] = useState(null); // null : pas de limite de prix
    const [rating, setRating] = useState(0);

    const [products, setProducts] = useState([]);
    const [search, setSearch] = useState("");
    // Changer la clé remonte SearchInput, ce qui vide son champ (Réinitialiser)
    const [searchKey, setSearchKey] = useState(0);
    const [sort, setSort] = useState("populaire");
    const [isLoading, setIsLoading] = useState(true);

    const [currentPage, setCurrentPage] = useState(1);
    // 3 colonnes sur desktop (cahier 06 §2.2) : 3 rangées complètes par page
    const productsPerPage = 9;

    const lastProduct = productsPerPage * currentPage;
    const firstProduct = lastProduct - productsPerPage;
    const [productsError, setProductsError] = useState(null);

    // Le backend pagine (10 par défaut, 50 maximum) alors que les filtres et la
    // pagination de cette page travaillent sur tout le catalogue : on charge
    // toutes les pages de 50.
    useEffect(() => {
        let cancelled = false;
        const PAGE_SIZE = 50;
        const MAX_PAGES = 20; // garde-fou contre une réponse incohérente

        async function loadProducts() {
            setIsLoading(true);
            try {
                const all = [];
                for (let page = 1; page <= MAX_PAGES; page++) {
                    const response = await fetch(`/api/products?limit=${PAGE_SIZE}&page=${page}`);
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    const data = await response.json();

                    // La réponse peut venir soit du mock MSW (tableau direct),
                    // soit du backend réel ({ data: { products: [...], pagination } }).
                    if (Array.isArray(data)) {
                        all.push(...data);
                        break;
                    }
                    all.push(...(data?.data?.products ?? data?.products ?? []));
                    if (!data?.data?.pagination?.hasNext) break;
                }
                if (!cancelled) {
                    setProducts(all.map(normalizeProduct));
                    setProductsError(null);
                }
            } catch (err) {
                console.error("Erreur chargement produits:", err);
                if (!cancelled) setProductsError("Impossible de charger les produits. Veuillez réessayer.");
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        }

        loadProducts();
        return () => { cancelled = true; };
    }, []);

    // Le lien peut changer sans remonter la page (ex. retour arrière) : on suit l'URL.
    useEffect(() => {
        setCategory(categoryParam || "Tout");
    }, [categoryParam]);

    // Catégories réelles (GET /api/categories). En cas d'échec, seul « Tout » reste.
    useEffect(() => {
        let cancelled = false;
        async function loadCategories() {
            try {
                const response = await fetch("/api/categories");
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const data = await response.json();
                // Mock MSW : tableau direct (avec « Tout ») ; backend : { data: { categories } }
                const list = Array.isArray(data) ? data : data?.data?.categories ?? [];
                if (!cancelled) {
                    setCategories([
                        { id: "all", name: "Tout" },
                        ...list.filter((cat) => cat.name !== "Tout"),
                    ]);
                }
            } catch (err) {
                console.error("Erreur chargement catégories:", err);
            }
        }
        loadCategories();
        return () => { cancelled = true; };
    }, []);

    // Recherche en langage naturel (POST /search/nlp).
    // nlpResult === null : on affiche le catalogue complet.
    const [nlpQuery, setNlpQuery] = useState("");
    const [nlpResult, setNlpResult] = useState(null);
    const [nlpLoading, setNlpLoading] = useState(false);
    const [nlpError, setNlpError] = useState(null);

    const handleNlpSearch = async (e) => {
        e.preventDefault();
        const query = nlpQuery.trim();
        if (!query) return;

        setNlpLoading(true);
        setNlpError(null);
        try {
            const response = await fetch("/search/nlp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data?.message || "Erreur lors de la recherche");
            }
            setNlpResult({
                ...data.data,
                products: (data.data?.products ?? []).map(normalizeProduct),
            });
            // Les résultats arrivent classés par pertinence : on garde cet ordre
            setSort("pertinence");
        } catch (err) {
            console.error("search/nlp error:", err);
            setNlpError("La recherche intelligente a échoué. Veuillez réessayer.");
        } finally {
            setNlpLoading(false);
        }
    };

    const clearNlpSearch = () => {
        setNlpQuery("");
        setNlpResult(null);
        setNlpError(null);
        // « Pertinence » n'existe que pendant une recherche intelligente
        setSort((current) => (current === "pertinence" ? "populaire" : current));
    };

    useEffect(() => {
        setCurrentPage(1);
    }, [category, rating, search, sort, priceMax, nlpResult]);

    const ratings = [
        { label: "Tout", value: 0 },
        { label: "⭐ 4+", value: 4 },
        { label: "⭐ 4.5+", value: 4.5 },
        { label: "⭐ 4.9+", value: 4.9 }
    ];

    function reset() {
        setPage(1);
        setCategory("Tout");
        setPriceMax(null);
        setRating(0);
        setSearch("");
        setSearchKey((key) => key + 1);
    }

    const changePrice = (e) => {
        setPriceMax(Number(e.target.value));
        setPage(1);
    };

    const handleSearch = (searchQuery) => {
        setSearch(searchQuery);
    };

    const handleSort = (e) => {
        setSort(e.target.value);
    };

    // Borne haute du curseur de prix : prix du produit le plus cher affiché (catalogue ou recherche)
    const sliderMax = Math.ceil(
        Math.max(0, ...products.map((p) => Number(p.price) || 0), ...(nlpResult?.products ?? []).map((p) => Number(p.price) || 0))
    );

    const filteredProducts = (nlpResult ? nlpResult.products : products)
        .filter((product) => {
            if (priceMax !== null && Number(product.price) > priceMax) return false;
            if (product.rating < rating) return false;
            if (!product.name.toLowerCase().includes(search.toLowerCase()))
                return false;

            if (category === "Tout") return true;

            return product.category === category;
        })
        .sort((a, b) => {
            if (sort === "prixC") return a.price - b.price;
            if (sort === "prixD") return b.price - a.price;
            if (sort === "topR") return b.rating - a.rating;
            // Pertinence : ordre renvoyé par la recherche NLP
            if (sort === "pertinence") return 0;
            // Nouveautés : à date égale (produits insérés ensemble), les plus populaires d'abord
            if (sort === "nouveautes") return createdTime(b) - createdTime(a) || comparePopularity(a, b);
            return comparePopularity(a, b);
        });

    const currentProduct = filteredProducts.slice(firstProduct, lastProduct);
    const totalPages = Math.ceil(filteredProducts.length / productsPerPage);

    if (isLoading) {
        return (
            <div className="max-w-7xl mx-auto px-4 py-8">
                <div className="flex gap-8">
                    {/* Sidebar skeleton */}
                    <div className="w-64 bg-white rounded-2xl border border-gray-200 p-6 h-fit">
                        <div className="animate-pulse space-y-4">
                            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                            <div className="space-y-2">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className="h-8 bg-gray-200 rounded"></div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Products skeleton */}
                    <div className="flex-1">
                        <div className="mb-8 space-y-4">
                            <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
                        </div>
                        <ProductGridSkeleton count={productsPerPage} />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <AnimatedContainer animation="fadeIn" className="max-w-7xl mx-auto px-4 py-8 flex gap-8">

            {/* Sidebar avec animations */}
            <AnimatedContainer
                animation="slideRight"
                delay={100}
                className="w-64 bg-white rounded-2xl border border-gray-200 p-6 h-fit sticky top-6"
            >
                <div className="flex items-center gap-1.5">
                    <SlidersHorizontal size={14} className="text-gray-400" />
                    <h3 className="text-sm font-semibold text-gray-900">
                        Filtres
                    </h3>
                    <button
                        onClick={reset}
                        className="ml-auto text-xs text-indigo-500 hover:text-indigo-600 font-medium transition-colors"
                    >
                        Réinitialiser
                    </button>
                </div>

                {/* Categories */}
                <div className="mt-6">
                    <h3 className="mb-3 text-sm font-semibold text-gray-600">
                        Catégorie
                    </h3>
                    {categories.map((cat) => (
                        <div key={cat.id}>
                            <button
                                onClick={() => {
                                    setCategory(cat.name);
                                    setPage(1);
                                }}
                                className={`
                                    w-full text-left rounded-lg px-3 py-2 text-xs font-medium
                                    transition-all duration-200 hover:scale-105
                                    ${category === cat.name
                                        ? "bg-indigo-50 text-indigo-600 shadow-sm"
                                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                    }
                                `}
                            >
                                {cat.name}
                            </button>
                        </div>
                    ))}
                </div>

                {/* Price */}
                <div className="mt-6">
                    <h3 className="text-sm text-gray-600 font-semibold">
                        Prix max — {priceMax ?? sliderMax} €
                    </h3>
                    <input
                        type="range"
                        min={0}
                        max={sliderMax}
                        value={priceMax ?? sliderMax}
                        onChange={changePrice}
                        className="w-full accent-indigo-500 h-1 mt-2 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                        <span>0 €</span>
                        <span>{sliderMax} €</span>
                    </div>
                </div>

                {/* Rating */}
                <div className="mt-6">
                    <h3 className="mb-3 text-sm font-semibold text-gray-600">
                        Note minimum
                    </h3>
                    {ratings.map((rate) => (
                        <div key={rate.value}>
                            <button
                                onClick={() => {
                                    setRating(rate.value);
                                    setPage(1);
                                }}
                                className={`
                                    w-full text-left rounded-lg px-3 py-2 text-xs font-medium
                                    transition-all duration-200 hover:scale-105
                                    ${rating === rate.value
                                        ? "bg-indigo-50 text-indigo-600 shadow-sm"
                                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                    }
                                `}
                            >
                                {rate.label}
                            </button>
                        </div>
                    ))}
                </div>
            </AnimatedContainer>

            <div className="flex-1">
                <AnimatedContainer animation="slideUp" delay={200}>
                    <div className="flex gap-4 mb-4">
                        {/* Recherche par nom */}
                        <div className="flex-1">
                            <SearchInput
                                key={searchKey}
                                placeholder="Rechercher un produit..."
                                onSearch={handleSearch}
                                showHistory={true}
                                showSuggestions={false}
                                className="w-full"
                            />
                        </div>

                        {/* Sort */}
                        <div className="relative">
                            <ArrowUpDown
                                size={13}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                            />
                            <select
                                className="pl-8 pr-4 py-3 border border-gray-200 rounded-lg text-sm outline-none bg-white cursor-pointer text-gray-600 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                value={sort}
                                onChange={handleSort}
                            >
                                {nlpResult && <option value="pertinence">Pertinence</option>}
                                <option value="populaire">Popularité</option>
                                <option value="nouveautes">Nouveautés</option>
                                <option value="prixC">Prix croissant</option>
                                <option value="prixD">Prix décroissant</option>
                                <option value="topR">Meilleure note</option>
                            </select>
                        </div>
                    </div>

                    {/* Recherche en langage naturel */}
                    <form onSubmit={handleNlpSearch} className="flex gap-4 mb-4">
                        <div className="relative flex-1">
                            <Sparkles
                                size={14}
                                className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400"
                            />
                            <input
                                type="text"
                                placeholder='Recherche intelligente : "un livre de programmation à moins de 45 €"'
                                className="w-full border border-gray-300 rounded-lg py-3 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                onChange={(e) => setNlpQuery(e.target.value)}
                                value={nlpQuery}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={nlpLoading || !nlpQuery.trim()}
                            className="text-sm bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-indigo-600 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {nlpLoading ? "Recherche..." : "Rechercher"}
                        </button>
                    </form>
                </AnimatedContainer>

                {nlpError && (
                    <p className="text-xs text-red-500 mb-4">{nlpError}</p>
                )}

                {productsError && (
                    <p className="text-sm text-red-500 mb-4">{productsError}</p>
                )}

                {nlpResult && (
                    <div className="flex items-start gap-3 bg-indigo-50 text-indigo-700 rounded-lg px-4 py-3 mb-8 text-xs">
                        <div className="flex-1">
                            <p className="font-medium">
                                {nlpResult.count} résultat{nlpResult.count > 1 ? "s" : ""} pour « {nlpResult.query} »
                            </p>
                            {describeNlpFilters(nlpResult.filtersUsed).length > 0 && (
                                <p className="mt-1">{describeNlpFilters(nlpResult.filtersUsed).join(" · ")}</p>
                            )}
                            {nlpResult.categoryRelaxed && (
                                <p className="mt-1 text-indigo-500">Aucun produit dans cette catégorie, résultats élargis à tout le catalogue.</p>
                            )}
                            {nlpResult.source === "fallback" && (
                                <p className="mt-1 text-indigo-500">Recherche intelligente indisponible, résultats de la recherche classique.</p>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={clearNlpSearch}
                            className="flex items-center gap-1 text-indigo-500 hover:text-indigo-600 font-medium"
                        >
                            <X size={12} /> Effacer
                        </button>
                    </div>
                )}

                {!nlpResult && <div className="mb-4" />}

                {/* Grille des produits : 3 colonnes sur desktop (cahier 06 §2.2) */}
                <AnimatedContainer animation="slideUp" delay={300}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredProducts.length === 0 ? (
                            <div className="col-span-full text-center py-20">
                                <div className="animate-bounce mb-4">🔍</div>
                                <h2 className="text-3xl font-bold text-gray-700">Aucun produit trouvé</h2>
                                <p className="text-gray-500 mt-2">
                                    Essayez de modifier vos filtres ou votre recherche.
                                </p>
                                <button
                                    onClick={reset}
                                    className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                                >
                                    Réinitialiser les filtres
                                </button>
                            </div>
                        ) : (
                            currentProduct.map((product, index) => (
                                <AnimatedContainer
                                    key={product.id}
                                    animation="scaleIn"
                                    delay={index * 100}
                                    className="stagger-item"
                                >
                                    <Link
                                        to={`/product-detail/${product.id}`}
                                        className="block group"
                                    >
                                        <div className="product-card hover-lift">
                                            <div className="product-card-image">
                                                <LazyImage
                                                    src={product.image}
                                                    alt={product.name}
                                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                                />
                                            </div>

                                            <div className="p-4">
                                                <h3 className="font-semibold text-gray-900 text-sm group-hover:text-indigo-600 transition-colors">
                                                    {product.name}
                                                </h3>

                                                <p className="text-xs text-gray-500 mt-1">
                                                    {product.category}
                                                </p>

                                                <div className="flex justify-between items-center mt-4">
                                                    <span className="text-indigo-600 font-bold">
                                                        {product.price} €
                                                    </span>

                                                    {Number(product.rating) > 0 ? (
                                                        <span className="text-yellow-500 text-sm flex items-center gap-1">
                                                            ⭐ {product.rating}
                                                        </span>
                                                    ) : (
                                                        <NoReviews />
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                </AnimatedContainer>
                            ))
                        )}
                    </div>
                </AnimatedContainer>

                {/* Pagination améliorée */}
                {totalPages > 1 && (
                    <AnimatedContainer animation="slideUp" delay={400}>
                        <div className='flex items-center justify-center mt-8 gap-2'>
                            <button
                                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Précédent
                            </button>

                            {[...Array(totalPages)].map((_, index) => (
                                <button
                                    key={index}
                                    onClick={() => setCurrentPage(index + 1)}
                                    className={`
                                        w-10 h-10 rounded-xl text-sm font-medium transition-all duration-200
                                        ${currentPage === index + 1
                                            ? "bg-indigo-600 text-white shadow-md scale-110"
                                            : "bg-gray-100 hover:bg-gray-200 text-gray-700 hover:scale-105"
                                        }
                                    `}
                                >
                                    {index + 1}
                                </button>
                            ))}

                            <button
                                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Suivant
                            </button>
                        </div>
                    </AnimatedContainer>
                )}
            </div>
        </AnimatedContainer>
    );
}

export default Products;
