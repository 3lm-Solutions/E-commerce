/**
 * Recrée la base de test (DB_NAME_TEST, par défaut ecommerce_test) et lance
 * toutes les migrations. Utilisée par les tests d'intégration (routes auth,
 * commandes). Usage : npm run test:db
 */
const { execSync } = require('child_process');

const env = { ...process.env, NODE_ENV: 'test' };
const run = (command, { ignoreError = false } = {}) => {
  try {
    execSync(`npx sequelize-cli ${command}`, { env, stdio: 'inherit' });
  } catch (error) {
    if (!ignoreError) throw error;
  }
};

run('db:drop', { ignoreError: true }); // la base peut ne pas exister
run('db:create');
run('db:migrate');
console.log('Base de test prête.');
