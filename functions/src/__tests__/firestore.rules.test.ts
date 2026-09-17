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
    firestore: { rules: readFileSync('../firestore.rules', 'utf8') },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'households/main'), {
      memberUids: ['uid-a', 'uid-b'],
    });
  });
});

describe('firestore rules', () => {
  it('lets a household member read the item list', async () => {
    const memberDb = testEnv.authenticatedContext('uid-a').firestore();
    await assertSucceeds(getDoc(doc(memberDb, 'households/main/items/x')));
  });

  it('blocks a non-member from reading the item list', async () => {
    const strangerDb = testEnv.authenticatedContext('uid-z').firestore();
    await assertFails(getDoc(doc(strangerDb, 'households/main/items/x')));
  });

  it('blocks an unauthenticated read', async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anonDb, 'households/main/items/x')));
  });
});
