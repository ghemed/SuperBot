// web/js/recurring.js
export function isRecurringCandidate(itemTripIds, recentCompletedTripIds) {
  if (recentCompletedTripIds.length < 4) return false;
  const hits = recentCompletedTripIds.filter((id) => itemTripIds.includes(id)).length;
  return hits >= 3;
}
