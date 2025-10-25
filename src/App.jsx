import "./App.css"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { Toaster } from "react-stacked-toast"
import { AuthProvider } from "./contexts/AuthContext"
import NotFound from "./pages/404"
import Landing from "./pages/Landing"
import Signup from "./pages/signup"
import Login from "./pages/Login"
import VerifyEmail from "./pages/VerifyEmail"
import DashboardHost from "./pages/dashboardHost"
import DashboardGuest from "./pages/dashboardGuest"
import AdminDashboard from "./pages/AdminDashboard"
import Profile from "./pages/Profile"
import Search from "./pages/Search"
import PropertyDetails from "./pages/PropertyDetails"

function App() {
	return (
		<AuthProvider>
			<BrowserRouter>
				<Routes>
					{/* Public Routes - No protection for now */}
					<Route path="/" element={<Landing />} />
					<Route path="/login" element={<Login />} />
					<Route path="/signup" element={<Signup />} />
					<Route path="/verify-email" element={<VerifyEmail />} />
					<Route path="/dashboardHost" element={<DashboardHost />} />
					<Route path="/dashboardGuest" element={<DashboardGuest />} />
					<Route path="/admin" element={<AdminDashboard />} />
					<Route path="/profile" element={<Profile />} />
					<Route path="/search" element={<Search />} />
					<Route path="/property/:propertyId" element={<PropertyDetails />} />

					{/* 404 Route */}
					<Route path="*" element={<NotFound />} />
				</Routes>
			</BrowserRouter>
			<Toaster
				containerStyle={{
					top: "10px",
					left: "10px",
					right: "auto",
					bottom: "auto",
					zIndex: 1000,
				}}
				position="top-left"
				toastOptions={{
					success: {
						style: {
							background: "#10b981",
							color: "#ffffff",
							fontWeight: "500",
							padding: "16px",
							borderRadius: "8px",
							boxShadow: "0 4px 12px rgba(16, 185, 129, 0.4)",
						},
					},
					error: {
						style: {
							background: "#ef4444",
							color: "#ffffff",
							fontWeight: "500",
							padding: "16px",
							borderRadius: "8px",
							boxShadow: "0 4px 12px rgba(239, 68, 68, 0.4)",
						},
					},
					loading: {
						style: {
							background: "#3b82f6",
							color: "#ffffff",
							fontWeight: "500",
							padding: "16px",
							borderRadius: "8px",
							boxShadow: "0 4px 12px rgba(59, 130, 246, 0.4)",
						},
					},
					info: {
						style: {
							background: "#06b6d4",
							color: "#ffffff",
							fontWeight: "500",
							padding: "16px",
							borderRadius: "8px",
							boxShadow: "0 4px 12px rgba(6, 182, 212, 0.4)",
						},
					},
					warning: {
						style: {
							background: "#f59e0b",
							color: "#ffffff",
							fontWeight: "500",
							padding: "16px",
							borderRadius: "8px",
							boxShadow: "0 4px 12px rgba(245, 158, 11, 0.4)",
						},
					},
				}}
			/>
		</AuthProvider>
	)
}

export default App
