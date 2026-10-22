import { http } from "msw";
import { db, saveDb, now, ok, fail, withUser, toProduct, findProduct, findCategory } from "./data";

/*
 * Recommandations, événements et recherche (cahier 05), avec les mêmes règles
 * que le backend. La recherche « intelligente » n'appelle pas d'IA en mode mock :
 * les filtres sont extraits par des règles simples (catégorie, « moins de X € »).
 */

const active = () => db.products.filter((p) => p.is_active);
const byRating = (a, b) => b.rating_avg - a.rating_avg || b.rating_count - a.rating_count;
const firstImage = (p) => (p.images && p.images[0]) || null;
const normalize = (text) => (text || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Score de similarité : +3 même catégorie, +2 par tag commun, +1 prix à ±20 %
// (le prix ne compte que s'il y a déjà une catégorie ou un tag en commun)
function similarityScore(p1, p2) {
    let score = p1.category_id === p2.category_id ? 3 : 0;
    const tags1 = new Set((p1.tags || []).map((t) => t.toLowerCase().trim()));
    score += (p2.tags || []).filter((t) => tags1.has(t.toLowerCase().trim())).length * 2;
    if (score > 0 && p1.price > 0 && Math.abs(p1.price - p2.price) / p1.price <= 0.2) score += 1;
    return score;
}

function purchasedIds(userId) {
    return new Set(db.orders.filter((o) => o.user_id === userId && o.status !== "cancelled").flatMap((o) => o.items.map((i) => i.productId)));
}

// Filtres extraits d'une requête en langage naturel, sans IA
function extractFilters(query) {
    const text = normalize(query);
    const category = db.categories.find((c) => text.includes(normalize(c.name).split(/[ &]/)[0]));
    const max = text.match(/(?:moins de|max(?:imum)?|sous|<)\s*(\d+)/);
    const min = text.match(/(?:plus de|min(?:imum)?|>|a partir de)\s*(\d+)/);
    const stopWords = new Set(["un", "une", "des", "de", "du", "le", "la", "les", "pour", "a", "moins", "plus", "euros", "euro", "eur", "et", "en", "avec"]);
    const tags = text.split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !stopWords.has(w) && !/^\d+$/.test(w));
    return { category: category ? category.name : null, min_price: min ? Number(min[1]) : null, max_price: max ? Number(max[1]) : null, tags };
}

function searchByText(query) {
    const words = normalize(query).split(/\s+/).filter((w) => w.length > 1);
    return active().filter((p) => {
        const haystack = normalize(`${p.name} ${p.description} ${(p.tags || []).join(" ")}`);
        return words.some((w) => haystack.includes(w));
    });
}

