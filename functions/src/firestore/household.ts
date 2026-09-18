// functions/src/firestore/household.ts
import type { Firestore } from 'firebase-admin/firestore';

export async function isHouseholdMember(db: Firestore, chatId: number): Promise<boolean> {
  const snap = await db.doc('households/main').get();
  if (!snap.exists) return false;
  const memberChatIds = snap.data()?.memberChatIds;
  return Array.isArray(memberChatIds) && memberChatIds.includes(chatId);
}
