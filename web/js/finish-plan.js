// web/js/finish-plan.js
// Decides what "סיימתי לקנות" does, from item snapshots that the finish
// transaction re-read a moment ago. Kept free of Firestore so it can be
// unit-tested; db.js's finishTrip does the reads and writes around it.
//
// An item counts only if it still exists, is still ticked, AND has a string
// name and normalized name. The first two are what make a double tap, or both
// phones finishing at once, safe: the second run finds the items already
// deleted (or, for kept items, already unticked) and so counts nothing. The
// third guards against a legacy or hand-edited document with no name: the
// purchase-history id is derived from the normalized name, so one such row
// would make the finish transaction throw on every retry and the list could
// never be finished while that row stayed ticked.
export function planFinish(snapshots, keepItemIds) {
  const items = snapshots
    .filter(
      (snap) =>
        snap.exists &&
        snap.data.checked === true &&
        typeof snap.data.name === "string" &&
        typeof snap.data.normalizedName === "string"
    )
    .map((snap) => ({
      id: snap.id,
      name: snap.data.name,
      normalizedName: snap.data.normalizedName,
      kept: keepItemIds.has(snap.id),
    }));

  return {
    items,
    purchased: items.map((item) => ({ itemId: item.id, name: item.name, price: null })),
    recurringDecisions: items.map((item) => ({ name: item.name, kept: item.kept })),
  };
}
