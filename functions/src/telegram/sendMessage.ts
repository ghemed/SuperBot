// functions/src/telegram/sendMessage.ts
export type SendTelegramMessage = (chatId: number, text: string) => Promise<void>;

export function createTelegramSender(botToken: string): SendTelegramMessage {
  return async (chatId, text) => {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
      // A hung (not failing) connection would otherwise hold the Cloud
      // Function open until the platform's own timeout kills it with no
      // response sent at all - reintroducing the exact retry-storm risk
      // index.ts's always-200 catch exists to prevent, just via a path
      // that catch can't see.
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      throw new Error(`Telegram sendMessage failed: ${res.status} ${await res.text()}`);
    }
  };
}
