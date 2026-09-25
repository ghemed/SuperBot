// functions/src/firestore/categoryOverrides.ts
import type { Firestore } from 'firebase-admin/firestore';
import type { CategoryOverrides } from '../parser/listOrder';

// Sections picked by hand on the list page (web/js/db.js writes them), as a
// Map of categoryKey(name) -> category id.
export async function listCategoryOverrides(db: Firestore): Promise<CategoryOverrides> {
  const snapshot = await db.collection('households/main/categoryOverrides').get();
  const overrides = new Map<string, string>();
  for (const doc of snapshot.docs) {
    const { key, category } = doc.data();
    if (typeof key === 'string' && typeof category === 'string') overrides.set(key, category);
  }
  return overrides;
}
