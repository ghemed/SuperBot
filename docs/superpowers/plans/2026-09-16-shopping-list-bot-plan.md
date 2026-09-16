# SuperBot Shopping List Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Telegram bot + Firebase backend + static web app that lets a couple manage one shared shopping list by texting plain Hebrew, and run each shopping trip through a live checklist page that becomes permanent history.

**Architecture:** A single Firebase Cloud Function receives Telegram webhook calls, parses messages with a hybrid rule-based/Claude-Haiku engine, and reads/writes Firestore. A no-build static site (deployed into the user's existing `<username>.github.io` repo under `/superbot/`) talks to the same Firestore directly via the client SDK for realtime sync, full list editing, the per-trip checklist flow, and trip history.

**Tech Stack:** TypeScript + Firebase Cloud Functions v2 + Firestore (backend), Vitest + Firestore Emulator (tests), plain HTML/CSS/JS + Firebase JS SDK via CDN (frontend), Telegram Bot API, Anthropic API (Claude Haiku).

---

## Prerequisites — things only you can do

Most of these are one-time setup, needed before Task 11 (deploy) and Task 13 (frontend). Gather them whenever convenient — you don't need all of them on day one.

- [ ] Create a Telegram bot via **@BotFather** (`/newbot`, pick a name + username) → save the **bot token**.
- [ ] Get your and your wife's numeric Telegram **chat IDs** — message **@userinfobot** from each account, it replies with the ID.
- [ ] Create or pick a **Firebase project** at https://console.firebase.google.com → note the **project ID**.
- [ ] In that project: enable **Firestore** (production mode, any region) and enable **Anonymous** sign-in under Authentication → Sign-in method.
- [ ] Upgrade the project to the **Blaze (pay-as-you-go)** plan — required for Cloud Functions to call external APIs (Telegram, Anthropic), even within free-tier usage. Needs a payment method on the Google account.
- [ ] Get an **Anthropic API key** from https://console.anthropic.com (billed separately from your Claude subscription; Haiku pricing at two-person message volume will be a few cents a month).
- [ ] Run `firebase login` locally once (opens a browser to authorize the Firebase CLI).
- [ ] Have ready: the local path to your existing `<username>.github.io` repo clone, and your GitHub Pages URL (e.g. `https://<username>.github.io/superbot`).

---

## Task 1: Project scaffolding

**Files:**
- Create: `functions/package.json`
- Create: `functions/tsconfig.json`
- Create: `functions/.gitignore`
- Create: `firebase.json`
- Create: `.firebaserc`
- Create: `firestore.rules`
- Create: `firestore.indexes.json`
- Create: `.gitignore`

- [ ] **Step 1: Create `functions/package.json`**

```json
{
  "name": "superbot-functions",
  "version": "1.0.0",
  "private": true,
  "main": "lib/index.js",
  "engines": { "node": "20" },
  "scripts": {
    "build": "tsc",
    "test": "vitest run src/parser",
    "test:emulator": "vitest run src/firestore src/__tests__ src/bot",
    "deploy": "npm run build && firebase deploy --only functions"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.30.0",
    "firebase-admin": "^12.6.0",
    "firebase-functions": "^5.1.0"
  },
  "devDependencies": {
    "@firebase/rules-unit-testing": "^3.0.4",
    "@types/node": "^20.14.0",
    "firebase": "^10.14.1",
    "typescript": "^5.5.4",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 2: Create `functions/tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2022",
    "lib": ["es2022"],
    "outDir": "lib",
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "moduleResolution": "node"
  },
  "compileOnSave": true,
  "include": ["src"],
  "exclude": ["src/**/*.test.ts", "src/**/__tests__/**"]
}
```

- [ ] **Step 3: Create `functions/.gitignore`**

```
lib/
node_modules/
.env
.env.*
!.env.example
```

- [ ] **Step 4: Create `firebase.json`**

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "functions": {
    "source": "functions",
    "runtime": "nodejs20"
  },
  "emulators": {
    "firestore": { "port": 8080 },
    "functions": { "port": 5001 },
    "auth": { "port": 9099 },
    "ui": { "enabled": true }
  }
}
```

- [ ] **Step 5: Create `.firebaserc`**

```json
{
  "projects": {
    "default": "REPLACE_WITH_YOUR_FIREBASE_PROJECT_ID"
  }
}
```

Replace the value once you've created your Firebase project (see Prerequisites) — needed before Task 11.

- [ ] **Step 6: Create `firestore.rules` (deny-all placeholder — Task 9 replaces this)**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 7: Create `firestore.indexes.json`**

```json
{
  "indexes": [
    {
      "collectionGroup": "trips",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "completedAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

This supports the "last 4 completed trips" and history-page queries added in later tasks.

- [ ] **Step 8: Create root `.gitignore`**

```
node_modules/
functions/lib/
functions/.env
functions/.env.*
!functions/.env.example
firebase-debug.log
firestore-debug.log
ui-debug.log
*.local
```

- [ ] **Step 9: Install dependencies**

Run: `npm --prefix functions install`
Expected: completes with no errors, `functions/node_modules` exists.

- [ ] **Step 10: Commit**

```bash
git add functions/package.json functions/package-lock.json functions/tsconfig.json functions/.gitignore firebase.json .firebaserc firestore.rules firestore.indexes.json .gitignore
git commit -m "Scaffold Firebase project structure"
```

---

## Task 2: `normalizeItemName`

**Files:**
- Create: `functions/src/parser/normalize.ts`
- Test: `functions/src/parser/normalize.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// functions/src/parser/normalize.test.ts
import { describe, it, expect } from 'vitest';
import { normalizeItemName } from './normalize';

