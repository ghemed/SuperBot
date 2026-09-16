// web/js/recurring.test.js
import { describe, it, expect } from 'vitest';
import { isRecurringCandidate } from './recurring.js';

describe('isRecurringCandidate', () => {
  it('is false when fewer than 4 trips have completed yet', () => {
    expect(isRecurringCandidate(['t1', 't2'], ['t1', 't2'])).toBe(false);
  });

  it('is true when the item appears in 3 of the last 4 trips', () => {
    expect(isRecurringCandidate(['t1', 't2', 't3'], ['t1', 't2', 't3', 't4'])).toBe(true);
  });

  it('is true when the item appears in all of the last 4 trips', () => {
    expect(isRecurringCandidate(['t1', 't2', 't3', 't4'], ['t1', 't2', 't3', 't4'])).toBe(true);
  });

  it('is false when the item appears in only 2 of the last 4 trips', () => {
    expect(isRecurringCandidate(['t1', 't3'], ['t1', 't2', 't3', 't4'])).toBe(false);
  });
});
