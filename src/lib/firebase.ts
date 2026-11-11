import { initializeApp, getApps, getApp } from "firebase/app";
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCes49BuriIQDoafA6Rq_lv64vXDO8F_xY",
  authDomain: "sciora-zed.firebaseapp.com",
  projectId: "sciora-zed",
  storageBucket: "sciora-zed.firebasestorage.app",
  messagingSenderId: "25909263928",
  appId: "1:25909263928:web:e6224998d62937f809b0cd",
  databaseURL: "https://sciora-zed-default-rtdb.firebaseio.com",
};

// Initialize Firebase only if it hasn't been initialized yet
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// In browser / Electron client environment, enable robust offline persistent local cache
// so queries resolve instantly (<1ms) without blocking on cloud network timeouts
let db: ReturnType<typeof getFirestore>;
if (typeof window !== "undefined") {
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    db = getFirestore(app);
  }
} else {
  db = getFirestore(app);
}

// Initialize Storage
const storage = getStorage(app);

export { app, db, storage };
