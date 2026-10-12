/**
 * Tests d'intégration : annulation, suivi, machine à états et historique des
 * commandes (cahier 02, §2.4 et §3 ; cahier 03, §3.1), sur la vraie
 * application et la base de test. Préparer la base une fois : npm run test:db
 */
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const app = require('../app');
const { Order, OrderStatusHistory, User, Product, Category, sequelize } = require('../../models');

const PREFIX = 'jest-orders-';
let client;
let otherClient;
let admin;
let category;
let product;
let order;
let seq = 0;

const tokenFor = (user) => jwt.sign(
  { userId: user.id, email: user.email, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);
const auth = (user) => ({ Authorization: `Bearer ${tokenFor(user)}` });

const createUser = (role) => User.create({
  id: randomUUID(),
  email: `${PREFIX}${role}-${Date.now()}-${++seq}@example.com`,
  password: 'hash-de-test',
  name: `Test ${role}`,
  role
});

// Commande « réservée » : le stock a déjà été décrémenté, comme le fait createOrder
async function createOrder(quantity = 2) {
  await product.decrement('stock', { by: quantity });
  return Order.create({
    id: randomUUID(),
    orderId: `ORD-TEST-${Date.now()}-${++seq}`,
    userId: client.id,
    items: [{ productId: product.id, name: product.name, price: 29.99, quantity, total: 29.99 * quantity, stockReserved: true }],
    totalAmount: 29.99 * quantity,
    status: 'pending',
    shippingAddress: { fullName: 'Test', address: '1 rue Test', city: 'Paris', postalCode: '75001' }
  });
}

const stock = async () => (await Product.findByPk(product.id)).stock;
const historyOf = async (o) => (await OrderStatusHistory.findAll({ where: { orderId: o.id }, order: [['created_at', 'ASC']] }))
  .map((h) => `${h.fromStatus || '∅'}>${h.toStatus}`);

beforeAll(async () => {
  client = await createUser('client');
  otherClient = await createUser('client');
  admin = await createUser('admin');
  category = await Category.create({ id: randomUUID(), name: `${PREFIX}cat-${Date.now()}` });
  product = await Product.create({
    id: randomUUID(), name: `${PREFIX}produit`, description: 'Produit de test', price: 29.99,
    stock: 50, categoryId: category.id, images: [], tags: [], isActive: true
  });
});

beforeEach(async () => {
  order = await createOrder();
});

afterAll(async () => {
  const userIds = [client, otherClient, admin].map((u) => u.id);
  await Order.destroy({ where: { userId: userIds } }); // l'historique suit (ON DELETE CASCADE)
  await Product.destroy({ where: { id: product.id } });
  await Category.destroy({ where: { id: category.id } });
  await User.destroy({ where: { id: userIds } });
  await sequelize.close();
});

describe('PUT /api/orders/:orderId/cancel', () => {
  test('annule une commande en attente, remet le stock et enregistre l\'historique', async () => {
    const before = await stock();
    const res = await request(app)
      .put(`/api/orders/${order.orderId}/cancel`)
      .set(auth(client))
      .send({ reason: "J'ai changé d'avis" });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      orderId: order.orderId,
      previousStatus: 'pending',
      currentStatus: 'cancelled',
      reason: "J'ai changé d'avis"
    });
    expect(res.body.data.cancelledAt).toBeTruthy();

    const updated = await Order.findByPk(order.id);
    expect(updated.status).toBe('cancelled');
    expect(updated.notes).toContain("Raison d'annulation: J'ai changé d'avis");
    expect(await stock()).toBe(before + 2);

    const history = await OrderStatusHistory.findAll({ where: { orderId: order.id }, order: [['created_at', 'ASC']] });
    expect(history.map((h) => h.toStatus)).toEqual(['pending', 'cancelled']);
    expect(history[1].changedBy).toBe(client.id);
  });

  test('sans raison (champ facultatif)', async () => {
    const res = await request(app).put(`/api/orders/${order.orderId}/cancel`).set(auth(client)).send({});
    expect(res.status).toBe(200);
    expect(res.body.data.reason).toBeNull();
  });

  test('400 si la commande n\'est plus en attente, sans toucher au stock', async () => {
    await order.updateStatus('confirmed');
    const before = await stock();
    const res = await request(app).put(`/api/orders/${order.orderId}/cancel`).set(auth(client));
    expect(res.status).toBe(400);
    expect(res.body.data).toMatchObject({ currentStatus: 'confirmed', cancelable: false });
    expect(await stock()).toBe(before);
  });

  test('une seconde annulation est refusée et ne remet pas le stock deux fois', async () => {
    await request(app).put(`/api/orders/${order.orderId}/cancel`).set(auth(client));
    const before = await stock();
    const res = await request(app).put(`/api/orders/${order.orderId}/cancel`).set(auth(client));
    expect(res.status).toBe(400);
    expect(await stock()).toBe(before);
  });

  test('401 sans token', async () => {
    const res = await request(app).put(`/api/orders/${order.orderId}/cancel`);
    expect(res.status).toBe(401);
  });

  test('404 pour la commande d\'un autre client', async () => {
    const res = await request(app).put(`/api/orders/${order.orderId}/cancel`).set(auth(otherClient));
    expect(res.status).toBe(404);
  });
});

