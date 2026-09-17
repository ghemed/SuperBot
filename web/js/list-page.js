import { watchItems, addItem, deleteItem, renameItem, setRecurring, watchActiveTrip } from "./db.js";

const listEl = document.getElementById("list");
const emptyEl = document.getElementById("empty");
const countEl = document.getElementById("count");
const bannerEl = document.getElementById("trip-banner");
const addForm = document.getElementById("add-form");
const addInput = document.getElementById("add-input");

// addItem/renameItem/setRecurring/deleteItem are all async (they await
// ensureSignedIn() first, same as watchItems/watchActiveTrip above) - an
// unhandled rejection here would silently swallow a failed write while the
// UI has already acted as if it succeeded (input cleared, row removed).
function logFailure(action) {
  return (error) => console.error(`Failed to ${action}:`, error);
}

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
      renameItem(item.id, value).catch(logFailure("rename the item"));
    } else {
      nameInput.value = item.name;
    }
  });

  const tag = document.createElement("button");
  tag.type = "button";
  tag.className = "tag" + (item.recurring ? "" : " off");
  tag.textContent = "קבוע";
  tag.addEventListener("click", () => {
    setRecurring(item.id, !item.recurring).catch(logFailure("update the item"));
  });

  const del = document.createElement("button");
  del.type = "button";
  del.className = "icon-btn";
  del.setAttribute("aria-label", "מחק פריט");
  del.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  del.addEventListener("click", () => {
    deleteItem(item.id).catch(logFailure("delete the item"));
  });

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
}).catch((error) => {
  console.error("Failed to load the shopping list:", error);
});

watchActiveTrip((trip) => {
  if (trip) {
    bannerEl.href = `trip.html?id=${trip.id}`;
    bannerEl.classList.remove("hidden");
  } else {
    bannerEl.classList.add("hidden");
  }
}).catch((error) => {
  console.error("Failed to check for an active trip:", error);
});

addForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = addInput.value.trim();
  if (!name) return;
  addItem(name).catch(logFailure("add the item"));
  addInput.value = "";
});
