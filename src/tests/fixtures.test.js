/**
 * Cohérence des fixtures partagées (/fixtures, cahier 00 §3.2 et §6.2) :
 * identifiants fixes, références entre fichiers, notes calculées, commandes.
 */
const { Sequelize } = require('sequelize');

const categories = require('../../fixtures/categories.json');
const products = require('../../fixtures/products.json');
const users = require('../../fixtures/users.json');
const reviews = require('../../fixtures/reviews.json');
const orders = require('../../fixtures/orders.json');

// Le modèle Order sert uniquement pour sa machine à états (aucune connexion)
const sequelize = new Sequelize('postgres://fixtures:fixtures@localhost:5432/fixtures', { logging: false });
const Order = require('../../models/Order')(sequelize);

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const FILES = [
  ['categories', categories, 'c', 3, 5],
  ['products', products, 'p', 1, 20],
  ['users', users, 'u', 2, 10],
  ['reviews', reviews, 'r', 5, reviews.length],
  ['orders', orders, 'o', 4, orders.length]
];

describe('Fixtures partagées', () => {
  describe.each(FILES)('%s', (name, list, prefix, typeDigit, expectedCount) => {
    test(`contient ${expectedCount} éléments numérotés ${prefix}_001…`, () => {
      expect(list).toHaveLength(expectedCount);
      list.forEach((item, index) => {
        expect(item.fixture_key).toBe(`${prefix}_${String(index + 1).padStart(3, '0')}`);
      });
    });

    test('ids : UUID v4 fixes, uniques, alignés sur fixture_key', () => {
      const ids = new Set();
      for (const item of list) {
        expect(item.id).toMatch(UUID_V4);
        expect(item.id.startsWith(String(typeDigit))).toBe(true);
        expect(Number(item.id.slice(-12))).toBe(Number(item.fixture_key.slice(2)));
        ids.add(item.id);
      }
      expect(ids.size).toBe(list.length);
    });
  });

  test('les produits référencent des catégories existantes', () => {
    const categoryIds = new Set(categories.map((c) => c.id));
    products.forEach((p) => expect(categoryIds.has(p.category_id)).toBe(true));
  });

  test('rating_avg et rating_count correspondent à reviews.json', () => {
    for (const product of products) {
      const list = reviews.filter((r) => r.product_id === product.id);
      const average = list.length ? list.reduce((sum, r) => sum + r.rating, 0) / list.length : 0;
      expect(product.rating_count).toBe(list.length);
      expect(product.rating_avg).toBeCloseTo(average, 2);
    }
  });

  test('avis : produit et auteur existants, note 1-5, un seul avis par auteur et par produit', () => {
    const productIds = new Set(products.map((p) => p.id));
    const userIds = new Set(users.map((u) => u.id));
    const pairs = new Set();
    for (const review of reviews) {
      expect(productIds.has(review.product_id)).toBe(true);
      expect(userIds.has(review.user_id)).toBe(true);
      expect(review.rating).toBeGreaterThanOrEqual(1);
      expect(review.rating).toBeLessThanOrEqual(5);
      pairs.add(`${review.user_id}:${review.product_id}`);
    }
    expect(pairs.size).toBe(reviews.length);
  });

  test('utilisateurs : emails uniques, au moins un admin', () => {
    expect(new Set(users.map((u) => u.email)).size).toBe(users.length);
    expect(users.some((u) => u.role === 'admin')).toBe(true);
  });

  test('commandes : client existant, snapshot des articles et total cohérents', () => {
    const userIds = new Set(users.map((u) => u.id));
    const productsById = Object.fromEntries(products.map((p) => [p.id, p]));
    for (const order of orders) {
      expect(userIds.has(order.user_id)).toBe(true);
      expect(Object.values(Order.STATUS)).toContain(order.status);
      for (const item of order.items) {
        expect(productsById[item.productId]).toBeDefined();
        expect(item.name).toBeTruthy();
        expect(item.total).toBeCloseTo(item.price * item.quantity, 2);
      }
      const total = order.items.reduce((sum, item) => sum + item.total, 0);
      expect(order.total_amount).toBeCloseTo(total, 2);
    }
  });

  test('chaque état de commande est représenté', () => {
    expect(new Set(orders.map((o) => o.status))).toEqual(new Set(Object.values(Order.STATUS)));
  });

  test("l'historique suit la machine à états et se termine sur l'état actuel", () => {
    for (const order of orders) {
      const history = order.status_history;
      expect(history[0].from_status).toBeNull();
      expect(history[0].to_status).toBe('pending');
      for (let i = 1; i < history.length; i++) {
        expect(history[i].from_status).toBe(history[i - 1].to_status);
        expect(Order.isValidTransition(history[i].from_status, history[i].to_status)).toBe(true);
        expect(history[i].created_at >= history[i - 1].created_at).toBe(true);
      }
      expect(history[history.length - 1].to_status).toBe(order.status);
    }
  });
});
