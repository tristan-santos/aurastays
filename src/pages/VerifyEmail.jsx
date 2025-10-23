import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { auth, db } from "../components/firebaseConfig"
import { doc, setDoc } from "firebase/firestore"
import { sendEmailVerification } from "firebase/auth"

export default function VerifyEmail() {
	const navigate = useNavigate()
	const [message, setMessage] = useState(
		"We've sent a verification email to your address. Please check your inbox and click the link to verify your account."
	)

	useEffect(() => {
		const interval = setInterval(async () => {
			const user = auth.currentUser
			if (user) {
				await user.reload()
				if (user.emailVerified) {
					clearInterval(interval)
					try {
						await setDoc(doc(db, "users", user.uid), {
							displayName: user.displayName,
							email: user.email,
							uid: user.uid,
						})
						setMessage("Email verified! Redirecting...")
						setTimeout(() => {
							navigate("/") // or to a dashboard page
						}, 2000)
					} catch (error) {
						console.error("Error writing document: ", error)
						setMessage("An error occurred while saving your data.")
					}
				}
			}
		}, 3000)

		return () => clearInterval(interval)
	}, [navigate])

	async function resendVerificationEmail() {
		const user = auth.currentUser
		if (user) {
			try {
				await sendEmailVerification(user)
				setMessage("A new verification email has been sent.")
			} catch (error) {
				console.error("Error resending verification email: ", error)
				setMessage("An error occurred while resending the email.")
			}
		}
	}

	return (
		<div className="verify-email-container">
			<h2>Verify Your Email</h2>
			<p>{message}</p>
			<button onClick={resendVerificationEmail}>
				Resend verification email
			</button>
		</div>
	)
}
