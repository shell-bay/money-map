import { renderHook, act } from '@testing-library/react';
import { useAuth } from './useAuth';
import { AuthProvider } from './useAuth';

// Firebase functions are mocked in setupTests.js
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';

const mockUser = { uid: '123', email: 'test@test.com', emailVerified: true };

describe('useAuth hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no user
    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(null);
      return jest.fn();
    });
  });

  const renderHookWithAuth = () => {
    return renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });
  };

  describe('login', () => {
    it('should login successfully with email and password', async () => {
      signInWithEmailAndPassword.mockResolvedValue({ user: mockUser });
      // After login, onAuthStateChanged will fire with user

      const { result } = renderHookWithAuth();

      await act(async () => {
        await result.current.login('test@test.com', 'password123');
      });

      expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
        expect.any(Object),
        'test@test.com',
        'password123'
      );
    });

    it('should set error on invalid credentials', async () => {
      const error = { code: 'auth/wrong-password' };
      signInWithEmailAndPassword.mockRejectedValue(error);

      const { result } = renderHookWithAuth();

      await act(async () => {
        try {
          await result.current.login('test@test.com', 'wrongpass');
        } catch {
          // Expected
        }
      });

      expect(result.current.error).toBe('Invalid email or password');
    });
  });

  describe('signup', () => {
    it('should create account and send verification email', async () => {
      const userCredential = { user: mockUser };
      createUserWithEmailAndPassword.mockResolvedValue(userCredential);

      const { result } = renderHookWithAuth();

      await act(async () => {
        await result.current.signup('new@test.com', 'password123');
      });

      expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(
        expect.any(Object),
        'new@test.com',
        'password123'
      );
      expect(sendEmailVerification).toHaveBeenCalledWith(mockUser);
    });

    it('should set error on email already in use', async () => {
      const error = { code: 'auth/email-already-in-use' };
      createUserWithEmailAndPassword.mockRejectedValue(error);

      const { result } = renderHookWithAuth();

      await act(async () => {
        try {
          await result.current.signup('existing@test.com', 'password123');
        } catch {
          // Expected
        }
      });

      expect(result.current.error).toBe('This email is already registered');
    });
  });

  describe('loginWithGoogle', () => {
    it('should login with Google successfully', async () => {
      signInWithPopup.mockResolvedValue({ user: mockUser });

      const { result } = renderHookWithAuth();

      await act(async () => {
        await result.current.loginWithGoogle();
      });

      expect(signInWithPopup).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should set error when Google popup closed', async () => {
      const error = { code: 'auth/popup-closed-by-user' };
      signInWithPopup.mockRejectedValue(error);

      const { result } = renderHookWithAuth();

      await act(async () => {
        try {
          await result.current.loginWithGoogle();
        } catch {
          // Expected
        }
      });

      expect(result.current.error).toBe('Google sign-in was cancelled');
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      signOut.mockResolvedValue(undefined);

      const { result } = renderHookWithAuth();

      await act(async () => {
        await result.current.logout();
      });

      expect(signOut).toHaveBeenCalled();
    });

    it('should set error on logout failure', async () => {
      signOut.mockRejectedValue(new Error('Network error'));

      const { result } = renderHookWithAuth();

      await act(async () => {
        try {
          await result.current.logout();
        } catch {
          // Expected
        }
      });

      expect(result.current.error).toBe('Failed to log out');
    });
  });

  describe('resetPassword', () => {
    it('should send password reset email', async () => {
      sendPasswordResetEmail.mockResolvedValue(undefined);

      const { result } = renderHookWithAuth();

      await act(async () => {
        await result.current.resetPassword('test@test.com');
      });

      expect(sendPasswordResetEmail).toHaveBeenCalledWith(
        expect.any(Object),
        'test@test.com'
      );
    });

    it('should set error on invalid email', async () => {
      const error = { code: 'auth/invalid-email' };
      sendPasswordResetEmail.mockRejectedValue(error);

      const { result } = renderHookWithAuth();

      await act(async () => {
        try {
          await result.current.resetPassword('invalid');
        } catch {
          // Expected
        }
      });

      expect(result.current.error).toBe('Please enter a valid email address');
    });
  });
});
