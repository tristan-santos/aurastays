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

					{/* 404 Route */}
					<Route path="*" element={<NotFound />} />
				</Routes>
			</BrowserRouter>
			<Toaster position="top-right" />
		</AuthProvider>
	)
}

export default App
