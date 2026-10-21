import { create } from "zustand";

/**
 * Lit et parse en toute sécurité l'objet utilisateur stocké dans localStorage.
 * Évite le crash "undefined is not valid JSON" si une valeur corrompue
 * (ex: la chaîne "undefined") a été stockée par une version précédente.
 */
function getStoredUser() {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (err) {
    console.warn("[useAuth] user localStorage corrompu, nettoyage:", err?.message);
    localStorage.removeItem("user");
    return null;
  }
}

/**
 * Extrait le payload { user, accessToken, refreshToken } de la réponse backend.
 * Le backend renvoie : { success, message, data: { user, accessToken, refreshToken } }
 */
function extractAuthPayload(json) {
  // Nouveau format : { data: { user, accessToken, refreshToken } }
  if (json?.data && json.data.user) {
    return {
      user: json.data.user,
      token: json.data.accessToken,
      refreshToken: json.data.refreshToken,
    };
  }
  // Ancien format compatible : { user, token, refreshToken }
  if (json?.user) {
    return {
      user: json.user,
      token: json.token || json.accessToken,
      refreshToken: json.refreshToken,
    };
  }
  return { user: null, token: null, refreshToken: null };
}

const useAuth = create((set, get) => ({
  user: getStoredUser(),
  token: localStorage.getItem("token") || null,
  isAuthenticated: !!localStorage.getItem("token"),
  loading: false,
  error: null,

  login: async (email, password) => {
    set({ loading: true, error: null });

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        set({ loading: false, error: data.message || "Erreur de connexion" });
        return false;
      }

      const { user, token, refreshToken } = extractAuthPayload(data);

      if (!user || !token) {
        set({ loading: false, error: "Réponse serveur innattendue" });
        return false;
      }

      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("token", token);
      if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
      set({ user, token, isAuthenticated: true, loading: false, error: null });
      return true;
    } catch (err) {
      console.error("login error:", err);
      set({ loading: false, error: "Erreur réseau. Veuillez réessayer." });
      return false;
    }
  },

  register: async (name, email, password) => {
    set({ loading: true, error: null });

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        set({ loading: false, error: data.message || "Erreur lors de l'inscription" });
        return false;
      }

      const { user, token, refreshToken } = extractAuthPayload(data);

      if (!user || !token) {
        set({ loading: false, error: "Réponse serveur innattendue" });
        return false;
      }

      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("token", token);
      if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
      set({ user, token, isAuthenticated: true, loading: false, error: null });
      return true;
    } catch (err) {
      console.error("register error:", err);
      set({ loading: false, error: "Erreur réseau. Veuillez réessayer." });
      return false;
    }
  },

  /**
   * Met à jour les tokens après un POST /api/auth/refresh (voir lib/api.js).
   */
  setTokens: (token, refreshToken) => {
    localStorage.setItem("token", token);
    if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
    set({ token });
  },

  /**
   * Vide la session locale sans appeler le backend
   * (utilisé quand le refresh token est invalide ou expiré).
   */
  clearSession: () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    set({ user: null, token: null, isAuthenticated: false, error: null });
  },

  /**
   * Déconnexion : invalide le refresh token côté serveur (POST /api/auth/logout),
   * puis vide la session locale. Un échec réseau n'empêche pas la déconnexion locale.
   */
  logout: async () => {
    const refreshToken = localStorage.getItem("refreshToken");
    if (refreshToken) {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
      } catch (err) {
        console.error("logout error:", err);
      }
    }
    get().clearSession();
  },

  clearError: () => set({ error: null }),
}));

export default useAuth;
