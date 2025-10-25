import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import { db } from "../components/firebaseConfig"
import {
	collection,
	getDocs,
	query,
	where,
	orderBy,
	limit,
} from "firebase/firestore"
import { toast } from "react-stacked-toast"
import {
	FaHome,
	FaCalendarCheck,
	FaDollarSign,
	FaChartLine,
	FaStar,
	FaUsers,
	FaSignOutAlt,
	FaCog,
} from "react-icons/fa"
import "../css/DashboardHost.css"

export default function DashboardHost() {
	const { currentUser, userData, logout } = useAuth()
	const navigate = useNavigate()
	const [stats, setStats] = useState({
		totalProperties: 0,
		totalBookings: 0,
		totalRevenue: 0,
		avgRating: 0,
		activeBookings: 0,
		monthlyRevenue: 0,
	})
	const [recentBookings, setRecentBookings] = useState([])
	const [properties, setProperties] = useState([])
	const [monthlyData, setMonthlyData] = useState([])
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		if (currentUser) {
			fetchHostData()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentUser])

	const fetchHostData = async () => {
		try {
			const hostId = currentUser.uid

			// Fetch properties
			const propertiesRef = collection(db, "properties")
			const propertiesQuery = query(
				propertiesRef,
				where("hostId", "==", hostId)
			)
			const propertiesSnapshot = await getDocs(propertiesQuery)
			const propertiesList = propertiesSnapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			}))
			setProperties(propertiesList)

			// Fetch bookings
			const bookingsRef = collection(db, "bookings")
			const bookingsQuery = query(
				bookingsRef,
				where("hostId", "==", hostId),
				orderBy("createdAt", "desc")
			)
			const bookingsSnapshot = await getDocs(bookingsQuery)
			const bookingsList = bookingsSnapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			}))

			// Calculate stats
			const totalRevenue = bookingsList.reduce(
				(sum, booking) => sum + (booking.pricing?.total || 0),
				0
			)
			const activeBookings = bookingsList.filter(
				(b) => b.status === "confirmed"
			).length
			const avgRating =
				propertiesList.reduce((sum, p) => sum + (p.rating || 0), 0) /
					propertiesList.length || 0

			// Monthly revenue
			const currentMonth = new Date().getMonth()
			const monthlyRevenue = bookingsList
				.filter((b) => {
					const bookingDate = b.createdAt?.toDate?.() || new Date()
					return bookingDate.getMonth() === currentMonth
				})
				.reduce((sum, b) => sum + (b.pricing?.total || 0), 0)

			setStats({
				totalProperties: propertiesList.length,
				totalBookings: bookingsList.length,
				totalRevenue,
				avgRating: avgRating.toFixed(1),
				activeBookings,
				monthlyRevenue,
			})

			setRecentBookings(bookingsList.slice(0, 10))
			setLoading(false)
		} catch (error) {
			console.error("Error fetching host data:", error)
			toast.error("Failed to load dashboard data")
			setLoading(false)
		}
	}

	const handleLogout = async () => {
		try {
			await logout()
			toast.success("Logged out successfully")
			navigate("/")
		} catch (error) {
			console.error("Error logging out:", error)
			toast.error("Failed to logout")
		}
	}

	if (loading) {
		return (
			<div className="loading-container">
				<div className="loading-spinner"></div>
				<p>Loading dashboard...</p>
			</div>
		)
	}

	return (
		<div className="dashboard-host-container">
			{/* Header */}
			<header className="host-header">
				<div className="header-content">
					<h1>🏠 Host Dashboard</h1>
					<div className="header-actions">
						<span className="welcome-text">
							Welcome, {userData?.displayName || "Host"}
						</span>
						<button onClick={() => navigate("/profile")} className="icon-btn">
							<FaCog />
						</button>
						<button onClick={handleLogout} className="logout-btn">
							<FaSignOutAlt /> Logout
						</button>
					</div>
				</div>
			</header>

			{/* Main Content - Bento Style */}
			<div className="bento-container">
				{/* Stats Grid - Top Row */}
				<div className="stats-row">
					<div className="stat-card properties">
						<div className="stat-icon">
							<FaHome />
						</div>
						<div className="stat-info">
							<h3>{stats.totalProperties}</h3>
							<p>Properties</p>
						</div>
					</div>

					<div className="stat-card bookings">
						<div className="stat-icon">
							<FaCalendarCheck />
						</div>
						<div className="stat-info">
							<h3>{stats.totalBookings}</h3>
							<p>Total Bookings</p>
						</div>
					</div>

					<div className="stat-card revenue">
						<div className="stat-icon">
							<FaDollarSign />
						</div>
						<div className="stat-info">
							<h3>₱{stats.totalRevenue.toLocaleString()}</h3>
							<p>Total Revenue</p>
						</div>
					</div>

					<div className="stat-card rating">
						<div className="stat-icon">
							<FaStar />
						</div>
						<div className="stat-info">
							<h3>{stats.avgRating}</h3>
							<p>Average Rating</p>
						</div>
					</div>
				</div>

				{/* Main Grid - Bento Style */}
				<div className="bento-grid">
					{/* Monthly Revenue Card - Large */}
					<div className="bento-card large monthly-revenue-card">
						<div className="card-header">
							<h2>
								<FaChartLine /> Monthly Revenue
							</h2>
						</div>
						<div className="revenue-display">
							<div className="revenue-amount">
								₱{stats.monthlyRevenue.toLocaleString()}
							</div>
							<p className="revenue-label">This Month</p>
						</div>
						<div className="revenue-stats">
							<div className="revenue-stat">
								<span className="stat-label">Active Bookings:</span>
								<span className="stat-value">{stats.activeBookings}</span>
							</div>
							<div className="revenue-stat">
								<span className="stat-label">Total Properties:</span>
								<span className="stat-value">{stats.totalProperties}</span>
							</div>
						</div>
					</div>

					{/* Properties List Card - Medium */}
					<div className="bento-card medium properties-card">
						<div className="card-header">
							<h2>
								<FaHome /> Your Properties
							</h2>
						</div>
						<div className="properties-list">
							{properties.length > 0 ? (
								properties.map((property) => (
									<div key={property.id} className="property-item">
										<div className="property-image">
											<img
												src={property.images?.[0] || "/placeholder.png"}
												alt={property.title}
											/>
										</div>
										<div className="property-details">
											<h4>{property.title}</h4>
											<p className="property-location">
												{property.location?.city}, {property.location?.province}
											</p>
											<div className="property-meta">
												<span className="property-rating">
													⭐ {property.rating || "N/A"}
												</span>
												<span className="property-price">
													₱{property.pricing?.basePrice?.toLocaleString() || 0}/
													night
												</span>
											</div>
										</div>
									</div>
								))
							) : (
								<div className="empty-state">
									<p>No properties yet</p>
								</div>
							)}
						</div>
					</div>

					{/* Recent Bookings Card - Medium */}
					<div className="bento-card medium bookings-card">
						<div className="card-header">
							<h2>
								<FaCalendarCheck /> Recent Bookings
							</h2>
						</div>
						<div className="bookings-list">
							{recentBookings.length > 0 ? (
								recentBookings.map((booking) => (
									<div key={booking.id} className="booking-item">
										<div className="booking-info">
											<h4>{booking.propertyTitle}</h4>
											<p className="booking-guest">
												<FaUsers /> {booking.guestName}
											</p>
											<p className="booking-dates">
												{new Date(booking.checkInDate).toLocaleDateString()} -{" "}
												{new Date(booking.checkOutDate).toLocaleDateString()}
											</p>
										</div>
										<div className="booking-amount">
											<span className="amount">
												₱{booking.pricing?.total?.toLocaleString() || 0}
											</span>
											<span className={`booking-status ${booking.status}`}>
												{booking.status}
											</span>
										</div>
									</div>
								))
							) : (
								<div className="empty-state">
									<p>No bookings yet</p>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
