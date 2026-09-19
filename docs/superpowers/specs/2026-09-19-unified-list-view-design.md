# SuperBot: One List View for Editing and Shopping - Design

## Overview

Today the app has two list screens: the main page (edit, rename, delete, the
"קבוע" tag) and a separate per-trip page (checkboxes, "סיימתי לקנות"). You only
get the editing controls after finishing the trip, and only get checkboxes
after sending "אני בסופר".

This change makes the main page the only list screen. Every row always has
a checkbox, the product icon, an editable name, the "קבוע" tag and a delete
button, and "סיימתי לקנות" appears as soon as anything is ticked. Ticking
works at any time; nobody has to say "אני בסופר" first.

Out of scope: ordering the list by product category (a separate spec follows),
price tracking, any change to how recurring items are detected.

This spec supersedes the trip-page parts of the 2026-09-16 design: the
"Trip page" and "History page" entries under *Frontend pages*, the
"אני בסופר" entry under *Bot flows*, and the `trips` shape under *Data model*.
Everything else in that document still applies.

## What the user sees

- **One page, always** (`index.html`). Each row: checkbox, icon, editable
  name, "קבוע" tag, delete. The add bar stays under the list. The header
  shows the item count and, once something is ticked, how many are ticked
  ("6 פריטים · 2 סומנו").
- **Ticking is shared live** between both phones, and works with or without
  a prior "אני בסופר". Only the checkbox ticks an item; the name is edited in
  place as it is on today's main page. The checkbox gets a larger tap target
  than today so it is easy to hit in the store.
- **Finishing.** A "סיימתי לקנות" button appears at the bottom once at least
  one item is ticked. It opens the existing "להישאר ברשימה?" screen (recurring
  candidates pre-selected), then a done screen with a button back to the list.
  These are screens inside the same page, not separate pages.
- **After finishing on one phone**, the other phone simply sees the ticked
  items disappear (or become unticked, if they were kept) through the live list.
- **History page** is unchanged except that its rows are no longer links; each
  row already shows the date and what was bought.
- **"אני בסופר"** replies with a link to this same page.
- Old links of the form `trip.html?id=...` (already sent in Telegram) keep
  working: `trip.html` becomes a stub that redirects to `index.html`.

## Data model

Ticks live on the item, and a trip is only written when it is finished.

```
households/main/items/{itemId}
  ...existing fields...
  checked: boolean          # NEW. Absent on existing items = not ticked.

households/main/trips/{tripId}          # written only at finish
  status: "completed"
  completedAt
  purchased: [{ itemId, name, price: null }]
  recurringDecisions: [{ name, kept: boolean }]
```

`households/main/purchaseHistory` is unchanged. The `trips` collection keeps
`status: "completed"` so the existing history query and its Firestore index
need no change. `checkedItemIds`, `startedAt`, `startedBy` and the
`status: "active"` state are no longer created. Any leftover `active` trip
document from earlier testing is ignored. Existing items need no migration.

Security rules are unchanged (any signed-in user can read and write under
`households/main/**`).

## Finish flow

`finishTrip(checkedItems, keepItemIds)` in `web/js/db.js` runs one Firestore
transaction:

1. Re-read every item in `checkedItems` inside the transaction, before any
   write. An item counts only if it still exists **and** is still ticked.
   This is what makes a double tap, or both phones finishing at once, safe:
   the second run finds the items already deleted or unticked and does nothing.
2. If no item counts, write nothing and return `null`.
3. Otherwise create the trip document (`status: "completed"`, `completedAt`,
   `purchased`, `recurringDecisions`, built from the freshly read names) and,
   per counted item:
   - append `{ tripId, date }` to `purchaseHistory/{normalizedName}` as today;
   - if kept: update the same item in place to `checked: false, recurring: true`
     (today it is deleted and re-created; updating in place is simpler and
     leaves the same result);
   - if not kept: delete it.
4. Return `{ purchased, kept }` so the page can show the done screen on the
   device that finished.

The decision in steps 1 to 3 (which items count, what goes in `purchased`,
`recurringDecisions`, the kept and deleted sets) is a pure function in
`web/js/finish-plan.js`, so it can be unit-tested without Firestore. The
recap screen still freezes the reviewed item set when "סיימתי לקנות" is
pressed, as it does today; if another phone changes an item in the meantime,
the transaction simply skips items that are no longer ticked.

`getRecurringCandidates` is unchanged.

## Bot

- "אני בסופר" replies `בהצלחה בסופר! 🛒` plus the link to the main page
  (`${pagesBaseUrl}/`) and creates nothing.
- `functions/src/firestore/trips.ts` and its tests are deleted; nothing else
  uses them.
- New items created by the bot are written with `checked: false`, matching
  items created from the web page.

## Files

| File | Change |
| --- | --- |
| `web/index.html` | Gains the recap and done screens and the finish footer; loses the active-trip banner. |
| `web/js/list-page.js` | Becomes the single controller: ticking, edit, delete, recurring tag, finish flow (absorbs `trip-page.js`). |
| `web/js/trip-page.js` | Deleted. |
| `web/trip.html` | Replaced by a redirect stub to `index.html`. |
| `web/js/db.js` | Remove `watchActiveTrip`, `watchTrip`, `toggleChecked`; add `setChecked(itemId, checked)`; rewrite `finishTrip`; `addItem` sets `checked: false`. |
| `web/js/finish-plan.js` + test | New pure decision logic for the finish transaction. |
| `web/js/history-page.js`, `web/style.css` | History rows become plain rows (no link). |
| `functions/src/bot/handleUpdate.ts` + test | "אני בסופר" reply; no trip creation. |
| `functions/src/firestore/trips.ts` + test | Deleted. |
| `functions/src/firestore/items.ts` | `addItems` writes `checked: false`. |

## Error handling

Follows the existing convention: failed writes from a click are logged with
`console.error` and leave the UI unchanged (the live listener corrects it);
a failed finish shows an alert and re-enables the button. Ticking an item
that another device just deleted fails with "not found", is logged, and the
row disappears through the live list.

## Testing

- `finish-plan.js` is written test-first with vitest: counts only items that
  still exist and are ticked; skips items already unticked or deleted; kept
  versus deleted split; uses the freshly read names; empty result returns
  nothing.
- Bot: the "אני בסופר" reply test now expects the exact main-page link and
  asserts no trip document is created; `addItems` tests assert `checked: false`.
- UI: the unified page is checked in the browser pane with a temporary,
  uncommitted harness that stubs the data layer (rows, ticking, finish and
  recap and done screens, hostile item names rendered as text), then once
  read-only against the live site. The finish transaction itself is verified by
  one real run (tick on two devices, finish, confirm history and recurring).

## Rollout

Deploy the web files first, then the function. Either order is safe: a bot
reply still carrying an old `trip.html?id=...` link redirects to the new page.
