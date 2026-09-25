// web/js/list-order.js
// The bot keeps its own copy of CATEGORIES, categoryOf and groupItems in
// functions/src/parser/listOrder.ts, so its "show the list" reply is grouped
// the same way. list-order.test.js fails if the two drift apart.
import { iconFor, FALLBACK_ICON } from "./product-icons.js";

// Store sections in the order the aisles are walked. Produce is first because
// it is at the entrance of the store we usually shop at; reorder this array to
// match a different store. A product's section comes from its icon, so the
// icon dictionary in product-icons.js is the only list of products to maintain.
export const CATEGORIES = [
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
  CATEGORIES.flatMap((category) => category.icons.map((icon) => [icon, category]))
);

export function categoryOf(name) {
  return CATEGORY_BY_ICON.get(iconFor(name)) ?? OTHER;
}

// Groups the items for display: every section still to buy, in store order,
// and then everything already ticked in one group at the bottom, so what is
// left to buy is always at the top. Within a group items keep the order they
// arrive in (by addedAt), so a row only moves when it is ticked, unticked or
// renamed into another section.
export function groupItems(items) {
  const toBuy = new Map(CATEGORIES.map((category) => [category.id, []]));
  const ticked = [];
  for (const item of items) {
    if (item.checked === true) ticked.push(item);
    else toBuy.get(categoryOf(item.name).id).push(item);
  }
  const rank = (item) => CATEGORIES.indexOf(categoryOf(item.name));
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
