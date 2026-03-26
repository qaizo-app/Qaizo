import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAP3qu6pOnmc-JQxt4LtXMX_0UYUAnWYUE",
  authDomain: "qaizo-ece06.firebaseapp.com",
  projectId: "qaizo-ece06",
  storageBucket: "qaizo-ece06.firebasestorage.app",
  messagingSenderId: "568492177874",
  appId: "1:568492177874:web:019151972555cba53b700b",
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  localCache: persistentLocalCache(),
});

export { app, db };
