// jest-dom adds custom jest matchers for asserting on DOM nodes.
import '@testing-library/jest-dom';

// Set environment variables for Firebase config (dummy values for tests)
process.env.REACT_APP_FIREBASE_API_KEY = 'test-api-key';
process.env.REACT_APP_FIREBASE_AUTH_DOMAIN = 'test-project.firebaseapp.com';
process.env.REACT_APP_FIREBASE_PROJECT_ID = 'test-project';
process.env.REACT_APP_FIREBASE_STORAGE_BUCKET = 'test-project.appspot.com';
process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID = '123456789';
process.env.REACT_APP_FIREBASE_APP_ID = '1:123456789:web:test';

// Mock Firebase auth to avoid initialization errors in tests
jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({
    app: {},
    currentUser: null,
  })),
  GoogleAuthProvider: jest.fn(() => ({})),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signInWithPopup: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  sendEmailVerification: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn((auth, callback) => {
    callback(null);
    return jest.fn(); // unsubscribe
  }),
}));
