import { Platform } from 'react-native';

// Mock every native auth provider authService touches at import time or call time.
jest.mock('@react-native-firebase/auth', () => {
  const instance = {
    currentUser: null as any,
    createUserWithEmailAndPassword: jest.fn(),
    signInWithEmailAndPassword: jest.fn(),
    signInWithCredential: jest.fn(),
    signOut: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
    onAuthStateChanged: jest.fn(() => jest.fn()),
  };
  const authFn: any = jest.fn(() => instance);
  authFn.GoogleAuthProvider = { credential: jest.fn(() => 'google-credential') };
  authFn.AppleAuthProvider = { credential: jest.fn(() => 'apple-credential') };
  authFn.FacebookAuthProvider = { credential: jest.fn(() => 'facebook-credential') };
  authFn.EmailAuthProvider = { credential: jest.fn(() => 'email-credential') };
  authFn.__mockInstance = instance;
  return { __esModule: true, default: authFn };
});

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
  },
}));

jest.mock('react-native-fbsdk-next', () => ({
  LoginManager: {
    logInWithPermissions: jest.fn(),
    logOut: jest.fn(),
  },
  AccessToken: {
    getCurrentAccessToken: jest.fn(),
  },
}));

jest.mock('@invertase/react-native-apple-authentication', () => ({
  appleAuth: {
    performRequest: jest.fn(),
    Operation: { LOGIN: 'LOGIN' },
    Scope: { FULL_NAME: 'FULL_NAME', EMAIL: 'EMAIL' },
  },
}));

import { authService } from './authService';
import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { LoginManager, AccessToken } from 'react-native-fbsdk-next';
import { appleAuth } from '@invertase/react-native-apple-authentication';

const mockAuth = auth as unknown as jest.Mock & {
  GoogleAuthProvider: { credential: jest.Mock };
  AppleAuthProvider: { credential: jest.Mock };
  FacebookAuthProvider: { credential: jest.Mock };
  EmailAuthProvider: { credential: jest.Mock };
  __mockInstance: {
    currentUser: any;
    createUserWithEmailAndPassword: jest.Mock;
    signInWithEmailAndPassword: jest.Mock;
    signInWithCredential: jest.Mock;
    signOut: jest.Mock;
    sendPasswordResetEmail: jest.Mock;
    onAuthStateChanged: jest.Mock;
  };
};

const firebaseAuth = mockAuth.__mockInstance;

const GENERIC_AUTH_ERROR = 'An error occurred during authentication';

