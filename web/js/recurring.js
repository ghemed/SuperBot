// web/js/recurring.js
// Caller must pass at most the 4 most recent completed trip ids - this
// function doesn't slice or validate that itself, it just checks "3 of
// whatever's given." The one real caller (getRecurringCandidates) queries
// Firestore with limit(4), so the contract holds in production.
export function isRecurringCandidate(itemTripIds, recentCompletedTripIds) {
  if (recentCompletedTripIds.length < 4) return false;
  const hits = recentCompletedTripIds.filter((id) => itemTripIds.includes(id)).length;
  return hits >= 3;
}
