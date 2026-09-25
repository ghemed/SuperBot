// functions/src/parser/listOrder.test.ts
import { describe, it, expect } from 'vitest';
import { formatList } from './listOrder';

describe('formatList', () => {
  it('lists items under their section headings, produce first and ticked items last', () => {
    const text = formatList([
      { name: 'חלב' },
      { name: 'מלפפונים', checked: true },
      { name: 'עגבניות' },
      { name: 'דבר מוזר' },
    ]);
    expect(text).toBe(
      'ירקות ופירות\n• 🍅 עגבניות\n\n' +
      'מוצרי חלב וביצים\n• 🥛 חלב\n\n' +
      'שונות\n• 🛒 דבר מוזר\n\n' +
      'בעגלה\n• 🥒 מלפפונים'
    );
  });

  it('is empty for an empty list', () => {
    expect(formatList([])).toBe('');
  });
});