describe('GET /api/orders/:orderId/tracking', () => {
  test('commande en attente', async () => {
    const res = await request(app).get(`/api/orders/${order.orderId}/tracking`).set(auth(client));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      status: 'pending', confirmedAt: null, processingAt: null, shippedAt: null, deliveredAt: null, cancelledAt: null
    });
    expect(res.body.data.progress.timeline.map((s) => s.step))
      .toEqual(['pending', 'confirmed', 'processing', 'shipped', 'delivered']);
  });

  test('commande livrée : toutes les étapes datées, numéro de suivi', async () => {
    for (const status of ['confirmed', 'processing', 'shipped', 'delivered']) {
      await order.updateStatus(status, { changedBy: admin.id });
    }
    const res = await request(app).get(`/api/orders/${order.orderId}/tracking`).set(auth(client));
    expect(res.status).toBe(200);
    expect(res.body.data.trackingNumber).toBeTruthy();
    expect(res.body.data.progress.isCompleted).toBe(true);
    expect(res.body.data.progress.timeline.every((s) => s.completed && s.date)).toBe(true);
  });

  test('commande annulée : frise réduite', async () => {
    await order.updateStatus('cancelled', { changedBy: client.id });
    const res = await request(app).get(`/api/orders/${order.orderId}/tracking`).set(auth(client));
    expect(res.body.data.progress).toMatchObject({ isCancelled: true, currentStep: 'cancelled' });
    expect(res.body.data.progress.timeline.map((s) => s.step)).toEqual(['pending', 'cancelled']);
  });
});

describe('Machine à états', () => {
  test('pending -> confirmed -> processing -> shipped -> delivered', async () => {
    await order.updateStatus('confirmed');
    expect(order.confirmedAt).toBeTruthy();
    await order.updateStatus('processing');
    expect(order.processingAt).toBeTruthy();
    await order.updateStatus('shipped');
    expect(order.shippedAt).toBeTruthy();
    expect(order.trackingNumber).toBeTruthy();
    await order.updateStatus('delivered');
    expect(order.deliveredAt).toBeTruthy();
    expect(order.isCompleted()).toBe(true);
  });

  test.each([
    [[], 'shipped'],
    [['confirmed'], 'shipped'],
    [['confirmed'], 'pending'],
    [['confirmed'], 'cancelled'],
    [['confirmed', 'processing'], 'cancelled']
  ])('refuse la transition après %j vers %s', async (steps, target) => {
    for (const status of steps) await order.updateStatus(status);
    await expect(order.updateStatus(target)).rejects.toThrow('Transition de statut invalide');
  });

  test('l\'ancien état « canceled » n\'existe plus', async () => {
    await expect(order.updateStatus('canceled')).rejects.toThrow('Transition de statut invalide');
  });
});

describe('Historique des états', () => {
  test('une ligne à la création, puis une par changement (pas pour une transition refusée)', async () => {
    await order.updateStatus('confirmed');
    await expect(order.updateStatus('shipped')).rejects.toThrow();
    await order.updateStatus('processing', { changedBy: admin.id });
    expect(await historyOf(order)).toEqual(['∅>pending', 'pending>confirmed', 'confirmed>processing']);
  });

  test('GET /api/admin/orders/:orderId renvoie l\'historique avec ses auteurs', async () => {
    await order.updateStatus('confirmed');
    await request(app)
      .put(`/api/admin/orders/${order.orderId}/status`)
      .set(auth(admin))
      .send({ newStatus: 'processing' })
      .expect(200);

    const res = await request(app).get(`/api/admin/orders/${order.orderId}`).set(auth(admin));
    expect(res.status).toBe(200);
    const history = res.body.data.statusHistory;
    expect(history.map((h) => h.toStatus)).toEqual(['pending', 'confirmed', 'processing']);
    expect(history[0].changedBy.email).toBe(client.email);
    expect(history[1].changedBy).toBeNull(); // système
    expect(history[2].changedBy).toMatchObject({ email: admin.email, role: 'admin' });
  });

  test('l\'historique d\'une commande n\'est pas accessible à un client', async () => {
    const res = await request(app).get(`/api/admin/orders/${order.orderId}`).set(auth(client));
    expect(res.status).toBe(403);
  });
});