function makeFirebaseUser(overrides: Partial<Record<string, any>> = {}) {
  return {
    uid: 'user-1',
    email: 'test@example.com',
    displayName: null,
    photoURL: null,
    emailVerified: false,
    providerData: [{ providerId: 'password' }],
    metadata: { creationTime: '2026-01-01T00:00:00.000Z', lastSignInTime: '2026-01-02T00:00:00.000Z' },
    updateProfile: jest.fn().mockResolvedValue(undefined),
    updateEmail: jest.fn().mockResolvedValue(undefined),
    updatePassword: jest.fn().mockResolvedValue(undefined),
    sendEmailVerification: jest.fn().mockResolvedValue(undefined),
    reauthenticateWithCredential: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('authService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    firebaseAuth.currentUser = null;
    Platform.OS = 'ios';
  });

  describe('registerWithEmail', () => {
    it('creates the user and returns the mapped profile', async () => {
      const user = makeFirebaseUser();
      firebaseAuth.createUserWithEmailAndPassword.mockImplementation(async () => {
        firebaseAuth.currentUser = user;
        return { user };
      });

      const profile = await authService.registerWithEmail('test@example.com', 'password123');

      expect(firebaseAuth.createUserWithEmailAndPassword).toHaveBeenCalledWith(
        'test@example.com',
        'password123',
      );
      expect(profile.uid).toBe('user-1');
      expect(profile.providerId).toBe('password');
    });

    it('updates the profile display name when one is provided', async () => {
      const user = makeFirebaseUser();
      firebaseAuth.createUserWithEmailAndPassword.mockImplementation(async () => {
        firebaseAuth.currentUser = user;
        return { user };
      });

      await authService.registerWithEmail('test@example.com', 'password123', 'Jane Doe');

      expect(user.updateProfile).toHaveBeenCalledWith({ displayName: 'Jane Doe' });
    });

    it('maps auth/email-already-in-use to a friendly message', async () => {
      firebaseAuth.createUserWithEmailAndPassword.mockRejectedValue({
        code: 'auth/email-already-in-use',
      });

      await expect(
        authService.registerWithEmail('test@example.com', 'password123'),
      ).rejects.toThrow('This email is already registered');
    });
  });

  describe('loginWithEmail', () => {
    it('signs in and returns the mapped profile', async () => {
      const user = makeFirebaseUser();
      firebaseAuth.signInWithEmailAndPassword.mockImplementation(async () => {
        firebaseAuth.currentUser = user;
        return { user };
      });

      const profile = await authService.loginWithEmail('test@example.com', 'password123');

      expect(firebaseAuth.signInWithEmailAndPassword).toHaveBeenCalledWith(
        'test@example.com',
        'password123',
      );
      expect(profile.email).toBe('test@example.com');
    });

    it('maps auth/wrong-password to a friendly message', async () => {
      firebaseAuth.signInWithEmailAndPassword.mockRejectedValue({ code: 'auth/wrong-password' });

      await expect(
        authService.loginWithEmail('test@example.com', 'bad-password'),
      ).rejects.toThrow('Incorrect password');
    });

    it('falls back to the raw error message for an unmapped error code', async () => {
      firebaseAuth.signInWithEmailAndPassword.mockRejectedValue({
        code: 'auth/some-unmapped-code',
        message: 'boom',
      });

      await expect(
        authService.loginWithEmail('test@example.com', 'bad-password'),
      ).rejects.toThrow('boom');
    });
  });

  describe('signInWithGoogle', () => {
    it('exchanges the Google ID token for a Firebase credential and signs in', async () => {
      (GoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(true);
      (GoogleSignin.signIn as jest.Mock).mockResolvedValue({ data: { idToken: 'google-id-token' } });
      const user = makeFirebaseUser();
      firebaseAuth.signInWithCredential.mockImplementation(async () => {
        firebaseAuth.currentUser = user;
        return { user };
      });

      const profile = await authService.signInWithGoogle();

      expect(mockAuth.GoogleAuthProvider.credential).toHaveBeenCalledWith('google-id-token');
      expect(firebaseAuth.signInWithCredential).toHaveBeenCalledWith('google-credential');
      expect(profile.uid).toBe('user-1');
    });

    it('throws a generic error when Google Sign-In returns no ID token', async () => {
      (GoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(true);
      (GoogleSignin.signIn as jest.Mock).mockResolvedValue({ data: {} });

      await expect(authService.signInWithGoogle()).rejects.toThrow(GENERIC_AUTH_ERROR);
    });
  });

  describe('signInWithApple', () => {
    it('throws immediately on non-iOS platforms without calling Apple auth', async () => {
      Platform.OS = 'android';

      await expect(authService.signInWithApple()).rejects.toThrow(
        'Apple Sign-In is only available on iOS',
      );
      expect(appleAuth.performRequest).not.toHaveBeenCalled();
    });

    it('signs in with the Apple identity token and updates the display name', async () => {
      (appleAuth.performRequest as jest.Mock).mockResolvedValue({
        identityToken: 'apple-identity-token',
        nonce: 'nonce-123',
        fullName: { givenName: 'Jane', familyName: 'Doe' },
      });
      const user = makeFirebaseUser();
      firebaseAuth.signInWithCredential.mockImplementation(async () => {
        firebaseAuth.currentUser = user;
        return { user };
      });

      const profile = await authService.signInWithApple();

      expect(mockAuth.AppleAuthProvider.credential).toHaveBeenCalledWith(
        'apple-identity-token',
        'nonce-123',
      );
      expect(user.updateProfile).toHaveBeenCalledWith({ displayName: 'Jane Doe' });
      expect(profile.uid).toBe('user-1');
    });

    it('throws a generic error when Apple Sign-In returns no identity token', async () => {
      (appleAuth.performRequest as jest.Mock).mockResolvedValue({ identityToken: null });

      await expect(authService.signInWithApple()).rejects.toThrow(GENERIC_AUTH_ERROR);
    });
  });

  describe('signInWithFacebook', () => {
    it('signs in with the Facebook access token', async () => {
      (LoginManager.logInWithPermissions as jest.Mock).mockResolvedValue({ isCancelled: false });
      (AccessToken.getCurrentAccessToken as jest.Mock).mockResolvedValue({ accessToken: 'fb-token' });
      const user = makeFirebaseUser();
      firebaseAuth.signInWithCredential.mockImplementation(async () => {
        firebaseAuth.currentUser = user;
        return { user };
      });

      const profile = await authService.signInWithFacebook();

      expect(mockAuth.FacebookAuthProvider.credential).toHaveBeenCalledWith('fb-token');
      expect(profile.uid).toBe('user-1');
    });

    it('throws a generic error when the Facebook login is cancelled', async () => {
      (LoginManager.logInWithPermissions as jest.Mock).mockResolvedValue({ isCancelled: true });

      await expect(authService.signInWithFacebook()).rejects.toThrow(GENERIC_AUTH_ERROR);
    });

    it('throws a generic error when no Facebook access token is returned', async () => {
      (LoginManager.logInWithPermissions as jest.Mock).mockResolvedValue({ isCancelled: false });
      (AccessToken.getCurrentAccessToken as jest.Mock).mockResolvedValue(null);

      await expect(authService.signInWithFacebook()).rejects.toThrow(GENERIC_AUTH_ERROR);
    });
  });

  describe('signOut', () => {
    it('signs out of Google, Facebook, and Firebase', async () => {
      (GoogleSignin.signOut as jest.Mock).mockResolvedValue(undefined);
      firebaseAuth.signOut.mockResolvedValue(undefined);

      await authService.signOut();

      expect(GoogleSignin.signOut).toHaveBeenCalled();
      expect(LoginManager.logOut).toHaveBeenCalled();
      expect(firebaseAuth.signOut).toHaveBeenCalled();
    });

    it('warns but still signs out of Firebase when Google signOut fails', async () => {
      (GoogleSignin.signOut as jest.Mock).mockRejectedValue(new Error('google unavailable'));
      firebaseAuth.signOut.mockResolvedValue(undefined);
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      await authService.signOut();

      expect(warnSpy).toHaveBeenCalledWith('[AuthService] Google signOut failed:', expect.any(Error));
      expect(firebaseAuth.signOut).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('warns but still signs out of Firebase when Facebook logOut throws', async () => {
      (LoginManager.logOut as jest.Mock).mockImplementation(() => {
        throw new Error('fb unavailable');
      });
      firebaseAuth.signOut.mockResolvedValue(undefined);
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      await authService.signOut();

      expect(warnSpy).toHaveBeenCalledWith('[AuthService] Facebook logOut failed:', expect.any(Error));
      expect(firebaseAuth.signOut).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('maps a Firebase signOut failure to a friendly message', async () => {
      firebaseAuth.signOut.mockRejectedValue({ code: 'auth/network-request-failed' });

      await expect(authService.signOut()).rejects.toThrow(
        'Network error. Please check your connection',
      );
    });
  });

  describe('getUserProfile', () => {
    it('throws when there is no authenticated user', async () => {
      firebaseAuth.currentUser = null;

      await expect(authService.getUserProfile()).rejects.toThrow('No authenticated user found');
    });

    it('maps the Firebase user onto a UserProfile, defaulting providerId to password', async () => {
      firebaseAuth.currentUser = makeFirebaseUser({ providerData: [] });

      const profile = await authService.getUserProfile();

      expect(profile.providerId).toBe('password');
      expect(profile.uid).toBe('user-1');
      expect(profile.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('getCurrentUser / isAuthenticated', () => {
    it('returns null / false when nobody is signed in', () => {
      firebaseAuth.currentUser = null;

      expect(authService.getCurrentUser()).toBeNull();
      expect(authService.isAuthenticated()).toBe(false);
    });

    it('returns the user / true once signed in', () => {
      firebaseAuth.currentUser = makeFirebaseUser();

      expect(authService.getCurrentUser()?.uid).toBe('user-1');
      expect(authService.isAuthenticated()).toBe(true);
    });
  });

  describe('updateProfile', () => {
    it('throws when nobody is signed in', async () => {
      await expect(authService.updateProfile('New Name')).rejects.toThrow(
        'No user is currently signed in',
      );
    });

    it('updates displayName/photoURL, falling back to the existing values', async () => {
      const user = makeFirebaseUser({ displayName: 'Old Name', photoURL: 'old.png' });
      firebaseAuth.currentUser = user;

      await authService.updateProfile('New Name');

      expect(user.updateProfile).toHaveBeenCalledWith({ displayName: 'New Name', photoURL: 'old.png' });
    });
  });

  describe('updateEmail', () => {
    it('throws when nobody is signed in', async () => {
      await expect(authService.updateEmail('new@example.com')).rejects.toThrow(
        'No user is currently signed in',
      );
    });

    it('updates the email for the current user', async () => {
      const user = makeFirebaseUser();
      firebaseAuth.currentUser = user;

      await authService.updateEmail('new@example.com');

      expect(user.updateEmail).toHaveBeenCalledWith('new@example.com');
    });
  });

  describe('updatePassword', () => {
    it('throws when nobody is signed in', async () => {
      await expect(authService.updatePassword('newpass123')).rejects.toThrow(
        'No user is currently signed in',
      );
    });

    it('updates the password for the current user', async () => {
      const user = makeFirebaseUser();
      firebaseAuth.currentUser = user;

      await authService.updatePassword('newpass123');

      expect(user.updatePassword).toHaveBeenCalledWith('newpass123');
    });
  });

  describe('sendPasswordReset', () => {
    it('sends a password reset email', async () => {
      firebaseAuth.sendPasswordResetEmail.mockResolvedValue(undefined);

      await authService.sendPasswordReset('test@example.com');

      expect(firebaseAuth.sendPasswordResetEmail).toHaveBeenCalledWith('test@example.com');
    });

    it('maps auth/user-not-found to a friendly message', async () => {
      firebaseAuth.sendPasswordResetEmail.mockRejectedValue({ code: 'auth/user-not-found' });

      await expect(authService.sendPasswordReset('nobody@example.com')).rejects.toThrow(
        'No account found with this email',
      );
    });
  });

  describe('sendEmailVerification', () => {
    it('throws when nobody is signed in', async () => {
      await expect(authService.sendEmailVerification()).rejects.toThrow(
        'No user is currently signed in',
      );
    });

    it('sends the verification email for the current user', async () => {
      const user = makeFirebaseUser();
      firebaseAuth.currentUser = user;

      await authService.sendEmailVerification();

      expect(user.sendEmailVerification).toHaveBeenCalled();
    });
  });

  describe('reauthenticate', () => {
    it('throws when nobody is signed in', async () => {
      await expect(authService.reauthenticate('password123')).rejects.toThrow(
        'No user is currently signed in',
      );
    });

    it('throws when the current user has no email', async () => {
      firebaseAuth.currentUser = makeFirebaseUser({ email: null });

      await expect(authService.reauthenticate('password123')).rejects.toThrow(
        'No user is currently signed in',
      );
    });

    it('re-authenticates with an email/password credential', async () => {
      const user = makeFirebaseUser();
      firebaseAuth.currentUser = user;

      await authService.reauthenticate('password123');

      expect(mockAuth.EmailAuthProvider.credential).toHaveBeenCalledWith(
        'test@example.com',
        'password123',
      );
      expect(user.reauthenticateWithCredential).toHaveBeenCalledWith('email-credential');
    });
  });

  describe('deleteAccount', () => {
    it('throws when nobody is signed in', async () => {
      await expect(authService.deleteAccount()).rejects.toThrow('No user is currently signed in');
    });

    it('deletes the current user', async () => {
      const user = makeFirebaseUser();
      firebaseAuth.currentUser = user;

      await authService.deleteAccount();

      expect(user.delete).toHaveBeenCalled();
    });

    it('maps auth/requires-recent-login to a friendly message', async () => {
      const user = makeFirebaseUser({
        delete: jest.fn().mockRejectedValue({ code: 'auth/requires-recent-login' }),
      });
      firebaseAuth.currentUser = user;

      await expect(authService.deleteAccount()).rejects.toThrow(
        'Please log in again to perform this action',
      );
    });
  });
});
