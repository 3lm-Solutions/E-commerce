# -*- coding: utf-8 -*-
"""
Script temporaire de validation de l'endpoint /chat/message (streaming SSE)
Sans appeler la vraie API Groq (mock de sys.modules['groq']).

Exécution :
    venv\\Scripts\\python.exe _test_chat_sse.py
"""

import sys
import types

# ---------------------------------------------------------------------------
# Fake module Groq inséré AVANT l'import de app (le générateur fait
# `from groq import Groq` au moment du stream, il récupérera donc le faux SDK).
# ---------------------------------------------------------------------------
class FakeDelta:
    def __init__(self, content):
        self.content = content

class FakeChoice:
    def __init__(self, content):
        self.delta = FakeDelta(content)

class FakeChunk:
    def __init__(self, content):
        self.choices = [FakeChoice(content)]

class FakeStream:
    """Itère sur une liste fixe de chunks, puis StopIteration."""
    def __init__(self):
        self._chunks = [
            FakeChunk("Bonjour"),
            FakeChunk(" !"),
            FakeChunk(" Voici nos produits disponibles."),
        ]
        self._i = 0

    def __iter__(self):
        return self

    def __next__(self):
        if self._i >= len(self._chunks):
            raise StopIteration
        chunk = self._chunks[self._i]
        self._i += 1
        return chunk


def fake_create(self, **kwargs):
    assert kwargs.get("stream") is True, "stream doit être activé"
    messages = kwargs.get("messages", [])
    assert messages[0]["role"] == "system", "Le premier message doit être system"
    return FakeStream()


class FakeCompletions:
    def __init__(self, client):
        self.client = client

    def create(self, **kwargs):
        return fake_create(self, **kwargs)


class FakeChat:
    def __init__(self, client):
        self.completions = FakeCompletions(client)


class FakeClient:
    def __init__(self, api_key=None):
        self.api_key = api_key
        self.chat = FakeChat(self)


fake_groq = types.ModuleType("groq")
fake_groq.Groq = FakeClient
sys.modules["groq"] = fake_groq

# ---------------------------------------------------------------------------
# Import de l'app (avec le fake SDK déjà en place)
# ---------------------------------------------------------------------------
import app  # noqa: E402
import config  # noqa: E402

# Mock du catalogue et de la politique (ne pas dépendre du backend Node.js)
FAKE_POLICY = "Livraison en France métropolitaine : 4,90 €, offerte dès 50 € d'achat."

def fake_shop_context():
    return {
        "catalogue": "1. T-shirt Bleu - 19.99 € - Vêtements - Stock: 15\n2. iPhone 15 Pro - 1229.00 € - Électronique - Stock: 25",
        "policy": FAKE_POLICY,
    }

app.get_shop_context = fake_shop_context

client = app.app.test_client()

# --- Test 1 : requête valide avec historique vide ---
resp = client.post("/chat/message", json={"message": "Bonjour", "conversation_history": []})
body = resp.get_data(as_text=True)
print("STATUS:", resp.status_code)
print("CONTENT_TYPE:", resp.content_type)
print("--- BODY ---")
print(body)
print("--- FIN ---")

assert resp.status_code == 200
assert "text/event-stream" in resp.content_type
assert 'data: {"delta": "Bonjour"}' in body
assert 'data: {"delta": " !"}' in body
assert 'data: {"done": true}' in body
print("✅ TEST 1 OK : flux SSE (delta + done) conforme")

# --- Test 2 : message manquant -> 400 ---
resp2 = client.post("/chat/message", json={"conversation_history": []})
assert resp2.status_code == 400, resp2.status_code
assert "Le champ 'message' est requis (string)." in resp2.get_data(as_text=True)
print("✅ TEST 2 OK : message manquant -> 400")

# --- Test 3 : message vide -> 400 ---
resp3 = client.post("/chat/message", json={"message": "   "})
assert resp3.status_code == 400
print("✅ TEST 3 OK : message vide -> 400")

# --- Test 4 : conversation_history invalide -> 400 ---
resp4 = client.post(
    "/chat/message",
    json={"message": "Hi", "conversation_history": [{"role": "system", "content": "x"}]},
)
assert resp4.status_code == 400, resp4.status_code
print("✅ TEST 4 OK : conversation_history invalide -> 400")

# --- Test 5 : historique avec des messages valides est transmis ---
captured = {}

class FakeStreamCapture(FakeStream):
    def __init__(self, messages):
        super().__init__()
        captured["messages"] = messages

def fake_create_capture(self, **kwargs):
    captured["model"] = kwargs.get("model")
    return FakeStreamCapture(kwargs.get("messages", []))

fake_groq.Groq = type("ClientCapture", (), {"__init__": lambda self, api_key=None: setattr(self, "chat", FakeChat(self))})
# Rebuild a fake client that captures messages
class FakeClientCapture:
    def __init__(self, api_key=None):
        self.chat = FakeChatCapture(self)

class FakeChatCapture:
    def __init__(self, client):
        self.completions = FakeCompletionsCapture(client)

class FakeCompletionsCapture:
    def __init__(self, client):
        self.client = client
    def create(self, **kwargs):
        captured["model"] = kwargs.get("model")
        captured["messages"] = kwargs.get("messages", [])
        return FakeStream()

# app.py importe Groq depuis le module `groq` à chaque appel : on remplace le faux module
fake_groq.Groq = FakeClientCapture

client.post("/chat/message", json={"message": "Suivi", "conversation_history": [
    {"role": "user", "content": "Bonjour"},
    {"role": "assistant", "content": "Salut !"},
]})
assert captured["model"] == config.get_groq_model(), captured.get("model")
msgs = captured["messages"]
assert msgs[0]["role"] == "system", msgs
assert FAKE_POLICY in msgs[0]["content"], "politique de livraison absente du prompt"
assert "## Format" in msgs[0]["content"], "consignes de format absentes du prompt"
assert msgs[1] == {"role": "user", "content": "Bonjour"}, msgs
assert msgs[2] == {"role": "assistant", "content": "Salut !"}, msgs
assert msgs[-1] == {"role": "user", "content": "Suivi"}, msgs
print("✅ TEST 5 OK : messages Groq construits (system avec politique + historique + question)")

print("\n🎉 TOUS LES TESTS SSE SONT PASSÉS")

