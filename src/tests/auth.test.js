/**
 * Tests d'intégration des routes d'authentification (cahier 01, §2.1 et §5 :
 * « au moins les routes auth »), sur la vraie application Express et la base
 * de test. Préparer la base une fois : npm run test:db
 */
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../app');
const { User, RefreshToken, sequelize } = require('../../models');

const EMAIL_PREFIX = 'jest-auth-';
const PASSWORD = 'Password123';
let counter = 0;
const newEmail = () => `${EMAIL_PREFIX}${Date.now()}-${++counter}@example.com`;

async function register(overrides = {}) {
  const body = { name: 'Test Auth', email: newEmail(), password: PASSWORD, ...overrides };
  const res = await request(app).post('/api/auth/register').send(body);
  return { res, body };
}

async function cleanUp() {
  const users = await User.findAll({ where: { email: { [sequelize.Sequelize.Op.like]: `${EMAIL_PREFIX}%` } } });
  const ids = users.map((u) => u.id);
  if (ids.length) {
    await RefreshToken.destroy({ where: { userId: ids } });
    await User.destroy({ where: { id: ids } });
  }
}

beforeAll(cleanUp);
afterAll(async () => {
  await cleanUp();
  await sequelize.close();
});

describe('POST /api/auth/register', () => {
  test('crée un client et renvoie les deux tokens, sans le mot de passe', async () => {
    const { res, body } = await register();
    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({ email: body.email, name: 'Test Auth', role: 'client' });
    expect(res.body.data.user.password).toBeUndefined();
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.refreshToken).toEqual(expect.any(String));
  });

  test('stocke le mot de passe haché avec bcrypt (12 rounds minimum)', async () => {
    const { body } = await register();
    const user = await User.findOne({ where: { email: body.email } });
    expect(user.password).not.toBe(PASSWORD);
    expect(bcrypt.getRounds(user.password)).toBeGreaterThanOrEqual(12);
    expect(await bcrypt.compare(PASSWORD, user.password)).toBe(true);
  });

  test('409 si l\'email existe déjà (sans tenir compte de la casse)', async () => {
    const { body } = await register();
    const { res } = await register({ email: body.email.toUpperCase() });
    expect(res.status).toBe(409);
  });

  test.each([
    ['email invalide', { email: 'pas-un-email' }],
    ['mot de passe trop court', { password: 'Ab1' }],
    ['mot de passe sans majuscule ni chiffre', { password: 'motdepasse' }],
    ['nom manquant', { name: '' }]
  ])('400 : %s', async (_label, overrides) => {
    const { res } = await register(overrides);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/auth/login', () => {
  let email;
  beforeAll(async () => {
    ({ body: { email } } = await register());
  });

  test('200 avec les bons identifiants', async () => {
    const res = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(email);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.refreshToken).toEqual(expect.any(String));
  });

  test('401 avec un mauvais mot de passe', async () => {
    const res = await request(app).post('/api/auth/login').send({ email, password: 'Mauvais123' });
    expect(res.status).toBe(401);
  });

  test('401 avec un email inconnu (même message)', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: newEmail(), password: PASSWORD });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Identifiants invalides');
  });

  test('400 sans mot de passe', async () => {
    const res = await request(app).post('/api/auth/login').send({ email });
    expect(res.status).toBe(400);
  });

  test('403 pour un compte désactivé', async () => {
    const { body } = await register();
    await User.update({ isActive: false }, { where: { email: body.email } });
    const res = await request(app).post('/api/auth/login').send({ email: body.email, password: PASSWORD });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/auth/me', () => {
  test('renvoie le profil de l\'utilisateur connecté, sans mot de passe', async () => {
    const { res: registered, body } = await register();
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${registered.body.data.accessToken}`);
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).toContain(body.email);
    expect(JSON.stringify(res.body)).not.toContain('"password"');
  });

  test('401 sans token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('401 avec un token invalide', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer token.invalide.xyz');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/refresh', () => {
  test('renvoie une nouvelle paire de tokens, et l\'ancien refresh token ne sert qu\'une fois', async () => {
    const { res: registered } = await register();
    const oldRefresh = registered.body.data.refreshToken;

    const first = await request(app).post('/api/auth/refresh').send({ refreshToken: oldRefresh });
    expect(first.status).toBe(200);
    expect(first.body.data.accessToken).toEqual(expect.any(String));
    expect(first.body.data.refreshToken).not.toBe(oldRefresh);

    const reused = await request(app).post('/api/auth/refresh').send({ refreshToken: oldRefresh });
    expect(reused.status).toBe(401);

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${first.body.data.accessToken}`);
    expect(me.status).toBe(200);
  });

  test('401 avec un refresh token inconnu', async () => {
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: 'inconnu' });
    expect(res.status).toBe(401);
  });

  test('400 sans refresh token', async () => {
    const res = await request(app).post('/api/auth/refresh').send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/logout', () => {
  test('invalide le refresh token', async () => {
    const { res: registered } = await register();
    const { refreshToken } = registered.body.data;

    const res = await request(app).post('/api/auth/logout').send({ refreshToken });
    expect(res.status).toBe(200);

    const refresh = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(refresh.status).toBe(401);
  });

  test('400 sans refresh token', async () => {
    const res = await request(app).post('/api/auth/logout').send({});
    expect(res.status).toBe(400);
  });
});
