// web/js/product-icons.test.js
import { describe, it, expect } from 'vitest';
import * as web from './product-icons.js';
import * as server from '../../functions/src/parser/productIcons.ts';

describe('web product icons', () => {
  it('picks the icon for a product, plural, phrase and unknown name', () => {
    expect(web.iconFor('חלב')).toBe('🥛');
    expect(web.iconFor('מלפפונים')).toBe('🥒');
    expect(web.iconFor('תפוחי אדמה')).toBe('🥔');
    expect(web.iconFor('גבינה צהובה')).toBe('🧀');
    expect(web.iconFor('דבר מוזר')).toBe(web.FALLBACK_ICON);
  });

  it('never returns an inherited Object property for names like "constructor"', () => {
    expect(web.iconFor('constructor')).toBe(web.FALLBACK_ICON);
    expect(web.iconFor('toString')).toBe(web.FALLBACK_ICON);
  });

  it('prefixes the name with its icon without altering the name', () => {
    expect(web.withIcon('עגבניות שרי')).toBe('🍅 עגבניות שרי');
  });
});

// The bot and the site each carry their own copy of the icon logic (see the
// header of either file). These tests are what keeps the copies identical.
describe('web and server copies stay in sync', () => {
  it('have the same fallback icon and dictionary', () => {
    expect(web.FALLBACK_ICON).toBe(server.FALLBACK_ICON);
    expect(web.PRODUCT_ICONS).toEqual(server.PRODUCT_ICONS);
  });

  it('pick the same icon for every dictionary key and a range of variations of it', () => {
    const probes = new Set([
      '', '   ', 'דבר מוזר', 'constructor', 'toString', '__proto__', 'hasOwnProperty',
      '2 חלב', 'חלב!', '(עגבניות)', "קוטג'", 'קוטג׳', '2 ק"ג תפוחי אדמה', 'מלונים', 'אשכוליות',
    ]);
    for (const key of Object.keys(server.PRODUCT_ICONS)) {
      probes.add(key);
      probes.add(`3 ${key}`);
      probes.add(`${key} קטן`);
      probes.add(`${key}ים`);
      probes.add(`${key}ות`);
      probes.add(`${key.slice(0, -1)}ים`);
      probes.add(`${key.slice(0, -1)}ות`);
    }

    for (const probe of probes) {
      expect(web.iconFor(probe), probe).toBe(server.iconFor(probe));
      expect(web.withIcon(probe), probe).toBe(server.withIcon(probe));
    }
  });
});
