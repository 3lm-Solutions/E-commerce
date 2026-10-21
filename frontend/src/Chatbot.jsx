import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, RotateCcw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { CHATBOT_URL } from './lib/api';

// Réponses du bot en Markdown (gras, listes...). react-markdown n'exécute pas
// le HTML brut ; les images sont retirées (le modèle pourrait pointer n'importe où).
const MARKDOWN_COMPONENTS = {
    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
    ul: ({ children }) => <ul className="list-disc pl-5 mb-2 last:mb-0 space-y-1">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 last:mb-0 space-y-1">{children}</ol>,
    strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
    a: ({ href, children }) => (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">{children}</a>
    ),
    h1: ({ children }) => <p className="font-semibold mb-2">{children}</p>,
    h2: ({ children }) => <p className="font-semibold mb-2">{children}</p>,
    h3: ({ children }) => <p className="font-semibold mb-2">{children}</p>,
    code: ({ children }) => <code className="bg-gray-100 rounded px-1">{children}</code>,
};

// Intervalle (ms) entre deux ajouts de caractères dans l'animation letter-by-letter.
const ANIMATION_INTERVAL = 25;
const API_URL = `${CHATBOT_URL}/chat/message`;

// Timeout (ms) au-delà duquel on abandonne une requête sans réponse (#1677).
const REQUEST_TIMEOUT_MS = 30000;

// Clé localStorage utilisée pour persister l'historique de conversation (#1677).
const STORAGE_KEY = "chatbot_conversation_history";

// Message d'accueil par défaut (affiché quand aucun historique n'est persisté).
const WELCOME_MESSAGE = "Bonjour ! Comment puis-je vous aider aujourd'hui ?";

// --- Helpers localStorage (#1677) ---
// Le format persisté est identique à celui du widget standalone :
// un tableau de { role: "user" | "assistant", content: string }.
function loadHistoryFromStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return null;
        const history = parsed
            .filter(
                (m) =>
                    m &&
                    typeof m.content === "string" &&
                    m.content !== ""
            )
            .map((m, index) => ({
                id: Date.now() + index, // ids uniques (évite les collisions avec l'accueil)
                text: m.content,
                sender: m.role === "user" ? "user" : "bot",
            }));
        return history.length > 0 ? history : null;
    } catch (err) {
        // Clé absente, JSON invalide ou localStorage désactivé → historique par défaut.
        console.warn("[chatbot] Impossible de charger l'historique :", err);
        return null;
    }
}

