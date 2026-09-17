// web/js/db.js
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
