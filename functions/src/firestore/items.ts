// functions/src/firestore/items.ts
import type { Firestore } from 'firebase-admin/firestore';
import { normalizeItemName } from '../parser/normalize';

export interface Item {
  id: string;
  name: string;
  normalizedName: string;
  addedAt: number;
  addedBy: number;
  recurring: boolean;
}

function itemsCollection(db: Firestore) {
  return db.collection('households/main/items');
}

export async function addItems(db: Firestore, names: string[], addedBy: number): Promise<string[]> {
  const col = itemsCollection(db);
  const added: string[] = [];
  for (const name of names) {
    const normalizedName = normalizeItemName(name);
    const existing = await col.where('normalizedName', '==', normalizedName).limit(1).get();
    if (!existing.empty) continue;
    await col.add({
      name: name.trim(),
      normalizedName,
      addedAt: Date.now(),
      addedBy,
      recurring: false,
    });
    added.push(name.trim());
  }
  return added;
}

export async function removeItems(db: Firestore, names: string[]): Promise<string[]> {
  const col = itemsCollection(db);
  const removed: string[] = [];
  for (const name of names) {
    const normalizedName = normalizeItemName(name);
    const matches = await col.where('normalizedName', '==', normalizedName).get();
    for (const doc of matches.docs) {
      await doc.ref.delete();
      removed.push(name.trim());
    }
  }
  return removed;
}

export async function listItems(db: Firestore): Promise<Item[]> {
  const snapshot = await itemsCollection(db).orderBy('addedAt', 'asc').get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<Item, 'id'>) }));
}
