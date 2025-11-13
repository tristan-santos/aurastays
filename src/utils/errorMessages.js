/**
 * Converts Firebase error codes to user-friendly error messages
 * @param {Error} error - The Firebase error object
 * @returns {string} - User-friendly error message
 */
export const getFirebaseErrorMessage = (error) => {
	if (!error) {
		return "An unexpected error occurred. Please try again."
	}

	// If it's already a user-friendly message, return it
	if (typeof error === "string") {
		return error
	}

	// Get error code from Firebase error
	const errorCode = error.code || error.message || ""

	// Firebase Auth error codes
	if (errorCode.includes("auth/")) {
		const authError = errorCode.replace("auth/", "")

		switch (authError) {
			case "email-already-in-use":
			case "EMAIL_EXISTS":
				return "This email is already registered. Please use a different email or try logging in."

			case "invalid-email":
			case "INVALID_EMAIL":
				return "Please enter a valid email address."

			case "weak-password":
			case "WEAK_PASSWORD":
				return "Password is too weak. Please use at least 6 characters."

			case "user-not-found":
			case "USER_NOT_FOUND":
				return "No account found with this email. Please check your email or sign up."

			case "wrong-password":
			case "INVALID_PASSWORD":
			case "invalid-credential":
			case "INVALID_CREDENTIAL":
				return "Incorrect password. Please try again."

			case "user-disabled":
			case "USER_DISABLED":
				return "This account has been disabled. Please contact support."

			case "too-many-requests":
			case "TOO_MANY_ATTEMPTS_TRY_LATER":
				return "Too many failed attempts. Please try again later."

			case "operation-not-allowed":
			case "OPERATION_NOT_ALLOWED":
				return "This operation is not allowed. Please contact support."

			case "requires-recent-login":
			case "REQUIRES_RECENT_LOGIN":
				return "Please log in again to complete this action."

			case "network-request-failed":
			case "NETWORK_REQUEST_FAILED":
				return "Network error. Please check your internet connection and try again."

			case "popup-closed-by-user":
			case "POPUP_CLOSED_BY_USER":
				return "Sign-in was cancelled. Please try again."

			case "popup-blocked":
			case "POPUP_BLOCKED":
				return "Popup was blocked. Please allow popups for this site and try again."

			case "account-exists-with-different-credential":
			case "ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL":
				return "An account already exists with a different sign-in method. Please use that method to sign in."

			case "invalid-credential":
			case "INVALID_CREDENTIAL":
				return "Invalid credentials. Please check your email and password."

			case "credential-already-in-use":
			case "CREDENTIAL_ALREADY_IN_USE":
				return "This credential is already associated with another account."

			default:
				// Try to extract a readable message from the error
				if (error.message && !error.message.includes("auth/")) {
					return error.message
				}
				return "Authentication error. Please try again."
		}
	}

	// Firestore error codes
	if (
		errorCode.includes("firestore/") ||
		errorCode.includes("permission-denied")
	) {
		return "You don't have permission to perform this action. Please contact support if you believe this is an error."
	}

	if (
		errorCode.includes("unavailable") ||
		errorCode.includes("deadline-exceeded")
	) {
		return "Service is temporarily unavailable. Please try again in a moment."
	}

	if (errorCode.includes("not-found")) {
		return "The requested resource was not found."
	}

	if (errorCode.includes("already-exists")) {
		return "This item already exists."
	}

	if (errorCode.includes("failed-precondition")) {
		return "Operation cannot be completed. Please try again."
	}

	if (errorCode.includes("out-of-range")) {
		return "The value provided is out of range."
	}

	if (errorCode.includes("unimplemented")) {
		return "This feature is not yet available."
	}

	if (errorCode.includes("internal")) {
		return "An internal error occurred. Please try again later."
	}

	if (errorCode.includes("unauthenticated")) {
		return "Please log in to continue."
	}

	// If error has a message property, try to use it (but clean it up)
	if (error.message) {
		let message = error.message
		// Remove Firebase error code prefixes
		message = message.replace(/^auth\//, "")
		message = message.replace(/^firestore\//, "")
		message = message.replace(/^\[.*?\]\s*/, "") // Remove [Auth] or similar prefixes

		// Capitalize first letter
		message = message.charAt(0).toUpperCase() + message.slice(1)

		// If it still looks like a code, return generic message
		if (message.includes("/") || message.includes("_")) {
			return "An error occurred. Please try again."
		}

		return message
	}

	// Fallback to generic error message
	return "An error occurred. Please try again."
}
