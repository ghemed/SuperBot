// functions/src/__tests__/firestore.rules.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { doc, getDoc, setDoc } from 'firebase/firestore';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-superbot',
    firestore: {
      rules: readFileSync('../firestore.rules', 'utf8'),
      host: 'localhost',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'households/main'), {
      memberChatIds: [111],
    });
  });
});

describe('firestore rules', () => {
  it('lets any signed-in (anonymous) user read the item list', async () => {
    const userDb = testEnv.authenticatedContext('uid-a').firestore();
    await assertSucceeds(getDoc(doc(userDb, 'households/main/items/x')));
  });

  it('blocks an unauthenticated read', async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anonDb, 'households/main/items/x')));
  });

  // Every household collection shares the same `{collection}/{docId}`
  // wildcard rule - looping over all of them catches a future rule change
  // that accidentally special-cases one of them, not just "items".
  const HOUSEHOLD_COLLECTIONS = ['items', 'trips', 'purchaseHistory', 'categoryOverrides'];

  it.each(HOUSEHOLD_COLLECTIONS)('lets any signed-in user write to %s', async (collection) => {
    const userDb = testEnv.authenticatedContext('uid-a').firestore();
    await assertSucceeds(setDoc(doc(userDb, `households/main/${collection}/x`), { test: true }));
  });

  it.each(HOUSEHOLD_COLLECTIONS)('blocks an unauthenticated write to %s', async (collection) => {
    const anonDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(anonDb, `households/main/${collection}/x`), { test: true }));
  });

  it('blocks a signed-in user from writing to households/main itself', async () => {
    // memberChatIds is set once manually (console/Admin SDK) - never from
    // the app, even by a legitimate signed-in user.
    const userDb = testEnv.authenticatedContext('uid-a').firestore();
    await assertFails(
      setDoc(doc(userDb, 'households/main'), { memberChatIds: [111, 222] })
    );
  });
});
