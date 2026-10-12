const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const { sequelize } = require('../../config/sequelize');
const Order = require('../../models/Order')(sequelize);
const User = require('../../models/User')(sequelize);

// Import routes and middleware
const orderRoutes = require('../routes/orders');
const { verifyToken } = require('../middleware/auth');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/orders', orderRoutes);

/**
 * Tests pour FonctionnalitéMoyenne#1782 - Annulation et suivi des commandes
 * Couvre cancelOrder et getOrderTracking
 */
describe('Order Cancellation and Tracking - FonctionnalitéMoyenne#1782', () => {
  let testUser;
  let testOrder;
  let authToken;

  beforeAll(async () => {
    // Ensure database is connected
    await sequelize.authenticate();
    
    // Create test user
    testUser = await User.create({
      id: 'test-user-id',
      email: 'test@example.com',
      password: 'hashedpassword',
      firstName: 'Test',
      lastName: 'User'
    });

    // Generate auth token
    authToken = jwt.sign(
      { id: testUser.id, email: testUser.email },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  beforeEach(async () => {
    // Create fresh test order before each test
    testOrder = await Order.create({
      id: 'test-order-id',
      orderId: 'ORD-TEST-12345',
      userId: testUser.id,
      items: [
        { productId: 'prod-1', quantity: 2, price: 29.99, name: 'Test Product' }
      ],
      totalAmount: 59.98,
      status: 'pending'
    });
  });

  afterEach(async () => {
    // Clean up test orders
    await Order.destroy({ where: { userId: testUser.id } });
  });

  afterAll(async () => {
    // Clean up test user
    await User.destroy({ where: { id: testUser.id } });
    await sequelize.close();
  });

  describe('PUT /api/orders/:orderId/cancel - Sous-tâche 1 & 2', () => {
    test('✅ Should successfully cancel pending order - cancelOrder method', async () => {
      const response = await request(app)
        .put(`/api/orders/${testOrder.orderId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reason: 'Changed my mind' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Commande annulée avec succès');
      expect(response.body.data).toMatchObject({
        orderId: testOrder.orderId,
        previousStatus: 'pending',
        currentStatus: 'cancelled',
        reason: 'Changed my mind'
      });
      expect(response.body.data.cancelledAt).toBeTruthy();

      // Verify database state
      const updatedOrder = await Order.findOne({ where: { orderId: testOrder.orderId } });
      expect(updatedOrder.status).toBe('cancelled');
      expect(updatedOrder.cancelledAt).toBeTruthy();
      expect(updatedOrder.notes).toContain('Raison d\'annulation: Changed my mind');
    });

    test('❌ Should reject cancellation of non-pending order', async () => {
      // First, update order to confirmed status
      await testOrder.updateStatus('confirmed');

      const response = await request(app)
        .put(`/api/orders/${testOrder.orderId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reason: 'Test reason' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Impossible d\'annuler une commande avec le statut "confirmed"');
      expect(response.body.data.currentStatus).toBe('confirmed');
      expect(response.body.data.cancelable).toBe(false);
    });

    test('❌ Should reject cancellation without authentication', async () => {
      const response = await request(app)
        .put(`/api/orders/${testOrder.orderId}/cancel`)
        .send({ reason: 'Test reason' });

      expect(response.status).toBe(401);
    });

    test('❌ Should reject cancellation of non-existent order', async () => {
      const response = await request(app)
        .put('/api/orders/NON-EXISTENT-ORDER/cancel')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reason: 'Test reason' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Commande non trouvée ou accès non autorisé');
    });

    test('✅ Should cancel without reason (optional field)', async () => {
      const response = await request(app)
        .put(`/api/orders/${testOrder.orderId}/cancel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.data.reason).toBeNull();
    });
  });

  describe('GET /api/orders/:orderId/tracking - Sous-tâche 3', () => {
    test('✅ Should return tracking info for pending order - getOrderTracking method', async () => {
      const response = await request(app)
        .get(`/api/orders/${testOrder.orderId}/tracking`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        orderId: testOrder.orderId,
        status: 'pending',
        confirmedAt: null,
        shippedAt: null,
        deliveredAt: null,
        cancelledAt: null
      });
      expect(response.body.data.createdAt).toBeTruthy();
      expect(response.body.data.progress).toMatchObject({
        isCompleted: false,
        isCancelled: false,
        currentStep: 'pending'
      });
    });

    test('✅ Should return tracking info for cancelled order', async () => {
      // Cancel the order first
      await testOrder.updateStatus('cancelled');

      const response = await request(app)
        .get(`/api/orders/${testOrder.orderId}/tracking`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        orderId: testOrder.orderId,
        status: 'cancelled',
        confirmedAt: null,
        shippedAt: null,
        deliveredAt: null
      });
      expect(response.body.data.cancelledAt).toBeTruthy();
      expect(response.body.data.progress).toMatchObject({
        isCompleted: true,
        isCancelled: true,
        currentStep: 'cancelled'
      });
    });

    test('✅ Should return complete timeline for delivered order', async () => {
      // Simulate full order lifecycle
      await testOrder.updateStatus('confirmed');
      await testOrder.updateStatus('shipped');
      await testOrder.updateStatus('delivered');

      const response = await request(app)
        .get(`/api/orders/${testOrder.orderId}/tracking`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('delivered');
      expect(response.body.data.confirmedAt).toBeTruthy();
      expect(response.body.data.shippedAt).toBeTruthy();
      expect(response.body.data.deliveredAt).toBeTruthy();
      expect(response.body.data.trackingNumber).toBeTruthy();
      expect(response.body.data.progress.isCompleted).toBe(true);
    });

    test('❌ Should reject tracking without authentication', async () => {
      const response = await request(app)
        .get(`/api/orders/${testOrder.orderId}/tracking`);

      expect(response.status).toBe(401);
    });

    test('❌ Should reject tracking for non-existent order', async () => {
      const response = await request(app)
        .get('/api/orders/NON-EXISTENT-ORDER/tracking')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Commande non trouvée ou accès non autorisé');
    });
  });

  describe('Order State Machine Validation', () => {
    test('✅ Should validate state transitions correctly', async () => {
      // Test valid transitions
      await testOrder.updateStatus('confirmed');
      expect(testOrder.status).toBe('confirmed');
      expect(testOrder.confirmedAt).toBeTruthy();

      await testOrder.updateStatus('shipped');
      expect(testOrder.status).toBe('shipped');
      expect(testOrder.shippedAt).toBeTruthy();
      expect(testOrder.trackingNumber).toBeTruthy();

      await testOrder.updateStatus('delivered');
      expect(testOrder.status).toBe('delivered');
      expect(testOrder.deliveredAt).toBeTruthy();
    });

    test('❌ Should reject invalid state transitions', async () => {
      // Try to go directly from pending to shipped
      await expect(testOrder.updateStatus('shipped')).rejects.toThrow(
        'Transition de statut invalide'
      );

      // Try to go from confirmed back to pending
      await testOrder.updateStatus('confirmed');
      await expect(testOrder.updateStatus('pending')).rejects.toThrow(
        'Transition de statut invalide'
      );
    });

    test('✅ Should allow cancellation only from pending', async () => {
      // Should work from pending
      expect(testOrder.isCancelable()).toBe(true);
      await testOrder.updateStatus('cancelled');
      expect(testOrder.status).toBe('cancelled');

      // Reset for next test
      testOrder.status = 'confirmed';
      expect(testOrder.isCancelable()).toBe(false);
    });

    test('✅ Should mark cancelled and delivered as completed', async () => {
      expect(testOrder.isCompleted()).toBe(false);

      await testOrder.updateStatus('cancelled');
      expect(testOrder.isCompleted()).toBe(true);

      // Test with delivered status
      const deliveredOrder = await Order.create({
        id: 'delivered-order-id',
        orderId: 'ORD-DELIVERED-123',
        userId: testUser.id,
        items: [{ productId: 'prod-1', quantity: 1, price: 10.00 }],
        totalAmount: 10.00,
        status: 'pending'
      });

      await deliveredOrder.updateStatus('confirmed');
      await deliveredOrder.updateStatus('shipped');
      await deliveredOrder.updateStatus('delivered');
      expect(deliveredOrder.isCompleted()).toBe(true);
    });
  });
});

console.log('🧪 Order Cancellation and Tracking Tests - FonctionnalitéMoyenne#1782');
console.log('📋 Tests cover all 3 sub-tasks:');
console.log('  ✅ Sous-tâche 1: PUT /orders/:id/cancel validation');
console.log('  ✅ Sous-tâche 2: cancelledAt field and cancelled status');
console.log('  ✅ Sous-tâche 3: GET /orders/:id/tracking endpoint');