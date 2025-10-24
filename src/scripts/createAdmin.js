// Run this in the browser console to create an admin account
// Instructions:
// 1. Open your app in the browser
// 2. Open browser console (F12)
// 3. Copy and paste this entire script
// 4. Modify the email, password, and name below
// 5. Press Enter to run

import { auth, db } from "../components/firebaseConfig"
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth"
import { doc, setDoc } from "firebase/firestore"

const createAdminAccount = async () => {
	// ⚠️ CHANGE THESE VALUES ⚠️
	const adminEmail = "santostristan326@gmail.com"
	const adminPassword = "123456"
	const adminName = "Admin User"

	try {
		console.log("Creating admin account...")

		// Create user account
		const userCredential = await createUserWithEmailAndPassword(
			auth,
			adminEmail,
			adminPassword
		)
		const user = userCredential.user

		// Update profile
		await updateProfile(user, {
			displayName: adminName,
		})

		// Create admin user document in Firestore
		await setDoc(doc(db, "users", user.uid), {
			displayName: adminName,
			email: user.email,
			uid: user.uid,
			userType: "admin",
			firstName: adminName.split(" ")[0] || "",
			lastName: adminName.split(" ").slice(1).join(" ") || "",
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
		alert("Admin account created! Check console for details.")
	} catch (error) {
		console.error("❌ Error creating admin account:", error)
		alert("Failed to create admin: " + error.message)
	}
}

// Uncomment the line below to run automatically
createAdminAccount()

export default createAdminAccount
