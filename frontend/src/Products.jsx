import { SlidersHorizontal, Search, ArrowUpDown } from 'lucide-react';
import { categories } from './mocks/data';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

// Nouveaux composants UX/UI
import { ProductGridSkeleton, LazyImage, SearchInput, AnimatedContainer } from './components';
import { useSearchDebounce } from './components/SearchInput';

function Products() {

    const [page, setPage] = useState(1);
    const [category, setCategory] = useState("Tout");
    const [priceMax, setPriceMax] = useState(200);
    const [rating, setRating] = useState(0);

    const [products, setProducts] = useState([]);
    const [search, setSearch] = useState("");
    const [sort, setSort] = useState("populaire");
    const [isLoading, setIsLoading] = useState(true);
    
    const [currentPage, setCurrentPage] = useState(1);
    const productsPerPage = 8;

    const lastProduct = productsPerPage * currentPage;
    const firstProduct = lastProduct - productsPerPage;

    // Recherche avec debouncing
    const { searchTerm, setSearchTerm, isSearching } = useSearchDebounce(async (term) => {
        setSearch(term);
    }, 300);

    useEffect(() => {
        async function loadProducts() {
            setIsLoading(true);
            try {
                const response = await fetch("/api/products");
                const data = await response.json();

                // La réponse peut venir soit du mock MSW (tableau direct),
                // soit du backend réel ({ data: { products: [...] } }).
                const rawList = Array.isArray(data)
                    ? data
                    : data?.data?.products ?? data?.products ?? [];

                // Normalise les champs pour correspondre à l'affichage attendu
                // (image -> images, rating -> ratingAvg, category objet -> string).
                const normalized = rawList.map((product) => {
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
                });

                setProducts(normalized);
            } catch (error) {
                console.error('Erreur lors du chargement des produits:', error);
            } finally {
                setIsLoading(false);
            }
        }

        loadProducts();
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [category, rating, search, sort, priceMax])
    
    const ratings = [
        { label: "Tout", value: 0 },
        { label: "⭐ 4+", value: 4 },
        { label: "⭐ 4.5+", value: 4.5 },
        { label: "⭐ 4.9+", value: 4.9 }
    ];

    function reset() {
        setPage(1);
        setCategory("Tout");
        setPriceMax(200);
        setRating(0);
        setSearch("");
        setSearchTerm("");
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

    const filteredProducts = products
        .filter((product) => {
            if (product.price >= priceMax) return false;
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
            return 0;
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
                        <ProductGridSkeleton count={8} />
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
                        Prix max — {priceMax} €
                    </h3>
                    <input
                        type="range"
                        min={0}
                        max={200}
                        value={priceMax}
                        onChange={changePrice}
                        className="w-full accent-indigo-500 h-1 mt-2 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                        <span>0 €</span>
                        <span>200 €</span>
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
                    <div className="flex gap-4 mb-8">
                        {/* Recherche améliorée */}
                        <div className="flex-1">
                            <SearchInput
                                placeholder="Rechercher un produit..."
                                onSearch={handleSearch}
                                showHistory={true}
                                showSuggestions={false}
                                isLoading={isSearching}
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
                                <option value="populaire">Popularité</option>
                                <option value="prixC">Prix croissant</option>
                                <option value="prixD">Prix décroissant</option>
                                <option value="topR">Meilleure note</option>
                            </select>
                        </div>
                    </div>
                </AnimatedContainer>

                {/* Grille des produits */}
                <AnimatedContainer animation="slideUp" delay={300}>
                    <div className="product-grid">
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

                                                    <span className="text-yellow-500 text-sm flex items-center gap-1">
                                                        ⭐ {product.rating}
                                                    </span>
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