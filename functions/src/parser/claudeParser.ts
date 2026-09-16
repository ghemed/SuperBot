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
  temperature: number;
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

const ACTIONS_REQUIRING_ITEMS = new Set(['add', 'remove']);

export function createClaudeParser(createMessage: ClaudeMessagesCreate) {
  return async function aiParse(text: string): Promise<AiParsedMessage> {
    let response: ClaudeResponse;
    try {
      response = await createMessage({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: text }],
      });
    } catch {
      // The Anthropic API is an external dependency that can reject for
      // routine reasons (rate limit, timeout, transient 5xx) - that's the
      // most likely "unexpected response" in production, not a corner case,
      // so it degrades the same way a malformed response does below.
      return { action: 'unclear', items: [] };
    }

    const block = response.content[0];
    if (!block || block.type !== 'text' || !block.text) {
      return { action: 'unclear', items: [] };
    }

    try {
      const parsed = JSON.parse(block.text);
      const hasValidItems =
        Array.isArray(parsed.items) &&
        parsed.items.every(
          (item: unknown) => typeof item === 'string' && item.trim().length > 0
        );
      // add/remove with an empty items array isn't a confident answer - the
      // model extracted nothing, so a caller reacting to e.g. "already on
      // the list" for an empty add would be actively misleading.
      const satisfiesItemRequirement =
        !ACTIONS_REQUIRING_ITEMS.has(parsed.action) || parsed.items?.length > 0;

      if (
        typeof parsed.action === 'string' &&
        VALID_ACTIONS.includes(parsed.action) &&
        hasValidItems &&
        satisfiesItemRequirement
      ) {
        return parsed as AiParsedMessage;
      }
    } catch {
      // falls through to unclear below
    }
    return { action: 'unclear', items: [] };
  };
}
