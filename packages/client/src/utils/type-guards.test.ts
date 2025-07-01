import { isReference, isRequestBody } from './type-guards';

describe('Type Guards', () => {
  describe('isReference', () => {
    it('should return true for objects with $ref property', () => {
      expect(isReference({ $ref: '#/components/schemas/Pet' })).toBe(true);
    });

    it('should return false for objects without $ref property', () => {
      expect(isReference({ content: {} })).toBe(false);
    });

    it('should return false for null or undefined', () => {
      expect(isReference(null)).toBe(false);
      expect(isReference(undefined)).toBe(false);
    });

    it('should return false for non-objects', () => {
      expect(isReference('string')).toBe(false);
      expect(isReference(123)).toBe(false);
    });
  });

  describe('isRequestBody', () => {
    it('should return true for objects that are not references', () => {
      expect(isRequestBody({ content: {} })).toBe(true);
    });

    it('should return false for reference objects', () => {
      expect(isRequestBody({ $ref: '#/components/requestBodies/Pet' })).toBe(
        false
      );
    });

    it('should return false for null or undefined', () => {
      expect(isRequestBody(null as any)).toBe(false);
      expect(isRequestBody(undefined as any)).toBe(false);
    });
  });
});

