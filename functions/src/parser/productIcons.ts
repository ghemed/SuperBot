// functions/src/parser/productIcons.ts
// The web app keeps its own copy of this dictionary and matcher in
// web/js/product-icons.js (it is a no-build static site, and only functions/
// is deployed with the bot). web/js/product-icons.test.js fails if the two
// drift apart, so a product added here must be added there too.
export const FALLBACK_ICON = '🛒';

// Singular forms plus irregular plurals and construct forms (עוגת, גבינת).
// Regular plurals (-ים, -ות) are handled by forms() below.
export const PRODUCT_ICONS: Record<string, string> = {
  // vegetables
  "עגבניה": "🍅", "עגבנייה": "🍅",
  "מלפפון": "🥒", "קישוא": "🥒",
  "גזר": "🥕",
  "בצל": "🧅",
  "שום": "🧄",
  "תפוח אדמה": "🥔", "תפוחי אדמה": "🥔",
  "בטטה": "🍠",
  "חסה": "🥬", "כרוב": "🥬", "תרד": "🥬", "סלרי": "🥬", "קייל": "🥬", "רוקט": "🥬", "ירק": "🥬",
  "ברוקולי": "🥦", "כרובית": "🥦",
  "פלפל": "🫑", "גמבה": "🫑",
  "פלפל חריף": "🌶️", "צ'ילי": "🌶️", "פפריקה": "🌶️",
  "חציל": "🍆",
  "פטריה": "🍄", "פטרייה": "🍄", "שמפיניון": "🍄",
  "תירס": "🌽",
  "דלעת": "🎃", "דלורית": "🎃",
  "אבוקדו": "🥑",
  "לימון": "🍋",
  "זית": "🫒",
  "פטרוזיליה": "🌿", "כוסברה": "🌿", "נענע": "🌿", "שמיר": "🌿", "בזיליקום": "🌿", "עירית": "🌿", "רוזמרין": "🌿", "תימין": "🌿", "עשבי תיבול": "🌿",

  // fruit
  "תפוח": "🍎", "פרי": "🍎", "פירות": "🍎",
  "תפוז": "🍊", "קלמנטינה": "🍊", "מנדרינה": "🍊", "אשכולית": "🍊", "פומלה": "🍊",
  "בננה": "🍌",
  "ענב": "🍇", "צימוקים": "🍇",
  "אבטיח": "🍉",
  "מלון": "🍈",
  "תות": "🍓", "ריבה": "🍓",
  "אפרסק": "🍑", "נקטרינה": "🍑", "שזיף": "🍑", "משמש": "🍑",
  "אגס": "🍐",
  "דובדבן": "🍒",
  "מנגו": "🥭",
  "אננס": "🍍",
  "קיווי": "🥝",
  "אוכמניה": "🫐", "אוכמנית": "🫐",

  // dairy and eggs
  "חלב": "🥛", "שוקו": "🥛", "חמאה": "🥛", "שמנת": "🥛", "יוגורט": "🥛", "לבן": "🥛", "קוטג'": "🥛", "קוטג": "🥛", "מעדן": "🥛", "מוצרי חלב": "🥛",
  "מילקי": "🍮",
  "גבינה": "🧀", "גבינת": "🧀", "לבנה": "🧀", "מוצרלה": "🧀", "פרמזן": "🧀", "פטה": "🧀", "בולגרית": "🧀", "קממבר": "🧀", "ריקוטה": "🧀",
  "ביצה": "🥚",

  // bread, pastry, grains
  "לחם": "🍞", "לחמניה": "🍞", "חלה": "🍞", "טוסט": "🍞",
  "פיתה": "🫓", "לאפה": "🫓", "טורטיה": "🫓",
  "בגט": "🥖", "באגט": "🥖",
  "קרואסון": "🥐", "בורקס": "🥐",
  "בייגל": "🥯", "בייגלה": "🥯",
  "עוגה": "🍰", "עוגת": "🍰", "מאפה": "🍰",
  "עוגיה": "🍪", "עוגייה": "🍪", "עוגיית": "🍪", "ביסקוויט": "🍪",
  "פסטה": "🍝", "ספגטי": "🍝", "אטריות": "🍜",
  "אורז": "🍚", "קוסקוס": "🍚", "בורגול": "🍚", "קינואה": "🍚", "פתיתים": "🍚",
  "קמח": "🌾",
  "שיבולת שועל": "🥣", "קורנפלקס": "🥣", "גרנולה": "🥣", "דגנים": "🥣", "דגני בוקר": "🥣",

  // meat, fish, ready food
  "בשר": "🥩", "סטייק": "🥩", "אנטריקוט": "🥩", "קבב": "🥩", "כבד": "🥩", "טחון": "🥩", "בקר": "🥩", "כבש": "🥩",
  "עוף": "🍗", "חזה": "🍗", "שוקיים": "🍗", "כנפיים": "🍗", "שניצל": "🍗", "פרגית": "🍗", "הודו": "🍗",
  "נקניק": "🌭", "נקניקיה": "🌭",
  "בייקון": "🥓", "פסטרמה": "🥓",
  "דג": "🐟", "סלמון": "🐟", "טונה": "🐟", "טילפיה": "🐟", "אמנון": "🐟", "דניס": "🐟", "לברק": "🐟",
  "שרימפס": "🦐", "סרטן": "🦐",
  "המבורגר": "🍔",
  "פיצה": "🍕", "סושי": "🍣", "פלאפל": "🧆", "שווארמה": "🌯",

  // pantry and snacks
  "שמן": "🛢️", "שמן זית": "🫒",
  "רוטב": "🥫", "רטבים": "🥫", "קטשופ": "🥫", "מיונז": "🥫", "חרדל": "🥫", "סויה": "🥫", "שימורים": "🥫", "שימורי": "🥫",
  "חומוס": "🥣", "טחינה": "🥣",
  "מלח": "🧂", "פלפל שחור": "🧂", "תבלין": "🧂", "קינמון": "🧂", "כמון": "🧂",
  "סוכר": "🍬", "ממתק": "🍬", "סוכריה": "🍬", "מסטיק": "🍬", "מרשמלו": "🍬",
  "דבש": "🍯",
  "שוקולד": "🍫", "נוטלה": "🍫",
  "קפה": "☕", "קפסולה": "☕", "נס": "☕",
  "תה": "🍵",
  "חטיף": "🍿", "פופקורן": "🍿", "ביסלי": "🍿",
  "במבה": "🥜", "שקד": "🥜", "אגוז": "🥜", "אגוזי מלך": "🥜", "בוטן": "🥜", "חמאת בוטנים": "🥜", "פיסטוק": "🥜", "קשיו": "🥜", "פקאן": "🥜",
  "גרעינים": "🌻",
  "צ'יפס": "🍟", "תפוצ'יפס": "🍟",
  "גלידה": "🍨", "ארטיק": "🍦", "קרטיב": "🍦",

  // drinks
  "מים": "💧",
  "סודה": "🥤", "קולה": "🥤", "פפסי": "🥤", "ספרייט": "🥤", "פאנטה": "🥤", "משקה": "🥤", "משקאות": "🥤", "שתייה": "🥤", "שתיה": "🥤",
  "מיץ": "🧃",
  "בירה": "🍺",
  "יין": "🍷",
  "וודקה": "🥃", "ויסקי": "🥃", "ערק": "🥃", "אלכוהול": "🥃",
  "קרח": "🧊",

  // cleaning and household
  "סבון": "🧼", "נוזל כלים": "🧼",
  "אבקת כביסה": "🧺", "נוזל כביסה": "🧺", "מרכך כביסה": "🧺", "כביסה": "🧺",
  "אקונומיקה": "🧴", "חומר ניקוי": "🧴", "חומרי ניקוי": "🧴", "מנקה": "🧴",
  "ספוג": "🧽", "מטלית": "🧽",
  "נייר טואלט": "🧻", "נייר סופג": "🧻", "מגבות נייר": "🧻", "טישו": "🧻", "מפית": "🧻", "מגבון": "🧻",
  "שקיות זבל": "🗑️", "שקית": "🛍️",
  "נר": "🕯️", "סוללה": "🔋", "נורה": "💡",

  // hygiene, health, baby, pets
  "שמפו": "🧴", "מרכך": "🧴", "קרם": "🧴", "דאודורנט": "🧴",
  "משחת שיניים": "🪥", "מברשת שיניים": "🪥",
  "מכונת גילוח": "🪒", "גילוח": "🪒",
  "ויטמין": "💊", "תרופה": "💊", "אקמול": "💊", "נורופן": "💊",
  "פלסטר": "🩹",
  "חיתול": "👶", "מטרנה": "👶",
  "כלב": "🐶", "לכלב": "🐶", "חתול": "🐱", "לחתול": "🐱",
};

