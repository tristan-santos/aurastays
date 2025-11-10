import emailjs from "@emailjs/browser"

// EmailJS Configuration - Guest (for verification emails)
// Get these values from: https://dashboard.emailjs.com/
const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_GUEST_SERVICE_ID
const EMAILJS_TEMPLATE_ID = import.meta.env
	.VITE_EMAILJS_VERIFICATION_TEMPLATE_ID
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_GUEST_PUBLIC_KEY

// Validate EmailJS configuration
const isEmailJSConfigured = () => {
	const hasServiceId = EMAILJS_SERVICE_ID && EMAILJS_SERVICE_ID.trim() !== ""
	const hasTemplateId = EMAILJS_TEMPLATE_ID && EMAILJS_TEMPLATE_ID.trim() !== ""
	const hasPublicKey = EMAILJS_PUBLIC_KEY && EMAILJS_PUBLIC_KEY.trim() !== ""

	// Debug logging (only in development)
	if (import.meta.env.DEV) {
		console.log("[EmailJS Config Check]", {
			hasServiceId,
			hasTemplateId,
			hasPublicKey,
			serviceIdValue: hasServiceId ? "✓ Set" : "✗ Missing",
			templateIdValue: hasTemplateId ? "✓ Set" : "✗ Missing",
			publicKeyValue: hasPublicKey ? "✓ Set" : "✗ Missing",
		})
	}

	return hasServiceId && hasTemplateId && hasPublicKey
}

// Initialize EmailJS only if configured
if (isEmailJSConfigured()) {
	emailjs.init(EMAILJS_PUBLIC_KEY)
} else {
	console.warn(
		"⚠️ EmailJS not configured. Please set the following environment variables:",
		"\n- VITE_EMAILJS_GUEST_SERVICE_ID",
		"\n- VITE_EMAILJS_VERIFICATION_TEMPLATE_ID",
		"\n- VITE_EMAILJS_GUEST_PUBLIC_KEY",
		"\n\nGet these values from: https://dashboard.emailjs.com/"
	)
}

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
	// Check if EmailJS is configured
	if (!isEmailJSConfigured()) {
		const missing = []
		if (!EMAILJS_SERVICE_ID || EMAILJS_SERVICE_ID.trim() === "") {
			missing.push("VITE_EMAILJS_GUEST_SERVICE_ID")
		}
		if (!EMAILJS_TEMPLATE_ID || EMAILJS_TEMPLATE_ID.trim() === "") {
			missing.push("VITE_EMAILJS_VERIFICATION_TEMPLATE_ID")
		}
		if (!EMAILJS_PUBLIC_KEY || EMAILJS_PUBLIC_KEY.trim() === "") {
			missing.push("VITE_EMAILJS_GUEST_PUBLIC_KEY")
		}

		const errorMessage =
			`EmailJS is not configured. Missing environment variables:\n${missing.map((v) => `- ${v}`).join("\n")}\n\n` +
			`Please add these to your .env.local file in the project root and restart your dev server.\n` +
			`Get these values from: https://dashboard.emailjs.com/admin`
		console.error("[EmailJS Error]", errorMessage)
		console.error("[EmailJS Debug]", {
			SERVICE_ID: EMAILJS_SERVICE_ID ? "Set" : "Missing",
			TEMPLATE_ID: EMAILJS_TEMPLATE_ID ? "Set" : "Missing",
			PUBLIC_KEY: EMAILJS_PUBLIC_KEY ? "Set" : "Missing",
		})
		throw new Error(errorMessage)
	}

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
		// Provide a more user-friendly error message
		const errorMessage =
			error?.text ||
			error?.message ||
			"Failed to send verification email. Please try again later."
		throw new Error(errorMessage)
	}
}

/**
 * Send custom email using EmailJS
 * @param {Object} templateParams - Template parameters
 * @returns {Promise} EmailJS response
 */
export const sendCustomEmail = async (templateParams) => {
	// Check if EmailJS is configured
	if (!isEmailJSConfigured()) {
		const missing = []
		if (!EMAILJS_SERVICE_ID || EMAILJS_SERVICE_ID.trim() === "") {
			missing.push("VITE_EMAILJS_GUEST_SERVICE_ID")
		}
		if (!EMAILJS_TEMPLATE_ID || EMAILJS_TEMPLATE_ID.trim() === "") {
			missing.push("VITE_EMAILJS_VERIFICATION_TEMPLATE_ID")
		}
		if (!EMAILJS_PUBLIC_KEY || EMAILJS_PUBLIC_KEY.trim() === "") {
			missing.push("VITE_EMAILJS_GUEST_PUBLIC_KEY")
		}

		const errorMessage =
			`EmailJS is not configured. Missing environment variables:\n${missing.map((v) => `- ${v}`).join("\n")}\n\n` +
			`Please add these to your .env.local file in the project root and restart your dev server.\n` +
			`Get these values from: https://dashboard.emailjs.com/admin`
		console.error("[EmailJS Error]", errorMessage)
		console.error("[EmailJS Debug]", {
			SERVICE_ID: EMAILJS_SERVICE_ID ? "Set" : "Missing",
			TEMPLATE_ID: EMAILJS_TEMPLATE_ID ? "Set" : "Missing",
			PUBLIC_KEY: EMAILJS_PUBLIC_KEY ? "Set" : "Missing",
		})
		throw new Error(errorMessage)
	}

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
		// Provide a more user-friendly error message
		const errorMessage =
			error?.text ||
			error?.message ||
			"Failed to send email. Please try again later."
		throw new Error(errorMessage)
	}
}

export default {
	sendVerificationEmail,
	sendCustomEmail,
}
