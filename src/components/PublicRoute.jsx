import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"

const PublicRoute = ({
	children,
	redirectTo = null,
	allowAuthenticated = false,
}) => {
	const { currentUser, userData, isAuthenticated, loading } = useAuth()
	const location = useLocation()

	// Show loading spinner while checking authentication
	if (loading) {
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

	// If allowAuthenticated is true, let authenticated users access this page
	if (allowAuthenticated) {
		return children
	}

	// If user is authenticated and has completed setup, redirect to appropriate dashboard
	if (isAuthenticated && currentUser && userData && userData.termsAccepted) {
		const from = location.state?.from?.pathname || "/"

		// If redirectTo is specified, use it
		if (redirectTo) {
			return <Navigate to={redirectTo} replace />
		}

		// Otherwise, redirect to appropriate dashboard based on user type
		let dashboard
		if (userData.userType === "admin") {
			dashboard = "/admin"
		} else if (userData.userType === "host") {
			dashboard = "/dashboardHost"
		} else {
			dashboard = "/dashboardGuest"
		}
		return <Navigate to={dashboard} replace />
	}

	// If user is authenticated but hasn't completed setup, redirect to verify-email
	if (
		isAuthenticated &&
		currentUser &&
		(!userData || !userData.termsAccepted)
	) {
		return <Navigate to="/verify-email" replace />
	}

	// User is not authenticated, show the public page
	return children
}

export default PublicRoute
