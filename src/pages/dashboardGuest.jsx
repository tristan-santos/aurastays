import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import { db } from "../components/firebaseConfig"
import {
	collection,
	getDocs,
	doc,
	getDoc,
	updateDoc,
	arrayUnion,
	arrayRemove,
} from "firebase/firestore"
import { toast } from "react-stacked-toast"
import "../css/DashboardGuest.css"
import logoPlain from "../assets/logoPlain.png"
import housePlaceholder from "../assets/housePlaceholder.png"
import {
	FaSearch,
	FaHeart,
	FaBars,
	FaUser,
	FaSignOutAlt,
	FaCog,
	FaBell,
	FaPlus,
	FaMapMarkerAlt,
	FaCalendarAlt,
	FaBookmark,
} from "react-icons/fa"

export default function DashboardGuest() {
	const navigate = useNavigate()
	const { currentUser, userData, logout } = useAuth()
	const [searchQuery, setSearchQuery] = useState("")
	const [isMenuOpen, setIsMenuOpen] = useState(false)
	const [activeCategory, setActiveCategory] = useState("home")
	const [properties, setProperties] = useState([])
	const [filteredProperties, setFilteredProperties] = useState([])
	const [popularProperties, setPopularProperties] = useState([])
	const [isLoading, setIsLoading] = useState(true)
	const [userStats, setUserStats] = useState({
		totalBookings: 0,
		upcomingTrips: 0,
		eWallet: 0,
		wishlistItems: 0,
	})
	const [favorites, setFavorites] = useState([])

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

	// Fetch properties from Firebase
	useEffect(() => {
		const fetchData = async () => {
			await fetchProperties()
			await fetchUserStats()
			await fetchUserFavorites()
		}
		fetchData()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentUser])

	// Filter properties by category
	useEffect(() => {
		if (properties.length > 0) {
			const filtered = properties.filter((p) => p.category === activeCategory)
			setFilteredProperties(filtered)
		}
	}, [activeCategory, properties])

	const fetchProperties = async () => {
		try {
			setIsLoading(true)
			const propertiesRef = collection(db, "properties")
			const snapshot = await getDocs(propertiesRef)

			const propertiesList = snapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			}))

			setProperties(propertiesList)

			// Get popular properties (high ratings and reviews)
			const popular = propertiesList
				.filter((p) => p.rating >= 4.8)
				.sort((a, b) => b.reviewsCount - a.reviewsCount)
				.slice(0, 8)
			setPopularProperties(popular)

			// Set initial filtered properties (homes)
			const homes = propertiesList.filter((p) => p.category === "home")
			setFilteredProperties(homes)

			console.log("✅ Fetched properties:", propertiesList.length)
		} catch (error) {
			console.error("Error fetching properties:", error)
			toast.error("Failed to load properties")
		} finally {
			setIsLoading(false)
		}
	}

	const fetchUserStats = async () => {
		if (!currentUser?.uid) return

		try {
			const userDoc = await getDoc(doc(db, "users", currentUser.uid))
			if (userDoc.exists()) {
				const data = userDoc.data()
				setUserStats({
					totalBookings: data.totalBookings || 0,
					upcomingTrips: data.upcomingTrips || 0,
					eWallet: data.totalSpent || 0,
					wishlistItems: data.wishlistItems || 0,
				})
			}
		} catch (error) {
			console.error("Error fetching user stats:", error)
		}
	}

	const fetchUserFavorites = async () => {
		if (!currentUser?.uid) return

		try {
			const userDoc = await getDoc(doc(db, "users", currentUser.uid))
			if (userDoc.exists()) {
				const data = userDoc.data()
				setFavorites(data.favorites || [])
			}
		} catch (error) {
			console.error("Error fetching favorites:", error)
		}
	}

	const toggleFavorite = async (propertyId) => {
		if (!currentUser?.uid) {
			toast.error("Please login to add favorites")
			return
		}

		try {
			const userDocRef = doc(db, "users", currentUser.uid)
			const isFavorite = favorites.includes(propertyId)

			if (isFavorite) {
				// Remove from favorites
				await updateDoc(userDocRef, {
					favorites: arrayRemove(propertyId),
					wishlistItems: Math.max(0, (userStats.wishlistItems || 0) - 1),
				})
				setFavorites(favorites.filter((id) => id !== propertyId))
				setUserStats({
					...userStats,
					wishlistItems: Math.max(0, userStats.wishlistItems - 1),
				})
				toast.success("Removed from wishlist")
			} else {
				// Add to favorites
				await updateDoc(userDocRef, {
					favorites: arrayUnion(propertyId),
					wishlistItems: (userStats.wishlistItems || 0) + 1,
				})
				setFavorites([...favorites, propertyId])
				setUserStats({
					...userStats,
					wishlistItems: userStats.wishlistItems + 1,
				})
				toast.success("Added to wishlist")
			}
		} catch (error) {
			console.error("Error toggling favorite:", error)
			toast.error("Failed to update wishlist")
		}
	}

	const handleCategoryChange = (category) => {
		setActiveCategory(category)
	}

	const handleSearch = (e) => {
		e.preventDefault()
		console.log("Searching for:", searchQuery)
		// TODO: Implement search functionality
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

	const formatPrice = (price, currency = "PHP") => {
		if (currency === "PHP") {
			return `₱${price.toLocaleString()}`
		}
		return `$${price.toLocaleString()}`
	}

	const getPropertyTypeName = (property) => {
		if (property.category === "home") {
			return property.propertyType || "Property"
		} else if (property.category === "experience") {
			return property.experienceType || "Experience"
		} else if (property.category === "service") {
			return property.serviceType || "Service"
		}
		return "Listing"
	}

	return (
		<div className="dashboard-guest-container">
			{/* Top Navigation Bar */}
			<nav className="top-navbar">
				{/* Logo */}
				<div className="navbar-logo">
					<img src={logoPlain} alt="AuraStays" />
					<span className="logo-text">AuraStays</span>
				</div>

				{/* Search Bar */}
				<form className="navbar-search" onSubmit={handleSearch}>
					<FaSearch className="search-icon" />
					<input
						type="text"
						placeholder="Search destinations, hotels, experiences..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
					/>
				</form>

				{/* Right Section */}
				<div className="navbar-right">
					{/* Notifications */}
					<button className="icon-button notifications-btn">
						<FaBell />
						<span className="badge">0</span>
					</button>

					{/* Favorites */}
					<button className="icon-button favorites-btn">
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
								{currentUser?.photoURL ? (
									<img src={currentUser.photoURL} alt={displayName} />
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
										{currentUser?.photoURL ? (
											<img src={currentUser.photoURL} alt={displayName} />
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
									onClick={() => navigate("/profile")}
								>
									<FaUser />
									<span>My Profile</span>
								</button>
								<button className="dropdown-item">
									<FaHeart />
									<span>Favorites</span>
								</button>
								<button className="dropdown-item">
									<FaCog />
									<span>Settings</span>
								</button>

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

			{/* Main Content */}
			<main className="dashboard-main">
				<div className="hero-section">
					<h1>Welcome back, {displayName.split(" ")[0]}! 👋</h1>
					<p>Ready to find your next adventure?</p>

					{/* Quick Actions */}
					<div className="quick-actions">
						<button className="action-btn">
							<FaSearch />
							<span>Search Stays</span>
						</button>
						<button className="action-btn">
							<FaMapMarkerAlt />
							<span>Explore Map</span>
						</button>
						<button className="action-btn">
							<FaBookmark />
							<span>Wishlist</span>
						</button>
					</div>
				</div>

				{/* Quick Stats */}
				<div className="quick-stats">
					<div className="stat-card">
						<div className="stat-icon">📋</div>
						<div className="stat-info">
							<div className="stat-number">{userStats.totalBookings}</div>
							<div className="stat-label">Previous Bookings</div>
						</div>
					</div>
					<div className="stat-card">
						<div className="stat-icon">✈️</div>
						<div className="stat-info">
							<div className="stat-number">{userStats.upcomingTrips}</div>
							<div className="stat-label">Upcoming Trips</div>
						</div>
					</div>
					<div className="stat-card">
						<div className="stat-icon">💳</div>
						<div className="stat-info">
							<div className="stat-number">₱{userStats.eWallet.toFixed(2)}</div>
							<div className="stat-label">E-Wallet</div>
						</div>
					</div>
				</div>

				{/* Promotional Banner */}
				<section className="promo-banner">
					<div className="promo-content">
						<div className="promo-text">
							<h3>✨ Special Weekend Offer!</h3>
							<p>Get up to 30% off on selected properties this weekend</p>
						</div>
						<button className="promo-btn">
							<FaPlus />
							<span>View Deals</span>
						</button>
					</div>
				</section>

				{/* Recent Searches */}
				<section className="recent-section">
					<div className="section-header">
						<h3>Recent Searches</h3>
						<button className="view-all-btn">View All</button>
					</div>
					<div className="recent-searches">
						{["Boracay", "Palawan", "Siargao", "Baguio"].map((place, index) => (
							<div key={index} className="search-chip">
								<FaMapMarkerAlt className="chip-icon" />
								<span>{place}</span>
							</div>
						))}
					</div>
				</section>

				{/* Browse Categories */}
				<section className="categories-section">
					<h2>Browse by Category</h2>
					<p className="section-subtitle">
						Discover amazing places and experiences
					</p>

					<div className="category-tabs">
						<button
							className={`category-tab ${
								activeCategory === "home" ? "active" : ""
							}`}
							onClick={() => handleCategoryChange("home")}
						>
							<span className="tab-icon">🏠</span>
							<span className="tab-label">Homes</span>
						</button>
						<button
							className={`category-tab ${
								activeCategory === "experience" ? "active" : ""
							}`}
							onClick={() => handleCategoryChange("experience")}
						>
							<span className="tab-icon">✨</span>
							<span className="tab-label">Experiences</span>
						</button>
						<button
							className={`category-tab ${
								activeCategory === "service" ? "active" : ""
							}`}
							onClick={() => handleCategoryChange("service")}
						>
							<span className="tab-icon">🛎️</span>
							<span className="tab-label">Services</span>
						</button>
					</div>

					{/* Category Content */}
					<div className="category-content">
						{isLoading ? (
							<div className="loading-container">
								<div className="loading-spinner"></div>
								<p>Loading properties...</p>
							</div>
						) : filteredProperties.length === 0 ? (
							<div className="no-results">
								<p>No properties found in this category</p>
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
										>
											<button
												className={`favorite-icon ${
													favorites.includes(property.id) ? "active" : ""
												}`}
												onClick={() => toggleFavorite(property.id)}
											>
												<FaHeart />
											</button>
											{property.featured && (
												<span className="listing-badge">Featured</span>
											)}
										</div>
										<div className="listing-content">
											<div className="listing-header">
												<h3 className="listing-title">{property.title}</h3>
												<div className="listing-rating">
													<span className="star">⭐</span>
													<span className="rating-text">{property.rating}</span>
													<span className="reviews-count">
														({property.reviewsCount})
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

											{/* Property Type */}
											<div className="listing-type">
												<span className="type-badge">
													{getPropertyTypeName(property)}
												</span>
											</div>

											{/* Details for Homes */}
											{property.category === "home" && property.capacity && (
												<div className="listing-details">
													<div className="detail-item">
														<span className="detail-icon">🛏️</span>
														<span className="detail-text">
															{property.capacity.beds} beds
														</span>
													</div>
													<div className="detail-item">
														<span className="detail-icon">🛁</span>
														<span className="detail-text">
															{property.capacity.bathrooms} bath
														</span>
													</div>
													<div className="detail-item">
														<span className="detail-icon">👥</span>
														<span className="detail-text">
															{property.capacity.guests} guests
														</span>
													</div>
												</div>
											)}

											{/* Details for Experiences */}
											{property.category === "experience" &&
												property.duration && (
													<div className="listing-details">
														<div className="detail-item">
															<span className="detail-icon">⏰</span>
															<span className="detail-text">
																{property.duration.hours}h
															</span>
														</div>
														<div className="detail-item">
															<span className="detail-icon">👥</span>
															<span className="detail-text">
																{property.capacity.minGuests}-
																{property.capacity.maxGuests} guests
															</span>
														</div>
													</div>
												)}

											{/* Details for Services */}
											{property.category === "service" && (
												<div className="listing-details">
													<div className="detail-item">
														<span className="detail-icon">📍</span>
														<span className="detail-text">
															{property.location.serviceable
																? "Multiple Locations"
																: property.location.city}
														</span>
													</div>
												</div>
											)}

											<div className="listing-footer">
												<div className="listing-price">
													<span className="price-amount">
														{formatPrice(
															property.pricing?.basePrice ||
																property.pricing?.price ||
																0,
															property.pricing?.currency
														)}
													</span>
													<span className="price-period">
														{property.category === "home"
															? "/ night"
															: property.category === "experience"
															? "/ person"
															: ""}
													</span>
												</div>
												<button className="view-btn">View Details</button>
											</div>
										</div>
									</div>
								))}
							</div>
						)}
					</div>
				</section>

				{/* Popular This Week */}
				<section className="popular-section">
					<div className="section-header">
						<h3>🔥 Popular This Week</h3>
						<button className="view-all-btn">View All</button>
					</div>
					<div className="popular-scroll">
						{isLoading ? (
							<p>Loading...</p>
						) : (
							popularProperties.map((property) => (
								<div key={property.id} className="popular-card">
									<div
										className="popular-image"
										style={{
											backgroundImage: `url(${
												property.images?.[0] || housePlaceholder
											})`,
											backgroundSize: "cover",
											backgroundPosition: "center",
										}}
									>
										{property.rating >= 4.8 && (
											<span className="trending-badge">Trending</span>
										)}
									</div>
									<div className="popular-info">
										<h4 className="popular-title">{property.title}</h4>
										<div className="popular-rating">
											<span>⭐</span>
											<span className="rating">{property.rating}</span>
											<span className="reviews">({property.reviewsCount})</span>
										</div>
										<div className="popular-price">
											{formatPrice(
												property.pricing?.basePrice ||
													property.pricing?.price ||
													0,
												property.pricing?.currency
											)}
											<span>
												{property.category === "home"
													? "/night"
													: property.category === "experience"
													? "/person"
													: ""}
											</span>
										</div>
									</div>
								</div>
							))
						)}
					</div>
				</section>

				{/* Tips Section */}
				<section className="tips-section">
					<h3>✨ Travel Tips</h3>
					<div className="tips-grid">
						<div className="tip-card">
							<div className="tip-icon">📱</div>
							<h4>Book in Advance</h4>
							<p>Save up to 20% by booking early</p>
						</div>
						<div className="tip-card">
							<div className="tip-icon">💰</div>
							<h4>Flexible Dates</h4>
							<p>Get better deals on weekdays</p>
						</div>
						<div className="tip-card">
							<div className="tip-icon">🎯</div>
							<h4>Verified Hosts</h4>
							<p>Choose hosts with verified badges</p>
						</div>
					</div>
				</section>
			</main>
		</div>
	)
}
