// functions/src/firestore/items.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { addItems, removeItems, listItems } from './items';

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? 'localhost:8080';
const app = initializeApp({ projectId: 'demo-superbot' }, 'items-test');
const db = getFirestore(app);

beforeEach(async () => {
  const docs = await db.collection('households/main/items').listDocuments();
  await Promise.all(docs.map((d) => d.delete()));
});

describe('items', () => {
  it('adds a new item', async () => {
    const added = await addItems(db, ['חלב'], 111);
    expect(added).toEqual(['חלב']);
    const current = await listItems(db);
    expect(current.map((i) => i.name)).toEqual(['חלב']);
  });

  it('stores a new item as not ticked', async () => {
    await addItems(db, ['חלב'], 111);
    const snap = await db.collection('households/main/items').get();
    expect(snap.docs[0].data().checked).toBe(false);
  });

  it('does not add a duplicate of an existing item', async () => {
    await addItems(db, ['חלב'], 111);
    const added = await addItems(db, ['חלב'], 222);
    expect(added).toEqual([]);
    const current = await listItems(db);
    expect(current).toHaveLength(1);
  });

  it('removes an item by name', async () => {
    await addItems(db, ['חלב', 'ביצים'], 111);
    const removed = await removeItems(db, ['חלב']);
    expect(removed).toEqual(['חלב']);
    const current = await listItems(db);
    expect(current.map((i) => i.name)).toEqual(['ביצים']);
  });

  it('ignores removing an item that is not on the list', async () => {
    const removed = await removeItems(db, ['משהו שלא קיים']);
    expect(removed).toEqual([]);
  });

  it('does not create a duplicate when two adds for the same item run concurrently', async () => {
    const [first, second] = await Promise.all([
      addItems(db, ['חלב'], 111),
      addItems(db, ['חלב'], 222),
    ]);
    expect([...first, ...second]).toEqual(['חלב']);
    const current = await listItems(db);
    expect(current).toHaveLength(1);
  });
});
