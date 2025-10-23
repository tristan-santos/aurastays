import { toast } from "react-toastify"
import "../css/Signup.css"
import TiltedCard from "./TiltedCard.jsx"

import { FaArrowLeft } from "react-icons/fa"
import { Link, useNavigate } from "react-router-dom"
import googleIcon from "../assets/icons/google (1).png"
import logoHd from "../assets/logoPlain.png"
import LightRays from "./LightRays"
import { useState } from "react"
import { auth, db } from "../components/firebaseConfig"
import {
	createUserWithEmailAndPassword,
	GoogleAuthProvider,
	sendEmailVerification,
	signInWithPopup,
	updateProfile,
} from "firebase/auth"
import { doc, getDoc, setDoc } from "firebase/firestore"
import hideIcon from "../assets/icons/hide.png"
import viewIcon from "../assets/icons/view.png"

export default function Signup() {
	const [formdata, setFormdata] = useState({
		firstName: "",
		lastName: "",
		email: "",
		password: "",
		confirmPassword: "",
	})
	const [showPassword, setShowPassword] = useState(false)
	const [showConfirmPassword, setShowConfirmPassword] = useState(false)
	const navigate = useNavigate()

	// const navigate = useNavigate()

	function handleChange(e) {
		const { id, value } = e.target
		setFormdata((prev) => ({ ...prev, [id]: value }))
	}

	async function handleGoogleSignIn() {
		const provider = new GoogleAuthProvider()
		try {
			const result = await signInWithPopup(auth, provider)
			const user = result.user
			const docRef = doc(db, "users", user.uid)
			const docSnap = await getDoc(docRef)

			if (!docSnap.exists()) {
				// If the user doesn't exist in Firestore, create a new document
				await setDoc(docRef, {
					displayName: user.displayName,
					email: user.email,
					uid: user.uid,
					isHost: false, // Default to not a host
				})
			}

			toast.success(`Welcome, ${user.displayName}!`)
			navigate("/dashboardHost")
		} catch (error) {
			toast.error(error.message)
			console.error(error)
		}
	}
	async function handleSubmit(e) {
		e.preventDefault()
		if (formdata.password !== formdata.confirmPassword) {
			toast.error("Passwords do not match!")
			return
		}
		try {
			const userCredential = await createUserWithEmailAndPassword(
				auth,
				formdata.email,
				formdata.password
			)
			const user = userCredential.user
			await updateProfile(user, {
				displayName: `${formdata.firstName} ${formdata.lastName}`,
			})
			await setDoc(doc(db, "users", user.uid), {
				displayName: `${formdata.firstName} ${formdata.lastName}`,
				email: user.email,
				uid: user.uid,
				isHost: true,
			})
			await sendEmailVerification(user)
			toast.success("Verification email sent! Please check your inbox.")
		} catch (error) {
			toast.error(error.message)
			console.error(error)
		}
	}

	return (
		<>
			<div className="host-signup-modal">
				<div className="host-signup-content">
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
						{/* <img src={image2} alt="Signup Visual" className="carousel-image" /> */}
					</div>
					<Link to="/" className="back-button">
						<FaArrowLeft />
						<span>Back</span>
					</Link>
					<div className="host-signup-form-container">
						<div className="host-signup-header">
							<h2>Become a Host</h2>
							<p>Create an account to start hosting</p>
						</div>
						<div className="step one">
							<div className="title">
								<span>Please Choose</span>
							</div>
							<div className="host">
								<TiltedCard
									imageSrc="https://i.scdn.co/image/ab67616d0000b273d9985092cd88bffd97653b58"
									altText="Kendrick Lamar - GNX Album Cover"
									captionText="Kendrick Lamar - GNX"
									containerHeight="300px"
									containerWidth="300px"
									imageHeight="300px"
									imageWidth="300px"
									rotateAmplitude={12}
									scaleOnHover={1.2}
									showMobileWarning={false}
									showTooltip={true}
									displayOverlayContent={true}
									overlayContent={
										<p className="tilted-card-demo-text">Become Host</p>
									}
								/>
							</div>
							<div className="guest"></div>
							<div className="button">
								<button>Next</button>
							</div>
						</div>
						<div className="step two">
							<form action="#" onSubmit={handleSubmit}>
								<div className="name-fields">
									<div className="form-group">
										<label htmlFor="firstName">First Name</label>
										<input
											type="text"
											id="firstName"
											placeholder="Enter your first name"
											value={formdata.firstName}
											onChange={handleChange}
											required
										/>
									</div>
									<div className="form-group">
										<label htmlFor="lastName">Last Name</label>
										<input
											type="text"
											id="lastName"
											placeholder="Enter your last name"
											value={formdata.lastName}
											onChange={handleChange}
											required
										/>
									</div>
								</div>
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
								</div>
								<div className="form-group">
									<label htmlFor="confirmPassword">Confirm Password</label>
									<div className="password-input-container">
										<input
											type={showConfirmPassword ? "text" : "password"}
											id="confirmPassword"
											placeholder="Confirm your password"
											value={formdata.confirmPassword}
											onChange={handleChange}
											required
										/>
										<img
											src={showConfirmPassword ? viewIcon : hideIcon}
											alt="Toggle password visibility"
											onClick={() =>
												setShowConfirmPassword(!showConfirmPassword)
											}
										/>
									</div>
								</div>
								<button type="submit" className="btn-signup">
									Create Account
								</button>
							</form>
						</div>
						<div className="step three">
							<div className="title"></div>
							<div className="img"></div>
							<div className="button"></div>
						</div>
						<div className="google-signin">
							<p>or</p>
							<button className="btn-google" onClick={handleGoogleSignIn}>
								<img src={googleIcon} alt="Google Icon" />
								Continue with Google
							</button>
						</div>
						<div className="host-signup-footer">
							<p>
								Already have an account? <Link to="/login">Log in</Link>
							</p>
						</div>
					</div>
				</div>
			</div>
		</>
	)
}
