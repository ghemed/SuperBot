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

// toggleChecked/getRecurringCandidates/finishTrip/watchItems/watchTrip are
// all async (they await ensureSignedIn() first) - an unhandled rejection
// here would silently swallow a failed read/write. Same convention as
// list-page.js.
function logFailure(action) {
  return (error) => console.error(`Failed to ${action}:`, error);
}

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
    li.addEventListener("click", () => {
      toggleChecked(tripId, item.id, !checkedItemIds.has(item.id)).catch(logFailure("update the checked item"));
    });
    listEl.appendChild(li);
  }
}

finishBtn.addEventListener("click", async () => {
  const checked = currentItems.filter((i) => checkedItemIds.has(i.id));
  if (checked.length === 0) {
    alert("לא סומן אף פריט");
    return;
  }

  let candidates;
  try {
    candidates = await getRecurringCandidates(checked);
  } catch (error) {
    logFailure("get recurring item suggestions")(error);
    alert("קרתה שגיאה, נסו שוב");
    return;
  }
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
  try {
    await finishTrip(tripId, checked, keepItemIds);
  } catch (error) {
    logFailure("finish the trip")(error);
    alert("קרתה שגיאה בעדכון הרשימה, נסו שוב");
  }
});

function showDone(trip) {
  screenShopping.classList.add("hidden");
  screenRecap.classList.add("hidden");
  screenDone.classList.remove("hidden");
  const kept = (trip.recurringDecisions || []).filter((d) => d.kept).map((d) => d.name);
  doneSummary.textContent = kept.length > 0 ? `${kept.join(", ")} נשארו ברשימה לפעם הבאה.` : "הרשימה עודכנה.";
}
