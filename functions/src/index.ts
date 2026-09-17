// functions/src/index.ts
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import Anthropic from '@anthropic-ai/sdk';
import { handleUpdate } from './bot/handleUpdate';
import { createTelegramSender } from './telegram/sendMessage';
import { createClaudeParser } from './parser/claudeParser';

initializeApp();

const TELEGRAM_BOT_TOKEN = defineSecret('TELEGRAM_BOT_TOKEN');
const TELEGRAM_WEBHOOK_SECRET = defineSecret('TELEGRAM_WEBHOOK_SECRET');
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');
const PAGES_BASE_URL = process.env.PAGES_BASE_URL ?? 'https://example.github.io/superbot';

export const telegramWebhook = onRequest(
  { secrets: [TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, ANTHROPIC_API_KEY] },
  async (req, res) => {
    if (req.get('X-Telegram-Bot-Api-Secret-Token') !== TELEGRAM_WEBHOOK_SECRET.value()) {
      res.status(401).send('unauthorized');
      return;
    }

    const db = getFirestore();
    const sendMessage = createTelegramSender(TELEGRAM_BOT_TOKEN.value());
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });
    const aiParse = createClaudeParser((args) => anthropic.messages.create(args));

    try {
      await handleUpdate(req.body, { db, sendMessage, aiParse, pagesBaseUrl: PAGES_BASE_URL });
    } catch (error) {
      // Always acknowledge with 200 regardless of failure - Telegram
      // retries a non-2xx webhook response, and during a real outage
      // (Telegram API down, Firestore hiccup) a retry just re-runs the
      // same failing update rather than recovering anything - it can even
      // make things worse (e.g. a delayed reply arriving after a retry's
      // reply, out of order). Cloud Functions logs still capture `error`.
      console.error('handleUpdate failed', {
        chatId: req.body?.message?.chat?.id,
        text: req.body?.message?.text,
        error,
      });
    }
    res.status(200).send('ok');
  }
);
