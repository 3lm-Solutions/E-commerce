import { http } from "msw";
import {
    db, saveDb, now, round2, ok, fail, withUser, toProduct, toOrder, findProduct, findCategory, changeOrderStatus,
} from "./data";

/* Dashboard admin (cahier 03) : lectures sur les fixtures, modifications gardées en mémoire. */

const admin = (handler) => withUser(handler, { admin: true });

const userById = (id) => db.users.find((u) => u.id === id);
const notCancelled = (o) => o.status !== "cancelled";

function toAdminOrder(o, { withHistory = false } = {}) {
    const user = userById(o.user_id);
    const order = {
        ...toOrder(o),
        isModifiable: !["delivered", "cancelled"].includes(o.status),
        user: user ? { id: user.id, email: user.email, name: user.name } : null,
    };
    if (withHistory) {
        order.statusHistory = (o.status_history || []).map((h) => {
            const author = h.changed_by && userById(h.changed_by);
            return {
                fromStatus: h.from_status,
                toStatus: h.to_status,
                changedAt: h.created_at,
                changedBy: author ? { id: author.id, email: author.email, name: author.name, role: author.role } : null,
            };
        });
    }
    return order;
}

function paginate(list, url, defaultLimit = 10) {
    const page = Math.max(parseInt(url.searchParams.get("page")) || 1, 1);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit")) || defaultLimit, 1), 100);
    const total = list.length;
    const totalPages = Math.max(Math.ceil(total / limit), 1);
    return {
        rows: list.slice((page - 1) * limit, page * limit),
        pagination: {
            page, limit, total, totalPages, offset: (page - 1) * limit,
            hasNextPage: page < totalPages, hasPrevPage: page > 1,
            nextPage: page < totalPages ? page + 1 : null, prevPage: page > 1 ? page - 1 : null,
        },
    };
}

const productCount = (categoryId) => db.products.filter((p) => p.category_id === categoryId).length;
const sortedOrders = () => [...db.orders].sort((a, b) => b.created_at.localeCompare(a.created_at));
const pad = (n) => String(n).padStart(2, "0");
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

function productFields(body) {
    const fields = {};
    if (body.name !== undefined) fields.name = body.name;
    if (body.description !== undefined) fields.description = body.description;
    if (body.price !== undefined) fields.price = Number(body.price);
    if (body.stock !== undefined) fields.stock = Number(body.stock);
    if (body.categoryId !== undefined) fields.category_id = body.categoryId;
    if (body.images !== undefined) fields.images = body.images;
    if (body.tags !== undefined) fields.tags = body.tags;
    if (body.isActive !== undefined) fields.is_active = body.isActive;
    return fields;
}

