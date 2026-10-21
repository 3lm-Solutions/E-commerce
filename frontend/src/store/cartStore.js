import { create } from "zustand";
import toast from "react-hot-toast";
import { apiFetch } from "../lib/api";

/*
 * Helper : headers JSON. Le header Authorization est ajouté par apiFetch.
 */
function getAuthHeaders() {
  return { "Content-Type": "application/json" };
}

/*
 * Helper : gère les erreurs 401.
 * apiFetch a déjà tenté un refresh et vidé la session s'il a échoué :
 * on redirige vers /login pour que l'utilisateur se reconnecte.
 */
function handleAuthError(status) {
  if (status === 401) {
    window.location.href = "/login";
    return true;
  }
  return false;
}

/*
 * Mapping des items du panier retournés par le backend (CartItem + Product)
 * vers la structure attendue par Cart.jsx / Checkout.jsx
 *
 * Backend GET /api/cart : { data: { items: [{ id, productId, quantity, price, product: { id, name, price, images } }] } }
 * Frontend attend : { id, name, price, image[], category, rating, quantity }
 */
function mapCartItems(items) {
  return (items || []).map((item) => ({
    id: item.productId || item.id,
    name: item.product?.name || item.name || "",
    price: parseFloat(item.price || 0),
    image: item.product?.images || item.images || [],
    category: item.product?.category?.name || item.category || "",
    rating: parseFloat(item.product?.ratingAvg || item.ratingAvg || 0),
    quantity: item.quantity || 1,
    // Garder les données brutes pour usage avancé
    _cartItemId: item.id,
    _productId: item.productId,
    _product: item.product,
  }));
}

/*
 * Mapping des items wishlist retournés par le backend
 * vers la structure attendue par Wishlist.jsx
 *
 * Backend GET /api/wishlist : { data: { items: [{ id, productId, product: { id, name, price, images, ratingAvg, category } }] } }
 * Frontend attend : { id, name, price, image (string), category, rating }
 */
function mapWishItems(items) {
  return (items || []).map((item) => {
    const product = item.product || {};
    return {
      id: product.id || item.productId,
      name: product.name || "",
      price: parseFloat(product.price || 0),
      image: Array.isArray(product.images) ? product.images[0] : product.images || "",
      category: product.category?.name || "",
      rating: parseFloat(product.ratingAvg || 0),
      // Données brutes
      _wishlistItemId: item.id,
      _productId: item.productId,
    };
  });
}

/*
 * Mapping du statut backend (anglais) vers l'affichage français
 * utilisé par Orders.jsx, OrderDetail.jsx, AdminDashboard.jsx
 */
function mapOrderStatus(status) {
  const map = {
    pending: "En attente de paiement",
    confirmed: "Confirmée",
    processing: "En préparation",
    shipped: "En transit",
    delivered: "Livré",
    cancelled: "Annulé",
  };
  return map[status?.toLowerCase()] || status || "En attente de paiement";
}

/*
 * Mapping des commandes retournées par le backend
 * vers la structure attendue par Orders.jsx, OrderDetail.jsx, AdminDashboard.jsx
 *
 * Backend GET /api/orders :
 *   { data: { orders: [{ orderId, id, status, totalAmount, items: [{productId, name, quantity, price}], createdAt, shippingAddress, ... }] } }
 *
 * Frontend legacy attend :
 *   { id, date, status (french), total, customer, address, items: [{ name, image, category, quantity, price }] }
 */
