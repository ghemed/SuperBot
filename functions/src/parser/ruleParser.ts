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
// A removal keyword with nothing to remove (e.g. just "מחק", possibly
// followed by the bare object marker "את") is ambiguous, not an add of the
// keyword itself - defer to the AI fallback rather than guessing.
// Known accepted gap: a keyword directly followed by punctuation with no
// item (e.g. "מחק!") isn't caught here and falls through to being added as
// a literal item - low-probability, self-evidently wrong if it ever
// happens, and easy to delete from the list, so not worth the added
// complexity of a punctuation-stripping check.
const BARE_REMOVE_PATTERN = /^(?:תוריד|הורד|הסר|מחק|תסיר)(?:\s+את)?\s*$/u;

export function parseRuleBased(message: string): RuleParseResult | null {
  const trimmed = message.trim();
  if (trimmed.length === 0) return null;

  // Checked before REMOVE_PATTERN, and against the whole message: since
  // REMOVE_PATTERN's capture now spans newlines (see the dotAll comment
  // above), a removal keyword earlier in the message would otherwise let a
  // question or ambiguous phrase on a later line get swallowed in as a
  // literal item instead of deferring to the AI fallback.
  if (AMBIGUOUS_START_PATTERN.test(trimmed)) {
    return null;
  }

  if (BARE_REMOVE_PATTERN.test(trimmed)) {
    return null;
  }

  const removeMatch = trimmed.match(REMOVE_PATTERN);
  if (removeMatch) {
    const items = splitItems(removeMatch[1]);
    return items.length > 0 ? { action: 'remove', items } : null;
  }

  const items = splitItems(trimmed);
  return items.length > 0 ? { action: 'add', items } : null;
}
