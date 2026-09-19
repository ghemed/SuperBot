import { watchHistory } from "./db.js";
import { withIcon } from "./product-icons.js";

const listEl = document.getElementById("list");
const emptyEl = document.getElementById("empty");
const formatter = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", year: "numeric" });

function logFailure(action) {
  return (error) => console.error(`Failed to ${action}:`, error);
}

watchHistory((trips) => {
  listEl.innerHTML = "";
  emptyEl.classList.toggle("hidden", trips.length > 0);
  for (const trip of trips) {
    // Wrapped per-trip: every current write path always sets a valid
    // completedAt, but a single malformed doc (a manual Firestore edit, a
    // future migration bug) shouldn't throw mid-loop and leave every trip
    // after it - and the already-run emptyEl toggle above - unrendered.
    try {
      const a = document.createElement("a");
      a.className = "history-row";
      a.href = `trip.html?id=${trip.id}`;

      const dateDiv = document.createElement("div");
      dateDiv.className = "date";
      dateDiv.textContent = formatter.format(new Date(trip.completedAt));

      // textContent, not innerHTML: purchased item names are free text
      // (typed by either household member), so interpolating them into
      // markup would let a crafted name execute as script for anyone
      // viewing this page - same reasoning as trip-page.js's item rows.
      const summaryDiv = document.createElement("div");
      summaryDiv.className = "summary";
      const names = (trip.purchased || []).map((p) => withIcon(p.name)).join(", ");
      summaryDiv.textContent = names || "אין פריטים";

      a.append(dateDiv, summaryDiv);
      listEl.appendChild(a);
    } catch (error) {
      logFailure(`render trip ${trip.id}`)(error);
    }
  }
}).catch(logFailure("load the shopping history"));
