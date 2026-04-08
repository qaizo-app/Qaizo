// __tests__/authService.test.js
// Тесты авторизации — Firebase Auth замокан в jest.setup.js

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: jest.fn(),
  },
}));

jest.mock('../src/config/firebase', () => ({
  auth: { currentUser: null },
}));

jest.mock('../src/i18n', () => ({
  default: { getLanguage: () => 'en' },
}));

const {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
} = require('firebase/auth');

const { auth } = require('../src/config/firebase');
const authService = require('../src/services/authService').default;

describe('authService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    auth.currentUser = null;
  });

  // ─── getCurrentUser / getUid ───────────────────
  test('getCurrentUser returns null when no user', () => {
    expect(authService.getCurrentUser()).toBeNull();
  });

  test('getUid returns null when no user', () => {
    expect(authService.getUid()).toBeNull();
  });

  test('getUid returns uid when user exists', () => {
    auth.currentUser = { uid: 'abc123', email: 'test@test.com' };
    expect(authService.getUid()).toBe('abc123');
  });

  // ─── register ──────────────────────────────────
  test('register success without displayName', async () => {
    const fakeUser = { uid: 'u1', email: 'a@b.com' };
    createUserWithEmailAndPassword.mockResolvedValue({ user: fakeUser });

    const result = await authService.register('a@b.com', '123456');
    expect(result.success).toBe(true);
    expect(result.user).toEqual(fakeUser);
    expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(auth, 'a@b.com', '123456');
    expect(updateProfile).not.toHaveBeenCalled();
  });

  test('register success with displayName', async () => {
    const fakeUser = { uid: 'u1', email: 'a@b.com' };
    createUserWithEmailAndPassword.mockResolvedValue({ user: fakeUser });
    updateProfile.mockResolvedValue();

    const result = await authService.register('a@b.com', '123456', 'Alex');
    expect(result.success).toBe(true);
    expect(updateProfile).toHaveBeenCalledWith(fakeUser, { displayName: 'Alex' });
  });

  test('register failure returns error message', async () => {
    createUserWithEmailAndPassword.mockRejectedValue({ code: 'auth/email-already-in-use' });

    const result = await authService.register('a@b.com', '123456');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Email already registered');
  });

  test('register with weak password', async () => {
    createUserWithEmailAndPassword.mockRejectedValue({ code: 'auth/weak-password' });

    const result = await authService.register('a@b.com', '123');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Password too short (min 6 chars)');
  });

  // ─── login ─────────────────────────────────────
  test('login success', async () => {
    const fakeUser = { uid: 'u1', email: 'a@b.com' };
    signInWithEmailAndPassword.mockResolvedValue({ user: fakeUser });

    const result = await authService.login('a@b.com', '123456');
    expect(result.success).toBe(true);
    expect(result.user).toEqual(fakeUser);
  });

  test('login failure — wrong password', async () => {
    signInWithEmailAndPassword.mockRejectedValue({ code: 'auth/wrong-password' });

    const result = await authService.login('a@b.com', 'wrong');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Wrong password');
  });

  test('login failure — user not found', async () => {
    signInWithEmailAndPassword.mockRejectedValue({ code: 'auth/user-not-found' });

    const result = await authService.login('no@one.com', '123456');
    expect(result.success).toBe(false);
    expect(result.error).toBe('User not found');
  });

  // ─── logout ────────────────────────────────────
  test('logout success', async () => {
    signOut.mockResolvedValue();
    const result = await authService.logout();
    expect(result.success).toBe(true);
  });

  test('logout failure', async () => {
    signOut.mockRejectedValue(new Error('Network error'));
    const result = await authService.logout();
    expect(result.success).toBe(false);
    expect(result.error).toBe('Network error');
  });

  // ─── resetPassword ─────────────────────────────
  test('resetPassword success', async () => {
    sendPasswordResetEmail.mockResolvedValue();
    const result = await authService.resetPassword('a@b.com');
    expect(result.success).toBe(true);
  });

  test('resetPassword failure', async () => {
    sendPasswordResetEmail.mockRejectedValue({ code: 'auth/user-not-found' });
    const result = await authService.resetPassword('no@one.com');
    expect(result.success).toBe(false);
    expect(result.error).toBe('User not found');
  });

  // ─── onAuthChanged ─────────────────────────────
  test('onAuthChanged registers listener', () => {
    const cb = jest.fn();
    authService.onAuthChanged(cb);
    expect(onAuthStateChanged).toHaveBeenCalledWith(auth, cb);
  });

  // ─── unknown error code ────────────────────────
  test('unknown error code returns code as message', async () => {
    createUserWithEmailAndPassword.mockRejectedValue({ code: 'auth/unknown-error' });
    const result = await authService.register('a@b.com', '123456');
    expect(result.error).toBe('auth/unknown-error');
  });
});
