# -*- coding: utf-8 -*-
"""
Configuration du backend Python du chatbot IA (TâcheHaute #1673)

Charge les variables d'environnement depuis le fichier .env (via python-dotenv)
et les expose de manière centralisée pour le reste de l'application.

Variables attendues :
    - GROQ_API_KEY : clé API Groq (obligatoire)
    - GROQ_MODEL   : modèle Groq (défaut : qwen/qwen3.8-27b)
    - PORT         : port HTTP du serveur Flask (défaut : 5000)
    - FLASK_ENV    : environnement Flask (défaut : development)

Si GROQ_API_KEY est absente, l'application doit refuser de démarrer avec
un message d'erreur explicite (voir la fonction validate_environment()).
"""

import os

from dotenv import load_dotenv

# Charge les variables du fichier .env situé dans le même dossier que ce module.
# `override=False` : les variables déjà présentes dans l'environnement système
# ont la priorité sur celles du fichier .env.
load_dotenv(override=False)


def validate_environment():
    """
    Valide que les variables d'environnement indispensables sont présentes.

    Lève une RuntimeError explicite si GROQ_API_KEY est manquante,
    afin d'éviter un échec tardif et confus au moment du premier appel à l'API.

    @raises RuntimeError: si GROQ_API_KEY n'est pas définie
    """
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key or api_key.strip() == "":
        raise RuntimeError(
            "GROQ_API_KEY est absente ou vide. "
            "Copiez .env.example vers .env et renseignez votre clé API Groq."
        )


def get_groq_api_key() -> str:
    """
    Retourne la clé API Groq.

    @returns: la clé API non vide
    @raises RuntimeError: si la clé est absente (validation non passée)
    """
    validate_environment()
    return os.getenv("GROQ_API_KEY")


# Modèle par défaut : llama-3.3-70b-versatile n'existe plus chez Groq.
DEFAULT_GROQ_MODEL = "qwen/qwen3.8-27b"


def get_groq_model() -> str:
    """
    Retourne le modèle Groq à utiliser (même variable que le backend Node).

    @returns: la valeur de GROQ_MODEL, sinon DEFAULT_GROQ_MODEL
    """
    return os.getenv("GROQ_MODEL", "").strip() or DEFAULT_GROQ_MODEL


def get_groq_extra_body() -> dict:
    """
    Paramètres à ajouter aux appels Groq pour masquer le raisonnement des
    modèles qui en produisent (sinon il apparaît dans la réponse au client).

    @returns: dict à passer en `extra_body` (vide si le modèle n'en a pas besoin)
    """
    model = get_groq_model().lower()
    if "qwen3" in model:
        return {"reasoning_format": "hidden"}
    if "gpt-oss" in model:
        return {"include_reasoning": False}
    return {}


def get_port() -> int:
    """
    Retourne le port HTTP du serveur Flask.

    @returns: le port (entier), 5000 par défaut
    """
    try:
        return int(os.getenv("PORT", "5000"))
    except ValueError:
        # Si PORT n'est pas un entier valide, on retombe sur 5000
        return 5000


def get_flask_env() -> str:
    """
    Retourne l'environnement Flask.

    @returns: "development" par défaut, sinon la valeur de FLASK_ENV
    """
    return os.getenv("FLASK_ENV", "development")


