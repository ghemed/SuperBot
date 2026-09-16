// functions/src/parser/claudeParser.ts
export interface AiParsedMessage {
  action: 'add' | 'remove' | 'show' | 'at_store' | 'unclear';
  items: string[];
}

type ClaudeContentBlock = { type: string; text?: string };
type ClaudeResponse = { content: ClaudeContentBlock[] };
export type ClaudeMessagesCreate = (args: {
  model: string;
  max_tokens: number;
  system: string;
  messages: { role: 'user'; content: string }[];
}) => Promise<ClaudeResponse>;

const VALID_ACTIONS = ['add', 'remove', 'show', 'at_store', 'unclear'];

const SYSTEM_PROMPT = `את/ה מפענח/ת הודעות לבוט רשימת קניות בעברית.
קבע/י פעולה אחת: add (הוספת פריטים), remove (הסרת פריטים), show (בקשה לראות
את הרשימה), at_store (הודעה שהמשתמש/ת בסופר עכשיו), או unclear (לא ברור).
החזר/י אך ורק JSON תקין בפורמט:
{"action":"add"|"remove"|"show"|"at_store"|"unclear","items":["פריט1","פריט2"]}
עבור show/at_store/unclear החזר/י items כמערך ריק.`;

export function createClaudeParser(createMessage: ClaudeMessagesCreate) {
  return async function aiParse(text: string): Promise<AiParsedMessage> {
    const response = await createMessage({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: text }],
    });

    const block = response.content[0];
    if (!block || block.type !== 'text' || !block.text) {
      return { action: 'unclear', items: [] };
    }

    try {
      const parsed = JSON.parse(block.text);
      if (
        typeof parsed.action === 'string' &&
        VALID_ACTIONS.includes(parsed.action) &&
        Array.isArray(parsed.items)
      ) {
        return parsed as AiParsedMessage;
      }
    } catch {
      // falls through to unclear below
    }
    return { action: 'unclear', items: [] };
  };
}
