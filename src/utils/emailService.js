import emailjs from "@emailjs/browser"

// EmailJS Configuration - Guest (for verification emails)
// Get these values from: https://dashboard.emailjs.com/
const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_GUEST_SERVICE_ID
const EMAILJS_TEMPLATE_ID = import.meta.env
	.VITE_EMAILJS_VERIFICATION_TEMPLATE_ID
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_GUEST_PUBLIC_KEY

// Initialize EmailJS
emailjs.init(EMAILJS_PUBLIC_KEY)

/**
 * Send verification email using EmailJS
 * @param {Object} params - Email parameters
 * @param {string} params.to_email - Recipient email
 * @param {string} params.to_name - Recipient name
 * @param {string} params.verification_link - Verification link (optional)
 * @returns {Promise} EmailJS response
 */
export const sendVerificationEmail = async ({
	to_email,
	to_name,
	verification_link = "",
}) => {
	try {
		const templateParams = {
			name: to_name, // Matches {{name}} in your EmailJS template
			email: to_email, // Matches {{email}} in your EmailJS template
			verification_link: verification_link,
			from_name: "AuraStays",
			message: `Welcome to AuraStays! We're excited to have you join our community.`,
		}

		const response = await emailjs.send(
			EMAILJS_SERVICE_ID,
			EMAILJS_TEMPLATE_ID,
			templateParams
		)

		console.log("Email sent successfully:", response)
		return response
	} catch (error) {
		console.error("Failed to send email:", error)
		throw error
	}
}

/**
 * Send custom email using EmailJS
 * @param {Object} templateParams - Template parameters
 * @returns {Promise} EmailJS response
 */
export const sendCustomEmail = async (templateParams) => {
	try {
		const response = await emailjs.send(
			EMAILJS_SERVICE_ID,
			EMAILJS_TEMPLATE_ID,
			templateParams
		)

		console.log("Custom email sent successfully:", response)
		return response
	} catch (error) {
		console.error("Failed to send custom email:", error)
		throw error
	}
}

export default {
	sendVerificationEmail,
	sendCustomEmail,
}
