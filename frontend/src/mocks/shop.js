import { http } from "msw";
import shopPolicy from "../../../src/config/shopPolicy.json";
import { estimateShipping } from "../lib/shopPolicy";
import {
    db, saveDb, now, round2, ok, fail, withUser, toProduct, toOrder, findProduct, changeOrderStatus,
} from "./data";

/* Panier, wishlist, politique de livraison, commandes et paiement simulé (cahier 02). */

const cartOf = (user) => (db.carts[user.id] = db.carts[user.id] || []);
const wishlistOf = (user) => (db.wishlists[user.id] = db.wishlists[user.id] || []);

function cartResponse(user) {
    const items = cartOf(user)
        .map((item) => {
            const product = findProduct(item.productId);
            return product && { id: `${user.id}-${item.productId}`, productId: item.productId, quantity: item.quantity, price: product.price, product: toProduct(product) };
        })
        .filter(Boolean);
    return ok({ userId: user.id, items });
}

function wishlistResponse(user) {
    const items = wishlistOf(user)
        .map((productId) => findProduct(productId))
        .filter(Boolean)
        .map((product) => ({ id: `${product.id}-wish`, productId: product.id, product: toProduct(product) }));
    return ok({ userId: user.id, itemsCount: items.length, items });
}

// Contrôle de stock commun à l'ajout et à la modification du panier
function checkStock(product, quantity) {
    if (!product || !product.is_active) return fail(404, "Produit non trouvé");
    if (!Number.isInteger(quantity) || quantity <= 0) return fail(400, "La quantité doit être un entier supérieur à 0");
    if (quantity > product.stock) return fail(400, `Stock insuffisant. Demandé: ${quantity}, Disponible: ${product.stock}`);
    return null;
}

const describePolicy = ({ shipping, returns }) => [
    `Livraison en ${shipping.zone} : ${shipping.fee.toFixed(2).replace(".", ",")} €, offerte dès ${shipping.freeThreshold} € d'achat.`,
    `Expédition ${shipping.dispatchDelay}, livraison en ${shipping.deliveryDelay}.`,
    `Retours : ${returns.days} jours après la livraison pour retourner un produit${returns.free ? ", retour gratuit" : ""}.`,
].join("\n");

const findUserOrder = (user, orderId) => db.orders.find((o) => o.order_id === orderId && o.user_id === user.id);

