import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { db } from "../components/firebaseConfig"
import {
	doc,
	setDoc,
	deleteDoc,
	collection,
	query,
	where,
	getDocs,
} from "firebase/firestore"
import { toast } from "react-stacked-toast"
import "../css/VerifyEmail.css"
import termsAndConditions from "../components/terms.js"

export default function VerifyEmail() {
	const navigate = useNavigate()
	const [message, setMessage] = useState(
		"Please accept the terms and conditions to complete your account setup."
	)
	const [isLoading, setIsLoading] = useState(false)
	const [termsAccepted, setTermsAccepted] = useState(false)
	const [userData, setUserData] = useState(null)
	const [isCheckingAuth, setIsCheckingAuth] = useState(true)

	useEffect(() => {
		// Fetch pending user data from Firestore
		const fetchPendingUser = async () => {
			try {
				// Get email from localStorage
				const pendingEmail = localStorage.getItem("pendingUserEmail")
				console.log("📋 VerifyEmail - Email from localStorage:", pendingEmail)

				if (!pendingEmail) {
					console.log("❌ VerifyEmail - No email in localStorage")
					toast.error("No pending verification found. Please sign up first.")
					navigate("/signup")
					return
				}

				// Query pendingUsers collection by email
				const pendingUsersRef = collection(db, "pendingUsers")
				const q = query(pendingUsersRef, where("email", "==", pendingEmail))
				const querySnapshot = await getDocs(q)

				if (querySnapshot.empty) {
					console.log("❌ VerifyEmail - No pending user found with this email")
					toast.error("No pending verification found. Please sign up first.")
					navigate("/signup")
					return
				}

				// Get the first matching document
				const pendingUserDoc = querySnapshot.docs[0]
				const pendingUserData = pendingUserDoc.data()

				console.log("✅ VerifyEmail - Found pending user:", pendingUserData)
				setUserData(pendingUserData)
				setIsCheckingAuth(false)
			} catch (error) {
				console.error("❌ VerifyEmail - Error fetching pending user:", error)
				toast.error("Error loading verification data. Please try again.")
				setIsCheckingAuth(false)
			}
		}

		fetchPendingUser()
	}, [navigate])

	async function completeVerification() {
		if (!termsAccepted) {
			toast.error("Please accept the terms and conditions first")
			return
		}

		if (!userData) {
			toast.error("User data not found. Please try signing up again.")
			return
		}

		try {
			setIsLoading(true)

			// Ensure userType is not admin - default to guest if invalid
			const finalUserType = userData.userType === "host" ? "host" : "guest"
			
			// Move user data from pendingUsers to users collection
			await setDoc(doc(db, "users", userData.uid), {
				displayName: userData.displayName,
				email: userData.email,
				uid: userData.uid,
				userType: finalUserType, // Ensure it's either "host" or "guest", never "admin"
				firstName: userData.firstName,
				lastName: userData.lastName,
				signInMethod: userData.signInMethod,
				createdAt: userData.createdAt || new Date(),
				termsAccepted: true,
				termsAcceptedAt: new Date(),
				setupComplete: false, // Profile setup not complete yet
				totalBookings: userData.totalBookings || 0,
				reviewsWritten: userData.reviewsWritten || 0,
				wishlistItems: userData.wishlistItems || 0,
				totalSpent: userData.totalSpent || 0,
				walletBalance: 100000, // Initial wallet balance
			})

			// Delete from pendingUsers collection
			await deleteDoc(doc(db, "pendingUsers", userData.uid))

			// Clear localStorage
			localStorage.removeItem("pendingUserEmail")

			console.log(
				"✅ VerifyEmail - Account verified and moved to users collection"
			)
			toast.success("Account verified successfully!")
			setMessage("Account verified successfully! Redirecting to login...")

			// Redirect to login page
			setTimeout(() => {
				navigate("/login")
			}, 2000)
		} catch (error) {
			console.error("❌ VerifyEmail - Error completing verification:", error)
			toast.error("Failed to verify account. Please try again.")
			setMessage("An error occurred while verifying your account.")
		} finally {
			setIsLoading(false)
		}
	}

	return (
		<div className="verify-email-container">
			<div className="verify-email-content">
				<div className="verify-icon">📋</div>
				<h1 className="verify-title">Complete Your Account</h1>
				<p className="verify-message">{message}</p>

				{isCheckingAuth ? (
					<div style={{ textAlign: "center", padding: "2rem" }}>
						<div className="loading-spinner" style={{ margin: "0 auto" }}></div>
						<p>Loading your account information...</p>
					</div>
				) : (
					userData && (
						<>
							<div className="account-preview">
								<h3>Account Preview</h3>
								<div className="preview-item">
									<span className="label">Name:</span>
									<span className="value">
										{userData.firstName} {userData.lastName}
									</span>
								</div>
								<div className="preview-item">
									<span className="label">Email:</span>
									<span className="value">{userData.email}</span>
								</div>
								<div className="preview-item">
									<span className="label">Account Type:</span>
									<span className="value">
										{userData.userType === "host" ? "Host" : "Guest"}
									</span>
								</div>
							</div>

							<div className="terms-container">
								<h3 className="terms-title">
									Terms and Conditions & Privacy Policy
								</h3>
								<div className="terms-content">{termsAndConditions}</div>
							</div>

							<div className="terms-checkbox-container">
								<input
									type="checkbox"
									id="terms-checkbox"
									className="terms-checkbox"
									checked={termsAccepted}
									onChange={(e) => setTermsAccepted(e.target.checked)}
								/>
								<label
									htmlFor="terms-checkbox"
									className="terms-checkbox-label"
								>
									I have read and agree to the{" "}
									<a href="#" onClick={(e) => e.preventDefault()}>
										Terms and Conditions
									</a>{" "}
									and{" "}
									<a href="#" onClick={(e) => e.preventDefault()}>
										Privacy Policy
									</a>
								</label>
							</div>

							<button
								className="verify-button"
								onClick={completeVerification}
								disabled={!termsAccepted || isLoading}
							>
								{isLoading && <span className="loading-spinner"></span>}
								{isLoading ? "Creating Account..." : "Complete Account Setup"}
							</button>
						</>
					)
				)}
			</div>
		</div>
	)
}
