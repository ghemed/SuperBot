// functions/src/firestore/trips.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getOrCreateActiveTrip } from './trips';

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? 'localhost:8080';
const app = initializeApp({ projectId: 'demo-superbot' }, 'trips-test');
const db = getFirestore(app);

beforeEach(async () => {
  const docs = await db.collection('households/main/trips').listDocuments();
  await Promise.all(docs.map((d) => d.delete()));
});

describe('getOrCreateActiveTrip', () => {
  it('creates a new active trip when none exists', async () => {
    const trip = await getOrCreateActiveTrip(db, 111);
    expect(trip.status).toBe('active');
    expect(trip.startedBy).toBe(111);
  });

  it('returns the existing active trip instead of creating a second one', async () => {
    const first = await getOrCreateActiveTrip(db, 111);
    const second = await getOrCreateActiveTrip(db, 222);
    expect(second.id).toBe(first.id);
    const all = await db.collection('households/main/trips').get();
    expect(all.size).toBe(1);
  });
});
