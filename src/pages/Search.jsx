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
	query,
	where,
	onSnapshot,
} from "firebase/firestore"
import { toast } from "react-stacked-toast"
import "../css/Search.css"
import { formatCurrencyFull } from "../utils/currencyFormatter"
import logoPlain from "../assets/logoPlain.png"
import housePlaceholder from "../assets/housePlaceholder.png"
import {
	FaSearch,
	FaHeart,
	FaBars,
	FaUser,
	FaSignOutAlt,
	FaCog,
	FaEnvelope,
	FaMapMarkerAlt,
	FaBookmark,
	FaFilter,
	FaTimes,
	FaSlidersH,
	FaCalendarAlt,
	FaPlus,
	FaMinus,
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
	// Wishlist UI removed on search page
	// const [wishlist, setWishlist] = useState([])
	const [searchSuggestions, setSearchSuggestions] = useState([])
	const [showSuggestions, setShowSuggestions] = useState(false)
	const [recentSearches, setRecentSearches] = useState([])

	// Filter states
	const [selectedCategory, setSelectedCategory] = useState("all")
	const [priceRange, setPriceRange] = useState([0, 50000])
	const [selectedRating, setSelectedRating] = useState(0)
	const [sortBy, setSortBy] = useState("relevance")
	const [showFilters, setShowFilters] = useState(false)
	const [showQuickFilters, setShowQuickFilters] = useState(false)
	const [voucherFilter, setVoucherFilter] = useState("")
	// Calendar states (modal like booking page)
	const [showDateModal, setShowDateModal] = useState(false)
	const [selectingCheckIn, setSelectingCheckIn] = useState(true)
	const [currentMonth, setCurrentMonth] = useState(new Date())
	// Advanced search params
	const [guests, setGuests] = useState(0)
	const [checkIn, setCheckIn] = useState("")
	const [checkOut, setCheckOut] = useState("")
	const [unreadNotifications, setUnreadNotifications] = useState(0)

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

	// Get search query and category from URL or state
	useEffect(() => {
		const params = new URLSearchParams(location.search)
		const query =
			params.get("q") || params.get("query") || location.state?.query || ""
		const category = params.get("category") || "all"
		const voucher = params.get("voucher") || ""
		setSearchQuery(query)
		setSelectedCategory(category)
		setVoucherFilter(voucher)
		const guestsParam = parseInt(params.get("guests") || "0")
		setGuests(Number.isFinite(guestsParam) ? guestsParam : 0)
		setCheckIn(params.get("checkIn") || "")
		setCheckOut(params.get("checkOut") || "")
	}, [location])

	// Fetch properties and user data
	useEffect(() => {
		const fetchData = async () => {
			await fetchProperties()
			await fetchUserFavorites()
			// wishlist removed from search page
			await fetchRecentSearches()
		}
		fetchData()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentUser])

	// Fetch unread notifications count
	useEffect(() => {
		if (!currentUser?.uid) return

		const notificationsQuery = query(
			collection(db, "notifications"),
			where("userId", "==", currentUser.uid),
			where("read", "==", false)
		)

		const unsubscribe = onSnapshot(
			notificationsQuery,
			(snapshot) => {
				setUnreadNotifications(snapshot.size)
			},
			(error) => {
				console.error("Error fetching notifications:", error)
			}
		)

		return () => unsubscribe()
	}, [currentUser])

	// Generate search suggestions
	useEffect(() => {
		if (searchQuery.trim().length > 0) {
			const query = searchQuery.toLowerCase()
			const suggestions = []

			// Get unique suggestions from properties
			properties.forEach((property) => {
				// Add property titles
				if (
					property.title?.toLowerCase().includes(query) &&
					!suggestions.find((s) => s.text === property.title)
				) {
					suggestions.push({ text: property.title, type: "property" })
				}

				// Add locations
				const locationText = `${property.location?.city}, ${property.location?.province}`
				if (
					locationText.toLowerCase().includes(query) &&
					!suggestions.find((s) => s.text === locationText)
				) {
					suggestions.push({ text: locationText, type: "location" })
				}
			})

			setSearchSuggestions(suggestions.slice(0, 8)) // Limit to 8 suggestions
		} else {
			setSearchSuggestions([])
		}
	}, [searchQuery, properties])

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

			// Guests filter (homes/experiences with capacity)
			if (guests && guests > 0) {
				filtered = filtered.filter((p) => {
					const capGuests = p?.capacity?.guests ?? p?.capacity?.maxGuests
					return typeof capGuests === "number" ? capGuests >= guests : true
				})
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

			// Voucher filter (e.g., early_bird)
			if (voucherFilter) {
				filtered = filtered.filter((p) => {
					// Check if property has vouchers
					if (!p.vouchers) {
						return false
					}

					// Check if property has vouchers.types array
					if (!p.vouchers.types || !Array.isArray(p.vouchers.types)) {
						return false
					}

					// Check if the voucher type exists in the types array
					const hasVoucherType = p.vouchers.types.includes(voucherFilter)
					if (!hasVoucherType) {
						return false
					}

					// If voucher type exists, check if it's active (if details exist)
					const voucherDetails = p.vouchers.details?.[voucherFilter]
					if (voucherDetails) {
						// Check isActive field - this is the main indicator
						const isActive = voucherDetails.isActive !== undefined
							? typeof voucherDetails.isActive === "boolean"
								? voucherDetails.isActive
								: String(voucherDetails.isActive).toLowerCase() === "true"
							: true // Default to active if not specified
						
						// If explicitly set to inactive, exclude the property
						if (isActive === false) {
							return false
						}

						// For early_bird promos, we show properties with active vouchers
						// The date range indicates when the discount is valid for bookings,
						// not when the property should appear in search results
						// So we don't filter by date range for search display
					}

					// If voucher type exists in types array and is active, include it
					return true
				})
				
				// Debug logging
				console.log(`[Search] Filtering by voucher: ${voucherFilter}`)
				console.log(`[Search] Total properties before filter: ${properties.length}`)
				
				// Log all properties with vouchers to help debug
				const propertiesWithVouchers = properties.filter(p => p.vouchers && p.vouchers.types)
				console.log(`[Search] Properties with vouchers: ${propertiesWithVouchers.length}`)
				if (propertiesWithVouchers.length > 0) {
					propertiesWithVouchers.forEach(p => {
						const hasVoucher = p.vouchers.types.includes(voucherFilter)
						const voucherDetails = p.vouchers.details?.[voucherFilter]
						const isActive = voucherDetails?.isActive !== undefined
							? typeof voucherDetails.isActive === "boolean"
								? voucherDetails.isActive
								: String(voucherDetails.isActive).toLowerCase() === "true"
							: true
						console.log(`[Search] Property "${p.title}" (${p.id}):`, {
							voucherTypes: p.vouchers.types,
							hasEarlyBird: hasVoucher,
							isActive: isActive,
							earlyBirdDetails: voucherDetails
						})
					})
				}
				
				console.log(`[Search] Properties with ${voucherFilter} voucher: ${filtered.length}`)
				if (filtered.length > 0) {
					console.log(`[Search] Sample property with ${voucherFilter}:`, {
						id: filtered[0].id,
						title: filtered[0].title,
						vouchers: filtered[0].vouchers
					})
				} else {
					console.log(`[Search] No properties found with ${voucherFilter} voucher.`)
					console.log(`[Search] Make sure the property has "${voucherFilter}" in vouchers.types array and isActive is not false.`)
				}
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
		guests,
		checkIn,
		checkOut,
	])

	const fetchProperties = async () => {
		try {
			setIsLoading(true)
			const propertiesRef = collection(db, "properties")
			const snapshot = await getDocs(propertiesRef)

			const propertiesList = snapshot.docs
				.map((doc) => ({
					id: doc.id,
					...doc.data(),
				}))
				.filter((property) => {
					// Filter out disabled properties
					if (property.disabled === true) {
						// Check if disabled period has passed
						if (property.disabledUntil) {
							const disabledUntil = property.disabledUntil.toDate
								? property.disabledUntil.toDate()
								: new Date(property.disabledUntil)
							const now = new Date()
							if (now < disabledUntil) {
								return false // Still disabled
							}
						} else {
							return false // Permanently disabled or no expiry
						}
					}
					return true
				})

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

	// const fetchUserWishlist = async () => {
	// 	if (!currentUser?.uid) return
	//
	// 	try {
	// 		const userDoc = await getDoc(doc(db, "users", currentUser.uid))
	// 		if (userDoc.exists()) {
	// 			const data = userDoc.data()
	// 			setWishlist(data.wishlist || [])
	// 		}
	// 	} catch (error) {
	// 		console.error("Error fetching wishlist:", error)
	// 	}
	// }

	const fetchRecentSearches = async () => {
		if (!currentUser?.uid) return

		try {
			const userDoc = await getDoc(doc(db, "users", currentUser.uid))
			if (userDoc.exists()) {
				const data = userDoc.data()
				const searches = data.recentSearches || []
				// Filter out empty or whitespace-only searches
				const validSearches = searches.filter(
					(s) => s.query && s.query.trim().length > 0
				)
				setRecentSearches(validSearches.slice(-5).reverse()) // Get last 5, most recent first
			}
		} catch (error) {
			console.error("Error fetching recent searches:", error)
		}
	}

	const handleSearch = async (e) => {
		e.preventDefault()
		const trimmedQuery = searchQuery.trim()
		if (!trimmedQuery || trimmedQuery.length === 0) return

		setShowSuggestions(false)

		// Save search to Firebase - only save non-empty queries
		if (currentUser?.uid && trimmedQuery && trimmedQuery.length > 0) {
			try {
				const userDocRef = doc(db, "users", currentUser.uid)
				const userDoc = await getDoc(userDocRef)

				if (userDoc.exists()) {
					const userData = userDoc.data()
					let searches = userData.recentSearches || []

					// Check if the exact same query already exists (case-sensitive)
					const existingIndex = searches.findIndex(
						(s) => s.query === trimmedQuery
					)

					if (existingIndex !== -1) {
						// Remove the old entry
						searches.splice(existingIndex, 1)
					}

					// Add the new/updated search at the end
					searches.push({
						query: trimmedQuery,
						timestamp: new Date().toISOString(),
					})

					// Update Firebase with the modified array
					await updateDoc(userDocRef, {
						recentSearches: searches,
					})

					await fetchRecentSearches()
				}
			} catch (error) {
				console.error("Error saving search:", error)
			}
		}

		// Update URL
		navigate(`/search?q=${encodeURIComponent(trimmedQuery)}`, {
			replace: true,
		})
	}

	const handleSuggestionClick = (suggestion) => {
		setSearchQuery(suggestion)
		setShowSuggestions(false)
		handleSearch({ preventDefault: () => {} })
	}

	const handleSearchInputChange = (e) => {
		setSearchQuery(e.target.value)
		setShowSuggestions(true)
	}

	const handleSearchInputFocus = () => {
		setShowSuggestions(true)
	}

	const handleLogout = async () => {
		try {
			await logout()
			toast.success("Logged out successfully")
			navigate("/")
		} catch (error) {
			console.error("Error logging out in search:", error)
		}
	}

	// Get appropriate dashboard route based on user type
	const getDashboardRoute = () => {
		if (!userData?.userType) return "/dashboardGuest"
		if (userData.userType === "admin") return "/admin"
		if (userData.userType === "host") return "/dashboardHost"
		return "/dashboardGuest"
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

	// Wishlist removed from search cards; keeping UI lean

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
		setGuests(0)
		setCheckIn("")
		setCheckOut("")
		setVoucherFilter("")
		// Clear voucher from URL
		const params = new URLSearchParams(location.search)
		params.delete("voucher")
		navigate(`/search?${params.toString()}`, { replace: true })
	}

	const applyQuickFilters = () => {
		const params = new URLSearchParams(location.search)
		if (searchQuery.trim()) params.set("q", searchQuery.trim())
		else params.delete("q")
		if (guests && guests > 0) params.set("guests", String(guests))
		else params.delete("guests")
		if (checkIn) params.set("checkIn", checkIn)
		else params.delete("checkIn")
		if (checkOut) params.set("checkOut", checkOut)
		else params.delete("checkOut")
		navigate(`/search?${params.toString()}`, { replace: true })
		setShowQuickFilters(false)
	}

	// Calendar helpers (reuse booking calendar behavior/styles)
	const getTodayDate = () => {
		const today = new Date()
		return today.toISOString().split("T")[0]
	}

	const generateCalendarDays = () => {
		const year = currentMonth.getFullYear()
		const month = currentMonth.getMonth()
		const firstDay = new Date(year, month, 1).getDay()
		const daysInMonth = new Date(year, month + 1, 0).getDate()

		const days = []
		for (let i = 0; i < firstDay; i++) days.push(null)
		for (let day = 1; day <= daysInMonth; day++) {
			const dateString = `${year}-${String(month + 1).padStart(
				2,
				"0"
			)}-${String(day).padStart(2, "0")}`
			days.push({
				day,
				dateString,
				isBooked: false,
				isPast: new Date(dateString) < new Date(getTodayDate()),
			})
		}
		return days
	}

	const previousMonth = () => {
		setCurrentMonth(
			new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1)
		)
	}

	const nextMonth = () => {
		setCurrentMonth(
			new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1)
		)
	}

	const handleCalendarDayClick = (dateString, isBooked) => {
		if (isBooked) return
		if (selectingCheckIn) {
			setCheckIn(dateString)
			setCheckOut("")
			setSelectingCheckIn(false)
		} else {
			const inDate = new Date(checkIn)
			const outDate = new Date(dateString)
			if (outDate <= inDate) return
			setCheckOut(dateString)
			setSelectingCheckIn(true)
		}
	}

	return (
		<div className="search-page-container">
			{/* Top Navigation Bar */}
			<nav className="top-navbar">
				{/* Logo */}
				<div
					className="navbar-logo"
					onClick={() => navigate(getDashboardRoute())}
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
						onChange={handleSearchInputChange}
						onFocus={handleSearchInputFocus}
						onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
					/>

					{/* Search Suggestions Dropdown */}
					{showSuggestions && (
						<div className="search-suggestions">
							{searchQuery.trim().length === 0 && recentSearches.length > 0 ? (
								<>
									<div className="suggestions-header">Recent Searches</div>
									{recentSearches.map((search, index) => (
										<div
											key={`recent-${index}`}
											className="suggestion-item recent"
											onClick={() => handleSuggestionClick(search.query)}
										>
											<FaSearch className="suggestion-icon" />
											<span>{search.query}</span>
										</div>
									))}
								</>
							) : searchSuggestions.length > 0 ? (
								<>
									<div className="suggestions-header">Suggestions</div>
									{searchSuggestions.map((suggestion, index) => (
										<div
											key={`suggestion-${index}`}
											className="suggestion-item"
											onClick={() => handleSuggestionClick(suggestion.text)}
										>
											{suggestion.type === "location" ? (
												<FaMapMarkerAlt className="suggestion-icon" />
											) : (
												<FaSearch className="suggestion-icon" />
											)}
											<span>{suggestion.text}</span>
										</div>
									))}
								</>
							) : null}
						</div>
					)}
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
						onClick={() => navigate(getDashboardRoute())}
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
									<img src={userData?.photoURL || currentUser.photoURL} alt={displayName} />
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
											<img src={userData?.photoURL || currentUser.photoURL} alt={displayName} />
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
						<div className="price-slider-container">
							<div className="price-display">
								₱{priceRange[0].toLocaleString()} - ₱
								{priceRange[1].toLocaleString()}
							</div>
							<div className="slider-wrapper">
								<label>Min Price</label>
								<input
									type="range"
									min="0"
									max="50000"
									step="500"
									value={priceRange[0]}
									onChange={(e) =>
										setPriceRange([
											Math.min(parseInt(e.target.value), priceRange[1] - 500),
											priceRange[1],
										])
									}
									className="price-slider"
								/>
							</div>
							<div className="slider-wrapper">
								<label>Max Price</label>
								<input
									type="range"
									min="0"
									max="50000"
									step="500"
									value={priceRange[1]}
									onChange={(e) =>
										setPriceRange([
											priceRange[0],
											Math.max(parseInt(e.target.value), priceRange[0] + 500),
										])
									}
									className="price-slider"
								/>
							</div>
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
							{voucherFilter && (
								<div className="voucher-filter-badge" style={{ marginBottom: "1rem", padding: "0.75rem 1rem", background: "linear-gradient(135deg, var(--primary), var(--secondary))", borderRadius: "8px", color: "white", display: "flex", alignItems: "center", gap: "0.5rem" }}>
									<span>✨</span>
									<span><strong>Early Bird Promo</strong> - Showing properties with Early Bird discounts</span>
									<button 
										onClick={() => {
											setVoucherFilter("")
											const params = new URLSearchParams(location.search)
											params.delete("voucher")
											navigate(`/search?${params.toString()}`, { replace: true })
										}}
										style={{ marginLeft: "auto", background: "rgba(255,255,255,0.2)", border: "none", color: "white", padding: "0.25rem 0.5rem", borderRadius: "4px", cursor: "pointer" }}
									>
										<FaTimes />
									</button>
								</div>
							)}
							<h2>
								{searchQuery
									? `Search results for "${searchQuery}"`
									: voucherFilter
									? "Early Bird Promo Properties"
									: "All Properties"}
							</h2>
							<p className="results-count">
								{filteredProperties.length} {voucherFilter ? "Early Bird " : ""}{filteredProperties.length === 1 ? "property" : "properties"} found
							</p>
						</div>

						<div className="results-controls">
							<button
								className="quick-filter-btn"
								onClick={() => setShowQuickFilters(!showQuickFilters)}
							>
								Where · Who · Dates
							</button>
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

					{/* Inline Quick Filters */}
					{showQuickFilters && (
						<div className="guest-searchbar">
							{/* Where segment */}
							<div className="gsb-segment gsb-where">
								<div className="gsb-label">
									<FaMapMarkerAlt /> <span>Where</span>
								</div>
								<input
									type="text"
									placeholder="Search destination or property"
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									className="gsb-input"
								/>
							</div>
							<div className="gsb-divider"></div>
							{/* Who segment */}
							<div className="gsb-segment gsb-who">
								<div className="gsb-label">
									<FaUser /> <span>Who</span>
								</div>
								<div className="gsb-stepper">
									<button
										type="button"
										className="stepper-btn"
										onClick={() => setGuests(Math.max(1, (guests || 1) - 1))}
										aria-label="Decrease guests"
									>
										<FaMinus />
									</button>
									<span className="stepper-value">{guests || 1}</span>
									<button
										type="button"
										className="stepper-btn"
										onClick={() => setGuests((guests || 1) + 1)}
										aria-label="Increase guests"
									>
										<FaPlus />
									</button>
								</div>
							</div>
							<div className="gsb-divider"></div>
							{/* Dates segment */}
							<div className="gsb-segment gsb-dates">
								<button
									type="button"
									className="gsb-date-toggle"
									onClick={() => setShowDateModal(true)}
								>
									<div className="gsb-label">
										<FaCalendarAlt /> <span>Dates</span>
									</div>
									<div className="gsb-date-value">
										{checkIn && checkOut
											? `${new Date(checkIn).toLocaleDateString()} → ${new Date(
													checkOut
											  ).toLocaleDateString()}`
											: "Select dates"}
									</div>
								</button>
							</div>
							{/* Action segment */}
							<div className="gsb-actions">
								<button className="gsb-search-btn" onClick={applyQuickFilters}>
									<FaSearch />
									<span>Search</span>
								</button>
								<button
									type="button"
									className="gsb-clear-btn"
									onClick={() => {
										setSearchQuery("")
										setGuests(1)
										setCheckIn("")
										setCheckOut("")
										setShowQuickFilters(false)
									}}
								>
									Clear
								</button>
							</div>
						</div>
					)}

					{/* Date Picker Modal (booking-style) */}
					{showDateModal && (
						<div
							className="date-picker-modal-overlay"
							onClick={() => setShowDateModal(false)}
						>
							<div
								className="date-picker-modal-content"
								onClick={(e) => e.stopPropagation()}
							>
								<button
									className="close-date-modal"
									onClick={() => setShowDateModal(false)}
								>
									<FaTimes />
								</button>
								<h2>Select Your Dates</h2>
								<div className="modal-date-info">
									<div className="selected-dates-display">
										{checkIn && (
											<div className="selected-date-item check-in">
												<span className="date-type">Check-in:</span>
												<span className="date-text">
													{new Date(checkIn).toLocaleDateString()}
												</span>
											</div>
										)}
										{checkOut && (
											<div className="selected-date-item check-out">
												<span className="date-type">Check-out:</span>
												<span className="date-text">
													{new Date(checkOut).toLocaleDateString()}
												</span>
											</div>
										)}
										{!checkIn && !checkOut && (
											<p className="instruction-text">
												{selectingCheckIn
													? "Click on a date to select check-in"
													: "Click on a date to select check-out"}
											</p>
										)}
									</div>
								</div>

								<div className="modal-calendar">
									<div className="month-view">
										<div className="month-header">
											<button onClick={previousMonth} className="month-nav-btn">
												◀
											</button>
											<h3>
												{currentMonth.toLocaleString("default", {
													month: "long",
													year: "numeric",
												})}
											</h3>
											<button onClick={nextMonth} className="month-nav-btn">
												▶
											</button>
										</div>
										<div className="calendar-days">
											{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
												(day) => (
													<div key={day} className="day-label">
														{day}
													</div>
												)
											)}
											{generateCalendarDays().map((dayData, index) =>
												dayData ? (
													<div
														key={index}
														className={`calendar-day ${
															dayData.isBooked
																? "booked"
																: dayData.isPast
																? "past"
																: "available"
														} ${
															dayData.dateString === checkIn
																? "selected-check-in"
																: ""
														} ${
															dayData.dateString === checkOut
																? "selected-check-out"
																: ""
														}`}
														onClick={() =>
															handleCalendarDayClick(
																dayData.dateString,
																dayData.isBooked
															)
														}
														title={
															dayData.isBooked
																? "Already booked"
																: dayData.isPast
																? "Past date"
																: "Available"
														}
													>
														{dayData.day}
													</div>
												) : (
													<div key={index} className="calendar-day empty"></div>
												)
											)}
										</div>
									</div>
									<div className="calendar-legend">
										<div className="legend-item">
											<span className="legend-color available"></span>Available
										</div>
										<div className="legend-item">
											<span className="legend-color past"></span>Past
										</div>
										<div className="legend-item">
											<span className="legend-color booked"></span>Booked
										</div>
									</div>
									<div className="qf-actions" style={{ marginTop: "0.75rem" }}>
										<button
											className="qf-apply-btn"
											onClick={() => setShowDateModal(false)}
										>
											Done
										</button>
										<button
											className="qf-cancel-btn"
											onClick={() => {
												setCheckIn("")
												setCheckOut("")
												setShowDateModal(false)
											}}
										>
											Clear Dates
										</button>
									</div>
								</div>
							</div>
						</div>
					)}

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
										<div className="listing-category-tag">
											{property.category === "home" && "🏠 Home"}
											{property.category === "experience" && "✨ Experience"}
											{property.category === "service" && "🛎️ Service"}
										</div>
									</div>
									<div className="property-content">
										<div className="property-type-header">
											<span className="type-badge">
												{getPropertyTypeName(property)}
											</span>
										</div>
										<div className="property-header">
											<h3 className="property-title-search">
												{property.title}
											</h3>
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
												{(() => {
													const basePrice = property.pricing?.basePrice || property.pricing?.price || 0
													const { discount, discountedPrice } = getBestVoucherDiscount(property)
													const hasDiscount = discount > 0 && discountedPrice < basePrice
													
													return (
														<>
															{hasDiscount ? (
																<>
																	<div className="property-price-original">
																		<span className="property-price-amount original-price">
																			{formatPrice(basePrice, property.pricing?.currency)}
																		</span>
																	</div>
																	<div className="property-price-discounted">
																		<span className="property-price-amount discounted-price">
																			{formatPrice(discountedPrice, property.pricing?.currency)}
																		</span>
																	</div>
																</>
															) : (
																<>
																	<span className="property-price-amount">
																		{formatPrice(basePrice, property.pricing?.currency)}
																	</span>
																</>
															)}
														</>
													)
												})()}
											</div>
											<div className="property-actions">
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
