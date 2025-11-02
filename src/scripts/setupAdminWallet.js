/**
 * Setup Admin Wallet Script
 *
 * This script ensures the admin account exists and has e-wallet configured.
 * Run this in the browser console after logging in as admin.
 *
 * Instructions:
 * 1. Login to your app with admin credentials (adminAurastays@aurastays.com)
 * 2. Open browser console (F12)
 * 3. Copy and paste this entire script
 * 4. Press Enter to run
 */

import { db } from "../components/firebaseConfig"
import {
	doc,
	getDoc,
	setDoc,
	updateDoc,
	collection,
	query,
	where,
	getDocs,
} from "firebase/firestore"

const setupAdminWallet = async () => {
	const adminEmail = "adminAurastays@aurastays.com"

	try {
		console.log("🔍 Searching for admin account...")

		// Find admin user by email
		const usersRef = collection(db, "users")
		const q = query(usersRef, where("email", "==", adminEmail))
		const querySnapshot = await getDocs(q)

		if (querySnapshot.empty) {
			console.error("❌ Admin account not found!")
			console.log(
				"ℹ️ Please create admin account first with email:",
				adminEmail
			)
			console.log("ℹ️ Use the createAdmin.js script or sign up manually")
			alert("Admin account not found! Please create it first.")
			return
		}

		const adminDoc = querySnapshot.docs[0]
		const adminData = adminDoc.data()
		const adminId = adminDoc.id

		console.log("✅ Admin account found:", adminId)
		console.log("📧 Email:", adminData.email)
		console.log("👤 Name:", adminData.displayName)

		// Check current wallet balance
		const currentBalance = adminData.walletBalance || 0
		console.log(
			"💰 Current wallet balance: ₱" + currentBalance.toLocaleString()
		)

		// Update admin account with wallet and PayPal info
		const updates = {
			walletBalance: currentBalance, // Keep current balance or initialize to 0
			paypalEmail: adminData.paypalEmail || "adminAurastays@aurastays.com",
			isAdmin: true,
			adminLevel: "super",
			userType: "admin",
			updatedAt: new Date(),
		}

		await updateDoc(doc(db, "users", adminId), updates)

		console.log("✅ Admin wallet configured successfully!")
		console.log("=".repeat(50))
		console.log("📊 ADMIN ACCOUNT SUMMARY")
		console.log("=".repeat(50))
		console.log("User ID:", adminId)
		console.log("Email:", adminEmail)
		console.log("Wallet Balance: ₱" + currentBalance.toLocaleString())
		console.log("PayPal Email:", updates.paypalEmail)
		console.log("Admin Level:", updates.adminLevel)
		console.log("=".repeat(50))

		alert(
			`✅ Admin wallet setup complete!\n\nWallet Balance: ₱${currentBalance.toLocaleString()}\nPayPal: ${
				updates.paypalEmail
			}`
		)
	} catch (error) {
		console.error("❌ Error setting up admin wallet:", error)
		alert("Error: " + error.message)
	}
}

// Auto-run the setup
setupAdminWallet()

export default setupAdminWallet
