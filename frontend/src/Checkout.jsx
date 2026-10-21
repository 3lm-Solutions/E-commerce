import { MapPin, CreditCard, Lock, ShieldCheck, Truck, Headphones } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import useCartStore from "./store/cartStore";
import { apiFetch } from "./lib/api";
import { useNavigate } from "react-router-dom"; // Pour la redirection
import toast from "react-hot-toast"; // Pour les notifications
import ShippingLine from "./components/ShippingLine";
import { useShopPolicy, estimateShipping } from "./lib/shopPolicy";

function Checkout() {
  const navigate = useNavigate(); // Permet de rediriger l'utilisateur après le paiement
  const cart = useCartStore(state => state.cart);
  const createOrder = useCartStore(state => state.createOrder);
  const fetchCart = useCartStore(state => state.fetchCart);
  const policy = useShopPolicy();

  // Après un rechargement de la page, le panier en mémoire est vide : on le recharge
  useEffect(() => {
      fetchCart();
  }, [fetchCart]);

  const schema = z.object({
      FullName: z.string().min(1, "Le nom est obligatoire"),
      email: z.string().email("Adresse email invalide"),
      phone: z.string().regex(/^\d{10}$/, "Le numéro de téléphone doit contenir 10 chiffres"),
      address: z.string().min(1, "L'adresse est obligatoire"),
      city: z.string().min(1, "La ville est obligatoire"),
      postalCode: z.string().min(1, "Le code postal est obligatoire"),
      cardNumber: z.string().min(16, "Numéro de carte invalide"),
      ccv: z.string().min(3, "Cryptogramme invalide").max(3, "Cryptogramme invalide")
  });

  const {
     register,
     handleSubmit,
     formState: { errors, isSubmitting },
  } = useForm({
     resolver: zodResolver(schema)
  });

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  // Les prix des produits sont TTC : total = articles + frais de port (même règle que le backend,
  // qui recalcule le montant définitif à la création de la commande)
  const total = subtotal + (estimateShipping(policy, subtotal) ?? 0);

const onSubmit = async (data) => {
      if (cart.length === 0) {
          toast.error("Votre panier est vide");
          return;
      }

      // Préparer les données d'adresse de livraison envoyées au backend
      const orderData = {
          shippingAddress: {
              fullName: data.FullName,
              email: data.email,
              phone: data.phone,
              address: data.address,
              city: data.city,
              postalCode: data.postalCode,
          },
          paymentMethod: 'card',
      };

      // 1. Créer la commande côté backend (POST /api/orders)
      //    Retourne { orderId, total, status }
      const result = await createOrder(orderData);

      if (!result || !result.orderId) {
          // La fonction createOrder affiche déjà un toast.error en cas d'échec
          return;
      }

      // 2. Lancer le paiement Stripe (POST /api/payments/create-intent)
      //    avec l'orderId et le montant total retourné par le backend
      try {
          const stripeRes = await apiFetch('/api/payments/create-intent', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                  orderId: result.orderId,
                  amount: result.total || total,
                  currency: 'eur',
              }),
          });

          const stripeJson = await stripeRes.json();

          if (!stripeRes.ok) {
              toast.error(stripeJson?.message || "Erreur lors de l'initialisation du paiement", {
                  style: { background: '#ef4444', color: '#fff', fontWeight: '500' },
              });
              return;
          }

          // Le PaymentIntent a été créé avec succès
          console.log('PaymentIntent créé:', stripeJson?.data?.client_secret);

          toast.success("Commande enregistrée", {
              style: { background: '#22c55e', color: '#fff', fontWeight: '500' },
              iconTheme: { primary: '#fff', secondary: '#22c55e' },
          });

          navigate(`/order-confirmation/${result.orderId}`); // Page de confirmation de la commande
      } catch (err) {
          console.error('Erreur paiement Stripe:', err);
          toast.error("Erreur réseau lors du paiement", {
              style: { background: '#ef4444', color: '#fff', fontWeight: '500' },
          });
      }
  }

  return (
   <form onSubmit={handleSubmit(onSubmit)}>
      <div className="max-w-7xl mx-auto px-6 py-10">
          {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <h1 className="text-4xl font-bold">
          Finaliser la commande
        </h1>
        <div className="text-sm text-gray-500">
          Paiement sécurisé
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT */}
        <div className="lg:col-span-2 space-y-8">
          {/* Shipping */}
          <div className="bg-white border rounded-2xl shadow-sm p-7">
            <div className="flex items-center gap-3 mb-6">
              <MapPin className="text-indigo-600" />
              <h2 className="text-2xl font-bold">
                Adresse de livraison
              </h2>
            </div>
      
            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="font-medium block mb-2">
                  Nom complet
                </label>
                <input
                  className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Prénom Nom" {...register("FullName")}
                />
                {errors.FullName && ( <p className="text-red-500 text-xs mt-1">{errors.FullName.message}</p> )}
              </div>

              <div>
                <label className="font-medium block mb-2">
                  Email
                </label>
                <input
                  className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="vous@exemple.com" {...register("email")}
                />
                {errors.email && ( <p className="text-red-500 text-xs mt-1">{errors.email.message}</p> )}
              </div>

              <div>
                <label className="font-medium block mb-2">
                  Téléphone
                </label>
                <input
                  className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="0612345678" {...register("phone")}
                />
                {errors.phone && ( <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p> )}
              </div>

              <div>
                <label className="font-medium block mb-2">
                  Pays
                </label>
                <select className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500">
                  <option>Maroc</option>
                  <option>France</option>
                </select>
              </div>
            </div>

            <div className="mt-5">
              <label className="font-medium block mb-2">
                Adresse
              </label>
              <input
                className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Numéro et rue" {...register("address")}
              />
              {errors.address && ( <p className="text-red-500 text-xs mt-1">{errors.address.message}</p> )}
            </div>

            <div className="mt-5">
              <label className="font-medium block mb-2">
                Complément d'adresse (facultatif)
              </label>
              <input
                className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-5 mt-5">
              <div>
                <label className="font-medium block mb-2">
                  Ville
                </label>
                <input className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500" {...register("city")} />
                {errors.city && ( <p className="text-red-500 text-xs mt-1">{errors.city.message}</p> )}
              </div>

              <div>
                <label className="font-medium block mb-2">
                  Code postal
                </label>
                <input className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500" {...register("postalCode")} />
                  {errors.postalCode && ( <p className="text-red-500 text-xs mt-1">{errors.postalCode.message}</p> )}
              </div>
            </div>
          </div>

          {/* Payment */}
          <div className="bg-white border rounded-2xl shadow-sm p-7">
            <div className="flex items-center gap-3 mb-6">
              <CreditCard className="text-indigo-600" />
              <h2 className="text-2xl font-bold">
                Paiement
              </h2>
            </div>

            <div className="space-y-5">
              <div>
                <label className="font-medium block mb-2">
                  Numéro de carte
                </label>
                <input
                  placeholder="1234 5678 9012 3456"
                  className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500"
                  {...register("cardNumber")}
                />
                {errors.cardNumber && ( <p className="text-red-500 text-xs mt-1">{errors.cardNumber.message}</p> )}
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="font-medium block mb-2">
                    Expiration
                  </label>
                  <input
                    placeholder="MM/AA"
                    className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="font-medium block mb-2">
                    Cryptogramme
                  </label>
                  <input
                    placeholder="123"
                    className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500"
                    {...register("ccv")}
                  />
                  {errors.ccv && ( <p className="text-red-500 text-xs mt-1">{errors.ccv.message}</p> )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="bg-white border rounded-2xl shadow-sm p-6 h-fit sticky top-6">
          <h2 className="text-2xl font-bold mb-6">
            Récapitulatif
          </h2>

          {cart.map(item=>(
          <div className="flex gap-4 mb-5" key={item.id}>
            <img
              src={Array.isArray(item.image) ? item.image[0] : item.image}
              alt={item.name}
              className="rounded-xl w-20 bg-gray-50 object-contain"
            />
            <div>
              <h3 className="font-semibold text-sm">
                {item.name}
              </h3>
              <p className="text-gray-500 text-sm">
                Quantité : {item.quantity}
              </p>
            </div>
            <p className="ml-auto font-bold text-sm">
              {(item.price * item.quantity).toFixed(2)}€
            </p>
          </div>
          ))}

          <hr className="my-5" />

          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Sous-total</span>
              <span className="font-medium">{subtotal.toFixed(2)}€</span>
            </div>
            <ShippingLine policy={policy} subtotal={subtotal} />
          </div>

          <hr className="my-5" />

          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-bold">Total</h2>
            <h2 className="text-3xl font-bold text-indigo-600">
              {total.toFixed(2)}€
            </h2>
          </div>
          <p className="-mt-6 mb-8 text-right text-xs text-gray-500">TVA incluse</p>

          {/* Désactivé pendant l'envoi : un double clic créait deux commandes */}
          <button className="w-full bg-indigo-600 hover:bg-indigo-700 transition text-white rounded-xl py-4 font-semibold flex justify-center items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed" type="submit" disabled={isSubmitting}>
            <Lock size={18} />
            {isSubmitting ? "Traitement…" : "Payer"}
          </button>

          <div className="mt-8 space-y-4">
            <div className="flex gap-3 items-center">
              <ShieldCheck size={18} className="text-gray-400" />
              <p className="text-sm text-gray-500">Paiement sécurisé</p>
            </div>
            <div className="flex gap-3 items-center">
              <Truck size={18} className="text-gray-400" />
              <p className="text-sm text-gray-500">
                {policy ? `Expédition ${policy.shipping.dispatchDelay}, livraison en ${policy.shipping.deliveryDelay}` : "Livraison rapide"}
              </p>
            </div>
            <div className="flex gap-3 items-center">
              <Headphones size={18} className="text-gray-400" />
              <p className="text-sm text-gray-500">Support 24h/24, 7j/7</p>
            </div>
          </div>
        </div>
      </div>
      </div>
    </form> 
   )
}
export default Checkout;