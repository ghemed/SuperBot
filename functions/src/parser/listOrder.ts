// functions/src/parser/listOrder.ts
// The web app keeps its own copy of these sections and this grouping in
// web/js/list-order.js (it is a no-build static site, and only functions/ is
// deployed with the bot). web/js/list-order.test.js fails if the two drift
// apart, so a change here must be made there too.
import { iconFor, withIcon, FALLBACK_ICON } from './productIcons';

export interface Category {
  id: string;
  label: string;
  icons: string[];
}

export interface ListItem {
  name: string;
  checked?: boolean;
}

export interface Group<T extends ListItem> {
  id: string;
  label: string;
  items: T[];
}

// Store sections in the order the aisles are walked. Produce is first because
// it is at the entrance of the store we usually shop at. A product's section
// comes from its icon, so the icon dictionary is the only product list.
export const CATEGORIES: Category[] = [
  { id: "produce", label: "ירקות ופירות", icons: [
    "🍅", "🥒", "🥕", "🧅", "🧄", "🥔", "🍠", "🥬", "🥦", "🫑", "🌶️", "🍆", "🍄", "🌽", "🎃", "🥑", "🍋", "🌿",
    "🍎", "🍊", "🍌", "🍇", "🍉", "🍈", "🍓", "🍑", "🍐", "🍒", "🥭", "🍍", "🥝", "🫐",
  ] },
  { id: "dairy", label: "מוצרי חלב וביצים", icons: ["🥛", "🍮", "🧀", "🥚"] },
  { id: "bakery", label: "לחם ומאפים", icons: ["🍞", "🫓", "🥖", "🥐", "🥯", "🍰", "🍪"] },
  { id: "meat", label: "בשר, עוף ודגים", icons: ["🥩", "🍗", "🌭", "🥓", "🐟", "🦐", "🍔", "🍕", "🍣", "🧆", "🌯"] },
  { id: "pantry", label: "מזווה", icons: ["🍝", "🍜", "🍚", "🌾", "🥣", "🛢️", "🫒", "🥫", "🧂", "🍯", "☕", "🍵"] },
  { id: "snacks", label: "חטיפים ומתוקים", icons: ["🍬", "🍫", "🍿", "🥜", "🌻", "🍟"] },
  { id: "drinks", label: "שתייה", icons: ["💧", "🥤", "🧃", "🍺", "🍷", "🥃"] },
  { id: "frozen", label: "קפואים", icons: ["🍨", "🍦", "🧊"] },
  { id: "household", label: "ניקיון, טיפוח ובית", icons: [
    "🧼", "🧺", "🧴", "🧽", "🧻", "🗑️", "🛍️", "🕯️", "🔋", "💡", "🪥", "🪒", "💊", "🩹", "👶", "🐶", "🐱",
  ] },
  { id: "other", label: "שונות", icons: [FALLBACK_ICON] },
];

const OTHER = CATEGORIES[CATEGORIES.length - 1];

const CATEGORY_BY_ICON = new Map(
  CATEGORIES.flatMap((category) => category.icons.map((icon) => [icon, category] as const))
);

export function categoryOf(name: string): Category {
  return CATEGORY_BY_ICON.get(iconFor(name)) ?? OTHER;
}

// Every section still to buy, in store order, then everything already ticked
// in one group at the bottom. Items keep their incoming (addedAt) order
// within a group.
export function groupItems<T extends ListItem>(items: T[]): Group<T>[] {
  const toBuy = new Map<string, T[]>(CATEGORIES.map((category) => [category.id, []]));
  const ticked: T[] = [];
  for (const item of items) {
    if (item.checked === true) ticked.push(item);
    else toBuy.get(categoryOf(item.name).id)!.push(item);
  }
  const rank = (item: T) => CATEGORIES.indexOf(categoryOf(item.name));
  // Array.prototype.sort is stable, so equal ranks keep their addedAt order.
  ticked.sort((a, b) => rank(a) - rank(b));

  const groups: Group<T>[] = CATEGORIES
    .filter((category) => toBuy.get(category.id)!.length > 0)
    .map((category) => ({ id: category.id, label: category.label, items: toBuy.get(category.id)! }));
  if (ticked.length > 0) groups.push({ id: "ticked", label: "בעגלה", items: ticked });
  return groups;
}

// The list as the bot sends it: a heading per section, one bulleted line per
// item, and a blank line between sections.
export function formatList(items: ListItem[]): string {
  return groupItems(items)
    .map((group) => [group.label, ...group.items.map((item) => `• ${withIcon(item.name)}`)].join('\n'))
    .join('\n\n');
}
