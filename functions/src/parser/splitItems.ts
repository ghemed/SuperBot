// functions/src/parser/splitItems.ts
// A word boundary splits either on a single vav directly followed by a
// non-vav Hebrew letter (the conjunction "ו", "and" - consumed, so "ולחם"
// becomes "לחם"), or on whitespace directly before a double vav ("וו",
// consumed only up to the space) - Hebrew loanwords spell an initial "w"
// sound with a double vav (e.g. וופלים/waffles), and that must not be
// mistaken for "ו" + a word starting with vav (e.g. ורד/rose).
// Known accepted limitation: that single-vav case is genuinely ambiguous
// and NOT caught by the AI fallback - parseRuleBased (which calls this
// function) returns a confident, non-null result either way, so
// parseMessage never falls back to AI for it. A single-vav item name
// (e.g. "ורד"/rose) typed after another item will have its vav silently
// stripped as if it were the conjunction. Accepted as low-probability for
// a grocery list; revisit if it ever causes a real mis-parse.
const ITEM_SEPARATOR = /\s+ו(?=[א-הז-ת])|\s+(?=וו)/;

export function splitItems(text: string): string[] {
  return text
    .split(/[,\n]/)
    .flatMap((chunk) => chunk.split(ITEM_SEPARATOR))
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
