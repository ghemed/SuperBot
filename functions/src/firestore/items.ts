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
  checked?: boolean;
}

function itemsCollection(db: Firestore) {
  return db.collection('households/main/items');
}

export async function addItems(db: Firestore, names: string[], addedBy: number): Promise<string[]> {
  const col = itemsCollection(db);
  const added: string[] = [];
  for (const name of names) {
    const normalizedName = normalizeItemName(name);
    // The duplicate-check and the write must happen inside one transaction:
    // two concurrent calls for the same item name (e.g. both spouses
    // texting "חלב" seconds apart) would otherwise both see "not found" in
    // a plain read-then-write and both create a duplicate doc.
    const wasAdded = await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(
        col.where('normalizedName', '==', normalizedName).limit(1)
      );
      if (!existing.empty) return false;
      transaction.set(col.doc(), {
        name: name.trim(),
        normalizedName,
        addedAt: Date.now(),
        addedBy,
        recurring: false,
        checked: false,
      });
      return true;
    });
    if (wasAdded) added.push(name.trim());
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
