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
import WishlistCreate from "./pages/WishlistCreate"
import Messages from "./pages/Messages"
import HostMessages from "./pages/HostMessages"
import PropertyListingWizard from "./pages/PropertyListingWizard"
import HostBookings from "./pages/HostBookings"
import PropertyBookings from "./pages/PropertyBookings"
import HostSubscription from "./pages/HostSubscription"
import HostPoints from "./pages/HostPoints"
import HostAllListings from "./pages/HostAllListings"
import HostList from "./pages/HostList"
import Bookings from "./components/Bookings"

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
					<Route path="/bookings" element={<Bookings />} />
					<Route path="/search" element={<Search />} />
					<Route path="/property/:propertyId" element={<PropertyDetails />} />
					<Route path="/wishlist/new" element={<WishlistCreate />} />
					<Route path="/messages" element={<Messages />} />
					<Route path="/hostMessage" element={<HostMessages />} />
					<Route
						path="/host/list-property"
						element={<PropertyListingWizard />}
					/>
					<Route path="/host/bookings" element={<HostBookings />} />
					<Route path="/propertyBookings/:propertyId" element={<PropertyBookings />} />
					<Route path="/host/subscription" element={<HostSubscription />} />
					<Route path="/host/points" element={<HostPoints />} />
					<Route path="/host/all-listings" element={<HostAllListings />} />
					<Route path="/hostList" element={<HostList />} />

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
					zIndex: 100,
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
