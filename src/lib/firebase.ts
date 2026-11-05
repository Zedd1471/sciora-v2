import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
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

// Initialize Firestore
const db = getFirestore(app);

// Initialize Storage
const storage = getStorage(app);

export { app, db, storage };
