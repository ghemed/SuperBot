// functions/src/parser/normalize.test.ts
import { describe, it, expect } from 'vitest';
import { normalizeItemName } from './normalize';

describe('normalizeItemName', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeItemName('  חלב  ')).toBe('חלב');
  });

  it('collapses internal whitespace runs', () => {
    expect(normalizeItemName('גבינה   צהובה')).toBe('גבינה צהובה');
  });

  it('lowercases latin characters', () => {
    expect(normalizeItemName('Milk')).toBe('milk');
  });

  it('treats two differently-spaced writings of the same item as equal', () => {
    expect(normalizeItemName('חלב 3%')).toBe(normalizeItemName('  חלב   3%  '));
  });
});
