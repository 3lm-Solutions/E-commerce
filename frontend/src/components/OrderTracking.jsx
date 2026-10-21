import { Check, X } from "lucide-react";

const STEP_LABELS = {
    pending: "Commandée",
    confirmed: "Confirmée",
    processing: "En préparation",
    shipped: "Expédiée",
    delivered: "Livrée",
    cancelled: "Annulée",
};

function formatDate(date) {
    return date
        ? new Date(date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
        : null;
}

/*
 * Suivi horizontal : points reliés par une ligne, dates en dessous.
 * tracking = réponse de GET /api/orders/:orderId/tracking
 * (progress.timeline : [{ step, completed, date }], 2 étapes si la commande est annulée).
 */
function OrderTracking({ tracking }) {
    const timeline = tracking?.progress?.timeline || [];
    if (timeline.length === 0) return null;

    return (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-8">
                <h2 className="text-lg font-bold text-gray-900">Suivi de la commande</h2>
                {tracking.trackingNumber && (
                    <span className="text-sm text-gray-500">
                        N° de suivi : <span className="font-mono font-medium text-gray-900">{tracking.trackingNumber}</span>
                    </span>
                )}
            </div>

            <ol className="flex">
                {timeline.map((step, index) => {
                    const isCancelled = step.step === "cancelled";
                    const isLast = index === timeline.length - 1;
                    // La ligne vers l'étape suivante est colorée si l'étape suivante est atteinte
                    const nextDone = !isLast && timeline[index + 1].completed;
                    const nextCanceled = !isLast && timeline[index + 1].step === "cancelled";

                    const dotClass = isCancelled
                        ? "bg-red-500 border-red-500 text-white"
                        : step.completed
                            ? "bg-indigo-600 border-indigo-600 text-white"
                            : "bg-white border-gray-300 text-gray-300";

                    return (
                        <li key={step.step} className="relative flex-1 flex flex-col items-center text-center">
                            {!isLast && (
                                <div
                                    className={`absolute top-4 left-1/2 w-full h-0.5 ${
                                        nextDone ? (nextCanceled ? "bg-red-300" : "bg-indigo-600") : "bg-gray-200"
                                    }`}
                                />
                            )}
                            <div className={`relative z-10 w-8 h-8 rounded-full border-2 flex items-center justify-center ${dotClass}`}>
                                {isCancelled ? <X size={16} /> : step.completed ? <Check size={16} /> : null}
                            </div>
                            <p className={`mt-3 text-sm font-semibold ${
                                isCancelled ? "text-red-600" : step.completed ? "text-gray-900" : "text-gray-400"
                            }`}>
                                {STEP_LABELS[step.step] || step.step}
                            </p>
                            <p className="text-xs text-gray-500 mt-1 min-h-4">
                                {step.completed ? formatDate(step.date) : ""}
                            </p>
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}

export default OrderTracking;
