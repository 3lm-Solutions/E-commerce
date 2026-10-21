'use strict';

/**
 * Frais de port d'une commande (cahier 06 §3.2 : « livraison estimée »).
 * Calculés à la création de la commande d'après src/config/shopPolicy.js et
 * inclus dans total_amount. Les commandes existantes n'en avaient pas : 0.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('orders', 'shipping_cost', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Frais de port (TTC), inclus dans total_amount'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('orders', 'shipping_cost');
  }
};
