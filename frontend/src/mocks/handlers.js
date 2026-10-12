import { http, HttpResponse } from "msw";
import categoriesFixture from "../../../fixtures/categories.json";
import productsFixture from "../../../fixtures/products.json";
import usersFixture from "../../../fixtures/users.json";
import reviewsFixture from "../../../fixtures/reviews.json";
import ordersFixture from "../../../fixtures/orders.json";

/*
 * Mocks MSW (VITE_ENABLE_MOCKS=true) : réponses au même format que le backend,
 * construites à partir des fixtures partagées (/fixtures, cahier 00 §3.2).
 */

const users = usersFixture.map((u) => ({ ...u }));

const toCategory = (c) => c && { id: c.id, name: c.name, description: c.description };

const toProduct = (p) => ({
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
    category: toCategory(categoriesFixture.find((c) => c.id === p.category_id)),
});

const toUser = (u) => ({ id: u.id, email: u.email, role: u.role, name: u.name });

const toOrder = (o) => ({
    orderId: o.order_id,
    id: o.id,
    status: o.status,
    totalAmount: o.total_amount,
    itemsCount: o.items.length,
    items: o.items,
    shippingAddress: o.shipping_address,
    paymentMethod: o.payment_method,
    trackingNumber: o.tracking_number,
    isCancelable: o.status === "pending",
    createdAt: o.created_at,
    updatedAt: o.updated_at,
    confirmedAt: o.confirmed_at,
    processingAt: o.processing_at,
    shippedAt: o.shipped_at,
    deliveredAt: o.delivered_at,
    cancelledAt: o.cancelled_at,
});

// Faux jeton : « mock.<id utilisateur> », relu par currentUser()
const tokenFor = (user) => `mock.${user.id}`;

function currentUser(request) {
    const header = request.headers.get("Authorization") || "";
    const id = header.replace(/^Bearer mock\./, "");
    return users.find((u) => u.id === id) || null;
}

const unauthorized = () =>
    HttpResponse.json({ success: false, message: "Token d'accès requis" }, { status: 401 });

const authResponse = (user, status = 200) =>
    HttpResponse.json(
        { success: true, data: { user: toUser(user), accessToken: tokenFor(user), refreshToken: `refresh.${user.id}` } },
        { status }
    );

export const handlers = [
    http.get("/api/categories", () =>
        HttpResponse.json({ success: true, data: { categories: categoriesFixture.map(toCategory) } })
    ),

    http.get("/api/products", ({ request }) => {
        const url = new URL(request.url);
        const page = Math.max(parseInt(url.searchParams.get("page")) || 1, 1);
        const limit = Math.min(parseInt(url.searchParams.get("limit")) || 10, 50);
        const categoryId = url.searchParams.get("categoryId");
        const search = (url.searchParams.get("search") || "").toLowerCase();
        const sortBy = url.searchParams.get("sortBy");
        const desc = url.searchParams.get("sortOrder") !== "asc";

        let list = productsFixture.filter((p) => p.is_active);
        if (categoryId) list = list.filter((p) => p.category_id === categoryId);
        if (search) list = list.filter((p) => p.name.toLowerCase().includes(search));
        if (sortBy === "ratingAvg" || sortBy === "price") {
            const key = sortBy === "ratingAvg" ? "rating_avg" : "price";
            list = [...list].sort((a, b) => (desc ? b[key] - a[key] : a[key] - b[key]));
        }

        const total = list.length;
        const pages = Math.max(Math.ceil(total / limit), 1);
        return HttpResponse.json({
            success: true,
            data: {
                products: list.slice((page - 1) * limit, page * limit).map(toProduct),
                pagination: { page, limit, total, pages, hasNext: page < pages, hasPrev: page > 1 },
            },
        });
    }),

    http.get("/api/products/:id", ({ params }) => {
        const product = productsFixture.find((p) => p.id === params.id && p.is_active);
        if (!product) {
            return HttpResponse.json({ success: false, message: "Produit non trouvé" }, { status: 404 });
        }
        return HttpResponse.json({ success: true, data: { product: toProduct(product) } });
    }),

    http.get("/api/products/:id/reviews", ({ params }) => {
        const reviews = reviewsFixture
            .filter((r) => r.product_id === params.id)
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .map((r) => {
                const author = users.find((u) => u.id === r.user_id);
                return {
                    id: r.id,
                    rating: r.rating,
                    comment: r.comment,
                    createdAt: r.created_at,
                    user: author && { id: author.id, name: author.name, email: `${author.email.slice(0, 2)}***@${author.email.split("@")[1]}` },
                };
            });
        const average = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
        return HttpResponse.json({
            success: true,
            data: {
                reviews,
                pagination: { currentPage: 1, totalPages: 1, totalReviews: reviews.length, limit: 10, hasNextPage: false, hasPreviousPage: false },
                stats: { averageRating: average.toFixed(2), totalReviews: reviews.length },
            },
        });
    }),

    http.post("/api/auth/register", async ({ request }) => {
        const { name, email, password } = await request.json();
        if (users.some((u) => u.email === email)) {
            return HttpResponse.json({ success: false, message: "Cet email est déjà utilisé" }, { status: 409 });
        }
        const user = { id: crypto.randomUUID(), email, name, password, role: "client", is_active: true };
        users.push(user);
        return authResponse(user, 201);
    }),

    http.post("/api/auth/login", async ({ request }) => {
        const { email, password } = await request.json();
        const user = users.find((u) => u.email === email);
        if (!user || user.password !== password) {
            return HttpResponse.json({ success: false, message: "Email ou mot de passe incorrect" }, { status: 401 });
        }
        if (!user.is_active) {
            return HttpResponse.json({ success: false, message: "Compte désactivé" }, { status: 403 });
        }
        return authResponse(user);
    }),

    http.get("/api/auth/me", ({ request }) => {
        const user = currentUser(request);
        return user ? HttpResponse.json({ success: true, data: { user: toUser(user) } }) : unauthorized();
    }),

    http.get("/api/orders", ({ request }) => {
        const user = currentUser(request);
        if (!user) return unauthorized();
        const orders = ordersFixture
            .filter((o) => o.user_id === user.id)
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .map(toOrder);
        return HttpResponse.json({
            success: true,
            data: {
                orders,
                pagination: { total: orders.length, count: orders.length, page: 1, totalPages: 1, limit: 10, hasNextPage: false, hasPrevPage: false },
            },
        });
    }),

    http.get("/api/orders/:orderId", ({ request, params }) => {
        const user = currentUser(request);
        if (!user) return unauthorized();
        const order = ordersFixture.find((o) => o.order_id === params.orderId && o.user_id === user.id);
        if (!order) {
            return HttpResponse.json({ success: false, message: "Commande non trouvée" }, { status: 404 });
        }
        return HttpResponse.json({ success: true, data: toOrder(order) });
    }),
];
