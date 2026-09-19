# SuperBot: Shared Shopping List Bot - Design

> **Partly superseded:** the trip page, the "אני בסופר" flow and the `trips` data shape are replaced by [2026-09-19-unified-list-view-design.md](2026-09-19-unified-list-view-design.md).

## Overview

A Telegram bot + companion web app that lets a couple maintain one shared
grocery list using plain natural-language messages, and run each shopping
trip through an interactive checklist page that also becomes a permanent
history record.

Goals:
- Add/remove items by texting the bot naturally (no slash commands).
- Shared list, but no notification noise - each person only hears back
  in their own chat, when they ask.
- A "we're at the store" flow that hands off to a live, editable web page.
- Each shopping trip is preserved as history, with room to add prices later.
- The web app is also a full editor for the list at any time, not just
  during a trip.

Out of scope for this version: price tracking (data model leaves room for
it), multiple households/lists, recipe or meal-planning features.

## Platform choices

- **Messaging**: Telegram Bot API (free, simple, no business-account
  overhead). Each spouse talks to the bot in their own private 1:1 chat.
- **Backend**: Firebase (Cloud Functions for the bot logic, Firestore for
  shared state). No server to keep running - functions wake on events.
- **Frontend**: Plain HTML/CSS/JS, no build step, published into a
  `superbot/` subfolder of the user's existing `<username>.github.io` repo.
  Talks to Firestore directly via the Firebase JS SDK (loaded from
  Firebase's CDN as an ES module) for realtime sync between viewers.
- **NLU fallback**: Claude Haiku via the Anthropic API, called only when
  simple keyword rules can't confidently classify a message.

## Architecture

```
Telegram (2 private chats) --webhook--> Firebase Cloud Function
                                                |
                                    hybrid parser (rules -> Claude Haiku)
                                                |
                                                v
                                           Firestore
                                    (items / trips / purchase history)
                                                ^
                                                |  direct read/write, realtime
                                                |
                            GitHub Pages: <username>.github.io/superbot/
                         (Firebase JS SDK, anonymous auth, no build step)
```

There is no server process to keep alive: Cloud Functions run per Telegram
webhook call; the static page talks to Firestore directly for realtime
sync (no function round-trip needed for checkbox updates).

## Data model (Firestore)

Single household - only ever two members, so no multi-tenant design needed.

```
households/main
  memberChatIds: [chatIdA, chatIdB]      # links Telegram identities to this household
  memberUids: [authUidA, authUidB]       # links Firebase anonymous-auth identities

households/main/items/{itemId}
  name: string
  normalizedName: string                 # lowercased/trimmed, used for matching "הסר" targets
  addedAt: timestamp
  addedBy: chatId
  recurring: boolean                     # manual pin, shown as a "קבוע" tag

households/main/trips/{tripId}
  status: "active" | "completed"
  startedAt, startedBy, completedAt
  checkedItemIds: [itemId, ...]          # live, updated as checkboxes are tapped
  purchased: [{ itemId, name, price: null }]   # frozen at completion; price is future use
  recurringDecisions: [{ name, kept: boolean }]

households/main/purchaseHistory/{normalizedName}
  name: string
  purchases: [{ tripId, date }, ...]     # append-only, used for recurring detection
```

## Message parsing (hybrid)

1. **Special phrases first** (checked before anything else, with common
   variations): "הצג רשימה" -> show list; "אני בסופר" -> start/resume trip.
2. **Rule-based pass**: if the message starts with a removal keyword
   (הסר/מחק/תוריד + variants), treat the rest as item(s) to remove.
   Otherwise, if it doesn't look ambiguous, treat it as item(s) to add.
   Split on commas / "ו" for multiple items in one message
   ("חלב, ביצים ולחם").
3. **AI fallback**: if the rule pass isn't confident (no clear keyword,
   phrasing like "אין לנו יותר קפה" or "צריך לקנות עגבניות"), send the
   message to Claude Haiku with a short prompt that returns strict JSON:
   `{ action: "add" | "remove" | "show" | "at_store" | "unclear", items: [string, ...] }`.
