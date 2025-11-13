import { toast } from "react-stacked-toast"
import "../css/Signup.css" // Reusing the same CSS for a similar look
import { FaArrowLeft } from "react-icons/fa"
import { Link, useNavigate } from "react-router-dom"
import googleIcon from "../assets/icons/google (1).png"
import logoHd from "../assets/logoPlain.png"
import LightRays from "./LightRays"
import { useState } from "react"
import { auth, db } from "../components/firebaseConfig"
import {
	GoogleAuthProvider,
	signInWithEmailAndPassword,
	signInWithPopup,
} from "firebase/auth"
import hideIcon from "../assets/icons/hide.png"
import viewIcon from "../assets/icons/view.png"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { getFirebaseErrorMessage } from "../utils/errorMessages"

export default function Login() {
	const [formdata, setFormdata] = useState({
		email: "",
		password: "",
	})
	const [showPassword, setShowPassword] = useState(false)
	const navigate = useNavigate()

	function handleChange(e) {
		const { id, value } = e.target
		setFormdata((prev) => ({ ...prev, [id]: value }))
	}

	async function handleSubmit(e) {
		e.preventDefault()
		try {
			const userCredential = await signInWithEmailAndPassword(
				auth,
				formdata.email,
				formdata.password
			)
			const user = userCredential.user

			// Get user data from Firebase to determine user type
			const docRef = doc(db, "users", user.uid)
			const docSnap = await getDoc(docRef)

			if (!docSnap.exists() || !docSnap.data().userType) {
				// User doesn't exist or has no role, sign them out
				await auth.signOut()
				toast.error("User doesn't exist. Please sign up first!")
				return
			}

			const userData = docSnap.data()
			toast.success("Logged in successfully!")

			// Redirect based on user type
			if (userData.userType === "admin") {
				navigate("/admin")
			} else if (userData.userType === "host") {
				navigate("/dashboardHost")
			} else {
				navigate("/dashboardGuest")
			}
		} catch (error) {
			toast.error(getFirebaseErrorMessage(error))
			console.error(error)
		}
	}

	async function handleGoogleSignIn() {
		const provider = new GoogleAuthProvider()
		try {
			const result = await signInWithPopup(auth, provider)
			const user = result.user
			const docRef = doc(db, "users", user.uid)
			const docSnap = await getDoc(docRef)

			if (!docSnap.exists()) {
				// User doesn't exist, sign them out and show error
				await auth.signOut()
				toast.error("User doesn't exist. Please sign up first!")
				return
			}

			// Check if user has a role assigned
			const userData = docSnap.data()
			if (!userData.userType) {
				// User exists but has no role, sign them out and show error
				await auth.signOut()
				toast.error("User doesn't exist. Please sign up first!")
				return
			}

			// User exists and has a role, proceed with login
			toast.success(`Welcome back, ${user.displayName}!`)

			// Redirect based on user type
			if (userData.userType === "admin") {
				navigate("/admin")
			} else if (userData.userType === "host") {
				navigate("/dashboardHost")
			} else {
				navigate("/dashboardGuest")
			}
		} catch (error) {
			toast.error(getFirebaseErrorMessage(error))
			console.error(error)
		}
	}

	return (
		<>
			<div className="signup-modal">
				<div className="signup-content">
					<div className="carousel-container">
						<div className="bg">
							<LightRays
								raysOrigin="top-center"
								raysColor="#61bf9c"
								raysSpeed={1.75}
								lightSpread={1}
								rayLength={1.5}
								followMouse={true}
								mouseInfluence={0.5}
								noiseAmount={0.1}
								distortion={0.05}
								className="custom-rays"
							/>
						</div>
						<div className="carousel-header">
							<img
								src={logoHd}
								alt="AuraStays Logo"
								className="carousel-logo"
							/>
							<h1>AuraStays</h1>
						</div>
						<div className="tagline">
							<p>Find your place, feel the aura.</p>
						</div>
					</div>
					<div className="signup-form-container">
						<div className="signup-header">
							<h2>Login</h2>
							<p>Welcome back!</p>
						</div>
						<form action="#" onSubmit={handleSubmit}>
							<div className="form-group">
								<label htmlFor="email">Email</label>
								<input
									type="email"
									id="email"
									placeholder="Enter your email"
									value={formdata.email}
									onChange={handleChange}
									required
								/>
							</div>
							<div className="form-group">
								<label htmlFor="password">Password</label>
								<div className="password-input-container">
									<input
										type={showPassword ? "text" : "password"}
										id="password"
										placeholder="Enter your password"
										value={formdata.password}
										onChange={handleChange}
										required
									/>
									<img
										src={showPassword ? viewIcon : hideIcon}
										alt="Toggle password visibility"
										onClick={() => setShowPassword(!showPassword)}
									/>
								</div>
								<div className="form-group">
									<div className="forgot">
										<Link to="#" className="forgottext">
											Forgot Password?
										</Link>
									</div>
								</div>
							</div>
							<button type="submit" className="btn-signup">
								Log In
							</button>
						</form>
						<div className="google-signin">
							<p>or</p>
							<button className="btn-google" onClick={handleGoogleSignIn}>
								<img src={googleIcon} alt="Google Icon" />
								Continue with Google
							</button>
						</div>
						<div className="signup-footer">
							<p>
								Don't have an account? <Link to="/signup">Sign up</Link>
							</p>
						</div>
					</div>
				</div>
			</div>
		</>
	)
}
