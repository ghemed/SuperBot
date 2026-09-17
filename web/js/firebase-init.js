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
  if (!auth.currentUser) {
    await signInAnonymously(auth);
  }
  return auth.currentUser;
}
