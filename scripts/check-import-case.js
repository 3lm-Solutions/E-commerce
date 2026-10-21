#!/usr/bin/env node

/**
 * Vérifie que chaque import relatif (require / import) correspond au nom
 * exact du fichier sur le disque, casse comprise.
 * Windows ignore la casse, Linux non : un écart passe en local mais plante
 * au déploiement (bug 11).
 *
 * Usage : npm run check:imports   (code de sortie 1 en cas d'erreur)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIRS = ['src', 'models', 'config', 'migrations', 'seeders', 'scripts', 'tests', 'frontend/src'];
const SKIP = new Set(['node_modules', 'dist', '.git']);
const SOURCE_EXT = /\.(c?js|mjs|jsx|ts|tsx)$/;
const RESOLVE_EXT = ['', '.js', '.jsx', '.ts', '.tsx', '.cjs', '.mjs', '.json'];
const IMPORT_RE = /(?:require\(|import\(|from\s+|import\s+)['"](\.{1,2}\/[^'"]+)['"]/g;

// Vrai si chaque segment du chemin existe avec exactement cette casse.
function existsWithExactCase(file) {
  const rel = path.relative(ROOT, file);
  let dir = ROOT;
  for (const segment of rel.split(path.sep)) {
    if (!fs.readdirSync(dir).includes(segment)) return false;
    dir = path.join(dir, segment);
  }
  return true;
}

// Renvoie 'ok', 'case' (trouvé seulement en ignorant la casse) ou 'missing'.
function checkImport(fromFile, spec) {
  const base = path.resolve(path.dirname(fromFile), spec);
  const candidates = [
    ...RESOLVE_EXT.map((ext) => base + ext),
    path.join(base, 'index.js'),
    path.join(base, 'index.jsx'),
  ];
  let found = false;
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) continue;
    if (existsWithExactCase(candidate)) return 'ok';
    found = true;
  }
  return found ? 'case' : 'missing';
}

function walk(dir, errors) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const file = path.join(dir, name);
    if (fs.statSync(file).isDirectory()) {
      walk(file, errors);
      continue;
    }
    if (!SOURCE_EXT.test(name)) continue;

    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(IMPORT_RE)) {
      const status = checkImport(file, match[1]);
      if (status === 'ok') continue;
      const line = source.slice(0, match.index).split('\n').length;
      errors.push(`${status === 'case' ? 'Casse incorrecte' : 'Introuvable'} : ${path.relative(ROOT, file)}:${line} -> ${match[1]}`);
    }
  }
}

const errors = [];
for (const dir of DIRS) {
  const full = path.join(ROOT, dir);
  if (fs.existsSync(full)) walk(full, errors);
}

if (errors.length) {
  console.error(`❌ ${errors.length} import(s) invalide(s) :`);
  errors.forEach((error) => console.error('  ' + error));
  process.exit(1);
}
console.log('✅ Tous les imports relatifs correspondent aux fichiers (casse comprise).');
