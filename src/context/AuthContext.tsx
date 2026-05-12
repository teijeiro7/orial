import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService, UserProfile } from '@/src/services/authService';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';

interface AuthContextType {
  user: UserProfile | null;
  firebaseUser: FirebaseAuthTypes.User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithApple: () => Promise<void>;
  loginWithFacebook: () => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfile: (displayName?: string, photoURL?: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(async (firebaseUser) => {
      setFirebaseUser(firebaseUser);
      
      if (firebaseUser) {
        const profile = await authService.getUserProfile();
        setUser(profile);
      } else {
        setUser(null);
      }
      
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    const profile = await authService.loginWithEmail(email, password);
    setUser(profile);
  };

  const register = async (email: string, password: string, displayName?: string) => {
    const profile = await authService.registerWithEmail(email, password, displayName);
    setUser(profile);
  };

  const loginWithGoogle = async () => {
    const profile = await authService.signInWithGoogle();
    setUser(profile);
  };

  const loginWithApple = async () => {
    const profile = await authService.signInWithApple();
    setUser(profile);
  };

  const loginWithFacebook = async () => {
    const profile = await authService.signInWithFacebook();
    setUser(profile);
  };

  const logout = async () => {
    await authService.signOut();
    setUser(null);
    setFirebaseUser(null);
  };

  const updateUserProfile = async (displayName?: string, photoURL?: string) => {
    await authService.updateProfile(displayName, photoURL);
    const profile = await authService.getUserProfile();
    setUser(profile);
  };

  const sendPasswordReset = async (email: string) => {
    await authService.sendPasswordReset(email);
  };

  const refreshUser = async () => {
    const profile = await authService.getUserProfile();
    setUser(profile);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        loginWithGoogle,
        loginWithApple,
        loginWithFacebook,
        logout,
        updateUserProfile,
        sendPasswordReset,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
