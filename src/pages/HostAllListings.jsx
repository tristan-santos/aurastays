import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import { db } from "../components/firebaseConfig"
import { collection, getDocs, query, where, doc, getDoc, updateDoc } from "firebase/firestore"
import {
	FaHome,
	FaMapMarkerAlt,
	FaStar,
	FaUsers,
	FaEdit,
	FaTrash,
	FaBars,
	FaUser,
	FaSignOutAlt,
	FaEnvelope,
	FaCrown,
} from "react-icons/fa"
import housePlaceholder from "../assets/housePlaceholder.png"
import logoPlain from "../assets/logoPlain.png"
import "../css/DashboardHost.css"
import "../css/DashboardGuest.css"
import { formatCurrencyFull } from "../utils/currencyFormatter"

export default function HostAllListings() {
	const navigate = useNavigate()
	const location = useLocation()
	const { currentUser, userData, logout } = useAuth()
	const [properties, setProperties] = useState([])
	const [loading, setLoading] = useState(true)
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
		if (currentUser) {
			fetchProperties()
			fetchUserSubscription()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentUser])

	// Set category from navigation state if provided
	useEffect(() => {
		if (location.state?.category) {
			setActiveCategory(location.state.category)
		}
	}, [location.state])

	const fetchProperties = async () => {
		if (!currentUser?.uid) return
		try {
			setLoading(true)
			const propertiesQuery = query(
				collection(db, "properties"),
				where("hostId", "==", currentUser.uid)
			)
			const snapshot = await getDocs(propertiesQuery)
			const propertiesList = snapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			}))
			setProperties(propertiesList)
		} catch (error) {
			console.error("Error fetching properties:", error)
		} finally {
			setLoading(false)
		}
	}

	const filteredProperties =
		activeCategory === "all"
			? properties
			: properties.filter((p) => p.category === activeCategory)

	const formatPrice = (price, currency = "PHP") => {
		if (currency === "PHP") {
			return formatCurrencyFull(price, "₱")
		}
		return formatCurrencyFull(price, "$")
	}

	// Calculate best voucher discount for a property (for listing cards)
	const getBestVoucherDiscount = (property) => {
		if (!property?.vouchers || !property.vouchers.types || !Array.isArray(property.vouchers.types)) {
			return { discount: 0, discountedPrice: property?.pricing?.basePrice || property?.pricing?.price || 0 }
		}

		const basePrice = property?.pricing?.basePrice || property?.pricing?.price || 0
		let bestDiscount = 0
		const now = new Date()

		// Check all voucher types
		property.vouchers.types.forEach((voucherType) => {
			const voucherDetails = property.vouchers.details?.[voucherType]
			if (!voucherDetails) return

			// Check if voucher is active
			const isActive = voucherDetails.isActive !== undefined
				? typeof voucherDetails.isActive === "boolean"
					? voucherDetails.isActive
					: String(voucherDetails.isActive).toLowerCase() === "true"
				: true

			if (!isActive) return

			// For listing cards, we show vouchers that are currently valid (if they have dates)
			// or always show if no dates specified
			if (voucherDetails.startDate && voucherDetails.endDate) {
				const voucherStart = new Date(voucherDetails.startDate)
				const voucherEnd = new Date(voucherDetails.endDate)
				// Only show if current date is within voucher date range
				if (now < voucherStart || now > voucherEnd) {
					return
				}
			}

			// Calculate discount per night
			let discount = 0
			const discountType = voucherDetails.discountType || "percent"
			const discountValue = parseFloat(voucherDetails.discount || voucherDetails.discountValue || 0)

			if (discountType === "percent" || discountType === "percentage") {
				discount = (basePrice * discountValue) / 100
				// Check max discount if specified
				if (voucherDetails.maxDiscount && discount > voucherDetails.maxDiscount) {
					discount = voucherDetails.maxDiscount
				}
			} else {
				discount = discountValue
			}

			// Keep the voucher with the highest discount
			if (discount > bestDiscount) {
				bestDiscount = discount
			}
		})

		const discountedPrice = Math.max(0, basePrice - bestDiscount)
		return { discount: bestDiscount, discountedPrice }
	}

	const getPropertyTypeName = (property) => {
		if (property.propertyType) {
			return property.propertyType
				.split("_")
				.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
				.join(" ")
		}
		return property.category || "Property"
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

			{/* Main Content */}
			<main className="dashboard-main">
				{/* Page Header */}
				<div className="page-header-section">
					<div className="page-header-content">
						<h1 className="page-title">All My Listings</h1>
						<p className="page-subtitle">
							Manage and view all your properties in one place
						</p>
					</div>
					<button
						className="add-property-btn"
						onClick={() => navigate("/host/list-property")}
					>
						<FaHome />
						<span>Add New Property</span>
					</button>
				</div>

				<div className="dashboard-content">
				{/* Category Tabs */}
				<div className="category-tabs">
					<button
						className={`category-tab ${activeCategory === "all" ? "active" : ""}`}
						onClick={() => setActiveCategory("all")}
					>
						<span className="tab-icon">🏠</span>
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

				{/* Listings Grid */}
				{loading ? (
					<div className="loading-container">
						<div className="loading-spinner"></div>
						<p>Loading listings...</p>
					</div>
				) : filteredProperties.length === 0 ? (
					<div className="no-results">
						<p>
							No properties found in{" "}
							{activeCategory === "home"
								? "Homes"
								: activeCategory === "service"
								? "Services"
								: activeCategory === "experience"
								? "Experiences"
								: "this category"}
							.
						</p>
					</div>
				) : (
					<div className="listings-grid">
						{filteredProperties.map((property) => (
							<div key={property.id} className="listing-card">
								<div
									className="listing-image"
									style={{
										backgroundImage: `url(${
											property.images?.[0] || housePlaceholder
										})`,
									}}
									onClick={() => navigate(`/property/${property.id}`)}
								>
									{property.featured && (
										<span className="listing-badge">Featured</span>
									)}
								</div>
								<div className="listing-content">
									<div className="listing-header">
										<h3 className="listing-title">{property.title}</h3>
										<div className="listing-rating">
											<span className="star">⭐</span>
											<span className="rating-text">
												{property.rating || 0}
											</span>
											<span className="reviews-count">
												({property.reviewsCount || 0})
											</span>
										</div>
									</div>
									<div className="listing-location">
										<FaMapMarkerAlt className="location-icon" />
										<span>
											{property.location?.city},{" "}
											{property.location?.province}
										</span>
									</div>

									<div className="listing-type">
										<span className="type-badge">
											{getPropertyTypeName(property)}
										</span>
									</div>

									{property.category === "home" && property.capacity && (
										<div className="listing-details">
											{property.capacity.bedrooms > 0 && (
												<div className="detail-item">
													<span className="listing-icon">🚪</span>
													<span className="detail-text">
														{property.capacity.bedrooms}{" "}
														{property.capacity.bedrooms === 1
															? "bedroom"
															: "bedrooms"}
													</span>
												</div>
											)}
											<div className="detail-item">
												<span className="listing-icon">🛏️</span>
												<span className="detail-text">
													{property.capacity.beds || 0}{" "}
													{property.capacity.beds === 1 ? "bed" : "beds"}
												</span>
											</div>
											<div className="detail-item">
												<span className="listing-icon">🛁</span>
												<span className="detail-text">
													{property.capacity.bathrooms || 0}{" "}
													{property.capacity.bathrooms === 1
														? "bath"
														: "baths"}
												</span>
											</div>
											<div className="detail-item">
												<span className="listing-icon">👥</span>
												<span className="detail-text">
													{property.capacity.guests || 0}{" "}
													{property.capacity.guests === 1 ? "guest" : "guests"}
												</span>
											</div>
										</div>
									)}

									{property.category === "experience" && property.duration && (
										<div className="listing-details">
											<div className="detail-item">
												<span className="listing-icon">⏰</span>
												<span className="detail-text">
													{property.duration.hours}h
												</span>
											</div>
											<div className="detail-item">
												<span className="listing-icon">👥</span>
												<span className="detail-text">
													{property.capacity?.minGuests ||
														property.capacity?.guests ||
														0}
													-
													{property.capacity?.maxGuests ||
														property.capacity?.guests ||
														0}{" "}
													{property.capacity?.maxGuests === 1
														? "guest"
														: "guests"}
												</span>
											</div>
										</div>
									)}

									{property.category === "service" && (
										<div className="listing-details">
											<div className="detail-item">
												<span className="listing-icon">📍</span>
												<span className="detail-text">
													{property.location?.serviceable
														? "Multiple Locations"
														: property.location?.city || "Location"}
												</span>
											</div>
										</div>
									)}

									<div className="listing-footer">
										<div className="listing-price">
											{(() => {
												const basePrice = property.pricing?.basePrice || property.pricing?.price || 0
												const { discount, discountedPrice } = getBestVoucherDiscount(property)
												const hasDiscount = discount > 0 && discountedPrice < basePrice
												
												return (
													<>
														{hasDiscount ? (
															<>
																<div className="listing-price-original">
																	<span className="listing-price-amount original-price">
																		{formatPrice(basePrice, property.pricing?.currency)}
																	</span>
																</div>
																<div className="listing-price-discounted">
																	<span className="listing-price-amount discounted-price">
																		{formatPrice(discountedPrice, property.pricing?.currency)}
																	</span>
																</div>
															</>
														) : (
														<>
															<span className="listing-price-amount">
																{formatPrice(basePrice, property.pricing?.currency)}
															</span>
														</>
														)}
													</>
												)
											})()}
										</div>
										<div className="listing-actions">
											<button
												className="view-btn"
												onClick={() => navigate(`/property/${property.id}`)}
											>
												View Details
											</button>
										</div>
									</div>
								</div>
							</div>
						))}
					</div>
				)}
				</div>
			</main>
		</div>
	)
}



