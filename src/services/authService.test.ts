jest.mock('@supabase/supabase-js', () => {
  const authInstance = {
    onAuthStateChange: jest.fn(),
    signInWithPassword: jest.fn(),
    signOut: jest.fn(),
    updateUser: jest.fn(),
  };
  return {
    createClient: jest.fn(() => ({ auth: authInstance, storage: {} })),
    __authInstance: authInstance,
  };
});

import { authService } from './authService';
import { supabaseService } from './supabaseService';
import * as supabaseJs from '@supabase/supabase-js';

type MockAuthInstance = {
  onAuthStateChange: jest.Mock;
  signInWithPassword: jest.Mock;
  signOut: jest.Mock;
  updateUser: jest.Mock;
};

const mockAuthClient = (supabaseJs as unknown as { __authInstance: MockAuthInstance }).__authInstance;

function makeUser(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'user-1',
    email: 'test@example.com',
    user_metadata: {},
    app_metadata: { provider: 'email' },
    email_confirmed_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    last_sign_in_at: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

let authStateCallback: (event: string, session: any) => void;

beforeAll(() => {
  authStateCallback = mockAuthClient.onAuthStateChange.mock.calls[0][0];
});

function emitSession(session: any) {
  authStateCallback('SIGNED_IN', session);
}

const GENERIC_AUTH_ERROR = 'An error occurred during authentication';

describe('authService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://real.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'real-anon-key';
    supabaseService.resetClient();
    emitSession(null);
  });

  describe('loginWithEmail', () => {
    it('signs in and returns the mapped profile', async () => {
      const user = makeUser();
      mockAuthClient.signInWithPassword.mockImplementation(async () => {
        emitSession({ user });
        return { data: { user, session: { user } }, error: null };
      });

      const profile = await authService.loginWithEmail('test@example.com', 'password123');

      expect(mockAuthClient.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
      expect(profile.uid).toBe('user-1');
      expect(profile.email).toBe('test@example.com');
    });

    it('maps invalid_credentials to a friendly message', async () => {
      mockAuthClient.signInWithPassword.mockResolvedValue({
        data: {},
        error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
      });

      await expect(
        authService.loginWithEmail('test@example.com', 'bad-password'),
      ).rejects.toThrow('Incorrect email or password');
    });

    it('falls back to the raw error message for an unmapped error code', async () => {
      mockAuthClient.signInWithPassword.mockResolvedValue({
        data: {},
        error: { code: 'some_unmapped_code', message: 'boom' },
      });

      await expect(
        authService.loginWithEmail('test@example.com', 'bad-password'),
      ).rejects.toThrow('boom');
    });
  });

  describe('getUserProfile', () => {
    it('throws when there is no authenticated user', async () => {
      await expect(authService.getUserProfile()).rejects.toThrow('No authenticated user found');
    });

    it('maps the Supabase user onto a UserProfile, defaulting providerId to email', async () => {
      emitSession({ user: makeUser({ app_metadata: {} }) });

      const profile = await authService.getUserProfile();

      expect(profile.uid).toBe('user-1');
      expect(profile.providerId).toBe('email');
      expect(profile.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('getCurrentUser / isAuthenticated', () => {
    it('returns null / false when nobody is signed in', () => {
      expect(authService.getCurrentUser()).toBeNull();
      expect(authService.isAuthenticated()).toBe(false);
    });

    it('returns the user / true once signed in', () => {
      emitSession({ user: makeUser() });

      expect(authService.getCurrentUser()?.id).toBe('user-1');
      expect(authService.isAuthenticated()).toBe(true);
    });
  });

  describe('updateProfile', () => {
    it('throws when nobody is signed in', async () => {
      await expect(authService.updateProfile('New Name')).rejects.toThrow(
        'No user is currently signed in',
      );
    });

    it('updates display_name/avatar_url, falling back to the existing values', async () => {
      emitSession({
        user: makeUser({ user_metadata: { display_name: 'Old Name', avatar_url: 'old.png' } }),
      });
      mockAuthClient.updateUser.mockResolvedValue({ error: null });

      await authService.updateProfile('New Name');

      expect(mockAuthClient.updateUser).toHaveBeenCalledWith({
        data: { display_name: 'New Name', avatar_url: 'old.png' },
      });
    });
  });

  describe('signOut', () => {
    it('signs out of Supabase', async () => {
      mockAuthClient.signOut.mockResolvedValue({ error: null });

      await authService.signOut();

      expect(mockAuthClient.signOut).toHaveBeenCalled();
    });

    it('maps a rate-limit failure to a friendly message', async () => {
      mockAuthClient.signOut.mockResolvedValue({ error: { code: 'over_request_rate_limit' } });

      await expect(authService.signOut()).rejects.toThrow('Too many attempts. Please try again later');
    });
  });
});

// Guards against the generic fallback message being asserted nowhere.
describe('handleAuthError fallback', () => {
  it('is reachable via an error with neither a mapped code nor a message', async () => {
    mockAuthClient.signInWithPassword.mockResolvedValue({ data: {}, error: {} });

    await expect(
      authService.loginWithEmail('test@example.com', 'bad-password'),
    ).rejects.toThrow(GENERIC_AUTH_ERROR);
  });
});
