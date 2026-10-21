#!/usr/bin/env node
/**
 * Évaluation de la qualité des fonctionnalités IA (consigne du manager, 2026-10-21).
 *
 * Fait tourner le code de production (prompts, analyse des réponses) avec le
 * modèle choisi, sur des cas réalistes et des pièges, et vérifie chaque réponse
 * automatiquement.
 *
 *   node scripts/ai-eval/run.js --provider groq
 *   node scripts/ai-eval/run.js --provider gemini --model gemini-2.5-flash
 *   node scripts/ai-eval/run.js --provider groq --only chatbot,nlp
 *
 * Fonctionnalités : chatbot, nlp, reviews (résumé d'avis), descriptions, reco.
 * Prérequis : base locale (catalogue réel), clés dans .env (GROQ_API_KEY, GEMINI_API_KEY),
 * environnement Python du chatbot (chatbot-ia/backend/venv) pour le prompt des descriptions.
 * Résultats : scripts/ai-eval/results/<date>-<fournisseur>-<modèle>.md et .json
 */
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
require('dotenv').config({ path: path.join(ROOT, '.env'), quiet: true });

const { createProvider } = require('./lib/provider');
const check = require('./lib/checks');

/* ---------- Arguments ---------- */

const args = process.argv.slice(2);
const arg = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const FEATURES = ['chatbot', 'nlp', 'reviews', 'descriptions', 'reco'];
const only = (arg('only') || FEATURES.join(',')).split(',');
const REPEAT = Math.max(Number(arg('repeat')) || 1, 1); // l'IA ne répond pas toujours pareil : chaque cas N fois
const provider = createProvider(arg('provider') || 'groq', arg('model'));

/* ---------- Code de production branché sur le modèle choisi ---------- */

// Les services lisent getGroqClient()/getGroqModel() au chargement : on les remplace avant.
const groqClient = require(path.join(ROOT, 'src/services/groqClient'));
let forceFailure = false; // test du repli de la recherche quand l'IA ne répond pas
const failingClient = { chat: { completions: { create: async () => { throw new Error('API IA indisponible (simulée)'); } } } };
groqClient.getGroqClient = () => (forceFailure ? failingClient : provider.client);
groqClient.getGroqModel = () => provider.model;

const { buildSystemPrompt } = require(path.join(ROOT, 'src/services/chatbotPrompt'));
const { getProductCatalogForChatbot } = require(path.join(ROOT, 'src/services/productCatalogService'));
const { describeShopPolicy, SHOP_POLICY } = require(path.join(ROOT, 'src/config/shopPolicy'));
const { extractFiltersFromQuery } = require(path.join(ROOT, 'src/services/nlpFilterService'));
const { filterProducts } = require(path.join(ROOT, 'src/services/searchService'));
const { generateReviewSummary } = require(path.join(ROOT, 'src/services/reviewSummaryService'));
const { sequelize } = require(path.join(ROOT, 'models'));

const cases = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, 'cases', `${name}.json`), 'utf8'));
const contentOf = (completion) => (completion?.choices?.[0]?.message?.content || '')
  .replace(/<think>[\s\S]*?<\/think>/g, '').trim();
// Même température que le chat en production (chatbot-ia/backend/config.py, get_chat_temperature)
const CHAT_TEMPERATURE = Number.isFinite(parseFloat(process.env.CHAT_TEMPERATURE)) ? parseFloat(process.env.CHAT_TEMPERATURE) : 0.3;

