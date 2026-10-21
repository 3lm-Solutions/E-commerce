const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Cart = sequelize.define('Cart', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true, // Un utilisateur ne peut avoir qu'un seul panier
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    },
  }, {
    sequelize,
    modelName: 'Cart',
    tableName: 'carts',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  /**
   * Associations du modèle Cart
   */
  Cart.associate = function(models) {
    // Un panier appartient à un utilisateur
    Cart.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
      onDelete: 'CASCADE'
    });

    // Un panier a plusieurs articles (CartItem)
    Cart.hasMany(models.CartItem, {
      foreignKey: 'cartId',
      as: 'items',
      onDelete: 'CASCADE'
    });
  };

  /**
   * Méthode statique pour trouver le panier d'un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<Cart|null>} - Panier avec items ou null
   */
  Cart.findByUserId = async function(userId) {
    return await Cart.findOne({
      where: { userId: userId },
      include: [{
        model: sequelize.models.CartItem,
        as: 'items',
        order: [['created_at', 'ASC']]
      }]
    });
  };

  /**
   * Méthode d'instance pour vider le panier
   * @returns {Promise<void>}
   */
  Cart.prototype.clear = async function(options = {}) {
    // Supprimer tous les items du panier (options.transaction : création de commande)
    await sequelize.models.CartItem.destroy({
      where: { cartId: this.id },
      transaction: options.transaction
    });
    
    console.log(`🗑️ Panier ${this.id} vidé (clear() appelé)`);
  };

  return Cart;
};