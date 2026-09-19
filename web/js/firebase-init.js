// web/js/firebase-init.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

// This config is not secret - Firebase's own access model enforces
// permissions via firestore.rules (any signed-in user), not by hiding
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

// Shared by concurrent ensureSignedIn() callers so only one signInAnonymously()
// call is ever in flight at a time - see the comment inside the function for why.
let signInPromise = null;

export async function ensureSignedIn() {
  // auth.currentUser is null until the SDK finishes restoring a persisted
  // session from IndexedDB, which happens asynchronously AFTER getAuth()
  // returns - reading currentUser before that resolves would see "null"
  // even when a persisted anonymous session already exists, and mint a
  // brand new anonymous UID instead of reusing it. firestore.rules only
  // requires some signed-in user, so a rotated UID no longer locks anyone
  // out, but it still piles up throwaway anonymous accounts.
  await auth.authStateReady();
  if (auth.currentUser) return auth.currentUser;

  // A page can call ensureSignedIn() from more than one place at once
  // (e.g. the live listener at load plus a write fired straight away,
  // neither awaiting the other). Without sharing one in-flight promise,
  // each of those concurrent calls independently observes "not signed in
  // yet" and calls signInAnonymously() itself, minting a separate
  // anonymous account per call - confirmed in production: a single page
  // load was creating two different anonymous users instead of reusing
  // one, needlessly piling up anonymous accounts.
  if (!signInPromise) {
    signInPromise = signInAnonymously(auth).finally(() => {
      signInPromise = null;
    });
  }
  await signInPromise;
  return auth.currentUser;
}