// Exécute un cas (REPEAT fois s'il appelle l'IA) : temps, erreurs, échecs de chaque essai
async function runCase(feature, c, fn, { repeat = REPEAT } = {}) {
  const runs = [];
  for (let i = 0; i < repeat; i++) {
    const failures = [];
    const fail = (msg) => { if (msg) failures.push(msg); };
    const before = provider.calls.length;
    let output = '';
    try {
      output = await fn(fail);
    } catch (error) {
      fail(`erreur : ${error.message.slice(0, 160)}`);
    }
    const ms = provider.calls.slice(before).reduce((s, x) => s + x.ms, 0) || null;
    runs.push({ ok: failures.length === 0, failures, ms, output });
  }
  const passed = runs.filter((r) => r.ok).length;
  const times = runs.map((r) => r.ms).filter(Boolean);
  const firstFailed = runs.find((r) => !r.ok);
  const result = {
    feature, id: c.id, label: c.theme || c.query || c.name || '', note: c.note || '',
    ok: passed === runs.length, passed, total: runs.length,
    ms: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null,
    failures: [...new Set(runs.flatMap((r) => r.failures))],
    output: (firstFailed || runs[0]).output,
    runs
  };
  console.log(`${result.ok ? 'OK  ' : 'FAIL'} ${feature} ${c.id} ${passed}/${runs.length} ${result.ms ?? '-'} ms ${result.failures.join(' | ')}`);
  return result;
}

/* ---------- Chatbot (prompt de production, sans streaming) ---------- */

async function evalChatbot() {
  const catalogue = await getProductCatalogForChatbot();
  const policy = describeShopPolicy();
  const system = buildSystemPrompt(catalogue, policy);
  // Prix du catalogue envoyé au modèle (format français « 1 599,99 € » depuis le 2026-10-21, ou « 1599.99 € » avant)
  const catalogPrices = [...catalogue.matchAll(/ - (\d[\d ]*(?:[.,]\d+)?) € - /g)].map((m) => Number(m[1].replace(/ /g, '').replace(',', '.')));
  const policyAmounts = [SHOP_POLICY.shipping.fee, SHOP_POLICY.shipping.freeThreshold];

  const results = [];
  for (const c of cases('chatbot')) {
    results.push(await runCase('chatbot', { ...c, theme: `${c.theme} : « ${c.question} »` }, async (fail) => {
      const completion = await provider.client.chat.completions.create({
        messages: [{ role: 'system', content: system }, { role: 'user', content: c.question }],
        temperature: CHAT_TEMPERATURE
      });
      const reply = contentOf(completion);
      if (!reply) fail('réponse vide');
      const questionAmounts = check.euroAmounts(c.question);
      fail(check.mustContain(reply, c.contains));
      if (c.containsAny && !c.containsAny.some((p) => check.matches(reply, p))) fail(`aucun de : ${c.containsAny.join(' / ')}`);
      fail(check.mustNotContain(reply, c.notContains));
      fail(check.pricesAreKnown(reply, [...catalogPrices, ...policyAmounts, ...questionAmounts, ...(c.allowAmounts || [])], catalogPrices));
      if (!c.allowEnglish) fail(check.mustBeFrench(reply));
      fail(check.maxSentences(reply, c.maxSentences || 5));
      if (c.minBullets && check.bulletCount(reply) < c.minBullets) fail(`pas de liste (${check.bulletCount(reply)} puce(s))`);
      if (c.maxPrice) {
        const tooExpensive = check.euroAmounts(reply).filter((a) => a > c.maxPrice && !policyAmounts.includes(a));
        if (tooExpensive.length) fail(`produit au-dessus du budget : ${tooExpensive.join(', ')} €`);
      }
      return reply;
    }));
  }
  return results;
}

/* ---------- Recherche NLP (extraction + filtrage de production) ---------- */

