// functions/src/parser/normalize.ts
export function normalizeItemName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}
