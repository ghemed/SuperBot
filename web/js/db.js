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