4. If still `unclear`, the bot replies asking to rephrase rather than
   guessing.

## Bot flows

- **Add/remove**: writes to `items`, replies briefly ("נוסף: חלב") only
  in the sender's own chat. The other chat gets nothing - no push
  notifications on regular list edits.
- **הצג רשימה**: replies with the current item list as plain text.
- **אני בסופר**: looks for a trip in `households/main/trips` with
  `status == "active"`. If one exists, resend its link (so a duplicate
  "אני בסופר", or both spouses shopping together, land on the same live
  trip instead of splitting progress). Otherwise create a new trip
  document and send its link.

## Frontend pages

**Main list page** (`/superbot/`) - always-available editor for the
shared list:
- Add item, delete item, rename item.
- Manual toggle for the "קבוע" (recurring) tag, independent of the
  automatic detection below.
- Banner with a link to the active trip, if one exists.
- Link to the history page.

**Trip page** (`/superbot/trip/{tripId}`) - created fresh per shopping
trip:
- Shows the live item list with checkboxes. Checking an item updates
  `checkedItemIds` on the trip doc (not the item itself), so items added
  mid-trip (via Telegram or the main page) just appear without conflict.
- "סיימתי לקנות" button: shows an inline recap of the checked items,
  plus - for whichever of those checked items are either manually
  pinned `recurring: true` or were purchased in at least 3 of the last 4
  completed trips (see below) - a toggle per item, defaulted to "keep on
  the list", before confirming.
- Confirming: deletes the `items` docs for every checked item that was
  *not* toggled to stay, re-creates a fresh `items` doc for every one
  that *was* (so it remains on the shared list going forward), marks the
  trip `completed`, and freezes the `purchased` + `recurringDecisions`
  fields as that trip's permanent record. This all happens directly from
  the browser against Firestore, covered by the same security rules as
  everything else - no server round-trip needed.
- After completion, the page becomes a read-only record of that trip.

**History page** (`/superbot/history`) - lists every trip by date; each
entry opens its own (now read-only) trip page.

## Recurring-item detection

On trip completion, for every purchased item: append `{ tripId, date }` to
`purchaseHistory/{normalizedName}.purchases` (append-only - at personal
scale this is at most a few hundred entries over years, so no pruning is
needed). An item is suggested as "recurring" at the next trip's finish
step if either:
- it's manually pinned (`items.recurring == true`), or
- its purchase history's `tripId`s include at least 3 of the household's
  4 most-recently-completed trips (trip-count-based, not
  calendar-week-based, so skipping a week doesn't break detection - and
  fewer than 4 completed trips so far simply means no item qualifies yet).

## Auth & security

- Both spouses' browsers sign in to Firebase anonymously and
  transparently (no login screen). Their resulting UIDs are recorded
  once, manually, in `households/main.memberUids` during setup.
- Firestore security rules restrict all reads/writes under
  `households/main/**` to requests whose `auth.uid` is in
  `memberUids` - nobody else can read or edit the list even though the
  page itself is publicly reachable.
- The Anthropic API key used for the NLU fallback is stored as a Cloud
  Functions secret, never exposed to the frontend.

## Deployment

- One Firebase project: a single Cloud Function (the Telegram webhook,
  which also makes the Claude Haiku call for NLU fallback) and
  Firestore. Trip finalization and all list editing happen client-side
  against Firestore, covered by the security rules above - no additional
  functions needed.
- Frontend has no build step - plain files, Firebase SDK imported from
  Firebase's CDN. Deploying an update means copying the updated files
  into the `superbot/` folder of the existing `<username>.github.io`
  repo and pushing - the rest of that repo is untouched.

## Future (explicitly deferred)

- Price tracking: `trips.purchased[].price` already exists as a field,
  left `null` until this is built - no schema migration needed later.
- Anything beyond a single shared household list.
