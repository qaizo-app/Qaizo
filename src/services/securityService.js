// src/services/securityService.js
// PIN-код (биометрия будет добавлена в production build)
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

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

  // --- Biometric (placeholder — needs native build) ---
  async isBiometricAvailable() {
    return false;
  },

  async isBiometricEnabled() {
    return false;
  },

  async setBiometricEnabled() {},

  async authenticateWithBiometric() {
    return false;
  },

  async isLockEnabled() {
    return await this.isPinEnabled();
  },
};

export default securityService;
