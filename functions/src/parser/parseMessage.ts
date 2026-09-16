// functions/src/parser/parseMessage.ts
import { parseRuleBased } from './ruleParser';

export type Action = 'add' | 'remove' | 'show' | 'at_store' | 'unclear';

export interface ParsedMessage {
  action: Action;
  items: string[];
}

export type AiParse = (text: string) => Promise<ParsedMessage>;

const SHOW_LIST_PATTERNS = [/^הצג\s+רשימה$/u, /^מה\s+יש\s+ברשימה\??$/u, /^רשימה$/u];
const AT_STORE_PATTERNS = [/^אני\s+בסופר$/u, /^בסופר$/u, /^הגעתי\s+לסופר$/u];

export async function parseMessage(text: string, aiParse: AiParse): Promise<ParsedMessage> {
  const trimmed = text.trim();
  // Trailing punctuation ("אני בסופר.", "הצג רשימה!") shouldn't stop a
  // special phrase from matching. Only used for this check - the original
  // `trimmed` (not this stripped version) is what flows into the rule
  // engine and AI fallback below, so a real item name's own punctuation is
  // never touched.
  const forPhraseMatch = trimmed.replace(/[.!]+$/u, '').trim();

  if (SHOW_LIST_PATTERNS.some((p) => p.test(forPhraseMatch))) {
    return { action: 'show', items: [] };
  }
  if (AT_STORE_PATTERNS.some((p) => p.test(forPhraseMatch))) {
    return { action: 'at_store', items: [] };
  }

  const ruleResult = parseRuleBased(trimmed);
  if (ruleResult) {
    return ruleResult;
  }

  return aiParse(trimmed);
}
