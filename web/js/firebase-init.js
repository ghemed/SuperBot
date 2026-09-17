// web/js/firebase-init.js
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