export const recoHandlers = [
    http.get("/recommendations/similar/:productId", ({ params }) => {
        const product = findProduct(params.productId);
        if (!product) return fail(404, "Produit non trouvé");
        const similarProducts = active()
            .filter((p) => p.id !== product.id)
            .map((p) => ({ p, score: similarityScore(product, p) }))
            .filter(({ score }) => score > 0)
            .sort((a, b) => b.score - a.score || byRating(a.p, b.p))
            .slice(0, 4)
            .map(({ p, score }) => ({
                id: p.id, name: p.name, price: p.price, image: firstImage(p),
                category: { id: p.category_id, name: findCategory(p.category_id)?.name }, ratingAvg: p.rating_avg, similarityScore: score,
            }));
        return ok({ productId: product.id, count: similarProducts.length, similarProducts });
    }),

    // Catégories des 5 derniers produits vus ou achetés, puis les mieux notés (comme le backend)
    http.get("/recommendations/for-you", withUser(({ request, user }) => {
        const limit = Math.min(parseInt(new URL(request.url).searchParams.get("limit")) || 4, 20);
        const recent = db.events
            .filter((e) => e.userId === user.id)
            .sort((a, b) => b.at.localeCompare(a.at))
            .map((e) => e.productId)
            .filter((id, i, all) => all.indexOf(id) === i)
            .slice(0, 5);
        const categoryIds = [...new Set(recent.map((id) => findProduct(id)?.category_id).filter(Boolean))];
        const excluded = new Set([...purchasedIds(user.id), ...(db.carts[user.id] || []).map((i) => i.productId), ...recent]);
        const candidates = active().filter((p) => !excluded.has(p.id)).sort(byRating);
        const inCategories = candidates.filter((p) => categoryIds.includes(p.category_id)).slice(0, limit);
        const fallback = candidates.filter((p) => !inCategories.includes(p)).slice(0, limit - inCategories.length);
        const recommendations = [...inCategories, ...fallback].map((p) => ({
            id: p.id, name: p.name, price: p.price, image: firstImage(p), categoryId: p.category_id, ratingAvg: p.rating_avg,
        }));
        return ok({ basedOnCategories: categoryIds, hasHistory: recent.length > 0, count: recommendations.length, recommendations });
    })),

    // Les plus vus des 7 derniers jours (vide sans événement : l'accueil prend alors les mieux notés)
    http.get("/recommendations/trending", ({ request }) => {
        const url = new URL(request.url);
        const days = parseInt(url.searchParams.get("days")) || 7;
        const limit = parseInt(url.searchParams.get("limit")) || 10;
        const since = new Date(Date.now() - days * 86400000).toISOString();
        const counts = {};
        db.events.filter((e) => e.type === "view" && e.at >= since).forEach((e) => { counts[e.productId] = (counts[e.productId] || 0) + 1; });
        const trending = Object.entries(counts)
            .map(([id, viewCount]) => ({ p: findProduct(id), viewCount }))
            .filter(({ p }) => p && p.is_active)
            .sort((a, b) => b.viewCount - a.viewCount)
            .slice(0, limit)
            .map(({ p, viewCount }) => ({
                id: p.id, name: p.name, price: p.price, image: firstImage(p),
                category: findCategory(p.category_id)?.name || null, ratingAvg: p.rating_avg, viewCount,
            }));
        return ok({ days, count: trending.length, trending });
    }),

    http.post("/events/view", withUser(async ({ request, user }) => {
        const { product_id } = await request.json();
        if (!findProduct(product_id)) return fail(404, "Produit non trouvé");
        db.events.push({ userId: user.id, productId: product_id, type: "view", at: now() });
        saveDb();
        return ok({ logged: true }, { status: 201 });
    })),

    http.post("/events/purchase", withUser(async ({ request, user }) => {
        const { product_ids } = await request.json();
        (product_ids || []).forEach((id) => db.events.push({ userId: user.id, productId: id, type: "purchase", at: now() }));
        saveDb();
        return ok({ logged: true }, { status: 201 });
    })),

    http.post("/search/nlp", async ({ request }) => {
        const { query } = await request.json();
        if (!query || !query.trim()) return fail(400, "La requête est obligatoire");
        const filters = extractFilters(query);
        let list = active();
        if (filters.min_price !== null) list = list.filter((p) => p.price >= filters.min_price);
        if (filters.max_price !== null) list = list.filter((p) => p.price <= filters.max_price);
        let categoryRelaxed = false;
        if (filters.category) {
            const inCategory = list.filter((p) => findCategory(p.category_id)?.name === filters.category);
            if (inCategory.length > 0) list = inCategory;
            else categoryRelaxed = true;
        }
        // Classement : nombre de mots-clés retrouvés, puis note
        const score = (p) => filters.tags.filter((t) => normalize(`${p.name} ${p.description} ${(p.tags || []).join(" ")}`).includes(t)).length;
        const products = list.sort((a, b) => score(b) - score(a) || byRating(a, b)).map(toProduct);
        return ok({ query, source: "mock", filtersUsed: filters, categoryRelaxed, count: products.length, products });
    }),

    http.get("/search", ({ request }) => {
        const q = new URL(request.url).searchParams.get("q") || "";
        const products = q.trim() ? searchByText(q).map(toProduct) : [];
        return ok({ query: q, source: "keyword", count: products.length, products });
    }),
];
