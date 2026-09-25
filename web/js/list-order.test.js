// web/js/list-order.test.js
import { describe, it, expect } from 'vitest';
import {
  CATEGORIES, categoryKey, categoryOf, displayIcon, groupItems, longestIncreasingSubsequence,
} from './list-order.js';
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

describe('sections picked by hand', () => {
  const overrides = new Map([['עלי גפן', 'produce'], ['חלב', 'drinks'], ['משהו', 'no-such-section']]);

  it('file a product the dictionary does not know, whatever its spacing or case', () => {
    expect(categoryOf('עלי גפן').id).toBe('other');
    expect(categoryOf('עלי גפן', overrides).id).toBe('produce');
    expect(categoryOf('  עלי   גפן ', overrides).id).toBe('produce');
    expect(categoryKey('  Milk  2% ')).toBe('milk 2%');
  });

  it('win over the section the dictionary picks', () => {
    expect(categoryOf('חלב', overrides).id).toBe('drinks');
  });

  it('are ignored when they name a section that does not exist', () => {
    expect(categoryOf('משהו', overrides).id).toBe('other');
  });

  it("swap the cart icon for the section's icon, but keep a product's own icon", () => {
    expect(displayIcon('עלי גפן')).toBe('🛒');
    expect(displayIcon('עלי גפן', overrides)).toBe('🥬');
    expect(displayIcon('חלב', overrides)).toBe('🥛');
  });

  it('are used when grouping', () => {
    const items = [item('1', 'עלי גפן'), item('2', 'לחם')];
    expect(shape(groupItems(items, overrides))).toEqual([['produce', ['1']], ['bakery', ['2']]]);
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
    const overrides = new Map([['עלי גפן', 'produce'], [categoryKey(names[0]), 'frozen']]);
    const withOverrides = [...items, item('x', 'עלי גפן'), item('y', 'עלי גפן', true)];
    expect(groupItems(withOverrides, overrides)).toEqual(server.groupItems(withOverrides, overrides));
  });

  it('pick the same key and icon for a name', () => {
    const overrides = new Map([['עלי גפן', 'produce']]);
    for (const name of ['  עלי   גפן ', 'Milk  2%', 'חלב', 'דבר מוזר']) {
      expect(categoryKey(name)).toBe(server.categoryKey(name));
      expect(displayIcon(name, overrides)).toBe(server.displayIcon(name, overrides));
    }
  });
});