export const shopHandlers = [
    http.get("/api/shop/policy", () => ok({ ...shopPolicy, text: describePolicy(shopPolicy) })),

    /* ---------- Panier ---------- */

    http.get("/api/cart", withUser(({ user }) => cartResponse(user))),

    http.post("/api/cart/items", withUser(async ({ request, user }) => {
        const { product_id, quantity } = await request.json();
        const cart = cartOf(user);
        const existing = cart.find((i) => i.productId === product_id);
        const product = findProduct(product_id);
        const error = checkStock(product, (existing?.quantity || 0) + quantity);
        if (error) return error;
        if (existing) existing.quantity += quantity;
        else cart.push({ productId: product_id, quantity });
        saveDb();
        return cartResponse(user);
    })),

    http.put("/api/cart/items/:productId", withUser(async ({ request, params, user }) => {
        const { quantity } = await request.json();
        const item = cartOf(user).find((i) => i.productId === params.productId);
        if (!item) return fail(404, "Produit absent du panier");
        const error = checkStock(findProduct(params.productId), quantity);
        if (error) return error;
        item.quantity = quantity;
        saveDb();
        return cartResponse(user);
    })),

    http.delete("/api/cart/items/:productId", withUser(({ params, user }) => {
        db.carts[user.id] = cartOf(user).filter((i) => i.productId !== params.productId);
        saveDb();
        return cartResponse(user);
    })),

    http.delete("/api/cart", withUser(({ user }) => {
        db.carts[user.id] = [];
        saveDb();
        return cartResponse(user);
    })),

    /* ---------- Wishlist ---------- */

    http.get("/api/wishlist", withUser(({ user }) => wishlistResponse(user))),

    http.post("/api/wishlist", withUser(async ({ request, user }) => {
        const { productId } = await request.json();
        if (!findProduct(productId)) return fail(404, "Produit non trouvé");
        const list = wishlistOf(user);
        if (list.includes(productId)) return fail(409, "Produit déjà dans la wishlist");
        list.push(productId);
        saveDb();
        return wishlistResponse(user);
    })),

    http.delete("/api/wishlist/:productId", withUser(({ params, user }) => {
        db.wishlists[user.id] = wishlistOf(user).filter((id) => id !== params.productId);
        saveDb();
        return wishlistResponse(user);
    })),

    http.delete("/api/wishlist", withUser(({ user }) => {
        db.wishlists[user.id] = [];
        saveDb();
        return wishlistResponse(user);
    })),

    /* ---------- Commandes ---------- */

    http.get("/api/orders", withUser(({ user }) => {
        const orders = db.orders
            .filter((o) => o.user_id === user.id)
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .map(toOrder);
        return ok({
            orders,
            pagination: { total: orders.length, count: orders.length, page: 1, totalPages: 1, limit: 10, hasNextPage: false, hasPrevPage: false },
        });
    })),

    http.get("/api/orders/:orderId", withUser(({ params, user }) => {
        const order = findUserOrder(user, params.orderId);
        return order ? ok(toOrder(order)) : fail(404, "Commande non trouvée");
    })),

    // Même logique que le backend : stock vérifié puis décrémenté, snapshot, frais de port, panier vidé
    http.post("/api/orders", withUser(async ({ request, user }) => {
        const body = await request.json().catch(() => ({}));
        const cart = cartOf(user);
        if (cart.length === 0) return fail(400, "Le panier est vide");

        const conflicts = cart
            .map((item) => ({ item, product: findProduct(item.productId) }))
            .filter(({ item, product }) => !product || !product.is_active || product.stock < item.quantity)
            .map(({ item, product }) => ({ productId: item.productId, name: product?.name || "Produit", requested: item.quantity, available: product?.is_active ? product.stock : 0 }));
        if (conflicts.length > 0) {
            return fail(409, "Stock insuffisant : " + conflicts.map((c) => `${c.name} (demandé ${c.requested}, disponible ${c.available})`).join(", "), { conflicts });
        }

        const items = cart.map((item) => {
            const product = findProduct(item.productId);
            product.stock -= item.quantity;
            return {
                productId: product.id, name: product.name, price: product.price, image: product.images?.[0] || null,
                quantity: item.quantity, total: round2(product.price * item.quantity), stockReserved: true,
            };
        });
        const subtotal = round2(items.reduce((s, i) => s + i.total, 0));
        const shippingCost = estimateShipping(shopPolicy, subtotal);
        const at = now();
        const order = {
            id: crypto.randomUUID(),
            order_id: `ORD-MOCK-${Date.now().toString(36).toUpperCase()}`,
            user_id: user.id,
            items,
            shipping_cost: shippingCost,
            total_amount: round2(subtotal + shippingCost),
            status: "pending",
            shipping_address: body.shippingAddress || null,
            payment_method: body.paymentMethod || null,
            tracking_number: null,
            confirmed_at: null, processing_at: null, shipped_at: null, delivered_at: null, cancelled_at: null,
            created_at: at,
            updated_at: at,
            status_history: [{ from_status: null, to_status: "pending", changed_by: user.id, created_at: at }],
        };
        db.orders.push(order);
        db.carts[user.id] = [];
        saveDb();
        return ok({ orderId: order.order_id, total: order.total_amount, shippingCost, status: "pending" }, { status: 201 });
    })),

    http.put("/api/orders/:orderId/cancel", withUser(({ params, user }) => {
        const order = findUserOrder(user, params.orderId);
        if (!order) return fail(404, "Commande non trouvée");
        if (order.status !== "pending") return fail(400, "Seules les commandes en attente peuvent être annulées");
        const previousStatus = order.status;
        changeOrderStatus(order, "cancelled", user.id);
        return ok({ orderId: order.order_id, previousStatus, currentStatus: "cancelled", cancelledAt: order.cancelled_at });
    })),

    http.get("/api/orders/:orderId/tracking", withUser(({ params, user }) => {
        const order = findUserOrder(user, params.orderId);
        if (!order) return fail(404, "Commande non trouvée ou accès non autorisé");
        const timeline = order.status === "cancelled"
            ? [{ step: "pending", completed: true, date: order.created_at }, { step: "cancelled", completed: true, date: order.cancelled_at }]
            : ["pending", "confirmed", "processing", "shipped", "delivered"].map((step) => {
                const date = step === "pending" ? order.created_at : order[`${step}_at`];
                return { step, completed: !!date, date };
            });
        return ok({
            orderId: order.order_id,
            status: order.status,
            createdAt: order.created_at,
            trackingNumber: order.tracking_number,
            progress: { isCompleted: ["delivered", "cancelled"].includes(order.status), isCancelled: order.status === "cancelled", currentStep: order.status, timeline },
        });
    })),

    // Paiement simulé : aucun appel à Stripe en mode mock
    http.post("/api/payments/create-intent", withUser(() => ok({ client_secret: "pi_mock_secret", paymentIntentId: "pi_mock" }))),
];
