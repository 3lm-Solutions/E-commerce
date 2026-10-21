import { useState,useEffect,useContext } from "react";
import { Heart } from "lucide-react";
import { Trash } from "lucide-react";
import { EyeIcon } from "lucide-react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import useCartStore from "./store/cartStore";



function WishList(){

const wishList=useCartStore(state=>state.wish);
const deleteAllWishList=useCartStore(state=>state.clearWish);
const deleteFromWishList=useCartStore(state=>state.deleteFromWishList);
const addToCart=useCartStore(state=>state.moveToCart);
const fetchWishlist=useCartStore(state=>state.fetchWishlist);
   
    // Charger la wishlist depuis le backend au montage du composant
    useEffect(() => {
        fetchWishlist();
    }, [fetchWishlist]);



   




if (wishList.length === 0) {
    return (
        <div className="text-center py-24">
            <h2 className="text-3xl font-bold">
                Your Wish list is empty
            </h2>

            <Link to="/products">
            <p className="text-gray-500 mt-4">
                View Products :D
            </p>
            </Link>
        </div>
    );

} 
    return(
        <div className="max-w-7xl mx-auto px-2 py-8">


     
             <div className="flex items-center justify-between mb-8">
                <h1 className="text-4xl font-extrabold tracking-tight">
                    Your Wish List
                </h1>

                <button
                    onClick={deleteAllWishList}
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-xl shadow transition"
                >
                    <Trash size={18} />
                    Clear Wish list
                </button>
            </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                 {
                     wishList.map((p)=>(
                         <div key={p.id} className="bg-white border border-gray-200 rounded-2xl p-4 relative">
                           <Link to={`/product-detail/${p.id}`}>
                                <button className="absolute top-3 right-3 bg-white rounded-full p-1.5 border hover:bg-indigo-600 hover:text-white">
                                      <EyeIcon></EyeIcon> 
                                </button>
                           </Link>

                
                             <img src={p.image} alt={p.name} className="w-full h-40 object-contain mb-4 rounded-full"/>
                             <p className="text-xs text-indigo-600 uppercase tracking-wide">{p.category}</p>
                             <h3 className="font-medium text-gray-900 mt-1">{p.name}</h3>
                            <p className="text-sm text-gray-500 mt-1">★ {p.rating} (8901)</p>
                            <p className="text-lg font-semibold text-indigo-700 mt-2">{p.price}€</p>

                            <div className="flex gap-2 mt-3">
                                  <button className="flex-1 border border-gray-300 rounded-lg py-2 text-sm" onClick={()=>deleteFromWishList(p.id)}>Supprimer</button>
                                  <button className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm" onClick={()=>addToCart(p.id)}>Ajouter au panier</button>
                            </div>
   
                         </div>
                         
                     ))
                 }
                 
             </div>
             
        </div>
    );

}
export default WishList;