const { DataTypes } = require('sequelize');

/**
 * Historique des états d'une commande : une ligne à la création
 * (fromStatus = null), puis une ligne par appel à Order#updateStatus.
 * changedBy : utilisateur à l'origine du changement (client, admin),
 * null pour le système (webhook de paiement, reconstitution).
 */
module.exports = (sequelize) => {
  const OrderStatusHistory = sequelize.define('OrderStatusHistory', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4
    },
    orderId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    fromStatus: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    toStatus: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    changedBy: {
      type: DataTypes.UUID,
      allowNull: true
    }
  }, {
    tableName: 'order_status_history',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
  });

  OrderStatusHistory.associate = function(models) {
    OrderStatusHistory.belongsTo(models.Order, { foreignKey: 'orderId', as: 'order', onDelete: 'CASCADE' });
    OrderStatusHistory.belongsTo(models.User, { foreignKey: 'changedBy', as: 'author' });
  };

  return OrderStatusHistory;
};
