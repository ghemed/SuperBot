# One List View for Editing and Shopping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the separate trip page with one list page where every row has a checkbox, icon, editable name, "קבוע" tag and delete button, storing ticks on the items and writing a trip record only when shopping is finished.

**Architecture:** Ticks live on the item document (`checked: boolean`), so the existing live items listener syncs them between phones and no "active trip" exists any more. "סיימתי לקנות" runs one Firestore transaction that re-reads the ticked items, records a completed trip plus purchase history, keeps or deletes each item, and is safe to run twice. The pure decision logic of that transaction lives in its own tested module. The bot's "אני בסופר" just replies with the list link.

**Tech Stack:** Plain ES modules with no build step, Firebase JS SDK 10.14.1 from the gstatic CDN, Firestore, vitest (web: `npm test` at the repo root; bot: `functions/`, TypeScript with firebase-admin against the Firestore emulator).

**Spec:** `docs/superpowers/specs/2026-09-19-unified-list-view-design.md`

## Global Constraints

- Web app: plain ES modules, **no build step**, no new dependencies; Firebase SDK imported from `https://www.gstatic.com/firebasejs/10.14.1/...`.
- Item names and any other free text are written to the DOM only through `textContent` or an input's `value`, **never** `innerHTML` (XSS). `innerHTML` is allowed only for the fixed SVG strings.
- Ticks: `households/main/items/{id}.checked` is a boolean; a missing field means not ticked. No migration of existing items.
- Trip documents are written only at finish, with exactly `status: "completed"`, `completedAt`, `purchased: [{ itemId, name, price: null }]`, `recurringDecisions: [{ name, kept }]`. The history query and its Firestore index must keep working unchanged.
- Bot reply for "אני בסופר" is exactly `בהצלחה בסופר! 🛒` + a newline + `${pagesBaseUrl}/`, and creates nothing in Firestore.
- Exact Hebrew UI strings: `סיימתי לקנות`, `להישאר ברשימה?`, `עדכון הרשימה`, `חזרה`, `חזרה לרשימה`, `הרשימה עודכנה`, `הרשימה כבר עודכנה.`, `קבוע`, `מחק פריט`. Header count is `N פריטים`, or `N פריטים · M סומנו` when M > 0.
- Firestore security rules are not changed.
- Bot tests need the Firestore emulator: `firebase emulators:start --only firestore` running in the background, tests run with `--no-file-parallelism`. `functions/src/__tests__/firestore.rules.test.ts` is **known to fail** (this emulator version lacks the security-rules endpoint) and is not part of this work; run the other files by path instead of `npm run test:emulator`.
- Never run `firebase functions:secrets:access` or anything else that prints secret values.
- Shell is Git Bash on Windows: forward slashes, POSIX syntax. Stop any Java emulator processes you started before finishing (`powershell -c "Get-Process java | Stop-Process -Force"`).
- Every commit message ends with the line `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`. Commit only the files named in each task. **Do not push or deploy before Task 5.**
- Temporary verification files (`web/_harness.html`, `web/_stub-db.js`, `.claude/launch.json`) must be deleted before committing.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `web/js/finish-plan.js` (new) | Pure decision logic for the finish transaction: which items count, `purchased`, `recurringDecisions`, kept flags. |
| `web/js/finish-plan.test.js` (new) | Unit tests for the above. |
| `web/js/db.js` | Firestore access. Loses the trip-watching functions, gains `setChecked` and the new `finishTrip`. |
| `web/js/list-page.js` | The single page controller: rows, ticking, editing, finish flow. Absorbs `trip-page.js`. |
| `web/index.html` | List, recap and done screens in one page. |
| `web/trip.html` | Redirect stub so old Telegram links still work. |
| `web/js/trip-page.js` | Deleted. |
| `web/js/history-page.js`, `web/style.css` | History rows become plain rows; row and checkbox styles. |
| `functions/src/firestore/items.ts` (+ test) | New items are stored with `checked: false`. |
| `functions/src/bot/handleUpdate.ts` (+ test) | "אני בסופר" reply. |
| `functions/src/firestore/trips.ts` (+ test) | Deleted. |

---

### Task 1: Finish-plan decision logic (pure, test-first)

**Files:**
- Create: `web/js/finish-plan.js`
- Test: `web/js/finish-plan.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `planFinish(snapshots, keepItemIds)` where `snapshots` is `Array<{ id: string, exists: boolean, data?: { name: string, normalizedName: string, checked?: boolean } }>` and `keepItemIds` is a `Set<string>`. Returns `{ items: Array<{ id, name, normalizedName, kept: boolean }>, purchased: Array<{ itemId, name, price: null }>, recurringDecisions: Array<{ name, kept }> }`. Only snapshots that exist and have `data.checked === true` count. Task 2's `finishTrip` calls this.

- [ ] **Step 1: Write the failing test**

Create `web/js/finish-plan.test.js`:

```js
// web/js/finish-plan.test.js
import { describe, it, expect } from 'vitest';
import { planFinish } from './finish-plan.js';

// A snapshot as the finish transaction reads it: `data` is the item
// document, or absent when the document no longer exists.
function snapshot(id, data) {
  return data ? { id, exists: true, data } : { id, exists: false };
}

function ticked(name, extra = {}) {
  return { name, normalizedName: name, checked: true, recurring: false, ...extra };
}

