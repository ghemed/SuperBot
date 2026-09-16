// functions/src/parser/splitItems.ts
export function splitItems(text: string): string[] {
  return text
    .split(/[,\n]/)
    .flatMap((chunk) => chunk.split(/\s+ו(?=[א-ת])/))
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
