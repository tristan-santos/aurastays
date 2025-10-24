// Security utility functions

// Rate limiting for API calls
const rateLimitMap = new Map()

export const rateLimit = (key, maxRequests = 10, windowMs = 60000) => {
	const now = Date.now()
	const windowStart = now - windowMs

	// Clean old entries
	for (const [k, v] of rateLimitMap.entries()) {
		if (v.timestamp < windowStart) {
			rateLimitMap.delete(k)
		}
	}

	const userRequests = rateLimitMap.get(key) || { count: 0, timestamp: now }

	if (userRequests.timestamp < windowStart) {
		userRequests.count = 1
		userRequests.timestamp = now
	} else {
		userRequests.count++
	}

	rateLimitMap.set(key, userRequests)

	return userRequests.count <= maxRequests
}

// Validate user session
export const validateSession = (user, userData) => {
	if (!user || !userData) return false

	// Check if user is still valid
	if (!user.emailVerified) return false

	// Check if user has completed setup
	if (!userData.termsAccepted) return false

	// Check if user data is not too old (24 hours)
	const lastUpdate = userData.updatedAt?.toDate?.() || new Date()
	const hoursSinceUpdate =
		(Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60)
	if (hoursSinceUpdate > 24) return false

	return true
}

// Sanitize input to prevent XSS
export const sanitizeInput = (input) => {
	if (typeof input !== "string") return input

	return input
		.replace(/[<>]/g, "") // Remove < and >
		.replace(/javascript:/gi, "") // Remove javascript: protocol
		.replace(/on\w+=/gi, "") // Remove event handlers
		.trim()
}

// Check for suspicious patterns
export const detectSuspiciousActivity = (userAgent, ip = null) => {
	const suspiciousPatterns = [
		/curl/i,
		/wget/i,
		/python/i,
		/php/i,
		/bot/i,
		/crawler/i,
		/spider/i,
	]

	return suspiciousPatterns.some((pattern) => pattern.test(userAgent))
}

// Generate secure token
export const generateSecureToken = () => {
	const array = new Uint8Array(32)
	crypto.getRandomValues(array)
	return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
		""
	)
}

// Validate email format
export const isValidEmail = (email) => {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
	return emailRegex.test(email)
}

// Validate password strength
export const validatePasswordStrength = (password) => {
	const minLength = 8
	const hasUpperCase = /[A-Z]/.test(password)
	const hasLowerCase = /[a-z]/.test(password)
	const hasNumbers = /\d/.test(password)
	const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password)

	return {
		isValid:
			password.length >= minLength &&
			hasUpperCase &&
			hasLowerCase &&
			hasNumbers &&
			hasSpecialChar,
		requirements: {
			minLength: password.length >= minLength,
			hasUpperCase,
			hasLowerCase,
			hasNumbers,
			hasSpecialChar,
		},
	}
}

// Check for CSRF token (basic implementation)
export const generateCSRFToken = () => {
	return generateSecureToken()
}

export const validateCSRFToken = (token, sessionToken) => {
	return token === sessionToken
}
