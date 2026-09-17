// functions/src/telegram/sendMessage.ts
export type SendTelegramMessage = (chatId: number, text: string) => Promise<void>;

export function createTelegramSender(botToken: string): SendTelegramMessage {
  return async (chatId, text) => {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!res.ok) {
      throw new Error(`Telegram sendMessage failed: ${res.status} ${await res.text()}`);
    }
  };
}
