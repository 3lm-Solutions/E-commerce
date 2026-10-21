# -*- coding: utf-8 -*-
"""
Client HTTP vers le backend Node.js pour récupérer le catalogue produits
(FonctionnalitéHaute #1671)

Le backend Flask chatbot ne doit PAS accéder directement à la base de données
PostgreSQL. Il récupère le catalogue produits déjà formaté en appelant une route
interne exposée par le backend Node.js :
    GET {NODE_BACKEND_URL}/api/internal/chatbot-catalog

La variable d'environnement NODE_BACKEND_URL est configurable (défaut :
http://localhost:3000).

En cas d'échec réseau (backend Node injoignable, timeout, etc.), une fonction
retourne un texte de repli clair afin que le chatbot puisse continuer à répondre
sans planter.
"""

import os

import requests
from dotenv import load_dotenv

# Charge les variables du fichier .env (priorité à l'environnement système)
load_dotenv(override=False)

# URL de base du backend Node.js (configurable, défaut : http://localhost:3000)
NODE_BACKEND_URL = os.getenv("NODE_BACKEND_URL", "http://localhost:3000")

# Chemin de la route interne exposée par le backend Node.js
CATALOG_ENDPOINT = "/api/internal/chatbot-catalog"

# Timeout de l'appel HTTP en secondes
TIMEOUT_SECONDS = 5

# Texte de repli si le catalogue est injoignable
FALLBACK_CATALOG_TEXT = (
    "Le catalogue est temporairement indisponible. "
    "Veuillez rediriger le client vers le support humain pour toute demande "
    "concernant les produits, les prix ou les stocks."
)


# Texte de repli si la politique de livraison et de retour est injoignable
FALLBACK_POLICY_TEXT = (
    "La politique de livraison et de retour est temporairement indisponible. "
    "Ne donne aucun frais, délai ou condition de retour : redirige le client "
    "vers le support humain."
)


def _non_empty(text, fallback):
    return text if isinstance(text, str) and text.strip() else fallback


def get_shop_context() -> dict:
    """
    Récupère le catalogue produits et la politique de livraison et de retour
    depuis le backend Node.js (une seule requête).

    @returns: { "catalogue": str, "policy": str }, avec des textes de repli si
              l'appel échoue ou si un champ est vide
    """
    url = NODE_BACKEND_URL.rstrip("/") + CATALOG_ENDPOINT

    try:
        response = requests.get(url, timeout=TIMEOUT_SECONDS)
        response.raise_for_status()

        data = response.json()
        return {
            "catalogue": _non_empty(data.get("catalogue"), FALLBACK_CATALOG_TEXT),
            "policy": _non_empty(data.get("policy"), FALLBACK_POLICY_TEXT),
        }

    except requests.exceptions.Timeout:
        print(f"⚠️ Timeout ({TIMEOUT_SECONDS}s) lors de l'appel à {url}")
    except requests.exceptions.ConnectionError:
        print(f"⚠️ Connexion refusée par le backend Node.js : {url}")
    except requests.exceptions.RequestException as exc:
        print(f"⚠️ Erreur HTTP lors de l'appel au catalogue : {exc}")
    except ValueError:
        print("⚠️ Réponse JSON invalide depuis le backend Node.js")

    return {"catalogue": FALLBACK_CATALOG_TEXT, "policy": FALLBACK_POLICY_TEXT}


def get_catalogue_text() -> str:
    """
    Récupère le texte du catalogue produits depuis le backend Node.js.

    @returns: le texte formaté du catalogue, ou un texte de repli si l'appel échoue
    """
    return get_shop_context()["catalogue"]

