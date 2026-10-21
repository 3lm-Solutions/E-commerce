'use strict';

/**
 * Le modèle Category déclare `name` unique (unique_category_name), mais la
 * migration de création n'avait pas ajouté la contrainte en base : les deux
 * seeders créaient des catégories en double. Fusionner les doublons avant
 * de lancer cette migration sur une base existante.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.addConstraint('categories', {
      fields: ['name'],
      type: 'unique',
      name: 'unique_category_name'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('categories', 'unique_category_name');
  }
};