function saveHistoryToStorage(messages) {
    try {
        const history = messages
            .filter((m) => m && m.text && m.text !== "")
            .map((m) => ({
                role: m.sender === "user" ? "user" : "assistant",
                content: m.text,
            }));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (err) {
        // Quota dépassé ou localStorage désactivé : on logge sans bloquer l'app.
        console.warn("[chatbot] Impossible de sauvegarder l'historique :", err);
    }
}

function Chatbot() {
    const [isOpen, setIsOpen] = useState(false);
    // #1677 : au montage, on charge l'historique persisté ; sinon message d'accueil par défaut.
    const [messages, setMessages] = useState(() => {
        const stored = loadHistoryFromStorage();
        return stored ?? [{ id: 1, text: WELCOME_MESSAGE, sender: "bot" }];
    });
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const [error, setError] = useState(null);

    // Refs pour l'animation letter-by-letter (éviter des re-renders par frame)
    const targetTextRef = useRef(""); // texte cible complet reçu du stream
    const displayedTextRef = useRef(""); // texte actuellement affiché
    const animationIdRef = useRef(null); // id de la boucle requestAnimationFrame
    const lastFrameTimeRef = useRef(0); // timestamp du dernier "tick"
    const streamEndedRef = useRef(false); // true dès que done / stream terminé
    const activeBotIdRef = useRef(null); // id du message bot en cours d'animation
    const abortRef = useRef(null); // AbortController du fetch en cours
    const timeoutRef = useRef(null); // id du setTimeout du timeout 30s (#1677)

    // #1677 : useRef sur le conteneur scrollable pour l'auto-scroll
    const messagesContainerRef = useRef(null);
    // #1677 : après un reset volontaire, on supprime la clé plutôt que de ré-écrire l'accueil
    const skipPersistRef = useRef(false);

    // Auto-scroll vers le bas quand les messages ou isTyping changent.
    // Se déclenche aussi pendant l'animation letter-by-letter (setMessages par tick).
    useEffect(() => {
        if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop =
                messagesContainerRef.current.scrollHeight;
        }
    }, [messages, isTyping]);

    // #1677 : persistance de l'historique à chaque changement de messages
    useEffect(() => {
        if (skipPersistRef.current) {
            // Reset volontaire : on purge la clé localStorage.
            skipPersistRef.current = false;
            try {
                localStorage.removeItem(STORAGE_KEY);
            } catch (err) {
                console.warn("[chatbot] Impossible de supprimer l'historique :", err);
            }
            return;
        }
        saveHistoryToStorage(messages);
    }, [messages]);

    // Cleanup au démontage : annule l'animation, le timeout et le fetch en cours
    useEffect(() => {
        return () => {
            if (animationIdRef.current !== null) {
                cancelAnimationFrame(animationIdRef.current);
                animationIdRef.current = null;
            }
            if (timeoutRef.current !== null) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
            abortRef.current?.abort();
        };
    }, []);

    // #1677 : retour à l'historique par défaut + purge de la clé localStorage
    const resetConversation = () => {
        // Annule le fetch en cours (s'il existe) — le finally gérera le silence
        abortRef.current?.abort();
        abortRef.current = null;
        if (timeoutRef.current !== null) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        stopAnimation();
        targetTextRef.current = "";
        displayedTextRef.current = "";
        streamEndedRef.current = false;
        activeBotIdRef.current = null;

        setError(null);
        setIsTyping(false);
        skipPersistRef.current = true; // purge la clé dans le useEffect [messages]
        setMessages([{ id: 1, text: WELCOME_MESSAGE, sender: "bot" }]);
    };

    const animateText = (timestamp) => {
        if (lastFrameTimeRef.current === 0) lastFrameTimeRef.current = timestamp;

        if (timestamp - lastFrameTimeRef.current >= ANIMATION_INTERVAL) {
            lastFrameTimeRef.current = timestamp;

            const target = targetTextRef.current;
            const current = displayedTextRef.current;

            if (current.length < target.length) {
                // Ajoute 1-2 caractères par tick (rattrapage plus rapide si gros chunks)
                const remaining = target.length - current.length;
                const step = remaining > 20 ? 2 : 1;
                const next = target.slice(0, current.length + step);
                displayedTextRef.current = next;

                const botId = activeBotIdRef.current;
                // Met à jour uniquement le dernier message bot via le state
                setMessages(prev =>
                    prev.map(msg =>
                        msg.id === botId ? { ...msg, text: next } : msg
                    )
                );
            }
        }

        if (displayedTextRef.current.length < targetTextRef.current.length) {
            animationIdRef.current = requestAnimationFrame(animateText);
        } else {
            // Rattrapage terminé
            animationIdRef.current = null;
            lastFrameTimeRef.current = 0;
            if (streamEndedRef.current) setIsTyping(false);
        }
    };

    const startAnimation = (botId) => {
        // Démarre la boucle rAF si elle n'est pas déjà en cours
        if (animationIdRef.current !== null) return;
        activeBotIdRef.current = botId;
        lastFrameTimeRef.current = 0;
        animationIdRef.current = requestAnimationFrame(animateText);
    };

    const stopAnimation = () => {
        if (animationIdRef.current !== null) {
            cancelAnimationFrame(animationIdRef.current);
            animationIdRef.current = null;
        }
        lastFrameTimeRef.current = 0;
        activeBotIdRef.current = null;
    };

    const handleSend = async (e) => {
        e.preventDefault();
        const text = input.trim();
        if (!text || isTyping) return;

        setError(null);

        const userMsg = { id: Date.now(), text, sender: "user" };
        const botMsg = { id: Date.now() + 1, text: "", sender: "bot" };
        setMessages(prev => [...prev, userMsg, botMsg]);
        setInput("");
        setIsTyping(true);

        // Historique envoyé au backend : mapper sender "bot" → "assistant"
        const historyForRequest = messages.map(m => ({
            role: m.sender === "bot" ? "assistant" : "user",
            content: m.text,
        }));

        // Réinitialise l'état d'animation pour cette réponse
        targetTextRef.current = "";
        displayedTextRef.current = "";
        streamEndedRef.current = false;
        activeBotIdRef.current = botMsg.id;

        const controller = new AbortController();
        abortRef.current = controller;
        let didTimeout = false;

        // Timeout de 30s : on abandonne la requête si le serveur ne répond pas.
        // clearTimeout est appelé dès que la réponse arrive (voir try/finally).
        timeoutRef.current = setTimeout(() => {
            didTimeout = true;
            controller.abort();
        }, REQUEST_TIMEOUT_MS);

        try {
            const res = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: text,
                    conversation_history: historyForRequest,
                }),
                signal: controller.signal,
            });

            // La réponse est arrivée : le timeout n'a plus lieu d'être.
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;

            if (!res.ok || !res.body) throw new Error("Réponse serveur invalide");

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                const lines = buffer.split("\n\n");
                buffer = lines.pop(); // fragment incomplet conservé pour le prochain tour

                for (const line of lines) {
                    if (!line.startsWith("data: ")) continue;

                    let payload;
                    try {
                        payload = JSON.parse(line.slice(6));
                    } catch (parseErr) {
                        continue; // ligne SSE malformée : on l'ignore
                    }

                    if (payload.delta) {
                        // Accumulation dans targetText ; l'animation affiche
                        // progressivement letter-by-letter via requestAnimationFrame.
                        targetTextRef.current += payload.delta;
                        startAnimation(botMsg.id);
                    }
                    if (payload.error) {
                        setError(payload.error);
                    }
                    // payload.done : ne pas couper l'animation immédiatement.
                    // C'est dans finally que streamEnded passe à true, et animateText()
                    // masquera l'indicateur quand displayedText aura rattrapé targetText.
                }
            }
        } catch (err) {
            if (err.name === "AbortError") {
                if (didTimeout) {
                    // Timeout 30s : message dédié + retrait de la bulle assistant vide.
                    setMessages(prev =>
                        prev.filter((m) => m.text !== "" || m.id !== botMsg.id)
                    );
                    setError("La requête a pris trop de temps, réessaie.");
                }
                // Sinon : reset volontaire (Nouvelle conversation) → silence.
                return;
            }
            setError("Connexion au chatbot impossible.");
            setIsTyping(false);
        } finally {
            if (timeoutRef.current !== null) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
            streamEndedRef.current = true;
            // Masquer l'indicateur seulement si l'animation a fini de rattraper.
            if (animationIdRef.current === null) setIsTyping(false);
            if (abortRef.current === controller) abortRef.current = null;
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-50">
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="bg-indigo-600 text-white p-4 rounded-full shadow-lg hover:bg-indigo-700 hover:shadow-xl transition-all hover:-translate-y-1"
                >
                    <MessageCircle size={24} />
                </button>
            )}
            {isOpen && (
                <div className="bg-white w-80 sm:w-96 rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col h-[500px] transition-all animate-in slide-in-from-bottom-5">
                    <div className="bg-indigo-600 text-white p-4 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                            <h3 className="font-semibold">Support Client</h3>
                        </div>
                        <div className="flex items-center gap-1">
                            {/* #1677 : bouton reset — cohérent avec le widget standalone */}
                            <button
                                onClick={resetConversation}
                                title="Nouvelle conversation"
                                aria-label="Nouvelle conversation"
                                className="text-indigo-100 hover:text-white transition-colors p-1"
                            >
                                <RotateCcw size={16} />
                            </button>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-indigo-100 hover:text-white transition-colors p-1"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>
                    <div
                        ref={messagesContainerRef}
                        className="flex-1 p-4 overflow-y-auto bg-gray-50 flex flex-col gap-3"
                    >
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[80%] p-3 rounded-2xl text-sm break-words ${
                                        msg.sender === 'user'
                                            ? 'bg-indigo-600 text-white rounded-br-sm whitespace-pre-wrap'
                                            : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm'
                                    }`}
                                >
                                    {msg.sender === 'user' ? (
                                        msg.text
                                    ) : (
                                        <ReactMarkdown
                                            components={MARKDOWN_COMPONENTS}
                                            disallowedElements={['img']}
                                            unwrapDisallowed
                                        >
                                            {msg.text}
                                        </ReactMarkdown>
                                    )}
                                </div>
                            </div>
                        ))}
                        {isTyping && (
                            <div className="flex justify-start">
                                <div className="bg-white border border-gray-200 text-gray-400 rounded-2xl rounded-bl-sm shadow-sm px-4 py-3 text-sm flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                                    <span className="ml-1 text-xs">en train d'écrire...</span>
                                </div>
                            </div>
                        )}
                        {error && (
                            <div className="text-red-600 text-xs text-center py-1">
                                {error}
                            </div>
                        )}
                    </div>
                    <form onSubmit={handleSend} className="p-3 bg-white border-t border-gray-100 flex gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Écrivez votre message..."
                            disabled={isTyping}
                            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <button
                            type="submit"
                            disabled={isTyping || !input.trim()}
                            className="bg-indigo-600 text-white p-2.5 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Send size={18} />
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
}

export default Chatbot;
