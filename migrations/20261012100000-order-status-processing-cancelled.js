'use strict';

/**
 * Machine à états du cahier 02 (§3) :
 * pending -> confirmed -> processing -> shipped -> delivered, et cancelled
 * (uniquement depuis pending).
 * - ajoute l'état `processing` (après `confirmed`) et la colonne `processing_at` ;
 * - renomme l'état `canceled` en `cancelled`, et `canceled_at` en `cancelled_at`.
 *
 * Pas de transaction : PostgreSQL n'autorise pas l'usage d'une valeur d'enum
 * ajoutée dans la même transaction.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const q = (sql) => queryInterface.sequelize.query(sql);

    await q("ALTER TYPE enum_orders_status RENAME VALUE 'canceled' TO 'cancelled'");
    await q("ALTER TYPE enum_orders_status ADD VALUE IF NOT EXISTS 'processing' AFTER 'confirmed'");

    await queryInterface.renameColumn('orders', 'canceled_at', 'cancelled_at');
    await q('ALTER INDEX IF EXISTS idx_orders_canceled_at RENAME TO idx_orders_cancelled_at');

    await queryInterface.addColumn('orders', 'processing_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Date de passage en préparation'
    });
  },

  async down(queryInterface) {
    const q = (sql) => queryInterface.sequelize.query(sql);

    await queryInterface.removeColumn('orders', 'processing_at');
    await q('ALTER INDEX IF EXISTS idx_orders_cancelled_at RENAME TO idx_orders_canceled_at');
    await queryInterface.renameColumn('orders', 'cancelled_at', 'canceled_at');

    // Une valeur d'enum ne peut pas être supprimée : on recrée le type.
    // Les commandes en préparation redeviennent « confirmed ».
    await q('ALTER TABLE orders ALTER COLUMN status DROP DEFAULT');
    await q('ALTER TABLE orders ALTER COLUMN status TYPE text USING status::text');
    await q("UPDATE orders SET status = 'confirmed' WHERE status = 'processing'");
    await q("UPDATE orders SET status = 'canceled' WHERE status = 'cancelled'");
    await q('DROP TYPE enum_orders_status');
    await q("CREATE TYPE enum_orders_status AS ENUM ('pending', 'confirmed', 'shipped', 'delivered', 'canceled')");
    await q('ALTER TABLE orders ALTER COLUMN status TYPE enum_orders_status USING status::enum_orders_status');
    await q("ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'pending'");
  }
};
