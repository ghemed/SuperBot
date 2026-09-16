// functions/src/parser/ruleParser.ts
import { splitItems } from './splitItems';

export interface RuleParseResult {
  action: 'add' | 'remove';
  items: string[];
}

// The `s` (dotAll) flag is required: without it, `.` can't cross a newline
// and `$` needs the true end of string, so a removal keyword followed by a
// multi-line message (an ordinary shift+enter on Telegram) fails to match
// at all - and silently falls through to being treated as an *add* of the
// keyword itself, rather than deferring or erroring.
const REMOVE_PATTERN = /^(?:תוריד|הורד|הסר|מחק|תסיר)\s+(?:את\s+)?(.+)$/su;
// \b is ASCII-only in JS regex (defined via \w) and never matches next to
// Hebrew letters, so a keyword boundary has to be spelled out as
// whitespace-or-end instead of \b.
const AMBIGUOUS_START_PATTERN = /[?]|^(?:אין|צריך|כדאי|נגמר)(?:\s|$)/u;

export function parseRuleBased(message: string): RuleParseResult | null {
  const trimmed = message.trim();
  if (trimmed.length === 0) return null;

  const removeMatch = trimmed.match(REMOVE_PATTERN);
  if (removeMatch) {
    const items = splitItems(removeMatch[1]);
    return items.length > 0 ? { action: 'remove', items } : null;
  }

  if (AMBIGUOUS_START_PATTERN.test(trimmed)) {
    return null;
  }

  const items = splitItems(trimmed);
  return items.length > 0 ? { action: 'add', items } : null;
}
