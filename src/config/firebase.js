// src/config/firebase.js
// Firebase configuration for Qaizo
// TODO: Replace with real Firebase config from console.firebase.google.com

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "qaizo.firebaseapp.com",
  projectId: "qaizo",
  storageBucket: "qaizo.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// NOTE: App will work without real Firebase config for now
// It will use local data until Firebase is connected
let app, db, auth;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
} catch (error) {
  console.log('Firebase not configured yet, using local mode');
}

export { app, db, auth };
