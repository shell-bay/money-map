# Firestore Setup for Money Map

## Prerequisites

You already have Firebase initialized. Now you need to enable Firestore database.

## Steps

### 1. Enable Firestore Database

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click **Firestore Database** in the left sidebar
4. Click **Create Database**
5. Choose **Start in test mode** (for development) or **Start in production mode** (more secure)
6. Click **Enable**

### 2. Security Rules (IMPORTANT)

#### For Development (Test Mode)

Paste these rules and click **Publish**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read/write their own data only
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

#### For Production (Recommended)

Use these stricter rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

**What this does:**
- Each user can only read/write data under their own user ID (`/users/{userId}/...`)
- Users cannot access other users' transactions or settings
- Requires authentication for all access

### 3. Verify Setup

1. After enabling Firestore, your app will automatically create:
   - `/users/{userId}/transactions` collection for each user's transactions
   - `/users/{userId}/settings` document for each user's settings

2. Data structure:
   ```
   users/
     {userId}/
       transactions/
         {transactionId}/
           - type: "income" | "expense"
           - amount: number
           - category: string
           - date: string (YYYY-MM-DD)
           - createdAt: timestamp
           - updatedAt: timestamp
       settings/
         - theme: "light" | "dark"
         - currency: "INR" | "USD" | etc.
         - displayName: string
         - notifications: boolean
         - language: string
         - createdAt: timestamp
         - updatedAt: timestamp
   ```

### 4. Test the App

1. Start the app: `npm start`
2. Login with email/password or Google
3. Add a transaction → it should appear in Firestore console under your user's `transactions` collection
4. Change settings → they should appear in your user's `settings` document
5. Open in another browser/incognito → data should sync automatically (real-time)

### 5. Indexes (Optional)

Firestore may automatically create indexes. If you see errors about missing indexes, go to:
- Firebase Console → Firestore → Indexes → Create index
- Collection: `transactions`
- Fields: `userId` (Ascending), `date` (Descending)

---

## Migration from LocalStorage

**No manual migration needed!** The app now uses Firestore exclusively. Old localStorage data will be ignored (but still present). To start fresh, you can clear localStorage in browser DevTools:

```javascript
localStorage.clear();
location.reload();
```

---

## Troubleshooting

### "Missing or insufficient permissions"
- Check Firestore security rules are deployed
- Ensure you're logged in (check Firebase Console → Authentication)

### "Failed to load resources"
- Verify Firebase config in `.env` is correct
- Check that Firestore is enabled in Firebase Console

### Data not syncing
- Check browser console for errors
- Ensure you're using the same Firebase project
- Verify user is authenticated (check `user` object in console)

---

## Build Size Impact

- Added Firebase Firestore SDK (modular imports)
- Build size increased from ~221 KB to ~427 KB gzipped
- This is normal for Firestore real-time sync capability

---

**Ready to use!** Your Money Map app now has cloud sync with Firestore.
