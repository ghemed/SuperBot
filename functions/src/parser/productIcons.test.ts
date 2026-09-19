// functions/src/parser/productIcons.test.ts
import { describe, it, expect } from 'vitest';
import { iconFor, withIcon, PRODUCT_ICONS, FALLBACK_ICON } from './productIcons';

describe('iconFor', () => {
  it('finds an exact product', () => {
    expect(iconFor('חלב')).toBe('🥛');
    expect(iconFor('שוקולד')).toBe('🍫');
  });

  it('handles spelling variants of the same product', () => {
    expect(iconFor('עגבניה')).toBe('🍅');
    expect(iconFor('עגבנייה')).toBe('🍅');
  });

  it('handles regular plurals, including the final-letter change', () => {
    expect(iconFor('עגבניות')).toBe('🍅');
    expect(iconFor('מלפפונים')).toBe('🥒');
    expect(iconFor('תפוזים')).toBe('🍊');
    expect(iconFor('בננות')).toBe('🍌');
    expect(iconFor('פיתות')).toBe('🫓');
    expect(iconFor('ביצים')).toBe('🥚');
  });

  it('derives plurals by rule, not only from listed forms', () => {
    // None of these plurals is in the dictionary - only the singular is.
    expect(iconFor('מלונים')).toBe('🍈'); // final nun restored: מלונ -> מלון
    expect(iconFor('אבטיחים')).toBe('🍉');
    expect(iconFor('אשכוליות')).toBe('🍊'); // -ות over a stem ending in yod: אשכולית
    expect(iconFor('פרגיות')).toBe('🍗');
  });

  it('uses the first recognized word, so a trailing modifier does not matter', () => {
    expect(iconFor('גבינה צהובה')).toBe('🧀');
    expect(iconFor('עגבניות שרי')).toBe('🍅');
    expect(iconFor('עוגת שוקולד')).toBe('🍰');
  });

  it('prefers a specific multi-word phrase over its first word', () => {
    expect(iconFor('תפוחי אדמה')).toBe('🥔');
    expect(iconFor('תפוח אדמה')).toBe('🥔');
    expect(iconFor('תפוח')).toBe('🍎');
    expect(iconFor('שמן זית')).toBe('🫒');
    expect(iconFor('שמן')).toBe('🛢️');
    expect(iconFor('פלפל שחור')).toBe('🧂');
    expect(iconFor('פלפל')).toBe('🫑');
    expect(iconFor('נייר טואלט')).toBe('🧻');
  });

  it('finds a phrase that is not at the start of the name', () => {
    expect(iconFor('2 ק"ג תפוחי אדמה')).toBe('🥔');
  });

  it('ignores surrounding whitespace and punctuation', () => {
    expect(iconFor('  חלב  ')).toBe('🥛');
    expect(iconFor('חלב!')).toBe('🥛');
    expect(iconFor('(עגבניות)')).toBe('🍅');
  });

  it('ignores a leading quantity', () => {
    expect(iconFor('2 חלב')).toBe('🥛');
    expect(iconFor('3 עגבניות')).toBe('🍅');
  });

  it('treats typographic apostrophes like a plain one', () => {
    expect(iconFor("קוטג'")).toBe('🥛');
    expect(iconFor('קוטג׳')).toBe('🥛');
  });

  it('falls back to the generic icon for an unrecognized name', () => {
    expect(iconFor('דבר מוזר')).toBe(FALLBACK_ICON);
    expect(iconFor('')).toBe(FALLBACK_ICON);
    expect(iconFor('   ')).toBe(FALLBACK_ICON);
  });

  it('never returns an inherited Object property for names like "constructor"', () => {
    expect(iconFor('constructor')).toBe(FALLBACK_ICON);
    expect(iconFor('toString')).toBe(FALLBACK_ICON);
    expect(iconFor('__proto__')).toBe(FALLBACK_ICON);
    expect(iconFor('hasOwnProperty')).toBe(FALLBACK_ICON);
  });
});

describe('withIcon', () => {
  it('prefixes the name with its icon', () => {
    expect(withIcon('חלב')).toBe('🥛 חלב');
    expect(withIcon('דבר מוזר')).toBe('🛒 דבר מוזר');
  });

  it('keeps the name exactly as given', () => {
    expect(withIcon('עגבניות שרי')).toBe('🍅 עגבניות שרי');
  });
});

describe('PRODUCT_ICONS', () => {
  it('maps every key to a non-empty icon', () => {
    for (const [key, icon] of Object.entries(PRODUCT_ICONS)) {
      expect(icon, key).not.toBe('');
    }
  });

  it('only has keys the lookup can actually reach', () => {
    // iconFor strips everything except letters, digits and apostrophes and
    // splits on spaces, so a key with any other character (or a typographic
    // apostrophe, or a double space) could never be matched.
    for (const key of Object.keys(PRODUCT_ICONS)) {
      expect(key, key).toMatch(/^[\p{L}\p{N}']+( [\p{L}\p{N}']+)*$/u);
      expect(key, key).toBe(key.toLowerCase());
    }
  });

  it('resolves every key to its own icon (no key is shadowed by another)', () => {
    for (const [key, icon] of Object.entries(PRODUCT_ICONS)) {
      expect(iconFor(key), key).toBe(icon);
    }
  });
});
