// web/js/firebase-init.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

// This config is not secret - Firebase's own access model enforces
// permissions via firestore.rules (memberUids allowlist), not by hiding
// this key. Safe to have in a public repo.
const firebaseConfig = {
  apiKey: "AIzaSyDSm_J7uNCE2e39jNC1FKiPBuCYH2aXpjs",
  authDomain: "superbot-abedf.firebaseapp.com",
  projectId: "superbot-abedf",
  storageBucket: "superbot-abedf.firebasestorage.app",
  messagingSenderId: "977649317417",
  appId: "1:977649317417:web:ba83424817154846174e38",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

export async function ensureSignedIn() {
  // auth.currentUser is null until the SDK finishes restoring a persisted
  // session from IndexedDB, which happens asynchronously AFTER getAuth()
  // returns - reading currentUser before that resolves would see "null"
  // even when a persisted anonymous session already exists, and mint a
  // brand new anonymous UID instead of reusing it. Since firestore.rules
  // allowlists exactly two fixed UIDs, a rotated UID locks that member out
  // until someone manually re-adds the new UID in the console.
  await auth.authStateReady();
  if (!auth.currentUser) {
    await signInAnonymously(auth);
  }
  return auth.currentUser;
}
