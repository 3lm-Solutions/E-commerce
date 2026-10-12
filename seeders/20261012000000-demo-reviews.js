'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * Avis de démonstration : les seeders catalogue donnaient aux produits une note
 * et un nombre d'avis (ex. « 312 avis ») sans aucune ligne dans `reviews`.
 * Ce seeder ajoute 2 à 4 avis par produit actif, puis recalcule `rating_avg`
 * et `rating_count` de tous les produits à partir de la table `reviews`.
 *
 * Les produits sont retrouvés par leur nom : à lancer après les deux seeders
 * catalogue. Les auteurs ont un faux hash et ne peuvent pas se connecter.
 */

const REVIEWERS = [
  { key: 'sophie', email: 'sophie.martin@example.com', name: 'Sophie Martin' },
  { key: 'karim', email: 'karim.benali@example.com', name: 'Karim Benali' },
  { key: 'lucas', email: 'lucas.dubois@example.com', name: 'Lucas Dubois' },
  { key: 'amina', email: 'amina.elidrissi@example.com', name: 'Amina El Idrissi' }
];

// [auteur, note, commentaire] par nom de produit
const REVIEWS = {
  'iPhone 15 Pro Max': [
    ['sophie', 5, "Écran magnifique et photos superbes, même de nuit. L'autonomie tient largement la journée."],
    ['karim', 4, 'Très bon téléphone, la caméra 48 MP est impressionnante. Un peu lourd et le prix reste élevé.'],
    ['lucas', 5, 'Le A17 Pro est très fluide, aucun ralentissement en jeu ou en montage vidéo.']
  ],
  'MacBook Pro 16"': [
    ['amina', 5, 'Puissant et silencieux, la puce M3 Pro gère sans problème mes projets de développement.'],
    ['karim', 5, "Écran superbe et autonomie excellente. Les 18 Go de RAM suffisent pour mon usage."],
    ['lucas', 4, "Machine très performante, mais 512 Go de SSD c'est juste à ce prix."]
  ],
  'Samsung Galaxy S24 Ultra': [
    ['sophie', 5, 'Le S Pen est vraiment pratique pour prendre des notes. Écran AMOLED très lumineux.'],
    ['amina', 4, "Zoom photo impressionnant avec le capteur 200 MP. Le téléphone est grand, difficile à utiliser d'une main."]
  ],
  'Jean Slim Fit Premium': [
    ['karim', 5, 'Denim de belle qualité, la coupe slim tombe très bien.'],
    ['sophie', 4, 'Joli jean et confortable, mais il taille un peu petit : prendre une taille au-dessus.'],
    ['lucas', 4, 'Bonne qualité pour le prix, le tissu ne se déforme pas après lavage.']
  ],
  'Sneakers Running Pro': [
    ['lucas', 5, "Amorti excellent, je cours 10 km sans douleur aux genoux."],
    ['amina', 4, 'Légères et confortables. Les lacets se défont un peu trop facilement.'],
    ['karim', 5, 'Très bon maintien du pied, parfaites pour mes sorties running.']
  ],
  'Canapé 3 Places Scandinave': [
    ['sophie', 5, 'Très joli dans le salon, le tissu gris clair est doux et la structure solide.'],
    ['amina', 4, "Beau canapé et confortable. Le montage prend du temps et l'assise est un peu ferme au début."]
  ],
  'Vélo Électrique Urban': [
    ['karim', 5, "Parfait pour aller au travail, l'assistance est agréable et la batterie tient la semaine."],
    ['lucas', 4, "Bonne autonomie, autour de 70 km en pratique. Le vélo est assez lourd à porter dans les escaliers."],
    ['sophie', 5, 'Facile à prendre en main, je ne prends plus la voiture en ville.']
  ],
  'Clean Code (Livre)': [
    ['amina', 5, 'Un classique : les chapitres sur le nommage et les fonctions ont changé ma façon de coder.'],
    ['lucas', 5, 'Exemples clairs et conseils applicables tout de suite. À lire pour tout développeur.'],
    ['karim', 4, 'Très utile, mais certains exemples Java sont un peu datés.']
  ],
  'Console Gaming Next-Gen': [
    ['lucas', 5, 'Les temps de chargement sont presque nuls grâce au SSD. Graphismes superbes.'],
    ['sophie', 5, 'Très fluide et silencieuse, mes enfants l\'adorent.']
  ],
  'MacBook Pro 14"': [
    ['karim', 4, "Rapide et bien construit. Il chauffe un peu lors des longues compilations."],
    ['sophie', 5, 'Écran excellent et autonomie remarquable, idéal pour travailler en déplacement.']
  ],
  'iPhone 15 Pro': [
    ['amina', 5, 'Compact et puissant, les photos en mode portrait sont superbes.'],
    ['lucas', 4, "Très bon iPhone, mais l'autonomie est juste en usage intensif."]
  ],
  'T-shirt Premium Coton': [
    ['sophie', 4, 'Coton bio agréable à porter. Il a légèrement rétréci au premier lavage.'],
    ['karim', 5, 'Bonne épaisseur, les coutures sont solides. J\'en ai pris trois.']
  ],
  'Jean Slim Fit': [
    ['amina', 4, 'Confortable grâce au stretch, coupe flatteuse.'],
    ['lucas', 3, 'Correct pour le prix, mais la couleur a un peu passé après quelques lavages.']
  ],
  'JavaScript: The Good Parts': [
    ['karim', 4, 'Court et dense, très bon pour comprendre les pièges du langage. Ne couvre pas ES6.'],
    ['sophie', 5, 'Il explique enfin clairement les closures et les prototypes.']
  ],
  'Node.js Design Patterns': [
    ['amina', 5, "Excellent pour structurer une application Node.js : streams, modules, asynchrone."],
    ['lucas', 5, 'Avancé mais très bien expliqué, les exemples sont concrets.'],
    ['karim', 4, 'Très complet. Mieux vaut déjà bien connaître JavaScript avant de le lire.']
  ]
};

