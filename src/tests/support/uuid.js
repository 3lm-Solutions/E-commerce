/**
 * uuid 14 est publié en ESM uniquement : Node le charge avec require(), mais
 * pas le système de modules de Jest. Le code n'utilise que v4, fourni ici par
 * crypto.randomUUID() (voir "moduleNameMapper" dans package.json).
 */
const { randomUUID } = require('crypto');

module.exports = { v4: () => randomUUID() };
