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
	query,
	where,
	addDoc,
} from "firebase/firestore"
import { toast } from "react-stacked-toast"
import Wallet from "../components/Wallet"
import Promos from "../components/Promos"
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
	FaGift,
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
	const [wishlist, setWishlist] = useState([])
	const [showFavoritesModal, setShowFavoritesModal] = useState(false)
	const [favoriteProperties, setFavoriteProperties] = useState([])
	const [favoritesCategory, setFavoritesCategory] = useState("all")
	const [recentSearches, setRecentSearches] = useState([])
	const [showWalletModal, setShowWalletModal] = useState(false)
	const [theme, setTheme] = useState(localStorage.getItem("theme") || "light")
	const [showBookingsModal, setShowBookingsModal] = useState(false)
	const [bookingsModalType, setBookingsModalType] = useState("upcoming") // 'upcoming' or 'previous'
	const [bookingsList, setBookingsList] = useState({
		upcoming: [],
		previous: [],
	})
	const [showWishlistModal, setShowWishlistModal] = useState(false)
	const [wishlistProperties, setWishlistProperties] = useState([])
	const [wishlistCategory, setWishlistCategory] = useState("all")
	const [showPromosModal, setShowPromosModal] = useState(false)
	const [showReviewModal, setShowReviewModal] = useState(false)
	const [selectedBookingForReview, setSelectedBookingForReview] = useState(null)
	const [reviewData, setReviewData] = useState({
		rating: 5,
		cleanliness: 5,
		accuracy: 5,
		communication: 5,
		location: 5,
		checkIn: 5,
		value: 5,
		comment: "",
		feedback: "",
		suggestions: "",
	})

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

	// Fetch properties from Firebase
	useEffect(() => {
		const fetchData = async () => {
			await fetchProperties()
			await fetchUserStats()
			await fetchUserFavorites()
			await fetchUserWishlist()
			await fetchRecentSearches()
		}
		fetchData()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentUser])

	// Filter properties by category
	useEffect(() => {
		if (properties.length > 0) {
			const filtered = properties.filter((p) => p.category === activeCategory)
			setFilteredProperties(filtered)

			// Update favorite properties when properties change
			if (favorites.length > 0) {
				const favProps = properties.filter((prop) =>
					favorites.includes(prop.id)
				)
				setFavoriteProperties(favProps)
			}
		}
	}, [activeCategory, properties, favorites])

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
			// Fetch user data
			const userDoc = await getDoc(doc(db, "users", currentUser.uid))
			let walletBalance = 0
			if (userDoc.exists()) {
				const data = userDoc.data()
				walletBalance = data.walletBalance || 0
			}

			// Fetch bookings to calculate stats
			let totalBookings = 0
			let upcomingTrips = 0

			try {
				const bookingsQuery = query(
					collection(db, "bookings"),
					where("guestId", "==", currentUser.uid)
				)

				const bookingsSnapshot = await getDocs(bookingsQuery)
				const bookings = bookingsSnapshot.docs.map((doc) => doc.data())

				const today = new Date()
				today.setHours(0, 0, 0, 0)

				// Count total previous bookings
				totalBookings = bookings.filter((booking) => {
					const checkOutDate = new Date(booking.checkOutDate)
					return checkOutDate < today
				}).length

				// Count upcoming trips
				upcomingTrips = bookings.filter((booking) => {
					const checkInDate = new Date(booking.checkInDate)
					return checkInDate >= today
				}).length
			} catch (bookingError) {
				console.log("Bookings collection may not exist yet:", bookingError)
			}

			setUserStats({
				totalBookings,
				upcomingTrips,
				eWallet: walletBalance,
				wishlistItems: 0, // Can be updated from user document if needed
			})
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
				const favoritesIds = data.favorites || []
				setFavorites(favoritesIds)

				// Fetch full property details for favorites
				if (favoritesIds.length > 0 && properties.length > 0) {
					const favProps = properties.filter((prop) =>
						favoritesIds.includes(prop.id)
					)
					setFavoriteProperties(favProps)
				} else {
					setFavoriteProperties([])
				}
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
				})
				const newFavorites = favorites.filter((id) => id !== propertyId)
				setFavorites(newFavorites)
				setFavoriteProperties(
					favoriteProperties.filter((p) => p.id !== propertyId)
				)
				toast.success("Removed from favorites")
			} else {
				// Add to favorites
				await updateDoc(userDocRef, {
					favorites: arrayUnion(propertyId),
				})
				const newFavorites = [...favorites, propertyId]
				setFavorites(newFavorites)
				const property = properties.find((p) => p.id === propertyId)
				if (property) {
					setFavoriteProperties([...favoriteProperties, property])
				}
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
				// Remove from wishlist
				await updateDoc(userDocRef, {
					wishlist: arrayRemove(propertyId),
					wishlistItems: Math.max(0, (userStats.wishlistItems || 0) - 1),
				})
				setWishlist(wishlist.filter((id) => id !== propertyId))
				setUserStats({
					...userStats,
					wishlistItems: Math.max(0, userStats.wishlistItems - 1),
				})
				toast.success("Removed from wishlist")
			} else {
				// Add to wishlist
				await updateDoc(userDocRef, {
					wishlist: arrayUnion(propertyId),
					wishlistItems: (userStats.wishlistItems || 0) + 1,
				})
				setWishlist([...wishlist, propertyId])
				setUserStats({
					...userStats,
					wishlistItems: userStats.wishlistItems + 1,
				})
				toast.success("Added to wishlist")
			}
		} catch (error) {
			console.error("Error toggling wishlist:", error)
			toast.error("Failed to update wishlist")
		}
	}

	const handleCategoryChange = (category) => {
		setActiveCategory(category)
	}

	const fetchRecentSearches = async () => {
		if (!currentUser?.uid) return

		try {
			const userDoc = await getDoc(doc(db, "users", currentUser.uid))
			if (userDoc.exists()) {
				const data = userDoc.data()
				const searches = data.recentSearches || []
				// Get the last 5 searches and sort by timestamp descending
				const sortedSearches = searches
					.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
					.slice(0, 5)
				setRecentSearches(sortedSearches)
			}
		} catch (error) {
			console.error("Error fetching recent searches:", error)
		}
	}

	const handleSearch = async (e) => {
		e.preventDefault()
		if (!searchQuery.trim()) return

		// Save search to Firebase
		if (currentUser?.uid) {
			try {
				const userDocRef = doc(db, "users", currentUser.uid)
				const userDoc = await getDoc(userDocRef)

				if (userDoc.exists()) {
					const userData = userDoc.data()
					let searches = userData.recentSearches || []

					// Check if the exact same query already exists (case-sensitive)
					const existingIndex = searches.findIndex(
						(s) => s.query === searchQuery.trim()
					)

					if (existingIndex !== -1) {
						// Remove the old entry
						searches.splice(existingIndex, 1)
					}

					// Add the new/updated search at the end
					searches.push({
						query: searchQuery.trim(),
						timestamp: new Date().toISOString(),
					})

					// Update Firebase with the modified array
					await updateDoc(userDocRef, {
						recentSearches: searches,
					})

					// Update local state
					await fetchRecentSearches()
				}
			} catch (error) {
				console.error("Error saving search:", error)
			}
		}

		// Navigate to search page
		navigate("/search", { state: { query: searchQuery.trim() } })
	}

	const handleRecentSearchClick = (query) => {
		setSearchQuery(query)
		navigate("/search", { state: { query } })
	}

	const handleLogout = async () => {
		try {
			await logout()
			toast.success("Logged out successfully")
			navigate("/")
			localStorage.clear()
			sessionStorage.clear()
			history.push("/")
			history.go(0)
			window.location.reload()
			window.location.href = "/"
			window.location.reload()
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

	// Fetch bookings and show modal
	const handleShowBookings = async (type) => {
		console.log("🔍 handleShowBookings called with type:", type)
		console.log("🔍 Current user:", currentUser?.uid)

		setBookingsModalType(type)
		setShowBookingsModal(true)
		console.log("🔍 Modal state set to true")

		try {
			console.log("🔍 Fetching bookings from Firebase...")
			const bookingsQuery = query(
				collection(db, "bookings"),
				where("guestId", "==", currentUser.uid)
			)

			const bookingsSnapshot = await getDocs(bookingsQuery)
			console.log(
				"🔍 Bookings snapshot received:",
				bookingsSnapshot.docs.length,
				"documents"
			)

			let bookings = bookingsSnapshot.docs
				.map((doc) => ({
					id: doc.id,
					...doc.data(),
				}))
				.sort((a, b) => {
					// Sort by createdAt in memory (newest first)
					const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0)
					const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0)
					return dateB - dateA
				})

			console.log("🔍 Total bookings fetched:", bookings.length)

			// Fetch property images for each booking
			console.log("🔍 Fetching property images...")
			const bookingsWithImages = await Promise.all(
				bookings.map(async (booking) => {
					try {
						const propertyDoc = await getDoc(
							doc(db, "properties", booking.propertyId)
						)
						if (propertyDoc.exists()) {
							const propertyData = propertyDoc.data()
							return {
								...booking,
								propertyImage: propertyData.images?.[0] || null,
							}
						}
						return booking
					} catch (error) {
						console.error(
							"Error fetching property image for booking:",
							booking.id,
							error
						)
						return booking
					}
				})
			)
			console.log("🔍 Property images fetched")

			const today = new Date()
			today.setHours(0, 0, 0, 0)

			const upcoming = bookingsWithImages.filter((booking) => {
				const checkInDate = new Date(booking.checkInDate)
				return checkInDate >= today
			})

			const previous = bookingsWithImages.filter((booking) => {
				const checkOutDate = new Date(booking.checkOutDate)
				return checkOutDate < today
			})

			console.log("🔍 Upcoming bookings:", upcoming.length)
			console.log("🔍 Previous bookings:", previous.length)

			setBookingsList({ upcoming, previous })
			console.log("🔍 Bookings list state updated")
		} catch (error) {
			console.error("❌ Error fetching bookings:", error)
			setBookingsList({ upcoming: [], previous: [] })
		}
	}

	// Fetch wishlist properties
	const handleShowWishlist = async () => {
		console.log("🔍 handleShowWishlist called")
		console.log("🔍 Current wishlist:", wishlist)
		console.log("🔍 Total properties available:", properties.length)

		setIsMenuOpen(false) // Close dropdown menu
		setShowWishlistModal(true)
		console.log("🔍 Wishlist modal state set to true")

		if (wishlist.length > 0) {
			const wishlistProps = properties.filter((prop) =>
				wishlist.includes(prop.id)
			)
			console.log("🔍 Wishlist properties found:", wishlistProps.length)
			setWishlistProperties(wishlistProps)
		} else {
			console.log("🔍 Wishlist is empty")
			setWishlistProperties([])
		}
	}

	// Quick actions handlers
	const handleSearchStays = () => {
		const searchInput = document.querySelector(".navbar-search input")
		if (searchInput) {
			searchInput.focus()
		}
	}

	const handleExploreMap = () => {
		toast("Map view coming soon!", { type: "info" })
	}

	// Open review modal
	const handleOpenReviewModal = (booking) => {
		setSelectedBookingForReview(booking)
		setShowReviewModal(true)
		// Reset review data
		setReviewData({
			rating: 5,
			cleanliness: 5,
			accuracy: 5,
			communication: 5,
			location: 5,
			checkIn: 5,
			value: 5,
			comment: "",
			feedback: "",
			suggestions: "",
		})
	}

	// Submit review
	const handleSubmitReview = async () => {
		if (!selectedBookingForReview || !currentUser) {
			toast.error("Unable to submit review")
			return
		}

		try {
			const bookingRef = doc(db, "bookings", selectedBookingForReview.id)

			// Calculate overall rating
			const overallRating =
				(reviewData.cleanliness +
					reviewData.accuracy +
					reviewData.communication +
					reviewData.location +
					reviewData.checkIn +
					reviewData.value) /
				6

			const review = {
				...reviewData,
				rating: overallRating,
				reviewerId: currentUser.uid,
				reviewerName: displayName,
				reviewerPhoto: userData?.profilePicture || null,
				propertyId: selectedBookingForReview.propertyId,
				bookingId: selectedBookingForReview.id,
				createdAt: new Date().toISOString(),
			}

			// Update booking with review
			await updateDoc(bookingRef, {
				review: review,
				hasReview: true,
			})

			// Add review to property reviews collection
			await addDoc(collection(db, "reviews"), review)

			toast.success("Review submitted successfully!")
			setShowReviewModal(false)
			setSelectedBookingForReview(null)

			// Refresh bookings
			handleShowBookings(bookingsModalType)
		} catch (error) {
			console.error("Error submitting review:", error)
			toast.error("Failed to submit review")
		}
	}

	// Skip review
	const handleSkipReview = () => {
		setShowReviewModal(false)
		setSelectedBookingForReview(null)
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
					<button
						className="icon-button favorites-btn"
						title="Favorites"
						onClick={() => setShowFavoritesModal(true)}
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
								<button
									className="dropdown-item"
									onClick={() => {
										console.log("🔍 Wishlist dropdown clicked")
										handleShowWishlist()
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

			{/* Main Content */}
			<main className="dashboard-main">
				<div className="hero-section">
					<h1>Welcome back, {displayName.split(" ")[0]}! 👋</h1>
					<p>Ready to find your next adventure?</p>

					{/* Quick Actions */}
					<div className="quick-actions">
						<button className="action-btn" onClick={handleSearchStays}>
							<FaSearch />
							<span>Search Stays</span>
						</button>
						<button className="action-btn" onClick={handleExploreMap}>
							<FaMapMarkerAlt />
							<span>Explore Map</span>
						</button>
						<button className="action-btn" onClick={handleShowWishlist}>
							<FaBookmark />
							<span>Wishlist</span>
						</button>
						<button
							className="action-btn promo-btn"
							onClick={() => setShowPromosModal(true)}
						>
							<FaGift />
							<span>Promos</span>
						</button>
					</div>
				</div>

				{/* Quick Stats */}
				<div className="quick-stats">
					<div
						className="stat-card clickable-stat-card"
						onClick={() => handleShowBookings("previous")}
						style={{ cursor: "pointer" }}
					>
						<div className="stat-icon">📋</div>
						<div className="stat-info">
							<div className="stat-number">{userStats.totalBookings}</div>
							<div className="stat-label">Previous Bookings</div>
						</div>
					</div>
					<div
						className="stat-card clickable-stat-card"
						onClick={() => handleShowBookings("upcoming")}
						style={{ cursor: "pointer" }}
					>
						<div className="stat-icon">✈️</div>
						<div className="stat-info">
							<div className="stat-number">{userStats.upcomingTrips}</div>
							<div className="stat-label">Upcoming Trips</div>
						</div>
					</div>
					<div
						className="stat-card wallet-stat-card"
						onClick={() => setShowWalletModal(true)}
						style={{ cursor: "pointer" }}
					>
						<div className="stat-icon">💳</div>
						<div className="stat-info">
							<div className="stat-number">
								₱{userStats.eWallet.toLocaleString()}
							</div>
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
				{recentSearches.length > 0 && (
					<section className="recent-section">
						<div className="section-header">
							<h3>Recent Searches</h3>
						</div>
						<div className="recent-searches">
							{recentSearches.map((search, index) => (
								<div
									key={index}
									className="search-chip"
									onClick={() => handleRecentSearchClick(search.query)}
									style={{ cursor: "pointer" }}
								>
									<FaMapMarkerAlt className="chip-icon" />
									<span>{search.query}</span>
								</div>
							))}
						</div>
					</section>
				)}

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
							<>
								<div className="listings-grid">
									{filteredProperties.slice(0, 6).map((property) => (
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
														<span className="rating-text">
															{property.rating}
														</span>
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
													<div className="listing-actions">
														<button
															className="view-btn"
															onClick={() =>
																navigate(`/property/${property.id}`)
															}
														>
															View Details
														</button>
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

								{/* View All Button */}
								{filteredProperties.length > 6 && (
									<div className="view-all-container">
										<button
											className="view-all-properties-btn"
											onClick={() =>
												navigate(`/search?category=${activeCategory}`)
											}
										>
											View All {filteredProperties.length} Properties
										</button>
									</div>
								)}
							</>
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
										<button
											className="view-details-btn"
											onClick={() => navigate(`/property/${property.id}`)}
										>
											View Details
										</button>
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

			{/* Wallet Modal */}
			{showWalletModal && (
				<div
					className="modal-overlay wallet-modal-overlay"
					onClick={() => setShowWalletModal(false)}
				>
					<div
						className="modal-content wallet-modal-content"
						onClick={(e) => e.stopPropagation()}
					>
						<button
							className="close-modal-btn"
							onClick={() => setShowWalletModal(false)}
						>
							×
						</button>
						<Wallet />
					</div>
				</div>
			)}

			{/* Favorites Modal */}
			{showFavoritesModal && (
				<div
					className="favorites-modal-overlay"
					onClick={() => setShowFavoritesModal(false)}
				>
					<div
						className="favorites-modal-content"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="favorites-modal-header">
							<h2>
								<FaHeart className="modal-heart-icon" /> My Favorites
							</h2>
							<button
								className="close-modal-btn"
								onClick={() => setShowFavoritesModal(false)}
							>
								×
							</button>
						</div>

						{favoriteProperties.length === 0 ? (
							<div className="empty-favorites">
								<FaHeart className="empty-icon" />
								<h3>No favorites yet</h3>
								<p>Start adding properties to your favorites!</p>
							</div>
						) : (
							<>
								{/* Category Filter Buttons */}
								<div className="favorites-category-filters">
									<button
										className={`filter-btn ${
											favoritesCategory === "all" ? "active" : ""
										}`}
										onClick={() => setFavoritesCategory("all")}
									>
										<span className="filter-icon">🌟</span>
										<span className="filter-label">All</span>
										<span className="filter-count">
											{favoriteProperties.length}
										</span>
									</button>
									<button
										className={`filter-btn ${
											favoritesCategory === "home" ? "active" : ""
										}`}
										onClick={() => setFavoritesCategory("home")}
									>
										<span className="filter-icon">🏠</span>
										<span className="filter-label">Homes</span>
										<span className="filter-count">
											{
												favoriteProperties.filter((p) => p.category === "home")
													.length
											}
										</span>
									</button>
									<button
										className={`filter-btn ${
											favoritesCategory === "experience" ? "active" : ""
										}`}
										onClick={() => setFavoritesCategory("experience")}
									>
										<span className="filter-icon">✨</span>
										<span className="filter-label">Experiences</span>
										<span className="filter-count">
											{
												favoriteProperties.filter(
													(p) => p.category === "experience"
												).length
											}
										</span>
									</button>
									<button
										className={`filter-btn ${
											favoritesCategory === "service" ? "active" : ""
										}`}
										onClick={() => setFavoritesCategory("service")}
									>
										<span className="filter-icon">🛎️</span>
										<span className="filter-label">Services</span>
										<span className="filter-count">
											{
												favoriteProperties.filter(
													(p) => p.category === "service"
												).length
											}
										</span>
									</button>
								</div>

								<div className="favorites-modal-body">
									{/* Homes Section */}
									{(favoritesCategory === "all" ||
										favoritesCategory === "home") &&
										favoriteProperties.filter((p) => p.category === "home")
											.length > 0 && (
											<div className="favorites-category-section">
												<h3 className="favorites-category-title">
													<span className="category-icon">🏠</span> Homes (
													{
														favoriteProperties.filter(
															(p) => p.category === "home"
														).length
													}
													)
												</h3>
												<div className="favorites-grid">
													{favoriteProperties
														.filter((p) => p.category === "home")
														.map((property) => (
															<div key={property.id} className="favorite-card">
																<div
																	className="favorite-image"
																	style={{
																		backgroundImage: `url(${
																			property.images?.[0] || housePlaceholder
																		})`,
																	}}
																>
																	<button
																		className="remove-favorite-btn"
																		onClick={() => toggleFavorite(property.id)}
																		title="Remove from favorites"
																	>
																		<FaHeart />
																	</button>
																</div>
																<div className="favorite-info">
																	<h4 className="favorite-title">
																		{property.title}
																	</h4>
																	<p className="favorite-location">
																		<FaMapMarkerAlt />
																		{property.location?.city},{" "}
																		{property.location?.province}
																	</p>
																	<div className="favorite-rating">
																		<span>⭐</span>
																		<span>{property.rating}</span>
																		<span className="review-count">
																			({property.reviewsCount})
																		</span>
																	</div>
																	<div className="favorite-price">
																		{formatPrice(
																			property.pricing?.basePrice || 0,
																			property.pricing?.currency
																		)}
																		<span className="price-period">
																			/ night
																		</span>
																	</div>
																	<button
																		className="favorite-view-btn"
																		onClick={() =>
																			navigate(`/property/${property.id}`)
																		}
																	>
																		View Details
																	</button>
																</div>
															</div>
														))}
												</div>
											</div>
										)}

									{/* Experiences Section */}
									{(favoritesCategory === "all" ||
										favoritesCategory === "experience") &&
										favoriteProperties.filter(
											(p) => p.category === "experience"
										).length > 0 && (
											<div className="favorites-category-section">
												<h3 className="favorites-category-title">
													<span className="category-icon">✨</span> Experiences
													(
													{
														favoriteProperties.filter(
															(p) => p.category === "experience"
														).length
													}
													)
												</h3>
												<div className="favorites-grid">
													{favoriteProperties
														.filter((p) => p.category === "experience")
														.map((property) => (
															<div key={property.id} className="favorite-card">
																<div
																	className="favorite-image"
																	style={{
																		backgroundImage: `url(${
																			property.images?.[0] || housePlaceholder
																		})`,
																	}}
																>
																	<button
																		className="remove-favorite-btn"
																		onClick={() => toggleFavorite(property.id)}
																		title="Remove from favorites"
																	>
																		<FaHeart />
																	</button>
																</div>
																<div className="favorite-info">
																	<h4 className="favorite-title">
																		{property.title}
																	</h4>
																	<p className="favorite-location">
																		<FaMapMarkerAlt />
																		{property.location?.city},{" "}
																		{property.location?.province}
																	</p>
																	<div className="favorite-rating">
																		<span>⭐</span>
																		<span>{property.rating}</span>
																		<span className="review-count">
																			({property.reviewsCount})
																		</span>
																	</div>
																	<div className="favorite-price">
																		{formatPrice(
																			property.pricing?.price || 0,
																			property.pricing?.currency
																		)}
																		<span className="price-period">
																			/ person
																		</span>
																	</div>
																	<button
																		className="favorite-view-btn"
																		onClick={() =>
																			navigate(`/property/${property.id}`)
																		}
																	>
																		View Details
																	</button>
																</div>
															</div>
														))}
												</div>
											</div>
										)}

									{/* Services Section */}
									{(favoritesCategory === "all" ||
										favoritesCategory === "service") &&
										favoriteProperties.filter((p) => p.category === "service")
											.length > 0 && (
											<div className="favorites-category-section">
												<h3 className="favorites-category-title">
													<span className="category-icon">🛎️</span> Services (
													{
														favoriteProperties.filter(
															(p) => p.category === "service"
														).length
													}
													)
												</h3>
												<div className="favorites-grid">
													{favoriteProperties
														.filter((p) => p.category === "service")
														.map((property) => (
															<div key={property.id} className="favorite-card">
																<div
																	className="favorite-image"
																	style={{
																		backgroundImage: `url(${
																			property.images?.[0] || housePlaceholder
																		})`,
																	}}
																>
																	<button
																		className="remove-favorite-btn"
																		onClick={() => toggleFavorite(property.id)}
																		title="Remove from favorites"
																	>
																		<FaHeart />
																	</button>
																</div>
																<div className="favorite-info">
																	<h4 className="favorite-title">
																		{property.title}
																	</h4>
																	<p className="favorite-location">
																		<FaMapMarkerAlt />
																		{property.location?.city},{" "}
																		{property.location?.province}
																	</p>
																	<div className="favorite-rating">
																		<span>⭐</span>
																		<span>{property.rating}</span>
																		<span className="review-count">
																			({property.reviewsCount})
																		</span>
																	</div>
																	<div className="favorite-price">
																		{formatPrice(
																			property.pricing?.price || 0,
																			property.pricing?.currency
																		)}
																	</div>
																	<button
																		className="favorite-view-btn"
																		onClick={() =>
																			navigate(`/property/${property.id}`)
																		}
																	>
																		View Details
																	</button>
																</div>
															</div>
														))}
												</div>
											</div>
										)}
									{/* No results for selected category */}
									{((favoritesCategory === "home" &&
										favoriteProperties.filter((p) => p.category === "home")
											.length === 0) ||
										(favoritesCategory === "experience" &&
											favoriteProperties.filter(
												(p) => p.category === "experience"
											).length === 0) ||
										(favoritesCategory === "service" &&
											favoriteProperties.filter((p) => p.category === "service")
												.length === 0)) && (
										<div className="no-category-results">
											<p>No favorites in this category yet</p>
										</div>
									)}
								</div>
							</>
						)}
					</div>
				</div>
			)}

			{/* Bookings Modal */}
			{showBookingsModal && (
				<div
					className="modal-overlay bookings-modal-overlay"
					onClick={() => setShowBookingsModal(false)}
				>
					<div
						className="modal-content bookings-modal-content"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="modal-header">
							<h2>
								{bookingsModalType === "upcoming"
									? "✈️ Upcoming Trips"
									: "📋 Previous Bookings"}
							</h2>
							<button
								className="close-modal-btn"
								onClick={() => setShowBookingsModal(false)}
							>
								×
							</button>
						</div>

						<div className="modal-body bookings-modal-body">
							{bookingsList[bookingsModalType].length === 0 ? (
								<div className="empty-bookings">
									<FaCalendarAlt className="empty-icon" />
									<p>
										{bookingsModalType === "upcoming"
											? "No upcoming trips"
											: "No previous bookings"}
									</p>
								</div>
							) : (
								<div className="bookings-grid">
									{bookingsList[bookingsModalType].map((booking) => (
										<div key={booking.id} className="booking-card">
											<div
												className="booking-image"
												style={{
													backgroundImage: `url(${
														booking.propertyImage || housePlaceholder
													})`,
												}}
												onClick={() =>
													navigate(`/property/${booking.propertyId}`)
												}
											>
												<span
													className={`booking-status-badge ${booking.status}`}
												>
													{booking.status}
												</span>
											</div>
											<div className="booking-info">
												<h3 className="booking-title">
													{booking.propertyTitle}
												</h3>
												<div className="booking-dates">
													<FaCalendarAlt />
													<span>
														{new Date(booking.checkInDate).toLocaleDateString()}{" "}
														-{" "}
														{new Date(
															booking.checkOutDate
														).toLocaleDateString()}
													</span>
												</div>
												<div className="booking-stats">
													<span>
														👥 {booking.numberOfGuests} guest
														{booking.numberOfGuests > 1 ? "s" : ""}
													</span>
													<span>
														🌙 {booking.numberOfNights} night
														{booking.numberOfNights > 1 ? "s" : ""}
													</span>
												</div>
												<div className="booking-price">
													<span>Total:</span>
													<strong>
														₱{booking.pricing?.total?.toLocaleString()}
													</strong>
												</div>

												{/* Review Section for Previous Bookings */}
												{bookingsModalType === "previous" && (
													<>
														{booking.hasReview && booking.review ? (
															<div className="booking-review-display">
																<div className="review-header">
																	<span className="review-rating">
																		⭐ {booking.review.rating.toFixed(1)}
																	</span>
																	<span className="review-date">
																		{new Date(
																			booking.review.createdAt
																		).toLocaleDateString()}
																	</span>
																</div>
																{booking.review.comment && (
																	<p className="review-comment">
																		"{booking.review.comment}"
																	</p>
																)}
																<button
																	className="view-review-btn"
																	onClick={() => handleOpenReviewModal(booking)}
																>
																	View Full Review
																</button>
															</div>
														) : (
															<button
																className="write-review-btn"
																onClick={() => handleOpenReviewModal(booking)}
															>
																✍️ Write Review
															</button>
														)}
													</>
												)}

												<button
													className="view-property-btn"
													onClick={() =>
														navigate(`/property/${booking.propertyId}`)
													}
												>
													View Property
												</button>
											</div>
										</div>
									))}
								</div>
							)}
						</div>
					</div>
				</div>
			)}

			{/* Wishlist Modal */}
			{showWishlistModal && (
				<div
					className="modal-overlay wishlist-modal-overlay"
					onClick={() => setShowWishlistModal(false)}
				>
					<div
						className="modal-content wishlist-modal-content"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="modal-header">
							<h2>
								<FaBookmark className="modal-bookmark-icon" /> My Wishlist
							</h2>
							<button
								className="close-modal-btn"
								onClick={() => setShowWishlistModal(false)}
							>
								×
							</button>
						</div>

						{wishlistProperties.length === 0 ? (
							<div className="empty-wishlist">
								<FaBookmark className="empty-icon" />
								<h3>Your wishlist is empty</h3>
								<p>Start adding properties you love!</p>
							</div>
						) : (
							<>
								{/* Category Filter Buttons */}
								<div className="wishlist-category-filters">
									<button
										className={`filter-btn ${
											wishlistCategory === "all" ? "active" : ""
										}`}
										onClick={() => setWishlistCategory("all")}
									>
										<span className="filter-icon">🌟</span>
										<span className="filter-label">All</span>
										<span className="filter-count">
											{wishlistProperties.length}
										</span>
									</button>
									<button
										className={`filter-btn ${
											wishlistCategory === "home" ? "active" : ""
										}`}
										onClick={() => setWishlistCategory("home")}
									>
										<span className="filter-icon">🏠</span>
										<span className="filter-label">Homes</span>
										<span className="filter-count">
											{
												wishlistProperties.filter((p) => p.category === "home")
													.length
											}
										</span>
									</button>
									<button
										className={`filter-btn ${
											wishlistCategory === "experience" ? "active" : ""
										}`}
										onClick={() => setWishlistCategory("experience")}
									>
										<span className="filter-icon">✨</span>
										<span className="filter-label">Experiences</span>
										<span className="filter-count">
											{
												wishlistProperties.filter(
													(p) => p.category === "experience"
												).length
											}
										</span>
									</button>
									<button
										className={`filter-btn ${
											wishlistCategory === "service" ? "active" : ""
										}`}
										onClick={() => setWishlistCategory("service")}
									>
										<span className="filter-icon">🛎️</span>
										<span className="filter-label">Services</span>
										<span className="filter-count">
											{
												wishlistProperties.filter(
													(p) => p.category === "service"
												).length
											}
										</span>
									</button>
								</div>

								<div className="wishlist-modal-body">
									{/* Homes Section */}
									{(wishlistCategory === "all" ||
										wishlistCategory === "home") &&
										wishlistProperties.filter((p) => p.category === "home")
											.length > 0 && (
											<div className="wishlist-category-section">
												<h3 className="wishlist-category-title">
													<span className="category-icon">🏠</span> Homes (
													{
														wishlistProperties.filter(
															(p) => p.category === "home"
														).length
													}
													)
												</h3>
												<div className="wishlist-grid">
													{wishlistProperties
														.filter((p) => p.category === "home")
														.map((property) => (
															<div key={property.id} className="wishlist-card">
																<div
																	className="wishlist-image"
																	style={{
																		backgroundImage: `url(${
																			property.images?.[0] || housePlaceholder
																		})`,
																	}}
																>
																	<button
																		className="remove-wishlist-btn"
																		onClick={() => toggleWishlist(property.id)}
																		title="Remove from wishlist"
																	>
																		<FaBookmark />
																	</button>
																</div>
																<div className="wishlist-info">
																	<h4 className="wishlist-title">
																		{property.title}
																	</h4>
																	<p className="wishlist-location">
																		<FaMapMarkerAlt />
																		{property.location?.city},{" "}
																		{property.location?.province}
																	</p>
																	<div className="wishlist-rating">
																		<span>⭐</span>
																		<span>{property.rating}</span>
																		<span className="review-count">
																			({property.reviewsCount})
																		</span>
																	</div>
																	<div className="wishlist-price">
																		{formatPrice(
																			property.pricing?.basePrice || 0,
																			property.pricing?.currency
																		)}
																		<span className="price-period">
																			{property.category === "home"
																				? "/ night"
																				: property.category === "experience"
																				? "/ person"
																				: ""}
																		</span>
																	</div>
																	<button
																		className="view-details-btn"
																		onClick={() => {
																			navigate(`/property/${property.id}`)
																			setShowWishlistModal(false)
																		}}
																	>
																		View Details
																	</button>
																</div>
															</div>
														))}
												</div>
											</div>
										)}

									{/* Experiences Section */}
									{(wishlistCategory === "all" ||
										wishlistCategory === "experience") &&
										wishlistProperties.filter(
											(p) => p.category === "experience"
										).length > 0 && (
											<div className="wishlist-category-section">
												<h3 className="wishlist-category-title">
													<span className="category-icon">✨</span> Experiences
													(
													{
														wishlistProperties.filter(
															(p) => p.category === "experience"
														).length
													}
													)
												</h3>
												<div className="wishlist-grid">
													{wishlistProperties
														.filter((p) => p.category === "experience")
														.map((property) => (
															<div key={property.id} className="wishlist-card">
																<div
																	className="wishlist-image"
																	style={{
																		backgroundImage: `url(${
																			property.images?.[0] || housePlaceholder
																		})`,
																	}}
																>
																	<button
																		className="remove-wishlist-btn"
																		onClick={() => toggleWishlist(property.id)}
																		title="Remove from wishlist"
																	>
																		<FaBookmark />
																	</button>
																</div>
																<div className="wishlist-info">
																	<h4 className="wishlist-title">
																		{property.title}
																	</h4>
																	<p className="wishlist-location">
																		<FaMapMarkerAlt />
																		{property.location?.city},{" "}
																		{property.location?.province}
																	</p>
																	<div className="wishlist-rating">
																		<span>⭐</span>
																		<span>{property.rating}</span>
																		<span className="review-count">
																			({property.reviewsCount})
																		</span>
																	</div>
																	<div className="wishlist-price">
																		{formatPrice(
																			property.pricing?.basePrice || 0,
																			property.pricing?.currency
																		)}
																		<span className="price-period">
																			{property.category === "home"
																				? "/ night"
																				: property.category === "experience"
																				? "/ person"
																				: ""}
																		</span>
																	</div>
																	<button
																		className="view-details-btn"
																		onClick={() => {
																			navigate(`/property/${property.id}`)
																			setShowWishlistModal(false)
																		}}
																	>
																		View Details
																	</button>
																</div>
															</div>
														))}
												</div>
											</div>
										)}

									{/* Services Section */}
									{(wishlistCategory === "all" ||
										wishlistCategory === "service") &&
										wishlistProperties.filter((p) => p.category === "service")
											.length > 0 && (
											<div className="wishlist-category-section">
												<h3 className="wishlist-category-title">
													<span className="category-icon">🛎️</span> Services (
													{
														wishlistProperties.filter(
															(p) => p.category === "service"
														).length
													}
													)
												</h3>
												<div className="wishlist-grid">
													{wishlistProperties
														.filter((p) => p.category === "service")
														.map((property) => (
															<div key={property.id} className="wishlist-card">
																<div
																	className="wishlist-image"
																	style={{
																		backgroundImage: `url(${
																			property.images?.[0] || housePlaceholder
																		})`,
																	}}
																>
																	<button
																		className="remove-wishlist-btn"
																		onClick={() => toggleWishlist(property.id)}
																		title="Remove from wishlist"
																	>
																		<FaBookmark />
																	</button>
																</div>
																<div className="wishlist-info">
																	<h4 className="wishlist-title">
																		{property.title}
																	</h4>
																	<p className="wishlist-location">
																		<FaMapMarkerAlt />
																		{property.location?.city},{" "}
																		{property.location?.province}
																	</p>
																	<div className="wishlist-rating">
																		<span>⭐</span>
																		<span>{property.rating}</span>
																		<span className="review-count">
																			({property.reviewsCount})
																		</span>
																	</div>
																	<div className="wishlist-price">
																		{formatPrice(
																			property.pricing?.basePrice || 0,
																			property.pricing?.currency
																		)}
																		<span className="price-period">
																			{property.category === "home"
																				? "/ night"
																				: property.category === "experience"
																				? "/ person"
																				: ""}
																		</span>
																	</div>
																	<button
																		className="view-details-btn"
																		onClick={() => {
																			navigate(`/property/${property.id}`)
																			setShowWishlistModal(false)
																		}}
																	>
																		View Details
																	</button>
																</div>
															</div>
														))}
												</div>
											</div>
										)}
								</div>
							</>
						)}
					</div>
				</div>
			)}

			{/* Review Modal */}
			{showReviewModal && selectedBookingForReview && (
				<div
					className="modal-overlay review-modal-overlay"
					onClick={() => setShowReviewModal(false)}
				>
					<div
						className="modal-content review-modal-content"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="modal-header">
							<h2>
								{selectedBookingForReview.hasReview
									? "📝 Your Review"
									: "✍️ Write a Review"}
							</h2>
							<button
								className="close-modal-btn"
								onClick={() => setShowReviewModal(false)}
							>
								×
							</button>
						</div>

						<div className="modal-body review-modal-body">
							<div className="review-property-info">
								<img
									src={
										selectedBookingForReview.propertyImage || housePlaceholder
									}
									alt={selectedBookingForReview.propertyTitle}
									className="review-property-image"
								/>
								<div>
									<h3>{selectedBookingForReview.propertyTitle}</h3>
									<p>
										{new Date(
											selectedBookingForReview.checkInDate
										).toLocaleDateString()}{" "}
										-{" "}
										{new Date(
											selectedBookingForReview.checkOutDate
										).toLocaleDateString()}
									</p>
								</div>
							</div>

							{selectedBookingForReview.hasReview &&
							selectedBookingForReview.review ? (
								/* Display existing review */
								<div className="review-display">
									<div className="rating-section">
										<h3>Overall Rating</h3>
										<div className="overall-rating">
											<span className="rating-value">
												{selectedBookingForReview.review.rating.toFixed(1)}
											</span>
											<span className="rating-stars">
												{"⭐".repeat(
													Math.round(selectedBookingForReview.review.rating)
												)}
											</span>
										</div>
									</div>

									<div className="detailed-ratings">
										<h3>Detailed Ratings</h3>
										<div className="rating-items">
											<div className="rating-item">
												<span>Cleanliness:</span>
												<span>
													⭐ {selectedBookingForReview.review.cleanliness}
												</span>
											</div>
											<div className="rating-item">
												<span>Accuracy:</span>
												<span>
													⭐ {selectedBookingForReview.review.accuracy}
												</span>
											</div>
											<div className="rating-item">
												<span>Communication:</span>
												<span>
													⭐ {selectedBookingForReview.review.communication}
												</span>
											</div>
											<div className="rating-item">
												<span>Location:</span>
												<span>
													⭐ {selectedBookingForReview.review.location}
												</span>
											</div>
											<div className="rating-item">
												<span>Check-in:</span>
												<span>
													⭐ {selectedBookingForReview.review.checkIn}
												</span>
											</div>
											<div className="rating-item">
												<span>Value:</span>
												<span>⭐ {selectedBookingForReview.review.value}</span>
											</div>
										</div>
									</div>

									{selectedBookingForReview.review.comment && (
										<div className="review-section">
											<h3>Your Review</h3>
											<p className="review-text">
												{selectedBookingForReview.review.comment}
											</p>
										</div>
									)}

									{selectedBookingForReview.review.feedback && (
										<div className="review-section">
											<h3>Feedback</h3>
											<p className="review-text">
												{selectedBookingForReview.review.feedback}
											</p>
										</div>
									)}

									{selectedBookingForReview.review.suggestions && (
										<div className="review-section">
											<h3>Suggestions</h3>
											<p className="review-text">
												{selectedBookingForReview.review.suggestions}
											</p>
										</div>
									)}
								</div>
							) : (
								/* Review form */
								<div className="review-form">
									<div className="rating-category">
										<h3>Rate Your Experience</h3>
										<div className="rating-grid">
											{[
												{ key: "cleanliness", label: "Cleanliness" },
												{ key: "accuracy", label: "Accuracy" },
												{ key: "communication", label: "Communication" },
												{ key: "location", label: "Location" },
												{ key: "checkIn", label: "Check-in" },
												{ key: "value", label: "Value" },
											].map((category) => (
												<div key={category.key} className="rating-input">
													<label>{category.label}</label>
													<div className="star-rating">
														{[1, 2, 3, 4, 5].map((star) => (
															<button
																key={star}
																type="button"
																className={`star-btn ${
																	reviewData[category.key] >= star
																		? "active"
																		: ""
																}`}
																onClick={() =>
																	setReviewData({
																		...reviewData,
																		[category.key]: star,
																	})
																}
															>
																⭐
															</button>
														))}
													</div>
												</div>
											))}
										</div>
									</div>

									<div className="review-textarea-section">
										<label>
											Your Review <span className="required">*</span>
										</label>
										<textarea
											placeholder="Share your experience with others..."
											value={reviewData.comment}
											onChange={(e) =>
												setReviewData({
													...reviewData,
													comment: e.target.value,
												})
											}
											rows="4"
											required
										/>
									</div>

									<div className="review-textarea-section">
										<label>Feedback (Optional)</label>
										<textarea
											placeholder="Any additional feedback for the host..."
											value={reviewData.feedback}
											onChange={(e) =>
												setReviewData({
													...reviewData,
													feedback: e.target.value,
												})
											}
											rows="3"
										/>
									</div>

									<div className="review-textarea-section">
										<label>Suggestions (Optional)</label>
										<textarea
											placeholder="Suggestions for improvement..."
											value={reviewData.suggestions}
											onChange={(e) =>
												setReviewData({
													...reviewData,
													suggestions: e.target.value,
												})
											}
											rows="3"
										/>
									</div>

									<div className="review-actions">
										<button
											className="skip-review-btn"
											onClick={handleSkipReview}
										>
											Skip for Now
										</button>
										<button
											className="submit-review-btn"
											onClick={handleSubmitReview}
											disabled={!reviewData.comment.trim()}
										>
											Submit Review
										</button>
									</div>
								</div>
							)}
						</div>
					</div>
				</div>
			)}

			{/* Promos Modal */}
			<Promos
				isOpen={showPromosModal}
				onClose={() => setShowPromosModal(false)}
			/>
		</div>
	)
}
