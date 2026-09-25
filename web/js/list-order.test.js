// web/js/list-order.test.js
import { describe, it, expect } from 'vitest';
import { CATEGORIES, categoryOf, groupItems, longestIncreasingSubsequence } from './list-order.js';
import { PRODUCT_ICONS } from './product-icons.js';
import * as server from '../../functions/src/parser/listOrder.ts';

const item = (id, name, checked = false) => ({ id, name, checked });
const shape = (groups) => groups.map((g) => [g.id, g.items.map((i) => i.id)]);

describe('categoryOf', () => {
  it('files products by their icon', () => {
    expect(categoryOf('עגבניות').id).toBe('produce');
    expect(categoryOf('מלפפון').id).toBe('produce');
    expect(categoryOf('חלב 3%').id).toBe('dairy');
    expect(categoryOf('נייר טואלט').id).toBe('household');
    expect(categoryOf('דבר מוזר').id).toBe('other');
  });

  it('has a section for every icon in the dictionary', () => {
    for (const icon of new Set(Object.values(PRODUCT_ICONS))) {
      expect(CATEGORIES.some((c) => c.id !== 'other' && c.icons.includes(icon)), icon).toBe(true);
    }
  });

  it('puts produce first', () => {
    expect(CATEGORIES[0].id).toBe('produce');
  });
});

describe('groupItems', () => {
  it('groups by section in store order, keeping addedAt order inside a section', () => {
    const items = [item('1', 'חלב'), item('2', 'מלפפון'), item('3', 'לחם'), item('4', 'עגבניות')];
    expect(shape(groupItems(items))).toEqual([
      ['produce', ['2', '4']],
      ['dairy', ['1']],
      ['bakery', ['3']],
    ]);
  });

  it('moves ticked items to one group at the bottom, sorted by section', () => {
    const items = [item('1', 'חלב', true), item('2', 'מלפפון'), item('3', 'עגבניות', true), item('4', 'משהו')];
    expect(shape(groupItems(items))).toEqual([
      ['produce', ['2']],
      ['other', ['4']],
      ['ticked', ['3', '1']],
    ]);
  });

  it('returns no groups for an empty list', () => {
    expect(groupItems([])).toEqual([]);
  });
});

describe('longestIncreasingSubsequence', () => {
  it('keeps everything when already sorted', () => {
    expect(longestIncreasingSubsequence([0, 1, 2, 3])).toEqual([0, 1, 2, 3]);
  });

  it('leaves out only the one element that moved', () => {
    // the node at desired position 1 moved to the end
    expect(longestIncreasingSubsequence([0, 2, 3, 4, 1])).toEqual([0, 1, 2, 3]);
  });

  it('handles an empty sequence', () => {
    expect(longestIncreasingSubsequence([])).toEqual([]);
  });
});

// The bot groups its "show the list" reply with its own copy of this logic
// (see the header of either file). These tests keep the copies identical.
describe('web and server copies stay in sync', () => {
  it('have the same sections in the same order', () => {
    expect(CATEGORIES).toEqual(server.CATEGORIES);
  });

  it('group the same items the same way', () => {
    const names = [...Object.keys(PRODUCT_ICONS), 'דבר מוזר', 'constructor'];
    const items = names.flatMap((name, i) => [item(`u${i}`, name), item(`t${i}`, name, true)]);
    expect(groupItems(items)).toEqual(server.groupItems(items));
  });
});
