'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('reviews', {
      id: {
        type: Sequelize.TEXT,
        primaryKey: true,
        allowNull: false
      },
      user_id: {
        type: Sequelize.TEXT,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      product_id: {
        type: Sequelize.TEXT,
        allowNull: false,
        references: {
          model: 'products',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      rating: {
        type: Sequelize.INTEGER,
        allowNull: false,
        validate: {
          min: 1,
          max: 5
        }
      },
      comment: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // La table peut déjà exister (créée par create-complete-ecommerce-schema avec
    // ses index user_id/product_id) : on n'ajoute que les index manquants.
    const existingIndexes = (await queryInterface.showIndex('reviews')).map((index) => index.name);

    // Ajouter les index
    for (const field of ['user_id', 'product_id', 'rating', 'created_at']) {
      if (!existingIndexes.includes(`reviews_${field}`)) {
        await queryInterface.addIndex('reviews', [field]);
      }
    }

    // Index unique pour empêcher qu'un utilisateur laisse plusieurs avis sur le même produit
    if (!existingIndexes.includes('unique_user_product_review')) {
      await queryInterface.addConstraint('reviews', {
        fields: ['user_id', 'product_id'],
        type: 'unique',
        name: 'unique_user_product_review'
      });
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('reviews');
  }
};