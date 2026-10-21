const { DataTypes } = require('sequelize');

/**
 * Modèle Order avec machine à états
 * FonctionnalitéHaute#1777
 * 
 * Machine à états des commandes avec transitions validées :
 * pending -> confirmed -> processing -> shipped -> delivered,
 * et cancelled uniquement depuis pending (cahier 02, §3).
 * Aucune transition en arrière n'est autorisée
 */

module.exports = (sequelize) => {
  // Définition des statuts valides et leurs transitions
  const ORDER_STATUS = {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    PROCESSING: 'processing',
    SHIPPED: 'shipped',
    DELIVERED: 'delivered',
    CANCELLED: 'cancelled' // FonctionnalitéMoyenne#1782
  };

  // Mapping des transitions valides
  const VALID_TRANSITIONS = {
    [ORDER_STATUS.PENDING]: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED], // FonctionnalitéMoyenne#1782: pending peut être annulé
    [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.PROCESSING],
    [ORDER_STATUS.PROCESSING]: [ORDER_STATUS.SHIPPED],
    [ORDER_STATUS.SHIPPED]: [ORDER_STATUS.DELIVERED],
    [ORDER_STATUS.DELIVERED]: [], // État final, aucune transition
    [ORDER_STATUS.CANCELLED]: [] // État final, aucune transition (FonctionnalitéMoyenne#1782)
  };

  const Order = sequelize.define('Order', {
    id: {
      type: DataTypes.TEXT, // Cohérent avec autres modèles du projet
      primaryKey: true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4
    },
    orderId: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: true,
      comment: 'Identifiant unique de commande (peut être différent de l\'ID primaire)'
    },
    userId: {
      type: DataTypes.TEXT, // Type TEXT pour correspondre au modèle User
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    },
    items: {
      type: DataTypes.JSONB, // Stockage JSON des items du panier
      allowNull: false,
      defaultValue: [],
      comment: 'Copie des items du panier au moment de la commande'
    },
    totalAmount: {
      type: DataTypes.DECIMAL(10, 2), // Précision monétaire
      allowNull: false,
      validate: {
        min: 0,
        isDecimal: true
      },
      comment: 'Montant total de la commande (articles + frais de port)'
    },
    shippingCost: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      },
      comment: 'Frais de port (TTC), inclus dans totalAmount'
    },
    status: {
      type: DataTypes.ENUM(...Object.values(ORDER_STATUS)),
      allowNull: false,
      defaultValue: ORDER_STATUS.PENDING,
      validate: {
        isIn: {
          args: [Object.values(ORDER_STATUS)],
          msg: 'Statut de commande invalide'
        }
      }
    },
    // Champs additionnels utiles
    shippingAddress: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Adresse de livraison'
    },
    billingAddress: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Adresse de facturation'
    },
    paymentMethod: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Méthode de paiement utilisée'
    },
    trackingNumber: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Numéro de suivi (disponible après expédition)'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notes internes sur la commande'
    },
    // Champs de dates de suivi (FonctionnalitéMoyenne#1782)
    cancelledAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Date d\'annulation de la commande'
    },
    confirmedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Date de confirmation de la commande'
    },
    processingAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Date de passage en préparation'
    },
    shippedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Date d\'expédition de la commande'
    },
    deliveredAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Date de livraison de la commande'
    }
  }, {
    sequelize,
    modelName: 'Order',
    tableName: 'orders',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['order_id'],
        unique: true
      },
      {
        fields: ['user_id']
      },
      {
        fields: ['status']
      },
      {
        fields: ['created_at']
      }
    ],
    hooks: {
      // Hook pour générer automatiquement orderId si non fourni
      beforeCreate: (order) => {
        if (!order.orderId) {
          const timestamp = Date.now().toString(36).toUpperCase();
          const random = Math.random().toString(36).substring(2, 8).toUpperCase();
          order.orderId = `ORD-${timestamp}-${random}`;
        }
      },

      // Première ligne de l'historique des états (dans la transaction de création)
      afterCreate: async (order, options) => {
        await sequelize.models.OrderStatusHistory.create({
          orderId: order.id,
          fromStatus: null,
          toStatus: order.status,
          changedBy: order.userId
        }, { transaction: options.transaction });
      },
      
      // Hook pour valider les transitions de statut
      beforeUpdate: (order) => {
        if (order.changed('status')) {
          const currentStatus = order._previousDataValues.status;
          const newStatus = order.status;
          
          console.log(`🔄 Tentative de transition: ${currentStatus} -> ${newStatus}`);
          
          if (!Order.isValidTransition(currentStatus, newStatus)) {
            throw new Error(
              `Transition de statut invalide: impossible de passer de "${currentStatus}" à "${newStatus}". ` +
              `Transitions autorisées depuis "${currentStatus}": [${VALID_TRANSITIONS[currentStatus].join(', ')}]`
            );
          }
          
          console.log(`✅ Transition autorisée: ${currentStatus} -> ${newStatus}`);
        }
      }
    }
  });

  /**
   * Méthode statique pour vérifier si une transition est valide
   * @param {string} currentStatus - Statut actuel
   * @param {string} newStatus - Nouveau statut souhaité
   * @returns {boolean} - True si la transition est autorisée
   */
  Order.isValidTransition = function(currentStatus, newStatus) {
    // Si le statut ne change pas, c'est toujours valide
    if (currentStatus === newStatus) {
      return true;
    }
    
    // Vérifier si la transition est dans les transitions autorisées
    const allowedTransitions = VALID_TRANSITIONS[currentStatus] || [];
    return allowedTransitions.includes(newStatus);
  };

  /**
   * Méthode d'instance pour mettre à jour le statut avec validation
   * @param {string} newStatus - Nouveau statut
   * @param {Object} [options]
   * @param {string|null} [options.changedBy] - Auteur du changement (null : système)
   * @returns {Promise<Order>} - Instance mise à jour
   */
  Order.prototype.updateStatus = async function(newStatus, { changedBy = null } = {}) {
    const currentStatus = this.status;
    // Ligne d'historique écrite dans la même transaction que le changement d'état
    const recordHistory = (transaction) => sequelize.models.OrderStatusHistory.create({
      orderId: this.id,
      fromStatus: currentStatus,
      toStatus: newStatus,
      changedBy
    }, { transaction });
    
    console.log(`📦 Commande ${this.orderId}: Tentative de changement de statut ${currentStatus} -> ${newStatus}`);
    
    // Validation de la transition
    if (!Order.isValidTransition(currentStatus, newStatus)) {
      const allowedTransitions = VALID_TRANSITIONS[currentStatus] || [];
      const errorMessage = `Transition de statut invalide pour la commande ${this.orderId}: ` +
        `impossible de passer de "${currentStatus}" à "${newStatus}". ` +
        `Transitions autorisées: [${allowedTransitions.join(', ')}]`;
      
      console.log(`❌ ${errorMessage}`);
      throw new Error(errorMessage);
    }
    
    // Mise à jour du statut
    this.status = newStatus;
    
    // Ajout de données spécifiques selon le statut
    switch (newStatus) {
      case ORDER_STATUS.CONFIRMED:
        // Marquer la date de confirmation (FonctionnalitéMoyenne#1782)
        this.confirmedAt = new Date();
        break;

      case ORDER_STATUS.PROCESSING:
        this.processingAt = new Date();
        break;

      case ORDER_STATUS.SHIPPED:
        // Générer un numéro de suivi si pas déjà défini
        if (!this.trackingNumber) {
          this.trackingNumber = `TRK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        }
        // Marquer la date d'expédition (FonctionnalitéMoyenne#1782)
        this.shippedAt = new Date();
        break;
        
      case ORDER_STATUS.DELIVERED:
        // Marquer la date de livraison dans les notes
        const deliveryNote = `Livré le ${new Date().toLocaleDateString('fr-FR')}`;
        this.notes = this.notes ? `${this.notes}\n${deliveryNote}` : deliveryNote;
        // Marquer la date de livraison (FonctionnalitéMoyenne#1782)
        this.deliveredAt = new Date();
        break;
        
      case ORDER_STATUS.CANCELLED:
        // Marquer la date d'annulation (FonctionnalitéMoyenne#1782)
        this.cancelledAt = new Date();
        const cancelNote = `Commande annulée le ${new Date().toLocaleDateString('fr-FR')}`;
        this.notes = this.notes ? `${this.notes}\n${cancelNote}` : cancelNote;
        break;
    }
    
    if (newStatus === ORDER_STATUS.CANCELLED) {
      // Annulation (client ou admin) : remise en stock dans la même transaction.
      // La ligne de la commande est verrouillée et relue pour qu'une double
      // annulation simultanée ne remette pas le stock deux fois.
      try {
        await sequelize.transaction(async (t) => {
          const fresh = await Order.findByPk(this.id, { lock: t.LOCK.UPDATE, transaction: t });
          if (!fresh || fresh.status !== currentStatus) {
            throw new Error(`La commande ${this.orderId} a déjà changé de statut (${fresh ? fresh.status : 'introuvable'}).`);
          }
          await this.save({ transaction: t });
          await recordHistory(t);

          // Seuls les articles dont le stock a été décrémenté (commandes créées
          // après l'ajout du contrôle de stock) sont remis en stock.
          for (const item of this.items || []) {
            if (item.stockReserved && item.productId && item.quantity > 0) {
              await sequelize.models.Product.increment('stock', {
                by: item.quantity,
                where: { id: item.productId },
                transaction: t
              });
            }
          }
        });
      } catch (error) {
        // Rien n'a été enregistré : on remet l'instance dans son état d'origine
        this.status = currentStatus;
        this.cancelledAt = null;
        throw error;
      }
    } else {
      // Sauvegarder les changements et l'historique ensemble
      await sequelize.transaction(async (t) => {
        await this.save({ transaction: t });
        await recordHistory(t);
      });
    }
    
    console.log(`✅ Commande ${this.orderId}: Statut mis à jour vers "${newStatus}"`);
    
    return this;
  };

  /**
   * Méthode pour obtenir les transitions possibles depuis le statut actuel
   * @returns {string[]} - Liste des statuts possibles
   */
  Order.prototype.getAvailableTransitions = function() {
    return VALID_TRANSITIONS[this.status] || [];
  };

  /**
   * Méthode pour vérifier si la commande peut être modifiée
   * @returns {boolean} - True si la commande peut encore être modifiée
   */
  Order.prototype.isModifiable = function() {
    return this.status === ORDER_STATUS.PENDING;
  };

  /**
   * Méthode pour vérifier si la commande peut être annulée (FonctionnalitéMoyenne#1782)
   * @returns {boolean} - True si la commande peut être annulée
   */
  Order.prototype.isCancelable = function() {
    return this.status === ORDER_STATUS.PENDING;
  };

  /**
   * Méthode pour vérifier si la commande est terminée
   * @returns {boolean} - True si la commande est livrée ou annulée
   */
  Order.prototype.isCompleted = function() {
    return this.status === ORDER_STATUS.DELIVERED || this.status === ORDER_STATUS.CANCELLED;
  };

  /**
   * Méthode pour calculer le montant total : items + frais de port
   * @returns {number} - Montant total calculé
   */
  Order.prototype.calculateTotal = function() {
    const shippingCost = parseFloat(this.shippingCost) || 0;
    if (!this.items || !Array.isArray(this.items)) {
      return shippingCost;
    }

    return this.items.reduce((total, item) => {
      const itemPrice = parseFloat(item.price) || 0;
      const itemQuantity = parseInt(item.quantity) || 0;
      return total + (itemPrice * itemQuantity);
    }, shippingCost);
  };

  /**
   * Méthode pour synchroniser le totalAmount avec les items
   */
  Order.prototype.syncTotalAmount = function() {
    this.totalAmount = this.calculateTotal();
  };

  // Définition des associations
  Order.associate = function(models) {
    // Une commande appartient à un utilisateur
    Order.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
      onDelete: 'CASCADE'
    });

    // Historique des changements d'état
    Order.hasMany(models.OrderStatusHistory, {
      foreignKey: 'orderId',
      as: 'statusHistory'
    });

    // Note: Les items sont stockés en JSONB pour préserver l'état
    // au moment de la commande, mais on pourrait aussi avoir une
    // relation OrderItem si nécessaire pour des analyses plus poussées
  };

  // Exposer les constantes pour utilisation externe
  Order.STATUS = ORDER_STATUS;
  Order.VALID_TRANSITIONS = VALID_TRANSITIONS;

  return Order;
};