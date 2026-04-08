import { useState, useEffect, createContext, useContext } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log('[Auth] Setting up auth state listener');
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('[Auth] State changed:', user ? `User: ${user.uid}, email: ${user.email}` : 'No user');
      setUser(user);
      setLoading(false);
    });

    return () => {
      console.log('[Auth] Cleaning up auth listener');
      unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    try {
      setError(null);
      await signInWithEmailAndPassword(auth, email, password);
      // Reload user to get latest emailVerified status
      const currentUser = auth.currentUser;
      if (currentUser) {
        await currentUser.reload();
      }
    } catch (err) {
      setError(getAuthErrorMessage(err.code));
      throw err;
    }
  };

  const signup = async (email, password) => {
    try {
      setError(null);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(userCredential.user);
    } catch (err) {
      setError(getAuthErrorMessage(err.code));
      throw err;
    }
  };

  const loginWithGoogle = async () => {
    try {
      setError(null);
      const result = await signInWithPopup(auth, googleProvider);
      // The onAuthStateChanged listener will automatically update the user state
      // No need to manually reload - Firebase provides fresh user data
      console.log('Google login successful:', result.user.uid);
    } catch (err) {
      console.error('Google login error:', err);
      setError(getAuthErrorMessage(err.code));
      throw err;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      setError('Failed to log out');
      throw err;
    }
  };

  const resetPassword = async (email) => {
    try {
      setError(null);
      await sendPasswordResetEmail(auth, email);
    } catch (err) {
      setError(getAuthErrorMessage(err.code));
      throw err;
    }
  };

  const updateUserProfile = async (updates) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('No user logged in');
    }
    try {
      setError(null);
      await updateProfile(currentUser, updates);
      // onAuthStateChanged will automatically update the user state
    } catch (err) {
      setError(getAuthErrorMessage(err.code));
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        signup,
        loginWithGoogle,
        logout,
        resetPassword,
        updateUserProfile,
        error,
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

function getAuthErrorMessage(code) {
  switch (code) {
    case 'auth/invalid-email':
      return 'Please enter a valid email address';
    case 'auth/user-disabled':
      return 'This account has been disabled';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Invalid email or password';
    case 'auth/email-already-in-use':
      return 'This email is already registered';
    case 'auth/weak-password':
      return 'Password is too weak. Use at least 6 characters';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in was cancelled. Please try again.';
    case 'auth/popup-blocked-by-user':
      return 'Popup blocked! Please allow popups for this site in your browser settings, or disable popup blocker.';
    case 'auth/operation-not-allowed':
      return 'Google sign-in is not enabled. Please enable Google authentication in Firebase Console.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection.';
    case 'auth/web/internal-error':
      return 'An internal error occurred. Please try again or use a different browser.';
    default:
      console.warn('Unknown auth error code:', code);
      return 'An error occurred. Please try again or use email/password.';
  }
}
