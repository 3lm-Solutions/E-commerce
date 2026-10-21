import { useState,useEffect } from "react";
import { ArrowRight, Cpu, Rocket, Lock, RefreshCw, Laptop, BookOpen, Shirt, Sofa, Dumbbell, Tag } from 'lucide-react';
import { Link, useNavigate } from "react-router-dom";
import useAuth from "./store/useAuth";
import { apiFetch } from "./lib/api";
import useCartStore from "./store/cartStore";
import NoReviews from "./components/NoReviews";

function Hero(){
    const [categories,setCategories]=useState([]);
    const [products,setProducts]=useState([]);
 
const WHY = [
  { icon: Cpu,       title: 'IA personnalisée',   desc: "Notre algorithme apprend de vos préférences pour vous proposer les meilleurs produits." },
  { icon: Rocket,    title: 'Livraison express',  desc: "En 24h, partout en France, sur tout le stock disponible." },
  { icon: Lock,      title: 'Paiement sécurisé',  desc: "Vos données bancaires sont protégées par un chiffrement de niveau bancaire." },
  { icon: RefreshCw, title: 'Retour gratuit',     desc: "30 jours pour changer d'avis, sans frais, depuis chez vous." },
]

// Les catégories n'ont pas d'image en base : icône choisie d'après le nom (sans accents).
const CATEGORY_ICONS = [
  { match: /electro/,           icon: Laptop },
  { match: /livre|media/,       icon: BookOpen },
  { match: /vetement|mode/,     icon: Shirt },
  { match: /maison|jardin/,     icon: Sofa },
  { match: /sport|loisir/,      icon: Dumbbell },
]

function categoryIcon(name = "") {
  const key = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return CATEGORY_ICONS.find(({ match }) => match.test(key))?.icon || Tag;
}


useEffect(()=>{
        async function loadCategories(){
            try{
                const response = await fetch("/api/categories");
                const result = await response.json();
                setCategories(result.data.categories || []);
            }catch(error){
                setCategories([]);
            }
        }
        loadCategories();
    },[]);

// "Produits tendance" : les plus vus des 7 derniers jours (GET /recommendations/trending).
// Sans vue récente, la liste est vide : on affiche alors les mieux notés.
const TRENDING_COUNT = 4;

useEffect(()=>{
        async function loadProducts(){
            try{
                const response = await fetch(`/recommendations/trending?limit=${TRENDING_COUNT}`);
                if(!response.ok) throw new Error(`HTTP ${response.status}`);
                const result = await response.json();
                const trending = (result.data?.trending || []).map((p)=>({
                    id: p.id, name: p.name, price: p.price, image: p.image,
                    category: p.category, rating: p.ratingAvg ?? 0,
                }));
                if(trending.length > 0){
                    setProducts(trending);
                    return;
                }

                const fallback = await fetch(`/api/products?limit=${TRENDING_COUNT}&sortBy=ratingAvg&sortOrder=desc`);
                if(!fallback.ok) throw new Error(`HTTP ${fallback.status}`);
                const data = await fallback.json();
                setProducts((data.data?.products || []).map((p)=>({
                    id: p.id, name: p.name, price: p.price, image: p.images?.[0],
                    category: p.category?.name, rating: Number(p.ratingAvg) || 0,
                })));
            }catch(error){
                console.error("Produits tendance :", error);
                setProducts([]);
            }
        }
        loadProducts();
    },[])

const navigate = useNavigate();
const addToCart = useCartStore((state) => state.addProductToCart);

// Le bouton est dans le lien de la carte : on bloque la navigation vers le produit.
function handleAddToCart(e, product){
    e.preventDefault();
    e.stopPropagation();
    if(!isAuthenticated){
        navigate("/login");
        return;
    }
    addToCart(product, 1);
}

// "Vous aimerez aussi" : recommandations personnalisées (utilisateur connecté uniquement)
const isAuthenticated=useAuth((state)=>state.isAuthenticated);
const [recommendations,setRecommendations]=useState([]);

useEffect(()=>{
        if(!isAuthenticated){
            setRecommendations([]);
            return;
        }
        async function loadRecommendations(){
            try{
                const response = await apiFetch("/recommendations/for-you?limit=4");
                if(!response.ok) throw new Error(`HTTP ${response.status}`);
                const result = await response.json();
                setRecommendations(result.data.recommendations || []);
            }catch(error){
                console.error("recommendations/for-you error:", error);
                setRecommendations([]);
            }
        }
        loadRecommendations();
    },[isAuthenticated])

// Nom de la catégorie (l'API de recommandations ne renvoie que categoryId)
const categoryName=(categoryId)=>categories.find((category)=>category.id===categoryId)?.name ?? "";


     return(
        <div>
             <section className="relative overflow-hidden bg-gradient-to-b from-indigo-50 via-blue-50 to-white border-b border-gray-100 py-24 px-6 text-center">
                <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-200/40 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-200/40 rounded-full blur-3xl"></div>

                <div className="relative max-w-2xl mx-auto">
                  

                     <h1 className="text-5xl font-extrabold text-indigo-600 leading-tight">Trouvez exactement <br />
                     <span className="text-gray-900">ce que vous cherchez</span> </h1>

                     <p className="text-base text-gray-500 leading-relaxed mt-8 max-w-md mx-auto">Notre IA comprend vos besoins et vous recommande les produits parfaits, au bon moment.</p>
                     <div className="flex gap-3 justify-center mt-9">
                        <Link to="/products"><button className="bg-gray-900 text-white text-sm font-medium px-5 py-2.5 rounded-lg flex items-center gap-2 transition-all hover:bg-indigo-600 hover:shadow-lg hover:shadow-indigo-200 border-none cursor-pointer">
                             Découvrir les produits
                             <ArrowRight size={16} /></button></Link> 
                         
                         <button className="bg-white text-gray-700 text-sm font-medium px-5 py-2.5 rounded-lg border border-gray-200 transition-colors hover:bg-gray-50 hover:border-gray-300 cursor-pointer">Comment ca marche</button>
                     </div>
                </div>
                  
             </section>


             <section className="max-w-7xl mx-auto px-6 py-16">
                  <div className="text-center mb-12">
                      <h2 className="text-4xl font-bold text-gray-900">Catégories populaires</h2>
                       <p className="mt-3 text-gray-500">
                          Explorez nos catégories les plus recherchées.
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-8">
                          {categories.map((category)=>{
                            const Icon = categoryIcon(category.name);
                            return (
<Link to={`/products?category=${encodeURIComponent(category.name)}`} key={category.id}><div className="group bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-xl hover:border-indigo-100 hover:-translate-y-2 transition-all duration-300 cursor-pointer">
                                <div className="w-20 h-20 mx-auto flex items-center justify-center rounded-full bg-indigo-50 text-indigo-600 ring-4 ring-transparent group-hover:ring-indigo-100 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                                    <Icon className="w-9 h-9 group-hover:scale-110 transition-transform duration-300" aria-hidden="true" />
                               </div>
                              <h3 className="mt-5 text-center font-semibold text-gray-800 group-hover:text-indigo-600 transition-colors">{category.name}</h3>

                            </div></Link>

                          )
                        })}
                        
                      </div>
                  </div>
                  <div>
                      
                  </div>

             </section>

        <section className="max-w-7xl mx-auto px-2 py-16 ">

    <div className="flex items-center justify-between mb-10">
        <h2 className="text-4xl font-bold text-gray-900">
            Produits tendance
        </h2>

        <span className="px-4 py-2 rounded-full bg-indigo-100 text-indigo-700 text-sm font-semibold flex items-center gap-1.5">
            <Cpu size={14} />
            IA recommande
        </span>
    </div>

    {/* Products Grid */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">

        {products.map((product) => (

<Link to={`/product-detail/${product.id}`} key={product.id}><div
                className="bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-2xl hover:shadow-indigo-100 hover:border-indigo-200 transition-all duration-300 hover:-translate-y-2 group"
            >

                {/* Product Image */}
                <div className="relative bg-gray-50 h-64 flex items-center justify-center overflow-hidden">

                    <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />

                </div>

                {/* Card Body */}
                <div className="p-5">

                    <p className="uppercase text-xs tracking-widest text-gray-400 font-medium">
                        {product.category}
                    </p>

                    <h3 className="mt-2 text-xl font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                        {product.name}
                    </h3>

                    {/* hna rating */}
                    <div className="flex items-center mt-3">

                        {product.rating > 0 ? (
                            <>
                                <span className="text-sm tracking-tight" aria-label={`Note : ${product.rating} sur 5`}>
                                    <span className="text-yellow-400">{"★".repeat(Math.round(product.rating))}</span>
                                    <span className="text-gray-300">{"★".repeat(5 - Math.round(product.rating))}</span>
                                </span>

                                <span className="ml-2 text-sm text-gray-500">
                                    {product.rating.toFixed(1)}
                                </span>
                            </>
                        ) : (
                            <NoReviews />
                        )}

                    </div>

                    {/*hna categories */}
                    <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">

                        <p className="text-2xl font-bold text-gray-900">
                            {product.price} €
                        </p>

                        <button type="button" onClick={(e) => handleAddToCart(e, product)} className="bg-gray-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-600 hover:shadow-md hover:shadow-indigo-200 transition-all">
                            Panier
                        </button>

                    </div>

                </div>

            </div></Link> 

        ))}

       </div>

      </section>

      {recommendations.length > 0 && (
        <section className="max-w-7xl mx-auto px-2 pb-16">

    <div className="flex items-center justify-between mb-10">
        <h2 className="text-4xl font-bold text-gray-900">
            Vous aimerez aussi
        </h2>

        <span className="px-4 py-2 rounded-full bg-indigo-100 text-indigo-700 text-sm font-semibold flex items-center gap-1.5">
            <Cpu size={14} />
            Selon votre historique
        </span>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">

        {recommendations.map((product) => (

<Link to={`/product-detail/${product.id}`} key={product.id}><div
                className="bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-2xl hover:shadow-indigo-100 hover:border-indigo-200 transition-all duration-300 hover:-translate-y-2 group"
            >

                <div className="relative bg-gray-50 h-64 flex items-center justify-center overflow-hidden">

                    <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />

                </div>

                <div className="p-5">

                    <p className="uppercase text-xs tracking-widest text-gray-400 font-medium">
                        {categoryName(product.categoryId)}
                    </p>

                    <h3 className="mt-2 text-xl font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                        {product.name}
                    </h3>

                    <div className="flex items-center mt-3">

                        {Number(product.ratingAvg) > 0 ? (
                            <>
                                <span className="text-yellow-400 text-sm tracking-tight">
                                    ★
                                </span>

                                <span className="ml-2 text-sm text-gray-500">
                                    {Number(product.ratingAvg).toFixed(1)}
                                </span>
                            </>
                        ) : (
                            <NoReviews />
                        )}

                    </div>

                    <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">

                        <p className="text-2xl font-bold text-gray-900">
                            {product.price} €
                        </p>

                    </div>

                </div>

            </div></Link>

        ))}

       </div>

      </section>
      )}

      <section className="bg-gray-50 border-y border-gray-100">
      <div className="max-w-7xl mx-auto px-6 py-16">
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">Pourquoi nous choisir</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
                    {WHY.map(({ icon: Icon, title, desc }) => (
                      <div key={title} className="text-center group">
                        <div className="w-20 h-20 rounded-xl bg-white border border-gray-200 flex items-center justify-center mx-auto mb-4 shadow-sm group-hover:border-indigo-200 group-hover:shadow-md transition-all duration-300">
                            <Icon size={36} className="text-indigo-600" /> 
                       </div>
                     <h3 className="text-sm font-semibold text-gray-900 mb-2">{title}</h3>
                    <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
                    </div>
          ))}
            </div>
      </div>
      </section>         
 </div>
  
  

     );
}
export default Hero;