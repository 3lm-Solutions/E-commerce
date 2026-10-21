import { http } from "msw";
import {
    db, saveDb, now, ok, fail, tokenFor, withUser, toUser, toCategory, toProduct, findProduct, refreshRating,
} from "./data";

/* Catalogue, authentification et avis (cahier 01). */

const authResponse = (user, status = 200) =>
    ok({ user: toUser(user), accessToken: tokenFor(user), refreshToken: `refresh.${user.id}` }, { status });

const maskEmail = (email) => `${email.slice(0, 2)}***@${email.split("@")[1]}`;

export const catalogHandlers = [
    http.get("/api/categories", () => ok({ categories: db.categories.map(toCategory) })),

    http.get("/api/products", ({ request }) => {
        const url = new URL(request.url);
        const page = Math.max(parseInt(url.searchParams.get("page")) || 1, 1);
        const limit = Math.min(parseInt(url.searchParams.get("limit")) || 10, 50);
        const categoryId = url.searchParams.get("categoryId");
        const search = (url.searchParams.get("search") || "").toLowerCase();
        const sortBy = url.searchParams.get("sortBy");
        const desc = url.searchParams.get("sortOrder") !== "asc";

        let list = db.products.filter((p) => p.is_active);
        if (categoryId) list = list.filter((p) => p.category_id === categoryId);
        if (search) list = list.filter((p) => p.name.toLowerCase().includes(search));
        if (sortBy === "ratingAvg" || sortBy === "price") {
            const key = sortBy === "ratingAvg" ? "rating_avg" : "price";
            list = [...list].sort((a, b) => (desc ? b[key] - a[key] : a[key] - b[key]));
        }

        const total = list.length;
        const pages = Math.max(Math.ceil(total / limit), 1);
        return ok({
            products: list.slice((page - 1) * limit, page * limit).map(toProduct),
            pagination: { page, limit, total, pages, hasNext: page < pages, hasPrev: page > 1 },
        });
    }),

    http.get("/api/products/:id", ({ params }) => {
        const product = db.products.find((p) => p.id === params.id && p.is_active);
        return product ? ok({ product: toProduct(product) }) : fail(404, "Produit non trouvé");
    }),

    http.get("/api/products/:id/reviews", ({ params }) => {
        const reviews = db.reviews
            .filter((r) => r.product_id === params.id)
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .map((r) => {
                const author = db.users.find((u) => u.id === r.user_id);
                return {
                    id: r.id,
                    rating: r.rating,
                    comment: r.comment,
                    createdAt: r.created_at,
                    user: author && { id: author.id, name: author.name, email: maskEmail(author.email) },
                };
            });
        const average = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
        return ok({
            reviews,
            pagination: { currentPage: 1, totalPages: 1, totalReviews: reviews.length, limit: 10, hasNextPage: false, hasPreviousPage: false },
            stats: { averageRating: average.toFixed(2), totalReviews: reviews.length },
        });
    }),

    http.post("/api/products/:id/reviews", withUser(async ({ request, params, user }) => {
        if (!findProduct(params.id)) return fail(404, "Produit non trouvé");
        if (db.reviews.some((r) => r.product_id === params.id && r.user_id === user.id)) {
            return fail(409, "Vous avez déjà laissé un avis sur ce produit");
        }
        const { rating, comment } = await request.json();
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) return fail(400, "La note doit être comprise entre 1 et 5");
        const review = { id: crypto.randomUUID(), product_id: params.id, user_id: user.id, rating, comment: comment || null, created_at: now() };
        db.reviews.push(review);
        refreshRating(params.id);
        saveDb();
        return ok({
            review: { id: review.id, rating, comment: review.comment, createdAt: review.created_at, user: { id: user.id, name: user.name } },
        }, { status: 201 });
    })),

    // Résumé simulé (pas d'IA en mode mock) : extraits des avis positifs et négatifs
    http.get("/api/products/:id/review-summary", ({ params }) => {
        const reviews = db.reviews.filter((r) => r.product_id === params.id);
        if (reviews.length === 0) return fail(404, "Ce produit n'a pas encore d'avis à résumer");
        const excerpts = (list) => list.filter((r) => r.comment).slice(0, 3).map((r) => r.comment.split(/[.!?]/)[0].trim());
        const average = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
        return ok({
            productId: params.id,
            reviewsAnalyzed: reviews.length,
            cached: false,
            summary: {
                pros: excerpts(reviews.filter((r) => r.rating >= 4)),
                cons: excerpts(reviews.filter((r) => r.rating <= 2)),
                rating_summary: `Note moyenne de ${average.toFixed(1)}/5 sur ${reviews.length} avis (résumé simulé, mode mock).`,
            },
        });
    }),

    /* ---------- Authentification ---------- */

    http.post("/api/auth/register", async ({ request }) => {
        const { name, email, password } = await request.json();
        const normalized = (email || "").trim().toLowerCase();
        if (db.users.some((u) => u.email === normalized)) return fail(409, "Un utilisateur avec cet email existe déjà");
        const user = { id: crypto.randomUUID(), email: normalized, name, password, role: "client", is_active: true, created_at: now(), updated_at: now() };
        db.users.push(user);
        saveDb();
        return authResponse(user, 201);
    }),

    http.post("/api/auth/login", async ({ request }) => {
        const { email, password } = await request.json();
        const user = db.users.find((u) => u.email === (email || "").trim().toLowerCase());
        if (!user || user.password !== password) return fail(401, "Email ou mot de passe incorrect");
        if (!user.is_active) return fail(403, "Compte désactivé");
        return authResponse(user);
    }),

    http.post("/api/auth/refresh", async ({ request }) => {
        const { refreshToken } = await request.json();
        const user = db.users.find((u) => `refresh.${u.id}` === refreshToken && u.is_active);
        return user ? authResponse(user) : fail(401, "Refresh token invalide");
    }),

    http.post("/api/auth/logout", () => ok({})),

    http.get("/api/auth/me", withUser(({ user }) => ok({ user: toUser(user) }))),
];
