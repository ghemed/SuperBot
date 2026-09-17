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

// Matches the convention established in list-page.js: watchItems/watchTrip/
// toggleChecked/getRecurringCandidates/finishTrip are all async (they await
// ensureSignedIn() first), so an unhandled rejection would silently leave
// the UI in a state that never actually happened.
function logFailure(action) {
  return (error) => console.error(`Failed to ${action}:`, error);
}

let currentItems = [];
let currentTrip = null;
let checkedItemIds = new Set();
let keepItemIds = new Set();

watchItems((items) => {
  currentItems = items;
  render();
}).catch(logFailure("load the shopping list"));

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
}).catch(logFailure("load the shopping trip"));

// Builds each item row via DOM nodes/textContent rather than an innerHTML
// template string - item.name is free text from either household member
// (or, in principle, anyone able to write to Firestore), and interpolating
// it into innerHTML would let a crafted name (e.g. containing an <img
// onerror=...> tag) execute as script for anyone viewing this page.
function itemRow(item) {
  const li = document.createElement("li");
  li.className = "row" + (checkedItemIds.has(item.id) ? " checked" : "");

  const box = document.createElement("div");
  box.className = "box";
  box.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7"/></svg>';

  const nameSpan = document.createElement("span");
  nameSpan.className = "name";
  nameSpan.style.cursor = "pointer";
  nameSpan.textContent = item.name;

  li.append(box, nameSpan);
  li.addEventListener("click", () => {
    toggleChecked(tripId, item.id, !checkedItemIds.has(item.id)).catch(
      logFailure("update the checked item")
    );
  });
  return li;
}

function render() {
  if (!currentTrip || currentTrip.status !== "active") return;
  tripMeta.textContent = `${currentItems.length} פריטים ברשימה`;
  listEl.innerHTML = "";
  for (const item of currentItems) {
    listEl.appendChild(itemRow(item));
  }
}

function suggestionCard(item, isCandidate) {
  const row = document.createElement("div");
  row.className = "suggest-card";

  const info = document.createElement("div");
  info.className = "info";
  const nameDiv = document.createElement("div");
  nameDiv.className = "name";
  nameDiv.textContent = item.name;
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
  const checked = currentItems.filter((i) => checkedItemIds.has(i.id));
  if (checked.length === 0) {
    alert("לא סומן אף פריט");
    return;
  }

  // Disabled for the duration of the async call, not just to prevent a
  // wasted duplicate Firestore read on a fast double-tap, but because
  // without this a second click could re-enter this handler before the
  // first one has switched screens.
  finishBtn.disabled = true;
  try {
    const candidates = await getRecurringCandidates(checked);
    keepItemIds = new Set(candidates.map((c) => c.id));

    suggestionsEl.innerHTML = "";
    for (const item of checked) {
      const isCandidate = candidates.some((c) => c.id === item.id);
      suggestionsEl.appendChild(suggestionCard(item, isCandidate));
    }

    screenShopping.classList.add("hidden");
    screenRecap.classList.remove("hidden");
  } catch (error) {
    logFailure("prepare the finish-shopping summary")(error);
    alert("קרתה שגיאה, נסו שוב");
  } finally {
    finishBtn.disabled = false;
  }
});

backBtn.addEventListener("click", () => {
  screenRecap.classList.add("hidden");
  screenShopping.classList.remove("hidden");
});

confirmBtn.addEventListener("click", async () => {
  const checked = currentItems.filter((i) => checkedItemIds.has(i.id));
  // Stays disabled on success (rather than re-enabling in a `finally`) -
  // the screen is about to transition to screen-done via watchTrip's own
  // listener once the transaction commits, so there's nothing left for
  // this button to do; only re-enable it if the call actually failed and
  // the user needs to retry from this same screen. finishTrip itself is
  // already idempotent (Task 12's transaction re-checks trip status), so
  // this is about giving the user feedback and avoiding a wasted duplicate
  // call, not about data safety.
  confirmBtn.disabled = true;
  try {
    await finishTrip(tripId, checked, keepItemIds);
  } catch (error) {
    logFailure("update the list after finishing the trip")(error);
    alert("קרתה שגיאה בעדכון הרשימה, נסו שוב");
    confirmBtn.disabled = false;
  }
});

function showDone(trip) {
  screenShopping.classList.add("hidden");
  screenRecap.classList.add("hidden");
  screenDone.classList.remove("hidden");
  const kept = (trip.recurringDecisions || []).filter((d) => d.kept).map((d) => d.name);
  doneSummary.textContent = kept.length > 0 ? `${kept.join(", ")} נשארו ברשימה לפעם הבאה.` : "הרשימה עודכנה.";
}
