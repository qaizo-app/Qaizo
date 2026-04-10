// src/services/securityService.js
// PIN-код + биометрическая аутентификация (fingerprint / face)
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

// Lazy import — avoid crash if native module not linked
let LocalAuthentication = null;
try { LocalAuthentication = require('expo-local-authentication'); } catch (e) {}

const KEYS = {
  PIN_HASH: 'qaizo_pin_hash',
  PIN_ENABLED: 'qaizo_pin_enabled',
  BIOMETRIC_ENABLED: 'qaizo_biometric_enabled',
};

const securityService = {
  // --- PIN ---
  async hashPin(pin) {
    return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin + '_qaizo_salt');
  },

  async setPin(pin) {
    const hash = await this.hashPin(pin);
    await AsyncStorage.setItem(KEYS.PIN_HASH, hash);
    await AsyncStorage.setItem(KEYS.PIN_ENABLED, 'true');
  },

  async removePin() {
    await AsyncStorage.removeItem(KEYS.PIN_HASH);
    await AsyncStorage.setItem(KEYS.PIN_ENABLED, 'false');
    await AsyncStorage.setItem(KEYS.BIOMETRIC_ENABLED, 'false');
  },

  async verifyPin(pin) {
    const stored = await AsyncStorage.getItem(KEYS.PIN_HASH);
    if (!stored) return false;
    const hash = await this.hashPin(pin);
    return hash === stored;
  },

  async isPinEnabled() {
    const val = await AsyncStorage.getItem(KEYS.PIN_ENABLED);
    return val === 'true';
  },

  // --- Biometric ---
  async isBiometricAvailable() {
    try {
      if (!LocalAuthentication) return false;
      const compatible = await LocalAuthentication.hasHardwareAsync();
      if (!compatible) return false;
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      return enrolled;
    } catch (e) { return false; }
  },

  async isBiometricEnabled() {
    const available = await this.isBiometricAvailable();
    if (!available) return false;
    const val = await AsyncStorage.getItem(KEYS.BIOMETRIC_ENABLED);
    return val === 'true';
  },

  async setBiometricEnabled(enabled) {
    await AsyncStorage.setItem(KEYS.BIOMETRIC_ENABLED, enabled ? 'true' : 'false');
  },

  async authenticateWithBiometric(promptMessage) {
    try {
      if (!LocalAuthentication) return false;
      const available = await this.isBiometricAvailable();
      if (!available) return false;
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: promptMessage || 'Unlock Qaizo',
        cancelLabel: 'Use PIN',
        disableDeviceFallback: true,
      });
      return result.success;
    } catch (e) { return false; }
  },

  async isLockEnabled() {
    return await this.isPinEnabled();
  },
};

export default securityService;
