// web/js/finish-plan.test.js
import { describe, it, expect } from 'vitest';
import { planFinish } from './finish-plan.js';

// A snapshot as the finish transaction reads it: `data` is the item
// document, or absent when the document no longer exists.
function snapshot(id, data) {
  return data ? { id, exists: true, data } : { id, exists: false };
}

function ticked(name, extra = {}) {
  return { name, normalizedName: name, checked: true, recurring: false, ...extra };
}

describe('planFinish', () => {
  it('counts only items that still exist and are still ticked', () => {
    const plan = planFinish(
      [
        snapshot('a', ticked('חלב')),
        snapshot('b', ticked('לחם', { checked: false })),
        snapshot('c', undefined),
        snapshot('d', { name: 'ביצים', normalizedName: 'ביצים' }),
      ],
      new Set()
    );
    expect(plan.items.map((i) => i.id)).toEqual(['a']);
  });

  it('skips an item whose document has no name or no normalized name', () => {
    const plan = planFinish(
      [
        snapshot('a', ticked('חלב')),
        snapshot('b', { checked: true, normalizedName: 'x' }),
        snapshot('c', { checked: true, name: 'x' }),
      ],
      new Set()
    );
    expect(plan.items.map((i) => i.id)).toEqual(['a']);
  });

  it('marks an item as kept only when its id is in the keep set', () => {
    const plan = planFinish(
      [snapshot('a', ticked('חלב')), snapshot('b', ticked('לחם'))],
      new Set(['b'])
    );
    expect(plan.items.map((i) => [i.id, i.kept])).toEqual([
      ['a', false],
      ['b', true],
    ]);
  });

  it('takes the name and normalized name from the snapshot', () => {
    const plan = planFinish([snapshot('a', ticked('חלב 3%'))], new Set());
    expect(plan.items[0]).toEqual({ id: 'a', name: 'חלב 3%', normalizedName: 'חלב 3%', kept: false });
  });

  it('builds the purchased record with a null price', () => {
    const plan = planFinish(
      [snapshot('a', ticked('חלב')), snapshot('b', ticked('לחם'))],
      new Set()
    );
    expect(plan.purchased).toEqual([
      { itemId: 'a', name: 'חלב', price: null },
      { itemId: 'b', name: 'לחם', price: null },
    ]);
  });

  it('builds the recurring decisions from the keep set', () => {
    const plan = planFinish(
      [snapshot('a', ticked('חלב')), snapshot('b', ticked('לחם'))],
      new Set(['a'])
    );
    expect(plan.recurringDecisions).toEqual([
      { name: 'חלב', kept: true },
      { name: 'לחם', kept: false },
    ]);
  });

  it('returns empty lists when nothing counts', () => {
    const plan = planFinish([snapshot('a', undefined)], new Set(['a']));
    expect(plan).toEqual({ items: [], purchased: [], recurringDecisions: [] });
  });
});
