/**
 * Similar products score (spec 05, §2.1): +3 same category, +2 per common tag,
 * +1 for a close price (±20%), but only when the products already share a
 * category or a tag. The models are mocked, so these tests need no database.
 */
jest.mock('../../models', () => ({ Product: {}, Category: {} }));

const { calculateSimilarityScore } = require('../services/similarityService');

const product = (id, categoryId, price, tags = []) => ({ id, categoryId, price, tags });

describe('calculateSimilarityScore', () => {
  test('a close price alone does not make two products similar', () => {
    const sofa = product('sofa', 'home', 499.99, ['canapé', 'salon']);
    const console = product('console', 'electronics', 499.99, ['console', 'gaming']);
    expect(calculateSimilarityScore(sofa, console)).toBe(0);
  });

  test('same category and close price: 3 + 1', () => {
    const iphone = product('iphone', 'electronics', 1229, ['apple']);
    const galaxy = product('galaxy', 'electronics', 1300, ['samsung']);
    expect(calculateSimilarityScore(iphone, galaxy)).toBe(4);
  });

  test('common tag in another category and close price: 2 + 1', () => {
    const shoes = product('shoes', 'clothes', 120, ['Sport', 'running']);
    const watch = product('watch', 'electronics', 110, ['sport ']);
    expect(calculateSimilarityScore(shoes, watch)).toBe(3);
  });

  test('same category and common tags, price far apart: 3 + 2 per tag', () => {
    const pro = product('pro', 'electronics', 1229, ['smartphone', 'apple', 'camera']);
    const laptop = product('laptop', 'electronics', 2999, ['laptop', 'apple']);
    expect(calculateSimilarityScore(pro, laptop)).toBe(5);
  });

  test('a product is never similar to itself', () => {
    const iphone = product('iphone', 'electronics', 1229, ['apple']);
    expect(calculateSimilarityScore(iphone, iphone)).toBe(0);
  });
});
