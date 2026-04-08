# Money Map 💰

A simple, beautiful expense tracking web application built with React, Tailwind CSS, and Firebase Authentication.

## Features (Login System)

- ✅ Email/password sign up and sign in
- ✅ Google OAuth login
- ✅ Password reset functionality
- ✅ Clean, modern UI with Tailwind CSS
- ✅ Protected routes with React Router
- ✅ Responsive design (mobile + desktop)

## Tech Stack

- **Frontend**: React 19 + React Router v6
- **Styling**: Tailwind CSS 3
- **Authentication**: Firebase Authentication
- **Build Tool**: Create React App

## Quick Start

### 1. Setup Firebase

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com/)
2. Enable **Email/Password** and **Google** sign-in methods in Authentication
3. Get your Firebase config from Project Settings → Your apps

### 2. Configure Environment

```bash
# Copy the example env file
cp .env.example .env

# Edit .env and paste your Firebase credentials:
# REACT_APP_FIREBASE_API_KEY=your_key
# REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
# ... etc
```

### 3. Install & Run

```bash
npm install
npm start
```

Open [http://localhost:3000/login](http://localhost:3000/login) in your browser.

## Project Structure

```
money-map/
├── src/
│   ├── hooks/
│   │   └── useAuth.js          # Authentication context/hook
│   ├── pages/
│   │   ├── LoginPage.js        # Login & signup page
│   │   └── Dashboard.js        # Protected dashboard (placeholder)
│   ├── firebase.js             # Firebase configuration
│   ├── App.js                  # Main app with routing
│   └── index.css               # Tailwind directives
├── .env.example                # Environment variables template
├── SETUP_INSTRUCTIONS.md       # Detailed setup guide
├── tailwind.config.js          # Tailwind configuration
└── package.json
```

## Pages

### `/login`
- Toggle between sign in / sign up
- Email/password authentication
- Google OAuth button
- Password reset link (for login mode)
- Clean, centered card design

### `/dashboard`
- Protected route (requires login)
- Placeholder for expense tracking features
- Shows user email and sign out button

## Next Steps

The login system is complete. Next phase will include:

1. Expense input form
2. Expense list with categories
3. Monthly summaries
4. Budget tracking
5. Charts and visualizations

## Scripts

- `npm start` - Development server (http://localhost:3000)
- `npm run build` - Build for production
- `npm test` - Run tests
- `npm run eject` - Eject from Create React App

## Environment Variables

All Firebase config must use `REACT_APP_` prefix to be exposed to the browser.

| Variable | Description |
|----------|-------------|
| `REACT_APP_FIREBASE_API_KEY` | Firebase API key |
| `REACT_APP_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `REACT_APP_FIREBASE_PROJECT_ID` | Firebase project ID |
| `REACT_APP_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `REACT_APP_FIREBASE_MESSAGING_SENDER_ID` | Sender ID |
| `REACT_APP_FIREBASE_APP_ID` | Firebase app ID |

## Security Notes

- `.env` file is git-ignored (do not commit credentials)
- Firebase handles password hashing, OAuth tokens securely
- Enable App Check in Firebase for production
- Add authorized domains in Firebase Authentication settings

## License

MIT

---

**Built with simple, scalable architecture ready for expense tracking features.**
