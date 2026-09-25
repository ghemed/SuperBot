// web/js/list-order.js
// The bot keeps its own copy of CATEGORIES, categoryKey, categoryOf,
// displayIcon and groupItems in
// functions/src/parser/listOrder.ts, so its "show the list" reply is grouped
// the same way. list-order.test.js fails if the two drift apart.
import { iconFor, FALLBACK_ICON } from "./product-icons.js";

// Store sections in the order the aisles are walked. Produce is first because
// it is at the entrance of the store we usually shop at; reorder this array to
// match a different store. A product's section comes from its icon (the icon
// dictionary in product-icons.js), unless it was put in a section by hand from
// the list page - those choices are passed in as `overrides`, a Map from
// categoryKey(name) to a category id. `icon` is what a product the dictionary
// doesn't know shows once it has been put in that section by hand.
export const CATEGORIES = [
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
  CATEGORIES.flatMap((category) => category.icons.map((icon) => [icon, category]))
);

const NO_OVERRIDES = new Map();

// The form of a name that a hand-picked section is stored under, so "עלי גפן"
// and " עלי  גפן" share one choice. Same rule as the bot's normalizeItemName.
export function categoryKey(name) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function categoryOf(name, overrides = NO_OVERRIDES) {
  const chosen = CATEGORIES.find((category) => category.id === overrides.get(categoryKey(name)));
  return chosen ?? CATEGORY_BY_ICON.get(iconFor(name)) ?? OTHER;
}

// The product's own icon, or, when the dictionary doesn't know it but it was
// put in a section by hand, that section's icon instead of the cart.
export function displayIcon(name, overrides = NO_OVERRIDES) {
  const icon = iconFor(name);
  return icon === FALLBACK_ICON ? categoryOf(name, overrides).icon : icon;
}

// Groups the items for display: every section still to buy, in store order,
// and then everything already ticked in one group at the bottom, so what is
// left to buy is always at the top. Within a group items keep the order they
// arrive in (by addedAt), so a row only moves when it is ticked, unticked or
// renamed into another section.
export function groupItems(items, overrides = NO_OVERRIDES) {
  const toBuy = new Map(CATEGORIES.map((category) => [category.id, []]));
  const ticked = [];
  for (const item of items) {
    if (item.checked === true) ticked.push(item);
    else toBuy.get(categoryOf(item.name, overrides).id).push(item);
  }
  const rank = (item) => CATEGORIES.indexOf(categoryOf(item.name, overrides));
  // Array.prototype.sort is stable, so equal ranks keep their addedAt order.
  ticked.sort((a, b) => rank(a) - rank(b));

  const groups = CATEGORIES
    .filter((category) => toBuy.get(category.id).length > 0)
    .map((category) => ({ id: category.id, label: category.label, items: toBuy.get(category.id) }));
  if (ticked.length > 0) groups.push({ id: "ticked", label: "בעגלה", items: ticked });
  return groups;
}

// Indexes (into `sequence`) of one longest strictly increasing subsequence.
// The list page uses it to find the largest set of rows already in the right
// relative order, so only the other rows get moved in the DOM.
export function longestIncreasingSubsequence(sequence) {
  const tails = []; // tails[k]: index of the smallest tail of an increasing run of length k+1
  const previous = new Array(sequence.length);
  for (let i = 0; i < sequence.length; i++) {
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (sequence[tails[mid]] < sequence[i]) low = mid + 1;
      else high = mid;
    }
    previous[i] = low > 0 ? tails[low - 1] : -1;
    tails[low] = i;
  }
  const result = [];
  for (let i = tails.length > 0 ? tails[tails.length - 1] : -1; i !== -1; i = previous[i]) result.push(i);
  return result.reverse();
}
