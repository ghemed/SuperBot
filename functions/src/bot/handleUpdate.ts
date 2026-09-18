// functions/src/bot/handleUpdate.ts
import type { Firestore } from 'firebase-admin/firestore';
import { parseMessage, type AiParse } from '../parser/parseMessage';
import type { SendTelegramMessage } from '../telegram/sendMessage';
import type { TelegramUpdate } from '../telegram/types';
import * as items from '../firestore/items';
import * as trips from '../firestore/trips';

export interface HandleUpdateDeps {
  db: Firestore;
  sendMessage: SendTelegramMessage;
  aiParse: AiParse;
  pagesBaseUrl: string;
}

export async function handleUpdate(update: TelegramUpdate, deps: HandleUpdateDeps): Promise<void> {
  // Optional-chained: a malformed/empty webhook body (no Content-Type,
  // a bodyless ping, a manual test request) arrives here as `undefined`,
  // not a well-formed TelegramUpdate - `update.message` would throw.
  const message = update?.message;
  if (!message?.text) return;

  const chatId = message.chat.id;
  const parsed = await parseMessage(message.text, deps.aiParse);

  switch (parsed.action) {
    case 'add': {
      const added = await items.addItems(deps.db, parsed.items, chatId);
      await deps.sendMessage(chatId, added.length > 0 ? `נוסף: ${added.join(', ')}` : 'כבר ברשימה');
      break;
    }
    case 'remove': {
      const removed = await items.removeItems(deps.db, parsed.items);
      await deps.sendMessage(chatId, removed.length > 0 ? `הוסר: ${removed.join(', ')}` : 'לא נמצא ברשימה');
      break;
    }
    case 'show': {
      const current = await items.listItems(deps.db);
      await deps.sendMessage(
        chatId,
        current.length > 0 ? current.map((i) => `• ${i.name}`).join('\n') : 'הרשימה ריקה'
      );
      break;
    }
    case 'at_store': {
      const trip = await trips.getOrCreateActiveTrip(deps.db, chatId);
      await deps.sendMessage(chatId, `בהצלחה בסופר! 🛒\n${deps.pagesBaseUrl}/trip.html?id=${trip.id}`);
      break;
    }
    case 'unclear': {
      await deps.sendMessage(chatId, 'לא הבנתי, אפשר לנסח אחרת?');
      break;
    }
  }
}
