// functions/src/bot/handleUpdate.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { handleUpdate } from './handleUpdate';

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? 'localhost:8080';
const app = initializeApp({ projectId: 'demo-superbot' }, 'handle-update-test');
const db = getFirestore(app);

beforeEach(async () => {
  for (const col of ['items', 'trips', 'categoryOverrides']) {
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

    expect(sendMessage).toHaveBeenCalledWith(111, 'נוסף: 🥛 חלב');
    const items = await db.collection('households/main/items').get();
    // The icon is display-only - the stored name must stay exactly as typed.
    expect(items.docs.map((d) => d.data().name)).toEqual(['חלב']);
  });

  it('puts an icon before each item when several are added at once', async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined);

    await handleUpdate(makeUpdate('חלב, עגבניות, דבר מוזר'), {
      db,
      sendMessage,
      aiParse: vi.fn(),
      pagesBaseUrl: 'https://example.github.io/superbot',
    });

    expect(sendMessage).toHaveBeenCalledWith(111, 'נוסף: 🥛 חלב, 🍅 עגבניות, 🛒 דבר מוזר');
  });

  it('puts an icon before the item in the removal confirmation', async () => {
    await db.collection('households/main/items').add({
      name: 'חלב', normalizedName: 'חלב', addedAt: 1, addedBy: 111, recurring: false,
    });
    const sendMessage = vi.fn().mockResolvedValue(undefined);

    await handleUpdate(makeUpdate('הסר חלב'), {
      db,
      sendMessage,
      aiParse: vi.fn(),
      pagesBaseUrl: 'https://example.github.io/superbot',
    });

    expect(sendMessage).toHaveBeenCalledWith(111, 'הוסר: 🥛 חלב');
  });

  it('shows the list grouped by store section, with an icon before each item', async () => {
    await db.collection('households/main/items').add({
      name: 'חלב', normalizedName: 'חלב', addedAt: 1, addedBy: 111, recurring: false,
    });
    await db.collection('households/main/items').add({
      name: 'עגבניות', normalizedName: 'עגבניות', addedAt: 2, addedBy: 111, recurring: false,
    });
    const sendMessage = vi.fn().mockResolvedValue(undefined);

    await handleUpdate(makeUpdate('הצג רשימה'), {
      db,
      sendMessage,
      aiParse: vi.fn(),
      pagesBaseUrl: 'https://example.github.io/superbot',
    });

    expect(sendMessage).toHaveBeenCalledWith(111, 'ירקות ופירות\n• 🍅 עגבניות\n\nמוצרי חלב וביצים\n• 🥛 חלב');
  });

  it('files a product in the section picked for it on the site', async () => {
    await db.collection('households/main/items').add({
      name: 'עלי גפן', normalizedName: 'עלי גפן', addedAt: 1, addedBy: 111, recurring: false,
    });
    await db.collection('households/main/categoryOverrides').add({
      key: 'עלי גפן', name: 'עלי גפן', category: 'produce',
    });
    const sendMessage = vi.fn().mockResolvedValue(undefined);

    await handleUpdate(makeUpdate('הצג רשימה'), {
      db,
      sendMessage,
      aiParse: vi.fn(),
      pagesBaseUrl: 'https://example.github.io/superbot',
    });

    expect(sendMessage).toHaveBeenCalledWith(111, 'ירקות ופירות\n• 🥬 עלי גפן');
  });

  it('replies with a link to the main page for "אני בסופר" and starts no trip', async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    const aiParse = vi.fn();

    await handleUpdate(makeUpdate('אני בסופר'), {
      db,
      sendMessage,
      aiParse,
      pagesBaseUrl: 'https://example.github.io/superbot',
    });

    expect(sendMessage).toHaveBeenCalledWith(111, 'בהצלחה בסופר! 🛒\nhttps://example.github.io/superbot/');
    const trips = await db.collection('households/main/trips').get();
    expect(trips.empty).toBe(true);
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
