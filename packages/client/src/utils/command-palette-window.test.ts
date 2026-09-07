import { commandWindowRange } from './command-palette-window';

describe('commandWindowRange', () => {
  it('keeps a 2k-operation palette bounded to sixty mounted rows', () => {
    for (const activeIndex of [0, 1, 20, 500, 1000, 1999, 2003]) {
      const { start, end } = commandWindowRange(2004, activeIndex);
      expect(end - start).toBeLessThanOrEqual(60);
      expect(start).toBeGreaterThanOrEqual(0);
      expect(end).toBeLessThanOrEqual(2004);
      expect(activeIndex).toBeGreaterThanOrEqual(start);
      expect(activeIndex).toBeLessThan(end);
    }
  });
});
