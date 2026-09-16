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
  const active = await col.where('status', '==', 'active').limit(1).get();
  if (!active.empty) {
    const doc = active.docs[0];
    return { id: doc.id, ...(doc.data() as Omit<Trip, 'id'>) };
  }
  const startedAt = Date.now();
  const ref = await col.add({ status: 'active', startedAt, startedBy, checkedItemIds: [] });
  return { id: ref.id, status: 'active', startedAt, startedBy };
}
