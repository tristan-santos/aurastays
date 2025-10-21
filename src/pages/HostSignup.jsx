import React, { useState, useEffect } from "react"
import "../css/HostSignup.css"
import { Link } from "react-router-dom"
import googleIcon from "../assets/icons/google (1).png"
import logoHd from "../assets/logoHd.png"
import image1 from "../assets/Sign up-rafiki.png"
import image2 from "../assets/Computer login-rafiki (1).png"
import image3 from "../assets/housePlaceholder.png"

const images = [image1, image2, image3]

export default function HostSignup() {
	const [currentImage, setCurrentImage] = useState(0)

	useEffect(() => {
		const interval = setInterval(() => {
			setCurrentImage((prevImage) => (prevImage + 1) % images.length)
		}, 3000)
		return () => clearInterval(interval)
	}, [])

	return (
		<>
			<div className="host-signup-modal">
				<div className="host-signup-content">
					<div className="carousel-container">
						<div className="carousel-header">
							<img
								src={logoHd}
								alt="AuraStays Logo"
								className="carousel-logo"
							/>
							<h1>AuraStays</h1>
						</div>
						<img
							src={images[currentImage]}
							alt="Signup Visual"
							className="carousel-image"
						/>
					</div>
					<div className="host-signup-form-container">
						<div className="host-signup-header">
							<h2>Become a Host</h2>
							<p>Create an account to start hosting</p>
						</div>
						<form>
							<div className="name-fields">
								<div className="form-group">
									<label htmlFor="first-name">First Name</label>
									<input
										type="text"
										id="first-name"
										placeholder="Enter your first name"
									/>
								</div>
								<div className="form-group">
									<label htmlFor="last-name">Last Name</label>
									<input
										type="text"
										id="last-name"
										placeholder="Enter your last name"
									/>
								</div>
							</div>
							<div className="form-group">
								<label htmlFor="email">Email</label>
								<input type="email" id="email" placeholder="Enter your email" />
							</div>
							<div className="form-group">
								<label htmlFor="password">Password</label>
								<input
									type="password"
									id="password"
									placeholder="Enter your password"
								/>
							</div>
							<div className="form-group">
								<label htmlFor="confirm-password">Confirm Password</label>
								<input
									type="password"
									id="confirm-password"
									placeholder="Confirm your password"
								/>
							</div>
							<button type="submit" className="btn-signup">
								Create Account
							</button>
						</form>
						<div className="google-signin">
							<p>or</p>
							<button className="btn-google">
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