describe('normalizeItemName', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeItemName('  חלב  ')).toBe('חלב');
  });

  it('collapses internal whitespace runs', () => {
    expect(normalizeItemName('גבינה   צהובה')).toBe('גבינה צהובה');
  });

  it('lowercases latin characters', () => {
    expect(normalizeItemName('Milk')).toBe('milk');
  });

  it('treats two differently-spaced writings of the same item as equal', () => {
    expect(normalizeItemName('חלב 3%')).toBe(normalizeItemName('  חלב   3%  '));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix functions run test -- normalize.test.ts`
Expected: FAIL - `Cannot find module './normalize'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// functions/src/parser/normalize.ts
export function normalizeItemName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix functions run test -- normalize.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add functions/src/parser/normalize.ts functions/src/parser/normalize.test.ts
git commit -m "Add normalizeItemName for item-name matching"
```

---

## Task 3: `splitItems`

**Files:**
- Create: `functions/src/parser/splitItems.ts`
- Test: `functions/src/parser/splitItems.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// functions/src/parser/splitItems.test.ts
import { describe, it, expect } from 'vitest';
import { splitItems } from './splitItems';

describe('splitItems', () => {
  it('returns a single item unchanged', () => {
    expect(splitItems('חלב')).toEqual(['חלב']);
  });

  it('splits a comma-separated list', () => {
    expect(splitItems('חלב, ביצים, לחם')).toEqual(['חלב', 'ביצים', 'לחם']);
  });

  it('splits a trailing vav-conjunction item', () => {
    expect(splitItems('חלב, ביצים ולחם')).toEqual(['חלב', 'ביצים', 'לחם']);
  });

  it('splits two items joined only by a vav conjunction', () => {
    expect(splitItems('חלב ולחם')).toEqual(['חלב', 'לחם']);
  });

  it('splits on newlines', () => {
    expect(splitItems('חלב\nביצים')).toEqual(['חלב', 'ביצים']);
  });

  it('drops empty chunks from stray commas', () => {
    expect(splitItems('חלב,, ביצים')).toEqual(['חלב', 'ביצים']);
  });

  it('does not split a single word that happens to start with vav', () => {
    expect(splitItems('וופלים')).toEqual(['וופלים']);
  });

  it('does not corrupt a double-vav loanword when it is not the first item', () => {
    expect(splitItems('חלב, וופלים')).toEqual(['חלב', 'וופלים']);
    expect(splitItems('חלב וופלים')).toEqual(['חלב', 'וופלים']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix functions run test -- splitItems.test.ts`
Expected: FAIL - `Cannot find module './splitItems'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// functions/src/parser/splitItems.ts
// A word boundary splits either on a single vav directly followed by a
// non-vav Hebrew letter (the conjunction "ו", "and" - consumed, so "ולחם"
// becomes "לחם"), or on whitespace directly before a double vav ("וו",
// consumed only up to the space) - Hebrew loanwords spell an initial "w"
// sound with a double vav (e.g. וופלים/waffles), and that must not be
// mistaken for "ו" + a word starting with vav (e.g. ורד/rose - which is
// genuinely ambiguous with the conjunction and left to the AI fallback).
const ITEM_SEPARATOR = /\s+ו(?=[א-הז-ת])|\s+(?=וו)/;

export function splitItems(text: string): string[] {
  return text
    .split(/[,\n]/)
    .flatMap((chunk) => chunk.split(ITEM_SEPARATOR))
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix functions run test -- splitItems.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add functions/src/parser/splitItems.ts functions/src/parser/splitItems.test.ts
git commit -m "Add splitItems to handle multi-item Hebrew messages"
```

---

## Task 4: `parseRuleBased`

**Files:**
- Create: `functions/src/parser/ruleParser.ts`
- Test: `functions/src/parser/ruleParser.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// functions/src/parser/ruleParser.test.ts
import { describe, it, expect } from 'vitest';
import { parseRuleBased } from './ruleParser';

describe('parseRuleBased', () => {
  it('treats a bare item as an add', () => {
    expect(parseRuleBased('חלב')).toEqual({ action: 'add', items: ['חלב'] });
  });

  it('splits multiple bare items as an add', () => {
    expect(parseRuleBased('חלב, ביצים ולחם')).toEqual({
      action: 'add',
      items: ['חלב', 'ביצים', 'לחם'],
    });
  });

  it('recognizes "הסר X" as a removal', () => {
    expect(parseRuleBased('הסר חלב')).toEqual({ action: 'remove', items: ['חלב'] });
  });

  it('recognizes other removal keywords', () => {
    expect(parseRuleBased('מחק ביצים')).toEqual({ action: 'remove', items: ['ביצים'] });
    expect(parseRuleBased('תוריד לחם')).toEqual({ action: 'remove', items: ['לחם'] });
  });

  it('strips a leading object marker "את" after a removal keyword', () => {
    expect(parseRuleBased('הסר את החלב')).toEqual({ action: 'remove', items: ['החלב'] });
  });

  it('returns null for a question', () => {
    expect(parseRuleBased('מה יש ברשימה?')).toBeNull();
  });

  it('returns null for ambiguous "אין לנו" phrasing, deferring to AI', () => {
    expect(parseRuleBased('אין לנו יותר קפה')).toBeNull();
  });

  it('returns null for an empty message', () => {
    expect(parseRuleBased('   ')).toBeNull();
  });

  it('splits a multi-line removal message instead of falling through to add', () => {
    expect(parseRuleBased('מחק\nחלב\nביצים')).toEqual({
      action: 'remove',
      items: ['חלב', 'ביצים'],
    });
  });

  it('defers to AI when a removal message has an ambiguous trailing line', () => {
    expect(parseRuleBased('מחק חלב\nהאם בסדר?')).toBeNull();
  });

  it('defers to AI for a bare removal keyword with nothing to remove', () => {
    expect(parseRuleBased('מחק')).toBeNull();
    expect(parseRuleBased('מחק את')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix functions run test -- ruleParser.test.ts`
Expected: FAIL - `Cannot find module './ruleParser'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// functions/src/parser/ruleParser.ts
import { splitItems } from './splitItems';

export interface RuleParseResult {
  action: 'add' | 'remove';
  items: string[];
}

// The `s` (dotAll) flag is required: without it, `.` can't cross a newline
// and `$` needs the true end of string, so a removal keyword followed by a
// multi-line message (an ordinary shift+enter on Telegram) fails to match
// at all - and silently falls through to being treated as an *add* of the
// keyword itself, rather than deferring or erroring.
const REMOVE_PATTERN = /^(?:תוריד|הורד|הסר|מחק|תסיר)\s+(?:את\s+)?(.+)$/su;
// \b is ASCII-only in JS regex (defined via \w) and never matches next to
// Hebrew letters, so a keyword boundary has to be spelled out as
// whitespace-or-end instead of \b.
const AMBIGUOUS_START_PATTERN = /[?]|^(?:אין|צריך|כדאי|נגמר)(?:\s|$)/u;
// A removal keyword with nothing to remove (e.g. just "מחק", possibly
// followed by the bare object marker "את") is ambiguous, not an add of the
// keyword itself - defer to the AI fallback rather than guessing.
// Known accepted gap: a keyword directly followed by punctuation with no
// item (e.g. "מחק!") isn't caught here and falls through to being added as
// a literal item - low-probability, self-evidently wrong if it ever
// happens, and easy to delete from the list, so not worth the added
// complexity of a punctuation-stripping check.
const BARE_REMOVE_PATTERN = /^(?:תוריד|הורד|הסר|מחק|תסיר)(?:\s+את)?\s*$/u;

export function parseRuleBased(message: string): RuleParseResult | null {
  const trimmed = message.trim();
  if (trimmed.length === 0) return null;

  // Checked before REMOVE_PATTERN, and against the whole message: since
  // REMOVE_PATTERN's capture now spans newlines (see the dotAll comment
  // above), a removal keyword earlier in the message would otherwise let a
  // question or ambiguous phrase on a later line get swallowed in as a
  // literal item instead of deferring to the AI fallback.
  if (AMBIGUOUS_START_PATTERN.test(trimmed)) {
    return null;
  }

  if (BARE_REMOVE_PATTERN.test(trimmed)) {
    return null;
  }

  const removeMatch = trimmed.match(REMOVE_PATTERN);
  if (removeMatch) {
    const items = splitItems(removeMatch[1]);
    return items.length > 0 ? { action: 'remove', items } : null;
  }

  const items = splitItems(trimmed);
  return items.length > 0 ? { action: 'add', items } : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix functions run test -- ruleParser.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
git add functions/src/parser/ruleParser.ts functions/src/parser/ruleParser.test.ts
git commit -m "Add rule-based add/remove message parser"
```

---

## Task 5: `claudeParser` (AI fallback)

**Files:**
- Create: `functions/src/parser/claudeParser.ts`
- Test: `functions/src/parser/claudeParser.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// functions/src/parser/claudeParser.test.ts
import { describe, it, expect } from 'vitest';
import { createClaudeParser } from './claudeParser';

function mockCreate(responseText: string) {
  return async () => ({ content: [{ type: 'text', text: responseText }] });
}

describe('createClaudeParser', () => {
  it('parses a valid JSON response', async () => {
    const parse = createClaudeParser(mockCreate('{"action":"add","items":["קפה"]}'));
    await expect(parse('אין לנו יותר קפה')).resolves.toEqual({
      action: 'add',
      items: ['קפה'],
    });
  });

  it('falls back to unclear on malformed JSON', async () => {
    const parse = createClaudeParser(mockCreate('not json'));
    await expect(parse('???')).resolves.toEqual({ action: 'unclear', items: [] });
  });

  it('falls back to unclear on an unrecognized action value', async () => {
    const parse = createClaudeParser(mockCreate('{"action":"delete_everything","items":[]}'));
    await expect(parse('משהו מוזר')).resolves.toEqual({ action: 'unclear', items: [] });
  });

  it('falls back to unclear when the response has no text block', async () => {
    const parse = createClaudeParser(async () => ({ content: [{ type: 'image' }] }));
    await expect(parse('משהו')).resolves.toEqual({ action: 'unclear', items: [] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix functions run test -- claudeParser.test.ts`
Expected: FAIL - `Cannot find module './claudeParser'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// functions/src/parser/claudeParser.ts
export interface AiParsedMessage {
  action: 'add' | 'remove' | 'show' | 'at_store' | 'unclear';
  items: string[];
}

type ClaudeContentBlock = { type: string; text?: string };
type ClaudeResponse = { content: ClaudeContentBlock[] };
export type ClaudeMessagesCreate = (args: {
  model: string;
  max_tokens: number;
  system: string;
  messages: { role: 'user'; content: string }[];
}) => Promise<ClaudeResponse>;

const VALID_ACTIONS = ['add', 'remove', 'show', 'at_store', 'unclear'];

const SYSTEM_PROMPT = `את/ה מפענח/ת הודעות לבוט רשימת קניות בעברית.
קבע/י פעולה אחת: add (הוספת פריטים), remove (הסרת פריטים), show (בקשה לראות
את הרשימה), at_store (הודעה שהמשתמש/ת בסופר עכשיו), או unclear (לא ברור).
החזר/י אך ורק JSON תקין בפורמט:
{"action":"add"|"remove"|"show"|"at_store"|"unclear","items":["פריט1","פריט2"]}
עבור show/at_store/unclear החזר/י items כמערך ריק.`;

export function createClaudeParser(createMessage: ClaudeMessagesCreate) {
  return async function aiParse(text: string): Promise<AiParsedMessage> {
    const response = await createMessage({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: text }],
    });

    const block = response.content[0];
    if (!block || block.type !== 'text' || !block.text) {
      return { action: 'unclear', items: [] };
    }

    try {
      const parsed = JSON.parse(block.text);
      if (
        typeof parsed.action === 'string' &&
        VALID_ACTIONS.includes(parsed.action) &&
        Array.isArray(parsed.items)
      ) {
        return parsed as AiParsedMessage;
      }
    } catch {
      // falls through to unclear below
    }
    return { action: 'unclear', items: [] };
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix functions run test -- claudeParser.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add functions/src/parser/claudeParser.ts functions/src/parser/claudeParser.test.ts
git commit -m "Add Claude Haiku fallback parser for ambiguous messages"
```

---

## Task 6: `parseMessage` (special phrases + integration)

**Files:**
- Create: `functions/src/parser/parseMessage.ts`
- Test: `functions/src/parser/parseMessage.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// functions/src/parser/parseMessage.test.ts
import { describe, it, expect, vi } from 'vitest';
import { parseMessage } from './parseMessage';

describe('parseMessage', () => {
  it('recognizes "הצג רשימה" without calling AI', async () => {
    const aiParse = vi.fn();
    const result = await parseMessage('הצג רשימה', aiParse);
    expect(result).toEqual({ action: 'show', items: [] });
    expect(aiParse).not.toHaveBeenCalled();
  });

  it('recognizes "אני בסופר" without calling AI', async () => {
    const aiParse = vi.fn();
    const result = await parseMessage('אני בסופר', aiParse);
    expect(result).toEqual({ action: 'at_store', items: [] });
    expect(aiParse).not.toHaveBeenCalled();
  });

  it('uses the rule engine for a plain add without calling AI', async () => {
    const aiParse = vi.fn();
    const result = await parseMessage('חלב', aiParse);
    expect(result).toEqual({ action: 'add', items: ['חלב'] });
    expect(aiParse).not.toHaveBeenCalled();
  });

  it('falls back to AI when the rule engine is unsure', async () => {
    const aiParse = vi.fn().mockResolvedValue({ action: 'add', items: ['קפה'] });
    const result = await parseMessage('אין לנו יותר קפה', aiParse);
    expect(result).toEqual({ action: 'add', items: ['קפה'] });
    expect(aiParse).toHaveBeenCalledWith('אין לנו יותר קפה');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix functions run test -- parseMessage.test.ts`
Expected: FAIL - `Cannot find module './parseMessage'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// functions/src/parser/parseMessage.ts
import { parseRuleBased } from './ruleParser';

export type Action = 'add' | 'remove' | 'show' | 'at_store' | 'unclear';

export interface ParsedMessage {
  action: Action;
  items: string[];
}

export type AiParse = (text: string) => Promise<ParsedMessage>;

const SHOW_LIST_PATTERNS = [/^הצג\s+רשימה$/u, /^מה\s+יש\s+ברשימה\??$/u, /^רשימה$/u];
const AT_STORE_PATTERNS = [/^אני\s+בסופר$/u, /^בסופר$/u, /^הגעתי\s+לסופר$/u];

export async function parseMessage(text: string, aiParse: AiParse): Promise<ParsedMessage> {
  const trimmed = text.trim();

  if (SHOW_LIST_PATTERNS.some((p) => p.test(trimmed))) {
    return { action: 'show', items: [] };
  }
  if (AT_STORE_PATTERNS.some((p) => p.test(trimmed))) {
    return { action: 'at_store', items: [] };
  }

  const ruleResult = parseRuleBased(trimmed);
  if (ruleResult) {
    return ruleResult;
  }

  return aiParse(trimmed);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix functions run test -- parseMessage.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add functions/src/parser/parseMessage.ts functions/src/parser/parseMessage.test.ts
git commit -m "Wire special phrases and AI fallback into parseMessage"
```

---

## Task 7: `isRecurringCandidate`

Per the design, the recurring check only ever runs client-side (on the trip
page's finish flow) - the backend never needs it. So this lives directly in
`web/js`, where it's actually consumed, instead of being duplicated into the
backend as dead code. Since `web/js` has no build step, its pure-logic files
get their own minimal root-level Vitest setup.

**Files:**
- Create: `package.json` (project root)
- Create: `web/js/recurring.js`
- Test: `web/js/recurring.test.js`

- [ ] **Step 1: Create the root `package.json`**

```json
{
  "name": "superbot",
  "private": true,
  "type": "module",
  "devDependencies": {
    "vitest": "^2.0.5"
  },
  "scripts": {
    "test": "vitest run web/js"
  }
}
```

Run: `npm install`
Expected: completes with no errors, root `node_modules` exists.

- [ ] **Step 2: Write the failing test**

```javascript
// web/js/recurring.test.js
import { describe, it, expect } from 'vitest';
import { isRecurringCandidate } from './recurring.js';

describe('isRecurringCandidate', () => {
  it('is false when fewer than 4 trips have completed yet', () => {
    expect(isRecurringCandidate(['t1', 't2'], ['t1', 't2'])).toBe(false);
  });

  it('is true when the item appears in 3 of the last 4 trips', () => {
    expect(isRecurringCandidate(['t1', 't2', 't3'], ['t1', 't2', 't3', 't4'])).toBe(true);
  });

  it('is true when the item appears in all of the last 4 trips', () => {
    expect(isRecurringCandidate(['t1', 't2', 't3', 't4'], ['t1', 't2', 't3', 't4'])).toBe(true);
  });

  it('is false when the item appears in only 2 of the last 4 trips', () => {
    expect(isRecurringCandidate(['t1', 't3'], ['t1', 't2', 't3', 't4'])).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- web/js/recurring.test.js`
Expected: FAIL - `Cannot find module './recurring.js'`

- [ ] **Step 4: Write minimal implementation**

```javascript
// web/js/recurring.js
export function isRecurringCandidate(itemTripIds, recentCompletedTripIds) {
  if (recentCompletedTripIds.length < 4) return false;
  const hits = recentCompletedTripIds.filter((id) => itemTripIds.includes(id)).length;
  return hits >= 3;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- web/js/recurring.test.js`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json web/js/recurring.js web/js/recurring.test.js
git commit -m "Add trip-count-based recurring item detection"
```

---

## Task 8: Firestore item & trip helpers

These talk to Firestore, so tests run against the local emulator instead of pure mocks.

**Files:**
- Create: `functions/src/firestore/items.ts`
- Create: `functions/src/firestore/trips.ts`
- Test: `functions/src/firestore/items.test.ts`
- Test: `functions/src/firestore/trips.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// functions/src/firestore/items.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { addItems, removeItems, listItems } from './items';

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? 'localhost:8080';
const app = initializeApp({ projectId: 'demo-superbot' }, 'items-test');
const db = getFirestore(app);

beforeEach(async () => {
  const docs = await db.collection('households/main/items').listDocuments();
  await Promise.all(docs.map((d) => d.delete()));
});

describe('items', () => {
  it('adds a new item', async () => {
    const added = await addItems(db, ['חלב'], 111);
    expect(added).toEqual(['חלב']);
    const current = await listItems(db);
    expect(current.map((i) => i.name)).toEqual(['חלב']);
  });

  it('does not add a duplicate of an existing item', async () => {
    await addItems(db, ['חלב'], 111);
    const added = await addItems(db, ['חלב'], 222);
    expect(added).toEqual([]);
    const current = await listItems(db);
    expect(current).toHaveLength(1);
  });

  it('removes an item by name', async () => {
    await addItems(db, ['חלב', 'ביצים'], 111);
    const removed = await removeItems(db, ['חלב']);
    expect(removed).toEqual(['חלב']);
    const current = await listItems(db);
    expect(current.map((i) => i.name)).toEqual(['ביצים']);
  });

  it('ignores removing an item that is not on the list', async () => {
    const removed = await removeItems(db, ['משהו שלא קיים']);
    expect(removed).toEqual([]);
  });
});
```

```typescript
// functions/src/firestore/trips.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getOrCreateActiveTrip } from './trips';

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? 'localhost:8080';
const app = initializeApp({ projectId: 'demo-superbot' }, 'trips-test');
const db = getFirestore(app);

beforeEach(async () => {
  const docs = await db.collection('households/main/trips').listDocuments();
  await Promise.all(docs.map((d) => d.delete()));
});

describe('getOrCreateActiveTrip', () => {
  it('creates a new active trip when none exists', async () => {
    const trip = await getOrCreateActiveTrip(db, 111);
    expect(trip.status).toBe('active');
    expect(trip.startedBy).toBe(111);
  });

  it('returns the existing active trip instead of creating a second one', async () => {
    const first = await getOrCreateActiveTrip(db, 111);
    const second = await getOrCreateActiveTrip(db, 222);
    expect(second.id).toBe(first.id);
    const all = await db.collection('households/main/trips').get();
    expect(all.size).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `firebase emulators:exec --project=demo-superbot --only firestore "npm --prefix functions run test:emulator"`
Expected: FAIL - `Cannot find module './items'` / `./trips'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// functions/src/firestore/items.ts
import type { Firestore } from 'firebase-admin/firestore';
import { normalizeItemName } from '../parser/normalize';

export interface Item {
  id: string;
  name: string;
  normalizedName: string;
  addedAt: number;
  addedBy: number;
  recurring: boolean;
}

function itemsCollection(db: Firestore) {
  return db.collection('households/main/items');
}

export async function addItems(db: Firestore, names: string[], addedBy: number): Promise<string[]> {
  const col = itemsCollection(db);
  const added: string[] = [];
  for (const name of names) {
    const normalizedName = normalizeItemName(name);
    const existing = await col.where('normalizedName', '==', normalizedName).limit(1).get();
    if (!existing.empty) continue;
    await col.add({
      name: name.trim(),
      normalizedName,
      addedAt: Date.now(),
      addedBy,
      recurring: false,
    });
    added.push(name.trim());
  }
  return added;
}

export async function removeItems(db: Firestore, names: string[]): Promise<string[]> {
  const col = itemsCollection(db);
  const removed: string[] = [];
  for (const name of names) {
    const normalizedName = normalizeItemName(name);
    const matches = await col.where('normalizedName', '==', normalizedName).get();
    for (const doc of matches.docs) {
      await doc.ref.delete();
      removed.push(name.trim());
    }
  }
  return removed;
}

export async function listItems(db: Firestore): Promise<Item[]> {
  const snapshot = await itemsCollection(db).orderBy('addedAt', 'asc').get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<Item, 'id'>) }));
}
```

```typescript
// functions/src/firestore/trips.ts
import type { Firestore } from 'firebase-admin/firestore';

export interface Trip {
  id: string;
  status: 'active' | 'completed';
  startedAt: number;
  startedBy: number;
}

function tripsCollection(db: Firestore) {
  return db.collection('households/main/trips');
}

export async function getOrCreateActiveTrip(db: Firestore, startedBy: number): Promise<Trip> {
  const col = tripsCollection(db);
  const active = await col.where('status', '==', 'active').limit(1).get();
  if (!active.empty) {
    const doc = active.docs[0];
    return { id: doc.id, ...(doc.data() as Omit<Trip, 'id'>) };
  }
  const startedAt = Date.now();
  const ref = await col.add({ status: 'active', startedAt, startedBy, checkedItemIds: [] });
  return { id: ref.id, status: 'active', startedAt, startedBy };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `firebase emulators:exec --project=demo-superbot --only firestore "npm --prefix functions run test:emulator"`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add functions/src/firestore/items.ts functions/src/firestore/trips.ts functions/src/firestore/items.test.ts functions/src/firestore/trips.test.ts
git commit -m "Add Firestore item and trip helpers"
```

---

## Task 9: Firestore security rules

**Files:**
- Modify: `firestore.rules`
- Test: `functions/src/__tests__/firestore.rules.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// functions/src/__tests__/firestore.rules.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { doc, getDoc, setDoc } from 'firebase/firestore';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-superbot',
    firestore: { rules: readFileSync('../firestore.rules', 'utf8') },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'households/main'), {
      memberUids: ['uid-a', 'uid-b'],
    });
  });
});

describe('firestore rules', () => {
  it('lets a household member read the item list', async () => {
    const memberDb = testEnv.authenticatedContext('uid-a').firestore();
    await assertSucceeds(getDoc(doc(memberDb, 'households/main/items/x')));
  });

  it('blocks a non-member from reading the item list', async () => {
    const strangerDb = testEnv.authenticatedContext('uid-z').firestore();
    await assertFails(getDoc(doc(strangerDb, 'households/main/items/x')));
  });

  it('blocks an unauthenticated read', async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anonDb, 'households/main/items/x')));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `firebase emulators:exec --project=demo-superbot --only firestore "npm --prefix functions run test:emulator"`
Expected: FAIL - the "lets a household member read" test fails, because the current `firestore.rules` denies everything.

- [ ] **Step 3: Replace the placeholder rules**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isMember() {
      return request.auth != null &&
        request.auth.uid in
          get(/databases/$(database)/documents/households/main).data.memberUids;
    }

    match /households/main {
      allow read: if isMember();
      allow write: if false;
    }

    match /households/main/{collection}/{docId} {
      allow read, write: if isMember();
    }
  }
}
```

(`households/main` itself stays write-protected here — its `memberUids` are set once manually via the Firebase console or Admin SDK during setup, not editable from the app.)

- [ ] **Step 4: Run test to verify it passes**

Run: `firebase emulators:exec --project=demo-superbot --only firestore "npm --prefix functions run test:emulator"`
Expected: PASS (all tests, including the 3 new rules tests)

- [ ] **Step 5: Commit**

```bash
git add firestore.rules functions/src/__tests__/firestore.rules.test.ts
git commit -m "Restrict Firestore access to whitelisted household members"
```

---

## Task 10: Telegram bot wiring

**Files:**
- Create: `functions/src/telegram/types.ts`
- Create: `functions/src/telegram/sendMessage.ts`
- Create: `functions/src/bot/handleUpdate.ts`
- Test: `functions/src/bot/handleUpdate.test.ts`
- Create: `functions/src/index.ts`

- [ ] **Step 1: Create Telegram types and sender (no test - thin HTTP wrapper)**

```typescript
// functions/src/telegram/types.ts
export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number };
    text?: string;
  };
}
```

```typescript
// functions/src/telegram/sendMessage.ts
export type SendTelegramMessage = (chatId: number, text: string) => Promise<void>;

export function createTelegramSender(botToken: string): SendTelegramMessage {
  return async (chatId, text) => {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!res.ok) {
      throw new Error(`Telegram sendMessage failed: ${res.status} ${await res.text()}`);
    }
  };
}
```

- [ ] **Step 2: Write the failing test for `handleUpdate`**

```typescript
// functions/src/bot/handleUpdate.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { handleUpdate } from './handleUpdate';

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? 'localhost:8080';
const app = initializeApp({ projectId: 'demo-superbot' }, 'handle-update-test');
const db = getFirestore(app);

beforeEach(async () => {
  for (const col of ['items', 'trips']) {
    const docs = await db.collection(`households/main/${col}`).listDocuments();
    await Promise.all(docs.map((d) => d.delete()));
  }
});

function makeUpdate(text: string, chatId = 111) {
  return { update_id: 1, message: { message_id: 1, chat: { id: chatId }, text } };
}

describe('handleUpdate', () => {
  it('adds an item and replies with a confirmation', async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    const aiParse = vi.fn();

    await handleUpdate(makeUpdate('חלב'), {
      db,
      sendMessage,
      aiParse,
      pagesBaseUrl: 'https://example.github.io/superbot',
    });

    expect(sendMessage).toHaveBeenCalledWith(111, expect.stringContaining('חלב'));
    const items = await db.collection('households/main/items').get();
    expect(items.docs.map((d) => d.data().name)).toEqual(['חלב']);
  });

  it('replies with a trip link for "אני בסופר"', async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    const aiParse = vi.fn();

    await handleUpdate(makeUpdate('אני בסופר'), {
      db,
      sendMessage,
      aiParse,
      pagesBaseUrl: 'https://example.github.io/superbot',
    });

    expect(sendMessage).toHaveBeenCalledWith(
      111,
      expect.stringContaining('https://example.github.io/superbot/trip/')
    );
  });

  it('asks to rephrase when both the rules and the AI fallback are unsure', async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    const aiParse = vi.fn().mockResolvedValue({ action: 'unclear', items: [] });

    await handleUpdate(makeUpdate('אין לנו יותר קפה'), {
      db,
      sendMessage,
      aiParse,
      pagesBaseUrl: 'https://example.github.io/superbot',
    });

    expect(aiParse).toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledWith(111, expect.stringContaining('לא הבנתי'));
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `firebase emulators:exec --project=demo-superbot --only firestore "npm --prefix functions run test:emulator"`
Expected: FAIL - `Cannot find module './handleUpdate'`

- [ ] **Step 4: Write minimal implementation**

```typescript
// functions/src/bot/handleUpdate.ts
import type { Firestore } from 'firebase-admin/firestore';
import { parseMessage, type AiParse } from '../parser/parseMessage';
import type { SendTelegramMessage } from '../telegram/sendMessage';
import type { TelegramUpdate } from '../telegram/types';
import * as items from '../firestore/items';
import * as trips from '../firestore/trips';

export interface HandleUpdateDeps {
  db: Firestore;
  sendMessage: SendTelegramMessage;
  aiParse: AiParse;
  pagesBaseUrl: string;
}

export async function handleUpdate(update: TelegramUpdate, deps: HandleUpdateDeps): Promise<void> {
  const message = update.message;
  if (!message?.text) return;

  const chatId = message.chat.id;
  const parsed = await parseMessage(message.text, deps.aiParse);

  switch (parsed.action) {
    case 'add': {
      const added = await items.addItems(deps.db, parsed.items, chatId);
      await deps.sendMessage(chatId, added.length > 0 ? `נוסף: ${added.join(', ')}` : 'כבר ברשימה');
      break;
    }
    case 'remove': {
      const removed = await items.removeItems(deps.db, parsed.items);
      await deps.sendMessage(chatId, removed.length > 0 ? `הוסר: ${removed.join(', ')}` : 'לא נמצא ברשימה');
      break;
    }
    case 'show': {
      const current = await items.listItems(deps.db);
      await deps.sendMessage(
        chatId,
        current.length > 0 ? current.map((i) => `• ${i.name}`).join('\n') : 'הרשימה ריקה'
      );
      break;
    }
    case 'at_store': {
      const trip = await trips.getOrCreateActiveTrip(deps.db, chatId);
      await deps.sendMessage(chatId, `בהצלחה בסופר! 🛒\n${deps.pagesBaseUrl}/trip/${trip.id}`);
      break;
    }
    case 'unclear': {
      await deps.sendMessage(chatId, 'לא הבנתי, אפשר לנסח אחרת?');
      break;
    }
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `firebase emulators:exec --project=demo-superbot --only firestore "npm --prefix functions run test:emulator"`
Expected: PASS (all emulator tests, 12 total across Tasks 8-10)

- [ ] **Step 6: Wire the Cloud Function entry point (no test - composition root)**

```typescript
// functions/src/index.ts
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import Anthropic from '@anthropic-ai/sdk';
import { handleUpdate } from './bot/handleUpdate';
import { createTelegramSender } from './telegram/sendMessage';
import { createClaudeParser } from './parser/claudeParser';

initializeApp();

const TELEGRAM_BOT_TOKEN = defineSecret('TELEGRAM_BOT_TOKEN');
const TELEGRAM_WEBHOOK_SECRET = defineSecret('TELEGRAM_WEBHOOK_SECRET');
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');
const PAGES_BASE_URL = process.env.PAGES_BASE_URL ?? 'https://example.github.io/superbot';

export const telegramWebhook = onRequest(
  { secrets: [TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, ANTHROPIC_API_KEY] },
  async (req, res) => {
    if (req.get('X-Telegram-Bot-Api-Secret-Token') !== TELEGRAM_WEBHOOK_SECRET.value()) {
      res.status(401).send('unauthorized');
      return;
    }

    const db = getFirestore();
    const sendMessage = createTelegramSender(TELEGRAM_BOT_TOKEN.value());
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });
    const aiParse = createClaudeParser((args) => anthropic.messages.create(args));

    await handleUpdate(req.body, { db, sendMessage, aiParse, pagesBaseUrl: PAGES_BASE_URL });
    res.status(200).send('ok');
  }
);
```

- [ ] **Step 7: Verify the whole functions codebase compiles**

Run: `npm --prefix functions run build`
Expected: completes with no TypeScript errors, `functions/lib/index.js` exists.

- [ ] **Step 8: Commit**

```bash
git add functions/src/telegram functions/src/bot functions/src/index.ts
git commit -m "Wire Telegram webhook to the parser and Firestore"
```

---

## Task 11: Deploy and register the Telegram webhook

No automated test - this is real infrastructure setup. Do this once Prerequisites are complete.

**Files:**
- Create: `functions/.env` (not committed)

- [ ] **Step 1: Point the CLI at your real project**

Run: `firebase use <your-project-id>`
Expected: `Now using project <your-project-id>`

Also update `.firebaserc`'s placeholder to the same ID and commit that one-line change.

- [ ] **Step 2: Set the three secrets** (each prompts for a value)

```bash
firebase functions:secrets:set TELEGRAM_BOT_TOKEN
firebase functions:secrets:set ANTHROPIC_API_KEY
```

For the webhook secret, generate a random value first, then paste it when prompted:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
firebase functions:secrets:set TELEGRAM_WEBHOOK_SECRET
```

Save the generated webhook-secret value somewhere - you'll need it again in Step 4.

- [ ] **Step 3: Set the pages base URL and deploy**

Create `functions/.env`:

```
PAGES_BASE_URL=https://<your-username>.github.io/superbot
```

Run: `npm --prefix functions run deploy`
Expected: succeeds, output includes a function URL like
`https://us-central1-<project-id>.cloudfunctions.net/telegramWebhook`

- [ ] **Step 4: Register the webhook with Telegram**

```bash
curl -s -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"<FUNCTION_URL>","secret_token":"<WEBHOOK_SECRET>"}'
```

Expected: `{"ok":true,"result":true,"description":"Webhook was set"}`

- [ ] **Step 5: Verify**

Run: `curl -s "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"`
Expected: JSON showing your function URL and `"pending_update_count":0`

- [ ] **Step 6: Create the household document**

In the Firebase console → Firestore → create document at path `households/main` with:
```json
{ "memberChatIds": [<your chat id>, <her chat id>], "memberUids": [] }
```
(`memberUids` gets filled in during Task 12, after you both sign in on the web page once.)

- [ ] **Step 7: Send a real test message**

From your phone, message your bot "חלב".
Expected: the bot replies "נוסף: חלב", and the item appears in Firestore under `households/main/items`.

- [ ] **Step 8: Commit the `.firebaserc` project ID update**

```bash
git add .firebaserc
git commit -m "Point Firebase config at the real project"
```

---

## Task 12: Frontend Firebase init + shared data layer

**Files:**
- Create: `web/js/firebase-init.js`
- Create: `web/js/db.js`
- Create: `web/style.css`

- [ ] **Step 1: Get your Firebase web app config**

Firebase console → Project settings → General → "Your apps" → add a Web app if you haven't → copy the `firebaseConfig` object.

- [ ] **Step 2: Create `web/js/firebase-init.js`**

```javascript
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "REPLACE_WITH_YOUR_FIREBASE_WEB_API_KEY",
  authDomain: "REPLACE.firebaseapp.com",
  projectId: "REPLACE",
  storageBucket: "REPLACE.appspot.com",
  messagingSenderId: "REPLACE",
  appId: "REPLACE",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

export async function ensureSignedIn() {
  if (!auth.currentUser) {
    await signInAnonymously(auth);
  }
  return auth.currentUser;
}
```

Replace the `REPLACE_*` values with your real config from Step 1.

- [ ] **Step 3: Create `web/js/db.js`**

```javascript
import { db, ensureSignedIn } from "./firebase-init.js";
import { isRecurringCandidate } from "./recurring.js";
import {
  collection, doc, addDoc, deleteDoc, updateDoc, getDoc, onSnapshot,
  query, orderBy, where, limit, arrayUnion, arrayRemove,
  writeBatch, getDocs,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const itemsCol = collection(db, "households/main/items");
const tripsCol = collection(db, "households/main/trips");
const historyCol = collection(db, "households/main/purchaseHistory");

export async function watchItems(onChange) {
  await ensureSignedIn();
  const q = query(itemsCol, orderBy("addedAt", "asc"));
  return onSnapshot(q, (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export async function addItem(name) {
  await ensureSignedIn();
  await addDoc(itemsCol, {
    name: name.trim(),
    normalizedName: name.trim().toLowerCase(),
    addedAt: Date.now(),
    addedBy: "web",
    recurring: false,
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

export async function watchActiveTrip(onChange) {
  await ensureSignedIn();
  const q = query(tripsCol, where("status", "==", "active"), limit(1));
  return onSnapshot(q, (snap) => onChange(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }));
}

export async function watchTrip(tripId, onChange) {
  await ensureSignedIn();
  return onSnapshot(doc(tripsCol, tripId), (snap) => onChange(snap.exists() ? { id: snap.id, ...snap.data() } : null));
}

export async function toggleChecked(tripId, itemId, checked) {
  await ensureSignedIn();
  await updateDoc(doc(tripsCol, tripId), {
    checkedItemIds: checked ? arrayUnion(itemId) : arrayRemove(itemId),
  });
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
    const histSnap = await getDoc(doc(historyCol, item.normalizedName));
    if (!histSnap.exists()) continue;
    const purchases = histSnap.data().purchases || [];
    const itemTripIds = purchases.map((p) => p.tripId);
    if (isRecurringCandidate(itemTripIds, recentTripIds)) candidates.push(item);
  }
  return candidates;
}

export async function finishTrip(tripId, checkedItems, keepItemIds) {
  await ensureSignedIn();
  const batch = writeBatch(db);
  const purchased = [];
  const recurringDecisions = [];

  for (const item of checkedItems) {
    const kept = keepItemIds.has(item.id);
    purchased.push({ itemId: item.id, name: item.name, price: null });
    recurringDecisions.push({ name: item.name, kept });

    batch.delete(doc(itemsCol, item.id));
    if (kept) {
      batch.set(doc(itemsCol), {
        name: item.name,
        normalizedName: item.normalizedName,
        addedAt: Date.now(),
        addedBy: "web",
        recurring: true,
      });
    }

    batch.set(
      doc(historyCol, item.normalizedName),
      { name: item.name, purchases: arrayUnion({ tripId, date: Date.now() }) },
      { merge: true }
    );
  }

  batch.update(doc(tripsCol, tripId), {
    status: "completed",
    completedAt: Date.now(),
    purchased,
    recurringDecisions,
  });

  await batch.commit();
}

export async function watchHistory(onChange) {
  await ensureSignedIn();
  const q = query(tripsCol, where("status", "==", "completed"), orderBy("completedAt", "desc"));
  return onSnapshot(q, (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}
```

- [ ] **Step 4: Create `web/style.css`**

```css
@import url('https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@500;700&family=Heebo:wght@400;500;600;700&display=swap');

:root {
  --bg:#F2F4EE; --surface:#FFFFFF; --surface-alt:#EAEFE4;
  --text:#232920; --text-muted:#6C7666;
  --accent:#2F6F5E; --accent-strong:#1F4E41; --accent-tint:#E3EFE9;
  --tomato:#C1502E; --tomato-tint:#F6E4DD;
  --border:#DCE3D5;
  --shadow: 0 1px 2px rgba(35,41,32,.06), 0 8px 24px rgba(35,41,32,.06);
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg:#12160F; --surface:#1B2117; --surface-alt:#232B1E;
    --text:#E8EDE1; --text-muted:#98A38F;
    --accent:#74C4A4; --accent-strong:#95D8BB; --accent-tint:#1E362C;
    --tomato:#E2896A; --tomato-tint:#3A241C;
    --border:#2E362A;
    --shadow: 0 1px 2px rgba(0,0,0,.3), 0 8px 24px rgba(0,0,0,.35);
  }
}
:root[data-theme="dark"] {
  --bg:#12160F; --surface:#1B2117; --surface-alt:#232B1E;
  --text:#E8EDE1; --text-muted:#98A38F;
  --accent:#74C4A4; --accent-strong:#95D8BB; --accent-tint:#1E362C;
  --tomato:#E2896A; --tomato-tint:#3A241C;
  --border:#2E362A;
  --shadow: 0 1px 2px rgba(0,0,0,.3), 0 8px 24px rgba(0,0,0,.35);
}
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--text); font-family: 'Heebo', system-ui, sans-serif; direction: rtl; margin: 0; display: flex; justify-content: center; padding-block: 32px; }
.phone { width: 100%; max-width: 460px; padding-inline: 16px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 20px; box-shadow: var(--shadow); overflow: hidden; }
header { padding: 22px 22px 16px; border-bottom: 1px solid var(--border); }
.eyebrow { font-size: 12px; font-weight: 600; letter-spacing: .06em; color: var(--text-muted); text-transform: uppercase; }
h1 { font-family: 'Frank Ruhl Libre', serif; font-weight: 700; font-size: 26px; margin: 2px 0 0; text-wrap: balance; }
.meta { font-size: 13px; color: var(--text-muted); margin-top: 6px; font-variant-numeric: tabular-nums; }
.list { list-style: none; margin: 0; padding: 6px 10px; }
.row { display: flex; align-items: center; gap: 12px; padding: 11px 12px; border-radius: 12px; }
.row:hover { background: var(--surface-alt); }
.box { width: 22px; height: 22px; flex: none; border-radius: 7px; border: 2px solid var(--border); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background .15s, border-color .15s; }
.box svg { width: 13px; height: 13px; opacity: 0; color: #fff; }
.row.checked .box { background: var(--accent); border-color: var(--accent); }
.row.checked .box svg { opacity: 1; }
.name { flex: 1; min-width: 0; font-size: 16px; font-weight: 500; background: none; border: none; color: inherit; font-family: inherit; padding: 4px; border-radius: 6px; }
.name:focus { outline: 2px solid var(--accent); background: var(--surface-alt); }
.row.checked .name { color: var(--text-muted); text-decoration: line-through; }
.tag { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 999px; background: var(--accent-tint); color: var(--accent-strong); white-space: nowrap; cursor: pointer; border: none; }
.tag.off { background: var(--surface-alt); color: var(--text-muted); }
.icon-btn { border: none; background: none; color: var(--text-muted); cursor: pointer; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 8px; flex: none; }
.icon-btn:hover { background: var(--surface-alt); color: var(--tomato); }
.icon-btn svg { width: 16px; height: 16px; }
.addbar { margin: 10px 16px 16px; display: flex; gap: 8px; }
.addbar input { flex: 1; border: 1px solid var(--border); border-radius: 12px; padding: 11px 14px; font-family: inherit; font-size: 14px; background: var(--surface); color: var(--text); }
.addbar input:focus { outline: 2px solid var(--accent); }
.btn { border: none; border-radius: 13px; padding: 13px 16px; font-family: inherit; font-size: 15px; font-weight: 700; cursor: pointer; }
.btn-primary { background: var(--accent); color: #fff; }
.btn-primary:hover { background: var(--accent-strong); }
.btn-ghost { background: transparent; color: var(--text-muted); font-weight: 600; }
footer { padding: 14px 16px calc(16px + env(safe-area-inset-bottom)); border-top: 1px solid var(--border); display: flex; flex-direction: column; gap: 8px; }
.banner { margin: 14px 16px 0; background: var(--accent-tint); color: var(--accent-strong); border-radius: 12px; padding: 11px 14px; font-size: 14px; font-weight: 600; display: flex; justify-content: space-between; align-items: center; text-decoration: none; }
.hidden { display: none !important; }
.empty { padding: 30px 20px; text-align: center; color: var(--text-muted); font-size: 14px; }
.suggest-card { margin: 0 16px 10px; background: var(--tomato-tint); border-radius: 14px; padding: 12px 14px; display: flex; align-items: center; gap: 12px; }
.suggest-card .info { flex: 1; min-width: 0; }
.suggest-card .name { font-weight: 600; font-size: 15px; background: none; }
.suggest-card .why { font-size: 12.5px; color: var(--text-muted); margin-top: 1px; }
.switch { width: 42px; height: 25px; flex: none; border-radius: 999px; background: var(--border); position: relative; cursor: pointer; transition: background .15s; border: none; }
.switch::after { content: ""; position: absolute; top: 3px; right: 3px; width: 19px; height: 19px; border-radius: 50%; background: var(--surface); box-shadow: 0 1px 2px rgba(0,0,0,.25); transition: transform .15s; }
.switch.on { background: var(--tomato); }
.switch.on::after { transform: translateX(-17px); }
.section-label { font-size: 12px; font-weight: 700; color: var(--text-muted); margin: 16px 16px 6px; }
a.history-row { display: block; padding: 13px 16px; border-bottom: 1px solid var(--border); color: inherit; text-decoration: none; }
a.history-row:hover { background: var(--surface-alt); }
a.history-row .date { font-weight: 600; }
a.history-row .summary { font-size: 13px; color: var(--text-muted); margin-top: 2px; }
.note { text-align: center; font-size: 12px; color: var(--text-muted); margin-top: 14px; }
```

- [ ] **Step 5: Commit**

```bash
git add web/js/firebase-init.js web/js/db.js web/style.css
git commit -m "Add frontend Firebase init and shared data layer"
```

---

## Task 13: Main list page

**Files:**
- Create: `web/index.html`
- Create: `web/js/list-page.js`

- [ ] **Step 1: Create `web/index.html`**

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
  <a id="trip-banner" class="banner hidden" href="#">
    <span>יש טיול קנייה פעיל - המשיכו כאן</span>
    <span>›</span>
  </a>
  <div class="card">
    <header>
      <div class="eyebrow">רשימת קניות משותפת</div>
      <h1>העגלה שלנו</h1>
      <div class="meta"><span id="count">0</span> פריטים</div>
    </header>
    <ul class="list" id="list"></ul>
    <p class="empty hidden" id="empty">הרשימה ריקה - תוסיפו פריט למטה, או פשוט תכתבו לבוט בטלגרם</p>
    <form class="addbar" id="add-form">
      <input id="add-input" type="text" placeholder="פריט חדש..." autocomplete="off" />
      <button class="btn btn-primary" type="submit">הוסף</button>
    </form>
  </div>
  <div class="note"><a href="history.html">היסטוריית קניות ›</a></div>
</div>
<script type="module" src="js/list-page.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `web/js/list-page.js`**

```javascript
import { watchItems, addItem, deleteItem, renameItem, setRecurring, watchActiveTrip } from "./db.js";

const listEl = document.getElementById("list");
const emptyEl = document.getElementById("empty");
const countEl = document.getElementById("count");
const bannerEl = document.getElementById("trip-banner");
const addForm = document.getElementById("add-form");
const addInput = document.getElementById("add-input");

function itemRow(item) {
  const li = document.createElement("li");
  li.className = "row";

  const box = document.createElement("div");
  box.className = "box";
  box.title = "מסומן ידנית רק בדף טיול קנייה";
  box.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7"/></svg>';

  const nameInput = document.createElement("input");
  nameInput.className = "name";
  nameInput.value = item.name;
  nameInput.addEventListener("change", () => {
    const value = nameInput.value.trim();
    if (value && value !== item.name) {
      renameItem(item.id, value);
    } else {
      nameInput.value = item.name;
    }
  });

  const tag = document.createElement("button");
  tag.type = "button";
  tag.className = "tag" + (item.recurring ? "" : " off");
  tag.textContent = "קבוע";
  tag.addEventListener("click", () => setRecurring(item.id, !item.recurring));

  const del = document.createElement("button");
  del.type = "button";
  del.className = "icon-btn";
  del.setAttribute("aria-label", "מחק פריט");
  del.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  del.addEventListener("click", () => deleteItem(item.id));

  li.append(box, nameInput, tag, del);
  return li;
}

watchItems((items) => {
  listEl.innerHTML = "";
  countEl.textContent = String(items.length);
  emptyEl.classList.toggle("hidden", items.length > 0);
  for (const item of items) {
    listEl.appendChild(itemRow(item));
  }
});

watchActiveTrip((trip) => {
  if (trip) {
    bannerEl.href = `trip.html?id=${trip.id}`;
    bannerEl.classList.remove("hidden");
  } else {
    bannerEl.classList.add("hidden");
  }
});

addForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = addInput.value.trim();
  if (!name) return;
  addItem(name);
  addInput.value = "";
});
```

- [ ] **Step 3: Verify manually**

Run: `npx http-server web -p 8000` (or any static file server)
Open `http://localhost:8000` in a browser.
Expected: page loads with an empty list (Firestore not configured against emulator yet is fine here - full flow gets verified end-to-end in Task 16). Confirm no console errors other than a Firebase connection error if config is still using placeholder values.

- [ ] **Step 4: Commit**

```bash
git add web/index.html web/js/list-page.js
git commit -m "Add main shopping list page with full CRUD editing"
```

---

## Task 14: Trip page

**Files:**
- Create: `web/trip.html`
- Create: `web/js/trip-page.js`

- [ ] **Step 1: Create `web/trip.html`**

```html
<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>טיול קנייה</title>
<link rel="stylesheet" href="style.css" />
</head>
<body>
<div class="phone">
  <div class="card">

    <div id="screen-shopping">
      <header>
        <div class="eyebrow">טיול קנייה</div>
        <h1>בסופר עכשיו</h1>
        <div class="meta" id="trip-meta"></div>
      </header>
      <ul class="list" id="list"></ul>
      <footer>
        <button class="btn btn-primary" id="finish-btn">סיימתי לקנות</button>
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
        <button class="btn btn-primary" id="confirm-btn">עדכון הרשימה</button>
        <button class="btn btn-ghost" id="back-btn">חזרה</button>
      </footer>
    </div>

    <div id="screen-done" class="hidden">
      <div style="padding:44px 24px 40px; text-align:center;">
        <h1 style="font-size:20px;">הרשימה עודכנה</h1>
        <p style="color:var(--text-muted); font-size:14px;" id="done-summary"></p>
      </div>
      <footer><a class="btn btn-primary" href="index.html" style="text-align:center; text-decoration:none;">חזרה לרשימה הראשית</a></footer>
    </div>

  </div>
</div>
<script type="module" src="js/trip-page.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `web/js/trip-page.js`**

```javascript
import { watchItems, watchTrip, toggleChecked, getRecurringCandidates, finishTrip } from "./db.js";

const params = new URLSearchParams(location.search);
const tripId = params.get("id");
if (!tripId) {
  document.body.innerHTML = '<p style="padding:40px;text-align:center;">לא נמצא טיול קנייה. חזרו לרשימה הראשית.</p>';
  throw new Error("missing trip id");
}

const listEl = document.getElementById("list");
const tripMeta = document.getElementById("trip-meta");
const finishBtn = document.getElementById("finish-btn");
const screenShopping = document.getElementById("screen-shopping");
const screenRecap = document.getElementById("screen-recap");
const screenDone = document.getElementById("screen-done");
const suggestionsEl = document.getElementById("suggestions");
const confirmBtn = document.getElementById("confirm-btn");
const backBtn = document.getElementById("back-btn");
const doneSummary = document.getElementById("done-summary");

let currentItems = [];
let currentTrip = null;
let checkedItemIds = new Set();
let keepItemIds = new Set();

watchItems((items) => {
  currentItems = items;
  render();
});

watchTrip(tripId, (trip) => {
  currentTrip = trip;
  if (trip) {
    checkedItemIds = new Set(trip.checkedItemIds || []);
    if (trip.status === "completed") {
      showDone(trip);
      return;
    }
  }
  render();
});

function render() {
  if (!currentTrip || currentTrip.status !== "active") return;
  tripMeta.textContent = `${currentItems.length} פריטים ברשימה`;
  listEl.innerHTML = "";
  for (const item of currentItems) {
    const li = document.createElement("li");
    li.className = "row" + (checkedItemIds.has(item.id) ? " checked" : "");
    li.innerHTML = `
      <div class="box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7"/></svg></div>
      <span class="name" style="cursor:pointer;">${item.name}</span>
    `;
    li.addEventListener("click", () => toggleChecked(tripId, item.id, !checkedItemIds.has(item.id)));
    listEl.appendChild(li);
  }
}

finishBtn.addEventListener("click", async () => {
  const checked = currentItems.filter((i) => checkedItemIds.has(i.id));
  if (checked.length === 0) {
    alert("לא סומן אף פריט");
    return;
  }
  const candidates = await getRecurringCandidates(checked);
  keepItemIds = new Set(candidates.map((c) => c.id));

  suggestionsEl.innerHTML = "";
  for (const item of checked) {
    const isCandidate = candidates.some((c) => c.id === item.id);
    const row = document.createElement("div");
    row.className = "suggest-card";
    row.innerHTML = `
      <div class="info">
        <div class="name">${item.name}</div>
        <div class="why">${isCandidate ? "נקנה לרוב מדי קנייה" : "לא זוהה כפריט קבוע"}</div>
      </div>
      <button type="button" class="switch${isCandidate ? " on" : ""}"></button>
    `;
    const switchBtn = row.querySelector(".switch");
    switchBtn.addEventListener("click", () => {
      switchBtn.classList.toggle("on");
      if (switchBtn.classList.contains("on")) {
        keepItemIds.add(item.id);
      } else {
        keepItemIds.delete(item.id);
      }
    });
    suggestionsEl.appendChild(row);
  }

  screenShopping.classList.add("hidden");
  screenRecap.classList.remove("hidden");
});

backBtn.addEventListener("click", () => {
  screenRecap.classList.add("hidden");
  screenShopping.classList.remove("hidden");
});

confirmBtn.addEventListener("click", async () => {
  const checked = currentItems.filter((i) => checkedItemIds.has(i.id));
  await finishTrip(tripId, checked, keepItemIds);
});

function showDone(trip) {
  screenShopping.classList.add("hidden");
  screenRecap.classList.add("hidden");
  screenDone.classList.remove("hidden");
  const kept = (trip.recurringDecisions || []).filter((d) => d.kept).map((d) => d.name);
  doneSummary.textContent = kept.length > 0 ? `${kept.join(", ")} נשארו ברשימה לפעם הבאה.` : "הרשימה עודכנה.";
}
```

- [ ] **Step 3: Commit**

```bash
git add web/trip.html web/js/trip-page.js
git commit -m "Add shopping trip page with checklist and finish flow"
```

---

## Task 15: History page

**Files:**
- Create: `web/history.html`
- Create: `web/js/history-page.js`

- [ ] **Step 1: Create `web/history.html`**

```html
<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>היסטוריית קניות</title>
<link rel="stylesheet" href="style.css" />
</head>
<body>
<div class="phone">
  <div class="card">
    <header>
      <div class="eyebrow">כל הקניות שלכם</div>
      <h1>היסטוריה</h1>
    </header>
    <div id="list"></div>
    <p class="empty hidden" id="empty">עדיין אין קניות שהושלמו</p>
  </div>
  <div class="note"><a href="index.html">חזרה לרשימה ›</a></div>
</div>
<script type="module" src="js/history-page.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `web/js/history-page.js`**

```javascript
import { watchHistory } from "./db.js";

const listEl = document.getElementById("list");
const emptyEl = document.getElementById("empty");
const formatter = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", year: "numeric" });

watchHistory((trips) => {
  listEl.innerHTML = "";
  emptyEl.classList.toggle("hidden", trips.length > 0);
  for (const trip of trips) {
    const a = document.createElement("a");
    a.className = "history-row";
    a.href = `trip.html?id=${trip.id}`;
    const date = formatter.format(new Date(trip.completedAt));
    const names = (trip.purchased || []).map((p) => p.name).join(", ");
    a.innerHTML = `<div class="date">${date}</div><div class="summary">${names || "אין פריטים"}</div>`;
    listEl.appendChild(a);
  }
});
```

- [ ] **Step 3: Commit**

```bash
git add web/history.html web/js/history-page.js
git commit -m "Add shopping trip history page"
```

---

## Task 16: Publish and end-to-end verification

**Files:**
- Copy: `web/*` → `<github.io repo>/superbot/`

- [ ] **Step 1: Copy the frontend into your existing Pages repo**

```bash
mkdir -p <path-to-your-github.io-repo>/superbot
cp -r web/* <path-to-your-github.io-repo>/superbot/
```

- [ ] **Step 2: Push**

```bash
cd <path-to-your-github.io-repo>
git add superbot
git commit -m "Add SuperBot shared shopping list"
git push
```

- [ ] **Step 3: First sign-in and household whitelisting**

Open `https://<your-username>.github.io/superbot/` on your phone, then have your wife open it on hers. Each visit triggers anonymous sign-in.

In the Firebase console → Authentication → Users, find the two new anonymous UIDs (sorted by creation time matches who opened it first). Update the `households/main` document's `memberUids` array with both, via Firestore console → edit document.

- [ ] **Step 4: Full end-to-end walkthrough**

1. Message the bot "חלב, ביצים ולחם" → confirm reply and that all three appear on the main list page in real time.
2. Message the bot "הסר לחם" → confirm it disappears from the page.
3. On the main page, manually add "קפה" and mark it "קבוע".
4. Message the bot "אני בסופר" → confirm you receive a trip link, and it opens with all current items unchecked.
5. Check off "חלב" and "קפה" on the trip page → confirm the checkmarks appear on your wife's phone too (or a second browser tab) within a couple of seconds.
6. Tap "סיימתי לקנות" → confirm the recap screen shows "קפה" pre-toggled to stay (it's marked "קבוע"), and "חלב" not pre-toggled (first trip, no history yet).
7. Tap "עדכון הרשימה" → confirm: "חלב" is gone from the main list, "קפה" is still there, and the trip page shows the "done" screen.
8. Open the history page → confirm the completed trip appears with today's date and the purchased items.
9. Message the bot "הצג רשימה" → confirm the reply matches what's on the main page.
10. Message the bot something ambiguous like "אין לנו יותר סוכר" → confirm it still adds "סוכר" correctly via the AI fallback.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "Complete SuperBot shopping list bot implementation"
```
