# Money Map - Setup Instructions

## Firebase Authentication Setup

### Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"** or **"Create project"**
3. Enter project name: `money-map` (or your preferred name)
4. Enable Google Analytics? Optional. You can skip.
5. Click **Create project** and wait for it to finish

### Step 2: Enable Authentication Methods

1. In your Firebase project, go to **Build** → **Authentication**
2. Click **Get started**
3. Go to the **Sign-in method** tab
4. Enable **Email/Password**:
   - Click on it
   - Toggle **Enable** to ON
   - Click **Save**
5. Enable **Google**:
   - Click on it
   - Toggle **Enable** to ON
   - Provide a project support email (your email)
   - Click **Save**

### Step 3: Get Your Firebase Configuration

1. In Firebase Console, click the gear icon ⚙️ next to **Project Overview**
2. Select **Project settings**
3. Scroll down to **Your apps** section
4. Click the **Web** icon `</>`
5. Register your app:
   - App nickname: `money-map-web` (or any name)
   - Check the box: "Also set up Firebase Hosting?" → No, skip
   - Click **Register app**
6. You'll see your Firebase configuration object with 6 values:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

### Step 4: Configure Environment Variables

1. In your Money Map project folder, create a file named `.env` (copy from `.env.example`):

```bash
cp .env.example .env
```

2. Open `.env` and paste your values:

```bash
REACT_APP_FIREBASE_API_KEY=AIzaSy...
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789
REACT_APP_FIREBASE_APP_ID=1:123456789:web:abc123
```

**Important**: All variables must start with `REACT_APP_` for Create React App to expose them.

### Step 5: Add Authorized Domains (Optional but Recommended)

1. In Firebase Console, go to **Authentication** → **Settings** (gear icon)
2. Scroll to **Authorized domains**
3. Add `localhost` (for development) and your production domain

This prevents unauthorized domains from using your Firebase project.

---

## Running the App

### Install Dependencies

```bash
cd money-map
npm install
```

### Start Development Server

```bash
npm start
```

The app will open at `http://localhost:3000`

### Build for Production

```bash
npm run build
```

Output goes to `build/` folder.

---

## Testing the Login

1. Open the app at `http://localhost:3000/login`
2. You should see the Money Map login page with:
   - Email/password form
   - Google sign-in button
   - Sign up / Sign in toggle

### Test Email/Password Sign Up

1. Click **"Sign up"** if needed
2. Enter email and password (minimum 6 characters)
3. Click **Create Account**
4. You should be redirected to `/dashboard`

### Test Google OAuth

1. On login page, click **"Continue with Google"**
2. Select your Google account
3. Allow permissions (first time only)
4. You should be redirected to `/dashboard`

### Test Password Reset

1. Click **"Forgot password?"** on the login page
2. Enter your registered email
3. Click send (or just trigger the function)
4. Check your email for reset link

---

## Security Notes

- Firebase Auth handles all security (password hashing, OAuth tokens, password reset emails)
- No sensitive data is stored in your code (only config IDs)
- The `.env` file is git-ignored by default in CRA
- Never commit your Firebase credentials to a public repository

---

## Firebase Console Features to Explore

- **Authentication** → Users: View registered users, reset passwords, disable accounts
- **Authentication** → Templates: Customize password reset and email verification emails
- **Authentication** → Settings: Configure session persistence, multi-factor auth
- **Firestore Database** (if you add it later): Store user expense data
- **Storage** (if you add receipt images later)

---

## Troubleshooting

### Error: "Firebase: No Firebase App '[DEFAULT]' has been created"
- Make sure Firebase is initialized properly in `firebase.js`
- Check that `initializeApp(firebaseConfig)` is called once

### Error: "Auth domain is not authorized"
- Add `localhost` to Authorized domains in Firebase Console
- Go to Authentication → Settings → Authorized domains

### Error: "Google sign-in is not enabled"
- Go to Firebase Console → Authentication → Sign-in method
- Make sure Google is enabled

### Error: "The password must be at least 6 characters"
- Firebase requires minimum 6 characters for email/password auth
- You can add more validation in the frontend if desired

### Port 3000 already in use
```bash
# Find and kill process on port 3000
lsof -ti:3000 | xargs kill -9
# Or use a different port
PORT=3001 npm start
```

---

## Next Steps

After setting up Firebase auth, we'll build:

1. **Dashboard** - Expense list, totals, categories
2. **Expense Form** - Add/edit expenses with validation
3. **Local Storage** (initial) → later Firestore for persistence
4. **Budget Tracking** - Set limits, get alerts
5. **Charts** - Visualize spending patterns

---

## Need Help?

- Firebase Docs: https://firebase.google.com/docs/auth/web/start
- React Router: https://reactrouter.com/
- Tailwind CSS: https://tailwindcss.com/docs

Questions? Ask in the next chat.
