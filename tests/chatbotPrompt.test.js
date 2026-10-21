'use strict';

/**
 * Tests unitaires pour le prompt système du chatbot IA e-commerce
 *
 * FonctionnalitéHaute #1670 - Prompt système avec contexte produit
 *
 * Ces tests mockent le modèle Sequelize Product (aucun accès à la vraie DB).
 */

const { buildSystemPrompt, buildMessagesForClaude, MAX_HISTORY_MESSAGES } = require('../src/services/chatbotPrompt');
const { getProductCatalogForChatbot, formatProductForChatbot, formatProductsAsText, shortenDescription, MAX_DESCRIPTION_LENGTH } = require('../src/services/productCatalogService');

// Mock du modèle Sequelize Product (et du module ../../models)
jest.mock('../models', () => ({
  Product: {
    findAll: jest.fn()
  },
  Category: {
    findAll: jest.fn()
  }
}));

const { Product } = require('../models');

describe('FonctionnalitéHaute #1670 - Chatbot : prompt système avec contexte produit', () => {
  const catalogueText = 'T-shirt Bleu - 199.99 € - Vêtements - Stock: 15';

  describe('buildSystemPrompt(catalogueText)', () => {
    test('✅ Inclut le texte du catalogue passé en paramètre', () => {
      const prompt = buildSystemPrompt(catalogueText);
      expect(prompt).toContain(catalogueText);
    });

    test('✅ Contient le rôle "assistant e-commerce"', () => {
      const prompt = buildSystemPrompt(catalogueText);
      expect(prompt.toLowerCase()).toContain('assistant e-commerce');
      expect(prompt).toContain('boutique en ligne');
    });

    test('✅ Contient la limite anti-invention (ne jamais inventer un produit)', () => {
      const prompt = buildSystemPrompt(catalogueText);
      expect(prompt.toLowerCase()).toContain('jamais inventer');
      expect(prompt).toContain('ne figure pas dans le catalogue');
    });

    test('✅ Mentionne les statuts de commande du suivi', () => {
      const prompt = buildSystemPrompt(catalogueText);
      ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].forEach((status) => {
        expect(prompt).toContain(status);
      });
    });

    test('✅ Gère un catalogue vide/indisponible avec un message de repli', () => {
      const prompt = buildSystemPrompt(null);
      expect(prompt).toContain('Le catalogue est actuellement indisponible.');
    });
  });

  describe('buildMessagesForClaude(conversationHistory, catalogueText)', () => {
    test('✅ Retourne la structure { system, messages }', () => {
      const result = buildMessagesForClaude([], catalogueText);
      expect(result).toEqual(expect.objectContaining({
        system: expect.any(String),
        messages: expect.any(Array)
      }));
    });

    test('✅ Injecte le texte du catalogue dans le system prompt final', () => {
      const result = buildMessagesForClaude([], catalogueText);
      expect(result.system).toContain(catalogueText);
    });

    test('✅ Reconstruit les messages à partir de l\'historique', () => {
      const history = [
        { role: 'user', content: 'Bonjour' },
        { role: 'assistant', content: 'Bonjour ! Comment puis-je vous aider ?' }
      ];
      const result = buildMessagesForClaude(history, catalogueText);
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]).toEqual({ role: 'user', content: 'Bonjour' });
      expect(result.messages[1]).toEqual({ role: 'assistant', content: 'Bonjour ! Comment puis-je vous aider ?' });
    });

    test('✅ Limite le nombre de messages à 10 même avec un historique plus long', () => {
      // 30 messages d'historique (15 échanges)
      const longHistory = Array.from({ length: 30 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i + 1}`
      }));

      const result = buildMessagesForClaude(longHistory, catalogueText);
      expect(result.messages).toHaveLength(MAX_HISTORY_MESSAGES);
      expect(result.messages).toHaveLength(10);

      // On garde bien les 10 derniers messages (messages 21 à 30)
      expect(result.messages[0]).toEqual({ role: 'user', content: 'Message 21' });
      expect(result.messages[9]).toEqual({ role: 'assistant', content: 'Message 30' });
    });

    test('✅ Retourne un tableau vide si conversationHistory n\'est pas un tableau', () => {
      expect(buildMessagesForClaude(null, catalogueText).messages).toEqual([]);
      expect(buildMessagesForClaude(undefined, catalogueText).messages).toEqual([]);
      expect(buildMessagesForClaude('pas un tableau', catalogueText).messages).toEqual([]);
      expect(buildMessagesForClaude({}, catalogueText).messages).toEqual([]);
    });

    test('✅ Filtre les messages invalides (mauvais rôle ou contenu non string)', () => {
      const history = [
        { role: 'user', content: 'Bonjour' },
        { role: 'system', content: 'Interdit ici' },
        { role: 'user', content: 123 },
        null,
        { role: 'assistant', content: 'Salut !' }
      ];
      const result = buildMessagesForClaude(history, catalogueText);
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].content).toBe('Bonjour');
      expect(result.messages[1].content).toBe('Salut !');
    });
  });

  describe('getProductCatalogForChatbot() - Service catalogue mocké', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('✅ Formate les produits actifs récupérés en texte lisible', async () => {
      // Simulation de la réponse Sequelize (raw: true → colonnes aplaties)
      Product.findAll.mockResolvedValue([
        {
          name: 'T-shirt Bleu',
          price: '199.99', // DECIMAL renvoyé en string par pg
          stock: 15,
          'category.name': 'Vêtements'
        },
        {
          name: 'iPhone 15 Pro',
          price: 1199.999, // prix flottant à arrondir
          stock: '25', // stock en string à convertir en entier
          'category.name': 'Électronique'
        }
      ]);

      const text = await getProductCatalogForChatbot();

      expect(Product.findAll).toHaveBeenCalledTimes(1);
      expect(Product.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: { isActive: true },
        limit: 20
      }));

      expect(text).toContain('T-shirt Bleu - 199.99 € - Vêtements - Stock: 15');
      expect(text).toContain('iPhone 15 Pro - 1200.00 € - Électronique - Stock: 25');
    });

    test('✅ Retourne un message de repli si la requête échoue', async () => {
      Product.findAll.mockRejectedValue(new Error('Connexion DB refusée'));

      const text = await getProductCatalogForChatbot();

      expect(text).toContain('Le catalogue est temporairement indisponible.');
    });

    test('✅ Retourne un message explicite si le catalogue est vide', async () => {
      Product.findAll.mockResolvedValue([]);

      const text = await getProductCatalogForChatbot();

      expect(text).toContain('Le catalogue ne contient actuellement aucun produit disponible.');
    });

    test('✅ formatProductForChatbot arrondit le prix et normalise le stock', () => {
      const formatted = formatProductForChatbot({
        name: 'Casque Gaming',
        price: '49.999',
        stock: '7',
        category: { name: 'Audio' }
      });

      expect(formatted).toEqual({
        name: 'Casque Gaming',
        price: 50.0,
        category: 'Audio',
        stock: 7,
        ratingAvg: 0,
        ratingCount: 0,
        description: ''
      });
    });

    test('✅ formatProductForChatbot gère le format raw (catégorie aplatie)', () => {
      // Sequelize raw: true → colonnes de l'association aplaties
      const formatted = formatProductForChatbot({
        name: 'MacBook Pro',
        price: '2499.99',
        stock: 10,
        'category.name': 'Électronique'
      });

      expect(formatted).toEqual({
        name: 'MacBook Pro',
        price: 2499.99,
        category: 'Électronique',
        stock: 10,
        ratingAvg: 0,
        ratingCount: 0,
        description: ''
      });
    });

    test('✅ formatProductForChatbot utilise "Non catégorisé" sans catégorie', () => {
      const formatted = formatProductForChatbot({
        name: 'Produit Orphelin',
        price: '5.50',
        stock: 2
      });

      expect(formatted.category).toBe('Non catégorisé');
    });

    test('✅ formatProductsAsText produit une liste numérotée lisible', () => {
      const text = formatProductsAsText([
        { name: 'Produit A', price: 10.5, category: 'Cat A', stock: 3 },
        { name: 'Produit B', price: 20.25, category: 'Cat B', stock: 0 }
      ]);

      expect(text).toBe('1. Produit A - 10.50 € - Cat A - Stock: 3\n2. Produit B - 20.25 € - Cat B - Stock: 0');
    });

    test('✅ formatProductsAsText ajoute la note (si avis) et la description', () => {
      const text = formatProductsAsText([
        { name: 'MacBook Pro 16"', price: 2499.99, category: 'Électronique', stock: 12, ratingAvg: 5, ratingCount: 1, description: 'Puce M3 Pro, 18GB de RAM.' },
        { name: 'Sans avis', price: 10, category: 'Cat', stock: 1, ratingAvg: 0, ratingCount: 0, description: 'Description seule' }
      ]);

      expect(text).toBe(
        '1. MacBook Pro 16" - 2499.99 € - Électronique - Stock: 12 - Note: 5/5 (1 avis) - Puce M3 Pro, 18GB de RAM.\n' +
        '2. Sans avis - 10.00 € - Cat - Stock: 1 - Description seule'
      );
    });

    test('✅ formatProductForChatbot arrondit la note et lit les colonnes raw', () => {
      const formatted = formatProductForChatbot({
        name: 'iPhone', price: '1199.99', stock: 25, ratingAvg: '4.80', ratingCount: '12',
        description: '  Écran\nOLED   6,1 pouces  '
      });

      expect(formatted.ratingAvg).toBe(4.8);
      expect(formatted.ratingCount).toBe(12);
      expect(formatted.description).toBe('Écran OLED 6,1 pouces');
    });

    test('✅ shortenDescription coupe sur un mot et ajoute « … »', () => {
      const long = 'mot '.repeat(60).trim(); // 239 caractères
      const short = shortenDescription(long);

      expect(short.endsWith('…')).toBe(true);
      expect(short.length).toBeLessThanOrEqual(MAX_DESCRIPTION_LENGTH + 1);
      expect(short).not.toMatch(/\s…$/);
      expect(shortenDescription(null)).toBe('');
      expect(shortenDescription('Court')).toBe('Court');
    });
  });
});

console.log('🧪 Tests Chatbot IA - FonctionnalitéHaute #1670');
console.log('  ✅ buildSystemPrompt : catalogue injecté + instructions clés');
console.log('  ✅ buildMessagesForClaude : structure { system, messages } + limite 10 messages');
console.log('  ✅ getProductCatalogForChatbot : formatage lisible + gestion d\'erreur');

