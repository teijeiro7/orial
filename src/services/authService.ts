import type { User } from '@supabase/supabase-js';
import { supabaseService } from './supabaseService';

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

let currentUser: User | null = null;

function getAuth() {
  return supabaseService.getClient().auth;
}

// Keeps `getCurrentUser()` synchronous (progressPhotoService and the sync
// push adapter both need the uid without awaiting a session lookup).
getAuth().onAuthStateChange((_event, session) => {
  currentUser = session?.user ?? null;
});

function getCurrentUser(): User | null {
  return currentUser;
}

function isAuthenticated(): boolean {
  return !!getCurrentUser();
}

async function getUserProfile(): Promise<UserProfile> {
  const user = getCurrentUser();
  if (!user) {
    throw new Error('No authenticated user found');
  }

  return {
    uid: user.id,
    email: user.email ?? null,
    displayName: (user.user_metadata?.display_name as string | undefined) ?? null,
    photoURL: (user.user_metadata?.avatar_url as string | undefined) ?? null,
    providerId: user.app_metadata?.provider || 'email',
    emailVerified: !!user.email_confirmed_at,
    createdAt: new Date(user.created_at),
    lastLoginAt: new Date(user.last_sign_in_at || user.created_at),
  };
}

// Error Handler
function handleAuthError(error: any): Error {
  let message = 'An error occurred during authentication';

  if (error.code) {
    switch (error.code) {
      case 'invalid_credentials':
        message = 'Incorrect email or password';
        break;
      case 'email_not_confirmed':
        message = 'Please confirm your email before signing in';
        break;
      case 'user_not_found':
        message = 'No account found with this email';
        break;
      case 'weak_password':
        message = 'Password is too weak. Use at least 6 characters';
        break;
      case 'validation_failed':
        message = 'Invalid email address';
        break;
      case 'over_request_rate_limit':
        message = 'Too many attempts. Please try again later';
        break;
      default:
        message = error.message || message;
    }
  } else {
    message = error.message || message;
  }

  return new Error(message);
}

// Email/Password Authentication
async function loginWithEmail(email: string, password: string): Promise<UserProfile> {
  try {
    const { error } = await getAuth().signInWithPassword({ email, password });
    if (error) throw error;
    return await getUserProfile();
  } catch (error: any) {
    throw handleAuthError(error);
  }
}

// Update Profile
async function updateProfile(displayName?: string, photoURL?: string): Promise<void> {
  const user = getCurrentUser();
  if (!user) throw new Error('No user is currently signed in');

  try {
    const { error } = await getAuth().updateUser({
      data: {
        display_name: displayName ?? user.user_metadata?.display_name ?? null,
        avatar_url: photoURL ?? user.user_metadata?.avatar_url ?? null,
      },
    });
    if (error) throw error;
  } catch (error: any) {
    throw handleAuthError(error);
  }
}

// Sign Out
async function signOut(): Promise<void> {
  try {
    const { error } = await getAuth().signOut();
    if (error) throw error;
  } catch (error: any) {
    throw handleAuthError(error);
  }
}

export const authService = {
  getCurrentUser,
  isAuthenticated,
  getUserProfile,
  loginWithEmail,
  updateProfile,
  signOut,
};
