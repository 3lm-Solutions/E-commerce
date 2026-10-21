    const { Op } = require('sequelize');
    const { Product, Category } = require('../../models');

    /*
      Service de recherche produits
     
      - filterProducts(filters) : applique des filtres structurés
        { category, min_price, max_price, tags } issus de l'extraction NLP (Groq)
      - classicSearch(query) : recherche texte classique (fallback si Groq échoue)
     */

    const DEFAULT_LIMIT = 20;


    // Minuscules sans accents, pour comparer "Électronique" et "electronique"
    function normalizeText(text) {
    return (text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    }

    // Nombre de tags de la requête retrouvés dans le produit (nom, description, catégorie, tags)
    function tagScore(product, targetTags) {
    const haystack = normalizeText([
        product.name,
        product.description,
        product.category ? product.category.name : '',
        ...(Array.isArray(product.tags) ? product.tags : [])
    ].join(' '));
    return targetTags.filter((tag) => haystack.includes(tag)).length;
    }

    const isPrice = (value) => value !== null && value !== undefined && !isNaN(value);

    async function filterProducts(filters, limit = DEFAULT_LIMIT) {
    const { category, min_price, max_price, tags } = filters || {};

    // Aucune information exploitable extraite : pas de résultat plutôt que tout le catalogue
    const hasTags = Array.isArray(tags) && tags.length > 0;
    if (!category && !isPrice(min_price) && !isPrice(max_price) && !hasTags) {
        return { products: [], categoryRelaxed: false };
    }

    const priceCondition = {};
    if (isPrice(min_price) || isPrice(max_price)) {
        priceCondition.price = {};
        if (isPrice(min_price)) priceCondition.price[Op.gte] = min_price;
        if (isPrice(max_price)) priceCondition.price[Op.lte] = max_price;
    }

    const includeConditions = [
        { model: Category, as: 'category', attributes: ['id', 'name'] }
    ];

    const allCandidates = await Product.findAll({
        where: { isActive: true, ...priceCondition },
        include: includeConditions,
        order: [['ratingAvg', 'DESC'], ['ratingCount', 'DESC']]
    });

    const matchesCategory = (product, term) => {
        const lowerTerm = term.toLowerCase();
        const nameMatch = (product.name || '').toLowerCase().includes(lowerTerm);
        const descMatch = (product.description || '').toLowerCase().includes(lowerTerm);
        const categoryNameMatch = product.category
        ? product.category.name.toLowerCase().includes(lowerTerm)
        : false;
        const tagsMatch = Array.isArray(product.tags)
        ? product.tags.some((tag) => tag.toLowerCase().includes(lowerTerm))
        : false;
        return nameMatch || descMatch || categoryNameMatch || tagsMatch;
    };

    let candidates = allCandidates;
    let categoryRelaxed = false;

    if (category) {
        // 1. Catégorie du catalogue (Groq choisit dans la liste injectée dans le prompt).
        // Inclusion plutôt qu'égalité : "Livres" couvre aussi "Livres & Média".
        const target = normalizeText(category);
        const exactMatches = allCandidates.filter((p) => {
        if (!p.category) return false;
        const name = normalizeText(p.category.name);
        return name.includes(target) || target.includes(name);
        });
        // 2. Sinon, terme libre retrouvé dans le nom, la description ou les tags
        const looseMatches = exactMatches.length > 0
        ? exactMatches
        : allCandidates.filter((p) => matchesCategory(p, category));

        if (looseMatches.length > 0) {
        candidates = looseMatches;
        } else {
        categoryRelaxed = true;
        candidates = allCandidates;
        }
    }

    // Tags : si au moins un produit correspond à un mot-clé, on ne garde que ceux-là,
    // classés par nombre de mots-clés retrouvés. Si aucun ne correspond, on garde
    // les produits de la catégorie (la catégorie seule reste pertinente) ; sans
    // catégorie fiable, on ne renvoie rien plutôt que tout le catalogue.
    if (Array.isArray(tags) && tags.length > 0) {
        const normalizedTargetTags = tags.map(normalizeText).map((t) => t.trim()).filter(Boolean);

        let scored = candidates.map((product) => ({ product, score: tagScore(product, normalizedTargetTags) }));
        const hasTagMatch = scored.some((entry) => entry.score > 0);
        if (hasTagMatch || !category || categoryRelaxed) {
        scored = scored.filter((entry) => entry.score > 0);
        }
        // Tri stable : à score égal, l'ordre par note (requête SQL) est conservé
        scored.sort((a, b) => b.score - a.score);
        candidates = scored.map((entry) => entry.product);
    }

    return { products: candidates.slice(0, limit), categoryRelaxed };
    }

    async function searchProductsByText(query, limit = DEFAULT_LIMIT) {
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return [];
    }

    const searchTerm = query.trim();

    // On récupère tous les candidats correspondants (sans limite ici), pour
    // pouvoir ensuite les reclasser par pertinence avant de tronquer.
    const candidates = await Product.findAll({
        where: {
        isActive: true,
        [Op.or]: [
            { name: { [Op.iLike]: `%${searchTerm}%` } },
            { description: { [Op.iLike]: `%${searchTerm}%` } }
        ]
        },
        include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }]
    });

    const lowerTerm = searchTerm.toLowerCase();

    const scored = candidates.map((product) => {
        const nameLower = (product.name || '').toLowerCase();
        const nameStartsWithTerm = nameLower.startsWith(lowerTerm);
        const nameContainsTerm = nameLower.includes(lowerTerm);

        // Score de pertinence : le nom compte plus que la description,
        // et un match en début de nom compte plus qu'un match au milieu.
        let relevanceScore = 0;
        if (nameStartsWithTerm) {
        relevanceScore = 3;
        } else if (nameContainsTerm) {
        relevanceScore = 2;
        } else {
        relevanceScore = 1; // ne matche que la description
        }

        return { product, relevanceScore };
    });

    // Tri : pertinence décroissante, puis popularité (note moyenne, puis nombre d'avis)
    scored.sort((a, b) => {
        if (b.relevanceScore !== a.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
        }
        const ratingA = parseFloat(a.product.ratingAvg) || 0;
        const ratingB = parseFloat(b.product.ratingAvg) || 0;
        if (ratingB !== ratingA) {
        return ratingB - ratingA;
        }
        const countA = parseInt(a.product.ratingCount) || 0;
        const countB = parseInt(b.product.ratingCount) || 0;
        return countB - countA;
    });

    return scored.slice(0, limit).map((entry) => entry.product);
    }

    // Alias conservé pour compatibilité (utilisé comme fallback de la recherche NLP)
    const classicSearch = searchProductsByText;

    /* Formate un produit Sequelize pour la réponse JSON de l'API de recherche.
     */
    function formatProduct(product) {
    return {
        id: product.id,
        name: product.name,
        price: parseFloat(product.price),
        image: product.images && product.images.length > 0 ? product.images[0] : null,
        category: product.category ? product.category.name : null,
        tags: product.tags || [],
        ratingAvg: parseFloat(product.ratingAvg || 0)
    };
    }

    module.exports = {
    filterProducts,
    searchProductsByText,
    classicSearch,
    formatProduct
    };