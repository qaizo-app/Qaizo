// jest.setup.js — глобальные моки для тяжёлых модулей

// React Native global flag — false in tests so error logging is silent
global.__DEV__ = false;

jest.mock('firebase/app', () => ({ initializeApp: jest.fn() }));
jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({ currentUser: null })),
  createUserWithEmailAndPassword: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signInWithCredential: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  sendEmailVerification: jest.fn(() => Promise.resolve()),
  updateProfile: jest.fn(),
  deleteUser: jest.fn(),
  GoogleAuthProvider: { credential: jest.fn() },
}));
jest.mock('expo-auth-session', () => ({
  makeRedirectUri: jest.fn(() => 'test://redirect'),
  AuthRequest: jest.fn(),
  ResponseType: { IdToken: 'id_token' },
}));
jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
}));
jest.mock('expo-crypto', () => ({
  digestStringAsync: jest.fn(() => Promise.resolve('mocked_hash')),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(() => Promise.resolve(false)),
  isEnrolledAsync: jest.fn(() => Promise.resolve(false)),
  authenticateAsync: jest.fn(() => Promise.resolve({ success: false })),
}));
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(() => Promise.resolve({ canceled: true })),
}));
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: '/tmp/',
  readAsStringAsync: jest.fn(() => Promise.resolve('')),
  writeAsStringAsync: jest.fn(() => Promise.resolve()),
  EncodingType: { UTF8: 'utf8' },
}));
jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn(() => Promise.resolve({ uri: '/tmp/test.pdf' })),
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  shareAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock('firebase/firestore', () => ({
  initializeFirestore: jest.fn(() => ({})),
  persistentLocalCache: jest.fn(),
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  addDoc: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn(),
}));
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  scheduleNotificationAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve([])),
  setNotificationChannelAsync: jest.fn(),
  setNotificationCategoryAsync: jest.fn(),
  AndroidImportance: { HIGH: 4 },
}));
