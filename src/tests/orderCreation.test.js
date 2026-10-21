/**
 * Tests d'intégration de la création de commande (cahier 02, §2.3 et §5 :
 * « tester la création de commande et la décrémentation du stock ») et des
 * frais de port (cahier 06, §3.2), sur la vraie application et la base de test.
 * Préparer la base une fois : npm run test:db
 */
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const app = require('../app');
const { Order, Cart, CartItem, User, Product, Category, sequelize } = require('../../models');
const { SHOP_POLICY, computeShippingCost } = require('../config/shopPolicy');

const PREFIX = 'jest-order-creation-';
const ADDRESS = { fullName: 'Test', address: '1 rue Test', city: 'Paris', postalCode: '75001' };
let client;
let category;
let tshirt; // 29,99 €
let book;   // 25,00 €

const auth = () => ({
  Authorization: `Bearer ${jwt.sign({ userId: client.id, email: client.email, role: 'client' }, process.env.JWT_SECRET, { expiresIn: '1h' })}`
});

const createProduct = (name, price, stock) => Product.create({
  id: randomUUID(), name: `${PREFIX}${name}`, description: 'Produit de test', price,
  stock, categoryId: category.id, images: [`https://example.com/${name}.jpg`], tags: [], isActive: true
});

// Panier rempli directement en base : POST /api/cart/items vérifie le stock en
// appelant l'API Catalogue en HTTP (catalogService), hors de la base de test.
async function addToCart(product, quantity) {
  const [cart] = await Cart.findOrCreate({ where: { userId: client.id }, defaults: { id: randomUUID(), userId: client.id } });
  await CartItem.create({ id: randomUUID(), cartId: cart.id, productId: product.id, quantity, price: product.price });
}

const placeOrder = () => request(app).post('/api/orders').set(auth()).send({ shippingAddress: ADDRESS });
const stockOf = async (product) => (await Product.findByPk(product.id)).stock;
const cartItemCount = async () => {
  const cart = await Cart.findOne({ where: { userId: client.id } });
  return cart ? CartItem.count({ where: { cartId: cart.id } }) : 0;
};

beforeAll(async () => {
  client = await User.create({
    id: randomUUID(), email: `${PREFIX}${Date.now()}@example.com`, password: 'hash-de-test', name: 'Test client', role: 'client'
  });
  category = await Category.create({ id: randomUUID(), name: `${PREFIX}cat-${Date.now()}` });
  tshirt = await createProduct('tshirt', 29.99, 10);
  book = await createProduct('livre', 25, 10);
});

afterEach(async () => {
  const cart = await Cart.findOne({ where: { userId: client.id } });
  if (cart) await CartItem.destroy({ where: { cartId: cart.id } });
});

afterAll(async () => {
  await Order.destroy({ where: { userId: client.id } });
  await Cart.destroy({ where: { userId: client.id } });
  await Product.destroy({ where: { id: [tshirt.id, book.id] } });
  await Category.destroy({ where: { id: category.id } });
  await User.destroy({ where: { id: client.id } });
  await sequelize.close();
});

describe('computeShippingCost', () => {
  test('4,90 € sous le seuil, gratuit à partir de 50 € (inclus)', () => {
    expect(SHOP_POLICY.shipping).toMatchObject({ fee: 4.9, freeThreshold: 50 });
    expect(computeShippingCost(49.99)).toBe(4.9);
    expect(computeShippingCost(50)).toBe(0);
    expect(computeShippingCost(120)).toBe(0);
    expect(computeShippingCost(0)).toBe(0);
  });
});

describe('GET /api/shop/policy', () => {
  test('renvoie la politique et son texte, sans authentification', async () => {
    const res = await request(app).get('/api/shop/policy');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      currency: 'EUR',
      shipping: { fee: 4.9, freeThreshold: 50 },
      returns: { days: 30, free: true }
    });
    expect(res.body.data.text).toContain('4,90 €');
    expect(res.body.data.text).toContain('50 €');
    expect(res.body.data.text).toContain('30 jours');
  });
});

describe('POST /api/orders', () => {
  test('sous 50 € : frais de port inclus dans le total, stock décrémenté, panier vidé, snapshot', async () => {
    const before = await stockOf(tshirt);
    await addToCart(tshirt, 1);

    const res = await placeOrder();

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ status: 'pending', shippingCost: 4.9, total: 34.89 });
    expect(await stockOf(tshirt)).toBe(before - 1);
    expect(await cartItemCount()).toBe(0);

    const order = await Order.findOne({ where: { orderId: res.body.data.orderId } });
    expect(parseFloat(order.shippingCost)).toBe(4.9);
    expect(parseFloat(order.totalAmount)).toBe(34.89);
    expect(order.items).toEqual([expect.objectContaining({
      productId: tshirt.id, name: tshirt.name, price: 29.99, quantity: 1, total: 29.99,
      image: 'https://example.com/tshirt.jpg', stockReserved: true
    })]);

    // Le détail renvoie les frais de port
    const detail = await request(app).get(`/api/orders/${order.orderId}`).set(auth());
    expect(detail.body.data).toMatchObject({ shippingCost: 4.9, totalAmount: 34.89 });
  });

  test('exactement 50 € : livraison gratuite', async () => {
    await addToCart(book, 2);
    const res = await placeOrder();
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ shippingCost: 0, total: 50 });
  });

  test('au-dessus de 50 € : livraison gratuite', async () => {
    await addToCart(tshirt, 1);
    await addToCart(book, 1);
    const res = await placeOrder();
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ shippingCost: 0, total: 54.99 });
  });

  test('409 si le stock ne suffit plus, sans toucher au stock ni au panier', async () => {
    await addToCart(book, 2);
    await book.update({ stock: 1 });

    const res = await placeOrder();

    expect(res.status).toBe(409);
    expect(res.body.conflicts).toEqual([
      expect.objectContaining({ productId: book.id, requested: 2, available: 1 })
    ]);
    expect(await stockOf(book)).toBe(1);
    expect(await cartItemCount()).toBe(1);
    await book.update({ stock: 10 });
  });

  test('400 si le panier est vide', async () => {
    const res = await placeOrder();
    expect(res.status).toBe(400);
  });
});
