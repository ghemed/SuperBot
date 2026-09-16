// functions/src/firestore/trips.ts
import type { Firestore } from 'firebase-admin/firestore';

export interface Trip {
  id: string;
  status: 'active' | 'completed';
  startedAt: number;
  startedBy: number;
}

function tripsCollection(db: Firestore) {
  return db.collection('households/main/trips');
}

export async function getOrCreateActiveTrip(db: Firestore, startedBy: number): Promise<Trip> {
  const col = tripsCollection(db);
  // Same reasoning as addItems: check-then-create must be one transaction,
  // or two concurrent "אני בסופר" messages (plausibly from both spouses at
  // once - the exact scenario this single-active-trip design is for) could
  // each see "no active trip" and create two, splitting shopping progress.
  return db.runTransaction(async (transaction) => {
    const active = await transaction.get(col.where('status', '==', 'active').limit(1));
    if (!active.empty) {
      const doc = active.docs[0];
      return { id: doc.id, ...(doc.data() as Omit<Trip, 'id'>) };
    }
    const startedAt = Date.now();
    const ref = col.doc();
    transaction.set(ref, { status: 'active', startedAt, startedBy, checkedItemIds: [] });
    return { id: ref.id, status: 'active', startedAt, startedBy };
  });
}
