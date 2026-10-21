/**
 * Vérifications automatiques communes aux évaluations.
 * Chaque vérification renvoie null si elle passe, sinon un message court.
 */

// Minuscules, sans accents, espaces insécables normalisés
const normalize = (text) => String(text || '')
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[  ]/g, ' ');

const matches = (text, pattern) => new RegExp(pattern, 'i').test(normalize(text));

/** Tous les motifs doivent être présents (expressions régulières, sans accents). */
function mustContain(text, patterns = []) {
  const missing = patterns.filter((p) => !matches(text, p));
  return missing.length ? `absent : ${missing.join(', ')}` : null;
}

/** Aucun motif ne doit être présent. */
function mustNotContain(text, patterns = []) {
  const found = patterns.filter((p) => matches(text, p));
  return found.length ? `présent à tort : ${found.join(', ')}` : null;
}

// Mots très fréquents : suffisant pour reconnaître la langue d'une réponse
const FR = ['le', 'la', 'les', 'des', 'est', 'et', 'pour', 'vous', 'une', 'du', 'avec', 'que', 'dans', 'pas', 'sur', 'nous', 'votre'];
const EN = ['the', 'and', 'is', 'for', 'you', 'with', 'are', 'this', 'that', 'our', 'your', 'have', 'not', 'of'];

function language(text) {
  const words = normalize(text).split(/[^a-z']+/);
  const fr = words.filter((w) => FR.includes(w)).length;
  const en = words.filter((w) => EN.includes(w)).length;
  if (fr === 0 && en === 0) return 'inconnue';
  return fr >= en ? 'fr' : 'en';
}

function mustBeFrench(text) {
  const lang = language(text);
  return lang === 'en' ? 'réponse en anglais' : null;
}

/** Montants en euros cités : « 1 229,00 € », « 29.99€ », « 50 euros ». */
function euroAmounts(text) {
  const amounts = [];
  const re = /(\d{1,3}(?:[   .]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:€|euros?\b|eur\b)/gi;
  let m;
  while ((m = re.exec(text))) {
    let raw = m[1].replace(/[   ]/g, '');
    // « 1.229,00 » ou « 1.229 » : point des milliers
    if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(raw)) raw = raw.replace(/\./g, '');
    amounts.push(Math.round(parseFloat(raw.replace(',', '.')) * 100) / 100);
  }
  return amounts;
}

/**
 * Chaque montant cité doit être un prix connu (catalogue, politique, question),
 * ou la somme ou la différence de deux prix du catalogue (comparaison, panier).
 */
function pricesAreKnown(text, allowed, catalogPrices = []) {
  const derived = [];
  for (const a of catalogPrices) {
    for (const b of catalogPrices) {
      derived.push(a + b, Math.abs(a - b));
    }
  }
  const known = [...allowed, ...derived];
  const unknown = euroAmounts(text).filter((a) => !known.some((b) => Math.abs(a - b) < 0.011));
  return unknown.length ? `montant inconnu : ${unknown.join(', ')} €` : null;
}

/** Phrases hors listes à puces. */
function sentenceCount(text) {
  const prose = String(text).split('\n')
    .filter((line) => line.trim() && !/^\s*([-*•]|\d+[.)])\s/.test(line))
    .join(' ')
    .replace(/\d[.,]\d/g, '0'); // ne pas couper « 29.99 »
  return (prose.match(/[.!?…]+(\s|$)/g) || []).length || (prose.trim() ? 1 : 0);
}

function maxSentences(text, max) {
  const n = sentenceCount(text);
  return n > max ? `${n} phrases (max ${max})` : null;
}

const bulletCount = (text) => String(text).split('\n').filter((l) => /^\s*([-*•]|\d+[.)])\s/.test(l)).length;

module.exports = {
  normalize, matches, mustContain, mustNotContain, language, mustBeFrench,
  euroAmounts, pricesAreKnown, sentenceCount, maxSentences, bulletCount
};