async function evalNlp() {
  const { Category } = require(path.join(ROOT, 'models'));
  const categoryNames = (await Category.findAll({ attributes: ['name'] })).map((c) => c.name);
  const results = [];

  for (const c of cases('nlp')) {
    results.push(await runCase('nlp', c, async (fail) => {
      const filters = await extractFiltersFromQuery(c.query); // lève une erreur si le JSON est invalide
      if ('category' in c && filters.category !== c.category) fail(`catégorie ${JSON.stringify(filters.category)} (attendu ${JSON.stringify(c.category)})`);
      if (filters.category !== null && !categoryNames.includes(filters.category)) fail(`catégorie inventée : ${filters.category}`);
      if ('min_price' in c && filters.min_price !== c.min_price) fail(`min_price ${filters.min_price} (attendu ${c.min_price})`);
      if ('max_price' in c && filters.max_price !== c.max_price) fail(`max_price ${filters.max_price} (attendu ${c.max_price})`);
      if (c.tagsAny && !filters.tags.some((t) => c.tagsAny.some((p) => check.matches(t, p)))) fail(`tags ${JSON.stringify(filters.tags)}`);

      const { products } = await filterProducts(filters);
      const names = products.map((p) => p.name);
      const has = (p) => names.some((n) => check.matches(n, p));
      (c.resultsInclude || []).filter((p) => !has(p)).forEach((p) => fail(`résultat manquant : ${p}`));
      (c.resultsExclude || []).filter(has).forEach((p) => fail(`résultat à tort : ${p}`));
      if (c.resultsAny && !c.resultsAny.some(has)) fail('aucun résultat pertinent');
      if (c.resultsFirst && !(names[0] && check.matches(names[0], c.resultsFirst))) fail(`premier résultat : ${names[0] || 'aucun'}`);
      if (c.resultsMinPrice && products.some((p) => Number(p.price) < c.resultsMinPrice)) fail('résultat sous le prix minimum');
      return `${JSON.stringify(filters)} → ${names.slice(0, 5).join(', ') || 'aucun résultat'}${names.length > 5 ? '…' : ''}`;
    }));
  }

  // Robustesse : l'API IA ne répond pas -> repli sur la recherche classique (route réelle)
  const request = require('supertest');
  const app = require(path.join(ROOT, 'src/app'));
  results.push(await runCase('nlp', { id: 'N19', query: 'API IA indisponible : repli vers la recherche classique' }, async (fail) => {
    forceFailure = true;
    try {
      const res = await request(app).post('/search/nlp').send({ query: 'macbook' });
      if (res.status !== 200) fail(`HTTP ${res.status}`);
      if (res.body.data?.source !== 'fallback') fail(`source ${res.body.data?.source}`);
      if (!(res.body.data?.products || []).some((p) => /macbook/i.test(p.name))) fail('pas de résultat');
      return `HTTP ${res.status}, source ${res.body.data?.source}, ${res.body.data?.count} résultat(s)`;
    } finally {
      forceFailure = false;
    }
  }, { repeat: 1 }));
  results.push(await runCase('nlp', { id: 'N20', query: 'Requête vide' }, async (fail) => {
    const res = await request(app).post('/search/nlp').send({ query: '   ' });
    if (res.status !== 400) fail(`HTTP ${res.status} (attendu 400)`);
    return `HTTP ${res.status}`;
  }, { repeat: 1 }));
  return results;
}

/* ---------- Résumé d'avis (service de production, avis contrôlés) ---------- */

function manyReviews(n) {
  const good = ['Très confortable.', 'Bonne qualité de fabrication.', 'Livraison rapide.', 'Joli design.', 'Facile à utiliser.'];
  const bad = ['Un peu cher.', 'La notice est peu claire.', 'Emballage abîmé.'];
  return Array.from({ length: n }, (_, i) => (i % 4 === 3
    ? { rating: 2, comment: bad[i % bad.length] }
    : { rating: 5 - (i % 2), comment: good[i % good.length] }));
}

