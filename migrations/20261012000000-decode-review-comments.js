'use strict';

/**
 * Le validateur des avis appliquait `.escape()` sur `comment` : les
 * commentaires étaient stockés encodés (`C&#x27;est`) et React les affichait
 * tels quels. Le validateur est corrigé ; cette migration décode les
 * commentaires déjà enregistrés.
 */

const ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#x27;': "'",
  '&#39;': "'",
  '&#x2F;': '/',
  '&#x5C;': '\\',
  '&#96;': '`'
};

function decode(text) {
  return text.replace(/&(amp|lt|gt|quot|#x27|#39|#x2F|#x5C|#96);/g, (entity) => ENTITIES[entity]);
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const [rows] = await queryInterface.sequelize.query(
      "SELECT id, comment FROM reviews WHERE comment LIKE '%&%;%'"
    );

    for (const row of rows) {
      const decoded = decode(row.comment);
      if (decoded !== row.comment) {
        await queryInterface.sequelize.query(
          'UPDATE reviews SET comment = :comment WHERE id = :id',
          { replacements: { comment: decoded, id: row.id } }
        );
      }
    }
  },

  async down() {
    // Rien à faire : on ne ré-encode pas les commentaires.
  }
};