async function recomputeProductRatings(queryInterface) {
  await queryInterface.sequelize.query(`
    UPDATE products p SET
      rating_avg = COALESCE((SELECT ROUND(AVG(r.rating), 2) FROM reviews r WHERE r.product_id = p.id), 0),
      rating_count = (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id)
  `);
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();
    const DAY = 24 * 60 * 60 * 1000;

    // 1. Auteurs des avis (créés seulement s'ils n'existent pas)
    const existingUsers = await queryInterface.sequelize.query(
      'SELECT id, email FROM users WHERE email IN (:emails)',
      { replacements: { emails: REVIEWERS.map((r) => r.email) }, type: Sequelize.QueryTypes.SELECT }
    );
    const userIdByEmail = Object.fromEntries(existingUsers.map((u) => [u.email, u.id]));

    const newUsers = REVIEWERS.filter((r) => !userIdByEmail[r.email]).map((r) => {
      userIdByEmail[r.email] = uuidv4();
      return {
        id: userIdByEmail[r.email],
        email: r.email,
        name: r.name,
        password: '$2b$12$hashedPasswordReviewer', // bcrypt hash fictif
        role: 'client',
        created_at: now,
        updated_at: now
      };
    });
    if (newUsers.length) {
      await queryInterface.bulkInsert('users', newUsers, {});
    }
    const userIdByKey = Object.fromEntries(REVIEWERS.map((r) => [r.key, userIdByEmail[r.email]]));

    // 2. Avis, sans doublon (un seul avis par utilisateur et par produit)
    const products = await queryInterface.sequelize.query(
      'SELECT id, name FROM products WHERE name IN (:names)',
      { replacements: { names: Object.keys(REVIEWS) }, type: Sequelize.QueryTypes.SELECT }
    );
    const existingReviews = await queryInterface.sequelize.query(
      'SELECT user_id, product_id FROM reviews WHERE user_id IN (:userIds)',
      { replacements: { userIds: Object.values(userIdByKey) }, type: Sequelize.QueryTypes.SELECT }
    );
    const alreadyReviewed = new Set(existingReviews.map((r) => `${r.user_id}:${r.product_id}`));

    const reviews = [];
    for (const product of products) {
      REVIEWS[product.name].forEach(([author, rating, comment], index) => {
        const userId = userIdByKey[author];
        if (alreadyReviewed.has(`${userId}:${product.id}`)) return;
        reviews.push({
          id: uuidv4(),
          product_id: product.id,
          user_id: userId,
          rating,
          comment,
          created_at: new Date(now.getTime() - (index + 1) * 3 * DAY)
        });
      });
    }
    if (reviews.length) {
      await queryInterface.bulkInsert('reviews', reviews, {});
    }

    // 3. Notes des produits calculées à partir des vrais avis
    await recomputeProductRatings(queryInterface);
  },

  async down(queryInterface, Sequelize) {
    const emails = REVIEWERS.map((r) => r.email);
    await queryInterface.sequelize.query(
      'DELETE FROM reviews WHERE user_id IN (SELECT id FROM users WHERE email IN (:emails))',
      { replacements: { emails } }
    );
    await queryInterface.bulkDelete('users', { email: emails }, {});
    await recomputeProductRatings(queryInterface);
  }
};
