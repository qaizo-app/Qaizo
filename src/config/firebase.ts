// src/config/firebase.js
// Native SDK — initialized from google-services.json / GoogleService-Info.plist
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

const db = firestore();
const authInstance = auth();

export { authInstance as auth, db };
