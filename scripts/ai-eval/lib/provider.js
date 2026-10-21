/**
 * Client « OpenAI-compatible » pour Groq et Gemini : même interface que le SDK
 * Groq utilisé en production (client.chat.completions.create), pour faire
 * tourner le code de production avec un autre modèle.
 */
const PROVIDERS = {
  groq: {
    baseURL: 'https://api.groq.com/openai/v1',
    keyEnv: 'GROQ_API_KEY',
    defaultModel: () => process.env.GROQ_MODEL || 'qwen/qwen3.8-27b'
  },
  gemini: {
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keyEnv: 'GEMINI_API_KEY',
    defaultModel: () => process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  }
};

// Paramètres propres à Groq ajoutés par la production (config.get_groq_extra_body côté Python)
function groqExtraBody(model) {
  const name = model.toLowerCase();
  if (name.includes('qwen3')) return { reasoning_format: 'hidden' };
  if (name.includes('gpt-oss')) return { include_reasoning: false };
  return {};
}

function createProvider(name, model) {
  const config = PROVIDERS[name];
  if (!config) throw new Error(`Fournisseur inconnu : ${name} (groq ou gemini)`);
  const apiKey = process.env[config.keyEnv];
  if (!apiKey) throw new Error(`${config.keyEnv} absent de .env`);
  const modelName = model || config.defaultModel();
  const calls = []; // { ms, ok } de chaque appel, pour les temps de réponse

  async function create(params) {
    const { extra_body: extraBody, stream, ...rest } = params; // eslint-disable-line no-unused-vars
    const body = { ...rest, model: modelName, ...(name === 'groq' ? { ...groqExtraBody(modelName), ...extraBody } : {}) };
    const start = Date.now();
    let attempt = 0;
    // Limite de débit (429) : on attend et on relance, sans compter l'attente dans le temps de réponse
    for (;;) {
      const callStart = Date.now();
      const res = await fetch(`${config.baseURL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body)
      });
      if (res.status === 429 && attempt < 5) {
        attempt += 1;
        const retryAfter = Number(res.headers.get('retry-after')) || 5 * attempt;
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        continue;
      }
      const ms = Date.now() - callStart;
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        calls.push({ ms, ok: false });
        throw new Error(`${name} HTTP ${res.status} : ${json?.error?.message || JSON.stringify(json)?.slice(0, 200)}`);
      }
      calls.push({ ms, ok: true, waited: Date.now() - start - ms });
      return json;
    }
  }

  return {
    name,
    model: modelName,
    calls,
    client: { chat: { completions: { create } } }
  };
}

module.exports = { createProvider, PROVIDERS };
