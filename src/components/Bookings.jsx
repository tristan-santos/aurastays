import { useState, useEffect } from "react"
import { useAuth } from "../contexts/AuthContext"
import { useNavigate } from "react-router-dom"
import { db } from "./firebaseConfig"
import {
	collection,
	query,
	where,
	getDocs,
	orderBy,
	getDoc,
	doc,
} from "firebase/firestore"
import {
	FaCalendarAlt,
	FaUsers,
	FaClock,
	FaCheckCircle,
	FaHourglassHalf,
	FaTimesCircle,
	FaTimes,
	FaReceipt,
	FaMapMarkerAlt,
	FaMoneyBillWave,
	FaBan,
	FaBars,
	FaUser,
	FaSignOutAlt,
	FaBookmark,
	FaSearch,
	FaHeart,
	FaEnvelope,
} from "react-icons/fa"
import { updateDoc, serverTimestamp } from "firebase/firestore"
import { toast } from "react-stacked-toast"
import housePlaceholder from "../assets/housePlaceholder.png"
import logoPlain from "../assets/logoPlain.png"
import "../css/Bookings.css"
import { formatCurrency } from "../utils/currencyFormatter"
import "../css/DashboardGuest.css"

export default function Bookings() {
	const { currentUser, userData, logout: logoutAuth } = useAuth()
	const navigate = useNavigate()
	const [allBookings, setAllBookings] = useState([])
	const [upcomingTrips, setUpcomingTrips] = useState([])
	const [previousBookings, setPreviousBookings] = useState([])
	const [pendingBookings, setPendingBookings] = useState([])
	const [cancelledBookings, setCancelledBookings] = useState([])
	const [activeTab, setActiveTab] = useState("all") // 'all', 'upcoming', 'previous', 'pending', 'cancelled'
	const [isLoading, setIsLoading] = useState(true)
	const [showInvoiceModal, setShowInvoiceModal] = useState(false)
	const [selectedBooking, setSelectedBooking] = useState(null)
	const [isMenuOpen, setIsMenuOpen] = useState(false)
	const [theme, setTheme] = useState(localStorage.getItem("theme") || "light")
	const [whereQuery, setWhereQuery] = useState("")
	const [favorites] = useState([])
	const [unreadNotifications] = useState(0)

	// Get user's display name
	const displayName =
		userData?.displayName || currentUser?.displayName || "Guest User"
	const userEmail = userData?.email || currentUser?.email || ""

	// Get initials for default avatar
	const getInitials = (name) => {
		return name
			.split(" ")
			.map((n) => n[0])
			.join("")
			.toUpperCase()
			.slice(0, 2)
	}

	// Theme effect
	useEffect(() => {
		document.documentElement.setAttribute("data-theme", theme)
		localStorage.setItem("theme", theme)
	}, [theme])

	// Toggle theme
	const toggleTheme = (newTheme) => {
		setTheme(newTheme)
	}

	// Get appropriate dashboard route
	const getDashboardRoute = () => {
		if (!userData?.userType) return "/dashboardGuest"
		if (userData.userType === "admin") return "/admin"
		if (userData.userType === "host") return "/dashboardHost"
		return "/dashboardGuest"
	}

	const handleLogout = async () => {
		try {
			await logoutAuth()
			navigate("/")
		} catch (error) {
			console.error("Error logging out:", error)
		}
	}

	const handleSearch = (e) => {
		e.preventDefault()
		if (whereQuery.trim()) {
			navigate(`/search?where=${encodeURIComponent(whereQuery)}`)
		}
	}

	useEffect(() => {
		if (currentUser) {
			fetchBookings()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentUser])

	const fetchBookings = async () => {
		setIsLoading(true)
		try {
			// First try with orderBy, if it fails (no index), try without
			let snapshot
			try {
				const q = query(
					collection(db, "bookings"),
					where("guestId", "==", currentUser.uid),
					orderBy("createdAt", "desc")
				)
				snapshot = await getDocs(q)
			} catch (orderByError) {
				// If orderBy fails, fetch without it and sort in memory
				console.log("OrderBy failed, fetching without sort:", orderByError)
				const q = query(
					collection(db, "bookings"),
					where("guestId", "==", currentUser.uid)
				)
				snapshot = await getDocs(q)
			}

			let bookings = snapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			}))

			// Sort by createdAt if not already sorted
			bookings.sort((a, b) => {
				const dateA = a.createdAt?.toDate
					? a.createdAt.toDate()
					: new Date(a.createdAt || 0)
				const dateB = b.createdAt?.toDate
					? b.createdAt.toDate()
					: new Date(b.createdAt || 0)
				return dateB - dateA
			})

			// Fetch property images for each booking
			bookings = await Promise.all(
				bookings.map(async (booking) => {
					try {
						let propertyDoc = null
						let propertyData = null

						// Try to get property by booking.propertyId (might be Firestore doc ID)
						try {
							propertyDoc = await getDoc(
								doc(db, "properties", booking.propertyId)
							)
							if (propertyDoc.exists()) {
								propertyData = propertyDoc.data()
							}
						} catch {
							console.warn(
								`[Bookings] Property not found by doc ID ${booking.propertyId}, trying custom id field`
							)
						}

						// If not found by doc ID, try to find by custom id field
						if (!propertyData || !propertyDoc?.exists()) {
							try {
								const propertiesQuery = query(
									collection(db, "properties"),
									where("id", "==", booking.propertyId)
								)
								const propertiesSnapshot = await getDocs(propertiesQuery)
								if (!propertiesSnapshot.empty) {
									propertyDoc = propertiesSnapshot.docs[0]
									propertyData = propertyDoc.data()
								}
							} catch (queryError) {
								console.error(
									"[Bookings] Error querying property by custom id:",
									queryError
								)
							}
						}

						if (propertyData) {
							const images = propertyData.images || []
							const propertyImage =
								images.length > 0 && images[0] ? images[0] : null

							console.log(
								`[Bookings] Property image for booking ${booking.id}:`,
								{
									propertyId: booking.propertyId,
									imagesCount: images.length,
									hasImage: !!propertyImage,
								}
							)

							return {
								...booking,
								propertyImage: propertyImage,
								propertyLocation: propertyData.location
									? `${propertyData.location.city || ""}, ${
											propertyData.location.province || ""
									  }`
											.trim()
											.replace(/^,\s*|,\s*$/g, "")
									: null,
							}
						}

						console.warn(
							`[Bookings] Property not found for booking ${booking.id}, propertyId: ${booking.propertyId}`
						)
						// Mark property as deleted
						return {
							...booking,
							isPropertyDeleted: true,
						}
					} catch (error) {
						console.error(
							"[Bookings] Error fetching property image for booking:",
							booking.id,
							error
						)
						// Mark property as deleted if fetch fails
						return {
							...booking,
							isPropertyDeleted: true,
						}
					}
				})
			)

			const today = new Date()
			today.setHours(0, 0, 0, 0)

			// Separate upcoming and previous
			// Upcoming: check-in date is today or in the future AND status is NOT cancelled AND NOT pending
			const upcoming = bookings.filter((booking) => {
				const checkInDate = new Date(booking.checkInDate)
				checkInDate.setHours(0, 0, 0, 0)
				const status = booking.status || "pending"
				// Exclude cancelled and pending bookings from upcoming trips
				return (
					checkInDate >= today && status !== "cancelled" && status !== "pending"
				)
			})

			// Previous: check-out date is before today AND status is NOT cancelled
			const previous = bookings.filter((booking) => {
				const checkOutDate = new Date(booking.checkOutDate)
				checkOutDate.setHours(0, 0, 0, 0)
				const status = booking.status || "pending"
				// Only include completed bookings (not cancelled)
				return (
					checkOutDate < today &&
					status !== "cancelled" &&
					status !== "cancellation_requested"
				)
			})

			// Pending: status is pending
			const pending = bookings.filter((booking) => {
				const status = booking.status || "pending"
				return status === "pending"
			})

			// Cancelled: status is cancelled or cancellation_requested
			const cancelled = bookings.filter((booking) => {
				const status = booking.status || "pending"
				return status === "cancelled" || status === "cancellation_requested"
			})

			console.log("📅 Bookings filtering:", {
				total: bookings.length,
				all: bookings.length,
				upcoming: upcoming.length,
				previous: previous.length,
				pending: pending.length,
				cancelled: cancelled.length,
			})

			setAllBookings(bookings)
			setUpcomingTrips(upcoming)
			setPreviousBookings(previous)
			setPendingBookings(pending)
			setCancelledBookings(cancelled)
		} catch (error) {
			console.error("Error fetching bookings:", error)
			// Don't show error if it's just empty collection
			if (error.code !== "permission-denied" && error.code !== "not-found") {
				console.log("Bookings collection may not exist yet")
			}
			// Set empty arrays so UI shows empty state
			setAllBookings([])
			setUpcomingTrips([])
			setPreviousBookings([])
			setPendingBookings([])
			setCancelledBookings([])
		} finally {
			setIsLoading(false)
		}
	}

	const getStatusBadge = (booking) => {
		// Check if property is deleted first
		if (booking.isPropertyDeleted) {
			return (
				<span className="status-badge deleted">
					<FaTimesCircle /> Deleted
				</span>
			)
		}

		const status = booking.status || "pending"
		switch (status) {
			case "confirmed":
				return (
					<span className="status-badge confirmed">
						<FaCheckCircle /> Confirmed
					</span>
				)
			case "pending":
				return (
					<span className="status-badge pending">
						<FaHourglassHalf /> Pending
					</span>
				)
			case "cancelled":
				return (
					<span className="status-badge cancelled">
						<FaTimesCircle /> Cancelled
					</span>
				)
			case "cancellation_requested":
				return (
					<span className="status-badge cancellation-requested">
						<FaHourglassHalf /> Cancellation Requested
					</span>
				)
			case "completed":
				return (
					<span className="status-badge completed">
						<FaCheckCircle /> Completed
					</span>
				)
			default:
				return <span className="status-badge">{status}</span>
		}
	}

	const formatDate = (dateString) => {
		const date = new Date(dateString)
		return date.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		})
	}

	const getDaysUntil = (dateString) => {
		const checkIn = new Date(dateString)
		const today = new Date()
		today.setHours(0, 0, 0, 0)
		const diffTime = checkIn - today
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
		return diffDays
	}

	const handleViewProperty = (propertyId) => {
		navigate(`/property/${propertyId}`)
	}

	const handleViewInvoice = (booking) => {
		setSelectedBooking(booking)
		setShowInvoiceModal(true)
	}

	const handleRequestCancellation = async (booking) => {
		if (
			!window.confirm(
				"Are you sure you want to request cancellation for this booking? The host will review your request."
			)
		) {
			return
		}

		try {
			const bookingRef = doc(db, "bookings", booking.id)
			// Store the previous status before changing to cancellation_requested
			const previousStatus = booking.status || "confirmed"
			await updateDoc(bookingRef, {
				status: "cancellation_requested",
				previousStatus: previousStatus, // Store previous status for potential rejection
				cancellationRequestedAt: serverTimestamp(),
				cancellationRequestedBy: currentUser.uid,
			})
			toast.success(
				"Cancellation request sent! The host will review your request."
			)
			fetchBookings() // Refresh bookings
		} catch (error) {
			console.error("Error requesting cancellation:", error)
			toast.error("Failed to request cancellation. Please try again.")
		}
	}

	const formatDateTime = (timestamp) => {
		if (!timestamp) return "N/A"
		const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
		return date.toLocaleString("en-US", {
			year: "numeric",
			month: "long",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		})
	}

	const renderBookingCard = (booking) => (
		<div key={booking.id} className="booking-card">
			<div
				className="booking-image"
				style={{
					backgroundImage: `url(${booking.propertyImage || housePlaceholder})`,
				}}
			>
				{activeTab === "upcoming" && (
					<div className="days-until">
						{getDaysUntil(booking.checkInDate) === 0
							? "Today!"
							: getDaysUntil(booking.checkInDate) === 1
							? "Tomorrow"
							: `In ${getDaysUntil(booking.checkInDate)} days`}
					</div>
				)}
			</div>

			<div className="booking-details">
				<div className="booking-header">
					<h3 className="booking-title">
						{booking.propertyTitle || "Deleted Property"}
					</h3>
					{getStatusBadge(booking)}
				</div>

				<div className="booking-info">
					<div className="info-item booking-dates-box">
						<FaCalendarAlt className="info-icon" />
						<div className="info-text">
							<span className="info-label">Booking Date</span>
							<div className="dates-row">
								<span className="info-value date-value">
									{formatDate(booking.checkInDate)}
								</span>
								<span className="date-separator">→</span>
								<span className="info-value date-value">
									{formatDate(booking.checkOutDate)}
								</span>
							</div>
						</div>
					</div>

					<div className="info-item">
						<FaUsers className="info-icon" />
						<div className="info-text">
							<span className="info-label">Guests</span>
							<span className="info-value">{booking.numberOfGuests}</span>
						</div>
					</div>

					<div className="info-item">
						<FaClock className="info-icon" />
						<div className="info-text">
							<span className="info-label">Nights</span>
							<span className="info-value">{booking.numberOfNights}</span>
						</div>
					</div>
				</div>

				<div className="booking-total-section">
					<div className="booking-total">
						<span className="total-label">Total Paid:</span>
						<span className="total-amount">
							{formatCurrency(booking.pricing?.total || 0)}
						</span>
					</div>
				</div>
				<div className="booking-footer">
					<div className="booking-actions">
						<button
							className="view-invoice-btn"
							onClick={() => handleViewInvoice(booking)}
						>
							<FaReceipt /> Invoice
						</button>
						<button
							className="booking-view-property-btn"
							onClick={() => handleViewProperty(booking.propertyId)}
						>
							View Property
						</button>
						{(activeTab === "upcoming" || activeTab === "pending") &&
							booking.status !== "cancelled" &&
							booking.status !== "completed" && (
								<button
									className="cancel-booking-btn"
									onClick={() => handleRequestCancellation(booking)}
									disabled={booking.status === "cancellation_requested"}
									type="button"
								>
									<FaBan /> Cancel Booking
								</button>
							)}
					</div>
				</div>
			</div>
		</div>
	)

	return (
		<div className="dashboard-guest-container">
			{/* Top Navigation Bar */}
			<nav className="top-navbar">
				{/* Logo */}
				<div
					className="navbar-logo"
					onClick={() => navigate(getDashboardRoute())}
					style={{ cursor: "pointer" }}
				>
					<img src={logoPlain} alt="AuraStays" />
					<span className="logo-text">AuraStays</span>
				</div>

				{/* Search Bar */}
				<form className="navbar-search" onSubmit={handleSearch}>
					<FaSearch 
						className="search-icon" 
						onClick={(e) => {
							e.preventDefault()
							handleSearch(e)
						}}
						style={{ cursor: 'pointer' }}
					/>
					<input
						type="text"
						placeholder="Search destinations, hotels, experiences..."
						value={whereQuery}
						onChange={(e) => setWhereQuery(e.target.value)}
						onClick={() => navigate("/search")}
						style={{ cursor: 'pointer' }}
					/>
				</form>

				{/* Right Section */}
				<div className="navbar-right">
					{/* Messages */}
					<button
						className="icon-button messages-btn"
						title="Messages"
						onClick={() => navigate("/messages")}
					>
						<FaEnvelope />
						{unreadNotifications > 0 && (
							<span className="badge">{unreadNotifications}</span>
						)}
					</button>

					{/* Favorites */}
					<button
						className="icon-button favorites-btn"
						title="Favorites"
						onClick={() => navigate("/dashboardGuest")}
					>
						<FaHeart />
						{favorites.length > 0 && (
							<span className="badge">{favorites.length}</span>
						)}
					</button>

					{/* User Menu */}
					<div className="user-menu">
						<button
							className="user-menu-button"
							onClick={() => setIsMenuOpen(!isMenuOpen)}
						>
							<FaBars className="menu-icon" />
							<div className="user-avatar">
								{userData?.photoURL || currentUser?.photoURL ? (
									<img
										src={userData?.photoURL || currentUser.photoURL}
										alt={displayName}
									/>
								) : (
									<div className="avatar-initials">
										{getInitials(displayName)}
									</div>
								)}
							</div>
						</button>

						{/* Dropdown Menu */}
						{isMenuOpen && (
							<div className="user-dropdown">
								<div className="dropdown-header">
									<div className="dropdown-avatar">
										{userData?.photoURL || currentUser?.photoURL ? (
											<img
												src={userData?.photoURL || currentUser.photoURL}
												alt={displayName}
											/>
										) : (
											<div className="avatar-initials-large">
												{getInitials(displayName)}
											</div>
										)}
									</div>
									<div className="dropdown-info">
										<div className="dropdown-name">{displayName}</div>
										<div className="dropdown-email">{userEmail}</div>
									</div>
								</div>

								<div className="dropdown-divider"></div>

								<button
									className="dropdown-item"
									onClick={() => {
										navigate("/profile")
										setIsMenuOpen(false)
									}}
								>
									<FaUser />
									<span>My Profile</span>
								</button>
								<button
									className="dropdown-item"
									onClick={() => {
										navigate("/bookings")
										setIsMenuOpen(false)
									}}
								>
									<FaCalendarAlt />
									<span>Bookings</span>
								</button>
								<button
									className="dropdown-item"
									onClick={() => {
										navigate("/dashboardGuest")
										setIsMenuOpen(false)
									}}
								>
									<FaBookmark />
									<span>Wishlist</span>
								</button>
								<div className="dropdown-theme-section">
									<span className="theme-label">Theme</span>
									<div className="theme-buttons">
										<button
											className={`theme-btn ${
												theme === "light" ? "active" : ""
											}`}
											onClick={() => toggleTheme("light")}
										>
											☀️ Light
										</button>
										<button
											className={`theme-btn ${
												theme === "dark" ? "active" : ""
											}`}
											onClick={() => toggleTheme("dark")}
										>
											🌙 Dark
										</button>
									</div>
								</div>

								<div className="dropdown-divider"></div>

								<button className="dropdown-item logout" onClick={handleLogout}>
									<FaSignOutAlt />
									<span>Logout</span>
								</button>
							</div>
						)}
					</div>
				</div>
			</nav>

			{/* Bookings Content */}
			<div
				className="bookings-container"
				style={{ margin: "2rem auto", maxWidth: "1400px", padding: "0 2rem" }}
			>
				<div className="bookings-header">
					<h2>My Bookings</h2>
					<div className="bookings-tabs">
						<button
							className={`tab-btn ${activeTab === "all" ? "active" : ""}`}
							onClick={() => setActiveTab("all")}
						>
							All ({allBookings.length})
						</button>
						<button
							className={`tab-btn ${activeTab === "upcoming" ? "active" : ""}`}
							onClick={() => setActiveTab("upcoming")}
						>
							Upcoming Trips ({upcomingTrips.length})
						</button>
						<button
							className={`tab-btn ${activeTab === "pending" ? "active" : ""}`}
							onClick={() => setActiveTab("pending")}
						>
							Pending ({pendingBookings.length})
						</button>
						<button
							className={`tab-btn ${activeTab === "previous" ? "active" : ""}`}
							onClick={() => setActiveTab("previous")}
						>
							Previous ({previousBookings.length})
						</button>
						<button
							className={`tab-btn ${activeTab === "cancelled" ? "active" : ""}`}
							onClick={() => setActiveTab("cancelled")}
						>
							Cancelled ({cancelledBookings.length})
						</button>
					</div>
				</div>

				<div className="bookings-content">
					{isLoading ? (
						<div className="loading-state">
							<div className="spinner"></div>
							<p>Loading bookings...</p>
						</div>
					) : (
						(() => {
							let displayBookings = []
							let emptyMessage = { title: "", message: "" }

							switch (activeTab) {
								case "all":
									displayBookings = allBookings
									emptyMessage = {
										title: "No Bookings",
										message: "Your bookings will appear here",
									}
									break
								case "upcoming":
									displayBookings = upcomingTrips
									emptyMessage = {
										title: "No Upcoming Trips",
										message: "Start planning your next adventure!",
									}
									break
								case "pending":
									displayBookings = pendingBookings
									emptyMessage = {
										title: "No Pending Bookings",
										message: "Your pending bookings will appear here",
									}
									break
								case "previous":
									displayBookings = previousBookings
									emptyMessage = {
										title: "No Previous Bookings",
										message: "Your past trips will appear here",
									}
									break
								case "cancelled":
									displayBookings = cancelledBookings
									emptyMessage = {
										title: "No Cancelled Bookings",
										message: "Cancelled bookings will appear here",
									}
									break
								default:
									displayBookings = allBookings
									emptyMessage = {
										title: "No Bookings",
										message: "Your bookings will appear here",
									}
							}

							return displayBookings.length > 0 ? (
								<div className="bookings-grid">
									{displayBookings.map((booking) => renderBookingCard(booking))}
								</div>
							) : (
								<div className="empty-state">
									<FaCalendarAlt className="empty-icon" />
									<h3>{emptyMessage.title}</h3>
									<p>{emptyMessage.message}</p>
									{activeTab === "upcoming" && (
										<button
											className="browse-btn"
											onClick={() => navigate("/dashboardGuest")}
										>
											Browse Properties
										</button>
									)}
								</div>
							)
						})()
					)}
				</div>
			</div>

			{/* Invoice Modal */}
			{showInvoiceModal && selectedBooking && (
				<div
					className="modal-overlay"
					onClick={() => setShowInvoiceModal(false)}
				>
					<div
						className="modal-content invoice-modal"
						onClick={(e) => e.stopPropagation()}
					>
						<button
							className="close-modal-btn"
							onClick={() => setShowInvoiceModal(false)}
						>
							<FaTimes />
						</button>

						<div className="invoice-header">
							<div className="invoice-header-content">
								<FaReceipt className="invoice-icon" />
								<div>
									<h2>Booking Invoice</h2>
									<p className="invoice-id">ID: {selectedBooking.id}</p>
								</div>
							</div>
							{getStatusBadge(selectedBooking)}
						</div>

						<div className="invoice-divider"></div>

						<div className="invoice-property-section">
							<div
								className="invoice-property-image"
								style={{
									backgroundImage: `url(${
										selectedBooking.propertyImage || housePlaceholder
									})`,
								}}
							></div>
							<div className="invoice-property-info">
								<h3>{selectedBooking.propertyTitle}</h3>
								{selectedBooking.propertyLocation && (
									<div className="invoice-location">
										<FaMapMarkerAlt />
										<span>{selectedBooking.propertyLocation}</span>
									</div>
								)}
							</div>
						</div>

						<div className="invoice-divider"></div>

						<div className="invoice-details-section">
							<h3 className="section-title">Booking Details</h3>
							<div className="invoice-details-grid">
								<div className="invoice-detail-item">
									<span className="detail-label">
										<FaCalendarAlt /> Check-in
									</span>
									<span className="detail-value">
										{formatDate(selectedBooking.checkInDate)}
									</span>
								</div>
								<div className="invoice-detail-item">
									<span className="detail-label">
										<FaCalendarAlt /> Check-out
									</span>
									<span className="detail-value">
										{formatDate(selectedBooking.checkOutDate)}
									</span>
								</div>
								<div className="invoice-detail-item">
									<span className="detail-label">
										<FaUsers /> Guests
									</span>
									<span className="detail-value">
										{selectedBooking.numberOfGuests}
									</span>
								</div>
								<div className="invoice-detail-item">
									<span className="detail-label">
										<FaClock /> Nights
									</span>
									<span className="detail-value">
										{selectedBooking.numberOfNights}
									</span>
								</div>
							</div>
						</div>

						<div className="invoice-divider"></div>

						<div className="invoice-pricing-section">
							<h3 className="section-title">Payment Summary</h3>
							<div className="pricing-breakdown">
								<div className="pricing-row">
									<span>
										{formatCurrency(
											selectedBooking.pricing?.pricePerNight || 0
										)}{" "}
										× {selectedBooking.numberOfNights} nights
									</span>
									<span>
										{formatCurrency(selectedBooking.pricing?.subtotal || 0)}
									</span>
								</div>
								<div className="pricing-row">
									<span>Cleaning Fee</span>
									<span>
										{formatCurrency(selectedBooking.pricing?.cleaningFee || 0)}
									</span>
								</div>
								<div className="pricing-row">
									<span>Service Fee</span>
									<span>
										{formatCurrency(selectedBooking.pricing?.serviceFee || 0)}
									</span>
								</div>
								<div className="pricing-row total-row">
									<span>
										<FaMoneyBillWave /> Total
									</span>
									<span className="total-price">
										{formatCurrency(selectedBooking.pricing?.total || 0)}
									</span>
								</div>
							</div>
						</div>

						<div className="invoice-divider"></div>

						<div className="invoice-payment-section">
							<div className="payment-method-badge">
								<FaCheckCircle />
								<span>
									Paid via{" "}
									{selectedBooking.paymentMethod === "wallet"
										? "E-Wallet"
										: "PayPal"}
								</span>
							</div>
							<div className="invoice-date">
								<span>
									Booked on: {formatDateTime(selectedBooking.createdAt)}
								</span>
							</div>
						</div>

						<div className="invoice-footer">
							<p>Thank you for booking with AuraStays!</p>
							<p className="invoice-footer-note">
								For any inquiries, please contact our support team.
							</p>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
