import React from "react"
import "../css/Footer.css"
import { FaFacebookF, FaTwitter, FaInstagram } from "react-icons/fa6"
import logo from "../assets/logoPlain.png"

export default function Footer() {
	return (
		<footer className="footer">
			<div className="footer-container">
				<div className="footer-brand">
					<img src={logo} alt="AuraStays Logo" className="footer-logo" />
					<p>
						The curated platform for sustainable and serene stays. Effortless
						booking for experiences that refresh the mind and body.
					</p>
				</div>
				<div className="footer-social">
					<h4>Connect With Us</h4>
					<div className="social-icons">
						{/* Replace # with your actual social media links */}
						<a href="#" aria-label="Facebook" className="social-icon">
							<FaFacebookF />
						</a>
						<a href="#" aria-label="Twitter" className="social-icon">
							<FaTwitter />
						</a>
						<a href="#" aria-label="Instagram" className="social-icon">
							<FaInstagram />
						</a>
					</div>
				</div>
			</div>
			<div className="footer-bottom">
				<p>&copy; {new Date().getFullYear()} AuraStays. All Rights Reserved.</p>
			</div>
		</footer>
	)
}
