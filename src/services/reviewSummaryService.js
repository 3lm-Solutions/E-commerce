    const crypto = require('crypto');
    const { Review, User } = require('../../models');
    const { getGroqClient, getGroqModel } = require('./groqClient');

    /* Service de résumé d'avis produits via Groq
    1. Récupère les 20 derniers avis d'un produit
    2. Les envoie à Groq pour en extraire un résumé structuré :3 avantages, 3 inconvénients, et une synthèse de la note globale
     */

    const DEFAULT_REVIEWS_LIMIT = 20;

    const SYSTEM_PROMPT = `Tu es un assistant qui résume les avis clients d'un produit e-commerce.

    À partir d'une liste d'avis (note sur 5 + commentaire), tu dois produire un résumé structuré et répondre EXCLUSIVEMENT au format JSON, sans aucun texte avant ou après :

    {
    "pros": string[],           // Jusqu'à 3 avantages mentionnés par les clients (courts, en français)
    "cons": string[],           // Jusqu'à 3 inconvénients mentionnés par les clients (courts, en français)
    "rating_summary": string    // Une phrase de synthèse sur la satisfaction globale (1-2 phrases max)
    }

    Règles strictes :
    - Réponds UNIQUEMENT avec l'objet JSON, rien d'autre (pas de markdown, pas d'explication).
    - "pros" et "cons" contiennent de 0 à 3 éléments chacun. Ne mets QUE des points réellement exprimés dans les avis : si aucun client ne cite d'inconvénient, "cons" est une liste vide []. N'invente jamais un point et ne commente pas les avis eux-mêmes (pas de « avis trop court », « note non parfaite »).
    - Base-toi uniquement sur le contenu réel des avis fournis, ne fabrique pas d'informations absentes.
    - "rating_summary" doit refléter fidèlement le ton général des avis (positif, mitigé, négatif).
    - Ignore les avis sans commentaire texte exploitable pour les listes pros/cons, mais tiens compte de leur note pour le rating_summary.`;

    async function getLatestReviews(productId, limit = DEFAULT_REVIEWS_LIMIT) {
    const reviews = await Review.findAll({
        where: { productId },
        include: [{ model: User, as: 'user', attributes: ['id', 'email'] }],
        order: [['created_at', 'DESC']],
        limit
    });

    return reviews.map((review) => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment || null,
        createdAt: review.created_at,
        author: review.user ? review.user.email : 'Utilisateur inconnu'
    }));
    }

    // Construit le texte des avis à injecter dans le prompt utilisateur envoyé à Groq.
    function buildReviewsPrompt(reviews) {
    return reviews
        .map((r, index) => {
        const commentPart = r.comment ? `"${r.comment}"` : '(pas de commentaire texte)';
        return `Avis ${index + 1} - Note: ${r.rating}/5 - Commentaire: ${commentPart}`;
        })
        .join('\n');
    }

    function normalizeSummary(rawSummary) {
    const summary = rawSummary && typeof rawSummary === 'object' ? rawSummary : {};

    const cleanList = (list) =>
        Array.isArray(list)
        ? list.filter((item) => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())
        : [];

    const pros = cleanList(summary.pros).slice(0, 3);
    const cons = cleanList(summary.cons).slice(0, 3);

    const ratingSummary =
        typeof summary.rating_summary === 'string' && summary.rating_summary.trim().length > 0
        ? summary.rating_summary.trim()
        : 'Résumé indisponible.';

    return { pros, cons, rating_summary: ratingSummary };
    }

    async function generateReviewSummary(reviews) {
    if (!Array.isArray(reviews) || reviews.length === 0) {
        throw new Error('Aucun avis disponible pour générer un résumé');
    }

    const groq = getGroqClient();
    const model = getGroqModel();

    const userPrompt = `Voici ${reviews.length} avis clients pour un produit :\n\n${buildReviewsPrompt(reviews)}`;

    let completion;
    try {
        completion = await groq.chat.completions.create({
        model,
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt }
        ],
        temperature: 0.3, // un peu de liberté pour une synthèse naturelle, mais reste factuel
        max_tokens: 500,
        response_format: { type: 'json_object' }
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

    return normalizeSummary(parsed);
    }

    // Cache mémoire des résumés : un appel Groq seulement quand les avis changent.
    // La clé est une empreinte des avis analysés (id, note, commentaire) : un avis
    // ajouté, modifié ou supprimé change l'empreinte et relance la génération.
    const MAX_CACHED_SUMMARIES = 500;
    const summaryCache = new Map();

    function reviewsFingerprint(reviews) {
    const content = JSON.stringify(reviews.map((r) => [r.id, r.rating, r.comment]));
    return crypto.createHash('sha1').update(content).digest('hex');
    }

    async function getCachedReviewSummary(productId, reviews) {
    const fingerprint = reviewsFingerprint(reviews);
    const cached = summaryCache.get(productId);
    if (cached && cached.fingerprint === fingerprint) {
        return { summary: cached.summary, cached: true };
    }

    const summary = await generateReviewSummary(reviews);

    // Map garde l'ordre d'insertion : on retire la plus ancienne entrée au-delà de la limite
    summaryCache.delete(productId);
    summaryCache.set(productId, { fingerprint, summary });
    if (summaryCache.size > MAX_CACHED_SUMMARIES) {
        summaryCache.delete(summaryCache.keys().next().value);
    }
    return { summary, cached: false };
    }

    module.exports = {
    getLatestReviews,
    generateReviewSummary,
    getCachedReviewSummary,
    normalizeSummary,
    DEFAULT_REVIEWS_LIMIT
    };