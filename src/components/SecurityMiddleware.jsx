import { useEffect } from "react"
import { useLocation } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import {
	rateLimit,
	detectSuspiciousActivity,
	validateSession,
} from "../utils/security"
import { toast } from "react-stacked-toast"

const SecurityMiddleware = ({ children }) => {
	const { currentUser, userData, isAuthenticated } = useAuth()
	const location = useLocation()

	useEffect(() => {
		// Security checks on route change
		const performSecurityChecks = () => {
			// Check for suspicious user agent
			if (detectSuspiciousActivity(navigator.userAgent)) {
				console.warn("Suspicious user agent detected")
				// In production, you might want to log this or take action
			}

			// Rate limiting for authenticated users
			if (isAuthenticated && currentUser) {
				const userId = currentUser.uid
				if (!rateLimit(userId, 100, 60000)) {
					// 100 requests per minute
					toast.error("Too many requests. Please slow down.")
					return
				}

				// Validate session
				if (!validateSession(currentUser, userData)) {
					toast.error("Session expired. Please log in again.")
					// Force logout
					window.location.href = "/login"
					return
				}
			}

			// Check for localStorage tampering
			const pendingData = localStorage.getItem("pendingUserData")
			if (pendingData && isAuthenticated) {
				// Clear pending data if user is already authenticated
				localStorage.removeItem("pendingUserData")
			}
		}

		performSecurityChecks()
	}, [location, currentUser, userData, isAuthenticated])

	useEffect(() => {
		// Add security headers and prevent right-click on sensitive pages
		const isDevelopment =
			import.meta.env.DEV || process.env.NODE_ENV === "development"

		// Skip security measures in development mode
		if (isDevelopment) {
			return
		}

		const sensitivePages = [
			"/dashboardHost",
			"/dashboardGuest",
			"/verify-email",
			"/admin",
		]
		if (sensitivePages.includes(location.pathname)) {
			// Disable right-click context menu
			const handleContextMenu = (e) => e.preventDefault()
			document.addEventListener("contextmenu", handleContextMenu)

			// Disable F12, Ctrl+Shift+I, etc.
			const handleKeyDown = (e) => {
				if (
					e.key === "F12" ||
					(e.ctrlKey && e.shiftKey && e.key === "I") ||
					(e.ctrlKey && e.shiftKey && e.key === "C") ||
					(e.ctrlKey && e.key === "U")
				) {
					e.preventDefault()
					toast.warning("Developer tools are disabled for security")
				}
			}
			document.addEventListener("keydown", handleKeyDown)

			// Cleanup
			return () => {
				document.removeEventListener("contextmenu", handleContextMenu)
				document.removeEventListener("keydown", handleKeyDown)
			}
		}
	}, [location.pathname])

	useEffect(() => {
		// Auto-logout after inactivity (30 minutes)
		let inactivityTimer
		const resetTimer = () => {
			clearTimeout(inactivityTimer)
			inactivityTimer = setTimeout(() => {
				if (isAuthenticated) {
					toast.info("Session expired due to inactivity")
					// Force logout
					window.location.href = "/login"
				}
			}, 30 * 60 * 1000) // 30 minutes
		}

		// Reset timer on user activity
		const events = [
			"mousedown",
			"mousemove",
			"keypress",
			"scroll",
			"touchstart",
		]
		events.forEach((event) => {
			document.addEventListener(event, resetTimer, true)
		})

		resetTimer()

		return () => {
			clearTimeout(inactivityTimer)
			events.forEach((event) => {
				document.removeEventListener(event, resetTimer, true)
			})
		}
	}, [isAuthenticated])

	return children
}

export default SecurityMiddleware
