import { HttpResponse } from "msw";
import categoriesFixture from "../../../fixtures/categories.json";
import productsFixture from "../../../fixtures/products.json";
import usersFixture from "../../../fixtures/users.json";
import reviewsFixture from "../../../fixtures/reviews.json";
import ordersFixture from "../../../fixtures/orders.json";

/*
 * Base en mémoire des mocks MSW (VITE_USE_MOCK=true), construite à partir des
 * fixtures partagées (/fixtures, cahier 00 §3.2). Les modifications (panier,
 * commandes, admin…) sont gardées dans sessionStorage : elles survivent à un
 * rechargement de la page et disparaissent à la fermeture de l'onglet.
 */

const STORAGE_KEY = "msw-db-v1";
const clone = (value) => JSON.parse(JSON.stringify(value));

function initialDb() {
    return {
        categories: clone(categoriesFixture),
        products: clone(productsFixture),
        users: clone(usersFixture),
        reviews: clone(reviewsFixture),
        orders: clone(ordersFixture),
        carts: {},     // userId -> [{ productId, quantity, price }]
        wishlists: {}, // userId -> [productId]
        events: [],    // { userId, productId, type, at }
    };
}

function loadDb() {
    try {
        const saved = sessionStorage.getItem(STORAGE_KEY);
        if (saved) return JSON.parse(saved);
    } catch {
        // sessionStorage indisponible ou contenu invalide : base neuve
    }
    return initialDb();
}

export const db = loadDb();

export function saveDb() {
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch {
        // Quota dépassé ou stockage bloqué : les données restent en mémoire
    }
}

export const now = () => new Date().toISOString();
export const round2 = (n) => Math.round(n * 100) / 100;

/* ---------- Réponses ---------- */

export const ok = (data, init) => HttpResponse.json({ success: true, data }, init);
export const fail = (status, message, extra = {}) =>
    HttpResponse.json({ success: false, message, ...extra }, { status });

/* ---------- Authentification ---------- */

// Faux jeton : « mock.<id utilisateur> », relu par currentUser()
export const tokenFor = (user) => `mock.${user.id}`;

export function currentUser(request) {
    const header = request.headers.get("Authorization") || "";
    const id = header.replace(/^Bearer mock\./, "");
    return db.users.find((u) => u.id === id && u.is_active) || null;
}

export const unauthorized = () => fail(401, "Token d'accès requis");

// Exécute le handler avec l'utilisateur connecté (401 sinon, 403 si admin requis)
export function withUser(handler, { admin = false } = {}) {
    return (info) => {
        const user = currentUser(info.request);
        if (!user) return unauthorized();
        if (admin && user.role !== "admin") return fail(403, "Accès réservé aux administrateurs");
        return handler({ ...info, user });
    };
}

/* ---------- Formatage (même format que le backend) ---------- */

export const toUser = (u) => ({ id: u.id, email: u.email, role: u.role, name: u.name });

export const findCategory = (id) => db.categories.find((c) => c.id === id);
export const toCategory = (c) => c && { id: c.id, name: c.name, description: c.description };

export const toProduct = (p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    price: p.price,
    stock: p.stock,
    images: p.images,
    tags: p.tags,
    isActive: p.is_active,
    ratingAvg: p.rating_avg,
    ratingCount: p.rating_count,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    category: toCategory(findCategory(p.category_id)),
});

export const findProduct = (id) => db.products.find((p) => p.id === id);

export const VALID_TRANSITIONS = {
    pending: ["confirmed", "cancelled"],
    confirmed: ["processing"],
    processing: ["shipped"],
    shipped: ["delivered"],
    delivered: [],
    cancelled: [],
};

export const toOrder = (o) => ({
    orderId: o.order_id,
    id: o.id,
    userId: o.user_id,
    status: o.status,
    totalAmount: o.total_amount,
    shippingCost: o.shipping_cost || 0,
    itemsCount: o.items.length,
    items: o.items,
    shippingAddress: o.shipping_address,
    billingAddress: null,
    paymentMethod: o.payment_method,
    trackingNumber: o.tracking_number,
    notes: o.notes || null,
    availableTransitions: VALID_TRANSITIONS[o.status] || [],
    isCancelable: o.status === "pending",
    isCompleted: o.status === "delivered" || o.status === "cancelled",
    createdAt: o.created_at,
    updatedAt: o.updated_at,
    confirmedAt: o.confirmed_at,
    processingAt: o.processing_at,
    shippedAt: o.shipped_at,
    deliveredAt: o.delivered_at,
    cancelledAt: o.cancelled_at,
});

// Note moyenne et nombre d'avis d'un produit, recalculés depuis les avis
export function refreshRating(productId) {
    const product = findProduct(productId);
    if (!product) return;
    const reviews = db.reviews.filter((r) => r.product_id === productId);
    product.rating_count = reviews.length;
    product.rating_avg = reviews.length ? round2(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) : 0;
}

// Changement d'état d'une commande, avec remise en stock à l'annulation et historique
export function changeOrderStatus(order, newStatus, changedBy) {
    if (!(VALID_TRANSITIONS[order.status] || []).includes(newStatus)) {
        return `Transition invalide : impossible de passer de "${order.status}" à "${newStatus}"`;
    }
    const at = now();
    if (newStatus === "cancelled") {
        for (const item of order.items) {
            const product = findProduct(item.productId);
            if (product && item.stockReserved) product.stock += item.quantity;
        }
    }
    order.status_history = order.status_history || [];
    order.status_history.push({ from_status: order.status, to_status: newStatus, changed_by: changedBy, created_at: at });
    order.status = newStatus;
    order[`${newStatus}_at`] = at;
    order.updated_at = at;
    saveDb();
    return null;
}
