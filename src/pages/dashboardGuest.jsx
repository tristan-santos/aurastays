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
	onSnapshot,
	orderBy,
	limit,
} from "firebase/firestore"
import { toast } from "react-stacked-toast"
import Wallet from "../components/Wallet"
import Promos from "../components/Promos"
import "../css/DashboardGuest.css"
import { formatCurrency, formatCurrencyFull } from "../utils/currencyFormatter"
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
	FaPlus,
	FaMinus,
	FaMapMarkerAlt,
	FaCalendarAlt,
	FaBookmark,
	FaGift,
	FaBed,
	FaBath,
	FaHome,
	FaUsers,
	FaParking,
	FaWifi,
	FaUtensils,
	FaStickyNote,
} from "react-icons/fa"

export default function DashboardGuest() {
	const navigate = useNavigate()
	const { currentUser, userData, logout } = useAuth()
	const [searchQuery, setSearchQuery] = useState("")
	// Advanced search filters
	const [whereQuery, setWhereQuery] = useState("")
	const [guests, setGuests] = useState(1)
	const [checkIn, setCheckIn] = useState("")
	const [checkOut, setCheckOut] = useState("")
	const [isMenuOpen, setIsMenuOpen] = useState(false)
	const [activeCategory, setActiveCategory] = useState("home")
	const [properties, setProperties] = useState([])
	const [filteredProperties, setFilteredProperties] = useState([])
	const [recommendedProperties, setRecommendedProperties] = useState([])
	const [isLoading, setIsLoading] = useState(true)
	const [userStats, setUserStats] = useState({
		totalBookings: 0,
		upcomingTrips: 0,
		eWallet: 0,
		wishlistItems: 0,
	})
	const [favorites, setFavorites] = useState([])
	const [wishes, setWishes] = useState([])
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
	const [bookingsForWishes, setBookingsForWishes] = useState([])
	const [wishDrafts, setWishDrafts] = useState({})
	const [showViewWishlistModal, setShowViewWishlistModal] = useState(false)
	const [selectedWishlistToView, setSelectedWishlistToView] = useState(null)
	const [selectedPropertyForWishlist, setSelectedPropertyForWishlist] = useState(null)
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
			// wishes loaded on demand
			await fetchRecentSearches()
		}
		fetchData()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentUser])

	// Fetch recommended properties when properties are loaded
	useEffect(() => {
		if (properties.length > 0 && currentUser?.uid) {
			fetchRecommendedProperties()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [properties, currentUser])

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

			let propertiesList = snapshot.docs
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

			// Dynamically calculate reviews count and rating for each property
			const propertiesWithReviews = await Promise.all(
				propertiesList.map(async (property) => {
					try {
						const reviewsQuery = query(
							collection(db, "reviews"),
							where("propertyId", "==", property.id),
							where("status", "==", "approved")
						)
						const reviewsSnapshot = await getDocs(reviewsQuery)
						const reviews = reviewsSnapshot.docs.map((doc) => doc.data())
						
						if (reviews.length > 0) {
							const totalRating = reviews.reduce(
								(sum, review) => sum + (review.rating || 0),
								0
							)
							const averageRating = totalRating / reviews.length
							
							return {
								...property,
								rating: Math.round(averageRating * 10) / 10,
								reviewsCount: reviews.length,
							}
						} else {
							return {
								...property,
								rating: 0,
								reviewsCount: 0,
							}
						}
					} catch (error) {
						console.error(`Error fetching reviews for property ${property.id}:`, error)
						return property
					}
				})
			)

			// Sort properties: boosted first, then featured, then by rating
			propertiesWithReviews.sort((a, b) => {
				// Boosted properties first
				if (a.boosted && !b.boosted) return -1
				if (!a.boosted && b.boosted) return 1
				
				// Then featured properties
				if (a.featured && !b.featured) return -1
				if (!a.featured && b.featured) return 1
				
				// Then by rating
				const ratingA = a.rating || 0
				const ratingB = b.rating || 0
				return ratingB - ratingA
			})

			setProperties(propertiesWithReviews)

			// Set initial filtered properties (homes) - already sorted by boost/featured/rating
			const homes = propertiesWithReviews.filter((p) => p.category === "home")
			setFilteredProperties(homes)

			console.log("✅ Fetched properties:", propertiesWithReviews.length)
		} catch (error) {
			console.error("Error fetching properties:", error)
			toast.error("Failed to load properties")
		} finally {
			setIsLoading(false)
		}
	}

	const fetchRecommendedProperties = async () => {
		if (!currentUser?.uid || properties.length === 0) return

		try {
			// Fetch previous bookings for the guest
			const bookingsQuery = query(
				collection(db, "bookings"),
				where("guestId", "==", currentUser.uid)
			)

			const bookingsSnapshot = await getDocs(bookingsQuery)
			const today = new Date()
			today.setHours(0, 0, 0, 0)

			// Filter previous bookings (completed, not cancelled)
			const previousBookings = bookingsSnapshot.docs
				.map((doc) => ({
					id: doc.id,
					...doc.data(),
				}))
				.filter((booking) => {
					const checkOutDate = new Date(booking.checkOutDate)
					checkOutDate.setHours(0, 0, 0, 0)
					const status = booking.status || "pending"
					return (
						checkOutDate < today &&
						status !== "cancelled" &&
						status !== "cancellation_requested"
					)
				})
				.sort((a, b) => {
					// Sort by checkOutDate, most recent first
					const dateA = new Date(a.checkOutDate)
					const dateB = new Date(b.checkOutDate)
					return dateB - dateA
				})

			// Get unique property IDs from previous bookings (most recent first)
			const bookedPropertyIds = []
			const seenPropertyIds = new Set()
			for (const booking of previousBookings) {
				if (booking.propertyId && !seenPropertyIds.has(booking.propertyId)) {
					bookedPropertyIds.push(booking.propertyId)
					seenPropertyIds.add(booking.propertyId)
				}
			}

			// Get properties from previous bookings
			const bookedProperties = properties
				.filter((p) => bookedPropertyIds.includes(p.id))
				.sort((a, b) => {
					// Maintain order of most recent booking
					const indexA = bookedPropertyIds.indexOf(a.id)
					const indexB = bookedPropertyIds.indexOf(b.id)
					return indexA - indexB
				})

			// If we have less than 8 properties from bookings, fill with random properties
			let recommended = [...bookedProperties]
			if (recommended.length < 8) {
				const remainingSlots = 8 - recommended.length
				const bookedPropertyIdSet = new Set(bookedPropertyIds)
				
				// Get random properties that haven't been booked
				const availableProperties = properties
					.filter((p) => !bookedPropertyIdSet.has(p.id))
					.sort(() => Math.random() - 0.5) // Shuffle
					.slice(0, remainingSlots)
				
				recommended = [...recommended, ...availableProperties]
			} else {
				// Limit to 8 if we have more
				recommended = recommended.slice(0, 8)
			}

			setRecommendedProperties(recommended)
		} catch (error) {
			console.error("Error fetching recommended properties:", error)
			// Fallback: show random properties if there's an error
			const shuffled = [...properties].sort(() => Math.random() - 0.5)
			setRecommendedProperties(shuffled.slice(0, 8))
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

				// Count upcoming trips (exclude cancelled bookings)
				upcomingTrips = bookings.filter((booking) => {
					const checkInDate = new Date(booking.checkInDate)
					checkInDate.setHours(0, 0, 0, 0)
					const status = booking.status || "pending"
					// Exclude cancelled bookings from upcoming trips count
					return checkInDate >= today && status !== "cancelled"
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

const fetchUserWishes = async () => {
    if (!currentUser?.uid) return
    try {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid))
        if (userDoc.exists()) {
            const data = userDoc.data()
            const existing = Array.isArray(data.wishes) ? data.wishes : []
            setWishes(existing)
            const drafts = {}
            existing.forEach((w) => (drafts[w.propertyId] = w.text || ""))
            setWishDrafts(drafts)
        }
    } catch (error) {
        console.error("Error fetching wishes:", error)
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
				// Filter out empty or whitespace-only searches
				const validSearches = searches.filter(
					(s) => s.query && s.query.trim().length > 0
				)
				// Get the last 5 searches and sort by timestamp descending
				const sortedSearches = validSearches
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
		// Build combined query: prefer explicit whereQuery, fallback to searchQuery
		const combinedQuery = (whereQuery || searchQuery).trim()
		if (!combinedQuery) return

		// Save search to Firebase - only save non-empty queries
		if (currentUser?.uid && combinedQuery && combinedQuery.length > 0) {
			try {
				const userDocRef = doc(db, "users", currentUser.uid)
				const userDoc = await getDoc(userDocRef)

				if (userDoc.exists()) {
					const userData = userDoc.data()
					let searches = userData.recentSearches || []

					// Check if the exact same query already exists (case-sensitive)
					const existingIndex = searches.findIndex(
						(s) => s.query === combinedQuery
					)

					if (existingIndex !== -1) {
						// Remove the old entry
						searches.splice(existingIndex, 1)
					}

					// Add the new/updated search at the end
					searches.push({
						query: combinedQuery,
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

		// Navigate to search page with params
		const params = new URLSearchParams()
		params.set("q", combinedQuery)
		if (guests) params.set("guests", String(guests))
		if (checkIn) params.set("checkIn", checkIn)
		if (checkOut) params.set("checkOut", checkOut)
		navigate(`/search?${params.toString()}`)
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
			history.go(0)
			window.location.reload()
			window.location.href = "/"
			window.location.reload()
		} catch (error) {
			console.error("Error logging out dashboard:", error)
		}
	}

	// Get appropriate dashboard route based on user type
	const getDashboardRoute = () => {
		if (!userData?.userType) return "/dashboardGuest"
		if (userData.userType === "admin") return "/admin"
		if (userData.userType === "host") return "/dashboardHost"
		return "/dashboardGuest"
	}

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
				checkInDate.setHours(0, 0, 0, 0)
				const status = booking.status || "pending"
				// Exclude cancelled bookings from upcoming trips
				return checkInDate >= today && status !== "cancelled"
			})

			const previous = bookingsWithImages.filter((booking) => {
				const checkOutDate = new Date(booking.checkOutDate)
				checkOutDate.setHours(0, 0, 0, 0)
				const status = booking.status || "pending"
				// Only include completed bookings (not cancelled) in previous
				return checkOutDate < today && status !== "cancelled" && status !== "cancellation_requested"
			})

			// Deduplicate previous bookings by propertyId - keep only one booking per property
			// Prefer the most recent booking (latest checkOutDate) for each property
			const uniquePreviousProperties = new Map()
			previous.forEach((booking) => {
				const existing = uniquePreviousProperties.get(booking.propertyId)
				if (!existing) {
					uniquePreviousProperties.set(booking.propertyId, booking)
				} else {
					// Keep the booking with the most recent checkOutDate
					const existingDate = new Date(existing.checkOutDate)
					const currentDate = new Date(booking.checkOutDate)
					if (currentDate > existingDate) {
						uniquePreviousProperties.set(booking.propertyId, booking)
					}
				}
			})
			const uniquePrevious = Array.from(uniquePreviousProperties.values())

			console.log("🔍 Upcoming bookings:", upcoming.length)
			console.log("🔍 Previous bookings:", previous.length)
			console.log("🔍 Unique previous bookings:", uniquePrevious.length)

			setBookingsList({ upcoming, previous: uniquePrevious })
			console.log("🔍 Bookings list state updated")
		} catch (error) {
			console.error("❌ Error fetching bookings:", error)
			setBookingsList({ upcoming: [], previous: [] })
		}
	}

	// Fetch wishlist properties
	const handleViewWishlist = async (wishlist, booking) => {
		setSelectedWishlistToView(wishlist)
		try {
			// Fetch property details
			const propertyDoc = await getDoc(doc(db, "properties", wishlist.propertyId))
			if (propertyDoc.exists()) {
				setSelectedPropertyForWishlist({ id: propertyDoc.id, ...propertyDoc.data() })
			} else {
				// Use booking data if property not found
				setSelectedPropertyForWishlist({
					id: wishlist.propertyId,
					title: booking.propertyTitle || "Property",
					images: booking.propertyImage ? [booking.propertyImage] : [],
					location: booking.propertyLocation || {},
				})
			}
			setShowViewWishlistModal(true)
		} catch (error) {
			console.error("Error fetching property for wishlist:", error)
			// Use booking data as fallback
			setSelectedPropertyForWishlist({
				id: wishlist.propertyId,
				title: booking.propertyTitle || "Property",
				images: booking.propertyImage ? [booking.propertyImage] : [],
				location: booking.propertyLocation || {},
			})
			setShowViewWishlistModal(true)
		}
	}

	const handleShowWishlist = async () => {
    setIsMenuOpen(false)
    setShowWishlistModal(true)
    await fetchUserWishes()
    try {
        const bookingsQueryRef = query(
            collection(db, "bookings"),
            where("guestId", "==", currentUser.uid)
        )
        const bookingsSnapshot = await getDocs(bookingsQueryRef)
        const raw = bookingsSnapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
        }))
        
        // Filter to only show previous bookings (completed bookings)
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const previousBookings = raw.filter((booking) => {
            const checkOutDate = new Date(booking.checkOutDate)
            checkOutDate.setHours(0, 0, 0, 0)
            return checkOutDate < today
        })
        
        const withImages = await Promise.all(
            previousBookings.map(async (b) => {
                try {
                    const propertyDoc = await getDoc(doc(db, "properties", b.propertyId))
                    const prop = propertyDoc.exists() ? propertyDoc.data() : {}
                    return {
                        ...b,
                        propertyTitle: b.propertyTitle || prop.title,
                        propertyImage: prop.images?.[0] || null,
                    }
                } catch {
                    return b
                }
            })
        )
        
        // Deduplicate by propertyId - keep only one booking per property
        // Prefer the most recent booking (latest checkOutDate) for each property
        const uniqueProperties = new Map()
        withImages.forEach((booking) => {
            const existing = uniqueProperties.get(booking.propertyId)
            if (!existing) {
                uniqueProperties.set(booking.propertyId, booking)
            } else {
                // Keep the booking with the most recent checkOutDate
                const existingDate = new Date(existing.checkOutDate)
                const currentDate = new Date(booking.checkOutDate)
                if (currentDate > existingDate) {
                    uniqueProperties.set(booking.propertyId, booking)
                }
            }
        })
        
        // Convert Map to Array
        const uniqueBookings = Array.from(uniqueProperties.values())
        setBookingsForWishes(uniqueBookings)
    } catch (e) {
        console.error("Error loading bookings for wishes:", e)
        setBookingsForWishes([])
    }
}

	// Quick actions handlers
	const handleSearchStays = () => {
		const searchInput = document.querySelector(".navbar-search input")
		if (searchInput) {
			searchInput.focus()
		}
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

	const saveWish = async (propertyId, wish) => {
		if (!currentUser?.uid) {
			toast.error("Please login to save a wish")
			return
		}

		try {
			const userDocRef = doc(db, "users", currentUser.uid)
			const userDoc = await getDoc(userDocRef)

			if (userDoc.exists()) {
				const data = userDoc.data()
				const existingWishes = Array.isArray(data.wishes) ? data.wishes : []
				const existingWish = existingWishes.find((w) => w.propertyId === propertyId)

				if (existingWish) {
					// Update existing wish
					const updatedWishes = existingWishes.map((w) =>
						w.propertyId === propertyId ? { ...w, ...wish } : w
					)
					await updateDoc(userDocRef, { wishes: updatedWishes })
					setWishes(updatedWishes)
					toast.success("Wish updated successfully!")
				} else {
					// Add new wish
					const newWish = {
						propertyId: propertyId,
						beds: wish.beds,
						bathrooms: wish.bathrooms,
						guests: wish.guests,
						text: wish.text,
						createdAt: new Date().toISOString(),
					}
					await updateDoc(userDocRef, { wishes: arrayUnion(newWish) })
					setWishes([...wishes, newWish])
					toast.success("Wish added successfully!")
				}
				await fetchUserWishes() // Refresh user document
			}
		} catch (error) {
			console.error("Error saving wish:", error)
			toast.error("Failed to save wish")
		}
	}

	const deleteWish = async (propertyId) => {
		if (!currentUser?.uid) {
			toast.error("Please login to delete a wish")
			return
		}

		try {
			const userDocRef = doc(db, "users", currentUser.uid)
			const userDoc = await getDoc(userDocRef)

			if (userDoc.exists()) {
				const data = userDoc.data()
				const existingWishes = Array.isArray(data.wishes) ? data.wishes : []
				const updatedWishes = existingWishes.filter(
					(w) => w.propertyId !== propertyId
				)
				await updateDoc(userDocRef, { wishes: updatedWishes })
				setWishes(updatedWishes)
				toast.success("Wish removed successfully!")
				await fetchUserWishes() // Refresh user document
			}
		} catch (error) {
			console.error("Error deleting wish:", error)
			toast.error("Failed to delete wish")
		}
	}

	return (
		<div className="dashboard-guest-container">
			{/* Top Navigation Bar */}
			<nav className="top-navbar">
				{/* Logo */}
				<div className="navbar-logo" onClick={() => navigate(getDashboardRoute())} style={{ cursor: "pointer" }}>
					<img src={logoPlain} alt="AuraStays" />
					<span className="logo-text">AuraStays</span>
				</div>

				{/* Search Bar */}
				<form className="navbar-search" onSubmit={handleSearch}>
					<FaSearch className="search-icon" />
					<input
						type="text"
						placeholder="Search destinations, hotels, experiences..."
						value={whereQuery}
						onChange={(e) => setWhereQuery(e.target.value)}
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
							handleShowWishlist()
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
							<div className="quick-stat-label">Previous Bookings</div>
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
							<div className="quick-stat-label">Upcoming Trips</div>
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
								{formatCurrency(userStats.eWallet)}
							</div>
							<div className="quick-stat-label">E-Wallet</div>
						</div>
					</div>
				</div>

				{/* Promotional Banner */}
				<section className="promo-banner">
					<div className="promo-content-guest">
						<div className="promo-text">
							<h3>✨ Early Bird Promo!</h3>
							<p>Get exclusive discounts on properties with Early Bird special offers</p>
						</div>
						<button 
							className="promo-btn"
							onClick={() => navigate("/search?voucher=early_bird")}
						>
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
															<span className="listing-icon">🛏️</span>
															<span className="detail-text">
																{property.capacity.beds} beds
															</span>
														</div>
														<div className="detail-item">
															<span className="listing-icon">🛁</span>
															<span className="detail-text">
																{property.capacity.bathrooms} bath
															</span>
														</div>
														<div className="detail-item">
															<span className="listing-icon">👥</span>
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
																<span className="listing-icon">⏰</span>
																<span className="detail-text">
																	{property.duration.hours}h
																</span>
															</div>
															<div className="detail-item">
																<span className="listing-icon">👥</span>
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
															<span className="listing-icon">📍</span>
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
															onClick={() =>
																navigate(`/property/${property.id}`)
															}
														>
															View Details
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

				{/* Recommendation */}
				<section className="popular-section">
					<div className="section-header">
						<h3>✨ Recommendation</h3>
						<button className="view-all-btn">View All</button>
					</div>
					<div className="popular-scroll">
						{isLoading ? (
							<p>Loading...</p>
						) : recommendedProperties.length === 0 ? (
							<div className="no-results" style={{ padding: "2rem", textAlign: "center", width: "100%" }}>
								<p>No recommendations available at the moment</p>
							</div>
						) : (
							recommendedProperties.map((property) => (
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
											<span className="rating">{property.rating || 0}</span>
											<span className="reviews">({property.reviewsCount || 0})</span>
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
													cursor: booking.status === "cancelled" || booking.status === "cancellation_requested" ? "default" : "pointer",
												}}
												onClick={() => {
													// Don't navigate if booking is cancelled
													if (booking.status !== "cancelled" && booking.status !== "cancellation_requested") {
														navigate(`/property/${booking.propertyId}`)
													}
												}}
											>
												<span
													className={`booking-status-badge ${
														bookingsModalType === "previous" && booking.status === "confirmed"
															? "completed"
															: booking.status
													}`}
												>
													{bookingsModalType === "previous" && booking.status === "confirmed"
														? "Completed"
														: booking.status}
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
											</div>

											{/* Review Section for Previous Bookings - Outside booking-info */}
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

						<div className="wishlist-modal-body">
							{bookingsForWishes && bookingsForWishes.length > 0 ? (
								<div className="wishlist-grid">
									{bookingsForWishes.map((b) => {
										const existing = (wishes || []).find((w) => w.propertyId === b.propertyId)
										const draft = wishDrafts?.[b.propertyId] || {}
										const bedsVal = draft.beds ?? existing?.beds ?? ""
										const bathsVal = draft.bathrooms ?? existing?.bathrooms ?? ""
										const guestsVal = draft.guests ?? existing?.guests ?? ""
										return (
											<div key={b.id} className="wishlist-card">
												<div
													className="wishlist-image"
													style={{ backgroundImage: `url(${b.propertyImage || housePlaceholder})` }}
												></div>
												<div className="wishlist-info">
													<h4 className="wishlist-title">{b.propertyTitle || "Property"}</h4>
													<p className="wishlist-location"><FaCalendarAlt />{new Date(b.checkInDate).toLocaleDateString()} - {new Date(b.checkOutDate).toLocaleDateString()}</p>

													<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, marginBottom: 8 }}>
														{b.category === "home" && (
															<>
																<div>
																	<label style={{ fontSize: 12, fontWeight: 600, color: "#555" }}>Beds</label>
																	<input type="number" min="0" value={bedsVal}
																		onChange={(e) => setWishDrafts({ ...wishDrafts, [b.propertyId]: { ...(wishDrafts?.[b.propertyId] || {}), beds: parseInt(e.target.value || "0", 10) } })} />
																</div>
																<div>
																	<label style={{ fontSize: 12, fontWeight: 600, color: "#555" }}>Bathrooms</label>
																	<input type="number" min="0" value={bathsVal}
																		onChange={(e) => setWishDrafts({ ...wishDrafts, [b.propertyId]: { ...(wishDrafts?.[b.propertyId] || {}), bathrooms: parseInt(e.target.value || "0", 10) } })} />
																</div>
																<div>
																	<label style={{ fontSize: 12, fontWeight: 600, color: "#555" }}>Guests</label>
																	<input type="number" min="0" value={guestsVal}
																		onChange={(e) => setWishDrafts({ ...wishDrafts, [b.propertyId]: { ...(wishDrafts?.[b.propertyId] || {}), guests: parseInt(e.target.value || "0", 10) } })} />
																</div>
															</>
														)}
													</div>

													<div className="review-actions" style={{ marginTop: 8 }}>
														{existing?.isCreated === true ? (
															<button
																className="submit-review-btn"
																onClick={() => handleViewWishlist(existing, b)}
															>
																<FaBookmark /> View Wishlist
															</button>
														) : (
															<button
																className="submit-review-btn"
																onClick={() => navigate(`/wishlist/new?propertyId=${b.propertyId}`, { state: { bookingId: b.id } })}
															>
																Create Wishlist
															</button>
														)}
													</div>
												</div>
											</div>
									)
									})}
								</div>
							) : (
								<div className="empty-wishlist">
									<FaBookmark className="empty-icon" />
									<h3>No bookings to add to Wishlist</h3>
									<p>Book a property to leave your improvement wishlist.</p>
								</div>
							)}
						</div>
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
						<div className="review-modal-header">
							<h2 className="review-modal-title">
								{selectedBookingForReview.hasReview
									? "📝 Your Review"
									: "✍️ Write a Review"}
							</h2>
							<button
								className="close-review-modal-btn"
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

			{/* View Wishlist Modal */}
			{showViewWishlistModal && selectedWishlistToView && selectedPropertyForWishlist && (
				<div
					className="modal-overlay wishlist-view-modal-overlay"
					onClick={() => setShowViewWishlistModal(false)}
				>
					<div
						className="modal-content wishlist-view-modal-content"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="wishlist-modal-header">
							<h2>
								<FaBookmark style={{ color: "var(--primary)" }} /> My Wishlist
							</h2>
							<button
								className="close-modal-btn"
								onClick={() => setShowViewWishlistModal(false)}
							>
								×
							</button>
						</div>

						<div className="wishlist-view-body">
							{/* Property Info */}
							<div className="wishlist-property-header">
								<img
									src={selectedPropertyForWishlist.images?.[0] || housePlaceholder}
									alt={selectedPropertyForWishlist.title}
									className="wishlist-property-image"
								/>
								<div className="wishlist-property-info">
									<h3>{selectedPropertyForWishlist.title}</h3>
									{selectedPropertyForWishlist.location && (
										<div className="wishlist-location">
											<FaMapMarkerAlt />
											<span>
												{selectedPropertyForWishlist.location.city}, {selectedPropertyForWishlist.location.province}
											</span>
										</div>
									)}
								</div>
							</div>

							{/* Wishlist Details */}
							<div className="wishlist-details-section">
								<h4>Your Wishes</h4>
								<div className="wishlist-details-grid">
									{selectedWishlistToView.beds !== undefined && selectedWishlistToView.beds !== null && (
										<div className="wishlist-detail-item">
											<FaBed className="wishlist-detail-icon" />
											<div>
												<span className="detail-label">Beds</span>
												<span className="detail-value">{selectedWishlistToView.beds}</span>
											</div>
										</div>
									)}
									{selectedWishlistToView.bathrooms !== undefined && selectedWishlistToView.bathrooms !== null && (
										<div className="wishlist-detail-item">
											<FaBath className="wishlist-detail-icon" />
											<div>
												<span className="detail-label">Bathrooms</span>
												<span className="detail-value">{selectedWishlistToView.bathrooms}</span>
											</div>
										</div>
									)}
									{selectedWishlistToView.bedrooms !== undefined && selectedWishlistToView.bedrooms !== null && (
										<div className="wishlist-detail-item">
											<FaHome className="wishlist-detail-icon" />
											<div>
												<span className="detail-label">Bedrooms</span>
												<span className="detail-value">{selectedWishlistToView.bedrooms}</span>
											</div>
										</div>
									)}
									{selectedWishlistToView.guests !== undefined && selectedWishlistToView.guests !== null && (
										<div className="wishlist-detail-item">
											<FaUsers className="wishlist-detail-icon" />
											<div>
												<span className="detail-label">Guests</span>
												<span className="detail-value">{selectedWishlistToView.guests}</span>
											</div>
										</div>
									)}
									{selectedWishlistToView.parkingSpaces !== undefined && selectedWishlistToView.parkingSpaces !== null && (
										<div className="wishlist-detail-item">
											<FaParking className="wishlist-detail-icon" />
											<div>
												<span className="detail-label">Parking Spaces</span>
												<span className="detail-value">{selectedWishlistToView.parkingSpaces}</span>
											</div>
										</div>
									)}
									{selectedWishlistToView.wifiSpeed !== undefined && selectedWishlistToView.wifiSpeed !== null && selectedWishlistToView.wifiSpeed > 0 && (
										<div className="wishlist-detail-item">
											<FaWifi className="wishlist-detail-icon" />
											<div>
												<span className="detail-label">Wi-Fi Speed</span>
												<span className="detail-value">{selectedWishlistToView.wifiSpeed} Mbps</span>
											</div>
										</div>
									)}
								</div>

								{selectedWishlistToView.breakfastIncluded && (
									<div className="wishlist-offer-item">
										<FaUtensils className="offer-icon" />
										<span>Breakfast Included</span>
									</div>
								)}

								{selectedWishlistToView.notes && (
									<div className="wishlist-notes">
										<h5>
											<FaStickyNote /> Additional Notes
										</h5>
										<p>{selectedWishlistToView.notes}</p>
									</div>
								)}

								{selectedWishlistToView.createdAt && (
									<div className="wishlist-date">
										Created: {new Date(selectedWishlistToView.createdAt).toLocaleDateString()}
									</div>
								)}
							</div>
						</div>

						<div className="wishlist-modal-footer">
							<button
								className="btn-close-modal"
								onClick={() => setShowViewWishlistModal(false)}
							>
								Close
							</button>
							<button
								className="btn-edit-wishlist"
								onClick={() => {
									setShowViewWishlistModal(false)
									navigate(`/wishlist/new?propertyId=${selectedWishlistToView.propertyId}`)
								}}
							>
								Edit Wishlist
							</button>
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
