import { useState } from "react";
import toast from "react-hot-toast";
import { apiFetch } from "../lib/api";

const MAX_COMMENT = 500;

/*
 * Formulaire de dépôt d'avis : POST /api/products/:id/reviews (utilisateur connecté).
 * onCreated(review) reçoit l'avis renvoyé par le backend (même forme que la liste).
 */
function ReviewForm({ productId, onCreated, onCancel }) {
    const [rating, setRating] = useState(0);
    const [hover, setHover] = useState(0);
    const [comment, setComment] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    async function handleSubmit(e) {
        e.preventDefault();
        if (!rating || submitting) return;

        setSubmitting(true);
        setError(null);
        try {
            const trimmed = comment.trim();
            const response = await apiFetch(`/api/products/${productId}/reviews`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(trimmed ? { rating, comment: trimmed } : { rating }),
            });
            const data = await response.json().catch(() => null);

            if (response.status === 201) {
                toast.success("Merci, votre avis a été publié !");
                onCreated(data?.data?.review);
                return;
            }
            if (response.status === 401) {
                setError("Session expirée, reconnectez-vous pour publier votre avis.");
            } else if (response.status === 409) {
                setError("Vous avez déjà laissé un avis sur ce produit.");
            } else if (response.status === 400) {
                setError(data?.errors?.[0]?.msg || data?.message || "Données invalides.");
            } else {
                setError(data?.message || "Erreur lors de l'envoi de l'avis.");
            }
        } catch (err) {
            console.error("Erreur envoi avis:", err);
            setError("Erreur réseau. Veuillez réessayer.");
        } finally {
            setSubmitting(false);
        }
    }

    const shown = hover || rating;

    return (
        <form onSubmit={handleSubmit} className="mt-6 bg-white border border-gray-200 rounded-2xl p-6">
            <h3 className="font-semibold text-gray-900">Votre avis</h3>

            <div className="flex items-center gap-1 mt-3" onMouseLeave={() => setHover(0)}>
                {[1, 2, 3, 4, 5].map((star) => (
                    <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHover(star)}
                        aria-label={`${star} étoile${star > 1 ? "s" : ""}`}
                        className={`text-3xl leading-none transition-colors ${star <= shown ? "text-yellow-400" : "text-gray-300"}`}
                    >
                        ★
                    </button>
                ))}
                <span className="text-sm text-gray-500 ml-2">
                    {rating ? `${rating}/5` : "Choisissez une note"}
                </span>
            </div>

            <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, MAX_COMMENT))}
                rows={4}
                placeholder="Partagez votre expérience (facultatif)"
                className="w-full mt-4 border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-gray-400 text-right">{comment.length}/{MAX_COMMENT}</p>

            {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

            <div className="flex justify-end gap-3 mt-4">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
                >
                    Annuler
                </button>
                <button
                    type="submit"
                    disabled={!rating || submitting}
                    className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {submitting ? "Envoi..." : "Publier l'avis"}
                </button>
            </div>
        </form>
    );
}

export default ReviewForm;