const FINAL_FORM: Record<string, string> = { כ: 'ך', מ: 'ם', נ: 'ן', פ: 'ף', צ: 'ץ' };

// A word's last letter takes its final form only at the end of a word, so a
// plural stem (מלפפונ-ים) needs it restored to match the singular (מלפפון).
function withFinalLetter(stem: string): string {
  const last = stem.slice(-1);
  return Object.prototype.hasOwnProperty.call(FINAL_FORM, last)
    ? stem.slice(0, -1) + FINAL_FORM[last]
    : stem;
}

// Candidate singular forms of a possibly-plural word, most literal first.
function forms(word: string): string[] {
  if (word.length > 3 && word.endsWith('ים')) {
    const stem = word.slice(0, -2);
    return [word, withFinalLetter(stem), stem + 'ה'];
  }
  if (word.length > 3 && word.endsWith('ות')) {
    const stem = word.slice(0, -2);
    return [word, stem + 'ה', stem + 'ת', withFinalLetter(stem)];
  }
  return [word];
}

// Item names are free text, so "constructor" or "toString" must not resolve
// to an inherited Object property.
function lookup(key: string): string | undefined {
  return Object.prototype.hasOwnProperty.call(PRODUCT_ICONS, key) ? PRODUCT_ICONS[key] : undefined;
}

const MAX_PHRASE_WORDS = Math.max(...Object.keys(PRODUCT_ICONS).map((key) => key.split(' ').length));

function words(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[׳’‘]/g, "'")
    .replace(/[^\p{L}\p{N}' ]+/gu, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0);
}

// Scans left to right and, at each position, tries the longest phrase first,
// so "תפוחי אדמה" is a potato rather than an apple and "שמן זית" is olive oil.
export function iconFor(name: string): string {
  const tokens = words(name);
  for (let start = 0; start < tokens.length; start++) {
    const longest = Math.min(MAX_PHRASE_WORDS, tokens.length - start);
    for (let length = longest; length >= 1; length--) {
      const prefix = tokens.slice(start, start + length - 1);
      const last = tokens[start + length - 1];
      for (const form of forms(last)) {
        const icon = lookup([...prefix, form].join(' '));
        if (icon) return icon;
      }
    }
  }
  return FALLBACK_ICON;
}

export function withIcon(name: string): string {
  return `${iconFor(name)} ${name}`;
}
