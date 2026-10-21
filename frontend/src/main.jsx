import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import { CHATBOT_URL } from "./lib/api";

/*
 * Mode mock (cahier 00 §3.2) : MSW (Mock Service Worker) remplace toute l'API
 * (backend Node et service chatbot) par des données tirées de /fixtures.
 * Désactivé par défaut. Pour l'activer, dans frontend/.env.local :
 *
 *   VITE_USE_MOCK=true
 *
 * puis redémarrer `npm run dev`. Comptes de démonstration : fixtures/users.json.
 * Les mocks ne sont chargés (et inclus dans le build) que si le mode est activé.
 */
const useMock = import.meta.env.VITE_USE_MOCK === "true";

// Appels d'API sans handler : signalés dans la console (les images, scripts Vite, etc. passent sans bruit)
const API_PREFIXES = ["/api/", "/recommendations", "/events", "/search"];

function onUnhandledRequest(request, print) {
  const url = new URL(request.url);
  const isApi = API_PREFIXES.some((prefix) => url.pathname.startsWith(prefix)) || request.url.startsWith(CHATBOT_URL);
  if (isApi) print.warning();
}

async function startApp() {
  if (useMock) {
    const { worker } = await import("./mocks/browser");
    await worker.start({ onUnhandledRequest });
    console.log("[MSW] Mode mock activé : l'API est simulée à partir de /fixtures");
  }

  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>
  );
}

startApp();
