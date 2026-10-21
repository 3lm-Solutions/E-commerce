    const { extractFiltersFromQuery } = require('../services/nlpFilterService');
    const { filterProducts, searchProductsByText, formatProduct } = require('../services/searchService');

    /**
    - POST /search/nlp : recherche en langage naturel (extraction de filtres via Groq)
    - GET  /search      : recherche classique par mot-clé (fallback)
     */
    class SearchController {

    static async searchNLP(req, res) {
        try {
        const { query } = req.body;

        if (!query || typeof query !== 'string' || query.trim().length === 0) {
            return res.status(400).json({
            success: false,
            message: 'Le champ "query" est obligatoire et doit être une chaîne non vide'
            });
        }

        //  Tentative d'extraction NLP via Groq 
        try {
            const filters = await extractFiltersFromQuery(query);
            let { products, categoryRelaxed } = await filterProducts(filters);

            // Requête vague sans résultat (ex. « cadeau pour un développeur ») :
            // recherche classique, puis produits les mieux notés
            let relaxed = null;
            if (products.length === 0) {
                products = await searchProductsByText(query);
                relaxed = products.length > 0 ? 'text' : null;
            }
            if (products.length === 0) {
                products = await filterProducts({ min_price: 0 }, 8).then((r) => r.products);
                relaxed = 'popular';
            }

            return res.status(200).json({
            success: true,
            data: {
                query,
                source: 'nlp',
                filtersUsed: filters,
                categoryRelaxed, // true si le filtre de catégorie n'a rien trouvé et a été assoupli
                relaxed, // 'text' : recherche classique ; 'popular' : mieux notés (aucun résultat exact)
                count: products.length,
                products: products.map(formatProduct)
            }
            });
        } catch (groqError) {
            //  Fallback : recherche classique par mot-clé
            console.warn(
            `[search/nlp] Extraction Groq indisponible, fallback vers la recherche classique : ${groqError.message}`
            );

            const products = await searchProductsByText(query);

            return res.status(200).json({
            success: true,
            data: {
                query,
                source: 'fallback',
                filtersUsed: null,
                fallbackReason: groqError.message,
                count: products.length,
                products: products.map(formatProduct)
            }
            });
        }

        } catch (error) {
        console.error('Erreur lors de la recherche NLP:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur lors de la recherche',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
        }
    }

    static async searchClassic(req, res) {
        try {
        const { q } = req.query;

        if (!q || typeof q !== 'string' || q.trim().length === 0) {
            return res.status(400).json({
            success: false,
            message: 'Le paramètre de requête "q" est obligatoire'
            });
        }

        const products = await searchProductsByText(q);

        res.status(200).json({
            success: true,
            data: {
            query: q,
            count: products.length,
            products: products.map(formatProduct)
            }
        });

        } catch (error) {
        console.error('Erreur lors de la recherche classique:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur serveur lors de la recherche',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
        }
    }
    }

    module.exports = SearchController;