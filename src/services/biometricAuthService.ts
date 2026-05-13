import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

let LocalAuthentication: typeof import('expo-local-authentication') | null = null;
try {
  LocalAuthentication = require('expo-local-authentication');
} catch {
  LocalAuthentication = null;
}

const FORGE_LOCK_KEY = 'forge_biometric_lock_enabled';

export class BiometricAuthService {
  private static instance: BiometricAuthService;

  static getInstance(): BiometricAuthService {
    if (!BiometricAuthService.instance) {
      BiometricAuthService.instance = new BiometricAuthService();
    }
    return BiometricAuthService.instance;
  }

  async isSupported(): Promise<boolean> {
    if (!LocalAuthentication) return false;
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    return hasHardware && isEnrolled;
  }

  async getSupportedBiometryType(): Promise<string | null> {
    if (!LocalAuthentication) return null;
    const isSupported = await this.isSupported();
    if (!isSupported) return null;

    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return 'FACE';
    }
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return 'FINGERPRINT';
    }
    return null;
  }

  async authenticate(promptMessage?: string): Promise<boolean> {
    if (!LocalAuthentication) return true;
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: promptMessage || 'Authenticate to continue',
        fallbackLabel: 'Use Passcode',
        cancelLabel: 'Cancel',
      });

      return result.success;
    } catch (e) {
      console.error('[BiometricAuth] authenticate failed:', e);
      return false;
    }
  }

  async isForgeLockEnabled(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(FORGE_LOCK_KEY);
      return value === 'true';
    } catch {
      return false;
    }
  }

  async setForgeLockEnabled(enabled: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(FORGE_LOCK_KEY, enabled ? 'true' : 'false');
    } catch (e) {
      console.error('[BiometricAuth] setForgeLockEnabled failed:', e);
    }
  }
}

export const biometricAuthService = BiometricAuthService.getInstance();
