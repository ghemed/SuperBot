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

  // Rows whose item is gone are removed BEFORE anything is placed. A stale row
  // still in the DOM would sit where a current row is expected, so every row
  // below it would be moved with insertBefore - and moving a row blurs a name
  // being typed into it, silently dropping that edit.
  const currentIds = new Set(currentItems.map((item) => item.id));
  for (const [id, row] of rows) {
    if (!currentIds.has(id)) {
      row.li.remove();
      rows.delete(id);
    }
  }

  let previous = null;
  for (const item of currentItems) {
    let row = rows.get(item.id);
    if (!row) {
      row = createRow();
      rows.set(item.id, row);
    }
    updateRow(row, item);
    // Keep the DOM order identical to currentItems by moving a row only when
    // it is not already right after the previous one. With the stale rows gone
    // and the items ordered by their fixed addedAt, that is normally just a
    // new row being added at the end, so existing rows are left where they are.
    const expectedPosition = previous ? previous.li.nextSibling : listEl.firstChild;
    if (row.li !== expectedPosition) listEl.insertBefore(row.li, expectedPosition);
    previous = row;
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
