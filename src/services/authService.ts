import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { LoginManager, AccessToken } from 'react-native-fbsdk-next';
import { appleAuth } from '@invertase/react-native-apple-authentication';
import { Platform } from 'react-native';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  providerId: string;
  emailVerified: boolean;
  createdAt: Date;
  lastLoginAt: Date;
}

class AuthService {
  private static instance: AuthService;
  private currentUser: FirebaseAuthTypes.User | null = null;

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  constructor() {
    // Configure Google Sign-In
    const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
    
    if (webClientId) {
      GoogleSignin.configure({
        webClientId,
        iosClientId: iosClientId || undefined,
      });
    }

    // Listen to auth state changes
    auth().onAuthStateChanged((user) => {
      this.currentUser = user;
    });
  }

  getCurrentUser(): FirebaseAuthTypes.User | null {
    return this.currentUser || auth().currentUser;
  }

  isAuthenticated(): boolean {
    return !!this.getCurrentUser();
  }

  async getUserProfile(): Promise<UserProfile | null> {
    const user = this.getCurrentUser();
    if (!user) return null;

    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      providerId: user.providerData[0]?.providerId || 'password',
      emailVerified: user.emailVerified,
      createdAt: new Date(user.metadata.creationTime || Date.now()),
      lastLoginAt: new Date(user.metadata.lastSignInTime || Date.now()),
    };
  }

  // Email/Password Authentication
  async registerWithEmail(email: string, password: string, displayName?: string): Promise<UserProfile> {
    try {
      const userCredential = await auth().createUserWithEmailAndPassword(email, password);
      
      if (displayName && userCredential.user) {
        await userCredential.user.updateProfile({ displayName });
      }

      return this.getUserProfile() as Promise<UserProfile>;
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  async loginWithEmail(email: string, password: string): Promise<UserProfile> {
    try {
      await auth().signInWithEmailAndPassword(email, password);
      return this.getUserProfile() as Promise<UserProfile>;
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  // Google Sign-In
  async signInWithGoogle(): Promise<UserProfile> {
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const signInResult = await GoogleSignin.signIn();
      
      if (!signInResult.data?.idToken) {
        throw new Error('No ID token found');
      }

      const googleCredential = auth.GoogleAuthProvider.credential(signInResult.data.idToken);
      await auth().signInWithCredential(googleCredential);
      
      return this.getUserProfile() as Promise<UserProfile>;
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  // Apple Sign-In
  async signInWithApple(): Promise<UserProfile> {
    if (Platform.OS !== 'ios') {
      throw new Error('Apple Sign-In is only available on iOS');
    }

    try {
      const appleAuthRequestResponse = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
      });

      if (!appleAuthRequestResponse.identityToken) {
        throw new Error('Apple Sign-In failed - no identity token');
      }

      const { identityToken, nonce, fullName } = appleAuthRequestResponse;
      const appleCredential = auth.AppleAuthProvider.credential(identityToken, nonce);
      
      const userCredential = await auth().signInWithCredential(appleCredential);
      
      // Update display name if provided by Apple
      if (fullName?.givenName && userCredential.user) {
        const displayName = `${fullName.givenName} ${fullName.familyName || ''}`.trim();
        await userCredential.user.updateProfile({ displayName });
      }

      return this.getUserProfile() as Promise<UserProfile>;
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  // Facebook Sign-In
  async signInWithFacebook(): Promise<UserProfile> {
    try {
      const result = await LoginManager.logInWithPermissions(['public_profile', 'email']);
      
      if (result.isCancelled) {
        throw new Error('Facebook login was cancelled');
      }

      const data = await AccessToken.getCurrentAccessToken();
      
      if (!data?.accessToken) {
        throw new Error('No access token found');
      }

      const facebookCredential = auth.FacebookAuthProvider.credential(data.accessToken);
      await auth().signInWithCredential(facebookCredential);
      
      return this.getUserProfile() as Promise<UserProfile>;
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  // Update Profile
  async updateProfile(displayName?: string, photoURL?: string): Promise<void> {
    const user = this.getCurrentUser();
    if (!user) throw new Error('No user is currently signed in');

    try {
      await user.updateProfile({
        displayName: displayName || user.displayName,
        photoURL: photoURL || user.photoURL,
      });
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  // Update Email
  async updateEmail(newEmail: string): Promise<void> {
    const user = this.getCurrentUser();
    if (!user) throw new Error('No user is currently signed in');

    try {
      await user.updateEmail(newEmail);
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  // Update Password
  async updatePassword(newPassword: string): Promise<void> {
    const user = this.getCurrentUser();
    if (!user) throw new Error('No user is currently signed in');

    try {
      await user.updatePassword(newPassword);
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  // Send Password Reset
  async sendPasswordReset(email: string): Promise<void> {
    try {
      await auth().sendPasswordResetEmail(email);
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  // Send Email Verification
  async sendEmailVerification(): Promise<void> {
    const user = this.getCurrentUser();
    if (!user) throw new Error('No user is currently signed in');

    try {
      await user.sendEmailVerification();
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  // Re-authenticate (needed for sensitive operations)
  async reauthenticate(password: string): Promise<void> {
    const user = this.getCurrentUser();
    if (!user || !user.email) throw new Error('No user is currently signed in');

    try {
      const credential = auth.EmailAuthProvider.credential(user.email, password);
      await user.reauthenticateWithCredential(credential);
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  // Sign Out
  async signOut(): Promise<void> {
    try {
      // Sign out from all providers
      try { await GoogleSignin.signOut(); } catch (e) { console.warn('[AuthService] Google signOut failed:', e); }
      try { LoginManager.logOut(); } catch (e) { console.warn('[AuthService] Facebook logOut failed:', e); }
      await auth().signOut();
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  // Delete Account
  async deleteAccount(): Promise<void> {
    const user = this.getCurrentUser();
    if (!user) throw new Error('No user is currently signed in');

    try {
      await user.delete();
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  // Error Handler
  private handleAuthError(error: any): Error {
    let message = 'An error occurred during authentication';

    if (error.code) {
      switch (error.code) {
        case 'auth/email-already-in-use':
          message = 'This email is already registered';
          break;
        case 'auth/invalid-email':
          message = 'Invalid email address';
          break;
        case 'auth/weak-password':
          message = 'Password is too weak. Use at least 6 characters';
          break;
        case 'auth/user-not-found':
          message = 'No account found with this email';
          break;
        case 'auth/wrong-password':
          message = 'Incorrect password';
          break;
        case 'auth/invalid-credential':
          message = 'Invalid email or password';
          break;
        case 'auth/user-disabled':
          message = 'This account has been disabled';
          break;
        case 'auth/requires-recent-login':
          message = 'Please log in again to perform this action';
          break;
        case 'auth/too-many-requests':
          message = 'Too many attempts. Please try again later';
          break;
        case 'auth/network-request-failed':
          message = 'Network error. Please check your connection';
          break;
        default:
          message = error.message || message;
      }
    }

    return new Error(message);
  }
}

export const authService = AuthService.getInstance();
