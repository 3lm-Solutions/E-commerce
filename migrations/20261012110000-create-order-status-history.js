'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * Historique des états de commande (cahier 03, §3.1 : « historique d'état »).
 * Une ligne à la création de la commande (from_status = null) puis une ligne
 * par changement d'état. Les commandes existantes sont reconstituées à partir
 * de leurs colonnes de dates (auteur inconnu : changed_by = null).
 */

const STEPS = [
  ['confirmed', 'confirmed_at'],
  ['processing', 'processing_at'],
  ['shipped', 'shipped_at'],
  ['delivered', 'delivered_at'],
  ['cancelled', 'cancelled_at']
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('order_status_history', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false
      },
      order_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'orders', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      from_status: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      to_status: {
        type: Sequelize.STRING(20),
        allowNull: false
      },
      changed_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });
    await queryInterface.addIndex('order_status_history', ['order_id', 'created_at'], {
      name: 'idx_order_status_history_order'
    });

    // Reconstitution de l'historique des commandes existantes
    const orders = await queryInterface.sequelize.query(
      `SELECT id, user_id, status, created_at, ${STEPS.map(([, col]) => col).join(', ')} FROM orders`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    const rows = [];
    for (const order of orders) {
      rows.push({
        id: uuidv4(),
        order_id: order.id,
        from_status: null,
        to_status: 'pending',
        changed_by: order.user_id,
        created_at: order.created_at
      });

      const events = STEPS
        .filter(([, col]) => order[col])
        .map(([status, col]) => ({ status, at: new Date(order[col]) }))
        .sort((a, b) => a.at - b.at);

      let previous = 'pending';
      for (const event of events) {
        rows.push({
          id: uuidv4(),
          order_id: order.id,
          from_status: previous,
          to_status: event.status,
          changed_by: null,
          created_at: event.at
        });
        previous = event.status;
      }
    }

    if (rows.length) {
      await queryInterface.bulkInsert('order_status_history', rows);
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('order_status_history');
  }
};
