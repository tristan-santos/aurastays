import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import { db } from "../components/firebaseConfig"
import {
	collection,
	getDocs,
	query,
	where,
	doc,
	getDoc,
	updateDoc,
} from "firebase/firestore"
import {
	FaCalendarAlt,
	FaHome,
	FaUsers,
	FaBars,
	FaUser,
	FaSignOutAlt,
	FaEnvelope,
	FaCrown,
} from "react-icons/fa"
import { toast } from "react-stacked-toast"
import "../css/DashboardHost.css"
import housePlaceholder from "../assets/housePlaceholder.png"
import logoPlain from "../assets/logoPlain.png"

export default function HostBookings() {
	const { currentUser, userData, logout } = useAuth()
	const navigate = useNavigate()
	const [loading, setLoading] = useState(true)
	const [properties, setProperties] = useState([])
	const [bookingsByPropertyId, setBookingsByPropertyId] = useState({})
	const [activeCategory, setActiveCategory] = useState("all")
	const [isMenuOpen, setIsMenuOpen] = useState(false)
	const [theme, setTheme] = useState(localStorage.getItem("theme") || "light")
	const [userSubscription, setUserSubscription] = useState(null)

	// Get user's display name
	const displayName =
		userData?.displayName || currentUser?.displayName || "Host User"
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

	// Close menu when clicking outside
	useEffect(() => {
		const handleClickOutside = (event) => {
			if (isMenuOpen && !event.target.closest(".user-menu")) {
				setIsMenuOpen(false)
			}
		}

		document.addEventListener("mousedown", handleClickOutside)
		return () => {
			document.removeEventListener("mousedown", handleClickOutside)
		}
	}, [isMenuOpen])

	// Toggle theme
	const toggleTheme = (newTheme) => {
		setTheme(newTheme)
	}

	const handleLogout = async () => {
		try {
			await logout()
			navigate("/")
		} catch (error) {
			console.error("Error logging out:", error)
		}
	}

	// Get appropriate dashboard route based on user type
	const getDashboardRoute = () => {
		if (!userData?.userType) return "/dashboardHost"
		if (userData.userType === "admin") return "/admin"
		if (userData.userType === "host") return "/dashboardHost"
		return "/dashboardGuest"
	}

	// Fetch user subscription status
	const fetchUserSubscription = async () => {
		if (!currentUser?.uid) return

		try {
			const userDoc = await getDoc(doc(db, "users", currentUser.uid))
			if (userDoc.exists()) {
				const userData = userDoc.data()
				const subscription = userData.subscription || null

				// Check if cancelling subscription has expired
				if (
					subscription &&
					subscription.status === "cancelling" &&
					subscription.expiryDate
				) {
					const expiryDate = subscription.expiryDate.toDate
						? subscription.expiryDate.toDate()
						: new Date(subscription.expiryDate)
					const now = new Date()

					if (expiryDate <= now) {
						// Expired - revert to free plan
						await updateDoc(doc(db, "users", currentUser.uid), {
							subscription: {
								planId: "standard",
								planName: "Standard",
								price: 0,
								status: "active",
								isDefault: true,
								startDate: new Date(),
								nextBillingDate: null,
							},
						})

						setUserSubscription({
							planId: "standard",
							status: "active",
							price: 0,
						})
						return
					}
				}

				setUserSubscription(subscription)
			} else {
				// Default to free plan if no subscription found
				setUserSubscription({
					planId: "standard",
					status: "active",
					price: 0,
				})
			}
		} catch (error) {
			console.error("Error fetching subscription:", error)
			// Default to free plan on error
			setUserSubscription({
				planId: "standard",
				status: "active",
				price: 0,
			})
		}
	}

	// Check if user is in free trial mode
	const isFreeTrial = () => {
		if (!userSubscription || hasPremium()) return false

		// User is in free trial if:
		// 1. On free/standard plan
		// 2. Account created within last 14 days (trial period)
		if (userSubscription.planId === "standard" || !userSubscription.planId) {
			// Use Firebase Auth metadata for account creation time
			if (currentUser?.metadata?.creationTime) {
				const createdAt = new Date(currentUser.metadata.creationTime)
				const now = new Date()
				const daysSinceCreation = (now - createdAt) / (1000 * 60 * 60 * 24)
				return daysSinceCreation <= 14
			}
		}

		return false
	}

	// Check if user has premium subscription
	const hasPremium = () => {
		if (!userSubscription) return false

		// Premium access if:
		// 1. Active premium subscription
		// 2. Cancelling premium subscription that hasn't expired yet
		if (userSubscription.planId === "premium") {
			if (userSubscription.status === "active") {
				return true
			}

			// Check if cancelling subscription is still valid (not expired)
			if (
				userSubscription.status === "cancelling" &&
				userSubscription.expiryDate
			) {
				const expiryDate = userSubscription.expiryDate.toDate
					? userSubscription.expiryDate.toDate()
					: new Date(userSubscription.expiryDate)
				const now = new Date()
				return expiryDate > now // Still has premium access until expiry
			}
		}

		return false
	}

	useEffect(() => {
		if (!currentUser?.uid) return
		loadData()
		fetchUserSubscription()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentUser])

	const loadData = async () => {
		setLoading(true)
		try {
			// 1) Fetch all properties for this host
			const propertiesRef = collection(db, "properties")
			const propertiesQuery = query(
				propertiesRef,
				where("hostId", "==", currentUser.uid)
			)
			const propertiesSnapshot = await getDocs(propertiesQuery)
			const props = propertiesSnapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			}))
			setProperties(props)

			// 2) Fetch bookings for each property (batch by propertyId)
			const bookingsRef = collection(db, "bookings")
			const results = {}
			// Query by hostId to avoid 'in' limitations if many properties
			const bookingsQuery = query(
				bookingsRef,
				where("hostId", "==", currentUser.uid)
			)
			const bookingsSnapshot = await getDocs(bookingsQuery)
			const bookings = bookingsSnapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			}))
			for (const b of bookings) {
				if (!results[b.propertyId]) results[b.propertyId] = []
				results[b.propertyId].push(b)
			}
			// Sort bookings per property by check-in date ascending
			Object.keys(results).forEach((pid) => {
				results[pid].sort((a, b) => {
					return new Date(a.checkInDate) - new Date(b.checkInDate)
				})
			})
			setBookingsByPropertyId(results)
		} catch (e) {
			console.error("Error loading host bookings:", e)
			toast.error("Failed to load bookings")
		} finally {
			setLoading(false)
		}
	}

	const formatDate = (d) => {
		const date = new Date(d)
		return date.toLocaleDateString()
	}

	const filteredProperties =
		activeCategory === "all"
			? properties
			: properties.filter((p) => p.category === activeCategory)

	if (loading) {
		return (
			<div className="host-loading-wrapper">
				<div className="host-loading-spinner"></div>
				<p>Loading bookings...</p>
			</div>
		)
	}

	return (
		<div className="host-dashboard-wrapper">
			{/* Header */}
			<header className="host-dashboard-header">
				<div className="host-header-inner">
					<div className="host-dashboard-title" onClick={() => navigate(getDashboardRoute())} style={{ cursor: "pointer" }}>
						<img src={logoPlain} alt="AuraStays" />
						<span className="logo-text">AuraStays</span>
					</div>
					<div className="host-user-info">
						<span className="host-user-name">{displayName.split(" ")[0]}</span>
						{isFreeTrial() && (
							<span className="host-plan-badge free-trial">
								⏱️ Free Trial
							</span>
						)}
						{userSubscription && !isFreeTrial() && (
							<span
								className={`host-plan-badge ${
									userSubscription.planId === "premium" ? "premium" : "free"
								}`}
							>
								{userSubscription.planId === "premium" && (
									<FaCrown className="plan-icon" />
								)}
								{userSubscription.planId === "premium"
									? "Premium"
									: "Free Plan"}
							</span>
						)}
					</div>
					<div className="host-header-buttons">
						{/* Messages */}
						<button
							className="host-icon-button host-messages-btn"
							title="Messages"
							onClick={() => navigate("/hostMessage")}
						>
							<FaEnvelope />
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
								<div
									className="user-dropdown"
									onClick={(e) => e.stopPropagation()}
								>
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
											navigate("/host/subscription")
											setIsMenuOpen(false)
										}}
									>
										<FaCrown />
										<span>Subscription</span>
									</button>
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
									<div className="dropdown-theme-section">
										<span className="theme-label">THEME</span>
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

									<button
										className="dropdown-item logout"
										onClick={handleLogout}
									>
										<FaSignOutAlt />
										<span>Logout</span>
									</button>
								</div>
							)}
						</div>
					</div>
				</div>
			</header>

			<main className="dashboard-main">
				{/* Page Header */}
				<div className="page-header-section">
					<div className="page-header-content">
						<h1 className="page-title">
							Bookings
						</h1>
						<p className="page-subtitle">
							View and manage all bookings for your properties
						</p>
					</div>
				</div>
				<section className="categories-section">
					<h2>Your Properties and Bookings</h2>
					<p className="section-subtitle">
						View all bookings grouped by your properties
					</p>

					<div className="category-tabs">
						<button
							className={`category-tab ${activeCategory === "all" ? "active" : ""}`}
							onClick={() => setActiveCategory("all")}
						>
							<span className="tab-icon">🌟</span>
							<span className="tab-label">All</span>
						</button>
						<button
							className={`category-tab ${activeCategory === "home" ? "active" : ""}`}
							onClick={() => setActiveCategory("home")}
						>
							<span className="tab-icon">🏠</span>
							<span className="tab-label">Homes</span>
						</button>
						<button
							className={`category-tab ${activeCategory === "service" ? "active" : ""}`}
							onClick={() => setActiveCategory("service")}
						>
							<span className="tab-icon">🛎️</span>
							<span className="tab-label">Services</span>
						</button>
						<button
							className={`category-tab ${activeCategory === "experience" ? "active" : ""}`}
							onClick={() => setActiveCategory("experience")}
						>
							<span className="tab-icon">✨</span>
							<span className="tab-label">Experiences</span>
						</button>
					</div>

					{filteredProperties.length === 0 ? (
						<div className="no-results">
							<p>No properties found.</p>
							<div className="no-results-actions">
								<button
									className="category-create-btn"
									onClick={() => navigate("/host/list-property")}
								>
									<FaHome />
									<span>Create Listing</span>
								</button>
							</div>
						</div>
					) : (
						<div className="listings-grid">
							{filteredProperties.map((property) => {
								const bookings = bookingsByPropertyId[property.id] || []
								return (
									<div key={property.id} className="listing-card">
										<div
											className="listing-image"
											style={{
												backgroundImage: `url(${property.images?.[0] || housePlaceholder})`,
											}}
											onClick={() => navigate(`/property/${property.id}`)}
											title="View property"
										>
											<span className="listing-badge">
												{property.category?.toUpperCase() || "LISTING"}
											</span>
										</div>
										<div className="listing-content">
											<div className="listing-header">
												<h3 className="listing-title">{property.title || "Untitled"}</h3>
												<div className="listing-rating">
													<span className="star">⭐</span>
													<span className="rating-text">{property.rating || 0}</span>
													<span className="reviews-count">
														({property.reviewsCount || 0})
													</span>
												</div>
											</div>
											<div className="listing-type" style={{ marginBottom: "0.5rem" }}>
												<span className="type-badge">
													{property.propertyType || property.type || "Listing"}
												</span>
											</div>

											{bookings.length === 0 ? (
												<div className="host-empty-message" style={{ padding: "0.75rem 0" }}>
													<p>No bookings yet for this property.</p>
												</div>
											) : (
												<div style={{ textAlign: "right", marginTop: "0.5rem" }}>
													<button
														className="view-property-btn"
														onClick={() => navigate(`/propertyBookings/${property.id}`)}
													>
														View all bookings
													</button>
												</div>
											)}
										</div>
									</div>
								)
							})}
						</div>
					)}
				</section>
			</main>
		</div>
	)
}


