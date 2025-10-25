import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import { db } from "../components/firebaseConfig"
import {
	collection,
	getDocs,
	doc,
	updateDoc,
	arrayUnion,
	getDoc,
} from "firebase/firestore"
import { toast } from "react-stacked-toast"
import "../css/Search.css"
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
	FaMapMarkerAlt,
	FaBookmark,
	FaFilter,
	FaTimes,
	FaSlidersH,
} from "react-icons/fa"

export default function Search() {
	const navigate = useNavigate()
	const location = useLocation()
	const { currentUser, userData, logout } = useAuth()
	const [searchQuery, setSearchQuery] = useState("")
	const [isMenuOpen, setIsMenuOpen] = useState(false)
	const [properties, setProperties] = useState([])
	const [filteredProperties, setFilteredProperties] = useState([])
	const [isLoading, setIsLoading] = useState(true)
	const [favorites, setFavorites] = useState([])
	const [wishlist, setWishlist] = useState([])

	// Filter states
	const [selectedCategory, setSelectedCategory] = useState("all")
	const [priceRange, setPriceRange] = useState([0, 50000])
	const [selectedRating, setSelectedRating] = useState(0)
	const [sortBy, setSortBy] = useState("relevance")
	const [showFilters, setShowFilters] = useState(false)

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

	// Get search query from URL or state
	useEffect(() => {
		const params = new URLSearchParams(location.search)
		const query = params.get("q") || location.state?.query || ""
		setSearchQuery(query)
	}, [location])

	// Fetch properties and user data
	useEffect(() => {
		const fetchData = async () => {
			await fetchProperties()
			await fetchUserFavorites()
			await fetchUserWishlist()
		}
		fetchData()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentUser])

	// Filter properties based on search and filters
	useEffect(() => {
		if (properties.length > 0) {
			let filtered = [...properties]

			// Search filter
			if (searchQuery.trim()) {
				const query = searchQuery.toLowerCase()
				filtered = filtered.filter(
					(p) =>
						p.title?.toLowerCase().includes(query) ||
						p.description?.toLowerCase().includes(query) ||
						p.location?.city?.toLowerCase().includes(query) ||
						p.location?.province?.toLowerCase().includes(query) ||
						p.location?.country?.toLowerCase().includes(query)
				)
			}

			// Category filter
			if (selectedCategory !== "all") {
				filtered = filtered.filter((p) => p.category === selectedCategory)
			}

			// Price filter
			filtered = filtered.filter((p) => {
				const price = p.pricing?.basePrice || p.pricing?.price || 0
				return price >= priceRange[0] && price <= priceRange[1]
			})

			// Rating filter
			if (selectedRating > 0) {
				filtered = filtered.filter((p) => p.rating >= selectedRating)
			}

			// Sort
			switch (sortBy) {
				case "price-low":
					filtered.sort(
						(a, b) =>
							(a.pricing?.basePrice || a.pricing?.price || 0) -
							(b.pricing?.basePrice || b.pricing?.price || 0)
					)
					break
				case "price-high":
					filtered.sort(
						(a, b) =>
							(b.pricing?.basePrice || b.pricing?.price || 0) -
							(a.pricing?.basePrice || a.pricing?.price || 0)
					)
					break
				case "rating":
					filtered.sort((a, b) => b.rating - a.rating)
					break
				case "reviews":
					filtered.sort((a, b) => b.reviewsCount - a.reviewsCount)
					break
				default:
					// relevance - keep current order
					break
			}

			setFilteredProperties(filtered)
		}
	}, [
		properties,
		searchQuery,
		selectedCategory,
		priceRange,
		selectedRating,
		sortBy,
	])

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
		} catch (error) {
			console.error("Error fetching properties:", error)
			toast.error("Failed to load properties")
		} finally {
			setIsLoading(false)
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

	const fetchUserWishlist = async () => {
		if (!currentUser?.uid) return

		try {
			const userDoc = await getDoc(doc(db, "users", currentUser.uid))
			if (userDoc.exists()) {
				const data = userDoc.data()
				setWishlist(data.wishlist || [])
			}
		} catch (error) {
			console.error("Error fetching wishlist:", error)
		}
	}

	const handleSearch = async (e) => {
		e.preventDefault()
		if (!searchQuery.trim()) return

		// Save search to Firebase
		if (currentUser?.uid) {
			try {
				const userDocRef = doc(db, "users", currentUser.uid)
				await updateDoc(userDocRef, {
					recentSearches: arrayUnion({
						query: searchQuery.trim(),
						timestamp: new Date().toISOString(),
					}),
				})
			} catch (error) {
				console.error("Error saving search:", error)
			}
		}

		// Update URL
		navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`, {
			replace: true,
		})
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

	const toggleFavorite = async (propertyId) => {
		if (!currentUser?.uid) {
			toast.error("Please login to add favorites")
			return
		}

		try {
			const userDocRef = doc(db, "users", currentUser.uid)
			const isFavorite = favorites.includes(propertyId)

			if (isFavorite) {
				await updateDoc(userDocRef, {
					favorites: favorites.filter((id) => id !== propertyId),
				})
				setFavorites(favorites.filter((id) => id !== propertyId))
				toast.success("Removed from favorites")
			} else {
				await updateDoc(userDocRef, {
					favorites: arrayUnion(propertyId),
				})
				setFavorites([...favorites, propertyId])
				toast.success("Added to favorites")
			}
		} catch (error) {
			console.error("Error toggling favorite:", error)
			toast.error("Failed to update favorites")
		}
	}

	const toggleWishlist = async (propertyId) => {
		if (!currentUser?.uid) {
			toast.error("Please login to add to wishlist")
			return
		}

		try {
			const userDocRef = doc(db, "users", currentUser.uid)
			const isInWishlist = wishlist.includes(propertyId)

			if (isInWishlist) {
				await updateDoc(userDocRef, {
					wishlist: wishlist.filter((id) => id !== propertyId),
				})
				setWishlist(wishlist.filter((id) => id !== propertyId))
				toast.success("Removed from wishlist")
			} else {
				await updateDoc(userDocRef, {
					wishlist: arrayUnion(propertyId),
				})
				setWishlist([...wishlist, propertyId])
				toast.success("Added to wishlist")
			}
		} catch (error) {
			console.error("Error toggling wishlist:", error)
			toast.error("Failed to update wishlist")
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

	const clearFilters = () => {
		setSelectedCategory("all")
		setPriceRange([0, 50000])
		setSelectedRating(0)
		setSortBy("relevance")
	}

	return (
		<div className="search-page-container">
			{/* Top Navigation Bar */}
			<nav className="top-navbar">
				{/* Logo */}
				<div
					className="navbar-logo"
					onClick={() => navigate("/dashboardGuest")}
				>
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
									<FaBookmark />
									<span>Wishlist</span>
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
			<div className="search-content">
				{/* Sidebar Filters */}
				<aside className={`filters-sidebar ${showFilters ? "show" : ""}`}>
					<div className="filters-header">
						<h3>
							<FaFilter /> Filters
						</h3>
						<button className="clear-filters-btn" onClick={clearFilters}>
							Clear All
						</button>
					</div>

					{/* Category Filter */}
					<div className="filter-section">
						<h4>Category</h4>
						<div className="category-filters">
							<button
								className={`category-filter-btn ${
									selectedCategory === "all" ? "active" : ""
								}`}
								onClick={() => setSelectedCategory("all")}
							>
								<span>🌟</span> All
							</button>
							<button
								className={`category-filter-btn ${
									selectedCategory === "home" ? "active" : ""
								}`}
								onClick={() => setSelectedCategory("home")}
							>
								<span>🏠</span> Homes
							</button>
							<button
								className={`category-filter-btn ${
									selectedCategory === "experience" ? "active" : ""
								}`}
								onClick={() => setSelectedCategory("experience")}
							>
								<span>✨</span> Experiences
							</button>
							<button
								className={`category-filter-btn ${
									selectedCategory === "service" ? "active" : ""
								}`}
								onClick={() => setSelectedCategory("service")}
							>
								<span>🛎️</span> Services
							</button>
						</div>
					</div>

					{/* Price Range Filter */}
					<div className="filter-section">
						<h4>Price Range</h4>
						<div className="price-inputs">
							<input
								type="number"
								placeholder="Min"
								value={priceRange[0]}
								onChange={(e) =>
									setPriceRange([parseInt(e.target.value) || 0, priceRange[1]])
								}
							/>
							<span>-</span>
							<input
								type="number"
								placeholder="Max"
								value={priceRange[1]}
								onChange={(e) =>
									setPriceRange([
										priceRange[0],
										parseInt(e.target.value) || 50000,
									])
								}
							/>
						</div>
						<div className="price-display">
							₱{priceRange[0].toLocaleString()} - ₱
							{priceRange[1].toLocaleString()}
						</div>
					</div>

					{/* Rating Filter */}
					<div className="filter-section">
						<h4>Minimum Rating</h4>
						<div className="rating-filters">
							{[5, 4, 3, 2, 1].map((rating) => (
								<button
									key={rating}
									className={`rating-filter-btn ${
										selectedRating === rating ? "active" : ""
									}`}
									onClick={() =>
										setSelectedRating(selectedRating === rating ? 0 : rating)
									}
								>
									<span className="stars">{"⭐".repeat(rating)}</span>
									<span className="rating-text">{rating}+ Stars</span>
								</button>
							))}
						</div>
					</div>
				</aside>

				{/* Results Area */}
				<main className="search-results">
					{/* Results Header */}
					<div className="results-header">
						<div className="results-info">
							<h2>
								{searchQuery
									? `Search results for "${searchQuery}"`
									: "All Properties"}
							</h2>
							<p className="results-count">
								{filteredProperties.length} properties found
							</p>
						</div>

						<div className="results-controls">
							<button
								className="mobile-filter-btn"
								onClick={() => setShowFilters(!showFilters)}
							>
								<FaSlidersH />
								Filters
							</button>

							<select
								className="sort-select"
								value={sortBy}
								onChange={(e) => setSortBy(e.target.value)}
							>
								<option value="relevance">Most Relevant</option>
								<option value="price-low">Price: Low to High</option>
								<option value="price-high">Price: High to Low</option>
								<option value="rating">Highest Rated</option>
								<option value="reviews">Most Reviewed</option>
							</select>
						</div>
					</div>

					{/* Results Grid */}
					{isLoading ? (
						<div className="loading-container">
							<div className="loading-spinner"></div>
							<p>Loading properties...</p>
						</div>
					) : filteredProperties.length === 0 ? (
						<div className="no-results">
							<FaSearch className="no-results-icon" />
							<h3>No properties found</h3>
							<p>Try adjusting your filters or search query</p>
							<button className="clear-filters-btn" onClick={clearFilters}>
								Clear Filters
							</button>
						</div>
					) : (
						<div className="results-grid">
							{filteredProperties.map((property) => (
								<div key={property.id} className="property-card">
									<div
										className="property-image"
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
											<span className="property-badge">Featured</span>
										)}
									</div>
									<div className="property-content">
										<div className="property-header">
											<h3 className="property-title">{property.title}</h3>
											<div className="property-rating">
												<span className="star">⭐</span>
												<span className="rating-text">{property.rating}</span>
												<span className="reviews-count">
													({property.reviewsCount})
												</span>
											</div>
										</div>
										<div className="property-location">
											<FaMapMarkerAlt className="location-icon" />
											<span>
												{property.location?.city}, {property.location?.province}
											</span>
										</div>

										<div className="property-type">
											<span className="type-badge">
												{getPropertyTypeName(property)}
											</span>
										</div>

										{/* Details for different categories */}
										{property.category === "home" && property.capacity && (
											<div className="property-details">
												<div className="detail-item">
													<span>🛏️</span>
													<span>{property.capacity.beds} beds</span>
												</div>
												<div className="detail-item">
													<span>🛁</span>
													<span>{property.capacity.bathrooms} bath</span>
												</div>
												<div className="detail-item">
													<span>👥</span>
													<span>{property.capacity.guests} guests</span>
												</div>
											</div>
										)}

										{property.category === "experience" &&
											property.duration && (
												<div className="property-details">
													<div className="detail-item">
														<span>⏰</span>
														<span>{property.duration.hours}h</span>
													</div>
													<div className="detail-item">
														<span>👥</span>
														<span>
															{property.capacity.minGuests}-
															{property.capacity.maxGuests} guests
														</span>
													</div>
												</div>
											)}

										<div className="property-footer">
											<div className="property-price">
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
											<div className="property-actions">
												<button className="view-btn">View Details</button>
												<button
													className={`wishlist-btn-card ${
														wishlist.includes(property.id) ? "active" : ""
													}`}
													onClick={(e) => {
														e.stopPropagation()
														toggleWishlist(property.id)
													}}
													title="Add to Wishlist"
												>
													<FaBookmark />
												</button>
											</div>
										</div>
									</div>
								</div>
							))}
						</div>
					)}
				</main>
			</div>

			{/* Mobile Filter Overlay */}
			{showFilters && (
				<div
					className="filter-overlay"
					onClick={() => setShowFilters(false)}
				></div>
			)}
		</div>
	)
}
