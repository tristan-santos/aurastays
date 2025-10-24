import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import { useEffect, useState } from "react"
import { toast } from "react-stacked-toast"

const ProtectedRoute = ({
	children,
	requiredRole = null,
	requireEmailVerification = true,
}) => {
	const { currentUser, userData, isAuthenticated, loading } = useAuth()
	const location = useLocation()
	const [isValidating, setIsValidating] = useState(true)

	useEffect(() => {
		const validateAccess = async () => {
			if (loading) return

			// Check if user is authenticated
			if (!isAuthenticated || !currentUser) {
				setIsValidating(false)
				return
			}

			// Check email verification if required (exempt admin users)
			if (
				requireEmailVerification &&
				!currentUser.emailVerified &&
				userData?.userType !== "admin"
			) {
				toast.error("Please verify your email before accessing this page.")
				setIsValidating(false)
				return
			}

			// Check if user data exists
			if (!userData) {
				toast.error("User data not found. Please sign up again.")
				setIsValidating(false)
				return
			}

			// Check if user has completed account setup
			if (!userData.termsAccepted) {
				toast.error("Please complete your account setup first.")
				setIsValidating(false)
				return
			}

			// Check role-based access
			if (requiredRole && userData.userType !== requiredRole) {
				// Special handling for admin - only allow if user is admin
				if (requiredRole === "admin") {
					toast.error("Access denied. Admin privileges required.")
					setIsValidating(false)
					return
				} else {
					toast.error(`Access denied. This page is for ${requiredRole}s only.`)
					setIsValidating(false)
					return
				}
			}

			// Check for suspicious activity (basic rate limiting)
			const lastAccess = localStorage.getItem(`lastAccess_${currentUser.uid}`)
			const now = Date.now()
			if (lastAccess && now - parseInt(lastAccess) < 1000) {
				// 1 second minimum between requests
				toast.error("Too many requests. Please wait a moment.")
				setIsValidating(false)
				return
			}

			// Update last access time
			localStorage.setItem(`lastAccess_${currentUser.uid}`, now.toString())

			setIsValidating(false)
		}

		validateAccess()
	}, [
		currentUser,
		userData,
		isAuthenticated,
		loading,
		requiredRole,
		requireEmailVerification,
	])

	// Show loading spinner while validating
	if (loading || isValidating) {
		return (
			<div
				style={{
					display: "flex",
					justifyContent: "center",
					alignItems: "center",
					height: "100vh",
					background: "#333",
				}}
			>
				<div
					style={{
						width: "50px",
						height: "50px",
						border: "5px solid #f3f3f3",
						borderTop: "5px solid var(--primary)",
						borderRadius: "50%",
						animation: "spin 1s linear infinite",
					}}
				></div>
			</div>
		)
	}

	// Redirect to login if not authenticated
	if (!isAuthenticated || !currentUser) {
		return <Navigate to="/login" state={{ from: location }} replace />
	}

	// Redirect to verify-email if email not verified (exempt admin users)
	if (
		requireEmailVerification &&
		!currentUser.emailVerified &&
		userData?.userType !== "admin"
	) {
		return <Navigate to="/verify-email" replace />
	}

	// Redirect to verify-email if account setup not complete
	if (!userData || !userData.termsAccepted) {
		return <Navigate to="/verify-email" replace />
	}

	// Redirect to appropriate dashboard if wrong role
	if (requiredRole && userData.userType !== requiredRole) {
		let redirectTo
		if (userData.userType === "admin") {
			redirectTo = "/admin"
		} else if (userData.userType === "host") {
			redirectTo = "/dashboardHost"
		} else {
			redirectTo = "/dashboardGuest"
		}
		return <Navigate to={redirectTo} replace />
	}

	// All checks passed, render the protected component
	return children
}

export default ProtectedRoute
