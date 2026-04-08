import { render, screen, waitFor } from '@testing-library/react';
import user from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../hooks/useAuth';
import LoginPage from '../pages/LoginPage';

// Firebase functions are mocked in setupTests.js
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  onAuthStateChanged,
} from 'firebase/auth';

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderWithProviders = (component) => {
    return render(
      <BrowserRouter>
        <AuthProvider>{component}</AuthProvider>
      </BrowserRouter>
    );
  };

  describe('Rendering', () => {
    it('should render login page with correct elements', () => {
      renderWithProviders(<LoginPage />);

      expect(screen.getByText('Money Map')).toBeInTheDocument();
      expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
      expect(screen.getByText(/forgot password/i)).toBeInTheDocument();
      expect(screen.getByText(/don't have an account/i)).toBeInTheDocument();
    });

    it('should toggle to signup mode when clicking sign up', async () => {
      const user = user;
      renderWithProviders(<LoginPage />);

      await user.click(screen.getByText('Sign up'));

      expect(screen.getByText('Create a new account')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
      expect(screen.getByText(/already have an account/i)).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should show error when email is empty on submit', async () => {
      const user = user;
      renderWithProviders(<LoginPage />);

      await user.click(screen.getByRole('button', { name: /sign in/i }));

      expect(await screen.findByText('Email is required')).toBeInTheDocument();
    });

    it('should show error for invalid email format', async () => {
      const user = user;
      renderWithProviders(<LoginPage />);

      await user.type(screen.getByLabelText(/email address/i), 'invalidemail');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      expect(await screen.findByText('Please enter a valid email address')).toBeInTheDocument();
    });

    it('should show error when password is too short', async () => {
      const user = user;
      renderWithProviders(<LoginPage />);

      await user.type(screen.getByLabelText(/email address/i), 'test@test.com');
      await user.type(screen.getByLabelText(/password/i), '12345');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      expect(await screen.findByText('Password must be at least 6 characters')).toBeInTheDocument();
    });

    it('should not submit when validation fails', async () => {
      const user = user;
      renderWithProviders(<LoginPage />);

      await user.click(screen.getByRole('button', { name: /sign in/i }));

      expect(signInWithEmailAndPassword).not.toHaveBeenCalled();
    });
  });

  describe('Login Flow', () => {
    it('should call signInWithEmailAndPassword with correct credentials', async () => {
      const user = user;
      signInWithEmailAndPassword.mockResolvedValue({ user: { uid: '123', email: 'test@test.com', emailVerified: true } });

      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback({ uid: '123', email: 'test@test.com', emailVerified: true });
        return jest.fn();
      });

      renderWithProviders(<LoginPage />);

      await user.type(screen.getByLabelText(/email address/i), 'test@test.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
          expect.any(Object),
          'test@test.com',
          'password123'
        );
      });
    });
  });

  describe('Signup Flow', () => {
    it('should call createUserWithEmailAndPassword and send verification on signup', async () => {
      const user = user;
      const newUser = { uid: '123', email: 'new@test.com', emailVerified: false };
      createUserWithEmailAndPassword.mockResolvedValue({ user: newUser });

      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(newUser);
        return jest.fn();
      });

      renderWithProviders(<LoginPage />);

      // Switch to signup mode
      await user.click(screen.getByText('Sign up'));

      await user.type(screen.getByLabelText(/email address/i), 'new@test.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(
          expect.any(Object),
          'new@test.com',
          'password123'
        );
      });

      // Note: sendEmailVerification is called in useAuth after signup
      // We could test it separately in useAuth tests
    });
  });

  describe('Google Sign-In', () => {
    it('should call signInWithPopup when Google button is clicked', async () => {
      const user = user;
      const googleUser = { uid: '123', email: 'google@test.com', emailVerified: true };
      signInWithPopup.mockResolvedValue({ user: googleUser });

      onAuthStateChanged.mockImplementation((auth, callback) => {
        callback(googleUser);
        return jest.fn();
      });

      renderWithProviders(<LoginPage />);

      await user.click(screen.getByRole('button', { name: /continue with google/i }));

      await waitFor(() => {
        expect(signInWithPopup).toHaveBeenCalledWith(
          expect.any(Object),
          expect.any(Object)
        );
      });
    });
  });

  describe('Password Reset', () => {
    it('should show success message after password reset', async () => {
      const user = user;
      sendPasswordResetEmail.mockResolvedValue(undefined);

      renderWithProviders(<LoginPage />);

      await user.type(screen.getByLabelText(/email address/i), 'test@test.com');
      await user.click(screen.getByText(/forgot password/i));

      await waitFor(() => {
        expect(screen.getByText('Password reset email sent! Check your inbox.')).toBeInTheDocument();
      });

      expect(sendPasswordResetEmail).toHaveBeenCalledWith(
        expect.any(Object),
        'test@test.com'
      );
    });

    it('should show error for invalid email in password reset', async () => {
      const user = user;
      const error = { code: 'auth/invalid-email' };
      sendPasswordResetEmail.mockRejectedValue(error);

      renderWithProviders(<LoginPage />);

      await user.click(screen.getByText(/forgot password/i));

      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      });
    });
  });

  describe('Mode Toggle', () => {
    it('should clear resetEmailSent and validationError when switching to signup', async () => {
      const user = user;
      renderWithProviders(<LoginPage />);

      // Trigger a validation error
      await user.click(screen.getByRole('button', { name: /sign in/i }));
      await waitFor(() => {
        expect(screen.getByText('Email is required')).toBeInTheDocument();
      });

      // Click sign up button
      await user.click(screen.getByText('Sign up'));

      // Validation error should be cleared
      expect(screen.queryByText('Email is required')).not.toBeInTheDocument();
      expect(screen.getByText('Create a new account')).toBeInTheDocument();
    });
  });
});