async function evalReviews() {
  const results = [];
  for (const c of cases('reviews')) {
    results.push(await runCase('reviews', c, async (fail) => {
      const reviews = c.manyReviews ? manyReviews(c.manyReviews) : c.reviews;
      let summary;
      try {
        summary = await generateReviewSummary(reviews);
      } catch (error) {
        if (c.expectError) return `refusé : ${error.message}`;
        throw error;
      }
      if (c.expectError) fail('aurait dû être refusé (aucun avis)');
      const { pros, cons, rating_summary: ratingSummary } = summary;
      const anyIn = (list, patterns) => list.some((x) => patterns.some((p) => check.matches(x, p)));
      if (c.prosAny && !anyIn(pros, c.prosAny)) fail(`avantages sans : ${c.prosAny.join('/')}`);
      if (c.consAny && !anyIn(cons, c.consAny)) fail(`inconvénients sans : ${c.consAny.join('/')}`);
      if (c.prosNotAny && anyIn(pros, c.prosNotAny)) fail('avantage inventé (injection)');
      if ('prosMax' in c && pros.length > c.prosMax) fail(`${pros.length} avantage(s) (max ${c.prosMax})`);
      if ('consMax' in c && cons.length > c.consMax) fail(`${cons.length} inconvénient(s) (max ${c.consMax})`);
      if (c.summaryAny && !c.summaryAny.some((p) => check.matches(ratingSummary, p))) fail('synthèse sans la note');
      if (c.summaryNotAny && c.summaryNotAny.some((p) => check.matches(ratingSummary, p))) fail('synthèse trop positive');
      if (c.noDuplicates && pros.filter((p) => check.matches(p, 'confort')).length > 1) fail('avantage répété');
      if (c.frenchSummary) fail(check.mustBeFrench([ratingSummary, ...pros, ...cons].join('. ')));
      return `+ ${pros.join(' ; ') || '∅'} | − ${cons.join(' ; ') || '∅'} | ${ratingSummary}`;
    }));
  }
  return results;
}

/* ---------- Descriptions (prompt Python de production) ---------- */

