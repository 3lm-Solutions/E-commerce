'use strict';

const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    // 1. Catégories : réutiliser celles du seeder catalogue (même nom) et
    // ne créer que celles qui manquent, pour éviter les doublons.
    const categoryNames = {
      electronics: 'Électronique',
      clothing: 'Vêtements',
      books: 'Livres & Média'
    };

    const existing = await queryInterface.sequelize.query(
      'SELECT id, name FROM categories WHERE name IN (:names)',
      { replacements: { names: Object.values(categoryNames) }, type: Sequelize.QueryTypes.SELECT }
    );
    const idByName = Object.fromEntries(existing.map((c) => [c.name, c.id]));

    const categoryIds = {};
    const missingCategories = [];
    for (const [key, name] of Object.entries(categoryNames)) {
      if (!idByName[name]) {
        idByName[name] = uuidv4();
        missingCategories.push({ id: idByName[name], name, created_at: now, updated_at: now });
      }
      categoryIds[key] = idByName[name];
    }

    if (missingCategories.length) {
      await queryInterface.bulkInsert('categories', missingCategories, {});
    }

    // 2. Insérer des utilisateurs
    const userIds = {
      client1: uuidv4(),
      client2: uuidv4(),
      admin1: uuidv4()
    };

    await queryInterface.bulkInsert('users', [
      {
        id: userIds.client1,
        email: 'client1@example.com',
        password: '$2b$12$hashedPassword123', // bcrypt hash fictif
        role: 'client',
        refresh_token: null,
        created_at: now,
        updated_at: now
      },
      {
        id: userIds.client2,
        email: 'client2@example.com',
        password: '$2b$12$hashedPassword456',
        role: 'client',
        refresh_token: null,
        created_at: now,
        updated_at: now
      },
      {
        id: userIds.admin1,
        email: 'admin@example.com',
        password: '$2b$12$hashedPasswordAdmin',
        role: 'admin',
        refresh_token: null,
        created_at: now,
        updated_at: now
      }
    ], {});

    // 3. Insérer des produits
    const productIds = {
      laptop: uuidv4(),
      phone: uuidv4(),
      tshirt: uuidv4(),
      jeans: uuidv4(),
      book1: uuidv4(),
      book2: uuidv4()
    };

    await queryInterface.bulkInsert('products', [
      {
        id: productIds.laptop,
        name: 'MacBook Pro 14"',
        description: 'Ordinateur portable haute performance avec puce M2',
        price: 2499.00,
        stock: 10,
        category_id: categoryIds.electronics,
        images: ['https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800', 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800'],
        tags: ['laptop', 'apple', 'performance'],
        rating_avg: 4.5,
        rating_count: 12,
        is_active: true,
        created_at: now,
        updated_at: now
      },
      {
        id: productIds.phone,
        name: 'iPhone 15 Pro',
        description: 'Dernier iPhone avec caméra professionnelle',
        price: 1229.00,
        stock: 25,
        category_id: categoryIds.electronics,
        images: ['https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800'],
        tags: ['smartphone', 'apple', 'camera'],
        rating_avg: 4.8,
        rating_count: 34,
        is_active: true,
        created_at: now,
        updated_at: now
      },
      {
        id: productIds.tshirt,
        name: 'T-shirt Premium Coton',
        description: 'T-shirt 100% coton biologique',
        price: 29.99,
        stock: 100,
        category_id: categoryIds.clothing,
        images: ['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800', 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800'],
        tags: ['tshirt', 'coton', 'bio'],
        rating_avg: 4.2,
        rating_count: 8,
        is_active: true,
        created_at: now,
        updated_at: now
      },
      {
        id: productIds.jeans,
        name: 'Jean Slim Fit',
        description: 'Jean denim stretch confortable',
        price: 79.99,
        stock: 50,
        category_id: categoryIds.clothing,
        images: ['https://images.unsplash.com/photo-1604176354204-9268737828e4?w=800'],
        tags: ['jeans', 'denim', 'confort'],
        rating_avg: 4.0,
        rating_count: 15,
        is_active: true,
        created_at: now,
        updated_at: now
      },
      {
        id: productIds.book1,
        name: 'JavaScript: The Good Parts',
        description: 'Guide essentiel pour maîtriser JavaScript',
        price: 39.99,
        stock: 30,
        category_id: categoryIds.books,
        images: ['https://images.unsplash.com/photo-1589998059171-988d887df646?w=800'],
        tags: ['javascript', 'programming', 'web'],
        rating_avg: 4.7,
        rating_count: 45,
        is_active: true,
        created_at: now,
        updated_at: now
      },
      {
        id: productIds.book2,
        name: 'Node.js Design Patterns',
        description: 'Architectures et patterns avancés pour Node.js',
        price: 49.99,
        stock: 20,
        category_id: categoryIds.books,
        images: ['https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800'],
        tags: ['nodejs', 'backend', 'patterns'],
        rating_avg: 4.6,
        rating_count: 23,
        is_active: true,
        created_at: now,
        updated_at: now
      }
    ], {});

    // 4. Insérer des avis
    await queryInterface.bulkInsert('reviews', [
      {
        id: uuidv4(),
        product_id: productIds.laptop,
        user_id: userIds.client1,
        rating: 5,
        comment: 'Excellent produit, très rapide et bien fini.',
        created_at: now
      },
      {
        id: uuidv4(),
        product_id: productIds.phone,
        user_id: userIds.client2,
        rating: 4,
        comment: 'Bon smartphone, caméra impressionnante.',
        created_at: now
      },
      {
        id: uuidv4(),
        product_id: productIds.book1,
        user_id: userIds.client1,
        rating: 5,
        comment: 'Indispensable pour tout développeur JavaScript.',
        created_at: now
      }
    ], {});

    // 5. Insérer des paniers
    const cartIds = {
      cart1: uuidv4(),
      cart2: uuidv4()
    };

    await queryInterface.bulkInsert('carts', [
      {
        id: cartIds.cart1,
        user_id: userIds.client1,
        created_at: now,
        updated_at: now
      },
      {
        id: cartIds.cart2,
        user_id: userIds.client2,
        created_at: now,
        updated_at: now
      }
    ], {});

    // 6. Insérer des éléments de panier
    await queryInterface.bulkInsert('cart_items', [
      {
        id: uuidv4(),
        cart_id: cartIds.cart1,
        product_id: productIds.laptop,
        quantity: 1,
        price: 2499.00,
        created_at: now,
        updated_at: now
      },
      {
        id: uuidv4(),
        cart_id: cartIds.cart1,
        product_id: productIds.tshirt,
        quantity: 2,
        price: 29.99,
        created_at: now,
        updated_at: now
      },
      {
        id: uuidv4(),
        cart_id: cartIds.cart2,
        product_id: productIds.phone,
        quantity: 1,
        price: 1229.00,
        created_at: now,
        updated_at: now
      }
    ], {});

    // 7. Insérer des commandes
    await queryInterface.bulkInsert('orders', [
      {
        id: uuidv4(),
        order_id: 'ORD-DEMO-0001', // Obligatoire depuis update-orders-table-state-machine
        user_id: userIds.client2,
        items: JSON.stringify([
          {
            product_id: productIds.book1,
            name: 'JavaScript: The Good Parts',
            price: 39.99,
            quantity: 1
          },
          {
            product_id: productIds.book2,
            name: 'Node.js Design Patterns',
            price: 49.99,
            quantity: 1
          }
        ]),
        total_amount: 89.98,
        status: 'delivered',
        shipping_address: JSON.stringify({
          street: '123 Rue de la Paix',
          city: 'Paris',
          postal_code: '75001',
          country: 'France'
        }),
        stripe_payment_intent_id: 'pi_test_123456789',
        created_at: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 jours avant
        updated_at: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)  // 5 jours avant
      }
    ], {});

    // 8. Insérer des événements utilisateur
    await queryInterface.bulkInsert('user_events', [
      {
        id: uuidv4(),
        user_id: userIds.client1,
        event_type: 'view',
        product_id: productIds.laptop,
        created_at: new Date(now.getTime() - 1 * 60 * 60 * 1000) // 1h avant
      },
      {
        id: uuidv4(),
        user_id: userIds.client1,
        event_type: 'view',
        product_id: productIds.phone,
        created_at: new Date(now.getTime() - 30 * 60 * 1000) // 30min avant
      },
      {
        id: uuidv4(),
        user_id: userIds.client2,
        event_type: 'purchase',
        product_id: productIds.book1,
        created_at: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) // 7 jours avant
      }
    ], {});
  },

  async down(queryInterface, Sequelize) {
    // Supprimer les données dans l'ordre inverse
    await queryInterface.bulkDelete('user_events', null, {});
    await queryInterface.bulkDelete('orders', null, {});
    await queryInterface.bulkDelete('cart_items', null, {});
    await queryInterface.bulkDelete('carts', null, {});
    await queryInterface.bulkDelete('reviews', null, {});
    await queryInterface.bulkDelete('products', null, {});
    await queryInterface.bulkDelete('users', null, {});
    await queryInterface.bulkDelete('categories', null, {});
  }
};
