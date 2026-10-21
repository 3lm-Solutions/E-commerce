# -*- coding: utf-8 -*-
"""
Construction du prompt système et des messages pour le chatbot IA via Groq
(FonctionnalitéHaute #1671)

Ce module est l'équivalent Python de la logique déjà validée côté Node.js :
    - src/services/chatbotPrompt.js (buildSystemPrompt, buildMessagesForClaude)

Il fournit :
    - build_system_prompt(catalogue_text) : prompt système complet en français
      avec le catalogue produits injecté dynamiquement.
    - build_messages_for_groq(conversation_history, catalogue_text) : liste de
      messages au format Groq/OpenAI-compatible (un message system en premier,
      suivi des messages de conversation valides limités aux 10 derniers).
"""

# Nombre maximum de messages d'historique conservés (10 = 5 échanges)
MAX_HISTORY_MESSAGES = 10

# Liste des statuts de commande reconnus par le chatbot (suivi de commande)
ORDER_STATUSES = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"]


def build_system_prompt(catalogue_text):
    """
    Construire le prompt système complet en français pour le chatbot.

    Le prompt définit :
      - Le rôle : assistant e-commerce sympathique et professionnel
      - Les capacités : recommandations, questions prix/stock/catégories,
        aide au suivi de commande (statuts documentés)
      - Les limites : jamais inventer un produit / un prix / un stock,
        rediriger vers le support humain hors périmètre e-commerce
      - Le ton : courtois, concis, orienté conversion sans être insistant

    @param catalogue_text: texte du catalogue produits (formaté en français)
    @returns: le prompt système complet
    """
    catalogue_section = catalogue_text or "Le catalogue est actuellement indisponible."

    return "\n".join([
        "Tu es un assistant e-commerce sympathique et professionnel pour notre boutique en ligne.",
        "",
        "## Contexte produit (catalogue)",
        "Voici la liste des produits actuellement disponibles dans notre catalogue. "
        "Chaque ligne est au format : \"Nom - Prix - Catégorie - Stock - Note (si le produit a des avis) - Description\".",
        "Utilise UNIQUEMENT ces informations pour répondre aux questions sur les produits, les prix et les stocks.",
        "",
        catalogue_section,
        "",
        "## Capacités",
        "- Recommander des produits adaptés aux besoins du client en t'appuyant uniquement sur le catalogue fourni.",
        "- Répondre aux questions sur les prix, les stocks et les catégories de produits.",
        "- Comparer des produits à partir de leur description et de leur note (avec le nombre d'avis : une note sur 1 avis pèse moins qu'une note sur 12 avis).",
        "- Aider au suivi de commande. Les statuts possibles d'une commande sont : " + ", ".join(ORDER_STATUSES) + ".",
        "- Expliquer brièvement ce que signifie chaque statut de commande si le client le demande.",
        "",
        "## Limites",
        "- Ne JAMAIS inventer un produit qui n'est pas présent dans le catalogue fourni.",
        "- Ne JAMAIS donner un prix ou un stock qui ne figure pas dans le catalogue fourni.",
        "- Ne JAMAIS ajouter de caractéristique technique absente de la description fournie.",
        "- Si une information n'est pas dans le catalogue ou concerne un sujet hors e-commerce, "
        "indique que tu ne peux pas y répondre et redirige le client vers le support humain.",
        "- Ne pas donner d'avis médical, juridique ou financier.",
        "",
        "## Ton",
        "- Sois courtois, concis et chaleureux.",
        "- Oriente la conversation vers la conversion (proposer des produits pertinents) "
        "sans être insistant ni agressif commercialement.",
        "- Réponds toujours en français, sauf si le client écrit dans une autre langue."
    ])


def _is_valid_history_message(message):
    """
    Valider un message d'historique individuel.

    @param message: message à valider
    @returns: True si le message est valide ({ role, content })
    """
    return (
        isinstance(message, dict)
        and message.get("role") in ("user", "assistant")
        and isinstance(message.get("content"), str)
    )


def build_messages_for_groq(conversation_history, catalogue_text):
    """
    Construire la liste de messages au format Groq/OpenAI-compatible.

    La liste contient :
      - un premier message "system" avec le prompt système + catalogue injecté ;
      - les messages de conversation valides (rôle user/assistant), limités aux
        10 derniers pour éviter un contexte trop long.

    @param conversation_history: historique de conversation (array de { role, content })
    @param catalogue_text: texte du catalogue produits
    @returns: liste de messages [{ role, content }, ...]
    """
    history = conversation_history if isinstance(conversation_history, list) else []

    # Ne garder que les messages valides
    valid_messages = [m for m in history if _is_valid_history_message(m)]

    # Limiter aux N derniers messages (éviter un contexte trop long)
    trimmed_messages = valid_messages[-MAX_HISTORY_MESSAGES:]

    return [
        {"role": "system", "content": build_system_prompt(catalogue_text)},
        *trimmed_messages,
    ]

