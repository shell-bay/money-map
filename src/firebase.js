import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, collection, doc } from 'firebase/firestore';

// Firebase configuration
// IMPORTANT: Replace these values with your own Firebase project credentials
// See SETUP_INSTRUCTIONS.md for details
// Get Firebase config from environment variables
// In Create React App, use REACT_APP_ prefix
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || '',
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.REACT_APP_FIREBASE_APP_ID || '',
};

// Validate required config fields (development and production)
const requiredFields = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId'
];
const missing = requiredFields.filter(field => !firebaseConfig[field]);

if (missing.length > 0) {
  const errorMsg = `Firebase configuration incomplete. Missing: ${missing.join(', ')}. Set REACT_APP_FIREBASE_* environment variables.`;
  console.error('[Firebase]', errorMsg);
  throw new Error(errorMsg);
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth
const auth = getAuth(app);

// Initialize Firestore
const db = getFirestore(app);

// Initialize Google OAuth provider
const googleProvider = new GoogleAuthProvider();

// Firestore helpers
function getUserTransactionsCollection(userId) {
  return collection(doc(collection(db, 'users'), userId), 'transactions');
}

function getUserSettingsDoc(userId) {
  // Store settings directly on the user document (valid 2-segment path: users/{userId})
  return doc(collection(db, 'users'), userId);
}

function getUserBillsCollection(userId) {
  // Bills subcollection: users/{userId}/bills
  return collection(doc(collection(db, 'users'), userId), 'bills');
}

export { auth, googleProvider, db, getUserTransactionsCollection, getUserSettingsDoc, getUserBillsCollection };
