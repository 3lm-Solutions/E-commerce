import useAuth from "../store/useAuth";

// URL du service chatbot (Flask). À définir dans .env.local / au déploiement.
export const CHATBOT_URL = (import.meta.env.VITE_CHATBOT_URL || "http://localhost:5000").replace(/\/$/, "");

/*
 * Promesse de refresh en cours, partagée entre toutes les requêtes :
 * si plusieurs appels reçoivent une 401 en même temps, un seul
 * POST /api/auth/refresh est envoyé (le refresh token est à usage unique).
 */
let refreshPromise = null;

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) return null;

  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;

    const json = await res.json();
    const { accessToken, refreshToken: newRefreshToken } = json?.data || {};
    if (!accessToken) return null;

    useAuth.getState().setTokens(accessToken, newRefreshToken);
    return accessToken;
  } catch (err) {
    console.error("refresh error:", err);
    return null;
  }
}

function withAuthHeader(options, token) {
  const headers = new Headers(options.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return { ...options, headers };
}

/*
 * fetch authentifié : ajoute le header Authorization (access token courant).
 * Sur une 401, tente un refresh puis rejoue la requête une seule fois.
 * Si le refresh échoue, la session locale est vidée et la réponse 401
 * d'origine est renvoyée à l'appelant (qui garde sa propre gestion d'erreur).
 */
export async function apiFetch(url, options = {}) {
  const res = await fetch(url, withAuthHeader(options, localStorage.getItem("token")));
  if (res.status !== 401) return res;

  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  const newToken = await refreshPromise;

  if (!newToken) {
    useAuth.getState().clearSession();
    return res;
  }

  return fetch(url, withAuthHeader(options, newToken));
}