function descriptionPrompts(list) {
  const backend = path.join(ROOT, 'chatbot-ia', 'backend');
  const python = path.join(backend, process.platform === 'win32' ? 'venv/Scripts/python.exe' : 'venv/bin/python');
  const code = 'import json,sys\nfrom services.description_prompt import build_description_prompt\n'
    + 'items=json.load(sys.stdin)\nprint(json.dumps([build_description_prompt(i["name"],i["category"],i["tags"]) for i in items]))';
  const out = execFileSync(python, ['-c', code], { cwd: backend, input: JSON.stringify(list), env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
  return JSON.parse(out.toString('utf8'));
}

// Même nettoyage que clean_generated_description (chatbot-ia/backend/app.py)
function cleanDescription(text) {
  let cleaned = String(text || '').trim();
  const first = cleaned[0];
  const last = cleaned[cleaned.length - 1];
  if (cleaned.length >= 2 && ((first === last && ['"', "'", '«', '»'].includes(first)) || (first === '«' && last === '»'))) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned;
}

async function evalDescriptions() {
  const list = cases('descriptions');
  const prompts = descriptionPrompts(list);
  const results = [];
  for (const [i, c] of list.entries()) {
    results.push(await runCase('descriptions', { ...c, theme: `${c.name} (${c.tags.join(', ') || 'sans tag'})` }, async (fail) => {
      const completion = await provider.client.chat.completions.create({ messages: [{ role: 'user', content: prompts[i] }] });
      const text = cleanDescription(contentOf(completion));
      if (!text) fail('description vide');
      fail(check.mustBeFrench(text));
      const n = check.sentenceCount(text);
      if (n < 2 || n > 4) fail(`${n} phrase(s) (attendu 2 à 3)`);
      const keyword = check.normalize(c.name).replace(/[«»"']/g, '').split(/\s+/).find((w) => w.length > 3);
      if (keyword && !check.matches(text, keyword)) fail(`nom absent (${keyword})`);
      if (/(^|\n)\s*(#|\*\*|- )/.test(text)) fail('mise en forme Markdown');
      if (check.matches(text, '^(voici|description\\s*:)')) fail('phrase d\'introduction');
      // Chiffres avec unité absents des informations fournies : caractéristique inventée
      const given = check.normalize(`${c.name} ${c.tags.join(' ')}`);
      const numbers = (check.normalize(text).match(/\d+[.,]?\d*\s?(%|go|gb|mah|cm|mm|m|kg|g|h|heures|jours|w|watts|pouces|ml|cl|l|km|mp)\b/g) || [])
        .filter((x) => !given.includes(x.replace(/\s/g, '')) && !given.includes(x));
      if (numbers.length) fail(`chiffre inventé : ${numbers.join(', ')}`);
      fail(check.mustNotContain(text, c.notContains));
      return text;
    }));
  }
  return results;
}

/* ---------- Recommandations (sans IA : cohérence des algorithmes) ---------- */

async function evalReco() {
  const { Product, User } = require(path.join(ROOT, 'models'));
  const { getSimilarProducts } = require(path.join(ROOT, 'src/services/similarityService'));
  const { getPersonalizedRecommendations } = require(path.join(ROOT, 'src/services/recommendationService'));
  const { getTrendingProducts } = require(path.join(ROOT, 'src/services/trendingService'));
  const results = [];
  const products = await Product.findAll({ where: { isActive: true }, order: [['name', 'ASC']] });

  for (const [i, product] of products.slice(0, 8).entries()) {
    results.push(await runCase('reco', { id: `S${String(i + 1).padStart(2, '0')}`, theme: `Similaires : ${product.name}` }, async (fail) => {
      const { similarProducts } = await getSimilarProducts(product.id);
      if (similarProducts.length > 4) fail(`${similarProducts.length} produits (max 4)`);
      if (similarProducts.some(({ product: p }) => p.id === product.id)) fail('contient le produit lui-même');
      const tags = new Set((product.tags || []).map((t) => t.toLowerCase()));
      similarProducts
        .filter(({ product: p }) => p.categoryId !== product.categoryId && !(p.tags || []).some((t) => tags.has(t.toLowerCase())))
        .forEach(({ product: p }) => fail(`lien par le prix seulement : ${p.name}`));
      const scores = similarProducts.map((s) => s.score);
      if (scores.some((s, k) => k > 0 && s > scores[k - 1])) fail('scores non triés');
      return similarProducts.map(({ product: p, score }) => `${p.name} (${score})`).join(', ') || 'aucun';
    }, { repeat: 1 }));
  }

  const user = await User.findOne({ where: { email: 'user@example.com' } });
  if (user) {
    results.push(await runCase('reco', { id: 'F01', theme: 'Vous aimerez aussi : user@example.com' }, async (fail) => {
      const { basedOnCategories, hasHistory, recommendations } = await getPersonalizedRecommendations(user.id, { limit: 4 });
      if (recommendations.length === 0) fail('aucune recommandation');
      if (new Set(recommendations.map((p) => p.id)).size !== recommendations.length) fail('doublons');
      if (hasHistory && !recommendations.some((p) => basedOnCategories.includes(p.categoryId))) fail('aucune dans les catégories consultées');
      return `${hasHistory ? 'historique' : 'sans historique'} → ${recommendations.map((p) => p.name).join(', ')}`;
    }, { repeat: 1 }));
  }

  results.push(await runCase('reco', { id: 'T01', theme: 'Tendances (7 jours)' }, async (fail) => {
    const trending = await getTrendingProducts(7, 8);
    const counts = trending.map((t) => Number(t.viewCount));
    if (counts.some((v, k) => k > 0 && v > counts[k - 1])) fail('non trié par nombre de vues');
    if (trending.some((t) => !t.product?.isActive)) fail('produit inactif');
    return trending.map((t) => `${t.product?.name} (${t.viewCount} vues)`).join(', ') || 'aucune vue cette semaine';
  }, { repeat: 1 }));
  return results;
}

/* ---------- Rapport ---------- */

const average = (list) => (list.length ? Math.round(list.reduce((a, b) => a + b, 0) / list.length) : null);
const LABELS = { chatbot: 'Chatbot', nlp: 'Recherche NLP', reviews: 'Résumé d\'avis', descriptions: 'Description produit', reco: 'Recommandations (sans IA)' };
const cell = (text) => String(text ?? '').replace(/\|/g, '\\|').replace(/\n+/g, ' ').slice(0, 300);

function report(all, startedAt) {
  const lines = [
    `# Évaluation IA : ${provider.name} / ${provider.model}`,
    '',
    `Date : ${startedAt.toISOString().slice(0, 16).replace('T', ' ')} · Commande : \`node scripts/ai-eval/run.js ${args.join(' ')}\``,
    '',
    `Chaque cas qui appelle l'IA est joué ${REPEAT} fois : un cas est réussi s'il passe à chaque essai.`,
    `Disponibilité : ${provider.calls.length} appels réussis ou en erreur, ${provider.unavailable.length} refus temporaires relancés`
      + ` (${Object.entries(provider.unavailable.reduce((m, c) => ({ ...m, [c]: (m[c] || 0) + 1 }), {})).map(([c, k]) => `${k} × HTTP ${c}`).join(', ') || 'aucun'}).`,
    '',
    '| Fonctionnalité | Cas réussis | Essais réussis | Temps moyen | Temps max |',
    '|---|---|---|---|---|'
  ];
  for (const feature of FEATURES.filter((f) => all[f])) {
    const list = all[feature];
    const runs = list.flatMap((r) => r.runs);
    const allTimes = runs.map((r) => r.ms).filter(Boolean);
    lines.push(`| ${LABELS[feature]} | ${list.filter((r) => r.ok).length}/${list.length} | ${runs.filter((r) => r.ok).length}/${runs.length} | ${feature === 'reco' ? '—' : `${average(allTimes)} ms`} | ${feature === 'reco' ? '—' : `${Math.max(0, ...allTimes)} ms`} |`);
  }
  for (const feature of FEATURES.filter((f) => all[f])) {
    lines.push('', `## ${LABELS[feature]}`, '', '| Cas | Résultat | Temps | Détail | Sortie |', '|---|---|---|---|---|');
    for (const r of all[feature]) {
      lines.push(`| ${r.id} ${cell(r.label)} | ${r.ok ? '✅' : '❌'} ${r.passed}/${r.total} | ${r.ms ?? '—'} | ${cell([r.failures.join(' ; '), r.note].filter(Boolean).join(' — '))} | ${cell(r.output)} |`);
    }
  }
  return lines.join('\n') + '\n';
}

(async () => {
  const startedAt = new Date();
  console.log(`Fournisseur ${provider.name}, modèle ${provider.model}`);
  const runners = { chatbot: evalChatbot, nlp: evalNlp, reviews: evalReviews, descriptions: evalDescriptions, reco: evalReco };
  const all = {};
  for (const feature of FEATURES.filter((f) => only.includes(f))) all[feature] = await runners[feature]();
  await sequelize.close();

  const dir = path.join(__dirname, 'results');
  fs.mkdirSync(dir, { recursive: true });
  const base = `${startedAt.toISOString().slice(0, 16).replace(/[:T]/g, '-')}-${provider.name}-${provider.model.replace(/[^a-z0-9.-]+/gi, '_')}`;
  fs.writeFileSync(path.join(dir, `${base}.json`), JSON.stringify({ provider: provider.name, model: provider.model, startedAt, results: all }, null, 2));
  fs.writeFileSync(path.join(dir, `${base}.md`), report(all, startedAt));
  const total = Object.values(all).flat();
  console.log(`\n${total.filter((r) => r.ok).length}/${total.length} réussis → scripts/ai-eval/results/${base}.md`);
})().catch(async (error) => {
  console.error(error);
  await sequelize.close().catch(() => {});
  process.exit(1);
});
