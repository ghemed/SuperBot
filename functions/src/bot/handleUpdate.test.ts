// functions/src/bot/handleUpdate.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { handleUpdate } from './handleUpdate';

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? 'localhost:8080';
const app = initializeApp({ projectId: 'demo-superbot' }, 'handle-update-test');
const db = getFirestore(app);

beforeEach(async () => {
  for (const col of ['items', 'trips']) {
    const docs = await db.collection(`households/main/${col}`).listDocuments();
    await Promise.all(docs.map((d) => d.delete()));
  }
  // chatId 111 (this file's default in makeUpdate) is the whitelisted
  // household member for every test below except the one that
  // deliberately uses a different, non-member chatId.
  await db.doc('households/main').set({ memberChatIds: [111], memberUids: [] });
});

function makeUpdate(text: string, chatId = 111) {
  return { update_id: 1, message: { message_id: 1, chat: { id: chatId }, text } };
}

describe('handleUpdate', () => {
  it('adds an item and replies with a confirmation', async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    const aiParse = vi.fn();

    await handleUpdate(makeUpdate('חלב'), {
      db,
      sendMessage,
      aiParse,
      pagesBaseUrl: 'https://example.github.io/superbot',
    });

    expect(sendMessage).toHaveBeenCalledWith(111, expect.stringContaining('חלב'));
    const items = await db.collection('households/main/items').get();
    expect(items.docs.map((d) => d.data().name)).toEqual(['חלב']);
  });

  it('replies with a trip link for "אני בסופר"', async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    const aiParse = vi.fn();

    await handleUpdate(makeUpdate('אני בסופר'), {
      db,
      sendMessage,
      aiParse,
      pagesBaseUrl: 'https://example.github.io/superbot',
    });

    expect(sendMessage).toHaveBeenCalledWith(
      111,
      expect.stringMatching(/^בהצלחה בסופר! 🛒\nhttps:\/\/example\.github\.io\/superbot\/trip\.html\?id=.+$/)
    );
  });

  it('asks to rephrase when both the rules and the AI fallback are unsure', async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    const aiParse = vi.fn().mockResolvedValue({ action: 'unclear', items: [] });

    await handleUpdate(makeUpdate('אין לנו יותר קפה'), {
      db,
      sendMessage,
      aiParse,
      pagesBaseUrl: 'https://example.github.io/superbot',
    });

    expect(aiParse).toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledWith(111, expect.stringContaining('לא הבנתי'));
  });

  it('silently ignores a message from a chat that is not a household member', async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    const aiParse = vi.fn();

    await handleUpdate(makeUpdate('חלב', 999), {
      db,
      sendMessage,
      aiParse,
      pagesBaseUrl: 'https://example.github.io/superbot',
    });

    expect(sendMessage).not.toHaveBeenCalled();
    expect(aiParse).not.toHaveBeenCalled();
    const items = await db.collection('households/main/items').get();
    expect(items.docs).toHaveLength(0);
  });

  it('does not throw when the update has no message (e.g. a malformed body)', async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    const aiParse = vi.fn();

    await expect(
      handleUpdate(undefined as unknown as Parameters<typeof handleUpdate>[0], {
        db,
        sendMessage,
        aiParse,
        pagesBaseUrl: 'https://example.github.io/superbot',
      })
    ).resolves.toBeUndefined();
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
