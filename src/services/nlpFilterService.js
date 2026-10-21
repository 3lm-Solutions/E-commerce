    const { getGroqClient, getGroqModel } = require('./groqClient');
    const { Category, Product } = require('../../models');

    /**
     * Service d'extraction de filtres de recherche à partir d'une requête en
     * langage naturel (français ou anglais), via l'API Groq.
     *
     * Exemple : "laptop moins de 500 euros" ->
     *   { category: "Électronique", min_price: null, max_price: 500, tags: ["ordinateur portable", "laptop"] }
     */

    /**
     * Construit le prompt système. La liste des catégories du catalogue est
     * injectée (CDC 05 §3.2) pour que Groq choisisse une catégorie existante
     * au lieu d'en inventer une.
     */
    // categories : noms (string) ou { name, examples } (noms de produits de la catégorie).
    // Les exemples évitent les erreurs de rangement : sans eux, « chaussures pour courir »
    // était classé dans « Sports & Loisirs » alors que les chaussures sont dans « Vêtements ».
    function buildSystemPrompt(categories) {
    const categoriesList = categories.length > 0
        ? categories.map((category) => {
            const { name, examples = [] } = typeof category === 'string' ? { name: category } : category;
            return examples.length > 0 ? `- ${name} (exemples de produits : ${examples.join(', ')})` : `- ${name}`;
        }).join('\n')
        : '(aucune catégorie disponible)';

    return `Tu es un extracteur de filtres de recherche pour un site e-commerce.

    À partir de la requête en langage naturel d'un utilisateur, tu dois extraire UNIQUEMENT les informations suivantes et répondre EXCLUSIVEMENT au format JSON, sans aucun texte avant ou après :

    {
    "category": string ou null,   // Une catégorie de la liste ci-dessous, recopiée exactement. null si aucune ne correspond clairement.
    "min_price": number ou null,  // Le prix minimum mentionné (ex: "plus de 100 euros" -> 100). null si aucun.
    "max_price": number ou null,  // Le prix maximum mentionné (ex: "moins de 20€" -> 20). null si aucun.
    "tags": string[]              // Le type de produit et ses caractéristiques (ex: "ordinateur portable", "sans fil", "4k", "running").
    }

    Catégories disponibles :
    ${categoriesList}

    Règles strictes :
    - Réponds UNIQUEMENT avec l'objet JSON, rien d'autre (pas de markdown, pas d'explication).
    - "category" doit être recopiée exactement depuis la liste, ou null. N'invente jamais de catégorie.
    - Choisis la catégorie d'après les exemples de produits : un type de produit va dans la catégorie qui contient des produits de ce type, même si le nom d'une autre catégorie semble plus proche.
    - "min_price" et "max_price" doivent être des nombres purs (sans devise, sans texte), ou null.
    - "tags" contient des mots-clés courts en minuscules, au singulier, sans doublons. Le catalogue mélange français et anglais :
      donne chaque mot-clé en français ET son équivalent anglais courant (ex: "chaussure", "shoe").
    - N'inclus pas dans "tags" les mots déjà exprimés par le prix ("pas cher", "moins de 50 euros").
    - Si la requête ne contient aucune information exploitable, réponds { "category": null, "min_price": null, "max_price": null, "tags": [] }.

    Exemples (avec une catégorie "Électronique" dans la liste) :
    Requête: "laptop moins de 500 euros"
    Réponse: {"category": "Électronique", "min_price": null, "max_price": 500, "tags": ["ordinateur portable", "laptop"]}

    Requête: "souris sans fil entre 20 et 50 euros"
    Réponse: {"category": "Électronique", "min_price": 20, "max_price": 50, "tags": ["souris", "mouse", "sans fil", "wireless"]}`;
    }

    // Prompt de référence (sans catégories), conservé pour compatibilité
    const SYSTEM_PROMPT = buildSystemPrompt([]);

    // Nombre de produits cités en exemple par catégorie dans le prompt
    const MAX_EXAMPLES_PER_CATEGORY = 6;

    async function getCategoriesWithExamples() {
    const categories = await Category.findAll({
        attributes: ['name'],
        include: [{ model: Product, as: 'products', attributes: ['name', 'ratingCount'], where: { isActive: true }, required: false }],
        order: [['name', 'ASC']]
    });
    return categories.map((category) => ({
        name: category.name,
        examples: (category.products || [])
        .sort((a, b) => (b.ratingCount || 0) - (a.ratingCount || 0))
        .slice(0, MAX_EXAMPLES_PER_CATEGORY)
        .map((product) => product.name)
    }));
    }

    function parsePrice(value) {
    const parsed = parseFloat(value);
    return !isNaN(parsed) && parsed >= 0 ? parsed : null;
    }

    function normalizeFilters(rawFilters) {
    const filters = rawFilters && typeof rawFilters === 'object' ? rawFilters : {};

    // category : string non vide (casse conservée pour correspondre au nom de la catégorie), sinon null
    let category = null;
    if (typeof filters.category === 'string' && filters.category.trim().length > 0) {
        category = filters.category.trim();
    }

    // min_price / max_price : nombres positifs, sinon null
    const minPrice = parsePrice(filters.min_price);
    const maxPrice = parsePrice(filters.max_price);

    // tags : tableau de strings non vides, dédupliqué
    let tags = [];
    if (Array.isArray(filters.tags)) {
        const cleaned = filters.tags
        .filter((tag) => typeof tag === 'string' && tag.trim().length > 0)
        .map((tag) => tag.trim().toLowerCase());
        tags = [...new Set(cleaned)];
    }

    return { category, min_price: minPrice, max_price: maxPrice, tags };
    }

    async function extractFiltersFromQuery(query) {
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
        throw new Error('La requête ne peut pas être vide');
    }

    const groq = getGroqClient();
    const model = getGroqModel();
    const systemPrompt = buildSystemPrompt(await getCategoriesWithExamples());

    let completion;
    try {
        completion = await groq.chat.completions.create({
        model,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: query.trim() }
        ],
        temperature: 0, // déterministe : on veut une extraction fiable, pas créative
        max_tokens: 300,
        response_format: { type: 'json_object' } // force une sortie JSON valide
        });
    } catch (error) {
        throw new Error(`Échec de l'appel à l'API Groq : ${error.message}`);
    }

    const rawContent = completion.choices?.[0]?.message?.content;

    if (!rawContent) {
        throw new Error('Réponse vide de l\'API Groq');
    }

    let parsed;
    try {
        parsed = JSON.parse(rawContent);
    } catch (error) {
        throw new Error(`Réponse de Groq non-JSON : ${rawContent}`);
    }

    return normalizeFilters(parsed);
    }

    module.exports = {
    extractFiltersFromQuery,
    normalizeFilters, // exposé pour les tests unitaires
    buildSystemPrompt,
    SYSTEM_PROMPT
    };
