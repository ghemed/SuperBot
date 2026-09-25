// functions/src/bot/handleUpdate.ts
import type { Firestore } from 'firebase-admin/firestore';
import { parseMessage, type AiParse } from '../parser/parseMessage';
import type { SendTelegramMessage } from '../telegram/sendMessage';
import type { TelegramUpdate } from '../telegram/types';
import * as items from '../firestore/items';
import { isHouseholdMember } from '../firestore/household';
import { withIcon } from '../parser/productIcons';
import { formatList } from '../parser/listOrder';

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

  // Stay silent for anyone outside the household allowlist - the webhook
  // itself is protected by the secret token, and Firestore access is
  // protected by firestore.rules, but neither of those stops a stranger
  // who finds the bot's Telegram username from messaging it directly.
  // Replying at all would confirm to them that this is a live bot worth
  // probing further, so an unrecognized chat gets no response at all.
  if (!(await isHouseholdMember(deps.db, chatId))) return;

  const parsed = await parseMessage(message.text, deps.aiParse);

  switch (parsed.action) {
    case 'add': {
      const added = await items.addItems(deps.db, parsed.items, chatId);
      await deps.sendMessage(
        chatId,
        added.length > 0 ? `נוסף: ${added.map(withIcon).join(', ')}` : 'כבר ברשימה'
      );
      break;
    }
    case 'remove': {
      const removed = await items.removeItems(deps.db, parsed.items);
      await deps.sendMessage(
        chatId,
        removed.length > 0 ? `הוסר: ${removed.map(withIcon).join(', ')}` : 'לא נמצא ברשימה'
      );
      break;
    }
    case 'show': {
      const current = await items.listItems(deps.db);
      await deps.sendMessage(
        chatId,
        current.length > 0 ? formatList(current) : 'הרשימה ריקה'
      );
      break;
    }
    case 'at_store': {
      await deps.sendMessage(chatId, `בהצלחה בסופר! 🛒\n${deps.pagesBaseUrl}/`);
      break;
    }
    case 'unclear': {
      await deps.sendMessage(chatId, 'לא הבנתי, אפשר לנסח אחרת?');
      break;
    }
  }
}
