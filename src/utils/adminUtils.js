// Admin utility functions
import { auth, db } from "../components/firebaseConfig"
import { doc, setDoc } from "firebase/firestore"
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth"
import { toast } from "react-stacked-toast"

// Create admin user (for development/testing only)
export const createAdminUser = async (email, password, displayName) => {
	try {
		// Create user account
		const userCredential = await createUserWithEmailAndPassword(
			auth,
			email,
			password
		)
		const user = userCredential.user

		// Update profile
		await updateProfile(user, {
			displayName: displayName,
		})

		// Create admin user document in Firestore
		await setDoc(doc(db, "users", user.uid), {
			displayName: displayName,
			email: user.email,
			uid: user.uid,
			userType: "admin",
			firstName: displayName.split(" ")[0] || "",
			lastName: displayName.split(" ").slice(1).join(" ") || "",
			signInMethod: "email",
			createdAt: new Date(),
			termsAccepted: true,
			termsAcceptedAt: new Date(),
			isAdmin: true,
			adminLevel: "super",
		})

		toast.success("Admin user created successfully!")
		return user
	} catch (error) {
		console.error("Error creating admin user:", error)
		toast.error("Failed to create admin user")
		throw error
	}
}

// Check if current user is admin
export const isAdmin = (userData) => {
	return userData && userData.userType === "admin"
}

// Check if current user is super admin
export const isSuperAdmin = (userData) => {
	return (
		userData && userData.userType === "admin" && userData.adminLevel === "super"
	)
}

// Admin-only functions
export const adminOnly = (userData, callback) => {
	if (!isAdmin(userData)) {
		toast.error("Admin privileges required")
		return
	}
	return callback()
}

// Super admin-only functions
export const superAdminOnly = (userData, callback) => {
	if (!isSuperAdmin(userData)) {
		toast.error("Super admin privileges required")
		return
	}
	return callback()
}
