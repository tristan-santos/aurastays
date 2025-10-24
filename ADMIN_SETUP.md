# Admin Account Setup Guide

## 📋 Overview

This guide will help you create an admin account for AuraStays.

## 🔐 Method 1: Using Firebase Console (Recommended)

### Step 1: Create User in Firebase Authentication

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Navigate to **Authentication** → **Users**
4. Click **Add User**
5. Enter:
   - Email: `admin@aurastays.com` (or your preferred email)
   - Password: `Admin123!@#` (or your preferred password)
6. Click **Add User**
7. **Copy the User UID** that was generated

### Step 2: Add Admin Document in Firestore

1. In Firebase Console, navigate to **Firestore Database**
2. Click on the `users` collection
3. Click **Add Document**
4. Set Document ID to the **User UID** you copied
5. Add the following fields:

```json
{
  "displayName": "Admin User",
  "email": "admin@aurastays.com",
  "uid": "YOUR_USER_UID_HERE",
  "userType": "admin",
  "firstName": "Admin",
  "lastName": "User",
  "signInMethod": "email",
  "createdAt": (current timestamp),
  "termsAccepted": true,
  "termsAcceptedAt": (current timestamp),
  "isAdmin": true,
  "adminLevel": "super"
}
```

6. Click **Save**

### Step 3: Login

1. Go to your app's login page
2. Enter the admin email and password
3. You should be redirected to `/admin`

---

## 🛠️ Method 2: Using Browser Console (Development Only)

### Step 1: Open Your App

1. Run your development server: `npm run dev`
2. Open the app in your browser
3. Open the browser console (F12)

### Step 2: Run the Admin Creation Script

Copy and paste this code into the console:

```javascript
// Import required functions
import { getAuth } from "firebase/auth"
import { getFirestore, doc, setDoc } from "firebase/firestore"
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth"

// Get Firebase instances
const auth = getAuth()
const db = getFirestore()

// Admin account details - CHANGE THESE!
const adminEmail = "admin@aurastays.com"
const adminPassword = "Admin123!@#"
const adminName = "Admin User"	

// Create admin account
const createAdmin = async () => {
	try {
		console.log("Creating admin account...")

		// Create authentication account
		const userCredential = await createUserWithEmailAndPassword(
			auth,
			adminEmail,
			adminPassword
		)
		const user = userCredential.user

		// Update profile
		await updateProfile(user, { displayName: adminName })

		// Create Firestore document
		await setDoc(doc(db, "users", user.uid), {
			displayName: adminName,
			email: user.email,
			uid: user.uid,
			userType: "admin",
			firstName: "Admin",
			lastName: "User",
			signInMethod: "email",
			createdAt: new Date(),
			termsAccepted: true,
			termsAcceptedAt: new Date(),
			isAdmin: true,
			adminLevel: "super",
		})

		console.log("✅ Admin account created successfully!")
		console.log("Email:", adminEmail)
		console.log("Password:", adminPassword)
		console.log("You can now login with these credentials")
	} catch (error) {
		console.error("❌ Error:", error.message)
	}
}

// Run the function
createAdmin()
```

### Step 3: Login

After the script runs successfully, logout (if logged in) and login with the admin credentials.

---

## 🚀 Quick Admin Creation

You can also use the utility function we created:

```javascript
import { createAdminUser } from "./src/utils/adminUtils"

// In your browser console or a temporary page
createAdminUser(
	"admin@aurastays.com", // email
	"Admin123!@#", // password
	"Admin User" // display name
)
```

---

## 🔑 Default Admin Credentials (If using the guide)

**Email:** `admin@aurastays.com`  
**Password:** `Admin123!@#`

⚠️ **IMPORTANT:** Change these credentials after first login!

---

## 📍 Accessing Admin Dashboard

Once logged in with an admin account:

- You'll be automatically redirected to `/admin`
- Or navigate directly to: `http://localhost:5173/admin`

---

## 🎯 Admin Features

As an admin, you can:

- View total users, hosts, and guests statistics
- Monitor recent signups
- View all registered users
- See system information
- Access developer tools (in development mode)
- Navigate back to landing page
- Secure logout

---

## 🔒 Security Notes

1. **Admin accounts are NOT created through public signup**
2. Only create admin accounts manually using the methods above
3. Admin pages are protected with role-based access control
4. Developer tools are enabled in development mode
5. In production, change the default admin credentials immediately

---

## 🐛 Troubleshooting

### "Access denied" error

- Verify the `userType` field in Firestore is set to `"admin"`
- Check that `termsAccepted` is set to `true`
- Ensure you're logged in with the correct credentials

### Can't access `/admin`

- Clear browser cache and localStorage
- Re-login with admin credentials
- Check browser console for errors

### Account creation failed

- Verify Firebase configuration
- Check Firebase rules allow admin creation
- Ensure password meets Firebase requirements (min 6 characters)

---

## 📞 Support

For issues or questions, check the console logs for detailed error messages.

---

**Happy Administrating! 🎉**
