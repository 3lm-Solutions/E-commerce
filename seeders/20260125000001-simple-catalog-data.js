'use strict';

const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    // === CRÉATION DES CATÉGORIES ===
    const categoryIds = {
      electronique: uuidv4(),
      vetements: uuidv4(),
      maisonJardin: uuidv4(),
      sportsLoisirs: uuidv4(),
      livresMedia: uuidv4()
    };

    await queryInterface.bulkInsert('categories', [
      {
        id: categoryIds.electronique,
        name: 'Électronique',
        description: 'Smartphones, ordinateurs, tablettes et accessoires électroniques',
        created_at: now,
        updated_at: now
      },
      {
        id: categoryIds.vetements,
        name: 'Vêtements',
        description: 'Mode masculine et féminine, chaussures et accessoires',
        created_at: now,
        updated_at: now
      },
      {
        id: categoryIds.maisonJardin,
        name: 'Maison & Jardin',
        description: 'Décoration, meubles, outils de jardinage et électroménager',
        created_at: now,
        updated_at: now
      },
      {
        id: categoryIds.sportsLoisirs,
        name: 'Sports & Loisirs',
        description: 'Équipements sportifs, jeux et articles de loisirs',
        created_at: now,
        updated_at: now
      },
      {
        id: categoryIds.livresMedia,
        name: 'Livres & Média',
        description: 'Livres, films, musique et produits culturels',
        created_at: now,
        updated_at: now
      }
    ]);

    // === CRÉATION DES PRODUITS ===
    await queryInterface.bulkInsert('products', [
      // ÉLECTRONIQUE
      {
        id: uuidv4(),
        name: 'iPhone 15 Pro Max',
        description: 'Le dernier iPhone avec processeur A17 Pro, écran Super Retina XDR de 6.7 pouces et caméra triple 48MP.',
        price: 1479.00,
        category_id: categoryIds.electronique,
        stock: 25,
        images: ['https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=800', 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800'],
        tags: ['smartphone', 'apple', 'premium', '5G', 'camera'],
        is_active: true,
        rating_avg: 4.8,
        rating_count: 127,
        created_at: now,
        updated_at: now
      },
      {
        id: uuidv4(),
        name: 'MacBook Pro 16"',
        description: 'Ordinateur portable professionnel avec puce M3 Pro, 18GB de RAM et SSD 512GB.',
        price: 2999.00,
        category_id: categoryIds.electronique,
        stock: 12,
        images: ['https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=800'],
        tags: ['laptop', 'apple', 'professional', 'M3'],
        is_active: true,
        rating_avg: 4.9,
        rating_count: 89,
        created_at: now,
        updated_at: now
      },
      {
        id: uuidv4(),
        name: 'Samsung Galaxy S24 Ultra',
        description: 'Smartphone Android premium avec S Pen intégré, écran Dynamic AMOLED 6.8" et caméra 200MP.',
        price: 1469.00,
        category_id: categoryIds.electronique,
        stock: 18,
        images: ['https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=800'],
        tags: ['smartphone', 'samsung', 'android', 'S-Pen'],
        is_active: true,
        rating_avg: 4.7,
        rating_count: 203,
        created_at: now,
        updated_at: now
      },
      
      // VÊTEMENTS
      {
        id: uuidv4(),
        name: 'Jean Slim Fit Premium',
        description: 'Jean en denim italien de haute qualité, coupe slim moderne.',
        price: 89.99,
        category_id: categoryIds.vetements,
        stock: 50,
        images: ['https://images.unsplash.com/photo-1542272604-787c3835535d?w=800'],
        tags: ['jean', 'denim', 'slim', 'casual'],
        is_active: true,
        rating_avg: 4.4,
        rating_count: 156,
        created_at: now,
        updated_at: now
      },
      {
        id: uuidv4(),
        name: 'Sneakers Running Pro',
        description: 'Chaussures de course haute performance avec amorti responsive.',
        price: 129.99,
        category_id: categoryIds.vetements,
        stock: 35,
        images: ['https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800'],
        tags: ['sneakers', 'running', 'sport', 'comfortable'],
        is_active: true,
        rating_avg: 4.6,
        rating_count: 284,
        created_at: now,
        updated_at: now
      },

      // MAISON & JARDIN
      {
        id: uuidv4(),
        name: 'Canapé 3 Places Scandinave',
        description: 'Canapé design scandinave en tissu gris clair, structure en bois de hêtre.',
        price: 599.99,
        category_id: categoryIds.maisonJardin,
        stock: 8,
        images: ['https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800'],
        tags: ['canapé', 'scandinave', 'salon', 'design'],
        is_active: true,
        rating_avg: 4.5,
        rating_count: 67,
        created_at: now,
        updated_at: now
      },

      // SPORTS & LOISIRS
      {
        id: uuidv4(),
        name: 'Vélo Électrique Urban',
        description: 'Vélo électrique urbain avec batterie 500Wh, autonomie 80km.',
        price: 1599.99,
        category_id: categoryIds.sportsLoisirs,
        stock: 6,
        images: ['https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=800'],
        tags: ['vélo', 'électrique', 'urbain', 'batterie'],
        is_active: true,
        rating_avg: 4.7,
        rating_count: 45,
        created_at: now,
        updated_at: now
      },

      // LIVRES & MÉDIA
      {
        id: uuidv4(),
        name: 'Clean Code (Livre)',
        description: 'Guide essentiel pour écrire du code propre et maintenable.',
        price: 45.99,
        category_id: categoryIds.livresMedia,
        stock: 30,
        images: ['https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800'],
        tags: ['livre', 'programmation', 'développement', 'clean-code'],
        is_active: true,
        rating_avg: 4.9,
        rating_count: 312,
        created_at: now,
        updated_at: now
      },

      // PRODUIT EN RUPTURE DE STOCK
      {
        id: uuidv4(),
        name: 'Console Gaming Next-Gen',
        description: 'Console de jeu dernière génération avec SSD ultra-rapide.',
        price: 499.99,
        category_id: categoryIds.electronique,
        stock: 0, // RUPTURE DE STOCK
        images: ['https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=800'],
        tags: ['console', 'gaming', 'next-gen', 'SSD'],
        is_active: true,
        rating_avg: 4.9,
        rating_count: 189,
        created_at: now,
        updated_at: now
      },

      // PRODUIT INACTIF
      {
        id: uuidv4(),
        name: 'Produit Test Inactif',
        description: 'Ce produit est inactif et ne devrait pas apparaître.',
        price: 99.99,
        category_id: categoryIds.electronique,
        stock: 10,
        images: ['https://placeholder.com/400x300'],
        tags: ['placeholder'],
        is_active: false, // PRODUIT INACTIF
        rating_avg: 0,
        rating_count: 0,
        created_at: now,
        updated_at: now
      }
    ]);

    console.log(`✅ Seeder: 5 catégories et 11 produits créés`);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('products', null, {});
    await queryInterface.bulkDelete('categories', null, {});
    console.log('✅ Seeder: Données du catalogue supprimées');
  }
};