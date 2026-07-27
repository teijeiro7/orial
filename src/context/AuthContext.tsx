import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService, UserProfile } from '@/src/services/authService';
import { supabaseService } from '@/src/services/supabaseService';

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfile: (displayName?: string, photoURL?: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const { data } = supabaseService.getClient().auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        try {
          const profile = await authService.getUserProfile();
          setUser(profile);
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
      }

      setIsLoading(false);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const profile = await authService.loginWithEmail(email, password);
    setUser(profile);
  };

  const logout = async () => {
    await authService.signOut();
    setUser(null);
  };

  const updateUserProfile = async (displayName?: string, photoURL?: string) => {
    await authService.updateProfile(displayName, photoURL);
    const profile = await authService.getUserProfile();
    setUser(profile);
  };

  const refreshUser = async () => {
    const profile = await authService.getUserProfile();
    setUser(profile);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        updateUserProfile,
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
