/**
 * Regression tests: public sign-up must never create an admin account, and
 * must not write the password to the logs. The models are mocked, so these
 * tests need no database.
 */
const express = require('express');
const request = require('supertest');
const { inspect } = require('util');

jest.mock('../../models', () => ({
  User: { findOne: jest.fn(), create: jest.fn() },
  RefreshToken: { create: jest.fn() }
}));

const { User, RefreshToken } = require('../../models');
const authRoutes = require('../routes/auth');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

const PASSWORD = 'Password123';

beforeEach(() => {
  jest.clearAllMocks();
  User.findOne.mockResolvedValue(null);
  User.create.mockImplementation(async (data) => ({ ...data, createdAt: new Date() }));
  RefreshToken.create.mockResolvedValue({});
});

const register = (overrides = {}) => request(app)
  .post('/api/auth/register')
  .send({ name: 'Test User', email: 'test-role@example.com', password: PASSWORD, ...overrides });

describe('POST /api/auth/register', () => {
  test('ignores a role field: public sign-up always creates a client', async () => {
    const res = await register({ role: 'admin' });

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('client');
    expect(User.create).toHaveBeenCalledWith(expect.objectContaining({ role: 'client' }));
  });

  test('does not write the password to the logs', async () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const secret = 'SecretLog123';
      await register({ password: secret });
      // inspect: a logged object (e.g. req.body) must be checked with its content
      const logged = spy.mock.calls.map((args) => args.map((a) => inspect(a, { depth: 5 })).join(' ')).join('\n');
      expect(logged).not.toContain(secret);
    } finally {
      spy.mockRestore();
    }
  });
});