describe('planFinish', () => {
  it('counts only items that still exist and are still ticked', () => {
    const plan = planFinish(
      [
        snapshot('a', ticked('חלב')),
        snapshot('b', ticked('לחם', { checked: false })),
        snapshot('c', undefined),
        snapshot('d', { name: 'ביצים', normalizedName: 'ביצים' }),
      ],
      new Set()
    );
    expect(plan.items.map((i) => i.id)).toEqual(['a']);
  });

  it('marks an item as kept only when its id is in the keep set', () => {
    const plan = planFinish(
      [snapshot('a', ticked('חלב')), snapshot('b', ticked('לחם'))],
      new Set(['b'])
    );
    expect(plan.items.map((i) => [i.id, i.kept])).toEqual([
      ['a', false],
      ['b', true],
    ]);
  });

  it('takes the name and normalized name from the snapshot', () => {
    const plan = planFinish([snapshot('a', ticked('חלב 3%'))], new Set());
    expect(plan.items[0]).toEqual({ id: 'a', name: 'חלב 3%', normalizedName: 'חלב 3%', kept: false });
  });

  it('builds the purchased record with a null price', () => {
    const plan = planFinish(
      [snapshot('a', ticked('חלב')), snapshot('b', ticked('לחם'))],
      new Set()
    );
    expect(plan.purchased).toEqual([
      { itemId: 'a', name: 'חלב', price: null },
      { itemId: 'b', name: 'לחם', price: null },
    ]);
  });

  it('builds the recurring decisions from the keep set', () => {
    const plan = planFinish(
      [snapshot('a', ticked('חלב')), snapshot('b', ticked('לחם'))],
      new Set(['a'])
    );
    expect(plan.recurringDecisions).toEqual([
      { name: 'חלב', kept: true },
      { name: 'לחם', kept: false },
    ]);
  });

  it('returns empty lists when nothing counts', () => {
    const plan = planFinish([snapshot('a', undefined)], new Set(['a']));
    expect(plan).toEqual({ items: [], purchased: [], recurringDecisions: [] });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from the repo root): `npx vitest run web/js/finish-plan.test.js`
Expected: FAIL with `Failed to load url ./finish-plan.js`.

- [ ] **Step 3: Write the minimal implementation**

Create `web/js/finish-plan.js`:

```js
// web/js/finish-plan.js
// Decides what "סיימתי לקנות" does, from item snapshots that the finish
// transaction re-read a moment ago. Kept free of Firestore so it can be
// unit-tested; db.js's finishTrip does the reads and writes around it.
//
// An item counts only if it still exists AND is still ticked. That is what
// makes a double tap, or both phones finishing at once, safe: the second run
// finds the items already deleted (or, for kept items, already unticked) and
// so counts nothing.
export function planFinish(snapshots, keepItemIds) {
  const items = snapshots
    .filter((snap) => snap.exists && snap.data.checked === true)
    .map((snap) => ({
      id: snap.id,
      name: snap.data.name,
      normalizedName: snap.data.normalizedName,
      kept: keepItemIds.has(snap.id),
    }));

  return {
    items,
    purchased: items.map((item) => ({ itemId: item.id, name: item.name, price: null })),
    recurringDecisions: items.map((item) => ({ name: item.name, kept: item.kept })),
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run web/js/finish-plan.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add web/js/finish-plan.js web/js/finish-plan.test.js
git commit -m "$(cat <<'EOF'
Add the pure decision logic for finishing a shopping trip

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: The single list page and its data layer

**Files:**
- Modify (full rewrite): `web/js/db.js`
- Modify (full rewrite): `web/index.html`
- Modify (full rewrite): `web/js/list-page.js`
- Modify: `web/style.css` (two edits)
- Modify: `web/js/firebase-init.js` (one comment)
- Modify (full rewrite): `web/trip.html`
- Delete: `web/js/trip-page.js`
- Temporary, never committed: `web/_harness.html`, `web/_stub-db.js`, `.claude/launch.json`

**Interfaces:**
- Consumes: `planFinish` from `./finish-plan.js` (Task 1); `iconFor`, `withIcon` from `./product-icons.js` (already exist); `isRecurringCandidate` from `./recurring.js`.
- Produces (exports of `web/js/db.js`): `watchItems(onChange)`, `addItem(name)` (now writes `checked: false`), `deleteItem(itemId)`, `renameItem(itemId, name)`, `setRecurring(itemId, recurring)`, **`setChecked(itemId, checked)`** returning `Promise<void>`, `getRecurringCandidates(checkedItems)`, **`finishTrip(checkedItems, keepItemIds)`** returning `Promise<null | { purchased: Array<{ itemId, name, price: null }>, kept: string[] }>` (`kept` is the names of items that stay), `watchHistory(onChange)`. **Removed:** `watchActiveTrip`, `watchTrip`, `toggleChecked`.

- [ ] **Step 1: Rewrite `web/js/db.js`**

Replace the whole file with:

```js
// web/js/db.js
import { db, ensureSignedIn } from "./firebase-init.js";
import { isRecurringCandidate } from "./recurring.js";
import { planFinish } from "./finish-plan.js";
import {
  collection, doc, addDoc, deleteDoc, updateDoc, getDoc, onSnapshot,
  query, orderBy, where, limit, arrayUnion,
  runTransaction, getDocs,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const itemsCol = collection(db, "households/main/items");
const tripsCol = collection(db, "households/main/trips");
const historyCol = collection(db, "households/main/purchaseHistory");

// Firestore document IDs can't contain "/" (it's a path separator there,
// not a literal character) or be exactly "." or "..". An item name is
// free text ("1/2 kg", "חלב/שמנת"), so it can't be used as a doc ID
// as-is - this escapes it into something always valid.
function historyDocId(normalizedName) {
  const escaped = normalizedName.replace(/\//g, "_");
  return escaped === "." || escaped === ".." || escaped === "" ? `_${escaped}` : escaped;
}

export async function watchItems(onChange) {
  await ensureSignedIn();
  const q = query(itemsCol, orderBy("addedAt", "asc"));
  return onSnapshot(q, (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

// Known accepted limitation: unlike the bot's server-side addItem
// (functions/src/firestore/items.ts, which runs its duplicate-check-then-
// write inside a transaction), addItem/renameItem here do no dedup at all -
// two items can end up with the same normalizedName (e.g. renaming "Milk"
// to "milk", or to another item's exact name). Low-impact for a two-person
// list (an obvious duplicate row, not data loss, and trivially fixed with
// the delete button) and left this way rather than rushing a UX decision
// for what a rejected/merged rename should do.
export async function addItem(name) {
  await ensureSignedIn();
  await addDoc(itemsCol, {
    name: name.trim(),
    normalizedName: name.trim().toLowerCase(),
    addedAt: Date.now(),
    addedBy: "web",
    recurring: false,
    checked: false,
  });
}

export async function deleteItem(itemId) {
  await ensureSignedIn();
  await deleteDoc(doc(itemsCol, itemId));
}

export async function renameItem(itemId, name) {
  await ensureSignedIn();
  await updateDoc(doc(itemsCol, itemId), {
    name: name.trim(),
    normalizedName: name.trim().toLowerCase(),
  });
}

export async function setRecurring(itemId, recurring) {
  await ensureSignedIn();
  await updateDoc(doc(itemsCol, itemId), { recurring });
}

// A tick is a field on the item itself, so both phones see it through the
// same live listener as every other edit - there is no separate trip
// document to keep in sync.
export async function setChecked(itemId, checked) {
  await ensureSignedIn();
  await updateDoc(doc(itemsCol, itemId), { checked });
}

export async function getRecurringCandidates(checkedItems) {
  await ensureSignedIn();
  const recentTripsSnap = await getDocs(
    query(tripsCol, where("status", "==", "completed"), orderBy("completedAt", "desc"), limit(4))
  );
  const recentTripIds = recentTripsSnap.docs.map((d) => d.id);

  const candidates = [];
  for (const item of checkedItems) {
    if (item.recurring) {
      candidates.push(item);
      continue;
    }
    if (recentTripIds.length < 4) continue;
    const histSnap = await getDoc(doc(historyCol, historyDocId(item.normalizedName)));
    if (!histSnap.exists()) continue;
    const purchases = histSnap.data().purchases || [];
    const itemTripIds = purchases.map((p) => p.tripId);
    if (isRecurringCandidate(itemTripIds, recentTripIds)) candidates.push(item);
  }
  return candidates;
}

// Finishes a shopping trip: the trip document is created here, at the end,
// rather than when shopping starts. Returns null when there was nothing left
// to finish (another device got there first), otherwise the purchased items
// and the names of the ones that stay on the list.
export async function finishTrip(checkedItems, keepItemIds) {
  await ensureSignedIn();

  // A transaction (not a plain batch) so a double tap of "finish", a retry
  // after a perceived timeout, or both phones finishing at once can't record
  // the same purchase twice.
  return runTransaction(db, async (transaction) => {
    // Firestore requires every read before any write. Re-reading the items
    // here, instead of trusting the copies this device holds, is what lets
    // planFinish skip anything another device already finished or unticked.
    const snapshots = [];
    for (const item of checkedItems) {
      const snap = await transaction.get(doc(itemsCol, item.id));
      snapshots.push({ id: item.id, exists: snap.exists(), data: snap.exists() ? snap.data() : undefined });
    }

    const plan = planFinish(snapshots, keepItemIds);
    if (plan.items.length === 0) return null;

    const tripRef = doc(tripsCol);
    for (const item of plan.items) {
      const itemRef = doc(itemsCol, item.id);
      if (item.kept) {
        transaction.update(itemRef, { checked: false, recurring: true });
      } else {
        transaction.delete(itemRef);
      }
      transaction.set(
        doc(historyCol, historyDocId(item.normalizedName)),
        { name: item.name, purchases: arrayUnion({ tripId: tripRef.id, date: Date.now() }) },
        { merge: true }
      );
    }

    transaction.set(tripRef, {
      status: "completed",
      completedAt: Date.now(),
      purchased: plan.purchased,
      recurringDecisions: plan.recurringDecisions,
    });

    return {
      purchased: plan.purchased,
      kept: plan.items.filter((item) => item.kept).map((item) => item.name),
    };
  });
}

export async function watchHistory(onChange) {
  await ensureSignedIn();
  const q = query(tripsCol, where("status", "==", "completed"), orderBy("completedAt", "desc"));
  return onSnapshot(q, (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}
```

- [ ] **Step 2: Rewrite `web/index.html`**

Replace the whole file with:

```html
<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>העגלה שלנו</title>
<link rel="stylesheet" href="style.css" />
</head>
<body>
<div class="phone">
  <div class="card">

    <div id="screen-list">
      <header>
        <div class="eyebrow">רשימת קניות משותפת</div>
        <h1>העגלה שלנו</h1>
        <div class="meta" id="meta"></div>
      </header>
      <ul class="list" id="list"></ul>
      <p class="empty hidden" id="empty">הרשימה ריקה - תוסיפו פריט למטה, או פשוט תכתבו לבוט בטלגרם</p>
      <form class="addbar" id="add-form">
        <input id="add-input" type="text" placeholder="פריט חדש..." autocomplete="off" />
        <button class="btn btn-primary" type="submit">הוסף</button>
      </form>
      <footer id="finish-footer" class="hidden">
        <button class="btn btn-primary" id="finish-btn" type="button">סיימתי לקנות</button>
      </footer>
    </div>

    <div id="screen-recap" class="hidden">
      <div style="padding:18px 20px 6px;">
        <h1 style="font-size:20px;">סיכום קנייה</h1>
        <p style="color:var(--text-muted); font-size:13.5px; margin:4px 0 0;">אפשר להחליט מה נשאר לשבוע הבא לפני שמעדכנים את הרשימה.</p>
      </div>
      <div class="section-label">להישאר ברשימה?</div>
      <div id="suggestions"></div>
      <footer>
        <button class="btn btn-primary" id="confirm-btn" type="button">עדכון הרשימה</button>
        <button class="btn btn-ghost" id="back-btn" type="button">חזרה</button>
      </footer>
    </div>

    <div id="screen-done" class="hidden">
      <div style="padding:44px 24px 40px; text-align:center;">
        <h1 style="font-size:20px;">הרשימה עודכנה</h1>
        <p style="color:var(--text-muted); font-size:14px;" id="done-summary"></p>
      </div>
      <footer>
        <button class="btn btn-primary" id="done-back-btn" type="button">חזרה לרשימה</button>
      </footer>
    </div>

  </div>
  <div class="note"><a href="history.html">היסטוריית קניות ›</a></div>
</div>
<script type="module" src="js/list-page.js"></script>
</body>
</html>
```

- [ ] **Step 3: Rewrite `web/js/list-page.js`**

Replace the whole file with:

```js
import {
  watchItems, addItem, deleteItem, renameItem, setRecurring, setChecked,
  getRecurringCandidates, finishTrip,
} from "./db.js";
import { iconFor, withIcon } from "./product-icons.js";

const listEl = document.getElementById("list");
const emptyEl = document.getElementById("empty");
const metaEl = document.getElementById("meta");
const addForm = document.getElementById("add-form");
const addInput = document.getElementById("add-input");
const finishFooter = document.getElementById("finish-footer");
const finishBtn = document.getElementById("finish-btn");
const screenList = document.getElementById("screen-list");
const screenRecap = document.getElementById("screen-recap");
const screenDone = document.getElementById("screen-done");
const suggestionsEl = document.getElementById("suggestions");
const confirmBtn = document.getElementById("confirm-btn");
const backBtn = document.getElementById("back-btn");
const doneSummary = document.getElementById("done-summary");
const doneBackBtn = document.getElementById("done-back-btn");

// Every db.js call is async (each awaits ensureSignedIn() first), so an
// unhandled rejection from a click would silently leave the UI acting as if
// the write had happened.
function logFailure(action) {
  return (error) => console.error(`Failed to ${action}:`, error);
}

const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7"/></svg>';
const DELETE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>';

let currentItems = [];
let keepItemIds = new Set();
// Frozen when "סיימתי לקנות" is pressed, so "עדכון הרשימה" finishes the items
// the user actually reviewed on the recap screen, not whatever the live list
// looks like by the time they confirm.
let recapItems = [];

// item id -> { li, box, icon, nameInput, tag, item }
// Rows are updated in place rather than rebuilt on every snapshot: a tick from
// the other phone arrives as a snapshot, and rebuilding the list would wipe a
// name being typed into an input on this one.
const rows = new Map();

// Item names are free text from either household member, so every name goes
// in through textContent or an input's value, never innerHTML.
function createRow() {
  const li = document.createElement("li");
  li.className = "row";

  const box = document.createElement("button");
  box.type = "button";
  box.className = "box";
  box.setAttribute("role", "checkbox");
  box.setAttribute("aria-label", "סמן פריט");
  box.innerHTML = CHECK_SVG;

  // Separate from the input so the icon is display-only and can never end up
  // inside the saved name.
  const icon = document.createElement("span");
  icon.className = "item-icon";
  icon.setAttribute("aria-hidden", "true");

  const nameInput = document.createElement("input");
  nameInput.className = "name";

  const tag = document.createElement("button");
  tag.type = "button";
  tag.className = "tag";
  tag.textContent = "קבוע";

  const del = document.createElement("button");
  del.type = "button";
  del.className = "icon-btn";
  del.setAttribute("aria-label", "מחק פריט");
  del.innerHTML = DELETE_SVG;

  const row = { li, box, icon, nameInput, tag, item: null };

  box.addEventListener("click", () => {
    setChecked(row.item.id, row.item.checked !== true).catch(logFailure("update the checked item"));
  });
  nameInput.addEventListener("change", () => {
    const value = nameInput.value.trim();
    if (value && value !== row.item.name) {
      renameItem(row.item.id, value).catch(logFailure("rename the item"));
    } else {
      nameInput.value = row.item.name;
    }
  });
  tag.addEventListener("click", () => {
    setRecurring(row.item.id, !row.item.recurring).catch(logFailure("update the item"));
  });
  del.addEventListener("click", () => {
    deleteItem(row.item.id).catch(logFailure("delete the item"));
  });

  li.append(box, icon, nameInput, tag, del);
  return row;
}

function updateRow(row, item) {
  row.item = item;
  const checked = item.checked === true;
  row.li.classList.toggle("checked", checked);
  row.box.setAttribute("aria-checked", String(checked));
  row.icon.textContent = iconFor(item.name);
  if (document.activeElement !== row.nameInput) row.nameInput.value = item.name;
  row.tag.classList.toggle("off", !item.recurring);
}

function render() {
  const tickedCount = currentItems.filter((item) => item.checked === true).length;
  metaEl.textContent =
    tickedCount > 0
      ? `${currentItems.length} פריטים · ${tickedCount} סומנו`
      : `${currentItems.length} פריטים`;
  emptyEl.classList.toggle("hidden", currentItems.length > 0);
  finishFooter.classList.toggle("hidden", tickedCount === 0);

  const seen = new Set();
  let previous = null;
  for (const item of currentItems) {
    seen.add(item.id);
    let row = rows.get(item.id);
    if (!row) {
      row = createRow();
      rows.set(item.id, row);
    }
    updateRow(row, item);
    // Keep the DOM order identical to currentItems by moving a row only when
    // it is not already right after the previous one.
    const expectedPosition = previous ? previous.li.nextSibling : listEl.firstChild;
    if (row.li !== expectedPosition) listEl.insertBefore(row.li, expectedPosition);
    previous = row;
  }
  for (const [id, row] of rows) {
    if (!seen.has(id)) {
      row.li.remove();
      rows.delete(id);
    }
  }
}

watchItems((items) => {
  currentItems = items;
  render();
}).catch((error) => {
  console.error("Failed to load the shopping list:", error);
});

addForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = addInput.value.trim();
  if (!name) return;
  addItem(name).catch(logFailure("add the item"));
  addInput.value = "";
});

function showScreen(screen) {
  for (const s of [screenList, screenRecap, screenDone]) {
    s.classList.toggle("hidden", s !== screen);
  }
}

function suggestionCard(item, isCandidate) {
  const row = document.createElement("div");
  row.className = "suggest-card";

  const info = document.createElement("div");
  info.className = "info";
  const nameDiv = document.createElement("div");
  nameDiv.className = "name";
  nameDiv.textContent = withIcon(item.name);
  const whyDiv = document.createElement("div");
  whyDiv.className = "why";
  whyDiv.textContent = isCandidate ? "נקנה לרוב מדי קנייה" : "לא זוהה כפריט קבוע";
  info.append(nameDiv, whyDiv);

  const switchBtn = document.createElement("button");
  switchBtn.type = "button";
  switchBtn.className = "switch" + (isCandidate ? " on" : "");
  switchBtn.addEventListener("click", () => {
    switchBtn.classList.toggle("on");
    if (switchBtn.classList.contains("on")) {
      keepItemIds.add(item.id);
    } else {
      keepItemIds.delete(item.id);
    }
  });

  row.append(info, switchBtn);
  return row;
}

finishBtn.addEventListener("click", async () => {
  const ticked = currentItems.filter((item) => item.checked === true);
  if (ticked.length === 0) return;

  // Disabled for the duration of the async call so a fast double-tap can't
  // re-enter this handler before the first call has switched screens.
  finishBtn.disabled = true;
  try {
    const candidates = await getRecurringCandidates(ticked);
    recapItems = ticked;
    keepItemIds = new Set(candidates.map((c) => c.id));

    suggestionsEl.innerHTML = "";
    for (const item of ticked) {
      const isCandidate = candidates.some((c) => c.id === item.id);
      suggestionsEl.appendChild(suggestionCard(item, isCandidate));
    }
    showScreen(screenRecap);
  } catch (error) {
    logFailure("prepare the finish-shopping summary")(error);
    alert("קרתה שגיאה, נסו שוב");
  } finally {
    finishBtn.disabled = false;
  }
});

backBtn.addEventListener("click", () => showScreen(screenList));
doneBackBtn.addEventListener("click", () => showScreen(screenList));

function showDone(result) {
  if (!result) {
    doneSummary.textContent = "הרשימה כבר עודכנה.";
  } else if (result.kept.length > 0) {
    doneSummary.textContent = `${result.kept.map(withIcon).join(", ")} נשארו ברשימה לפעם הבאה.`;
  } else {
    doneSummary.textContent = "הרשימה עודכנה.";
  }
  showScreen(screenDone);
}

confirmBtn.addEventListener("click", async () => {
  confirmBtn.disabled = true;
  try {
    const result = await finishTrip(recapItems, keepItemIds);
    showDone(result);
  } catch (error) {
    logFailure("update the list after finishing the trip")(error);
    alert("קרתה שגיאה בעדכון הרשימה, נסו שוב");
  } finally {
    confirmBtn.disabled = false;
  }
});
```

- [ ] **Step 4: Edit `web/style.css`**

Edit 1, make the checkbox a button with a larger tap target. Replace this exact line:

```css
.box { width: 22px; height: 22px; flex: none; border-radius: 7px; border: 2px solid var(--border); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background .15s, border-color .15s; }
```

with:

```css
.box { position: relative; width: 22px; height: 22px; flex: none; padding: 0; border-radius: 7px; border: 2px solid var(--border); background: transparent; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background .15s, border-color .15s; }
.box::before { content: ""; position: absolute; inset: -10px; }
```

Edit 2, remove the unused banner rule. Delete this exact line (and its trailing newline):

```css
.banner { margin: 14px 16px 0; background: var(--accent-tint); color: var(--accent-strong); border-radius: 12px; padding: 11px 14px; font-size: 14px; font-weight: 600; display: flex; justify-content: space-between; align-items: center; text-decoration: none; }
```

- [ ] **Step 5: Fix the stale comment in `web/js/firebase-init.js`**

Replace this exact text:

```js
  // Every page calls ensureSignedIn() from more than one place at once
  // (e.g. trip-page.js's watchItems and watchTrip, both at module load,
  // neither awaiting the other). Without sharing one in-flight promise,
```

with:

```js
  // A page can call ensureSignedIn() from more than one place at once
  // (e.g. the live listener at load plus a write fired straight away,
  // neither awaiting the other). Without sharing one in-flight promise,
```

- [ ] **Step 6: Replace `web/trip.html` with a redirect stub and delete `trip-page.js`**

Replace the whole of `web/trip.html` with:

```html
<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8" />
<meta http-equiv="refresh" content="0; url=index.html" />
<title>העגלה שלנו</title>
</head>
<body>
<script>location.replace("index.html");</script>
<p><a href="index.html">לרשימה</a></p>
</body>
</html>
```

Then run: `git rm web/js/trip-page.js`

- [ ] **Step 7: Syntax-check the changed modules**

Run:

```bash
node --check web/js/db.js && node --check web/js/list-page.js && node --check web/js/finish-plan.js && echo SYNTAX_OK
```
Expected: `SYNTAX_OK`.

- [ ] **Step 8: Create the temporary verification harness**

The real page talks to the production database, so verify against a stubbed data layer instead. Create `web/_stub-db.js`:

```js
// TEMPORARY test double for web/js/db.js - never commit.
const items = [
  { id: "1", name: "חלב", normalizedName: "חלב", recurring: true, checked: false, addedAt: 1 },
  { id: "2", name: "עגבניות", normalizedName: "עגבניות", recurring: false, checked: true, addedAt: 2 },
  { id: "3", name: "לחם", normalizedName: "לחם", recurring: false, checked: false, addedAt: 3 },
  { id: "4", name: "<img src=x onerror=alert(1)>", normalizedName: "x", recurring: false, checked: false, addedAt: 4 },
];
let listener = null;
const emit = () => listener && listener(items.map((i) => ({ ...i })));
const find = (id) => items.find((i) => i.id === id);

export async function watchItems(cb) { listener = cb; emit(); return () => {}; }
export async function addItem(name) {
  items.push({ id: String(Date.now()), name, normalizedName: name.toLowerCase(), recurring: false, checked: false, addedAt: Date.now() });
  emit();
}
export async function deleteItem(id) { const i = items.findIndex((x) => x.id === id); if (i >= 0) items.splice(i, 1); emit(); }
export async function renameItem(id, name) { const it = find(id); if (it) { it.name = name; it.normalizedName = name.toLowerCase(); } emit(); }
export async function setRecurring(id, recurring) { const it = find(id); if (it) it.recurring = recurring; emit(); }
export async function setChecked(id, checked) { const it = find(id); if (it) it.checked = checked; emit(); }
export async function getRecurringCandidates(checkedItems) { return checkedItems.filter((i) => i.recurring); }
export async function finishTrip(checkedItems, keepItemIds) {
  const counted = checkedItems.filter((c) => items.some((i) => i.id === c.id && i.checked));
  if (counted.length === 0) return null;
  for (const c of counted) {
    const it = find(c.id);
    if (keepItemIds.has(c.id)) { it.checked = false; it.recurring = true; }
    else items.splice(items.indexOf(it), 1);
  }
  emit();
  return {
    purchased: counted.map((c) => ({ itemId: c.id, name: c.name, price: null })),
    kept: counted.filter((c) => keepItemIds.has(c.id)).map((c) => c.name),
  };
}
```

Generate the harness page (a copy of `index.html` whose `./db.js` import is remapped to the stub) and a temporary dev-server config:

```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('web/index.html', 'utf8').replace(
  '<script type=\"module\" src=\"js/list-page.js\"></script>',
  '<script type=\"importmap\">{\"imports\":{\"http://localhost:5173/js/db.js\":\"http://localhost:5173/_stub-db.js\"}}</script>\n<script type=\"module\" src=\"js/list-page.js\"></script>'
);
if (!html.includes('importmap')) throw new Error('inject failed');
fs.writeFileSync('web/_harness.html', html);
"
mkdir -p .claude && cat > .claude/launch.json <<'EOF'
{
  "version": "0.0.1",
  "configurations": [
    { "name": "superbot-web", "runtimeExecutable": "python", "runtimeArgs": ["-m", "http.server", "5173", "--directory", "web"], "port": 5173 }
  ]
}
EOF
```

- [ ] **Step 9: Verify the page in the browser pane**

Start the server with `mcp__Claude_Browser__preview_start` using `name: "superbot-web"`, then navigate the tab to `http://localhost:5173/_harness.html`. Run this script with `mcp__Claude_Browser__javascript_tool` (`javascript_exec`). It checks every behavior of the page and returns the list of failed checks:

```js
const $ = (s) => document.querySelector(s);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const lis = () => [...document.querySelectorAll('#list li')];
const info = (li) => ({
  icon: li.querySelector('.item-icon').textContent,
  name: li.querySelector('.name').value,
  checked: li.classList.contains('checked'),
});
const failures = [];
const check = (label, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) failures.push({ label, actual, expected });
};

// 1. initial render
check('initial rows', lis().map(info), [
  { icon: '🥛', name: 'חלב', checked: false },
  { icon: '🍅', name: 'עגבניות', checked: true },
  { icon: '🍞', name: 'לחם', checked: false },
  { icon: '🛒', name: '<img src=x onerror=alert(1)>', checked: false },
]);
check('every row has checkbox, tag and delete', lis().every((li) => li.querySelector('.box') && li.querySelector('.tag') && li.querySelector('.icon-btn')), true);
check('hostile name stays text', document.querySelectorAll('#list img').length, 0);
check('meta with one tick', $('#meta').textContent, '4 פריטים · 1 סומנו');
check('finish footer visible with a tick', $('#finish-footer').classList.contains('hidden'), false);

// 2. ticking and unticking
lis()[2].querySelector('.box').click(); await wait(50);
check('meta after a second tick', $('#meta').textContent, '4 פריטים · 2 סומנו');
lis()[2].querySelector('.box').click(); lis()[1].querySelector('.box').click(); await wait(50);
check('meta with no ticks', $('#meta').textContent, '4 פריטים');
check('finish footer hidden with no ticks', $('#finish-footer').classList.contains('hidden'), true);

// 3. finish flow
lis()[0].querySelector('.box').click(); lis()[1].querySelector('.box').click(); await wait(50);
$('#finish-btn').click(); await wait(200);
check('recap visible', $('#screen-recap').classList.contains('hidden'), false);
check('recap cards', [...document.querySelectorAll('#suggestions .suggest-card')].map((c) => [c.querySelector('.name').textContent, c.querySelector('.switch').classList.contains('on')]), [['🥛 חלב', true], ['🍅 עגבניות', false]]);
$('#back-btn').click();
check('back returns to the list', $('#screen-list').classList.contains('hidden'), false);
$('#finish-btn').click(); await wait(200);
$('#confirm-btn').click(); await wait(200);
check('done visible', $('#screen-done').classList.contains('hidden'), false);
check('done summary', $('#done-summary').textContent, '🥛 חלב נשארו ברשימה לפעם הבאה.');
$('#done-back-btn').click();
check('list after finishing', lis().map(info), [
  { icon: '🥛', name: 'חלב', checked: false },
  { icon: '🍞', name: 'לחם', checked: false },
  { icon: '🛒', name: '<img src=x onerror=alert(1)>', checked: false },
]);
check('kept item is tagged recurring', lis()[0].querySelector('.tag').classList.contains('off'), false);

// 4. tag, rename, delete, add
lis()[0].querySelector('.tag').click(); await wait(50);
check('tag toggled off', lis()[0].querySelector('.tag').classList.contains('off'), true);
const input = lis()[1].querySelector('.name'); input.value = 'גבינה'; input.dispatchEvent(new Event('change')); await wait(50);
check('rename updates name and icon', info(lis()[1]), { icon: '🧀', name: 'גבינה', checked: false });
lis()[2].querySelector('.icon-btn').click(); await wait(50);
check('delete removes the row', lis().length, 2);
$('#add-input').value = 'ביצים'; $('#add-form').dispatchEvent(new Event('submit', { cancelable: true })); await wait(50);
check('add appends a row with its icon', info(lis()[2]), { icon: '🥚', name: 'ביצים', checked: false });

JSON.stringify(failures);
```

Expected result: `[]`. Then run `mcp__Claude_Browser__read_console_messages` with `onlyErrors: true`: expected no errors. Take one `computer` screenshot at the default desktop viewport and confirm the rows show checkbox, icon, name, "קבוע" and a delete X in a tidy line, with the ticked row dimmed and struck through. Finally navigate to `http://localhost:5173/trip.html?id=abc` and confirm the page ends up at `/index.html` (`location.pathname`).

If any check fails, fix the code (not the script) and re-run.

- [ ] **Step 10: Clean up and commit**

Stop the preview server (`mcp__Claude_Browser__preview_stop`), then:

```bash
rm -f web/_harness.html web/_stub-db.js .claude/launch.json
npm test
git status --short
```
Expected: `npm test` passes all web suites; `git status` shows only these paths as changed: `web/js/db.js`, `web/index.html`, `web/js/list-page.js`, `web/style.css`, `web/js/firebase-init.js`, `web/trip.html`, and `web/js/trip-page.js` as deleted. Nothing else should appear; if a pre-existing `.claude/scheduled_tasks.lock` is listed, do not add it.

```bash
git add web/js/db.js web/index.html web/js/list-page.js web/style.css web/js/firebase-init.js web/trip.html
git commit -m "$(cat <<'EOF'
Merge the trip page into the main list: one view to edit and shop

Every row now has a checkbox, icon, editable name, recurring tag and delete.
Ticks are stored on the items, so both phones see them through the same live
listener, and a trip record is written only when shopping is finished, in a
transaction that skips anything another device already finished. Old
trip.html links redirect to the main page.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: History rows become plain rows

**Files:**
- Modify: `web/js/history-page.js`
- Modify: `web/style.css`

**Interfaces:**
- Consumes: `watchHistory`, `withIcon` (unchanged).
- Produces: nothing new. Rows are `div.history-row` containing `.date` and `.summary`, no longer `a` links (the trip page they linked to no longer exists).

- [ ] **Step 1: Change the row element in `web/js/history-page.js`**

Replace this exact block:

```js
      const a = document.createElement("a");
      a.className = "history-row";
      a.href = `trip.html?id=${trip.id}`;
```

with:

```js
      const row = document.createElement("div");
      row.className = "history-row";
```

Replace this exact block:

```js
      a.append(dateDiv, summaryDiv);
      listEl.appendChild(a);
```

with:

```js
      row.append(dateDiv, summaryDiv);
      listEl.appendChild(row);
```

Replace the comment fragment `same reasoning as trip-page.js's item rows.` with `same reasoning as list-page.js's item rows.`

- [ ] **Step 2: Update the row styles in `web/style.css`**

Replace these four exact lines:

```css
a.history-row { display: block; padding: 13px 16px; border-bottom: 1px solid var(--border); color: inherit; text-decoration: none; }
a.history-row:hover { background: var(--surface-alt); }
a.history-row .date { font-weight: 600; }
a.history-row .summary { font-size: 13px; color: var(--text-muted); margin-top: 2px; }
```

with:

```css
.history-row { padding: 13px 16px; border-bottom: 1px solid var(--border); }
.history-row .date { font-weight: 600; }
.history-row .summary { font-size: 13px; color: var(--text-muted); margin-top: 2px; }
```

- [ ] **Step 3: Verify against the live data (read-only)**

Create `.claude/launch.json` as in Task 2 Step 8, start `superbot-web` with `mcp__Claude_Browser__preview_start`, navigate to `http://localhost:5173/history.html`, and run:

```js
await new Promise((r) => setTimeout(r, 2500));
JSON.stringify({
  links: document.querySelectorAll('a.history-row').length,
  rows: [...document.querySelectorAll('.history-row')].map((r) => ({
    hasDate: !!r.querySelector('.date'),
    hasSummary: !!r.querySelector('.summary'),
    tag: r.tagName,
  })),
});
```

Expected: `links` is `0`, and `rows` has at least one entry (the earlier completed trip) with `hasDate: true`, `hasSummary: true`, `tag: "DIV"`. `read_console_messages` with `onlyErrors: true` shows no errors. This only reads production data; do not click anything.

- [ ] **Step 4: Clean up and commit**

Stop the preview server, then:

```bash
rm -f .claude/launch.json
git add web/js/history-page.js web/style.css
git commit -m "$(cat <<'EOF'
Make history rows plain rows now that trips have no page of their own

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Bot replies with the list link and stores new items unticked

**Files:**
- Modify: `functions/src/firestore/items.ts`
- Modify: `functions/src/bot/handleUpdate.ts`
- Modify (tests): `functions/src/firestore/items.test.ts`, `functions/src/bot/handleUpdate.test.ts`
- Delete: `functions/src/firestore/trips.ts`, `functions/src/firestore/trips.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `addItems` now stores `checked: false` on every new item (the `Item` interface gains `checked?: boolean`, optional because older documents lack it). `handleUpdate` for "אני בסופר" replies `בהצלחה בסופר! 🛒\n${pagesBaseUrl}/` and touches no Firestore data. `getOrCreateActiveTrip` no longer exists.

- [ ] **Step 1: Write the failing tests**

In `functions/src/firestore/items.test.ts`, add this test inside `describe('items', ...)`, right after the `'adds a new item'` test:

```ts
  it('stores a new item as not ticked', async () => {
    await addItems(db, ['חלב'], 111);
    const snap = await db.collection('households/main/items').get();
    expect(snap.docs[0].data().checked).toBe(false);
  });
```

In `functions/src/bot/handleUpdate.test.ts`, replace the whole `'replies with a trip link for "אני בסופר"'` test with:

```ts
  it('replies with a link to the main page for "אני בסופר" and starts no trip', async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    const aiParse = vi.fn();

    await handleUpdate(makeUpdate('אני בסופר'), {
      db,
      sendMessage,
      aiParse,
      pagesBaseUrl: 'https://example.github.io/superbot',
    });

    expect(sendMessage).toHaveBeenCalledWith(111, 'בהצלחה בסופר! 🛒\nhttps://example.github.io/superbot/');
    const trips = await db.collection('households/main/trips').get();
    expect(trips.empty).toBe(true);
  });
```

- [ ] **Step 2: Start the emulator and run the tests to verify they fail**

Start the emulator in the background: `firebase emulators:start --only firestore` (from the repo root; run it as a background command and wait until its output contains `All emulators ready`). Then:

```bash
cd functions && npx vitest run src/firestore/items.test.ts src/bot/handleUpdate.test.ts --no-file-parallelism
```
Expected: exactly 2 failures: `stores a new item as not ticked` (received `undefined`) and the "אני בסופר" test (the reply still contains `trip.html?id=`).

- [ ] **Step 3: Implement**

In `functions/src/firestore/items.ts`, add the optional field to the interface:

```ts
export interface Item {
  id: string;
  name: string;
  normalizedName: string;
  addedAt: number;
  addedBy: number;
  recurring: boolean;
  checked?: boolean;
}
```

and add `checked: false,` to the document written inside `addItems`, so that it reads:

```ts
      transaction.set(col.doc(), {
        name: name.trim(),
        normalizedName,
        addedAt: Date.now(),
        addedBy,
        recurring: false,
        checked: false,
      });
```

In `functions/src/bot/handleUpdate.ts`, delete the line `import * as trips from '../firestore/trips';` and replace the whole `at_store` case with:

```ts
    case 'at_store': {
      await deps.sendMessage(chatId, `בהצלחה בסופר! 🛒\n${deps.pagesBaseUrl}/`);
      break;
    }
```

Then remove the now-unused trip code:

```bash
git rm functions/src/firestore/trips.ts functions/src/firestore/trips.test.ts
```

- [ ] **Step 4: Run the tests and the type-check to verify they pass**

```bash
cd functions && npx vitest run src/firestore src/bot --no-file-parallelism && npx tsc --noEmit && echo TSC_OK && npm test
```
Expected: all tests in `src/firestore` (items) and `src/bot` (handleUpdate) pass, `TSC_OK`, and the parser suite (`npm test`) passes.

- [ ] **Step 5: Stop the emulator and commit**

Stop the emulator (`powershell -c "Get-Process java | Stop-Process -Force"`), then from the repo root:

```bash
git add functions/src/firestore/items.ts functions/src/firestore/items.test.ts functions/src/bot/handleUpdate.ts functions/src/bot/handleUpdate.test.ts
git commit -m "$(cat <<'EOF'
Reply to "אני בסופר" with the list link and store new items unticked

Ticks now live on the items and a trip is written only at finish, so the bot
no longer creates or looks up a trip.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git status --short
```
Expected: the deletions of `trips.ts` and `trips.test.ts` are already staged from `git rm` and are part of this commit; `git status --short` then shows nothing (a pre-existing `.claude/scheduled_tasks.lock`, if listed, must not be added).

---

### Task 5: Full verification, docs note, deploy

**Files:**
- Modify: `docs/superpowers/specs/2026-09-16-shopping-list-bot-design.md` (one note line)

**Interfaces:**
- Consumes: everything from Tasks 1 to 4.
- Produces: the feature live on GitHub Pages and in the deployed function.

- [ ] **Step 1: Run every suite once more**

From the repo root: `npm test` (web). Start the emulator as in Task 4 Step 2, then `cd functions && npx vitest run src/firestore src/bot --no-file-parallelism && npm test && npx tsc --noEmit && echo TSC_OK`. Stop the emulator afterwards.
Expected: everything passes.

- [ ] **Step 2: Note the supersession in the original spec**

In `docs/superpowers/specs/2026-09-16-shopping-list-bot-design.md`, insert directly under the title line `# SuperBot: Shared Shopping List Bot - Design` (with a blank line before and after):

```markdown
> **Partly superseded:** the trip page, the "אני בסופר" flow and the `trips` data shape are replaced by [2026-09-19-unified-list-view-design.md](2026-09-19-unified-list-view-design.md).
```

Commit:

```bash
git add docs/superpowers/specs/2026-09-16-shopping-list-bot-design.md
git commit -m "$(cat <<'EOF'
Point the original design at the spec that replaces its trip page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Push the web files and wait for GitHub Pages**

Web first, as the spec's rollout says:

```bash
git push origin master
gh run list --repo ghemed/SuperBot --limit 1 --json databaseId,status
```
Take the run's `databaseId` and run `gh run watch <databaseId> --repo ghemed/SuperBot --exit-status`. Expected: success.

- [ ] **Step 4: Check the live site (read-only)**

Navigate the browser pane to `https://ghemed.github.io/SuperBot/` and run:

```js
await new Promise((r) => setTimeout(r, 2500));
JSON.stringify({
  screens: ['screen-list', 'screen-recap', 'screen-done'].map((id) => !!document.getElementById(id)),
  rows: [...document.querySelectorAll('#list li')].map((li) => ({
    box: !!li.querySelector('.box'), icon: li.querySelector('.item-icon')?.textContent,
    tag: !!li.querySelector('.tag'), del: !!li.querySelector('.icon-btn'),
  })),
  meta: document.getElementById('meta').textContent,
});
```
Expected: three `true` screens, every row has `box`, an icon, `tag` and `del` all truthy, and `meta` like `N פריטים`. Do not tick, edit or delete anything on the live list. Then navigate to `https://ghemed.github.io/SuperBot/trip.html?id=abc` and confirm it lands on `/SuperBot/index.html`. If the page looks stale, the Pages CDN may still be serving the previous build: wait a minute and reload.

- [ ] **Step 5: Deploy the bot**

```bash
npm --prefix functions run build
firebase deploy --only functions --project=superbot-abedf
```
Expected: `Deploy complete!`. Do not run any command that prints secret values.

- [ ] **Step 6: Hand over for the real end-to-end check**

Tell the user, in plain words, what to try on the real devices: send "אני בסופר" to the bot and confirm the reply link opens the main list; tick an item on one phone and watch it tick on the other; tap the name to edit, "קבוע" to toggle, and the X to delete; press "סיימתי לקנות", choose what stays, confirm, and check that the history page shows the trip and kept items are back unticked. Report anything odd; do not modify the live list yourself.

---

## Self-Review

**Spec coverage:**
- One page always, rows with checkbox/icon/editable name/קבוע/delete, add bar, count and ticked count: Task 2 (index.html, list-page.js).
- Ticking any time, shared live, only the checkbox ticks, larger tap target: Task 2 (`setChecked`, `.box` styles).
- Finish button after a tick, recap screen with recurring candidates, done screen with a way back, all as screens of one page: Task 2 (list-page.js, index.html).
- Other phone sees finished items vanish or untick: follows from the shared items listener (Task 2, no extra code).
- History rows are not links: Task 3.
- "אני בסופר" replies with the list link and creates nothing: Task 4.
- Old `trip.html?id=` links redirect: Task 2 Step 6, verified in Step 9 and Task 5 Step 4.
- Data model (`checked`, trips written only at finish, unchanged `purchaseHistory` and index): Task 2 (`addItem`, `finishTrip`), Task 4 (`addItems`).
- Finish transaction (re-read, count only existing and ticked, no-op returns null, in-place keep, delete otherwise, returns `{ purchased, kept }`): Task 1 (logic) and Task 2 (`finishTrip`).
- Delete `trips.ts` and its tests, `trip-page.js`: Task 4, Task 2.
- Error handling convention (log failed clicks, alert on failed finish): Task 2 (`logFailure`, alerts).
- Testing plan (pure logic test-first, bot tests, stubbed-UI harness, one real run): Tasks 1, 4, 2 Step 9, Task 5 Step 6.
- Rollout order (web first, then function): Task 5 Steps 3 and 5.
- Supersession note: Task 5 Step 2.

**Placeholder scan:** none; every code step carries full code and every verification step has an exact expected result.

**Type consistency:** `planFinish(snapshots, keepItemIds)` returns `{ items, purchased, recurringDecisions }` in Task 1 and is consumed with those names in `finishTrip` (Task 2). `finishTrip(checkedItems, keepItemIds)` returns `null | { purchased, kept }` and `showDone` reads `result.kept` (Task 2). `setChecked(itemId, checked)` is exported by `db.js` and imported by `list-page.js`. `checked` is a boolean field named identically in `db.js`, `finish-plan.js`, `items.ts` and the tests.
