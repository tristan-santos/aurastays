# 📧 New Signup & Verification Flow

## ✅ Changes Made

### 🔄 **New Flow Overview**

1. **Signup** → Save to Firestore `pendingUsers` → Store email in localStorage → Redirect to `/login`
2. **User clicks email link** → Opens `/verify-email`
3. **VerifyEmail page** → Gets email from localStorage → Fetches correct user from `pendingUsers` → Shows account data
4. **User accepts terms** → Move data from `pendingUsers` to `users` → Redirect to `/login`

---

## 📝 Detailed Flow

### 1. Signup Process (`src/pages/signup.jsx`)

#### When user completes signup:

```javascript
// Save to Firestore pendingUsers collection
await setDoc(doc(db, "pendingUsers", user.uid), {
  displayName: "User Name",
  email: "user@example.com",
  uid: "firebase-uid",
  userType: "host" or "guest",
  firstName: "First",
  lastName: "Last",
  signInMethod: "email" or "google",
  createdAt: new Date()
})

// Store ONLY email in localStorage (not entire user object)
localStorage.setItem("pendingUserEmail", "user@example.com")

// Send verification email via EmailJS
await sendVerificationEmail({
  to_email: "user@example.com",
  to_name: "User Name",
  verification_link: "http://localhost:5173/verify-email"
})

// Redirect to login page (NOT verify-email)
navigate("/login")
```

### 2. Email Link Click

- User receives email with verification link
- Clicks link → Opens `/verify-email` in browser
- localStorage still has the email stored

### 3. Verify Email Page (`src/pages/VerifyEmail.jsx`)

#### Fetch pending user data:

```javascript
// Get email from localStorage
const pendingEmail = localStorage.getItem("pendingUserEmail")

// Query pendingUsers collection by email
const pendingUsersRef = collection(db, "pendingUsers")
const q = query(pendingUsersRef, where("email", "==", pendingEmail))
const querySnapshot = await getDocs(q)

// Get the matching user data
const pendingUserData = querySnapshot.docs[0].data()
```

#### Display correct user data:

- Shows the user's name (from `pendingUsers`)
- Shows their email
- Shows their account type (Host/Guest)
- Shows terms and conditions

### 4. Complete Verification

#### When user accepts terms:

```javascript
// Move data from pendingUsers to users collection
await setDoc(doc(db, "users", userData.uid), {
	...userData,
	termsAccepted: true,
	termsAcceptedAt: new Date(),
})

// Delete from pendingUsers collection
await deleteDoc(doc(db, "pendingUsers", userData.uid))

// Clear localStorage
localStorage.removeItem("pendingUserEmail")

// Redirect to login page
navigate("/login")
```

---

## 🗄️ Firestore Collections

### `pendingUsers` Collection

**Purpose**: Temporary storage for users who haven't completed email verification

**Structure**:

```javascript
{
  uid: "firebase-auth-uid",
  email: "user@example.com",
  displayName: "User Name",
  firstName: "First",
  lastName: "Last",
  userType: "host" | "guest",
  signInMethod: "email" | "google",
  createdAt: Timestamp
}
```

### `users` Collection

**Purpose**: Permanent storage for verified users

**Structure**:

```javascript
{
  uid: "firebase-auth-uid",
  email: "user@example.com",
  displayName: "User Name",
  firstName: "First",
  lastName: "Last",
  userType: "host" | "guest" | "admin",
  signInMethod: "email" | "google",
  createdAt: Timestamp,
  termsAccepted: true,
  termsAcceptedAt: Timestamp
}
```

---

## 💾 localStorage Usage

### Before (Old Flow - ❌ Wrong)

```javascript
// Stored entire user object
localStorage.setItem(
	"pendingUserData",
	JSON.stringify({
		firstName: "...",
		lastName: "...",
		email: "...",
		password: "...", // Security risk!
		userType: "...",
		uid: "...",
	})
)
```

### After (New Flow - ✅ Correct)

```javascript
// Store only email
localStorage.setItem("pendingUserEmail", "user@example.com")
```

**Benefits**:

- 🔒 No sensitive data in localStorage
- ✅ Always fetches fresh data from Firestore
- 🎯 Correctly identifies the right user
- 🧹 Easy to clean up

---

## 🐛 Problems Fixed

### ❌ Old Issues:

1. **Wrong user data displayed**: Showed admin@aurastays.com instead of actual user
2. **Data in localStorage**: Stored passwords and sensitive data
3. **Direct redirect**: Went directly to `/verify-email` instead of letting email link do it
4. **No data separation**: Mixed verified and unverified users

### ✅ New Solutions:

1. **Correct user data**: Fetches from `pendingUsers` by email
2. **Secure storage**: Only email in localStorage
3. **Email link redirect**: User clicks email link to verify
4. **Clear separation**: Unverified in `pendingUsers`, verified in `users`

---

## 🔄 User Journey

### Signup Flow:

```
User signs up
    ↓
Firebase Auth account created
    ↓
Save to pendingUsers collection
    ↓
Store email in localStorage
    ↓
Send verification email
    ↓
Redirect to /login
    ↓
User sees "Check your email" message
```

### Verification Flow:

```
User clicks email link
    ↓
Opens /verify-email
    ↓
Get email from localStorage
    ↓
Query pendingUsers by email
    ↓
Display correct user data
    ↓
User accepts terms
    ↓
Move to users collection
    ↓
Delete from pendingUsers
    ↓
Clear localStorage
    ↓
Redirect to /login
```

### Login Flow:

```
User logs in
    ↓
Check users collection
    ↓
User exists and termsAccepted = true
    ↓
Redirect based on userType:
  - admin → /admin
  - host → /dashboardHost
  - guest → /dashboardGuest
```

---

## 📊 Database State Examples

### After Signup (Before Verification):

**pendingUsers** collection:

```
{
  "abc123xyz": {
    email: "john@example.com",
    displayName: "John Doe",
    userType: "host",
    ...
  }
}
```

**users** collection:

```
(empty - user not verified yet)
```

**localStorage**:

```
pendingUserEmail: "john@example.com"
```

### After Verification:

**pendingUsers** collection:

```
(deleted - abc123xyz removed)
```

**users** collection:

```
{
  "abc123xyz": {
    email: "john@example.com",
    displayName: "John Doe",
    userType: "host",
    termsAccepted: true,
    ...
  }
}
```

**localStorage**:

```
(cleared - pendingUserEmail removed)
```

---

## 🧪 Testing Checklist

- [ ] Signup with email/password
- [ ] Check email sent via EmailJS
- [ ] Click email link
- [ ] Verify correct user data shows
- [ ] Accept terms
- [ ] Check moved to `users` collection
- [ ] Check deleted from `pendingUsers`
- [ ] Login with credentials
- [ ] Redirect to correct dashboard

---

## 🔐 Security Improvements

1. **No passwords in localStorage**: Email only
2. **Temporary storage**: Pending users separate from verified
3. **Clean up**: Data deleted after verification
4. **Email verification**: Required before access
5. **Terms acceptance**: Tracked with timestamp

---

## 🚀 Ready to Test!

The new flow is complete and ready to test. Follow the testing checklist above to ensure everything works correctly.
