import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

let app;
let auth;
let db;

try {
  if (!firebaseConfig.apiKey) {
    console.warn("Firebase config missing. Using mock auth/db.");
    throw new Error("Missing config");
  }
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (e) {
  // Mock objects to prevent crash
  app = {} as any;
  auth = { currentUser: null, onAuthStateChanged: (cb: any) => { cb(null); return () => { }; } } as any;
  db = {} as any;
}

export const isMock = !firebaseConfig.apiKey;
export { auth, db };
