import { http, HttpResponse } from "msw";
import shopPolicy from "../../../src/config/shopPolicy.json";
import { CHATBOT_URL } from "../lib/api";
import { db, findCategory } from "./data";

/*
 * Service chatbot (Flask) simulé : pas d'appel à l'IA en mode mock.
 * Réponses par règles simples, envoyées en Server-Sent Events comme le vrai service.
 */

const normalize = (text) => (text || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const euros = (n) => `${Number(n).toFixed(2).replace(".", ",")} €`;

function mockReply(message) {
    const text = normalize(message);
    const { shipping, returns } = shopPolicy;
    if (/livr|frais de port|expedi|delai/.test(text)) {
        return `La livraison en ${shipping.zone} coûte ${euros(shipping.fee)}, offerte dès ${shipping.freeThreshold} € d'achat. ` +
            `Expédition ${shipping.dispatchDelay}, livraison en ${shipping.deliveryDelay}.`;
    }
    if (/retour|rembours|rendre/.test(text)) {
        return `Vous avez ${returns.days} jours après la livraison pour retourner un produit${returns.free ? ", gratuitement" : ""}.`;
    }
    const products = db.products.filter((p) => p.is_active && text.includes(normalize(p.name).split(" ").slice(0, 2).join(" ")));
    if (products.length > 0) {
        return products.slice(0, 3)
            .map((p) => `- **${p.name}** : ${euros(p.price)} (${findCategory(p.category_id)?.name || "sans catégorie"}, stock : ${p.stock})`)
            .join("\n");
    }
    return "Je suis l'assistant de la boutique (mode démo, sans IA). Posez-moi une question sur un produit, la livraison ou les retours.";
}

// Flux SSE : la réponse découpée en morceaux, puis { done: true }
function sseStream(reply) {
    const encoder = new TextEncoder();
    const chunks = reply.match(/\S+\s*/g) || [reply];
    return new ReadableStream({
        start(controller) {
            for (const chunk of chunks) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: chunk })}\n\n`));
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
            controller.close();
        },
    });
}

export const aiHandlers = [
    http.post(`${CHATBOT_URL}/chat/message`, async ({ request }) => {
        const { message } = await request.json();
        if (!message || !message.trim()) return HttpResponse.json({ error: "Le champ 'message' est requis." }, { status: 400 });
        return new HttpResponse(sseStream(mockReply(message)), { headers: { "Content-Type": "text/event-stream" } });
    }),

    http.post(`${CHATBOT_URL}/ai/generate-description`, async ({ request }) => {
        const { name, category, tags } = await request.json();
        if (!name || !category) return HttpResponse.json({ error: "Les champs 'name' et 'category' sont requis." }, { status: 400 });
        const keywords = Array.isArray(tags) && tags.length ? ` Mots-clés : ${tags.join(", ")}.` : "";
        return HttpResponse.json({ description: `${name}, dans la catégorie ${category}.${keywords} (Description simulée en mode mock : à compléter.)` });
    }),
];
