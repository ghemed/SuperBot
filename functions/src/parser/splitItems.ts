// functions/src/parser/splitItems.ts
// Splits on commas/newlines, and on a Hebrew vav-conjunction ("ו", "and")
// that joins two items across a space (e.g. "ביצים ולחם" -> "ביצים", "לחם").
// A double vav ("וו") is how Hebrew loanwords spell an initial "w" sound
// (e.g. וופלים/waffles), so a lone vav immediately followed by another vav is
// never treated as "ו" + a word starting with vav (e.g. ורד/rose) - both
// start with a single ו, so that ambiguity is inherent and left to the AI
// fallback in parseMessage. When a double-vav loanword instead follows a
// plain space with no real conjunction (e.g. "חלב וופלים"), the space still
// separates the two items, but the leading וו is kept intact rather than
// stripped.
const ITEM_SEPARATOR = /\s+ו(?=[א-הז-ת])|\s+(?=וו)/;

export function splitItems(text: string): string[] {
  return text
    .split(/[,\n]/)
    .flatMap((chunk) => chunk.split(ITEM_SEPARATOR))
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
