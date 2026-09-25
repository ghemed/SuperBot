// functions/src/parser/listOrder.ts
// The web app keeps its own copy of these sections and this grouping in
// web/js/list-order.js (it is a no-build static site, and only functions/ is
// deployed with the bot). web/js/list-order.test.js fails if the two drift
// apart, so a change here must be made there too.
import { iconFor, FALLBACK_ICON } from './productIcons';

export interface Category {
  id: string;
  // shown for a product the icon dictionary doesn't know but that was put in this section by hand
  icon: string;
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
// comes from its icon, unless it was put in a section by hand (see
// categoryKey below).
export const CATEGORIES: Category[] = [
  { id: "produce", icon: "🥬", label: "ירקות ופירות", icons: [
    "🍅", "🥒", "🥕", "🧅", "🧄", "🥔", "🍠", "🥬", "🥦", "🫑", "🌶️", "🍆", "🍄", "🌽", "🎃", "🥑", "🍋", "🌿",
    "🍎", "🍊", "🍌", "🍇", "🍉", "🍈", "🍓", "🍑", "🍐", "🍒", "🥭", "🍍", "🥝", "🫐",
  ] },
  { id: "dairy", icon: "🥛", label: "מוצרי חלב וביצים", icons: ["🥛", "🍮", "🧀", "🥚"] },
  { id: "bakery", icon: "🍞", label: "לחם ומאפים", icons: ["🍞", "🫓", "🥖", "🥐", "🥯", "🍰", "🍪"] },
  { id: "meat", icon: "🥩", label: "בשר, עוף ודגים", icons: ["🥩", "🍗", "🌭", "🥓", "🐟", "🦐", "🍔", "🍕", "🍣", "🧆", "🌯"] },
  { id: "pantry", icon: "🥫", label: "מזווה", icons: ["🍝", "🍜", "🍚", "🌾", "🥣", "🛢️", "🫒", "🥫", "🧂", "🍯", "☕", "🍵"] },
  { id: "snacks", icon: "🍫", label: "חטיפים ומתוקים", icons: ["🍬", "🍫", "🍿", "🥜", "🌻", "🍟"] },
  { id: "drinks", icon: "🥤", label: "שתייה", icons: ["💧", "🥤", "🧃", "🍺", "🍷", "🥃"] },
  { id: "frozen", icon: "🧊", label: "קפואים", icons: ["🍨", "🍦", "🧊"] },
  { id: "household", icon: "🧴", label: "ניקיון, טיפוח ובית", icons: [
    "🧼", "🧺", "🧴", "🧽", "🧻", "🗑️", "🛍️", "🕯️", "🔋", "💡", "🪥", "🪒", "💊", "🩹", "👶", "🐶", "🐱",
  ] },
  { id: "other", icon: FALLBACK_ICON, label: "שונות", icons: [FALLBACK_ICON] },
];

const OTHER = CATEGORIES[CATEGORIES.length - 1];

const CATEGORY_BY_ICON = new Map(
  CATEGORIES.flatMap((category) => category.icons.map((icon) => [icon, category] as const))
);

// A section chosen by hand, keyed by categoryKey(name) -> category id.
export type CategoryOverrides = ReadonlyMap<string, string>;

const NO_OVERRIDES: CategoryOverrides = new Map();

// The form of a name that a hand-picked section is stored under, so "עלי גפן"
// and " עלי  גפן" share one choice. Same rule as normalizeItemName.
export function categoryKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function categoryOf(name: string, overrides: CategoryOverrides = NO_OVERRIDES): Category {
  const chosen = CATEGORIES.find((category) => category.id === overrides.get(categoryKey(name)));
  return chosen ?? CATEGORY_BY_ICON.get(iconFor(name)) ?? OTHER;
}

// The product's own icon, or, when the dictionary doesn't know it but it was
// put in a section by hand, that section's icon instead of the cart.
export function displayIcon(name: string, overrides: CategoryOverrides = NO_OVERRIDES): string {
  const icon = iconFor(name);
  return icon === FALLBACK_ICON ? categoryOf(name, overrides).icon : icon;
}

// Every section still to buy, in store order, then everything already ticked
// in one group at the bottom. Items keep their incoming (addedAt) order
// within a group.
export function groupItems<T extends ListItem>(items: T[], overrides: CategoryOverrides = NO_OVERRIDES): Group<T>[] {
  const toBuy = new Map<string, T[]>(CATEGORIES.map((category) => [category.id, []]));
  const ticked: T[] = [];
  for (const item of items) {
    if (item.checked === true) ticked.push(item);
    else toBuy.get(categoryOf(item.name, overrides).id)!.push(item);
  }
  const rank = (item: T) => CATEGORIES.indexOf(categoryOf(item.name, overrides));
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
export function formatList(items: ListItem[], overrides: CategoryOverrides = NO_OVERRIDES): string {
  return groupItems(items, overrides)
    .map((group) => [
      group.label,
      ...group.items.map((item) => `• ${displayIcon(item.name, overrides)} ${item.name}`),
    ].join('\n'))
    .join('\n\n');
}