export const adminHandlers = [
    /* ---------- Tableau de bord ---------- */

    http.get("/api/admin/dashboard/metrics", admin(() => {
        const today = dayKey(new Date());
        const activeProducts = db.products.filter((p) => p.is_active);
        return ok({
            totalRevenue: round2(db.orders.filter(notCancelled).reduce((s, o) => s + o.total_amount, 0)),
            todayOrdersCount: db.orders.filter((o) => dayKey(new Date(o.created_at)) === today).length,
            newCustomersCount: db.users.filter((u) => u.role === "client" && u.created_at && dayKey(new Date(u.created_at)) === today).length,
            outOfStockCount: activeProducts.filter((p) => p.stock === 0).length,
            lowStockProducts: activeProducts.filter((p) => p.stock > 0 && p.stock < 5).map((p) => ({ id: p.id, name: p.name, stock: p.stock })),
        });
    })),

    http.get("/api/admin/dashboard/recent-orders", admin(() =>
        ok({ orders: sortedOrders().slice(0, 10).map((o) => toAdminOrder(o)) })
    )),

    // Chiffre d'affaires hors commandes annulées : par jour (7d, 30d) ou par mois (12m)
    http.get("/api/admin/analytics/revenue", admin(({ request }) => {
        const period = new URL(request.url).searchParams.get("period") || "7d";
        if (!["7d", "30d", "12m"].includes(period)) return fail(400, "Période invalide (7d, 30d ou 12m)");
        const monthly = period === "12m";
        const keyOf = monthly ? monthKey : dayKey;
        const keys = [];
        const start = new Date();
        if (monthly) {
            start.setDate(1);
            start.setMonth(start.getMonth() - 11);
            for (let i = 0; i < 12; i++) keys.push(monthKey(new Date(start.getFullYear(), start.getMonth() + i, 1)));
        } else {
            const days = period === "7d" ? 7 : 30;
            start.setDate(start.getDate() - (days - 1));
            for (let i = 0; i < days; i++) keys.push(dayKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)));
        }
        const buckets = Object.fromEntries(keys.map((k) => [k, { revenue: 0, ordersCount: 0 }]));
        db.orders.filter(notCancelled).forEach((o) => {
            const bucket = buckets[keyOf(new Date(o.created_at))];
            if (bucket) { bucket.revenue += o.total_amount; bucket.ordersCount += 1; }
        });
        const series = keys.map((date) => ({ date, revenue: round2(buckets[date].revenue), ordersCount: buckets[date].ordersCount }));
        return ok({
            period, series,
            totalRevenue: round2(series.reduce((s, b) => s + b.revenue, 0)),
            totalOrders: series.reduce((s, b) => s + b.ordersCount, 0),
        });
    })),

    http.get("/api/admin/analytics/top-products", admin(({ request }) => {
        const limit = Math.min(parseInt(new URL(request.url).searchParams.get("limit")) || 10, 50);
        const totals = {};
        db.orders.filter(notCancelled).forEach((o) => o.items.forEach((item) => {
            const t = (totals[item.productId] = totals[item.productId] || { productId: item.productId, quantitySold: 0, revenue: 0 });
            t.quantitySold += item.quantity;
            t.revenue += item.total;
        }));
        const products = Object.values(totals)
            .sort((a, b) => b.quantitySold - a.quantitySold)
            .slice(0, limit)
            .map((t) => ({ ...t, revenue: round2(t.revenue), name: findProduct(t.productId)?.name || "Produit supprimé" }));
        return ok({ products });
    })),

    /* ---------- Commandes ---------- */

    http.get("/api/admin/orders", admin(({ request }) => {
        const url = new URL(request.url);
        const status = url.searchParams.get("status");
        const startDate = url.searchParams.get("startDate");
        const email = (url.searchParams.get("userEmail") || "").toLowerCase();
        let list = sortedOrders();
        if (status) list = list.filter((o) => o.status === status);
        if (startDate) list = list.filter((o) => o.created_at.slice(0, 10) >= startDate);
        if (email) {
            list = list.filter((o) => {
                const user = userById(o.user_id);
                return user && (user.email.toLowerCase().includes(email) || (user.name || "").toLowerCase().includes(email));
            });
        }
        const { rows, pagination } = paginate(list, url);
        return ok({ orders: rows.map((o) => toAdminOrder(o)), pagination });
    })),

    http.get("/api/admin/orders/:orderId", admin(({ params }) => {
        const order = db.orders.find((o) => o.order_id === params.orderId);
        return order ? ok(toAdminOrder(order, { withHistory: true })) : fail(404, "Commande non trouvée");
    })),

    http.put("/api/admin/orders/:orderId/status", admin(async ({ request, params, user }) => {
        const order = db.orders.find((o) => o.order_id === params.orderId);
        if (!order) return fail(404, "Commande non trouvée");
        const { newStatus } = await request.json();
        const previousStatus = order.status;
        const error = changeOrderStatus(order, newStatus, user.id);
        if (error) return fail(400, error);
        return ok({ orderId: order.order_id, previousStatus, currentStatus: order.status, order: toAdminOrder(order, { withHistory: true }) });
    })),

    /* ---------- Clients ---------- */

    http.get("/api/admin/users", admin(({ request }) => {
        const url = new URL(request.url);
        const search = (url.searchParams.get("search") || "").toLowerCase();
        let list = db.users.filter((u) => u.role === "client").sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
        if (search) list = list.filter((u) => u.email.toLowerCase().includes(search) || (u.name || "").toLowerCase().includes(search));
        const { rows, pagination } = paginate(list, url);
        const users = rows.map((u) => ({
            id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.created_at, isActive: u.is_active,
            ordersCount: db.orders.filter((o) => o.user_id === u.id).length,
        }));
        return ok({ users, pagination });
    })),

    http.get("/api/admin/users/:userId", admin(({ params }) => {
        const u = userById(params.userId);
        if (!u) return fail(404, "Client non trouvé");
        const orders = sortedOrders().filter((o) => o.user_id === u.id).map((o) => toOrder(o));
        return ok({
            user: { id: u.id, name: u.name, email: u.email, role: u.role, isActive: u.is_active, createdAt: u.created_at, updatedAt: u.updated_at },
            orders,
            totalSpent: round2(orders.filter(notCancelled).reduce((s, o) => s + o.totalAmount, 0)),
            ordersCount: orders.length,
        });
    })),

    ...["deactivate", "reactivate"].map((action) =>
        http.put(`/api/admin/users/:userId/${action}`, admin(({ params, user }) => {
            const target = userById(params.userId);
            if (!target) return fail(404, "Client non trouvé");
            if (target.id === user.id) return fail(400, "Vous ne pouvez pas désactiver votre propre compte");
            target.is_active = action === "reactivate";
            target.updated_at = now();
            saveDb();
            return ok({ user: { id: target.id, email: target.email, name: target.name, isActive: target.is_active } });
        }))
    ),

    /* ---------- Produits ---------- */

    http.get("/api/admin/products", admin(({ request }) => {
        const includeInactive = new URL(request.url).searchParams.get("includeInactive") === "true";
        const products = db.products.filter((p) => includeInactive || p.is_active).map(toProduct);
        const active = db.products.filter((p) => p.is_active).length;
        return ok({ products, stats: { total: db.products.length, active, inactive: db.products.length - active, includeInactive } });
    })),

    http.post("/api/admin/products", admin(async ({ request }) => {
        const body = await request.json();
        if (!findCategory(body.categoryId)) return fail(400, "Catégorie non trouvée");
        const product = {
            id: crypto.randomUUID(), images: [], tags: [], stock: 0, is_active: true,
            rating_avg: 0, rating_count: 0, created_at: now(), updated_at: now(),
            ...productFields(body),
        };
        db.products.push(product);
        saveDb();
        return ok({ product: toProduct(product) }, { status: 201 });
    })),

    http.put("/api/admin/products/:id", admin(async ({ request, params }) => {
        const product = findProduct(params.id);
        if (!product) return fail(404, "Produit non trouvé");
        const body = await request.json();
        if (body.categoryId && !findCategory(body.categoryId)) return fail(400, "Catégorie non trouvée");
        Object.assign(product, productFields(body), { updated_at: now() });
        saveDb();
        return ok({ product: toProduct(product) });
    })),

    http.delete("/api/admin/products/:id", admin(({ params }) => {
        if (!findProduct(params.id)) return fail(404, "Produit non trouvé");
        db.products = db.products.filter((p) => p.id !== params.id);
        saveDb();
        return ok({ id: params.id });
    })),

    // Pas de fichier envoyé au serveur : URL locale de l'image, valable pendant la session
    http.post("/api/admin/products/upload-image", admin(async ({ request }) => {
        const file = (await request.formData()).get("image");
        if (!(file instanceof File)) return fail(400, "Aucune image reçue");
        return ok({ url: URL.createObjectURL(file) }, { status: 201 });
    })),

    /* ---------- Catégories ---------- */

    http.get("/api/admin/categories", admin(() =>
        ok({ categories: db.categories.map((c) => ({ id: c.id, name: c.name, description: c.description, productCount: productCount(c.id) })) })
    )),

    http.post("/api/admin/categories", admin(async ({ request }) => {
        const { name, description } = await request.json();
        if (!name || !name.trim()) return fail(400, "Le nom est obligatoire");
        if (db.categories.some((c) => c.name.toLowerCase() === name.trim().toLowerCase())) return fail(409, "Ce nom de catégorie existe déjà");
        const category = { id: crypto.randomUUID(), name: name.trim(), description: description || null, created_at: now(), updated_at: now() };
        db.categories.push(category);
        saveDb();
        return ok({ category: { ...category, productCount: 0 } }, { status: 201 });
    })),

    http.put("/api/admin/categories/:id", admin(async ({ request, params }) => {
        const category = findCategory(params.id);
        if (!category) return fail(404, "Catégorie non trouvée");
        const { name, description } = await request.json();
        if (name && db.categories.some((c) => c.id !== category.id && c.name.toLowerCase() === name.trim().toLowerCase())) {
            return fail(409, "Ce nom de catégorie existe déjà");
        }
        if (name) category.name = name.trim();
        if (description !== undefined) category.description = description;
        category.updated_at = now();
        saveDb();
        return ok({ category: { ...category, productCount: productCount(category.id) } });
    })),

    http.delete("/api/admin/categories/:id", admin(({ params }) => {
        if (!findCategory(params.id)) return fail(404, "Catégorie non trouvée");
        const count = productCount(params.id);
        if (count > 0) return fail(409, `Impossible de supprimer : ${count} produit(s) sont liés à cette catégorie`, { data: { productCount: count } });
        db.categories = db.categories.filter((c) => c.id !== params.id);
        saveDb();
        return ok({ id: params.id });
    })),
];
