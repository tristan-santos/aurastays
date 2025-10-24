import { toast } from "react-stacked-toast"
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
	signInWithPopup,
	updateProfile,
} from "firebase/auth"
import { doc, setDoc } from "firebase/firestore"
import hideIcon from "../assets/icons/hide.png"
import viewIcon from "../assets/icons/view.png"
import { sendVerificationEmail } from "../utils/emailService"

export default function Signup() {
	const [currentStep, setCurrentStep] = useState(1)
	const [userType, setUserType] = useState("")
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

	function handleChange(e) {
		const { id, value } = e.target
		setFormdata((prev) => ({ ...prev, [id]: value }))
	}

	function nextStep() {
		if (currentStep === 1 && userType) {
			setCurrentStep(2)
		} else if (currentStep === 2 && validateStep2()) {
			setCurrentStep(3)
		}
	}

	function prevStep() {
		if (currentStep > 1) {
			setCurrentStep(currentStep - 1)
		}
	}

	function selectUserType(type) {
		setUserType(type)
	}

	function validateStep2() {
		return (
			formdata.firstName.trim() !== "" &&
			formdata.lastName.trim() !== "" &&
			formdata.email.trim() !== "" &&
			formdata.password.trim() !== "" &&
			formdata.confirmPassword.trim() !== ""
		)
	}

	function canProceedToNext() {
		if (currentStep === 1) {
			return userType !== ""
		} else if (currentStep === 2) {
			return validateStep2()
		}
		return false
	}

	async function handleGoogleSignIn() {
		const provider = new GoogleAuthProvider()
		try {
			const result = await signInWithPopup(auth, provider)
			const user = result.user

			// Update form data with Google user info
			const nameParts = user.displayName
				? user.displayName.split(" ")
				: ["", ""]
			const userData = {
				firstName: nameParts[0] || "",
				lastName: nameParts.slice(1).join(" ") || "",
				email: user.email || "",
				password: "", // Google users don't need password
				confirmPassword: "",
				userType: userType || "guest",
				uid: user.uid,
				displayName: user.displayName,
				signInMethod: "google",
			}

			// Save to Firestore pendingUsers collection
			await setDoc(doc(db, "pendingUsers", user.uid), {
				displayName: userData.displayName,
				email: user.email,
				uid: user.uid,
				userType: userData.userType,
				firstName: userData.firstName,
				lastName: userData.lastName,
				signInMethod: "google",
				createdAt: new Date(),
				setupComplete: false, // Profile setup not complete yet
				totalBookings: 0,
				reviewsWritten: 0,
				wishlistItems: 0,
				totalSpent: 0,
			})

			// Store only email in localStorage
			localStorage.setItem("pendingUserEmail", user.email)
			console.log(
				"✅ Google Sign-In: Saved to pendingUsers collection:",
				userData
			)

			setFormdata({
				firstName: userData.firstName,
				lastName: userData.lastName,
				email: userData.email,
				password: userData.password,
				confirmPassword: userData.confirmPassword,
			})

			// Skip to step 3 (verification)
			setCurrentStep(3)
			toast.success(`Welcome, ${user.displayName}!`)
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

			// Save to Firestore pendingUsers collection
			const userData = {
				displayName: `${formdata.firstName} ${formdata.lastName}`,
				email: formdata.email,
				uid: user.uid,
				userType: userType,
				firstName: formdata.firstName,
				lastName: formdata.lastName,
				signInMethod: "email",
				createdAt: new Date(),
				setupComplete: false, // Profile setup not complete yet
				totalBookings: 0,
				reviewsWritten: 0,
				wishlistItems: 0,
				totalSpent: 0,
			}

			await setDoc(doc(db, "pendingUsers", user.uid), userData)
			console.log(
				"✅ handleSubmit: Saved to pendingUsers collection:",
				userData
			)

			// Store only email in localStorage
			localStorage.setItem("pendingUserEmail", formdata.email)
			console.log(
				"✅ handleSubmit: Stored email in localStorage:",
				formdata.email
			)

			// Send verification email using EmailJS
			await sendVerificationEmail({
				to_email: formdata.email,
				to_name: `${formdata.firstName} ${formdata.lastName}`,
				verification_link: `${window.location.origin}/verify-email`,
			})
			toast.success(
				"Verification email sent! Please check your inbox and click the link to verify."
			)

			// Redirect to login page
			setTimeout(() => {
				navigate("/login")
			}, 100)
		} catch (error) {
			toast.error(error.message)
			console.error(error)
		}
	}

	async function sendVerificationEmailHandler() {
		console.log("🚀 === sendVerificationEmailHandler CALLED ===")
		console.log("📋 Form data:", formdata)
		console.log("📋 User type:", userType)
		console.log("📋 Current auth user:", auth.currentUser)

		try {
			// Check if user is already signed in (Google sign-in case)
			if (auth.currentUser) {
				console.log("✅ Branch: User already signed in")

				// Save to Firestore pendingUsers collection
				const userData = {
					displayName:
						auth.currentUser.displayName ||
						`${formdata.firstName} ${formdata.lastName}`,
					email: auth.currentUser.email || formdata.email,
					uid: auth.currentUser.uid,
					userType: userType,
					firstName:
						formdata.firstName ||
						auth.currentUser.displayName?.split(" ")[0] ||
						"",
					lastName:
						formdata.lastName ||
						auth.currentUser.displayName?.split(" ").slice(1).join(" ") ||
						"",
					signInMethod: auth.currentUser.providerData[0]?.providerId || "email",
					createdAt: new Date(),
				}

				console.log("💾 Attempting to save to pendingUsers collection...")
				await setDoc(doc(db, "pendingUsers", auth.currentUser.uid), userData)
				console.log("✅ SUCCESS: Saved to pendingUsers collection:", userData)

				// Store only email in localStorage
				console.log("💾 Storing email in localStorage...")
				localStorage.setItem("pendingUserEmail", auth.currentUser.email)
				console.log(
					"✅ SUCCESS: Stored email in localStorage:",
					auth.currentUser.email
				)

				// Verify it was saved
				const verify = localStorage.getItem("pendingUserEmail")
				console.log("✅ VERIFY: Retrieved from localStorage:", verify)

				// User is already signed in via Google, just send verification using EmailJS
				await sendVerificationEmail({
					to_email: auth.currentUser.email,
					to_name:
						auth.currentUser.displayName ||
						formdata.firstName + " " + formdata.lastName,
					verification_link: `${window.location.origin}/verify-email`,
				})
				toast.success(
					"Verification email sent! Please check your inbox and click the link to verify."
				)
				navigate("/login")
			} else {
				console.log("✅ Branch: Creating new email/password account")
				// Regular email/password signup
				console.log("🔐 Creating Firebase Auth account...")
				const userCredential = await createUserWithEmailAndPassword(
					auth,
					formdata.email,
					formdata.password
				)
				const user = userCredential.user
				console.log("✅ Firebase Auth account created, UID:", user.uid)

				await updateProfile(user, {
					displayName: `${formdata.firstName} ${formdata.lastName}`,
				})
				console.log("✅ Profile updated")

				// Save to Firestore pendingUsers collection
				const userData = {
					displayName: `${formdata.firstName} ${formdata.lastName}`,
					email: formdata.email,
					uid: user.uid,
					userType: userType,
					firstName: formdata.firstName,
					lastName: formdata.lastName,
					signInMethod: "email",
					createdAt: new Date(),
				}

				console.log("💾 Attempting to save to pendingUsers collection...")
				await setDoc(doc(db, "pendingUsers", user.uid), userData)
				console.log("✅ SUCCESS: Saved to pendingUsers collection:", userData)

				// Store only email in localStorage
				console.log("💾 Storing email in localStorage...")
				localStorage.setItem("pendingUserEmail", formdata.email)
				console.log("✅ SUCCESS: Stored email in localStorage:", formdata.email)

				// Verify it was saved
				const verify = localStorage.getItem("pendingUserEmail")
				console.log("✅ VERIFY: Retrieved from localStorage:", verify)

				// Send verification email using EmailJS
				await sendVerificationEmail({
					to_email: formdata.email,
					to_name: `${formdata.firstName} ${formdata.lastName}`,
					verification_link: `${window.location.origin}/verify-email`,
				})
				toast.success(
					"Verification email sent! Please check your inbox and click the link to verify."
				)

				// Redirect to login page
				setTimeout(() => {
					navigate("/login")
				}, 100)
			}
		} catch (error) {
			toast.error(error.message)
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
						<div className="signup-header">
							<p>Join AuraStays today</p>
						</div>
						{/* <img src={image2} alt="Signup Visual" className="carousel-image" /> */}
					</div>
					<Link to="/" className="back-button">
						<FaArrowLeft />
						<span>Back</span>
					</Link>
					<div className="signup-form-container">
						{/* Step Navigation */}
						<h2 className="signup-header-title">Create Account</h2>
						<div className="step-navigation">
							<div className="step-indicator">
								<div
									className={`step-dot ${currentStep >= 1 ? "active" : ""}`}
								></div>
								<div
									className={`step-dot ${currentStep >= 2 ? "active" : ""}`}
								></div>
								<div
									className={`step-dot ${currentStep >= 3 ? "active" : ""}`}
								></div>
							</div>
							<div className="step-buttons">
								{currentStep > 1 && (
									<button className="btn-step" onClick={prevStep}>
										Previous
									</button>
								)}
								{currentStep < 3 && (
									<button
										className="btn-step"
										onClick={nextStep}
										disabled={!canProceedToNext()}
									>
										Next
									</button>
								)}
							</div>
						</div>

						{/* Step 1: User Type Selection */}
						<div className={`step ${currentStep === 1 ? "active" : ""}`}>
							<div className="step-title">Choose Your Account Type</div>
							<div className="user-type-selection">
								<div
									className={`user-type-card ${
										userType === "host" ? "selected" : ""
									}`}
									onClick={() => selectUserType("host")}
								>
									<TiltedCard
										imageSrc="https://www.shutterstock.com/image-vector/flat-vector-illustration-homestay-vacation-600nw-2613079825.jpghttps://www.shutterstock.com/image-vector/airbnb-host-providing-local-recommendations-600nw-2303721887.jpg"
										altText="Host Account"
										captionText="Become a Host"
										containerHeight="200px"
										containerWidth="200px"
										imageHeight="200px"
										imageWidth="200px"
										rotateAmplitude={12}
										scaleOnHover={1.2}
										showMobileWarning={false}
										showTooltip={true}
										displayOverlayContent={true}
									/>
									<h3 className="card-title">Become Host</h3>
								</div>
								<div
									className={`user-type-card ${
										userType === "guest" ? "selected" : ""
									}`}
									onClick={() => selectUserType("guest")}
								>
									<TiltedCard
										imageSrc="https://static.vecteezy.com/system/resources/previews/027/124/959/non_2x/travel-find-a-location-vector-illustration-png.png"
										altText="Guest Account"
										captionText="Find Places"
										containerHeight="200px"
										containerWidth="200px"
										imageHeight="200px"
										imageWidth="200px"
										rotateAmplitude={12}
										scaleOnHover={1.2}
										showMobileWarning={false}
										showTooltip={true}
										displayOverlayContent={true}
									/>
									<h3 className="card-title">Book Stay</h3>
								</div>
							</div>
						</div>

						{/* Step 2: Personal Information */}
						<div className={`step ${currentStep === 2 ? "active" : ""}`}>
							<div className="step-title">Personal Information</div>
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
							</form>
							<div className="google-signin">
								<p>or</p>
								<button className="btn-google" onClick={handleGoogleSignIn}>
									<img src={googleIcon} alt="Google Icon" />
									Continue with Google
								</button>
							</div>
						</div>

						{/* Step 3: Send Verification Email */}
						<div className={`step ${currentStep === 3 ? "active" : ""}`}>
							<div className="step-title">Send Verification Email</div>
							<div className="verification-content">
								<div className="account-summary">
									<h3>Account Summary</h3>
									<div className="summary-item">
										<span className="label">Account Type:</span>
										<span className="value">
											{userType === "host" ? "Host" : "Guest"}
										</span>
									</div>
									<div className="summary-item">
										<span className="label">Name:</span>
										<span className="value">
											{formdata.firstName} {formdata.lastName}
										</span>
									</div>
									<div className="summary-item">
										<span className="label">Email:</span>
										<span className="value">{formdata.email}</span>
									</div>
									{auth.currentUser && (
										<div className="summary-item">
											<span className="label">Sign-in Method:</span>
											<span className="value">Google</span>
										</div>
									)}
								</div>
								<div className="verification-info">
									<p>
										We'll send a verification email to{" "}
										<strong>{formdata.email}</strong> to confirm your account.
									</p>
									<p>
										Please check your inbox and click the verification link to
										complete your registration.
									</p>
								</div>
								<button
									type="button"
									className="btn-signup"
									onClick={sendVerificationEmailHandler}
								>
									{auth.currentUser
										? "Send Verification Email"
										: "Create Account & Send Verification"}
								</button>
							</div>
						</div>
						<div className="signup-footer">
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
