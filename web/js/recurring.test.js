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

  it('does not itself limit recentCompletedTripIds to 4 - callers must', () => {
    // Pins the current contract: passing more than 4 "recent" trips
    // silently loosens "3 of the last 4" to "3 of the last N." The one
    // real caller (getRecurringCandidates) queries Firestore with
    // limit(4), so this never happens in production - documented above
    // isRecurringCandidate rather than defended against here.
    expect(
      isRecurringCandidate(['t1', 't2', 't3'], ['t1', 't2', 't3', 't4', 't5'])
    ).toBe(true);
  });
});
