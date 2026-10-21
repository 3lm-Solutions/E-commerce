const { Op } = require('sequelize');
const { Product, UserEvent, Order, Cart, CartItem } = require('../../models');

const DEFAULT_RECENT_LIMIT = 5;
const DEFAULT_RECOMMENDATIONS_LIMIT = 10;
const EVENTS_LOOKUP_WINDOW = 30;

    // Condition d'exclusion par id, omise si la liste est vide :
    // NOT IN ('') échoue sur une colonne UUID PostgreSQL.
    function notInIds(ids) {
    return ids.size > 0 ? { id: { [Op.notIn]: [...ids] } } : {};
    }

    async function getUserRecentCategories(userId, limit = DEFAULT_RECENT_LIMIT) {
    // On récupère les événements les plus récents (view + purchase confondus)
    const recentEvents = await UserEvent.findAll({
        where: { userId },
        order: [['created_at', 'DESC']],
        limit: EVENTS_LOOKUP_WINDOW
    });

    const orderedProductIds = [];
    const seen = new Set();

    for (const event of recentEvents) {
        let productIdsInEvent = [];

        if (event.eventType === 'view' && event.productId) {
        productIdsInEvent = [event.productId];
        } else if (event.eventType === 'purchase' && Array.isArray(event.productIds)) {
        productIdsInEvent = event.productIds;
        }

        for (const productId of productIdsInEvent) {
        if (!seen.has(productId)) {
            seen.add(productId);
            orderedProductIds.push(productId);
        }
        if (orderedProductIds.length >= limit) break;
        }

        if (orderedProductIds.length >= limit) break;
    }

    if (orderedProductIds.length === 0) {
        return { recentProducts: [], categoryIds: [] };
    }

    // Récupérer la catégorie de chaque produit
    const products = await Product.findAll({
        where: { id: orderedProductIds },
        attributes: ['id', 'categoryId']
    });

    const categoryByProductId = new Map(products.map((p) => [p.id, p.categoryId]));

    // On conserve l'ordre de récence pour recentProducts
    const recentProducts = orderedProductIds
        .filter((id) => categoryByProductId.has(id))
        .map((id) => ({ productId: id, categoryId: categoryByProductId.get(id) }));

    const categoryIds = [...new Set(recentProducts.map((p) => p.categoryId))];

    return { recentProducts, categoryIds };
    }


    async function getPurchasedProductIds(userId) {
    const orders = await Order.findAll({
        where: { userId },
        attributes: ['items']
    });

    const purchasedIds = new Set();
    for (const order of orders) {
        if (Array.isArray(order.items)) {
        for (const item of order.items) {
            if (item && item.productId) {
            purchasedIds.add(item.productId);
            }
        }
        }
    }

    return purchasedIds;
    }

    async function getCartProductIds(userId) {
    const cart = await Cart.findOne({ where: { userId } });
    if (!cart) {
        return new Set();
    }

    const cartItems = await CartItem.findAll({
        where: { cartId: cart.id },
        attributes: ['productId']
    });

    return new Set(cartItems.map((item) => item.productId));
    }


    async function getPersonalizedRecommendations(userId, options = {}) {
    const limit = options.limit || DEFAULT_RECOMMENDATIONS_LIMIT;
    const recentLimit = options.recentLimit || DEFAULT_RECENT_LIMIT;

    const { recentProducts, categoryIds } = await getUserRecentCategories(userId, recentLimit);

    // Produits à exclure : déjà achetés OU déjà dans le panier OU déjà vus récemment
    const [purchasedIds, cartIds] = await Promise.all([
        getPurchasedProductIds(userId),
        getCartProductIds(userId)
    ]);

    const excludedIds = new Set([
        ...purchasedIds,
        ...cartIds,
        ...recentProducts.map((p) => p.productId)
    ]);

    let recommendations = [];
    let basedOnCategories = categoryIds;

    if (categoryIds.length > 0) {
        recommendations = await Product.findAll({
        where: {
            categoryId: categoryIds,
            isActive: true,
            ...notInIds(excludedIds)
        },
        order: [['ratingAvg', 'DESC'], ['ratingCount', 'DESC']],
        limit
        });
    }

    if (recommendations.length < limit) {
        const alreadyRecommendedIds = recommendations.map((p) => p.id);
        const fallbackExcludedIds = new Set([...excludedIds, ...alreadyRecommendedIds]);

        const fallbackProducts = await Product.findAll({
        where: {
            isActive: true,
            ...notInIds(fallbackExcludedIds)
        },
        order: [['ratingAvg', 'DESC'], ['ratingCount', 'DESC']],
        limit: limit - recommendations.length
        });

        recommendations = [...recommendations, ...fallbackProducts];
    }

    return {
        basedOnCategories,
        hasHistory: recentProducts.length > 0,
        recommendations
    };
    }

    module.exports = {
    getUserRecentCategories,
    getPersonalizedRecommendations,
    getPurchasedProductIds,
    getCartProductIds
    };