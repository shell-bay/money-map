import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

// Firebase functions are mocked in setupTests.js
import { onAuthStateChanged } from 'firebase/auth';

describe('App Routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should redirect from root to /dashboard when not authenticated', () => {
    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(null);
      return jest.fn();
    });

    render(<App />);

    // Since root redirects to /dashboard, and /dashboard redirects to /login
    // We should see login page elements
    expect(screen.getByText('Money Map')).toBeInTheDocument();
    expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
  });

  it('should show login page at /login when not authenticated', () => {
    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(null);
      return jest.fn();
    });

    window.location.hash = '#/login';
    render(<App />);

    expect(screen.getByText('Money Map')).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('should show verification page when user not verified', async () => {
    const unverifiedUser = { uid: '123', email: 'test@test.com', emailVerified: false };
    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(unverifiedUser);
      return jest.fn();
    });

    render(<App />);

    // Since user is not verified, should see verification page
    expect(await screen.findByText('Verify Your Email')).toBeInTheDocument();
    expect(screen.getByText(/We sent a verification link/i)).toBeInTheDocument();
  });

  it('should not show verification page when user is verified', async () => {
    const verifiedUser = { uid: '123', email: 'test@test.com', emailVerified: true };
    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(verifiedUser);
      return jest.fn();
    });

    render(<App />);

    // Should see dashboard, not verification page
    expect(await screen.findByText('Welcome to Money Map!')).toBeInTheDocument();
  });
});
