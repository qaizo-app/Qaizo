// __tests__/authService.test.js
// Тесты авторизации — @react-native-firebase/auth замокан в jest.setup.js

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: jest.fn(),
  },
}));

const { GoogleSignin } = require('@react-native-google-signin/google-signin');

jest.mock('../src/i18n', () => ({
  default: { getLanguage: () => 'en' },
}));

const auth = require('@react-native-firebase/auth').default;
const authInstance = auth();
const authService = require('../src/services/authService').default;

describe('authService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authInstance.currentUser = null;
  });

  // ─── getCurrentUser / getUid ───────────────────
  test('getCurrentUser returns null when no user', () => {
    expect(authService.getCurrentUser()).toBeNull();
  });

  test('getUid returns null when no user', () => {
    expect(authService.getUid()).toBeNull();
  });

  test('getUid returns uid when user exists', () => {
    authInstance.currentUser = { uid: 'abc123', email: 'test@test.com' };
    expect(authService.getUid()).toBe('abc123');
  });

  // ─── register ──────────────────────────────────
  test('register success without displayName', async () => {
    const fakeUser = { uid: 'u1', email: 'a@b.com', updateProfile: jest.fn(), sendEmailVerification: jest.fn() };
    authInstance.createUserWithEmailAndPassword.mockResolvedValue({ user: fakeUser });

    const result = await authService.register('a@b.com', '123456');
    expect(result.success).toBe(true);
    expect(result.user).toEqual(fakeUser);
    expect(authInstance.createUserWithEmailAndPassword).toHaveBeenCalledWith('a@b.com', '123456');
    expect(fakeUser.updateProfile).not.toHaveBeenCalled();
  });

  test('register success with displayName', async () => {
    const fakeUser = { uid: 'u1', email: 'a@b.com', updateProfile: jest.fn(), sendEmailVerification: jest.fn() };
    authInstance.createUserWithEmailAndPassword.mockResolvedValue({ user: fakeUser });

    const result = await authService.register('a@b.com', '123456', 'Alex');
    expect(result.success).toBe(true);
    expect(fakeUser.updateProfile).toHaveBeenCalledWith({ displayName: 'Alex' });
  });

  test('register failure returns error message', async () => {
    authInstance.createUserWithEmailAndPassword.mockRejectedValue({ code: 'auth/email-already-in-use' });

    const result = await authService.register('a@b.com', '123456');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Email already registered');
  });

  test('register with weak password', async () => {
    authInstance.createUserWithEmailAndPassword.mockRejectedValue({ code: 'auth/weak-password' });

    const result = await authService.register('a@b.com', '123');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Password too short (min 6 chars)');
  });

  // ─── login ─────────────────────────────────────
  test('login success', async () => {
    const fakeUser = { uid: 'u1', email: 'a@b.com' };
    authInstance.signInWithEmailAndPassword.mockResolvedValue({ user: fakeUser });

    const result = await authService.login('a@b.com', '123456');
    expect(result.success).toBe(true);
    expect(result.user).toEqual(fakeUser);
  });

  test('login failure — wrong password', async () => {
    authInstance.signInWithEmailAndPassword.mockRejectedValue({ code: 'auth/wrong-password' });

    const result = await authService.login('a@b.com', 'wrong');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Wrong password');
  });

  test('login failure — user not found', async () => {
    authInstance.signInWithEmailAndPassword.mockRejectedValue({ code: 'auth/user-not-found' });

    const result = await authService.login('no@one.com', '123456');
    expect(result.success).toBe(false);
    expect(result.error).toBe('User not found');
  });

  // ─── logout ────────────────────────────────────
  test('logout success', async () => {
    authInstance.signOut.mockResolvedValue();
    const result = await authService.logout();
    expect(result.success).toBe(true);
  });

  test('logout failure', async () => {
    authInstance.signOut.mockRejectedValue(new Error('Network error'));
    const result = await authService.logout();
    expect(result.success).toBe(false);
    expect(result.error).toBe('Network error');
  });

  // ─── resetPassword ─────────────────────────────
  test('resetPassword success', async () => {
    authInstance.sendPasswordResetEmail.mockResolvedValue();
    const result = await authService.resetPassword('a@b.com');
    expect(result.success).toBe(true);
  });

  test('resetPassword failure', async () => {
    authInstance.sendPasswordResetEmail.mockRejectedValue({ code: 'auth/user-not-found' });
    const result = await authService.resetPassword('no@one.com');
    expect(result.success).toBe(false);
    expect(result.error).toBe('User not found');
  });

  // ─── onAuthChanged ─────────────────────────────
  test('onAuthChanged registers listener', () => {
    const cb = jest.fn();
    authService.onAuthChanged(cb);
    expect(authInstance.onAuthStateChanged).toHaveBeenCalledWith(cb);
  });

  // ─── unknown error code ────────────────────────
  test('unknown error code returns code as message', async () => {
    authInstance.createUserWithEmailAndPassword.mockRejectedValue({ code: 'auth/unknown-error' });
    const result = await authService.register('a@b.com', '123456');
    expect(result.error).toBe('auth/unknown-error');
  });

  // ─── Google Sign-In ─────────────────────────
  test('loginWithGoogle success', async () => {
    GoogleSignin.signIn.mockResolvedValue({ data: { idToken: 'fake-token' } });
    auth.GoogleAuthProvider.credential.mockReturnValue('fake-credential');
    const fakeUser = { uid: 'g1', email: 'g@gmail.com' };
    authInstance.signInWithCredential.mockResolvedValue({ user: fakeUser });

    const result = await authService.loginWithGoogle();
    expect(result.success).toBe(true);
    expect(result.user).toEqual(fakeUser);
    expect(GoogleSignin.hasPlayServices).toHaveBeenCalled();
    expect(authInstance.signInWithCredential).toHaveBeenCalledWith('fake-credential');
  });

  test('loginWithGoogle returns error when no idToken', async () => {
    GoogleSignin.signIn.mockResolvedValue({ data: {} });
    const result = await authService.loginWithGoogle();
    expect(result.success).toBe(false);
    expect(result.error).toBe('No ID token received');
  });

  test('loginWithGoogle handles SIGN_IN_CANCELLED', async () => {
    GoogleSignin.signIn.mockRejectedValue({ code: 'SIGN_IN_CANCELLED' });
    const result = await authService.loginWithGoogle();
    expect(result.success).toBe(false);
    expect(result.error).toBe('Google sign-in cancelled');
  });

  // ─── deleteAccount ───────────────────────────
  test('deleteAccount success', async () => {
    const fakeUser = { uid: 'u1', email: 'a@b.com', delete: jest.fn().mockResolvedValue() };
    authInstance.currentUser = fakeUser;
    const result = await authService.deleteAccount();
    expect(result.success).toBe(true);
    expect(fakeUser.delete).toHaveBeenCalled();
  });

  test('deleteAccount with no current user', async () => {
    authInstance.currentUser = null;
    const result = await authService.deleteAccount();
    expect(result.success).toBe(true);
  });

  test('deleteAccount requires reauth error', async () => {
    const fakeUser = { uid: 'u1', delete: jest.fn().mockRejectedValue({ code: 'auth/requires-recent-login' }) };
    authInstance.currentUser = fakeUser;
    const result = await authService.deleteAccount();
    expect(result.success).toBe(false);
    expect(result.error).toBe('reauth');
  });
});