function mapOrders(orders) {
  return (orders || []).map((order) => {
    const items = (order.items || []).map((item) => ({
      id: item.productId,
      name: item.name || "",
      price: parseFloat(item.price || 0),
      quantity: item.quantity || 1,
      total: parseFloat(item.total || item.price * item.quantity || 0),
      image: item.image || "",
      category: item.category || "",
    }));

    return {
      id: order.orderId || order.id,
      orderId: order.orderId,
      internalId: order.id,
      date: order.createdAt
        ? new Date(order.createdAt).toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
        : "",
      status: mapOrderStatus(order.status),
      // Status brut pour usage avancé
      _status: order.status,
      total: parseFloat(order.totalAmount || order.total || 0),
      totalAmount: parseFloat(order.totalAmount || order.total || 0),
      customer: order.user?.name || order.shippingAddress?.fullName || "",
      address:
        order.shippingAddress
          ? `${order.shippingAddress.address || ""}, ${order.shippingAddress.postalCode || ""} ${order.shippingAddress.city || ""}`
          : "",
      items,
      itemsCount: items.length,
      trackingNumber: order.trackingNumber,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  });
}

/*
 * Initial state : tableaux vides.
 * Plus de lecture depuis localStorage au chargement du module.
 * Les données sont chargées via fetchCart() / fetchWishlist() / fetchOrders()
 * appelées dans les useEffect des composants (Cart.jsx, Wishlist.jsx, Orders.jsx).
 */
const initialState = {
  cart: [],
  wish: [],
  orders: [],
};

const useCartStore = create((set, get) => ({
  ...initialState,

  /**
   * Vide le panier, la wishlist et les commandes en mémoire (à la déconnexion).
   */
  reset: () => set(initialState),

  /* ─────────────────────────────────────────────
   *  PANIER
   * ───────────────────────────────────────────── */

  /**
   * Récupère le panier depuis le backend.
   * GET /api/cart → { data: { items: [...] } }
   */
  fetchCart: async () => {
    try {
      const res = await apiFetch("/api/cart", { headers: getAuthHeaders() });
      if (handleAuthError(res.status)) return;
      if (!res.ok) throw new Error("Erreur lors du chargement du panier");
      const json = await res.json();
      const items = json?.data?.items || json?.items || [];
      set({ cart: mapCartItems(items) });
    } catch (err) {
      console.error("fetchCart error:", err);
      toast.error("Impossible de charger le panier", {
        style: { background: "#ef4444", color: "#fff", fontWeight: "500" },
      });
    }
  },

  /**
   * Ajoute un produit au panier.
   * POST /api/cart/items avec { product_id, quantity }
   */
  addProductToCart: async (product, qty = 1) => {
    const quantity = qty > 0 ? qty : 1;
    try {
      const res = await apiFetch("/api/cart/items", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ product_id: product.id, quantity }),
      });
      if (handleAuthError(res.status)) return;

      const json = await res.json();

      if (!res.ok) {
        // Erreur 400 stock insuffisant → toast.error avec message backend
        const errorMsg =
          json?.message || "Impossible d'ajouter au panier";
        toast.error(errorMsg, {
          style: { background: "#ef4444", color: "#fff", fontWeight: "500" },
          iconTheme: { primary: "#fff", secondary: "#22c55e" },
        });
        return;
      }

      toast.success(`${product.name} ajouté au panier`, {
        style: { background: "#22c55e", color: "#fff", fontWeight: "500" },
        iconTheme: { primary: "#fff", secondary: "#22c55e" },
      });

      // Rafraîchir le panier depuis le serveur (source de vérité)
      await get().fetchCart();
    } catch (err) {
      console.error("addProductToCart error:", err);
      toast.error("Erreur réseau lors de l'ajout au panier", {
        style: { background: "#ef4444", color: "#fff", fontWeight: "500" },
      });
    }
  },

  /**
   * Supprime un produit du panier.
   * DELETE /api/cart/items/:product_id
   */
  deleteProductFromCart: async (productId) => {
    try {
      const res = await apiFetch(`/api/cart/items/${productId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (handleAuthError(res.status)) return;
      if (!res.ok) throw new Error("Erreur lors de la suppression");

      toast.success("Produit retiré du panier", {
        style: { background: "#22c55e", color: "#fff", fontWeight: "500" },
        iconTheme: { primary: "#fff", secondary: "#22c55e" },
      });

      await get().fetchCart();
    } catch (err) {
      console.error("deleteProductFromCart error:", err);
      toast.error("Impossible de retirer le produit", {
        style: { background: "#ef4444", color: "#fff", fontWeight: "500" },
      });
    }
  },

  /**
   * Augmente la quantité d'un produit dans le panier.
   * PUT /api/cart/items/:product_id avec la nouvelle quantité
   */
  increaseQuantity: async (productId) => {
    const state = get();
    const item = state.cart.find((i) => i.id === productId);
    if (!item) return;
    const newQty = item.quantity + 1;

    try {
      const res = await apiFetch(`/api/cart/items/${productId}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ quantity: newQty }),
      });
      if (handleAuthError(res.status)) return;

      if (!res.ok) {
        const json = await res.json();
        toast.error(json?.message || "Stock insuffisant", {
          style: { background: "#ef4444", color: "#fff", fontWeight: "500" },
        });
        return;
      }

      await get().fetchCart();
    } catch (err) {
      console.error("increaseQuantity error:", err);
      toast.error("Erreur réseau", {
        style: { background: "#ef4444", color: "#fff", fontWeight: "500" },
      });
    }
  },

  /**
   * Diminue la quantité d'un produit dans le panier.
   * PUT /api/cart/items/:product_id avec la nouvelle quantité (min 1)
   */
  decreaseQuantity: async (productId) => {
    const state = get();
    const item = state.cart.find((i) => i.id === productId);
    if (!item) return;
    const newQty = Math.max(1, item.quantity - 1);

    try {
      const res = await apiFetch(`/api/cart/items/${productId}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ quantity: newQty }),
      });
      if (handleAuthError(res.status)) return;

      if (!res.ok) {
        const json = await res.json();
        toast.error(json?.message || "Erreur de mise à jour", {
          style: { background: "#ef4444", color: "#fff", fontWeight: "500" },
        });
        return;
      }

      await get().fetchCart();
    } catch (err) {
      console.error("decreaseQuantity error:", err);
      toast.error("Erreur réseau", {
        style: { background: "#ef4444", color: "#fff", fontWeight: "500" },
      });
    }
  },

  /**
   * Vide le panier.
   * DELETE /api/cart
   */
  clearCart: async () => {
    try {
      const res = await apiFetch("/api/cart", {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (handleAuthError(res.status)) return;
      if (!res.ok) throw new Error("Erreur lors du vidage du panier");

      set({ cart: [] });
      toast.success("Panier vidé", {
        style: { background: "#22c55e", color: "#fff", fontWeight: "500" },
        iconTheme: { primary: "#fff", secondary: "#22c55e" },
      });
    } catch (err) {
      console.error("clearCart error:", err);
      toast.error("Impossible de vider le panier", {
        style: { background: "#ef4444", color: "#fff", fontWeight: "500" },
      });
    }
  },

  /* ─────────────────────────────────────────────
   *  WISHLIST
   * ───────────────────────────────────────────── */

  /**
   * Récupère la wishlist depuis le backend.
   * GET /api/wishlist
   */
  fetchWishlist: async () => {
    try {
      const res = await apiFetch("/api/wishlist", { headers: getAuthHeaders() });
      if (handleAuthError(res.status)) return;
      if (!res.ok) throw new Error("Erreur lors du chargement de la wishlist");
      const json = await res.json();
      const items = json?.data?.items || [];
      set({ wish: mapWishItems(items) });
    } catch (err) {
      console.error("fetchWishlist error:", err);
      toast.error("Impossible de charger les favoris", {
        style: { background: "#ef4444", color: "#fff", fontWeight: "500" },
      });
    }
  },

  /**
   * Toggle : ajoute ou retire un produit de la wishlist.
   * POST /api/wishlist si absent, DELETE /api/wishlist/:productId si présent.
   */
  handleWish: async (product) => {
    const state = get();
    const wished = state.wish.some((item) => item.id === product?.id);

    if (wished) {
      // Supprimer
      try {
        const res = await apiFetch(`/api/wishlist/${product.id}`, {
          method: "DELETE",
          headers: getAuthHeaders(),
        });
        if (handleAuthError(res.status)) return;

        if (!res.ok) {
          const json = await res.json();
          toast.error(json?.message || "Erreur de suppression", {
            style: { background: "#ef4444", color: "#fff", fontWeight: "500" },
            iconTheme: { primary: "#fff", secondary: "#22c55e" },
          });
          return;
        }

        toast.error("Produit retiré des favoris ❌", {
          style: { background: "#ef4444", color: "#fff", fontWeight: "500" },
          iconTheme: { primary: "#fff", secondary: "#22c55e" },
        });

        await get().fetchWishlist();
      } catch (err) {
        console.error("handleWish (remove) error:", err);
        toast.error("Erreur réseau", {
          style: { background: "#ef4444", color: "#fff", fontWeight: "500" },
        });
      }
    } else {
      // Ajouter
      try {
        const res = await apiFetch("/api/wishlist", {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ productId: product.id }),
        });
        if (handleAuthError(res.status)) return;

        const json = await res.json();

        if (!res.ok) {
          toast.error(json?.message || "Erreur d'ajout aux favoris", {
            style: { background: "#ef4444", color: "#fff", fontWeight: "500" },
            iconTheme: { primary: "#fff", secondary: "#22c55e" },
          });
          return;
        }

        toast.success("Produit ajouté aux favoris ❤️", {
          style: { background: "#22c55e", color: "#fff", fontWeight: "500" },
          iconTheme: { primary: "#fff", secondary: "#22c55e" },
        });

        await get().fetchWishlist();
      } catch (err) {
        console.error("handleWish (add) error:", err);
        toast.error("Erreur réseau", {
          style: { background: "#ef4444", color: "#fff", fontWeight: "500" },
        });
      }
    }
  },

  /**
   * Supprime un produit spécifique de la wishlist.
   * DELETE /api/wishlist/:productId
   */
  deleteFromWishList: async (id) => {
    try {
      const res = await apiFetch(`/api/wishlist/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (handleAuthError(res.status)) return;

      if (!res.ok) {
        const json = await res.json();
        toast.error(json?.message || "Erreur de suppression", {
          style: { background: "#ef4444", color: "#fff", fontWeight: "500" },
          iconTheme: { primary: "#fff", secondary: "#22c55e" },
        });
        return;
      }

      toast.error("Produit retiré de la Wish List", {
        style: { background: "#ef4444", color: "#fff", fontWeight: "500" },
        iconTheme: { primary: "#fff", secondary: "#22c55e" },
      });

      await get().fetchWishlist();
    } catch (err) {
      console.error("deleteFromWishList error:", err);
      toast.error("Erreur réseau", {
        style: { background: "#ef4444", color: "#fff", fontWeight: "500" },
      });
    }
  },

  /**
   * Vide la wishlist.
   * DELETE /api/wishlist (clear all)
   */
  clearWish: async () => {
    try {
      const res = await apiFetch("/api/wishlist", {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (handleAuthError(res.status)) return;

      if (!res.ok) {
        const json = await res.json();
        toast.error(json?.message || "Erreur de vidage", {
          style: { background: "#ef4444", color: "#fff", fontWeight: "500" },
        });
        return;
      }

      set({ wish: [] });
      toast.success("Liste de souhaits vidée", {
        style: { background: "#22c55e", color: "#fff", fontWeight: "500" },
        iconTheme: { primary: "#fff", secondary: "#22c55e" },
      });
    } catch (err) {
      console.error("clearWish error:", err);
      toast.error("Impossible de vider la liste", {
        style: { background: "#ef4444", color: "#fff", fontWeight: "500" },
      });
    }
  },

  /**
   * Déplace un produit de la wishlist vers le panier.
   * 1. Ajoute au panier (addProductToCart)
   * 2. Supprime de la wishlist (deleteFromWishList)
   */
  moveToCart: async (id) => {
    try {
      const state = get();
      const product = state.wish.find((item) => item.id === id);
      if (!product) return;

      // Ajouter au panier (quantité 1)
      await get().addProductToCart(product, 1);

      // Supprimer de la wishlist
      const res = await apiFetch(`/api/wishlist/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (handleAuthError(res.status)) return;

      await get().fetchWishlist();
    } catch (err) {
      console.error("moveToCart error:", err);
      toast.error("Erreur lors du déplacement", {
        style: { background: "#ef4444", color: "#fff", fontWeight: "500" },
      });
    }
  },

  /* ─────────────────────────────────────────────
   *  COMMANDES
   * ───────────────────────────────────────────── */

  /**
   * Récupère la liste des commandes.
   * GET /api/orders
   */
  fetchOrders: async () => {
    try {
      const res = await apiFetch("/api/orders", { headers: getAuthHeaders() });
      if (handleAuthError(res.status)) return;
      if (!res.ok) throw new Error("Erreur lors du chargement des commandes");
      const json = await res.json();
      const orders = json?.data?.orders || [];
      set({ orders: mapOrders(orders) });
    } catch (err) {
      console.error("fetchOrders error:", err);
      // Pas de toast pour les commandes vides (pas une erreur bloquante)
    }
  },

  /**
   * Récupère une commande spécifique.
   * GET /api/orders/:orderId
   * Retourne l'objet commande formaté ou null.
   */
  fetchOrder: async (orderId) => {
    try {
      const res = await apiFetch(`/api/orders/${orderId}`, {
        headers: getAuthHeaders(),
      });
      if (handleAuthError(res.status)) return null;
      if (!res.ok) return null;
      const json = await res.json();
      const order = json?.data;
      if (!order) return null;
      const mapped = mapOrders([order]);
      return mapped[0] || null;
    } catch (err) {
      console.error("fetchOrder error:", err);
      return null;
    }
  },

  /**
   * Annule une commande (backend : statut pending uniquement).
   * PUT /api/orders/:orderId/cancel
   * Retourne { ok, message } ; message = celui du backend en cas de refus.
   */
  cancelOrder: async (orderId) => {
    try {
      const res = await apiFetch(`/api/orders/${orderId}/cancel`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({}),
      });
      if (handleAuthError(res.status)) return { ok: false, message: "Session expirée." };
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        return { ok: false, message: json?.message || "Impossible d'annuler la commande." };
      }
      // Met à jour la liste déjà chargée (page Mes commandes)
      set((state) => ({
        orders: (state.orders || []).map((o) =>
          o.id === orderId ? { ...o, _status: "cancelled", status: mapOrderStatus("cancelled") } : o
        ),
      }));
      return { ok: true, message: json?.message || "Commande annulée." };
    } catch (err) {
      console.error("cancelOrder error:", err);
      return { ok: false, message: "Erreur réseau. Veuillez réessayer." };
    }
  },

  /**
   * Suivi d'une commande.
   * GET /api/orders/:orderId/tracking
   * Retourne { status, trackingNumber, progress: { timeline: [{ step, completed, date }] }, ... } ou null.
   */
  fetchOrderTracking: async (orderId) => {
    try {
      const res = await apiFetch(`/api/orders/${orderId}/tracking`, {
        headers: getAuthHeaders(),
      });
      if (handleAuthError(res.status)) return null;
      if (!res.ok) return null;
      const json = await res.json();
      return json?.data || null;
    } catch (err) {
      console.error("fetchOrderTracking error:", err);
      return null;
    }
  },

  /**
   * Crée une commande à partir du panier.
   * POST /api/orders
   * body (optionnel) : { shippingAddress, billingAddress, paymentMethod }
   * Retourne { orderId, total, status } ou null en cas d'erreur.
   */
  createOrder: async (orderData = {}) => {
    try {
      const res = await apiFetch("/api/orders", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(orderData),
      });
      if (handleAuthError(res.status)) return null;

      const json = await res.json();

      if (!res.ok) {
        toast.error(json?.message || "Erreur lors de la création de la commande", {
          style: { background: "#ef4444", color: "#fff", fontWeight: "500" },
        });
        return null;
      }

      const result = json?.data || json;
      const orderId = result?.orderId;

      // Rafraîchir le panier (vidé par le backend) et les commandes
      await get().fetchCart();
      await get().fetchOrders();

      toast.success("Commande créée avec succès !", {
        style: { background: "#22c55e", color: "#fff", fontWeight: "500" },
        iconTheme: { primary: "#fff", secondary: "#22c55e" },
      });

      return result;
    } catch (err) {
      console.error("createOrder error:", err);
      toast.error("Erreur réseau lors de la création de la commande", {
        style: { background: "#ef4444", color: "#fff", fontWeight: "500" },
      });
      return null;
    }
  },

  /*
   * addOrder est dépréciée — les commandes sont créées via createOrder() côté backend.
   * Conservée pour compatibilité avec les anciens composants non migrés.
   */
  addOrder: (newOrder) => {
    console.warn("addOrder est dépréciée. Utilisez createOrder() à la place.");
    set((state) => ({
      orders: [newOrder, ...state.orders],
    }));
  },
}));

export default useCartStore;
