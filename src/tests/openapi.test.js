/**
 * Le contrat docs/openapi.yaml doit décrire toutes les routes Express, et
 * seulement elles (cahier 00, §3.2 : « API-first »). Les routes sont lues
 * dans le code : montages de src/app.js et appels router.<méthode>() des
 * fichiers de src/routes (Express 5 ne garde pas le chemin de montage).
 */
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ROOT = path.join(__dirname, '..', '..');
const spec = yaml.load(fs.readFileSync(path.join(ROOT, 'docs', 'openapi.yaml'), 'utf8'));

// Routes de diagnostic du développement, volontairement hors contrat
const UNDOCUMENTED = new Set(['GET /api/test-db', 'GET /api/test-catalog']);

const METHODS = ['get', 'post', 'put', 'delete', 'patch'];

function join(base, sub) {
  const full = `${base}/${sub}`.replace(/\/+/g, '/').replace(/(.)\/$/, '$1');
  return full.replace(/:(\w+)/g, '{$1}');
}

function routesFromCode() {
  const appSource = fs.readFileSync(path.join(ROOT, 'src', 'app.js'), 'utf8');
  const routeFiles = Object.fromEntries(
    [...appSource.matchAll(/const (\w+) = require\('\.\/routes\/([\w-]+)'\)/g)].map(([, v, file]) => [v, file])
  );
  const routes = new Set();

  for (const [, mount, variable] of appSource.matchAll(/app\.use\('([^']+)',\s*(\w+)\)/g)) {
    const file = routeFiles[variable];
    if (!file) continue; // ex. express.static
    const source = fs.readFileSync(path.join(ROOT, 'src', 'routes', `${file}.js`), 'utf8');
    for (const [, method, sub] of source.matchAll(/router\.(get|post|put|delete|patch)\(\s*'([^']*)'/g)) {
      routes.add(`${method.toUpperCase()} ${join(mount, sub)}`);
    }
  }
  for (const [, method, route] of appSource.matchAll(/app\.(get|post|put|delete|patch)\('([^']+)'/g)) {
    routes.add(`${method.toUpperCase()} ${join('', route)}`);
  }
  return [...routes].filter((r) => !UNDOCUMENTED.has(r)).sort();
}

function routesFromSpec() {
  const routes = [];
  for (const [route, item] of Object.entries(spec.paths)) {
    for (const method of METHODS) {
      if (item[method]) routes.push(`${method.toUpperCase()} ${route}`);
    }
  }
  return routes.sort();
}

function collectRefs(node, refs = []) {
  if (Array.isArray(node)) node.forEach((n) => collectRefs(n, refs));
  else if (node && typeof node === 'object') {
    if (typeof node.$ref === 'string') refs.push(node.$ref);
    Object.values(node).forEach((n) => collectRefs(n, refs));
  }
  return refs;
}

describe('Contrat OpenAPI (docs/openapi.yaml)', () => {
  test('est un document OpenAPI 3.0', () => {
    expect(spec.openapi).toMatch(/^3\.0\./);
    expect(spec.info.version).toBeTruthy();
  });

  test('chaque route du code est documentée', () => {
    const documented = new Set(routesFromSpec());
    expect(routesFromCode().filter((r) => !documented.has(r))).toEqual([]);
  });

  test('chaque route documentée existe dans le code', () => {
    const implemented = new Set(routesFromCode());
    expect(routesFromSpec().filter((r) => !implemented.has(r))).toEqual([]);
  });

  test('toutes les références $ref existent', () => {
    const missing = collectRefs(spec).filter((ref) => {
      const target = ref.replace(/^#\//, '').split('/').reduce((node, key) => node && node[key], spec);
      return target === undefined;
    });
    expect([...new Set(missing)]).toEqual([]);
  });

  test('les paramètres de chemin sont déclarés', () => {
    const problems = [];
    for (const [route, item] of Object.entries(spec.paths)) {
      const expected = [...route.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      for (const method of METHODS.filter((m) => item[m])) {
        const params = [...(item.parameters || []), ...(item[method].parameters || [])]
          .map((p) => (p.$ref ? p.$ref.split('/').reduce((n, k) => (k === '#' ? spec : n[k]), spec) : p))
          .filter((p) => p.in === 'path')
          .map((p) => p.name)
          .sort();
        if (JSON.stringify(params) !== JSON.stringify(expected)) problems.push(`${method.toUpperCase()} ${route}`);
      }
    }
    expect(problems).toEqual([]);
  });

  test('les états de commande correspondent au modèle Order', () => {
    const { Sequelize } = require('sequelize');
    const Order = require('../../models/Order')(new Sequelize('postgres://x:x@localhost:5432/x', { logging: false }));
    expect(spec.components.schemas.OrderStatus.enum.sort()).toEqual(Object.values(Order.STATUS).sort());
  });
});
