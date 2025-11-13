import { useState, useEffect, useRef } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import { db } from "../components/firebaseConfig"
import {
	doc,
	getDoc,
	updateDoc,
	arrayUnion,
	arrayRemove,
	collection,
	query,
	where,
	getDocs,
	orderBy,
	addDoc,
	deleteDoc,
	serverTimestamp,
} from "firebase/firestore"
import { toast } from "react-stacked-toast"
import emailjs from "@emailjs/browser"
import { sendHostBookingConfirmation } from "../utils/hostEmailService"
import { getFirebaseErrorMessage } from "../utils/errorMessages"
import { formatCurrencyFull } from "../utils/currencyFormatter"
import {
	FaArrowLeft,
	FaHeart,
	FaShare,
	FaStar,
	FaMapMarkerAlt,
	FaUser,
	FaCalendarAlt,
	FaCalendarCheck,
	FaBookmark,
	FaFacebook,
	FaTwitter,
	FaInstagram,
	FaLinkedin,
	FaWhatsapp,
	FaCopy,
	FaTimes,
	FaCheck,
	FaShieldAlt,
	FaMedal,
	FaClock,
	FaWallet,
	FaTag,
	FaGift,
	FaHistory,
	FaUsers,
	FaFlag,
	FaTrash,
	FaBars,
	FaSignOutAlt,
	FaEnvelope,
	FaCrown,
	FaChevronLeft,
	FaChevronRight,
	FaHome,
	FaPlus,
	FaMinus,
	FaBed,
	FaBath,
	FaParking,
	FaWifi,
	FaUtensils,
	FaStickyNote,
	FaEye,
} from "react-icons/fa"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import "../css/PropertyDetails.css"
import "../css/DashboardGuest.css"
import housePlaceholder from "../assets/housePlaceholder.png"
import logoPlain from "../assets/logoPlain.png"
import ContactHostModal from "../components/ContactHostModal"

// Mapbox token
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

// Initialize EmailJS (Guest)
emailjs.init(import.meta.env.VITE_EMAILJS_GUEST_PUBLIC_KEY)

export default function PropertyDetails() {
	const { propertyId } = useParams()
	const navigate = useNavigate()
	const { currentUser, userData, logout } = useAuth()
	const [property, setProperty] = useState(null)
	const [loading, setLoading] = useState(true)
	const [isFavorite, setIsFavorite] = useState(false)
	const [isInWishlist, setIsInWishlist] = useState(false)
	const [selectedImage, setSelectedImage] = useState(0)
	const [showShareModal, setShowShareModal] = useState(false)
	const [showReportModal, setShowReportModal] = useState(false)
	const [reportReason, setReportReason] = useState("")
	const [reportDescription, setReportDescription] = useState("")
	const [isSubmittingReport, setIsSubmittingReport] = useState(false)
	const [showAllPhotos, setShowAllPhotos] = useState(false)
	const [showFullSizeImage, setShowFullSizeImage] = useState(false)
	const [fullSizeImageIndex, setFullSizeImageIndex] = useState(0)
	const [showWalletPaymentModal, setShowWalletPaymentModal] = useState(false)
	const [showContactHostModal, setShowContactHostModal] = useState(false)
	const [bookedDates, setBookedDates] = useState([])
	const [propertyBlockedDates, setPropertyBlockedDates] = useState([])
	const [bookingDates, setBookingDates] = useState([])
	const [currentMonth, setCurrentMonth] = useState(new Date())
	const [isDeletingProperty, setIsDeletingProperty] = useState(false)
	const [showDatePickerModal, setShowDatePickerModal] = useState(false)
	const [selectingCheckIn, setSelectingCheckIn] = useState(true)

	// Booking states
	const [checkInDate, setCheckInDate] = useState("")
	const [checkOutDate, setCheckOutDate] = useState("")
	const [numberOfGuests, setNumberOfGuests] = useState(1)
	const [isProcessingPayment, setIsProcessingPayment] = useState(false)
	const [isPayPalLoaded, setIsPayPalLoaded] = useState(false)
	const [paymentMethod, setPaymentMethod] = useState("paypal") // 'paypal' or 'wallet'
	const [walletBalance, setWalletBalance] = useState(0)

	// Promo code states
	const [promoCode, setPromoCode] = useState("")
	const [appliedPromo, setAppliedPromo] = useState(null)
	const [promoDiscount, setPromoDiscount] = useState(0)
	const [isValidatingPromo, setIsValidatingPromo] = useState(false)
	const [autoAppliedVoucher, setAutoAppliedVoucher] = useState(null) // Automatically applied voucher from property.vouchers

	// Platform policies from admin
	const [platformPolicies, setPlatformPolicies] = useState({
		serviceFeeGuest: 800,
		guestFeePerPerson: 100,
	})

	// Reviews state
	const [reviews, setReviews] = useState([])
	const [userCompletedBookings, setUserCompletedBookings] = useState([])
	const [showReviewModal, setShowReviewModal] = useState(false)

	// Wishlists state
	const [propertyWishlists, setPropertyWishlists] = useState([])
	const [selectedWishlist, setSelectedWishlist] = useState(null)
	const [showWishlistModal, setShowWishlistModal] = useState(false)

	// Host-specific states
	const [propertyPromos, setPropertyPromos] = useState([])
	const [propertyBookings, setPropertyBookings] = useState([])
	const [isHost, setIsHost] = useState(false)
	// Guest view - property coupons
	const [propertyCoupons, setPropertyCoupons] = useState([])
	const [showManagePromosModal, setShowManagePromosModal] = useState(false)
	const [showAllBookingsModal, setShowAllBookingsModal] = useState(false)
	const [editingPromo, setEditingPromo] = useState(null)
	const [editPromoDiscount, setEditPromoDiscount] = useState("")
	const [editPromoDiscountType, setEditPromoDiscountType] =
		useState("percentage")
	const [editPromoValidFrom, setEditPromoValidFrom] = useState("")
	const [editPromoValidUntil, setEditPromoValidUntil] = useState("")
	const [editPromoMinDays, setEditPromoMinDays] = useState("")
	const [editPromoIsActive, setEditPromoIsActive] = useState(true)
	const [isUpdatingPromo, setIsUpdatingPromo] = useState(false)
	
	// Create new promo states
	const [showCreatePromoForm, setShowCreatePromoForm] = useState(false)
	const [newCoupon, setNewCoupon] = useState({
		code: "",
		description: "",
		discountType: "percentage",
		discountValue: 0,
		minPurchase: 0,
		maxDiscount: 0,
		usageLimit: 0,
		usagePerUser: 1,
		validFrom: "",
		validUntil: "",
		isActive: true,
	})
	const [showCouponDateModal, setShowCouponDateModal] = useState(false)
	const [selectingValidFrom, setSelectingValidFrom] = useState(true)
	const [couponCurrentMonth, setCouponCurrentMonth] = useState(new Date())
	const [isCreatingPromo, setIsCreatingPromo] = useState(false)
	const [reviewFormData, setReviewFormData] = useState({
		rating: 5,
		comment: "",
		cleanliness: 5,
		accuracy: 5,
		communication: 5,
		location: 5,
		checkIn: 5,
		value: 5,
	})
	const [isSubmittingReview, setIsSubmittingReview] = useState(false)
	const [isMenuOpen, setIsMenuOpen] = useState(false)
	const [theme, setTheme] = useState(localStorage.getItem("theme") || "light")

	// Get user's display name
	const displayName =
		userData?.displayName || currentUser?.displayName || "User"
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

	// Keyboard navigation for full-size image modal
	useEffect(() => {
		if (!showFullSizeImage || !property) return

		const imagesList = property.images || []
		if (imagesList.length === 0) return

		const handleKeyDown = (e) => {
			if (e.key === "Escape") {
				setShowFullSizeImage(false)
			} else if (e.key === "ArrowLeft" && imagesList.length > 1) {
				setFullSizeImageIndex((prev) => (prev === 0 ? imagesList.length - 1 : prev - 1))
			} else if (e.key === "ArrowRight" && imagesList.length > 1) {
				setFullSizeImageIndex((prev) => (prev === imagesList.length - 1 ? 0 : prev + 1))
			}
		}

		document.addEventListener("keydown", handleKeyDown)
		return () => {
			document.removeEventListener("keydown", handleKeyDown)
		}
	}, [showFullSizeImage, property])

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
		if (!userData?.userType) return "/dashboardGuest"
		if (userData.userType === "admin") return "/admin"
		if (userData.userType === "host") return "/dashboardHost"
		return "/dashboardGuest"
	}

	// Map ref
	const mapContainer = useRef(null)
	const map = useRef(null)
	const paypalRef = useRef(null)

	// Get the full shareable URL
	const shareableUrl = `${window.location.origin}/property/${propertyId}`

	// Fetch property coupons for guest view
	const fetchPropertyCoupons = async (propId) => {
		if (!propId) return
		try {
			const couponsQuery = query(
				collection(db, "promos"),
				where("propertyId", "==", propId),
				where("isActive", "==", true)
			)
			const couponsSnapshot = await getDocs(couponsQuery)
			const coupons = couponsSnapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			}))
			
			// Filter out expired coupons
			const now = new Date()
			const activeCoupons = coupons.filter((coupon) => {
				if (coupon.validUntil) {
					return new Date(coupon.validUntil) >= now
				}
				return true
			})
			
			setPropertyCoupons(activeCoupons)
		} catch (error) {
			console.error("Error fetching property coupons:", error)
		}
	}

	useEffect(() => {
		fetchPropertyDetails()
		fetchBookedDates()
		fetchPlatformPolicies()
		fetchReviews()
		if (currentUser) {
			checkFavoriteStatus()
			checkWishlistStatus()
			fetchWalletBalance()
			checkUserBookings()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [propertyId, currentUser])

	useEffect(() => {
		if (property && currentUser) {
			fetchPropertyWishlists()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [property, currentUser])

	// Merge booking dates and blocked dates
	useEffect(() => {
		const merged = Array.from(
			new Set([...(bookingDates || []), ...propertyBlockedDates])
		)
		setBookedDates(merged)
	}, [bookingDates, propertyBlockedDates])

	// Update isHost when property changes and fetch host-specific data
	useEffect(() => {
		if (property && currentUser) {
			const hostId = property.hostId || property.host?.hostId
			const userIsHost = hostId === currentUser.uid
			setIsHost(userIsHost)

			if (userIsHost) {
				// Fetch property promos and booking history for host
				fetchPropertyPromos(property.id)
				fetchPropertyBookings(property.id)
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [property, currentUser])

	// Fetch coupons for guest view when property loads
	useEffect(() => {
		if (property?.id) {
			fetchPropertyCoupons(property.id)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [property?.id])

	// Auto-apply vouchers when dates change
	useEffect(() => {
		if (!isHost && property && checkInDate && checkOutDate) {
			findAndApplyBestVoucher()
		} else {
			setAutoAppliedVoucher(null)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [checkInDate, checkOutDate, property, numberOfGuests])

	// Load PayPal script
	useEffect(() => {
		// Check if PayPal is already loaded
		if (window.paypal) {
			setIsPayPalLoaded(true)
			console.log("PayPal SDK already loaded")
			return
		}

		// Check if script already exists
		const existingScript = document.querySelector(
			'script[src*="paypal.com/sdk"]'
		)
		if (existingScript) {
			existingScript.onload = () => {
				setIsPayPalLoaded(true)
				console.log("PayPal SDK loaded from existing script")
			}
			return
		}

		const script = document.createElement("script")
		script.src = `https://www.paypal.com/sdk/js?client-id=${
			import.meta.env.VITE_PAYPAL_CLIENT_ID
		}&currency=PHP`
		script.async = true
		script.onload = () => {
			setIsPayPalLoaded(true)
			console.log("PayPal SDK loaded successfully")
		}
		script.onerror = () => {
			console.error("Failed to load PayPal SDK")
			toast.error("Failed to load PayPal. Please refresh the page.")
		}
		document.body.appendChild(script)

		// Don't remove the script on cleanup to avoid reloading issues
	}, [])

	// Initialize map when property is loaded
	useEffect(() => {
		if (!property || !mapContainer.current || map.current) return

		// Extract coordinates with proper validation
		let lng = 121.0244 // Default: Manila
		let lat = 14.5547

		if (property.location?.coordinates) {
			const coords = property.location.coordinates
			// Handle different coordinate formats
			if (typeof coords.lng === "number" && typeof coords.lat === "number") {
				lng = coords.lng
				lat = coords.lat
			} else if (
				typeof coords.longitude === "number" &&
				typeof coords.latitude === "number"
			) {
				lng = coords.longitude
				lat = coords.latitude
			} else if (Array.isArray(coords) && coords.length >= 2) {
				// Handle [lng, lat] array format
				lng = coords[0]
				lat = coords[1]
			}
		}

		// Validate that we have valid numbers
		if (isNaN(lng) || isNaN(lat)) {
			lng = 121.0244
			lat = 14.5547
			console.warn("Invalid coordinates, using default Manila location")
		}

		try {
			map.current = new mapboxgl.Map({
				container: mapContainer.current,
				style: "mapbox://styles/mapbox/streets-v12",
				center: [lng, lat],
				zoom: 13,
			})

			// Add marker
			new mapboxgl.Marker({ color: "#415f94" })
				.setLngLat([lng, lat])
				.addTo(map.current)

			// Add navigation controls
			map.current.addControl(new mapboxgl.NavigationControl(), "top-right")
		} catch (error) {
			console.error("Error initializing map:", error)
		}

		return () => {
			if (map.current) {
				map.current.remove()
				map.current = null
			}
		}
	}, [property])

	const fetchPropertyDetails = async () => {
		try {
			console.log("🔍 Fetching property details...")
			console.log("📋 Property ID from URL:", propertyId)
			console.log("📋 Property ID type:", typeof propertyId)

			const propertyDocRef = doc(db, "properties", propertyId)
			console.log("📄 Document reference:", propertyDocRef.path)

			const propertyDoc = await getDoc(propertyDocRef)
			console.log("📄 Document exists:", propertyDoc.exists())
			console.log("📄 Document ID:", propertyDoc.id)

			if (propertyDoc.exists()) {
				const propertyData = propertyDoc.data()
				// Load blocked dates if available on property document
				const blocked = Array.isArray(propertyData?.blockedDates)
					? propertyData.blockedDates
					: []
				setPropertyBlockedDates(blocked)
				console.log("✅ Property found!")
				console.log("📋 Property data:", propertyData)
				console.log("📋 Property title:", propertyData?.title)
				console.log("📋 Property hostId:", propertyData?.hostId)
				// Ensure Firestore document ID wins over any internal data.id
				const propertyWithId = { ...propertyData, id: propertyDoc.id }
				setProperty(propertyWithId)
			} else {
				console.error("❌ Property document does not exist!")
				console.log("🔍 Attempting to find property with different methods...")

				// Try to find property by searching all properties
				try {
					const allPropertiesQuery = query(collection(db, "properties"))
					const allPropertiesSnapshot = await getDocs(allPropertiesQuery)
					console.log(
						"📋 Total properties in database:",
						allPropertiesSnapshot.size
					)

					const allPropertyIds = allPropertiesSnapshot.docs.map((doc) => ({
						id: doc.id,
						title: doc.data()?.title,
						hostId: doc.data()?.hostId,
					}))
					console.log("📋 All property IDs:", allPropertyIds)

					// Check if propertyId exists in any property's data.id field or document ID
					const foundByDataId = allPropertiesSnapshot.docs.find((doc) => {
						const data = doc.data()
						// Check both the custom id field and the Firestore document ID
						return data.id === propertyId || doc.id === propertyId
					})

					if (foundByDataId) {
						console.log("✅ Found property by searching!")
						console.log("📋 Custom ID in data:", foundByDataId.data()?.id)
						console.log("📋 Firestore Document ID:", foundByDataId.id)
						console.log("📋 Property title:", foundByDataId.data()?.title)

						const propertyData = foundByDataId.data()
						// Remove the custom id field and use Firestore document ID
						const { id: customId, ...dataWithoutId } = propertyData
						const propertyWithId = {
							...dataWithoutId,
							id: foundByDataId.id, // Use Firestore document ID
						}
						// Load blocked dates if available on property document
						const blocked = Array.isArray(propertyData?.blockedDates)
							? propertyData.blockedDates
							: []
						setPropertyBlockedDates(blocked)
						setProperty(propertyWithId)

						// Check if current user is the host
						const hostId = propertyWithId.hostId || propertyWithId.host?.hostId
						const userIsHost = currentUser?.uid && hostId === currentUser.uid
						setIsHost(userIsHost)

						if (userIsHost) {
							// Fetch property promos and booking history for host
							fetchPropertyPromos(foundByDataId.id)
							fetchPropertyBookings(foundByDataId.id)
						}

						// Update the URL to use the correct Firestore document ID
						window.history.replaceState({}, "", `/property/${foundByDataId.id}`)
						console.log("✅ Updated URL to use Firestore document ID")
						return
					} else {
						console.log(
							"❌ Property not found even after searching all properties"
						)
						console.log("📋 Searched for ID:", propertyId)
					}
				} catch (searchError) {
					console.error("❌ Error searching for property:", searchError)
				}

				toast.error("Property not found")
				console.log("🔄 Navigating to dashboard...")
				// Navigate based on user type or default to guest dashboard
				if (currentUser?.uid) {
					// Check if user is host by checking if they have properties
					try {
						const propertiesQuery = query(
							collection(db, "properties"),
							where("hostId", "==", currentUser.uid)
						)
						const propertiesSnapshot = await getDocs(propertiesQuery)
						console.log("📋 User's properties count:", propertiesSnapshot.size)
						if (!propertiesSnapshot.empty) {
							console.log("🔄 Navigating to /dashboardHost")
							navigate("/dashboardHost")
						} else {
							console.log("🔄 Navigating to appropriate dashboard")
							navigate(getDashboardRoute())
						}
					} catch (navError) {
						console.error("❌ Error checking user properties:", navError)
						navigate(getDashboardRoute())
					}
				} else {
					console.log("🔄 No user logged in, navigating to /dashboardGuest")
					navigate("/dashboardGuest")
				}
			}
		} catch (error) {
			console.error("❌ Error fetching property:", error)
			console.error("❌ Error details:", {
				message: error.message,
				code: error.code,
				stack: error.stack,
			})
			toast.error("Failed to load property details")
			// Navigate to appropriate dashboard on error
			if (currentUser?.uid) {
				console.log("🔄 Navigating to appropriate dashboard (error fallback)")
				navigate(getDashboardRoute())
			} else {
				console.log("🔄 Navigating to / (error fallback)")
				navigate("/")
			}
		} finally {
			setLoading(false)
		}
	}

	const fetchBookedDates = async () => {
		try {
			const {
				collection: firestoreCollection,
				query,
				where,
				getDocs: getDocsFirestore,
				doc: docFirestore,
				getDoc: getDocFirestore,
			} = await import("firebase/firestore")
			const bookingsRef = firestoreCollection(db, "bookings")
			const q = query(bookingsRef, where("propertyId", "==", propertyId))
			const querySnapshot = await getDocsFirestore(q)

			const dates = []
			querySnapshot.forEach((doc) => {
				const booking = doc.data()
				// Only include confirmed, pending, or other active statuses (not cancelled)
				if (booking.status !== "cancelled" && booking.status !== "cancellation_requested") {
					// If bookedDates array exists, use it
					if (booking.bookedDates && Array.isArray(booking.bookedDates)) {
						dates.push(...booking.bookedDates)
					} 
					// Otherwise, generate dates from checkInDate and checkOutDate
					else if (booking.checkInDate && booking.checkOutDate) {
						const checkIn = booking.checkInDate.toDate 
							? booking.checkInDate.toDate() 
							: new Date(booking.checkInDate)
						const checkOut = booking.checkOutDate.toDate 
							? booking.checkOutDate.toDate() 
							: new Date(booking.checkOutDate)
						
						// Generate all dates between check-in and check-out
						const bookingDates = getDatesBetween(
							checkIn.toISOString().split("T")[0],
							checkOut.toISOString().split("T")[0]
						)
						dates.push(...bookingDates)
					}
				}
			})
			
			// Merge with blocked dates from property
			try {
				const propRef = docFirestore(db, "properties", propertyId)
				const propSnap = await getDocFirestore(propRef)
				const blocked =
					propSnap.exists() && Array.isArray(propSnap.data()?.blockedDates)
						? propSnap.data().blockedDates
						: []
				setPropertyBlockedDates(blocked)
				const merged = Array.from(new Set([...(dates || []), ...blocked]))
				setBookedDates(merged)
				setBookingDates(dates) // Store booking dates separately
			} catch (e) {
				// If property fetch fails, still set booked dates
				setBookedDates(dates)
				setBookingDates(dates)
			}
		} catch (error) {
			console.error("Error fetching booked dates:", error)
		}
	}

	const checkFavoriteStatus = async () => {
		try {
			const userDoc = await getDoc(doc(db, "users", currentUser.uid))
			if (userDoc.exists()) {
				const favorites = userDoc.data().favorites || []
				setIsFavorite(favorites.includes(propertyId))
			}
		} catch (error) {
			console.error("Error checking favorite status:", error)
		}
	}

	const checkWishlistStatus = async () => {
		try {
			const userDoc = await getDoc(doc(db, "users", currentUser.uid))
			if (userDoc.exists()) {
				const wishlist = userDoc.data().wishlist || []
				setIsInWishlist(wishlist.includes(propertyId))
			}
		} catch (error) {
			console.error("Error checking wishlist status:", error)
		}
	}

	const toggleFavorite = async () => {
		if (!currentUser) {
			toast.error("Please login to add favorites")
			return
		}

		try {
			const userDocRef = doc(db, "users", currentUser.uid)
			if (isFavorite) {
				await updateDoc(userDocRef, {
					favorites: arrayRemove(propertyId),
				})
				setIsFavorite(false)
				toast.success("Removed from favorites")
			} else {
				await updateDoc(userDocRef, {
					favorites: arrayUnion(propertyId),
				})
				setIsFavorite(true)
				toast.success("Added to favorites")
			}
		} catch (error) {
			console.error("Error toggling favorite:", error)
			toast.error("Failed to update favorites")
		}
	}

	const toggleWishlist = async () => {
		if (!currentUser) {
			toast.error("Please login to add to wishlist")
			return
		}

		try {
			const userDocRef = doc(db, "users", currentUser.uid)
			if (isInWishlist) {
				await updateDoc(userDocRef, {
					wishlist: arrayRemove(propertyId),
				})
				setIsInWishlist(false)
				toast.success("Removed from wishlist")
			} else {
				await updateDoc(userDocRef, {
					wishlist: arrayUnion(propertyId),
				})
				setIsInWishlist(true)
				toast.success("Added to wishlist")
			}
		} catch (error) {
			console.error("Error toggling wishlist:", error)
			toast.error("Failed to update wishlist")
		}
	}

	// Fetch wallet balance
	const fetchWalletBalance = async () => {
		try {
			const userDoc = await getDoc(doc(db, "users", currentUser.uid))
			if (userDoc.exists()) {
				const balance = userDoc.data().walletBalance || 0
				setWalletBalance(balance)
			}
		} catch (error) {
			console.error("Error fetching wallet balance:", error)
		}
	}

	// Fetch platform policies from admin settings
	const fetchPlatformPolicies = async () => {
		try {
			const policiesDoc = await getDoc(doc(db, "settings", "policies"))
			if (policiesDoc.exists()) {
				const data = policiesDoc.data()
				setPlatformPolicies({
					serviceFeeGuest: data.serviceFeeGuest || 800,
					guestFeePerPerson: data.guestFeePerPerson || 100,
				})
			}
		} catch (error) {
			console.error("Error fetching platform policies:", error)
			// Use default values if fetch fails
		}
	}

	// Fetch reviews from Firebase
	const fetchReviews = async () => {
		try {
			const reviewsQuery = query(
				collection(db, "reviews"),
				where("propertyId", "==", propertyId),
				where("status", "==", "approved")
			)
			const reviewsSnapshot = await getDocs(reviewsQuery)
			const reviewsData = reviewsSnapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			}))
			// Sort by date, newest first
			reviewsData.sort((a, b) => {
				const dateA = a.createdAt?.toDate?.() || new Date(0)
				const dateB = b.createdAt?.toDate?.() || new Date(0)
				return dateB - dateA
			})
			setReviews(reviewsData)
			
			// Update property rating and reviews count dynamically
			if (reviewsData.length > 0) {
				const totalRating = reviewsData.reduce(
					(sum, review) => sum + (review.rating || 0),
					0
				)
				const averageRating = totalRating / reviewsData.length
				
				// Update property document
				const propertyRef = doc(db, "properties", propertyId)
				await updateDoc(propertyRef, {
					rating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
					reviewsCount: reviewsData.length,
				})
				
				// Update local property state
				if (property) {
					setProperty({
						...property,
						rating: Math.round(averageRating * 10) / 10,
						reviewsCount: reviewsData.length,
					})
				}
			} else {
				// No reviews, reset to 0
				const propertyRef = doc(db, "properties", propertyId)
				await updateDoc(propertyRef, {
					rating: 0,
					reviewsCount: 0,
				})
				
				// Update local property state
				if (property) {
					setProperty({
						...property,
						rating: 0,
						reviewsCount: 0,
					})
				}
			}
		} catch (error) {
			console.error("Error fetching reviews:", error)
		}
	}

	// Fetch wishlists for this property (only visible to host and the guest who created them)
	const fetchPropertyWishlists = async () => {
		if (!property || !currentUser) return
		
		try {
			// Get all users and check their wishes array
			const usersRef = collection(db, "users")
			const usersSnapshot = await getDocs(usersRef)
			const wishlists = []
			
			usersSnapshot.forEach((userDoc) => {
				const userData = userDoc.data()
				const wishes = Array.isArray(userData.wishes) ? userData.wishes : []
				
				wishes.forEach((wish) => {
					// Only include wishlists for this property
					if (wish.propertyId === propertyId && wish.isCreated) {
						// Only show to host or the guest who created it
						const isHost = property.hostId === currentUser.uid
						const isGuest = wish.guestId === currentUser.uid
						
						if (isHost || isGuest) {
							wishlists.push({
								...wish,
								guestId: wish.guestId || userDoc.id,
								guestName: wish.guestName || userData.displayName || "Guest",
							})
						}
					}
				})
			})
			
			setPropertyWishlists(wishlists)
		} catch (error) {
			console.error("Error fetching property wishlists:", error)
		}
	}

	// Check user's completed bookings for this property
	const checkUserBookings = async () => {
		if (!currentUser) return
		try {
			const bookingsQuery = query(
				collection(db, "bookings"),
				where("guestId", "==", currentUser.uid),
				where("propertyId", "==", propertyId),
				where("status", "==", "completed")
			)
			const bookingsSnapshot = await getDocs(bookingsQuery)
			const completedBookings = bookingsSnapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			}))

			// Filter bookings that haven't been reviewed yet
			const unreviewedBookings = completedBookings.filter((booking) => {
				return !reviews.some((review) => review.bookingId === booking.id)
			})

			setUserCompletedBookings(unreviewedBookings)
		} catch (error) {
			console.error("Error checking user bookings:", error)
		}
	}

	// Fetch property promos (for host view)
	const fetchPropertyPromos = async (propId) => {
		if (!currentUser?.uid) return
		try {
			const allPromos = []

			// 1. Fetch promos from the promos collection
			try {
				const promosQuery = query(
					collection(db, "promos"),
					where("createdBy", "==", currentUser.uid),
					where("propertyId", "==", propId)
				)
				const promosSnapshot = await getDocs(promosQuery)
				const promosFromCollection = promosSnapshot.docs.map((doc) => ({
					id: doc.id,
					...doc.data(),
					source: "promos_collection",
				}))
				allPromos.push(...promosFromCollection)
			} catch (error) {
				console.error("Error fetching promos from collection:", error)
			}

			// 2. Get vouchers from property document
			if (
				property &&
				property.vouchers &&
				property.vouchers.types &&
				property.vouchers.types.length > 0
			) {
				const voucherNames = {
					early_bird: "Early Bird Promo",
					christmas: "Christmas Special",
					new_year: "New Year Special",
					yearly: "Yearly Promo",
					summer: "Summer Special",
					anniversary: "Anniversary Promo",
					weekend: "Weekend Special",
					flash_sale: "Flash Sale",
				}

				property.vouchers.types.forEach((voucherType) => {
					const voucherDetails = property.vouchers.details?.[voucherType]
					if (voucherDetails) {
						const promoFromVoucher = {
							id: `voucher_${propId}_${voucherType}`,
							code: voucherType.toUpperCase().replace(/_/g, ""),
							description: voucherNames[voucherType] || voucherType,
							discountType: voucherDetails.discountType || "percent",
							discount:
								voucherDetails.discount || voucherDetails.discountValue || 0,
							discountValue: parseFloat(
								voucherDetails.discount || voucherDetails.discountValue || 0
							),
							validFrom: voucherDetails.startDate || null,
							validUntil: voucherDetails.endDate || null,
							isActive:
								voucherDetails.isActive !== undefined
									? typeof voucherDetails.isActive === "boolean"
										? voucherDetails.isActive
										: String(voucherDetails.isActive).toLowerCase() === "true"
									: true,
							usageCount: 0,
							propertyId: propId,
							createdBy: currentUser.uid,
							source: "property_vouchers",
							voucherType: voucherType, // Add voucherType for easier access
						}
						allPromos.push(promoFromVoucher)
					}
				})
			}

			setPropertyPromos(allPromos)
		} catch (error) {
			console.error("Error fetching property promos:", error)
		}
	}

	// Start editing a property voucher
	const handleStartEditVoucher = (promo) => {
		if (promo.source === "property_vouchers") {
			// Close any currently editing voucher
			if (editingPromo && editingPromo.id !== promo.id) {
				handleCancelEdit()
			}
			setEditingPromo(promo)
			setEditPromoDiscount(promo.discount || promo.discountValue || "20")
			setEditPromoDiscountType(
				promo.discountType === "percent"
					? "percentage"
					: promo.discountType || "percentage"
			)
			const voucherType =
				promo.voucherType || promo.id.split("_").slice(2).join("_")
			if (voucherType === "long_stay") {
				setEditPromoMinDays(promo.minDays || promo.minimumDays || "")
				setEditPromoValidFrom("")
				setEditPromoValidUntil("")
			} else {
				setEditPromoValidFrom(promo.validFrom || promo.startDate || "")
				setEditPromoValidUntil(promo.validUntil || promo.endDate || "")
				setEditPromoMinDays("")
			}
			setEditPromoIsActive(
				promo.isActive !== undefined
					? typeof promo.isActive === "boolean"
						? promo.isActive
						: String(promo.isActive).toLowerCase() === "true"
					: true
			)
		}
	}

	// Check if voucher is fixed-date (no date editing needed)
	const isFixedDateVoucher = (voucherType) => {
		const fixedDateVouchers = [
			"weekend",
			"valentines",
			"christmas",
			"new_year",
			"summer",
			"anniversary",
		]
		return fixedDateVouchers.includes(voucherType)
	}

	// Cancel editing
	const handleCancelEdit = () => {
		setEditingPromo(null)
		setEditPromoDiscount("")
		setEditPromoValidFrom("")
		setEditPromoValidUntil("")
		setEditPromoMinDays("")
	}

	// Update property voucher
	const handleUpdateVoucher = async () => {
		console.log("🔍 [handleUpdateVoucher] Starting voucher update...")
		console.log("🔍 [handleUpdateVoucher] editingPromo:", editingPromo)
		console.log("🔍 [handleUpdateVoucher] property:", property)
		console.log("🔍 [handleUpdateVoucher] propertyId from URL:", propertyId)

		if (!editingPromo) {
			console.log("❌ [handleUpdateVoucher] No editingPromo found")
			toast.error("Voucher information not available")
			return
		}

		// Prioritize propertyId from URL (Firestore document ID) over property.id (which might be a custom field)
		// Use propertyId from URL params first, as it's the actual Firestore document ID
		const propId = propertyId || property?.id
		console.log("🔍 [handleUpdateVoucher] Using propId:", propId)
		console.log("🔍 [handleUpdateVoucher] property?.id:", property?.id)
		console.log("🔍 [handleUpdateVoucher] propertyId from params:", propertyId)

		if (!propId) {
			console.log("❌ [handleUpdateVoucher] No propId available")
			toast.error("Property information not available")
			return
		}

		if (!editPromoDiscount || parseFloat(editPromoDiscount) <= 0) {
			console.log(
				"❌ [handleUpdateVoucher] Invalid discount:",
				editPromoDiscount
			)
			toast.error("Discount must be greater than 0")
			return
		}
		if (
			editPromoDiscountType === "percentage" &&
			parseFloat(editPromoDiscount) > 100
		) {
			console.log("❌ [handleUpdateVoucher] Discount exceeds 100%")
			toast.error("Percentage discount cannot exceed 100%")
			return
		}

		// Extract voucher type
		const voucherType =
			editingPromo.voucherType || editingPromo.id.split("_").slice(2).join("_")
		console.log("🔍 [handleUpdateVoucher] voucherType:", voucherType)

		// Validate dates if not a fixed-date voucher and not long_stay
		if (!isFixedDateVoucher(voucherType) && voucherType !== "long_stay") {
			if (editPromoValidFrom && editPromoValidUntil) {
				const fromDate = new Date(editPromoValidFrom)
				const untilDate = new Date(editPromoValidUntil)
				if (fromDate >= untilDate) {
					console.log("❌ [handleUpdateVoucher] Invalid date range")
					toast.error("Valid From date must be before Valid Until date")
					return
				}
			}
		}

		// Validate minimum days for long_stay (only if active)
		if (
			editPromoIsActive &&
			voucherType === "long_stay" &&
			editPromoMinDays &&
			parseFloat(editPromoMinDays) < 1
		) {
			console.log("❌ [handleUpdateVoucher] Minimum days less than 1")
			toast.error("Minimum days must be at least 1")
			return
		}
		// Require minimum days for long_stay if active
		if (editPromoIsActive && voucherType === "long_stay" && !editPromoMinDays) {
			console.log(
				"❌ [handleUpdateVoucher] Missing minimum days for active long_stay"
			)
			toast.error("Minimum days is required for active Long Stay Discount")
			return
		}

		setIsUpdatingPromo(true)
		try {
			// Get current property data
			console.log(
				"🔍 [handleUpdateVoucher] Fetching property document with ID:",
				propId
			)
			const propertyRef = doc(db, "properties", propId)
			const propertyDoc = await getDoc(propertyRef)

			console.log(
				"🔍 [handleUpdateVoucher] Property document exists:",
				propertyDoc.exists()
			)
			console.log(
				"🔍 [handleUpdateVoucher] Property document ID:",
				propertyDoc.id
			)

			if (!propertyDoc.exists()) {
				console.log(
					"❌ [handleUpdateVoucher] Property document does not exist for ID:",
					propId
				)
				console.log(
					"❌ [handleUpdateVoucher] Attempting to search for property..."
				)
				toast.error("Property not found")
				setIsUpdatingPromo(false)
				return
			}

			const currentProperty = propertyDoc.data()
			console.log(
				"🔍 [handleUpdateVoucher] Property data loaded:",
				currentProperty ? "Yes" : "No"
			)
			console.log(
				"🔍 [handleUpdateVoucher] Property has vouchers:",
				!!currentProperty?.vouchers
			)

			if (!currentProperty) {
				console.log(
					"❌ [handleUpdateVoucher] Property data is null or undefined"
				)
				toast.error("Failed to load property data")
				setIsUpdatingPromo(false)
				return
			}

			if (!currentProperty.vouchers) {
				console.log("❌ [handleUpdateVoucher] Property has no vouchers object")
				toast.error("Voucher data not found in property")
				setIsUpdatingPromo(false)
				return
			}

			if (!currentProperty.vouchers.details) {
				// Initialize vouchers.details if it doesn't exist
				console.log("🔍 [handleUpdateVoucher] Initializing vouchers.details")
				currentProperty.vouchers.details = {}
			}

			// Prepare voucher update - only include dates for non-fixed-date vouchers
			const existingVoucherDetails =
				currentProperty.vouchers.details[voucherType] || {}
			console.log(
				"🔍 [handleUpdateVoucher] Existing voucher details:",
				existingVoucherDetails
			)

			const voucherUpdate = {
				...existingVoucherDetails,
				discount: editPromoDiscount,
				discountType:
					editPromoDiscountType === "percentage" ? "percent" : "price",
				isActive: Boolean(editPromoIsActive), // Ensure boolean type
			}

			console.log(
				"🔍 [handleUpdateVoucher] Voucher update before type-specific changes:",
				voucherUpdate
			)
			console.log(
				"🔍 [handleUpdateVoucher] editPromoIsActive:",
				editPromoIsActive
			)
			console.log(
				"🔍 [handleUpdateVoucher] editPromoMinDays:",
				editPromoMinDays
			)

			// For long_stay, add minimum days instead of dates
			if (voucherType === "long_stay") {
				voucherUpdate.minDays = editPromoMinDays
					? parseInt(editPromoMinDays)
					: null
				voucherUpdate.minimumDays = editPromoMinDays
					? parseInt(editPromoMinDays)
					: null
				// Remove dates if they exist
				delete voucherUpdate.startDate
				delete voucherUpdate.endDate
				console.log(
					"🔍 [handleUpdateVoucher] Updated voucher for long_stay:",
					voucherUpdate
				)
			} else if (!isFixedDateVoucher(voucherType)) {
				// Only add dates if not a fixed-date voucher
				voucherUpdate.startDate = editPromoValidFrom || null
				voucherUpdate.endDate = editPromoValidUntil || null
				console.log(
					"🔍 [handleUpdateVoucher] Updated voucher with dates:",
					voucherUpdate
				)
			}

			// Ensure types array exists and includes this voucher type
			const typesArray = currentProperty.vouchers.types || []
			if (!typesArray.includes(voucherType)) {
				console.log(
					"🔍 [handleUpdateVoucher] Adding voucher type to types array:",
					voucherType
				)
				typesArray.push(voucherType)
			}

			// Update the voucher details
			const updatedVouchers = {
				types: typesArray,
				details: {
					...currentProperty.vouchers.details,
					[voucherType]: voucherUpdate,
				},
			}

			console.log(
				"🔍 [handleUpdateVoucher] Final vouchers object to save:",
				updatedVouchers
			)
			console.log(
				"🔍 [handleUpdateVoucher] Attempting to update property document..."
			)

			await updateDoc(propertyRef, {
				vouchers: updatedVouchers,
			})

			console.log(
				"✅ [handleUpdateVoucher] Property document updated successfully!"
			)

			toast.success("🎉 Voucher updated successfully!")

			// Refresh property and promos
			console.log("🔍 [handleUpdateVoucher] Refreshing property and promos...")
			fetchPropertyDetails()
			fetchPropertyPromos(propId)
			handleCancelEdit()
		} catch (error) {
			console.error("❌ [handleUpdateVoucher] Error updating voucher:", error)
			console.error("❌ [handleUpdateVoucher] Error details:", {
				message: error.message,
				code: error.code,
				stack: error.stack,
			})
			toast.error(getFirebaseErrorMessage(error))
		} finally {
			setIsUpdatingPromo(false)
		}
	}

	// Delete promo
	const handleDeletePromo = async (promoId) => {
		if (!window.confirm("Are you sure you want to delete this promo?")) {
			return
		}

		try {
			await deleteDoc(doc(db, "promos", promoId))
			toast.success("Promo deleted successfully!")
			// Refresh promos
			fetchPropertyPromos(property.id)
		} catch (error) {
			console.error("Error deleting promo:", error)
			toast.error(getFirebaseErrorMessage(error))
		}
	}

	// Toggle promo active status
	const handleTogglePromoStatus = async (promoId, currentStatus) => {
		try {
			await updateDoc(doc(db, "promos", promoId), {
				isActive: !currentStatus,
			})
			toast.success(
				`Promo ${!currentStatus ? "activated" : "deactivated"} successfully!`
			)
			// Refresh promos
			fetchPropertyPromos(property.id)
		} catch (error) {
			console.error("Error updating promo:", error)
			toast.error(getFirebaseErrorMessage(error))
		}
	}

	// Create new promo
	const handleCreatePromo = async () => {
		if (!property || !currentUser) {
			toast.error("Property or user not found")
			return
		}

		// Validation
		if (!newCoupon.code.trim()) {
			toast.error("Promo code is required")
			return
		}

		if (newCoupon.code.trim().length < 3) {
			toast.error("Promo code must be at least 3 characters")
			return
		}

		if (!newCoupon.description.trim()) {
			toast.error("Description is required")
			return
		}

		if (!newCoupon.discountValue || parseFloat(newCoupon.discountValue) <= 0) {
			toast.error("Discount value must be greater than 0")
			return
		}

		if (newCoupon.discountType === "percentage" && parseFloat(newCoupon.discountValue) > 100) {
			toast.error("Percentage discount cannot exceed 100%")
			return
		}

		if (newCoupon.validFrom && newCoupon.validUntil) {
			if (new Date(newCoupon.validFrom) >= new Date(newCoupon.validUntil)) {
				toast.error("Valid From date must be before Valid Until date")
				return
			}
		}

		setIsCreatingPromo(true)
		try {
			const promoData = {
				code: newCoupon.code.toUpperCase().trim(),
				description: newCoupon.description.trim(),
				discountType: newCoupon.discountType || "percentage",
				discountValue: parseFloat(newCoupon.discountValue) || 0,
				minPurchase: parseFloat(newCoupon.minPurchase) || 0,
				maxDiscount: parseFloat(newCoupon.maxDiscount) || 0,
				usageLimit: parseInt(newCoupon.usageLimit) || 0,
				usagePerUser: parseInt(newCoupon.usagePerUser) || 1,
				validFrom: newCoupon.validFrom || "",
				validUntil: newCoupon.validUntil || "",
				isActive: Boolean(newCoupon.isActive),
				propertyId: property.id,
				hostId: property.hostId || currentUser.uid,
				usedBy: [],
				usageCount: 0,
				createdAt: serverTimestamp(),
				createdBy: currentUser.uid,
			}

			await addDoc(collection(db, "promos"), promoData)
			toast.success("✅ Promo created successfully!")

			// Reset form
			setNewCoupon({
				code: "",
				description: "",
				discountType: "percentage",
				discountValue: 0,
				minPurchase: 0,
				maxDiscount: 0,
				usageLimit: 0,
				usagePerUser: 1,
				validFrom: "",
				validUntil: "",
				isActive: true,
			})
			setShowCreatePromoForm(false)

			// Refresh promos
			fetchPropertyPromos(property.id)
		} catch (error) {
			console.error("Error creating promo:", error)
			toast.error("❌ Failed to create promo: " + getFirebaseErrorMessage(error))
		} finally {
			setIsCreatingPromo(false)
		}
	}

	// NumberStepper component for numeric inputs
	const NumberStepper = ({ value, onChange, min = 0, max, step = 1, placeholder, style = {} }) => {
		const numValue = parseInt(value) || 0
		
		const handleDecrease = () => {
			const newValue = Math.max(min, numValue - step)
			onChange({ target: { value: newValue.toString() } })
		}
		
		const handleIncrease = () => {
			const newValue = max !== undefined ? Math.min(max, numValue + step) : numValue + step
			onChange({ target: { value: newValue.toString() } })
		}
		
		return (
			<div className="number-stepper" style={{ display: "flex", alignItems: "center", gap: "0.75rem", ...style }}>
				<button
					type="button"
					onClick={handleDecrease}
					disabled={numValue <= min}
					style={{
						width: "44px",
						height: "44px",
						border: "1px solid #b0b0b0",
						borderRadius: "50%",
						background: numValue <= min ? "#f5f5f5" : "white",
						cursor: numValue <= min ? "not-allowed" : "pointer",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						color: numValue <= min ? "#ccc" : "#333",
						transition: "all 0.2s ease",
					}}
					onMouseEnter={(e) => {
						if (numValue > min) {
							e.target.style.borderColor = "var(--primary)"
							e.target.style.background = "rgba(97, 191, 156, 0.1)"
						}
					}}
					onMouseLeave={(e) => {
						if (numValue > min) {
							e.target.style.borderColor = "#b0b0b0"
							e.target.style.background = "white"
						}
					}}
				>
					<FaMinus style={{ fontSize: "0.85rem" }} />
				</button>
				<input
					type="number"
					value={value || ""}
					onChange={onChange}
					placeholder={placeholder}
					min={min}
					max={max}
					step={step}
					style={{
						width: "80px",
						padding: "0.5rem",
						border: "1px solid #b0b0b0",
						borderRadius: "6px",
						fontSize: "0.9rem",
						textAlign: "center",
						MozAppearance: "textfield",
					}}
					onWheel={(e) => e.target.blur()}
					className="number-input-no-spinner"
				/>
				<button
					type="button"
					onClick={handleIncrease}
					disabled={max !== undefined && numValue >= max}
					style={{
						width: "44px",
						height: "44px",
						border: "1px solid #b0b0b0",
						borderRadius: "50%",
						background: max !== undefined && numValue >= max ? "#f5f5f5" : "white",
						cursor: max !== undefined && numValue >= max ? "not-allowed" : "pointer",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						color: max !== undefined && numValue >= max ? "#ccc" : "#333",
						transition: "all 0.2s ease",
					}}
					onMouseEnter={(e) => {
						if (max === undefined || numValue < max) {
							e.target.style.borderColor = "var(--primary)"
							e.target.style.background = "rgba(97, 191, 156, 0.1)"
						}
					}}
					onMouseLeave={(e) => {
						if (max === undefined || numValue < max) {
							e.target.style.borderColor = "#b0b0b0"
							e.target.style.background = "white"
						}
					}}
				>
					<FaPlus style={{ fontSize: "0.85rem" }} />
				</button>
			</div>
		)
	}

	// Calendar helper functions for coupon dates
	const getCouponTodayDate = () => {
		const today = new Date()
		return today.toISOString().split("T")[0]
	}

	const generateCouponCalendarDays = () => {
		const year = couponCurrentMonth.getFullYear()
		const month = couponCurrentMonth.getMonth()
		const firstDay = new Date(year, month, 1).getDay()
		const daysInMonth = new Date(year, month + 1, 0).getDate()

		const days = []
		for (let i = 0; i < firstDay; i++) days.push(null)
		for (let day = 1; day <= daysInMonth; day++) {
			const dateString = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
			days.push({
				day,
				dateString,
				isPast: new Date(dateString) < new Date(getCouponTodayDate()),
			})
		}
		return days
	}

	const previousCouponMonth = () => {
		setCouponCurrentMonth(
			new Date(couponCurrentMonth.getFullYear(), couponCurrentMonth.getMonth() - 1)
		)
	}

	const nextCouponMonth = () => {
		setCouponCurrentMonth(
			new Date(couponCurrentMonth.getFullYear(), couponCurrentMonth.getMonth() + 1)
		)
	}

	const handleCouponCalendarDayClick = (dateString) => {
		if (selectingValidFrom) {
			// Selecting Valid From date
			setNewCoupon({
				...newCoupon,
				validFrom: dateString,
				validUntil: newCoupon.validUntil && new Date(newCoupon.validUntil) <= new Date(dateString) ? "" : newCoupon.validUntil,
			})
			setSelectingValidFrom(false)
			toast.success("Valid From date selected. Now select Valid Until date.")
		} else {
			// Selecting Valid Until date
			const validFrom = newCoupon.validFrom
			if (validFrom && new Date(dateString) <= new Date(validFrom)) {
				toast.error("Valid Until date must be after Valid From date")
				return
			}
			setNewCoupon({
				...newCoupon,
				validUntil: dateString,
			})
			setSelectingValidFrom(true)
			setShowCouponDateModal(false)
			toast.success("Coupon dates selected successfully!")
		}
	}

	const openCouponDatePicker = (isValidFrom) => {
		setSelectingValidFrom(isValidFrom)
		setShowCouponDateModal(true)
	}

	// Fetch property booking history (for host view)
	const fetchPropertyBookings = async (propId) => {
		if (!currentUser?.uid) return
		try {
			const bookingsQuery = query(
				collection(db, "bookings"),
				where("propertyId", "==", propId),
				orderBy("createdAt", "desc")
			)
			const bookingsSnapshot = await getDocs(bookingsQuery)
			const bookingsList = bookingsSnapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			}))
			setPropertyBookings(bookingsList)
		} catch (error) {
			console.error("Error fetching property bookings:", error)
		}
	}

	// Submit a review
	const handleSubmitReview = async () => {
		if (!currentUser) {
			toast.error("Please login to submit a review")
			return
		}

		if (!reviewFormData.comment.trim()) {
			toast.error("Please write a comment")
			return
		}

		if (reviewFormData.comment.trim().length < 20) {
			toast.error("Review must be at least 20 characters")
			return
		}

		setIsSubmittingReview(true)
		try {
			// Calculate overall rating from individual ratings
			const overallRating =
				(reviewFormData.cleanliness +
					reviewFormData.accuracy +
					reviewFormData.communication +
					reviewFormData.location +
					reviewFormData.checkIn +
					reviewFormData.value) /
				6

			// Get user data
			const userDoc = await getDoc(doc(db, "users", currentUser.uid))
			const userData = userDoc.data()

			// Create review object
			const reviewData = {
				propertyId,
				userId: currentUser.uid,
				userName:
					userData?.displayName ||
					currentUser.displayName ||
					(userData?.firstName && userData?.lastName
						? `${userData.firstName} ${userData.lastName}`
						: userData?.firstName ||
						  userData?.lastName ||
						  currentUser.email?.split("@")[0] ||
						  "User"),
				userEmail: userData?.email || currentUser.email,
				rating: Math.round(overallRating * 10) / 10, // Round to 1 decimal
				comment: reviewFormData.comment.trim(),
				ratings: {
					cleanliness: reviewFormData.cleanliness,
					accuracy: reviewFormData.accuracy,
					communication: reviewFormData.communication,
					location: reviewFormData.location,
					checkIn: reviewFormData.checkIn,
					value: reviewFormData.value,
					overall: overallRating,
				},
				bookingId: userCompletedBookings[0]?.id || null,
				createdAt: new Date(),
				status: "approved", // Auto-approve for now, can add moderation later
			}

			// Add review to Firebase
			const { collection: firestoreCollection, addDoc: addDocument } =
				await import("firebase/firestore")
			await addDocument(firestoreCollection(db, "reviews"), reviewData)

			// Update property's average rating
			await updatePropertyRating()

			toast.success("✅ Review submitted successfully!")
			setShowReviewModal(false)
			setReviewFormData({
				rating: 5,
				comment: "",
				cleanliness: 5,
				accuracy: 5,
				communication: 5,
				location: 5,
				checkIn: 5,
				value: 5,
			})

			// Refresh reviews and bookings
			fetchReviews()
			checkUserBookings()
		} catch (error) {
			console.error("Error submitting review:", error)
			toast.error("❌ Failed to submit review. Please try again.")
		} finally {
			setIsSubmittingReview(false)
		}
	}

	// Update property's average rating
	const updatePropertyRating = async () => {
		try {
			const reviewsQuery = query(
				collection(db, "reviews"),
				where("propertyId", "==", propertyId),
				where("status", "==", "approved")
			)
			const reviewsSnapshot = await getDocs(reviewsQuery)
			const allReviews = reviewsSnapshot.docs.map((doc) => doc.data())

			if (allReviews.length === 0) return

			// Calculate average rating
			const totalRating = allReviews.reduce(
				(sum, review) => sum + (review.rating || 0),
				0
			)
			const averageRating = totalRating / allReviews.length

			// Update property document
			const propertyRef = doc(db, "properties", propertyId)
			await updateDoc(propertyRef, {
				rating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
				reviewsCount: allReviews.length,
			})

			// Refresh property details
			fetchPropertyDetails()
		} catch (error) {
			console.error("Error updating property rating:", error)
		}
	}

	// Promo code functions
	const validateAndApplyPromo = async () => {
		if (!promoCode.trim()) {
			toast.error("Please enter a promo code")
			return
		}

		setIsValidatingPromo(true)
		try {
			const promosQuery = query(
				collection(db, "promos"),
				where("code", "==", promoCode.toUpperCase())
			)
			const promosSnapshot = await getDocs(promosQuery)

			if (promosSnapshot.empty) {
				toast.error("Invalid promo code")
				setIsValidatingPromo(false)
				return
			}

			const promoData = promosSnapshot.docs[0].data()
			const promoId = promosSnapshot.docs[0].id

			// Check if promo is applicable to bookings (not host subscriptions)
			if (promoData.applicableTo === "host") {
				toast.error(
					"This promo code is only valid for host subscriptions, not bookings"
				)
				setIsValidatingPromo(false)
				return
			}

			// Validation checks
			if (!promoData.isActive) {
				toast.error("This promo code is no longer active")
				setIsValidatingPromo(false)
				return
			}

			// Check validity dates
			const now = new Date()
			if (promoData.validFrom && new Date(promoData.validFrom) > now) {
				toast.error("This promo code is not yet valid")
				setIsValidatingPromo(false)
				return
			}

			if (promoData.validUntil && new Date(promoData.validUntil) < now) {
				toast.error("This promo code has expired")
				setIsValidatingPromo(false)
				return
			}

			// Check usage limits
			if (
				promoData.usageLimit > 0 &&
				promoData.usageCount >= promoData.usageLimit
			) {
				toast.error("This promo code has reached its usage limit")
				setIsValidatingPromo(false)
				return
			}

			// Check if user already used this promo
			const userUsageCount =
				promoData.usedBy?.filter((userId) => userId === currentUser.uid)
					.length || 0
			if (userUsageCount >= promoData.usagePerUser) {
				toast.error("You have already used this promo code")
				setIsValidatingPromo(false)
				return
			}

			// Check minimum purchase
			const prices = calculatePrices()
			if (
				promoData.minPurchase > 0 &&
				prices.subtotal < promoData.minPurchase
			) {
				toast.error(
					`Minimum purchase of ₱${promoData.minPurchase} required for this promo`
				)
				setIsValidatingPromo(false)
				return
			}

			// Calculate discount
			let discount = 0
			if (promoData.discountType === "percentage") {
				discount = (prices.subtotal * promoData.discountValue) / 100
				if (promoData.maxDiscount > 0 && discount > promoData.maxDiscount) {
					discount = promoData.maxDiscount
				}
			} else {
				discount = promoData.discountValue
			}

			// Apply promo
			setAppliedPromo({ ...promoData, id: promoId })
			setPromoDiscount(discount)
			toast.success(`Promo applied! You saved ₱${discount.toLocaleString()}`)
		} catch (error) {
			console.error("Error validating promo:", error)
			toast.error("Failed to validate promo code")
		} finally {
			setIsValidatingPromo(false)
		}
	}

	const removePromo = () => {
		setAppliedPromo(null)
		setPromoDiscount(0)
		setPromoCode("")
		toast("Promo code removed")
	}

	const handleSubmitReport = async () => {
		if (!reportReason) {
			toast.error("Please select a reason for reporting")
			return
		}

		if (!currentUser) {
			toast.error("Please log in to report a property")
			return
		}

		setIsSubmittingReport(true)
		try {
			const reportData = {
				propertyId: propertyId,
				propertyTitle: property?.title || "Unknown Property",
				hostId: property?.hostId || "",
				reporterId: currentUser.uid,
				reporterEmail: currentUser.email || "",
				reporterName: currentUser.displayName || "Guest",
				reason: reportReason,
				description: reportDescription,
				status: "pending",
				createdAt: serverTimestamp(),
			}

			await addDoc(collection(db, "propertyReports"), reportData)
			toast.success("Report submitted successfully. Thank you for helping keep AuraStays safe!")
			setShowReportModal(false)
			setReportReason("")
			setReportDescription("")
		} catch (error) {
			console.error("Error submitting report:", error)
			toast.error("Failed to submit report. Please try again.")
		} finally {
			setIsSubmittingReport(false)
		}
	}

	const copyToClipboard = () => {
		navigator.clipboard.writeText(shareableUrl)
		toast.success("Link copied to clipboard!")
	}

	const handleShare = (platform) => {
		toast.info(`Sharing to ${platform} (Feature coming soon!)`)
		// Placeholder for future social media integration
	}

	// Calculate number of nights
	const calculateNights = () => {
		if (!checkInDate || !checkOutDate) return 0
		const checkIn = new Date(checkInDate)
		const checkOut = new Date(checkOutDate)
		const diffTime = Math.abs(checkOut - checkIn)
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
		return diffDays
	}

	// Automatically find and apply the best active voucher
	const findAndApplyBestVoucher = () => {
		if (!property?.vouchers || !checkInDate || !checkOutDate) {
			setAutoAppliedVoucher(null)
			return
		}

		const now = new Date()
		const checkIn = new Date(checkInDate)
		const checkOut = new Date(checkOutDate)
		const nights = calculateNights()
		
		if (nights <= 0) {
			setAutoAppliedVoucher(null)
			return
		}
		
		const basePrice = property?.pricing?.basePrice || 0
		const subtotal = basePrice * nights

		let bestVoucher = null
		let bestDiscount = 0

		// Check all voucher types
		if (property.vouchers.types && Array.isArray(property.vouchers.types)) {
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

				// Check date validity for date-based vouchers
				if (voucherDetails.startDate && voucherDetails.endDate) {
					const voucherStart = new Date(voucherDetails.startDate)
					const voucherEnd = new Date(voucherDetails.endDate)
					// Check if booking dates overlap with voucher dates
					if (checkOut < voucherStart || checkIn > voucherEnd) {
						return // Booking dates don't overlap with voucher dates
					}
				}

				// Check minimum days for long_stay vouchers
				if (voucherType === "long_stay" && voucherDetails.minDays) {
					const minDays = parseInt(voucherDetails.minDays) || 0
					if (nights < minDays) {
						return // Doesn't meet minimum days requirement
					}
				}

				// Calculate discount
				let discount = 0
				const discountType = voucherDetails.discountType || "percent"
				const discountValue = parseFloat(voucherDetails.discount || voucherDetails.discountValue || 0)

				if (discountType === "percent" || discountType === "percentage") {
					discount = (subtotal * discountValue) / 100
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
					bestVoucher = {
						type: voucherType,
						details: voucherDetails,
						discount: discount,
						discountType: discountType,
						discountValue: discountValue,
					}
				}
			})
		}

		setAutoAppliedVoucher(bestVoucher)
	}

	// Calculate prices
	const calculatePrices = () => {
		const nights = calculateNights()
		const basePrice = property?.pricing?.basePrice || 0
		const cleaningFee = 500
		const serviceFee = platformPolicies.serviceFeeGuest

		// Guest fee calculation using admin setting
		const guestFee = numberOfGuests * platformPolicies.guestFeePerPerson

		const subtotal = basePrice * nights
		const totalBeforeDiscount = subtotal + cleaningFee + serviceFee + guestFee
		
		// Use auto-applied voucher discount if no manual promo is applied
		// Manual promo takes precedence
		// Recalculate discount if voucher exists and nights > 0 (to ensure it's up to date)
		let totalDiscount = 0
		if (appliedPromo) {
			totalDiscount = promoDiscount
		} else if (autoAppliedVoucher && nights > 0) {
			// Recalculate discount to ensure it's based on current subtotal
			const discountType = autoAppliedVoucher.discountType || "percent"
			const discountValue = autoAppliedVoucher.discountValue || 0
			
			if (discountType === "percent" || discountType === "percentage") {
				totalDiscount = (subtotal * discountValue) / 100
				// Check max discount if specified
				if (autoAppliedVoucher.details?.maxDiscount && totalDiscount > autoAppliedVoucher.details.maxDiscount) {
					totalDiscount = autoAppliedVoucher.details.maxDiscount
				}
			} else {
				totalDiscount = discountValue
			}
		}
		
		const total = totalBeforeDiscount - totalDiscount

		// Calculate discounted price per night
		const discountPerNight = nights > 0 ? totalDiscount / nights : 0
		const discountedPricePerNight = Math.max(0, basePrice - discountPerNight)

		return {
			nights,
			basePrice,
			subtotal,
			cleaningFee,
			serviceFee,
			guestFee,
			numberOfGuests,
			promoDiscount: totalDiscount,
			totalBeforeDiscount,
			total,
			originalPrice: basePrice, // Original price per night
			discountedPrice: discountedPricePerNight, // Discounted price per night
		}
	}

	// Get today's date for min date attribute
	const getTodayDate = () => {
		const today = new Date()
		return today.toISOString().split("T")[0]
	}

	// Get all dates between check-in and check-out
	const getDatesBetween = (startDate, endDate) => {
		const dates = []
		const current = new Date(startDate)
		const end = new Date(endDate)

		while (current <= end) {
			dates.push(current.toISOString().split("T")[0])
			current.setDate(current.getDate() + 1)
		}
		return dates
	}

	// Create booking in Firebase
	const createBooking = async (paymentId, paymentDetails) => {
		try {
			const {
				collection: firestoreCollection,
				addDoc,
				serverTimestamp,
			} = await import("firebase/firestore")

			const prices = calculatePrices()
			const bookedDatesList = getDatesBetween(checkInDate, checkOutDate)

			// Fetch user data from Firebase to get the most up-to-date email
			let userEmail = currentUser.email
			let userName = currentUser.displayName || "Guest"

			try {
				const userDoc = await getDoc(doc(db, "users", currentUser.uid))
				if (userDoc.exists()) {
					const userData = userDoc.data()
					userEmail = userData.email || currentUser.email
					userName =
						userData.displayName ||
						currentUser.displayName ||
						(userData?.firstName && userData?.lastName
							? `${userData.firstName} ${userData.lastName}`
							: userData?.firstName || userData?.lastName || "Guest")
				}
			} catch (err) {
				console.log("Using auth email as fallback:", err)
			}

			// Check if instant booking is enabled
			const isInstantBook = property?.availability?.instantBook === true

			const bookingData = {
				propertyId,
				propertyTitle: property.title,
				hostId: property.hostId || "UI7UgbxJj4atJmzmS61fAjA2E0A3",
				guestId: currentUser.uid,
				guestName: userName,
				guestEmail: userEmail,
				checkInDate,
				checkOutDate,
				numberOfGuests,
				numberOfNights: prices.nights,
				pricing: {
					basePrice: prices.basePrice,
					subtotal: prices.subtotal,
					cleaningFee: prices.cleaningFee,
					serviceFee: prices.serviceFee,
					guestFee: prices.guestFee,
					promoDiscount: prices.promoDiscount || 0,
					totalBeforeDiscount: prices.totalBeforeDiscount,
					total: prices.total,
				},
				...(appliedPromo && {
					promo: {
						code: appliedPromo.code,
						promoId: appliedPromo.id,
						discount: prices.promoDiscount,
					},
				}),
				payment: {
					method: "paypal",
					paymentId,
					fullPaymentPaid: true,
					paymentDate: new Date().toISOString(),
					paymentDetails,
					currency: "PHP",
					amountPaid: prices.total,
				},
				bookedDates: bookedDatesList,
				status: isInstantBook ? "confirmed" : "pending", // Instant book = confirmed, else pending host approval
				instantBook: isInstantBook,
				...(isInstantBook && {
					approval: {
						status: "approved",
						approvedAt: serverTimestamp(),
						approvedBy: "system",
						approvedByType: "instant_book",
					},
				}),
				createdAt: serverTimestamp(),
			}

			const bookingsRef = firestoreCollection(db, "bookings")
			const docRef = await addDoc(bookingsRef, bookingData)

			// Create notification for booking
			try {
				const { createBookingNotification } = await import(
					"../utils/notifications"
				)
				await createBookingNotification(currentUser.uid, {
					propertyTitle: property.title,
					bookingId: docRef.id,
					totalAmount: prices.total,
					checkInDate,
					checkOutDate,
				})
			} catch (notifError) {
				console.error("Error creating booking notification:", notifError)
				// Don't fail the booking if notification fails
			}

			// Handle instant booking: Create invoice and order approval
			if (isInstantBook) {
				try {
					// Create invoice for guest
					const invoiceData = {
						bookingId: docRef.id,
						guestId: currentUser.uid,
						guestName: userName,
						guestEmail: userEmail,
						hostId: property.hostId || "UI7UgbxJj4atJmzmS61fAjA2E0A3",
						propertyId: propertyId,
						propertyTitle: property.title,
						checkInDate,
						checkOutDate,
						numberOfGuests,
						numberOfNights: prices.nights,
						pricing: {
							basePrice: prices.basePrice,
							subtotal: prices.subtotal,
							cleaningFee: prices.cleaningFee,
							serviceFee: prices.serviceFee,
							guestFee: prices.guestFee,
							promoDiscount: prices.promoDiscount || 0,
							totalBeforeDiscount: prices.totalBeforeDiscount,
							total: prices.total,
						},
						payment: {
							method: paymentDetails.method || "paypal",
							paymentId,
							paymentDate: new Date().toISOString(),
							amountPaid: prices.total,
							currency: "PHP",
						},
						invoiceNumber: `INV-${docRef.id
							.substring(0, 8)
							.toUpperCase()}-${Date.now()}`,
						status: "paid",
						type: "booking",
						createdAt: serverTimestamp(),
					}

					await addDoc(firestoreCollection(db, "invoices"), invoiceData)
					console.log("✅ Invoice created for instant booking")

					// Create order approval record
					const orderApprovalData = {
						bookingId: docRef.id,
						propertyId: propertyId,
						propertyTitle: property.title,
						guestId: currentUser.uid,
						guestName: userName,
						guestEmail: userEmail,
						hostId: property.hostId || "UI7UgbxJj4atJmzmS61fAjA2E0A3",
						status: "approved",
						approvedAt: serverTimestamp(),
						approvedBy: "system",
						approvedByType: "instant_book",
						approvalMethod: "automatic",
						checkInDate,
						checkOutDate,
						totalAmount: prices.total,
						createdAt: serverTimestamp(),
					}

					await addDoc(
						firestoreCollection(db, "orderApprovals"),
						orderApprovalData
					)
					console.log("✅ Order approval created for instant booking")

					// Send invoice notification to guest
					try {
						const { createInvoiceNotification } = await import(
							"../utils/notifications"
						)
						await createInvoiceNotification(currentUser.uid, {
							invoiceNumber: invoiceData.invoiceNumber,
							bookingId: docRef.id,
							propertyTitle: property.title,
							totalAmount: prices.total,
							checkInDate,
							checkOutDate,
						})
						console.log("✅ Invoice notification sent to guest")
					} catch (invoiceNotifError) {
						console.error(
							"Error sending invoice notification:",
							invoiceNotifError
						)
						// Don't fail the booking if notification fails
					}

					// Send booking confirmation to guest (instant booking)
					toast.success(
						`🎉 Booking confirmed! Your instant booking for ${property.title} has been approved. Invoice sent to ${userEmail}`
					)
				} catch (instantBookError) {
					console.error("Error processing instant booking:", instantBookError)
					// Don't fail the booking if instant book processing fails
				}
			} else {
				// Regular booking - pending host approval
				toast.success(
					`Booking request sent! The host will review and approve your booking.`
				)
			}

			// Add money to admin wallet for ALL payment methods
			try {
				const adminEmail = "adminAurastays@aurastays.com"
				const {
					query: firestoreQuery,
					where,
					getDocs: getDocsFirestore,
				} = await import("firebase/firestore")
				const adminQuery = firestoreQuery(
					firestoreCollection(db, "users"),
					where("email", "==", adminEmail)
				)
				const adminSnapshot = await getDocsFirestore(adminQuery)

				if (!adminSnapshot.empty) {
					const adminDoc = adminSnapshot.docs[0]
					const adminRef = doc(db, "users", adminDoc.id)
					const adminData = adminDoc.data()
					const adminCurrentBalance = adminData?.walletBalance || 0
					const adminNewBalance = adminCurrentBalance + prices.total

					await updateDoc(adminRef, {
						walletBalance: adminNewBalance,
					})

					// Record admin transaction
					await addDoc(firestoreCollection(db, "walletTransactions"), {
						userId: adminDoc.id,
						type: "booking_received",
						amount: prices.total,
						propertyTitle: property.title,
						propertyId: propertyId,
						guestId: currentUser.uid,
						paymentMethod: paymentDetails.method || "paypal",
						bookingId: docRef.id,
						balanceBefore: adminCurrentBalance,
						balanceAfter: adminNewBalance,
						status: "completed",
						createdAt: serverTimestamp(),
					})

					console.log(
						`✅ Added ₱${prices.total} to admin wallet. New balance: ₱${adminNewBalance}`
					)
				} else {
					console.warn(
						"⚠️ Admin account not found. Please create admin account with email: adminAurastays@aurastays.com"
					)
				}
			} catch (adminError) {
				console.error("Error adding to admin wallet:", adminError)
				// Continue with booking even if admin wallet update fails
			}

			// Add money to host's e-wallet
			try {
				const hostId =
					property.hostId ||
					property.host?.hostId ||
					"UI7UgbxJj4atJmzmS61fAjA2E0A3"
				const hostRef = doc(db, "users", hostId)
				const hostDoc = await getDoc(hostRef)

				if (hostDoc.exists()) {
					const hostData = hostDoc.data()
					const hostCurrentBalance = hostData?.walletBalance || 0
					const hostNewBalance = hostCurrentBalance + prices.total

					await updateDoc(hostRef, {
						walletBalance: hostNewBalance,
					})

					// Record host transaction
					await addDoc(firestoreCollection(db, "walletTransactions"), {
						userId: hostId,
						type: "booking_earning",
						amount: prices.total,
						propertyTitle: property.title,
						propertyId: propertyId,
						guestId: currentUser.uid,
						paymentMethod: paymentDetails.method || "paypal",
						bookingId: docRef.id,
						balanceBefore: hostCurrentBalance,
						balanceAfter: hostNewBalance,
						status: "completed",
						createdAt: serverTimestamp(),
					})

					console.log(
						`✅ Added ₱${prices.total} to host wallet. New balance: ₱${hostNewBalance}`
					)
				}
			} catch (hostError) {
				console.error("Error adding to host wallet:", hostError)
				// Continue with booking even if host wallet update fails
			}

			// Update promo usage if promo was applied
			if (appliedPromo) {
				try {
					const promoRef = doc(db, "promos", appliedPromo.id)
					await updateDoc(promoRef, {
						usageCount: (appliedPromo.usageCount || 0) + 1,
						usedBy: arrayUnion(currentUser.uid),
					})
					// Reset promo state after successful booking
					setAppliedPromo(null)
					setPromoDiscount(0)
					setPromoCode("")
				} catch (promoError) {
					console.error("Error updating promo usage:", promoError)
					// Don't fail the booking if promo update fails
				}
			}

			// Send invoice email to guest using EmailJS
			try {
				const invoiceData = {
					guestName: userName,
					orderNumber: docRef.id.substring(0, 8).toUpperCase(),
					propertyName: property.title,
					date: `${checkInDate} to ${checkOutDate}`,
					checkInDate: checkInDate,
					checkOutDate: checkOutDate,
					numberOfNights: prices.nights,
					numberOfGuests: numberOfGuests,
					price: prices.subtotal.toFixed(2),
					cleaningFee: prices.cleaningFee.toFixed(2),
					serviceFee: prices.serviceFee.toFixed(2),
					guestFee: prices.guestFee.toFixed(2),
					total: prices.total.toFixed(2),
					email: userEmail,
					paymentId: paymentId,
					paymentDate: new Date().toLocaleDateString("en-US", {
						year: "numeric",
						month: "long",
						day: "numeric",
					}),
					paymentMethod: "PayPal",
				}

				console.log(
					"Attempting to send guest invoice email with data:",
					invoiceData
				)
				console.log(
					"EmailJS Guest Service ID:",
					import.meta.env.VITE_EMAILJS_GUEST_SERVICE_ID
				)
				console.log(
					"EmailJS Guest Invoice Template ID:",
					import.meta.env.VITE_EMAILJS_GUEST_INVOICE_TEMPLATE_ID
				)

				const response = await emailjs.send(
					import.meta.env.VITE_EMAILJS_GUEST_SERVICE_ID,
					import.meta.env.VITE_EMAILJS_GUEST_INVOICE_TEMPLATE_ID,
					invoiceData
				)

				console.log("EmailJS Response:", response)
				console.log("Invoice email sent successfully to:", userEmail)
				toast.success("Invoice sent to your email!")
			} catch (emailError) {
				console.error("Error sending invoice email:", emailError)
				console.error("Error details:", {
					message: emailError.message,
					text: emailError.text,
					status: emailError.status,
				})
				// Suppress error toast if email was actually sent successfully
				// EmailJS sometimes returns errors even when emails send successfully
				const errorMessage = emailError.message?.toLowerCase() || ""
				const errorText = emailError.text?.toLowerCase() || ""
				const isAccountNotFound =
					errorMessage.includes("account not found") ||
					errorText.includes("account not found")

				// Only show error if it's not an "account not found" error
				// (which often appears even when email sends successfully)
				if (!isAccountNotFound && emailError.status !== 200) {
					toast.error("Booking confirmed, but failed to send invoice email.")
				}
			}

			// Send booking confirmation email to host
			try {
				const hostId =
					property.hostId ||
					property.host?.hostId ||
					"UI7UgbxJj4atJmzmS61fAjA2E0A3"
				const hostName = property.host?.hostName || "Host"

				// Fetch host email from users collection
				let hostEmail = null
				try {
					const hostDoc = await getDoc(doc(db, "users", hostId))
					if (hostDoc.exists()) {
						hostEmail = hostDoc.data().email
					}
				} catch (err) {
					console.error("Error fetching host email:", err)
				}

				if (hostEmail) {
					const hostBookingData = {
						hostEmail: hostEmail,
						hostName: hostName,
						guestName: userName,
						propertyName: property.title,
						checkInDate: new Date(checkInDate).toLocaleDateString("en-US", {
							year: "numeric",
							month: "long",
							day: "numeric",
						}),
						checkOutDate: new Date(checkOutDate).toLocaleDateString("en-US", {
							year: "numeric",
							month: "long",
							day: "numeric",
						}),
						numberOfGuests: numberOfGuests,
						numberOfNights: prices.nights,
						totalAmount: `₱${prices.total.toLocaleString()}`,
						bookingId: docRef.id.substring(0, 8).toUpperCase(),
					}

					console.log(
						"Attempting to send host booking confirmation:",
						hostBookingData
					)

					await sendHostBookingConfirmation(hostBookingData)
					console.log(
						"Host booking confirmation sent successfully to:",
						hostEmail
					)
				} else {
					console.warn("Host email not found, skipping host notification")
				}
			} catch (hostEmailError) {
				console.error(
					"Error sending host booking confirmation:",
					hostEmailError
				)
				// Don't show error to guest - this is host-side issue
			}

			toast.success("Payment successful! Booking is pending host approval.")

			// Redirect to dashboard after 3 seconds (increased to show messages)
			setTimeout(() => {
				navigate(getDashboardRoute())
			}, 3000)

			return docRef.id
		} catch (error) {
			console.error("Error creating booking:", error)
			toast.error("Failed to create booking")
			throw error
		}
	}

	// Handle Wallet Payment
	const handleWalletPayment = async () => {
		if (!currentUser) {
			toast.error("Please login to make a booking")
			return
		}

		// Validations
		if (!checkInDate || !checkOutDate) {
			toast.error("Please select check-in and check-out dates")
			return
		}

		const checkIn = new Date(checkInDate)
		const checkOut = new Date(checkOutDate)

		if (checkOut <= checkIn) {
			toast.error("Check-out date must be after check-in date")
			return
		}

		// Validate number of guests doesn't exceed property capacity
		const maxGuests =
			property.capacity?.guests || property.capacity?.maxGuests || 8
		if (numberOfGuests > maxGuests) {
			toast.error(
				`This property can accommodate a maximum of ${maxGuests} guests.`
			)
			setNumberOfGuests(maxGuests)
			return
		}

		// Check if selected dates are available
		if (!checkDateAvailability()) {
			toast.error(
				"Selected dates are not available. Please choose different dates."
			)
			return
		}

		const prices = calculatePrices()
		const totalAmount = prices.total

		// Check if wallet has sufficient balance
		if (walletBalance < totalAmount) {
			toast.error(
				`Insufficient wallet balance. You need ₱${totalAmount.toLocaleString()} but have ₱${walletBalance.toLocaleString()}`
			)
			return
		}

		// Show custom payment confirmation modal
		setShowWalletPaymentModal(true)
	}

	const handleConfirmWalletPayment = async () => {
		const prices = calculatePrices()
		const totalAmount = prices.total

		setShowWalletPaymentModal(false)
		setIsProcessingPayment(true)

		try {
			toast("Processing payment from wallet...", { type: "info" })

			// Deduct from wallet
			const {
				collection: firestoreCollection,
				addDoc,
				serverTimestamp: timestamp,
			} = await import("firebase/firestore")
			const userRef = doc(db, "users", currentUser.uid)
			const userDoc = await getDoc(userRef)
			const currentBalance = userDoc.data()?.walletBalance || 0
			const newBalance = currentBalance - totalAmount

			await updateDoc(userRef, {
				walletBalance: newBalance,
			})

			// Record wallet transaction
			await addDoc(firestoreCollection(db, "walletTransactions"), {
				userId: currentUser.uid,
				type: "payment",
				amount: totalAmount,
				propertyTitle: property.title,
				propertyId: propertyId,
				balanceBefore: currentBalance,
				balanceAfter: newBalance,
				status: "completed",
				createdAt: timestamp(),
			})

			// Add money to admin wallet
			try {
				const adminEmail = "adminAurastays@aurastays.com"
				const {
					query: firestoreQuery,
					where,
					getDocs,
				} = await import("firebase/firestore")
				const adminQuery = firestoreQuery(
					firestoreCollection(db, "users"),
					where("email", "==", adminEmail)
				)
				const adminSnapshot = await getDocs(adminQuery)

				if (!adminSnapshot.empty) {
					const adminDoc = adminSnapshot.docs[0]
					const adminRef = doc(db, "users", adminDoc.id)
					const adminData = adminDoc.data()
					const adminCurrentBalance = adminData?.walletBalance || 0
					const adminNewBalance = adminCurrentBalance + totalAmount

					await updateDoc(adminRef, {
						walletBalance: adminNewBalance,
					})

					// Record admin transaction
					await addDoc(firestoreCollection(db, "walletTransactions"), {
						userId: adminDoc.id,
						type: "booking_received",
						amount: totalAmount,
						propertyTitle: property.title,
						propertyId: propertyId,
						guestId: currentUser.uid,
						balanceBefore: adminCurrentBalance,
						balanceAfter: adminNewBalance,
						status: "completed",
						createdAt: timestamp(),
					})
				}
			} catch (adminError) {
				console.error("Error adding to admin wallet:", adminError)
				// Continue with booking even if admin wallet update fails
			}

			// Add money to host's e-wallet
			try {
				const hostId =
					property.hostId ||
					property.host?.hostId ||
					"UI7UgbxJj4atJmzmS61fAjA2E0A3"
				const hostRef = doc(db, "users", hostId)
				const hostDoc = await getDoc(hostRef)

				if (hostDoc.exists()) {
					const hostData = hostDoc.data()
					const hostCurrentBalance = hostData?.walletBalance || 0
					const hostNewBalance = hostCurrentBalance + totalAmount

					await updateDoc(hostRef, {
						walletBalance: hostNewBalance,
					})

					// Record host transaction
					await addDoc(firestoreCollection(db, "walletTransactions"), {
						userId: hostId,
						type: "booking_earning",
						amount: totalAmount,
						propertyTitle: property.title,
						propertyId: propertyId,
						guestId: currentUser.uid,
						balanceBefore: hostCurrentBalance,
						balanceAfter: hostNewBalance,
						status: "completed",
						createdAt: timestamp(),
					})
				}
			} catch (hostError) {
				console.error("Error adding to host wallet:", hostError)
				// Continue with booking even if host wallet update fails
			}

			// Create booking with wallet payment details
			await createBooking("WALLET-" + Date.now(), {
				method: "wallet",
				status: "COMPLETED",
			})

			// Update local wallet balance
			setWalletBalance(newBalance)

			toast.success("Payment successful from wallet!")
		} catch (error) {
			console.error("Wallet payment error:", error)
			toast.error("Payment failed. Please try again.")
		} finally {
			setIsProcessingPayment(false)
		}
	}

	// Handle calendar day click for booking (guest)
	const handleCalendarDayClick = (dateString, isUnavailable) => {
		if (isUnavailable) {
			toast.error("This date is unavailable")
			return
		}

		if (selectingCheckIn) {
			// Selecting check-in date
			setCheckInDate(dateString)
			setCheckOutDate("") // Reset check-out
			setSelectingCheckIn(false)
			toast.success("Check-in date selected. Now select check-out date.")
		} else {
			// Selecting check-out date
			const checkIn = new Date(checkInDate)
			const checkOut = new Date(dateString)

			if (checkOut <= checkIn) {
				toast.error("Check-out must be after check-in date")
				return
			}

			// Check if date range is available
			const tempDates = getDatesBetween(checkInDate, dateString)
			const hasConflict = tempDates.some((date) => bookedDates.includes(date))

			if (hasConflict) {
				toast.error(
					"Some dates in this range are booked. Please select different dates."
				)
				return
			}

			setCheckOutDate(dateString)
			setSelectingCheckIn(true)
			setShowDatePickerModal(false)
			toast.success("Dates selected successfully!")
		}
	}

	// Open date picker modal
	const openDatePicker = () => {
		setSelectingCheckIn(true)
		setShowDatePickerModal(true)
	}

	// Check if selected dates are available
	const checkDateAvailability = () => {
		if (!checkInDate || !checkOutDate) return false

		const selectedDates = getDatesBetween(checkInDate, checkOutDate)

		// Check if any selected date is already booked
		for (const date of selectedDates) {
			if (bookedDates.includes(date)) {
				return false
			}
		}
		return true
	}

	// Handle PayPal payment
	const handlePayPalPayment = async () => {
		if (!currentUser) {
			toast.error("Please login to make a booking")
			return
		}

		if (!checkInDate || !checkOutDate) {
			toast.error("Please select check-in and check-out dates")
			return
		}

		// Validate check-out is after check-in
		const checkIn = new Date(checkInDate)
		const checkOut = new Date(checkOutDate)
		if (checkOut <= checkIn) {
			toast.error("Check-out date must be after check-in date")
			return
		}

		// Validate number of guests doesn't exceed property capacity
		const maxGuests =
			property.capacity?.guests || property.capacity?.maxGuests || 8
		if (numberOfGuests > maxGuests) {
			toast.error(
				`This property can accommodate a maximum of ${maxGuests} guests.`
			)
			setNumberOfGuests(maxGuests)
			return
		}

		// Check if selected dates are available
		if (!checkDateAvailability()) {
			toast.error(
				"Selected dates are not available. Please choose different dates."
			)
			return
		}

		const prices = calculatePrices()
		const totalAmount = prices.total.toFixed(2)

		// Check if PayPal SDK is loaded
		if (!window.paypal || !isPayPalLoaded) {
			toast("PayPal is loading, please wait...")
			return
		}

		// Clear existing buttons
		if (paypalRef.current) {
			paypalRef.current.innerHTML = ""
		}

		setIsProcessingPayment(true)

		try {
			window.paypal
				.Buttons({
					createOrder: (data, actions) => {
						return actions.order.create({
							purchase_units: [
								{
									description: `${property.title} - ${prices.nights} nights (Full Payment)`,
									amount: {
										currency_code: "PHP",
										value: totalAmount,
									},
								},
							],
							application_context: {
								shipping_preference: "NO_SHIPPING",
							},
						})
					},
					onApprove: async (data, actions) => {
						try {
							setIsProcessingPayment(true)
							toast("Processing your payment...", { type: "info" })

							const details = await actions.order.capture()

							// Check if payment was successful
							if (details.status === "COMPLETED") {
								await createBooking(details.id, details)
								// Refresh booked dates
								await fetchBookedDates()
								// Clear form
								setCheckInDate("")
								setCheckOutDate("")
								setNumberOfGuests(1)
							} else {
								throw new Error("Payment not completed")
							}

							setIsProcessingPayment(false)
						} catch (error) {
							console.error("Payment error:", error)

							// Check for specific error types
							if (
								error.message &&
								error.message.includes("INSUFFICIENT_FUNDS")
							) {
								toast.error(
									"Insufficient funds in your PayPal account. Please add funds and try again."
								)
							} else if (
								error.message &&
								error.message.includes("INSTRUMENT_DECLINED")
							) {
								toast.error(
									"Payment method declined. Please try a different payment method."
								)
							} else {
								toast.error("Payment processing failed. Please try again.")
							}

							setIsProcessingPayment(false)
						}
					},
					onError: (err) => {
						console.error("PayPal error:", err)

						// Provide specific error messages
						if (err && err.message) {
							if (err.message.includes("INSUFFICIENT_FUNDS")) {
								toast.error(
									"Insufficient balance in PayPal account. Please add funds."
								)
							} else if (err.message.includes("currency")) {
								toast.error("Currency not supported. Please contact support.")
							} else {
								toast.error(`Payment failed: ${err.message}`)
							}
						} else {
							toast.error(
								"Payment failed. Please try again or contact support."
							)
						}

						setIsProcessingPayment(false)

						// Reload page after error
						setTimeout(() => {
							window.location.reload()
						}, 2000)
					},
					onCancel: () => {
						toast("Payment cancelled by user. Reloading page...", {
							type: "info",
						})
						setIsProcessingPayment(false)

						// Reload page after cancellation
						setTimeout(() => {
							window.location.reload()
						}, 1500)
					},
				})
				.render(paypalRef.current)
		} catch (error) {
			console.error("Error rendering PayPal buttons:", error)
			toast.error("Failed to initialize PayPal. Please try again.")
			setIsProcessingPayment(false)
		}
	}

	// Check if date is booked
	const isDateBooked = (dateString) => {
		return bookedDates.includes(dateString)
	}

	// Check if date is blocked by host (from property)
	const isDateBlocked = (dateString) => {
		return propertyBlockedDates.includes(dateString)
	}

	// Resolve the correct Firestore document ID for the property
	const resolvePropertyDocId = async () => {
		try {
			// Prefer the id we stored on the loaded property object, but verify it exists
			if (property?.id) {
				console.log(
					"[BlockDate] Checking loaded property.id as Firestore ID:",
					property.id
				)
				const checkRef = doc(db, "properties", property.id)
				const checkSnap = await getDoc(checkRef)
				if (checkSnap.exists()) {
					console.log(
						"[BlockDate] Verified Firestore doc exists for property.id"
					)
					return property.id
				} else {
					console.warn(
						"[BlockDate] Loaded property.id did not resolve to a Firestore doc"
					)
				}
			}
			// Try direct doc lookup by current route param
			console.log(
				"[BlockDate] Resolving Firestore ID from route propertyId:",
				propertyId
			)
			const directRef = doc(db, "properties", propertyId)
			const directSnap = await getDoc(directRef)
			if (directSnap.exists()) {
				console.log("[BlockDate] Found property by route propertyId")
				return propertyId
			}
			// Try to find by 'id' field inside document data
			console.log("[BlockDate] Searching properties by data.id match...")
			const allPropsQ = query(
				collection(db, "properties"),
				where("id", "==", propertyId)
			)
			const allPropsSnap = await getDocs(allPropsQ)
			if (!allPropsSnap.empty) {
				const matchedDoc = allPropsSnap.docs[0]
				console.log(
					"[BlockDate] Found property by data.id; Firestore ID:",
					matchedDoc.id
				)
				return matchedDoc.id
			}
			console.error(
				"[BlockDate] Could not resolve Firestore document ID for property",
				propertyId
			)
			return null
		} catch (e) {
			console.error("[BlockDate] Error resolving property doc ID:", {
				message: e?.message,
				code: e?.code,
				name: e?.name,
				stack: e?.stack,
			})
			return null
		}
	}

	// Host: toggle blocked date on property
	const handleToggleBlockDate = async (dateString) => {
		if (!isHost) return
		try {
			const resolvedId = await resolvePropertyDocId()
			if (!resolvedId) {
				toast.error("Unable to locate property. Please refresh.")
				return
			}
			const propertyRef = doc(db, "properties", resolvedId)
			console.log("[BlockDate] Toggling date", {
				dateString,
				propertyId: resolvedId,
				isHost,
				isCurrentlyBlocked: isDateBlocked(dateString),
			})
			// Verify property exists and log current blockedDates
			try {
				const propSnap = await getDoc(propertyRef)
				if (!propSnap.exists()) {
					console.error("[BlockDate] Property doc not found for", resolvedId)
				} else {
					const data = propSnap.data() || {}
					console.log(
						"[BlockDate] Current property.blockedDates:",
						data.blockedDates || []
					)
				}
			} catch (preErr) {
				console.error("[BlockDate] Failed to read property before update:", {
					message: preErr?.message,
					code: preErr?.code,
					name: preErr?.name,
					stack: preErr?.stack,
				})
			}
			if (isDateBlocked(dateString)) {
				console.log("[BlockDate] Attempting to UNBLOCK date via arrayRemove")
				await updateDoc(propertyRef, { blockedDates: arrayRemove(dateString) })
				const updated = propertyBlockedDates.filter((d) => d !== dateString)
				setPropertyBlockedDates(updated)
				// Also update merged list used by availability view
				setBookedDates((prev) => prev.filter((d) => d !== dateString))
				toast.success("Date unblocked")
			} else {
				console.log("[BlockDate] Attempting to BLOCK date via arrayUnion")
				await updateDoc(propertyRef, { blockedDates: arrayUnion(dateString) })
				const updated = [...propertyBlockedDates, dateString]
				setPropertyBlockedDates(updated)
				// Also update merged list used by availability view
				setBookedDates((prev) => Array.from(new Set([...prev, dateString])))
				toast.success("Date blocked")
			}
		} catch (error) {
			console.error("[BlockDate] Error toggling blocked date:", {
				message: error?.message,
				code: error?.code,
				name: error?.name,
				stack: error?.stack,
				propertyId: property?.id || propertyId,
			})
			toast.error("Failed to update blocked date")
		}
	}

	// Generate calendar days for current month
	const generateCalendarDays = () => {
		const year = currentMonth.getFullYear()
		const month = currentMonth.getMonth()
		const firstDay = new Date(year, month, 1).getDay()
		const daysInMonth = new Date(year, month + 1, 0).getDate()

		const days = []
		// Add empty cells for days before month starts
		for (let i = 0; i < firstDay; i++) {
			days.push(null)
		}
		// Add days of the month
		for (let day = 1; day <= daysInMonth; day++) {
			const dateString = `${year}-${String(month + 1).padStart(
				2,
				"0"
			)}-${String(day).padStart(2, "0")}`
			const blocked = isDateBlocked(dateString)
			const booked = isDateBooked(dateString)
			days.push({
				day,
				dateString,
				isBooked: booked,
				isBlocked: blocked,
				isPast: new Date(dateString) < new Date(getTodayDate()),
			})
		}
		return days
	}

	// Navigate months
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

	// Helper function to format dates
	const formatDate = (dateInput) => {
		if (!dateInput) return "N/A"
		const date = dateInput.toDate ? dateInput.toDate() : new Date(dateInput)
		return date.toLocaleDateString("en-US", {
			year: "numeric",
			month: "long",
			day: "numeric",
		})
	}

	// Send message to guest about property deletion
	const sendBookingMessageForDeletion = async (booking, refundAmount) => {
		try {
			if (!booking.guestId) {
				console.warn("[DeleteProperty] No guestId found for booking", booking.id)
				return
			}

			const displayName = userData?.displayName || currentUser?.displayName || "Host"
			const userEmail = userData?.email || currentUser?.email || ""

			// Find or create conversation between host and guest
			const conversationsQuery = query(
				collection(db, "conversations"),
				where("guestId", "==", booking.guestId),
				where("hostId", "==", currentUser.uid),
				where("propertyId", "==", propertyId)
			)
			const conversationsSnapshot = await getDocs(conversationsQuery)

			let conversationId
			const messageBody = `We regret to inform you that the property "${property.title}" has been removed from our platform by the host. Your booking from ${formatDate(booking.checkInDate)} to ${formatDate(booking.checkOutDate)} has been cancelled.${refundAmount > 0 ? ` A full refund of ₱${refundAmount.toLocaleString()} has been processed and added to your e-wallet.` : ""} We apologize for any inconvenience. Please contact support if you need assistance finding alternative accommodations.`
			const messageSubject = `Property Deleted: ${property.title}`
			const lastMessage = "Property has been deleted and your booking has been cancelled."

			if (!conversationsSnapshot.empty) {
				// Use existing conversation
				conversationId = conversationsSnapshot.docs[0].id
				const conversationDoc = conversationsSnapshot.docs[0]
				const conversationData = conversationDoc.data()

				// Update conversation
				await updateDoc(doc(db, "conversations", conversationId), {
					lastMessage: lastMessage,
					lastMessageAt: serverTimestamp(),
					guestUnreadCount: (conversationData.guestUnreadCount || 0) + 1,
				})
			} else {
				// Create new conversation
				const guestDoc = await getDoc(doc(db, "users", booking.guestId))
				const guestData = guestDoc.exists() ? guestDoc.data() : {}

				const conversationData = {
					guestId: booking.guestId,
					guestName: booking.guestName || guestData.displayName || "Guest",
					guestEmail: booking.guestEmail || guestData.email || "",
					hostId: currentUser.uid,
					hostName: displayName,
					hostEmail: userEmail,
					propertyId: propertyId,
					propertyTitle: property.title,
					lastMessage: lastMessage,
					lastMessageAt: serverTimestamp(),
					createdAt: serverTimestamp(),
					guestUnreadCount: 1,
					hostUnreadCount: 0,
				}
				const conversationRef = await addDoc(
					collection(db, "conversations"),
					conversationData
				)
				conversationId = conversationRef.id
			}

			// Add message to messages collection
			const messageData = {
				conversationId,
				senderId: currentUser.uid,
				senderName: displayName,
				senderType: "host",
				recipientId: booking.guestId,
				recipientName: booking.guestName || "Guest",
				recipientType: "guest",
				subject: messageSubject,
				body: messageBody,
				propertyId: propertyId,
				propertyTitle: property.title,
				read: false,
				createdAt: serverTimestamp(),
			}

			await addDoc(collection(db, "messages"), messageData)
			console.log(`[DeleteProperty] Message sent to guest ${booking.guestId}`)
		} catch (e) {
			console.error(`[DeleteProperty] Failed to send message:`, e)
		}
	}

	// Delete property and refund all upcoming bookings
	const handleDeleteProperty = async () => {
		const confirmed = window.confirm(
			`Are you sure you want to delete "${property.title}"? This action cannot be undone. All upcoming bookings will be cancelled and fully refunded to guests.`
		)

		if (!confirmed) return

		setIsDeletingProperty(true)
		try {
			// Find all active bookings for this property (pending, confirmed, cancellation_requested)
			// Exclude cancelled and completed bookings
			const bookingsRef = collection(db, "bookings")
			const bookingsQuery = query(
				bookingsRef,
				where("propertyId", "==", propertyId)
			)
			const bookingsSnapshot = await getDocs(bookingsQuery)

			const activeBookings = []
			bookingsSnapshot.forEach((doc) => {
				const booking = { id: doc.id, ...doc.data() }
				const status = booking.status || "pending"
				// Include pending, confirmed, and cancellation_requested bookings
				if (
					status === "pending" ||
					status === "confirmed" ||
					status === "cancellation_requested"
				) {
					activeBookings.push(booking)
				}
			})

			console.log(`[DeleteProperty] Found ${activeBookings.length} active bookings to refund`)

			// Process refunds for each active booking
			for (const booking of activeBookings) {
				try {
					const totalAmount = booking.pricing?.total || 0
					const refundAmount = totalAmount // Full refund for property deletion

					if (refundAmount > 0 && booking.guestId) {
						// Get guest's current wallet balance
						const guestRef = doc(db, "users", booking.guestId)
						const guestDoc = await getDoc(guestRef)

						if (guestDoc.exists()) {
							const guestData = guestDoc.data()
							const guestCurrentBalance = guestData?.walletBalance || 0
							const guestNewBalance = guestCurrentBalance + refundAmount

							// Update guest wallet
							await updateDoc(guestRef, {
								walletBalance: guestNewBalance,
							})

							// Add transaction to guest's transaction history
							await addDoc(collection(db, "walletTransactions"), {
								userId: booking.guestId,
								type: "refund",
								amount: refundAmount,
								propertyTitle: property.title,
								propertyId: propertyId,
								bookingId: booking.id,
								balanceBefore: guestCurrentBalance,
								balanceAfter: guestNewBalance,
								status: "completed",
								description: `Full refund for property deletion: ${property.title}`,
								createdAt: serverTimestamp(),
							})

							console.log(
								`[DeleteProperty] Refunded ₱${refundAmount.toLocaleString()} to guest ${booking.guestId}`
							)
						}

						// Decrease host's wallet balance
						const hostId = property.hostId || currentUser.uid
						const hostRef = doc(db, "users", hostId)
						const hostDoc = await getDoc(hostRef)

						if (hostDoc.exists()) {
							const hostData = hostDoc.data()
							const hostCurrentBalance = hostData?.walletBalance || 0
							const hostNewBalance = Math.max(0, hostCurrentBalance - refundAmount)

							// Update host wallet
							await updateDoc(hostRef, {
								walletBalance: hostNewBalance,
							})

							// Add transaction to host's transaction history
							await addDoc(collection(db, "walletTransactions"), {
								userId: hostId,
								type: "refund_deduction",
								amount: -refundAmount,
								propertyTitle: property.title,
								propertyId: propertyId,
								bookingId: booking.id,
								guestId: booking.guestId,
								balanceBefore: hostCurrentBalance,
								balanceAfter: hostNewBalance,
								status: "completed",
								description: `Refund deduction for property deletion: ${property.title}`,
								createdAt: serverTimestamp(),
							})

							console.log(
								`[DeleteProperty] Deducted ₱${refundAmount.toLocaleString()} from host wallet`
							)
						}
					}

					// Update booking status to cancelled
					await updateDoc(doc(db, "bookings", booking.id), {
						status: "cancelled",
						cancelledBy: currentUser.uid,
						cancelledAt: serverTimestamp(),
						cancellationReason: "Property deleted by host",
						refundAmount: refundAmount,
						refundProcessedAt: refundAmount > 0 ? serverTimestamp() : null,
					})

					// Send message to guest about property deletion
					await sendBookingMessageForDeletion(booking, refundAmount)

					console.log(`[DeleteProperty] Cancelled booking ${booking.id}`)
				} catch (bookingError) {
					console.error(
						`[DeleteProperty] Error processing booking ${booking.id}:`,
						bookingError
					)
					// Continue with other bookings even if one fails
				}
			}

			// Delete the property document
			const propertyRef = doc(db, "properties", propertyId)
			await deleteDoc(propertyRef)

			console.log(`[DeleteProperty] Property ${propertyId} deleted successfully`)
			toast.success(
				`Property deleted successfully. ${activeBookings.length > 0 ? `${activeBookings.length} booking(s) cancelled and refunded.` : ""}`
			)

			// Navigate to host dashboard
			navigate("/dashboardHost")
		} catch (error) {
			console.error("[DeleteProperty] Error deleting property:", error)
			toast.error("Failed to delete property. Please try again.")
		} finally {
			setIsDeletingProperty(false)
		}
	}

	if (loading) {
		return (
			<div className="property-details-loading">
				<div className="loading-spinner"></div>
				<p>Loading property details...</p>
			</div>
		)
	}

	if (!property) {
		return (
			<div className="property-details-error">
				<h2>Property not found</h2>
				<Link to="/dashboardGuest" className="back-link">
					Return to Dashboard
				</Link>
			</div>
		)
	}

	const images = property.images || [housePlaceholder]
	const hostInfo = property.host || {}

	return (
		<div className="property-details-container">
			{/* Navigation Header */}
			<nav className="top-navbar">
				{/* Logo */}
				<div className="navbar-logo" onClick={() => navigate(getDashboardRoute())}>
					<img src={logoPlain} alt="AuraStays" />
					<span className="logo-text">AuraStays</span>
				</div>

				{/* Right Section */}
				<div className="navbar-right">
					{/* Action Buttons */}
					<button
						onClick={() => setShowShareModal(true)}
						className="icon-button"
						title="Share"
					>
						<FaShare />
					</button>
					{currentUser && !isHost && (
						<button
							onClick={() => setShowReportModal(true)}
							className="icon-button"
							title="Report"
						>
							<FaFlag />
						</button>
					)}
					{!isHost && (
						<>
							<button
								onClick={toggleFavorite}
								className={`icon-button ${isFavorite ? "active" : ""}`}
								title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
							>
								<FaHeart />
							</button>
							<button
								onClick={toggleWishlist}
								className={`icon-button ${isInWishlist ? "active" : ""}`}
								title={isInWishlist ? "Remove from Wishlist" : "Add to Wishlist"}
							>
								<FaBookmark />
							</button>
						</>
					)}

					{/* Messages */}
					{currentUser && (
						<button
							className="icon-button messages-btn"
							title="Messages"
							onClick={() => navigate("/messages")}
						>
							<FaEnvelope />
						</button>
					)}

					{/* Delete Property Button - Only visible to host */}
					{isHost && currentUser && (
						<button
							className="icon-button delete-property-btn"
							title="Delete Property"
							onClick={handleDeleteProperty}
							disabled={isDeletingProperty}
							style={{
								color: isDeletingProperty ? "#999" : "#dc3545",
								cursor: isDeletingProperty ? "not-allowed" : "pointer",
							}}
						>
							<FaTrash />
						</button>
					)}

					{/* User Menu */}
					{currentUser ? (
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
											navigate(getDashboardRoute())
											setIsMenuOpen(false)
										}}
									>
										<FaHome />
										<span>Dashboard</span>
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
					) : (
						<button
							className="login-btn"
							onClick={() => navigate("/login")}
						>
							Log in
						</button>
					)}
				</div>
			</nav>

			{/* Main Content */}
			<div className="property-details-content">
			{/* Title Section */}
			<div className="property-title-section">
				<h1>{property.title || property.name}</h1>
				<div className="property-meta">
					<div className="rating-location">
						{property.rating && (
							<span className="rating">
								<FaStar /> {property.rating} ({property.reviewsCount || 0}{" "}
								reviews)
							</span>
						)}
						<span className="location">
							<FaMapMarkerAlt />
							{typeof property.location === "object"
								? `${property.location.city}, ${property.location.province}`
								: property.location}
						</span>
					</div>
				</div>
			</div>

			{/* Photo Gallery */}
			<div className="photo-gallery">
				<div 
					className="main-photo" 
					onClick={() => {
						setFullSizeImageIndex(selectedImage)
						setShowFullSizeImage(true)
					}}
					style={{ cursor: "pointer" }}
				>
					<img
						src={images[selectedImage] || housePlaceholder}
						alt="Main view"
						style={{ cursor: "pointer" }}
					/>
					<button 
						className="view-all-photos-btn"
						onClick={(e) => {
							e.stopPropagation()
							setShowAllPhotos(true)
						}}
					>
						View all {images.length} photos
					</button>
				</div>
				<div className="photo-thumbnails">
					{images.slice(0, 4).map((img, index) => (
						<div
							key={index}
							className={`thumbnail ${selectedImage === index ? "active" : ""}`}
							onClick={(e) => {
								e.stopPropagation()
								setSelectedImage(index)
							}}
						>
							<img 
								src={img} 
								alt={`View ${index + 1}`}
								style={{ cursor: "pointer" }}
								onClick={(e) => {
									e.stopPropagation()
									setFullSizeImageIndex(index)
									setShowFullSizeImage(true)
								}}
							/>
						</div>
					))}
					{images.length > 4 && (
						<div
							className="thumbnail more"
							onClick={(e) => {
								e.stopPropagation()
								setShowAllPhotos(true)
							}}
						>
							<span>+{images.length - 4}</span>
						</div>
					)}
				</div>
			</div>

			{/* Main Content */}
			<div className="property-main-content">
				{/* Left Column */}
				<div className="content-left">
					{/* Property Info */}
					<section className="info-section">
						<h2>About this property</h2>
						<div className="property-specs">
							{property.guests && (
								<div className="spec-item">
									<FaUser />
									<span>{property.guests} guests</span>
								</div>
							)}
							{property.bedrooms && (
								<div className="spec-item">
									<span>{property.bedrooms} bedrooms</span>
								</div>
							)}
							{property.beds && (
								<div className="spec-item">
									<span>{property.beds} beds</span>
								</div>
							)}
							{property.bathrooms && (
								<div className="spec-item">
									<span>{property.bathrooms} bathrooms</span>
								</div>
							)}
						</div>
						<p className="description">{property.description}</p>
					</section>

					{/* Amenities */}
					<section className="amenities-section">
						<h2>What this place offers</h2>
						<div className="amenities-grid">
							{(property.amenities || []).map((amenity, index) => (
								<div key={index} className="amenity-item">
									<FaCheck />
									<span>{amenity}</span>
								</div>
							))}
						</div>
					</section>

					{/* House Rules */}
					{property.houseRules && property.houseRules.length > 0 && (
						<section className="house-rules-section">
							<h2>House Rules</h2>
							<div className="house-rules-grid">
								{property.houseRules.map((rule, index) => (
									<div key={index} className="house-rule-item">
										<FaCheck />
										<span>{rule}</span>
									</div>
								))}
							</div>
						</section>
					)}

					{/* Property Coupons */}
					{propertyCoupons.length > 0 && (
						<section className="coupons-section" style={{ marginTop: "3rem", marginBottom: "3rem" }}>
							<h2>Special Offers</h2>
							<div className="coupons-grid" style={{ 
								display: "grid", 
								gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", 
								gap: "1rem",
								marginTop: "1rem"
							}}>
								{propertyCoupons.map((coupon) => {
									const discountDisplay = coupon.discountType === "percentage" || coupon.discountType === "percent"
										? `${coupon.discountValue || coupon.discount || 0}%`
										: `₱${(coupon.discountValue || coupon.discount || 0).toLocaleString()}`
									
									const validFrom = coupon.validFrom ? new Date(coupon.validFrom).toLocaleDateString("en-US", {
										month: "short",
										day: "numeric",
										year: "numeric"
									}) : null
									
									const validUntil = coupon.validUntil ? new Date(coupon.validUntil).toLocaleDateString("en-US", {
										month: "short",
										day: "numeric",
										year: "numeric"
									}) : null

									return (
										<div 
											key={coupon.id} 
											className="coupon-card"
											style={{
												border: "2px solid var(--primary)",
												borderRadius: "12px",
												padding: "1.5rem",
												background: "linear-gradient(135deg, rgba(97, 191, 156, 0.05) 0%, rgba(97, 191, 156, 0.02) 100%)",
												position: "relative",
												overflow: "hidden"
											}}
										>
											<div style={{
												position: "absolute",
												top: "0.5rem",
												right: "0.5rem",
												background: "var(--primary)",
												color: "white",
												padding: "0.5rem 1rem",
												borderRadius: "20px",
												fontSize: "1rem",
												fontWeight: "700",
												display: "flex",
												alignItems: "center",
												gap: "0.5rem"
											}}>
												<FaGift style={{ fontSize: "1rem", flexShrink: 0 }} />
												<span>{coupon.code}</span>
											</div>
											
											<div style={{ marginTop: "1.5rem" }}>
												<div style={{
													fontSize: "2rem",
													fontWeight: "700",
													color: "var(--primary)",
													marginBottom: "0.5rem"
												}}>
													{discountDisplay} OFF
												</div>
												
												{coupon.description && (
													<p style={{
														fontSize: "0.9rem",
														color: "#666",
														marginBottom: "1rem",
														lineHeight: "1.5"
													}}>
														{coupon.description}
													</p>
												)}
												
												{(validFrom || validUntil) && (
													<div style={{
														fontSize: "0.85rem",
														color: "#999",
														marginTop: "1rem",
														paddingTop: "1rem",
														borderTop: "1px solid #e0e0e0"
													}}>
														{validFrom && validUntil ? (
															<>
																<FaCalendarAlt style={{ marginRight: "0.5rem" }} />
																Valid: {validFrom} - {validUntil}
															</>
														) : validUntil ? (
															<>
																<FaCalendarAlt style={{ marginRight: "0.5rem" }} />
																Valid until: {validUntil}
															</>
														) : null}
													</div>
												)}
												
												{coupon.minPurchase > 0 && (
													<div style={{
														fontSize: "0.85rem",
														color: "#999",
														marginTop: "0.5rem"
													}}>
														Minimum purchase: ₱{coupon.minPurchase.toLocaleString()}
													</div>
												)}
											</div>
										</div>
									)
								})}
							</div>
						</section>
					)}

					{/* Booking Availability Info */}
					{property.availability && (
						<section className="booking-info-section">
							<h2>Booking Information</h2>
							<div className="booking-info-content">
								{property.availability.instantBook && (
									<div className="booking-info-item">
										<FaCheck
											style={{ color: "var(--primary)", marginRight: "0.5rem" }}
										/>
										<span>
											<strong>Instant Book</strong> - Book immediately without
											approval
										</span>
									</div>
								)}
								<div
									style={{
										display: "grid",
										gridTemplateColumns: "repeat(2, 1fr)",
										gap: "1rem",
										marginTop: property.availability.instantBook ? "1rem" : "0",
									}}
								>
									{property.availability.minNights && (
										<div className="booking-info-item">
											<span>
												<strong>Minimum Nights:</strong>{" "}
												{property.availability.minNights} night
												{property.availability.minNights !== 1 ? "s" : ""}
											</span>
										</div>
									)}
									{property.availability.maxNights && (
										<div className="booking-info-item">
											<span>
												<strong>Maximum Nights:</strong>{" "}
												{property.availability.maxNights} night
												{property.availability.maxNights !== 1 ? "s" : ""}
											</span>
										</div>
									)}
								</div>
							</div>
						</section>
					)}

					{/* Calendar Availability */}
					<section className="availability-section">
						<h2>
							<FaCalendarAlt /> Availability
						</h2>
						<div className="calendar-placeholder">
							<p className="calendar-info">
								Check available dates for this property
							</p>
							<div className="calendar-grid">
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
														dayData.isBlocked
															? "blocked"
															: dayData.isBooked
															? "booked"
															: dayData.isPast
															? "past"
															: "available"
													}`}
													onClick={() => {
														if (isHost && !dayData.isPast) {
															handleToggleBlockDate(dayData.dateString)
														}
													}}
													title={
														dayData.isBlocked
															? "Blocked by host"
															: dayData.isBooked
															? "Already booked"
															: dayData.isPast
															? "Past date (not bookable)"
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
							</div>
							<div className="calendar-legend">
								<div className="legend-item">
									<span className="legend-color available"></span>
									Available
								</div>
								<div className="legend-item">
									<span className="legend-color past"></span>
									Past Date ( Not Bookable)
								</div>
								<div className="legend-item">
									<span className="legend-color booked"></span>
									Booked
								</div>
								<div className="legend-item">
									<span className="legend-color blocked"></span>
									Blocked
								</div>
							</div>
						</div>
					</section>

					{/* Reviews */}
					<section className="reviews-section">
						<div className="reviews-header">
							<h2>
								<FaStar /> Reviews
							</h2>
							{currentUser &&
								userCompletedBookings.length > 0 &&
								!reviews.some(
									(review) => review.userId === currentUser.uid
								) && (
									<button
										className="write-review-btn"
										onClick={() => setShowReviewModal(true)}
									>
										✍️ Write a Review
									</button>
								)}
						</div>
						{property.rating && reviews.length > 0 && (
							<div className="reviews-summary">
								<div className="rating-big">
									<FaStar /> {property.rating}
								</div>
								<div className="review-count">
									{reviews.length} {reviews.length === 1 ? "review" : "reviews"}
								</div>
							</div>
						)}
						<div className="reviews-list">
							{reviews.length > 0 ? (
								reviews.slice(0, 10).map((review) => (
									<div key={review.id} className="review-item">
										<div className="review-header">
											<div className="reviewer-info">
												<div className="reviewer-avatar">
													{review.userName?.[0]?.toUpperCase() || "U"}
												</div>
												<div>
													<h4>{review.userName || "User"}</h4>
													<span className="review-date">
														{review.createdAt?.toDate
															? review.createdAt
																	.toDate()
																	.toLocaleDateString("en-US", {
																		year: "numeric",
																		month: "long",
																		day: "numeric",
																	})
															: "Recently"}
													</span>
												</div>
											</div>
											<div className="review-rating">
												<FaStar /> {review.rating}
											</div>
										</div>
										<p className="review-text">{review.comment}</p>
										{review.ratings && (
											<div className="review-detailed-ratings">
												<div className="rating-item">
													<span>Cleanliness</span>
													<span>
														<FaStar /> {review.ratings.cleanliness}
													</span>
												</div>
												<div className="rating-item">
													<span>Accuracy</span>
													<span>
														<FaStar /> {review.ratings.accuracy}
													</span>
												</div>
												<div className="rating-item">
													<span>Communication</span>
													<span>
														<FaStar /> {review.ratings.communication}
													</span>
												</div>
												<div className="rating-item">
													<span>Location</span>
													<span>
														<FaStar /> {review.ratings.location}
													</span>
												</div>
												<div className="rating-item">
													<span>Check-in</span>
													<span>
														<FaStar /> {review.ratings.checkIn}
													</span>
												</div>
												<div className="rating-item">
													<span>Value</span>
													<span>
														<FaStar /> {review.ratings.value}
													</span>
												</div>
											</div>
										)}
									</div>
								))
							) : (
								<p className="no-reviews">
									No reviews yet. Be the first to review this property!
								</p>
							)}
						</div>
					</section>

					{/* Wishlists Section - Only visible to host and guests who created them */}
					{propertyWishlists.length > 0 && (
						<section className="wishlists-section">
							<h2>
								<FaBookmark /> Guest Wishlists
							</h2>
							<div className="wishlists-list">
								{propertyWishlists.map((wishlist, index) => (
									<div key={index} className="wishlist-item-card">
										<div className="wishlist-item-header">
											<div className="wishlist-guest-info">
												<FaUser className="guest-icon" />
												<span className="wishlist-guest-name">{wishlist.guestName}</span>
											</div>
											<button
												className="view-wishlist-btn"
												onClick={() => {
													setSelectedWishlist(wishlist)
													setShowWishlistModal(true)
												}}
											>
												<FaEye /> View Wishlist
											</button>
										</div>
									</div>
								))}
							</div>
						</section>
					)}

					{/* Location */}
					<section className="location-section">
						<h2>
							<FaMapMarkerAlt /> Location
						</h2>
						<div className="location-details">
							<p>
								{typeof property.location === "object"
									? `${property.location.address}, ${property.location.city}, ${property.location.province}`
									: property.location}
							</p>
						</div>
						<div ref={mapContainer} className="map-container" />
					</section>
				</div>

				{/* Right Column - Booking Card or Host Sections */}
				<div className="content-right">
					{isHost ? (
						/* Host View - Promos and Booking History */
						<div className="host-management-card">
							<div className="price-section">
								<div className="price">
									{property.pricing?.basePrice ? formatCurrencyFull(property.pricing.basePrice) : "N/A"}
									<span className="per-night">/ night</span>
								</div>
								{property.rating && property.reviewsCount > 0 && (
									<div className="rating-small">
										<FaStar style={{ color: "#FFD700", marginRight: "0.25rem" }} /> 
										{property.rating.toFixed(1)} ({property.reviewsCount}{" "}
										{property.reviewsCount === 1 ? "review" : "reviews"})
									</div>
								)}
							</div>

							{/* Property Promos Section */}
							<div className="host-section">
								<h3>
									<FaGift /> Property Promos & Vouchers
								</h3>
								{propertyPromos.length > 0 ? (
									<div className="promos-list">
										{propertyPromos.map((promo) => (
											<div
												key={promo.id}
												className={`promo-item ${
													!promo.isActive ? "inactive" : ""
												}`}
											>
												<div className="promo-header">
													<FaTag className="promo-icon" />
													<span className="promo-code">{promo.code}</span>
													<span
														className={`promo-status ${
															promo.isActive ? "active" : "inactive"
														}`}
													>
														{promo.isActive ? "Active" : "Inactive"}
													</span>
												</div>
												<div className="promo-details">
													{promo.discountType === "percent" ||
													promo.discountType === "percentage" ? (
														<span className="promo-discount">
															{promo.discount || promo.discountValue}% OFF
														</span>
													) : (
														<span className="promo-discount">
															₱{promo.discount || promo.discountValue} OFF
														</span>
													)}
													{promo.validFrom && promo.validUntil && (
														<span className="promo-dates">
															{new Date(promo.validFrom).toLocaleDateString()} -{" "}
															{new Date(promo.validUntil).toLocaleDateString()}
														</span>
													)}
												</div>
												<div className="promo-usage">
													{promo.source === "property_vouchers" ? (
														<span
															style={{ fontStyle: "italic", color: "#666" }}
														>
															Property Voucher
														</span>
													) : (
														<span>
															Used: {promo.usageCount || 0}{" "}
															{promo.usageLimit ? `/ ${promo.usageLimit}` : ""}{" "}
															times
														</span>
													)}
												</div>
											</div>
										))}
									</div>
								) : (
									<p className="no-data">
										No promos created for this property yet.
									</p>
								)}
								<button
									className="manage-promos-btn"
									onClick={() => setShowManagePromosModal(true)}
								>
									<FaGift /> Manage Promos
								</button>
								<button
									className="view-all-bookings-btn"
									onClick={() => navigate(`/propertyBookings/${property?.id}`)}
									style={{ marginTop: "0.75rem" }}
								>
									<FaHistory /> View All Bookings
								</button>
							</div>

							{/* Upcoming Bookings Section removed */}

							{/* Booking History Section removed */}
						</div>
					) : (
						/* Guest View - Booking Card */
						<div className="booking-card">
							<div className="price-section">
								<div className="price">
									{(() => {
										const prices = calculatePrices()
										const hasAutoDiscount = autoAppliedVoucher && !appliedPromo
										
										if (hasAutoDiscount && prices.discountedPrice < prices.originalPrice) {
											return (
												<>
													<span className="original-price">
														₱{prices.originalPrice.toLocaleString()}
													</span>
													<span className="discounted-price">
														₱{Math.max(0, prices.discountedPrice).toLocaleString()}
													</span>
													<span className="per-night">/ night</span>
													{autoAppliedVoucher && (
														<span className="voucher-badge">
															{autoAppliedVoucher.type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())} Promo
														</span>
													)}
												</>
											)
										} else {
											return (
												<>
													{property.pricing?.basePrice ? formatCurrencyFull(property.pricing.basePrice) : "N/A"}
													<span className="per-night">/ night</span>
												</>
											)
										}
									})()}
								</div>
								{property.rating && property.reviewsCount > 0 && (
									<div className="rating-small" style={{
										display: "flex",
										alignItems: "center",
										gap: "0.25rem",
										fontSize: "0.9rem",
										color: "#333"
									}}>
										<FaStar style={{ color: "#FFD700", fontSize: "0.9rem" }} /> 
										<span>{property.rating.toFixed(1)}</span>
										<span style={{ color: "#666" }}>({property.reviewsCount})</span>
									</div>
								)}
							</div>

							{/* Host Info */}
							<div className="host-info-card">
								<h3>Hosted by {hostInfo.hostName || "Host"}</h3>
								<div className="host-details">
									<div className="host-avatar">
										{(hostInfo.hostName || "H")[0].toUpperCase()}
									</div>
									<div className="host-stats">
										{hostInfo.superhost && (
											<div className="host-badge">
												<FaMedal /> Superhost
											</div>
										)}
										{hostInfo.verified && (
											<div className="host-badge">
												<FaShieldAlt /> Verified
											</div>
										)}
										{hostInfo.hostSince && (
											<div className="host-stat">
												<FaClock /> Hosting since{" "}
												{new Date(hostInfo.hostSince).getFullYear()}
											</div>
										)}
									</div>
								</div>
								<button 
									className="contact-host-btn"
									onClick={() => {
										if (!currentUser) {
											toast.error("Please login to contact the host")
											navigate("/login")
											return
										}
										setShowContactHostModal(true)
									}}
								>
									Contact Host
								</button>
							</div>

							<div className="booking-form">
								<div className="date-selector-container">
									<label>Select Dates</label>
									<button
										className="date-selector-btn"
										onClick={openDatePicker}
										type="button"
									>
										<FaCalendarAlt className="calendar-icon" />
										<div className="date-display">
											{checkInDate && checkOutDate ? (
												<>
													<span className="date-label">Check-in:</span>
													<span className="date-value">
														{new Date(checkInDate).toLocaleDateString("en-US", {
															month: "short",
															day: "numeric",
															year: "numeric",
														})}
													</span>
													<span className="date-separator">→</span>
													<span className="date-label">Check-out:</span>
													<span className="date-value">
														{new Date(checkOutDate).toLocaleDateString(
															"en-US",
															{
																month: "short",
																day: "numeric",
																year: "numeric",
															}
														)}
													</span>
												</>
											) : (
												<span className="placeholder">
													Click to select dates
												</span>
											)}
										</div>
									</button>
									{checkInDate && checkOutDate && (
										<span className="nights-display">
											{calculateNights()}{" "}
											{calculateNights() === 1 ? "night" : "nights"}
										</span>
									)}
								</div>
								<div className="guests-input">
									<label>Guests</label>
									<select
										value={numberOfGuests}
										onChange={(e) => setNumberOfGuests(Number(e.target.value))}
									>
										{Array.from(
											{
												length:
													property.capacity?.guests ||
													property.capacity?.maxGuests ||
													8,
											},
											(_, i) => i + 1
										).map((num) => (
											<option key={num} value={num}>
												{num} {num === 1 ? "guest" : "guests"}
											</option>
										))}
									</select>
									{(property.capacity?.guests ||
										property.capacity?.maxGuests) && (
										<span className="max-guests-note">
											Maximum{" "}
											{property.capacity?.guests ||
												property.capacity?.maxGuests}{" "}
											guests allowed
										</span>
									)}
								</div>
								{checkInDate && checkOutDate ? (
									<>
										<div className="downpayment-info">
											<p>
												<strong>Full Payment Required:</strong>
											</p>
											<p className="downpayment-amount">
												₱{calculatePrices().total.toLocaleString()}
											</p>
											<p className="downpayment-note">
												Complete payment to secure your booking
											</p>
										</div>

										{/* Promo Code Section */}
										{!appliedPromo ? (
											<div className="promo-code-section">
												<label className="promo-label-main">
													Have a promo code?
												</label>
												<div className="promo-input-group">
													<input
														type="text"
														placeholder="Enter promo code"
														value={promoCode}
														onChange={(e) =>
															setPromoCode(e.target.value.toUpperCase())
														}
														className="promo-input"
														maxLength={20}
													/>
													<button
														onClick={validateAndApplyPromo}
														className="apply-promo-btn"
														disabled={isValidatingPromo || !promoCode.trim()}
													>
														{isValidatingPromo ? "Validating..." : "Apply"}
													</button>
												</div>
											</div>
										) : (
											<div className="applied-promo-section">
												<div className="applied-promo-info">
													<span className="promo-label">
														🎁 Promo: {appliedPromo.code}
													</span>
													<span className="discount-amount">
														-₱{calculatePrices().promoDiscount.toLocaleString()}
													</span>
												</div>
												<button
													onClick={removePromo}
													className="remove-promo-btn"
												>
													Remove Promo
												</button>
											</div>
										)}

										{/* Payment Method Selection */}
										<div className="payment-method-selection">
											<label className="payment-label">
												Choose Payment Method:
											</label>
											<div className="payment-methods">
												<button
													className={`payment-method-btn ${
														paymentMethod === "paypal" ? "active" : ""
													}`}
													onClick={() => setPaymentMethod("paypal")}
												>
													<span className="method-icon">💳</span>
													<span>PayPal</span>
												</button>
												<button
													className={`payment-method-btn ${
														paymentMethod === "wallet" ? "active" : ""
													}`}
													onClick={() => setPaymentMethod("wallet")}
												>
													<span className="method-icon">💰</span>
													<span>E-Wallet</span>
													<span className="wallet-balance-hint">
														₱{walletBalance.toLocaleString()}
													</span>
												</button>
											</div>
										</div>

										{/* PayPal Payment */}
										{paymentMethod === "paypal" ? (
											<>
												<button
													className="book-now-btn paypal-btn"
													onClick={handlePayPalPayment}
													disabled={isProcessingPayment || !isPayPalLoaded}
												>
													{!isPayPalLoaded
														? "Loading PayPal..."
														: isProcessingPayment
														? "Processing..."
														: "Pay with PayPal"}
												</button>
												<div
													ref={paypalRef}
													className="paypal-button-container"
												></div>
											</>
										) : (
											/* Wallet Payment */
											<button
												className="book-now-btn wallet-btn"
												onClick={handleWalletPayment}
												disabled={
													isProcessingPayment ||
													walletBalance < calculatePrices().total
												}
											>
												{isProcessingPayment
													? "Processing..."
													: walletBalance < calculatePrices().total
													? `Insufficient Balance (₱${(
															calculatePrices().total - walletBalance
													  ).toLocaleString()} short)`
													: "Pay with E-Wallet"}
											</button>
										)}

										<p className="nights-info">
											{calculateNights()}{" "}
											{calculateNights() === 1 ? "night" : "nights"}
										</p>
									</>
								) : (
									<>
										<button className="book-now-btn" disabled>
											Select Dates to Book
										</button>
										<p className="book-notice">
											Choose check-in and check-out dates
										</p>
									</>
								)}
							</div>

							<div className="price-breakdown">
								{(() => {
									const prices = calculatePrices()
									return (
										<>
											{prices.nights > 0 && (
												<div className="breakdown-item">
													<span>
														{formatCurrencyFull(prices.basePrice)} x{" "}
														{prices.nights}{" "}
														{prices.nights === 1 ? "night" : "nights"}
													</span>
													<span>{formatCurrencyFull(prices.subtotal)}</span>
												</div>
											)}
											<div className="breakdown-item">
												<span>Cleaning fee</span>
												<span>₱{prices.cleaningFee.toLocaleString()}</span>
											</div>
											<div className="breakdown-item">
												<span>Service fee</span>
												<span>₱{prices.serviceFee.toLocaleString()}</span>
											</div>
											<div className="breakdown-item">
												<span>
													Guest fee ({prices.numberOfGuests}{" "}
													{prices.numberOfGuests === 1 ? "guest" : "guests"})
												</span>
												<span>₱{prices.guestFee.toLocaleString()}</span>
											</div>

											{/* Show discount in breakdown if promo or auto-voucher is applied */}
											{(appliedPromo || autoAppliedVoucher) && prices.promoDiscount > 0 && (
												<div className="breakdown-item promo-discount">
													<span className="promo-label">
														🎁 {appliedPromo ? "Promo" : autoAppliedVoucher?.type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())} Discount
													</span>
													<span className="discount-amount">
														-₱{prices.promoDiscount.toLocaleString()}
													</span>
												</div>
											)}

											<div className="breakdown-total">
												<span>Total</span>
												<span>
													₱
													{prices.nights > 0
														? prices.total.toLocaleString()
														: (
																prices.cleaningFee +
																prices.serviceFee +
																prices.guestFee
														  ).toLocaleString()}
												</span>
											</div>
										</>
									)
								})()}
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Report Modal */}
			{showReportModal && (
				<div
					className="share-modal-overlay"
					onClick={() => setShowReportModal(false)}
				>
					<div
						className="share-modal-content"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="share-modal-header">
							<h3>Report Property</h3>
							<button
								className="close-share-modal"
								onClick={() => setShowReportModal(false)}
							>
								<FaTimes />
							</button>
						</div>
						<div className="report-form">
							<p className="report-description">
								Help us keep AuraStays safe by reporting any issues with this property.
							</p>
							<div className="form-group">
								<label>Reason for Reporting</label>
								<select
									value={reportReason}
									onChange={(e) => setReportReason(e.target.value)}
									className="report-select"
								>
									<option value="">Select a reason</option>
									<option value="inaccurate">Inaccurate Information</option>
									<option value="misleading">Misleading Photos</option>
									<option value="safety">Safety Concerns</option>
									<option value="fraud">Suspected Fraud</option>
									<option value="inappropriate">Inappropriate Content</option>
									<option value="spam">Spam or Scam</option>
									<option value="other">Other</option>
								</select>
							</div>
							<div className="form-group">
								<label>Additional Details</label>
								<textarea
									value={reportDescription}
									onChange={(e) => setReportDescription(e.target.value)}
									placeholder="Please provide more details about the issue..."
									className="report-textarea"
									rows="5"
								/>
							</div>
							<div className="report-actions">
								<button
									className="cancel-btn"
									onClick={() => {
										setShowReportModal(false)
										setReportReason("")
										setReportDescription("")
									}}
									disabled={isSubmittingReport}
								>
									Cancel
								</button>
								<button
									className="submit-report-btn"
									onClick={handleSubmitReport}
									disabled={!reportReason || isSubmittingReport}
								>
									{isSubmittingReport ? "Submitting..." : "Submit Report"}
								</button>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Share Modal */}
			{showShareModal && (
				<div
					className="share-modal-overlay"
					onClick={() => setShowShareModal(false)}
				>
					<div
						className="share-modal-content"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="share-modal-header">
							<h3>Share this property</h3>
							<button
								className="close-share-modal"
								onClick={() => setShowShareModal(false)}
							>
								<FaTimes />
							</button>
						</div>
						<div className="share-link-section">
							<input type="text" value={shareableUrl} readOnly />
							<button onClick={copyToClipboard} className="copy-link-btn">
								<FaCopy /> Copy
							</button>
						</div>
						<div className="share-options">
							<button
								className="share-option facebook"
								onClick={() => handleShare("Facebook")}
							>
								<FaFacebook />
								<span>Facebook</span>
							</button>
							<button
								className="share-option twitter"
								onClick={() => handleShare("Twitter")}
							>
								<FaTwitter />
								<span>Twitter</span>
							</button>
							<button
								className="share-option instagram"
								onClick={() => handleShare("Instagram")}
							>
								<FaInstagram />
								<span>Instagram</span>
							</button>
							<button
								className="share-option linkedin"
								onClick={() => handleShare("LinkedIn")}
							>
								<FaLinkedin />
								<span>LinkedIn</span>
							</button>
							<button
								className="share-option whatsapp"
								onClick={() => handleShare("WhatsApp")}
							>
								<FaWhatsapp />
								<span>WhatsApp</span>
							</button>
						</div>
					</div>
				</div>
			)}

			{/* All Photos Modal */}
			{showAllPhotos && (
				<div
					className="all-photos-modal-overlay"
					onClick={() => setShowAllPhotos(false)}
				>
					<div
						className="all-photos-modal-content"
						onClick={(e) => e.stopPropagation()}
					>
						<button
							className="close-photos-modal"
							onClick={() => setShowAllPhotos(false)}
						>
							<FaTimes />
						</button>
						<h2>All Photos</h2>
						<div className="all-photos-grid">
							{images.map((img, index) => (
								<img 
									key={index} 
									src={img} 
									alt={`Property view ${index + 1}`}
									style={{ cursor: "pointer" }}
									onClick={() => {
										setFullSizeImageIndex(index)
										setShowAllPhotos(false)
										setShowFullSizeImage(true)
									}}
								/>
							))}
						</div>
					</div>
				</div>
			)}

			{/* Manage Promos Modal */}
			{showManagePromosModal && (
				<div
					className="manage-promos-modal-overlay"
					onClick={() => setShowManagePromosModal(false)}
				>
					<div
						className="manage-promos-modal-content"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="manage-promos-modal-header">
							<h2>
								<FaGift /> Manage Promos for {property.title}
							</h2>
							<button
								className="close-promos-modal"
								onClick={() => setShowManagePromosModal(false)}
							>
								<FaTimes />
							</button>
						</div>

						<div className="manage-promos-body">
							{/* Create New Promo Section */}
							<div className="create-promo-section" style={{ marginBottom: "2rem" }}>
								{!showCreatePromoForm ? (
									<button
										className="create-promo-btn"
										onClick={() => setShowCreatePromoForm(true)}
										style={{
											display: "flex",
											alignItems: "center",
											gap: "0.5rem",
											padding: "0.75rem 1.5rem",
											background: "var(--primary)",
											color: "white",
											border: "none",
											borderRadius: "8px",
											fontSize: "1rem",
											fontWeight: 600,
											cursor: "pointer",
											transition: "all 0.2s ease",
										}}
										onMouseEnter={(e) => {
											e.target.style.background = "#5fa887"
											e.target.style.transform = "translateY(-2px)"
										}}
										onMouseLeave={(e) => {
											e.target.style.background = "var(--primary)"
											e.target.style.transform = "translateY(0)"
										}}
									>
										<FaPlus /> Create New Promo
									</button>
								) : (
									<div className="create-promo-form" style={{
										padding: "1.5rem",
										background: "#f9f9f9",
										borderRadius: "12px",
										border: "2px solid var(--primary)",
									}}>
										<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
											<h3 style={{ margin: 0 }}>Create New Promo</h3>
											<button
												type="button"
												onClick={() => {
													setShowCreatePromoForm(false)
													setNewCoupon({
														code: "",
														description: "",
														discountType: "percentage",
														discountValue: 0,
														minPurchase: 0,
														maxDiscount: 0,
														usageLimit: 0,
														usagePerUser: 1,
														validFrom: "",
														validUntil: "",
														isActive: true,
													})
												}}
												style={{
													background: "transparent",
													border: "none",
													cursor: "pointer",
													fontSize: "1.25rem",
													color: "#666",
												}}
											>
												<FaTimes />
											</button>
										</div>
										
										<div className="form-group" style={{ marginBottom: "1rem" }}>
											<label>Coupon Code *</label>
											<input
												type="text"
												placeholder="e.g., SUMMER2024"
												value={newCoupon.code}
												onChange={(e) =>
													setNewCoupon({
														...newCoupon,
														code: e.target.value.toUpperCase(),
													})
												}
												maxLength={20}
												style={{ textTransform: "uppercase" }}
											/>
										</div>
										
										<div className="form-group" style={{ marginBottom: "1rem" }}>
											<label>Description *</label>
											<textarea
												placeholder="Describe what this coupon offers..."
												value={newCoupon.description}
												onChange={(e) =>
													setNewCoupon({
														...newCoupon,
														description: e.target.value,
													})
												}
												rows={3}
											/>
										</div>
										
										<div className="form-group" style={{ marginBottom: "1rem" }}>
											<label>Discount Type</label>
											<div className="radio-group" style={{ display: "flex", gap: "1rem" }}>
												<label className="radio-label" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
													<input
														type="radio"
														name="newDiscountType"
														value="percentage"
														checked={newCoupon.discountType === "percentage"}
														onChange={(e) =>
															setNewCoupon({
																...newCoupon,
																discountType: e.target.value,
															})
														}
													/>
													Percentage (%)
												</label>
												<label className="radio-label" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
													<input
														type="radio"
														name="newDiscountType"
														value="fixed"
														checked={newCoupon.discountType === "fixed"}
														onChange={(e) =>
															setNewCoupon({
																...newCoupon,
																discountType: e.target.value,
															})
														}
													/>
													Fixed Amount (₱)
												</label>
											</div>
										</div>
										
										<div className="form-group" style={{ marginBottom: "1rem" }}>
											<label>
												Discount Value {newCoupon.discountType === "percentage" ? "(%)" : "(₱)"} *
											</label>
											<NumberStepper
												value={newCoupon.discountValue}
												onChange={(e) =>
													setNewCoupon({
														...newCoupon,
														discountValue: e.target.value,
													})
												}
												min={0}
												max={newCoupon.discountType === "percentage" ? 100 : undefined}
												step={newCoupon.discountType === "percentage" ? 1 : 10}
												placeholder={newCoupon.discountType === "percentage" ? "e.g., 20" : "e.g., 500"}
											/>
										</div>
										
										<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
											<div className="form-group">
												<label>Minimum Purchase (₱)</label>
												<NumberStepper
													value={newCoupon.minPurchase}
													onChange={(e) =>
														setNewCoupon({
															...newCoupon,
															minPurchase: e.target.value,
														})
													}
													min={0}
													step={100}
													placeholder="0"
												/>
												<small style={{ display: "block", marginTop: "0.25rem", fontSize: "0.75rem", color: "#666" }}>
													Minimum booking amount required
												</small>
											</div>
											<div className="form-group">
												<label>Maximum Discount (₱)</label>
												<NumberStepper
													value={newCoupon.maxDiscount}
													onChange={(e) =>
														setNewCoupon({
															...newCoupon,
															maxDiscount: e.target.value,
														})
													}
													min={0}
													step={100}
													placeholder="0"
												/>
												<small style={{ display: "block", marginTop: "0.25rem", fontSize: "0.75rem", color: "#666" }}>
													Max discount cap (0 = no limit)
												</small>
											</div>
										</div>
										
										<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
											<div className="form-group">
												<label>Usage Limit</label>
												<NumberStepper
													value={newCoupon.usageLimit}
													onChange={(e) =>
														setNewCoupon({
															...newCoupon,
															usageLimit: e.target.value,
														})
													}
													min={0}
													placeholder="0"
												/>
												<small style={{ display: "block", marginTop: "0.25rem", fontSize: "0.75rem", color: "#666" }}>
													Total times this coupon can be used
												</small>
												<small style={{ display: "block", marginTop: "0.25rem", fontSize: "0.75rem", color: "#999", fontStyle: "italic" }}>
													(0 for unlimited)
												</small>
											</div>
											<div className="form-group">
												<label>Usage Per User</label>
												<NumberStepper
													value={newCoupon.usagePerUser}
													onChange={(e) =>
														setNewCoupon({
															...newCoupon,
															usagePerUser: e.target.value || 1,
														})
													}
													min={1}
													placeholder="1"
												/>
												<small style={{ display: "block", marginTop: "0.25rem", fontSize: "0.75rem", color: "#666" }}>
													How many times each user can use it
												</small>
												<small style={{ display: "block", marginTop: "0.25rem", fontSize: "0.75rem", color: "#999", fontStyle: "italic" }}>
													(0 for unlimited)
												</small>
											</div>
										</div>
										
										<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
											<div className="form-group">
												<label>Valid From</label>
												<button
													type="button"
													onClick={() => openCouponDatePicker(true)}
													style={{
														width: "100%",
														padding: "0.75rem",
														border: "1px solid #b0b0b0",
														borderRadius: "6px",
														fontSize: "0.9rem",
														background: "white",
														cursor: "pointer",
														display: "flex",
														alignItems: "center",
														justifyContent: "center",
														gap: "0.5rem",
														transition: "all 0.2s ease",
													}}
													onMouseEnter={(e) => {
														e.target.style.borderColor = "var(--primary)"
														e.target.style.background = "rgba(97, 191, 156, 0.05)"
													}}
													onMouseLeave={(e) => {
														e.target.style.borderColor = "#b0b0b0"
														e.target.style.background = "white"
													}}
												>
													<FaCalendarAlt />
													<span>
														{newCoupon.validFrom
															? new Date(newCoupon.validFrom).toLocaleDateString("en-US", {
																	month: "short",
																	day: "numeric",
																	year: "numeric",
															  })
															: "Select date"}
													</span>
												</button>
											</div>
											<div className="form-group">
												<label>Valid Until</label>
												<button
													type="button"
													onClick={() => openCouponDatePicker(false)}
													style={{
														width: "100%",
														padding: "0.75rem",
														border: "1px solid #b0b0b0",
														borderRadius: "6px",
														fontSize: "0.9rem",
														background: "white",
														cursor: "pointer",
														display: "flex",
														alignItems: "center",
														justifyContent: "center",
														gap: "0.5rem",
														transition: "all 0.2s ease",
													}}
													onMouseEnter={(e) => {
														e.target.style.borderColor = "var(--primary)"
														e.target.style.background = "rgba(97, 191, 156, 0.05)"
													}}
													onMouseLeave={(e) => {
														e.target.style.borderColor = "#b0b0b0"
														e.target.style.background = "white"
													}}
												>
													<FaCalendarAlt />
													<span>
														{newCoupon.validUntil
															? new Date(newCoupon.validUntil).toLocaleDateString("en-US", {
																	month: "short",
																	day: "numeric",
																	year: "numeric",
															  })
															: "Select date"}
													</span>
												</button>
											</div>
										</div>
										
										<div className="form-group" style={{ marginBottom: "1rem" }}>
											<label style={{ 
												display: "flex", 
												alignItems: "center", 
												gap: "0.5rem",
												cursor: "pointer",
												userSelect: "none"
											}}>
												<input
													type="checkbox"
													checked={newCoupon.isActive}
													onChange={(e) =>
														setNewCoupon({
															...newCoupon,
															isActive: e.target.checked,
														})
													}
													style={{
														width: "18px",
														height: "18px",
														cursor: "pointer",
														margin: 0,
														flexShrink: 0,
													}}
												/>
												<span style={{ lineHeight: "1.5" }}>Active (Coupon will be available for use)</span>
											</label>
										</div>
										
										<div style={{ display: "flex", gap: "1rem" }}>
											<button
												type="button"
												onClick={handleCreatePromo}
												disabled={isCreatingPromo || !newCoupon.code.trim() || !newCoupon.description.trim() || !newCoupon.discountValue}
												style={{
													padding: "0.75rem 2rem",
													background: isCreatingPromo || !newCoupon.code.trim() || !newCoupon.description.trim() || !newCoupon.discountValue ? "#ccc" : "var(--primary)",
													color: "white",
													border: "none",
													borderRadius: "8px",
													fontSize: "1rem",
													fontWeight: 600,
													cursor: isCreatingPromo || !newCoupon.code.trim() || !newCoupon.description.trim() || !newCoupon.discountValue ? "not-allowed" : "pointer",
												}}
											>
												{isCreatingPromo ? "Creating..." : "Create Promo"}
											</button>
											<button
												type="button"
												onClick={() => {
													setShowCreatePromoForm(false)
													setNewCoupon({
														code: "",
														description: "",
														discountType: "percentage",
														discountValue: 0,
														minPurchase: 0,
														maxDiscount: 0,
														usageLimit: 0,
														usagePerUser: 1,
														validFrom: "",
														validUntil: "",
														isActive: true,
													})
												}}
												style={{
													padding: "0.75rem 2rem",
													background: "transparent",
													color: "#666",
													border: "1px solid #ccc",
													borderRadius: "8px",
													fontSize: "1rem",
													cursor: "pointer",
												}}
											>
												Cancel
											</button>
										</div>
									</div>
								)}
							</div>
							
							{/* Existing Promos List */}
							<div className="existing-promos-section">
								<h3>Existing Promos ({propertyPromos.length})</h3>
								{propertyPromos.length > 0 ? (
									<div className="promos-management-list">
										{propertyPromos.map((promo) => (
											<div key={promo.id} className="promo-management-item">
												{editingPromo?.id === promo.id &&
												promo.source === "property_vouchers" ? (
													/* Edit Mode */
													<div className="edit-voucher-form">
														<div className="edit-voucher-header">
															<h4>Edit {promo.description}</h4>
															<button
																className="cancel-edit-btn"
																onClick={handleCancelEdit}
															>
																<FaTimes />
															</button>
														</div>
														<div className="voucher-edit-form">
															<div className="form-row">
																<div className="form-group">
																	<label>Discount Type</label>
																	<select
																		value={editPromoDiscountType}
																		onChange={(e) =>
																			setEditPromoDiscountType(e.target.value)
																		}
																	>
																		<option value="percentage">
																			Percentage (%)
																		</option>
																		<option value="fixed">
																			Fixed Amount (₱)
																		</option>
																	</select>
																</div>
																<div className="form-group">
																	<label>Discount Value *</label>
																	<input
																		type="number"
																		placeholder={
																			editPromoDiscountType === "percentage"
																				? "20"
																				: "500"
																		}
																		value={editPromoDiscount}
																		onChange={(e) =>
																			setEditPromoDiscount(e.target.value)
																		}
																		min="0"
																		max={
																			editPromoDiscountType === "percentage"
																				? "100"
																				: undefined
																		}
																	/>
																</div>
															</div>
															{(() => {
																// Get voucher type - either from promo.voucherType or extract from id
																const voucherType =
																	promo.voucherType ||
																	promo.id.split("_").slice(2).join("_")
																const isFixed = isFixedDateVoucher(voucherType)

																// For long_stay, show minimum days field
																if (voucherType === "long_stay") {
																	return (
																		<div className="form-row">
																			<div className="form-group">
																				<label>
																					Minimum Days to Make a Discount *
																				</label>
																				<input
																					type="number"
																					placeholder="e.g., 7"
																					value={editPromoMinDays}
																					onChange={(e) =>
																						setEditPromoMinDays(e.target.value)
																					}
																					min="1"
																					required
																				/>
																				<small>
																					Minimum number of days required to
																					apply this discount
																				</small>
																			</div>
																		</div>
																	)
																}

																// For other non-fixed vouchers, show date fields
																if (!isFixed) {
																	return (
																		<div className="form-row">
																			<div className="form-group">
																				<label>Valid From (Optional)</label>
																				<input
																					type="date"
																					value={editPromoValidFrom}
																					onChange={(e) =>
																						setEditPromoValidFrom(
																							e.target.value
																						)
																					}
																					min={
																						new Date()
																							.toISOString()
																							.split("T")[0]
																					}
																				/>
																			</div>
																			<div className="form-group">
																				<label>Valid Until (Optional)</label>
																				<input
																					type="date"
																					value={editPromoValidUntil}
																					onChange={(e) =>
																						setEditPromoValidUntil(
																							e.target.value
																						)
																					}
																					min={
																						editPromoValidFrom ||
																						new Date()
																							.toISOString()
																							.split("T")[0]
																					}
																				/>
																			</div>
																		</div>
																	)
																}

																return null
															})()}
															<div className="form-row">
																<div className="form-group">
																	<label>Status</label>
																	<div className="toggle-switch-container">
																		<label className="toggle-switch-label">
																			<input
																				type="checkbox"
																				checked={editPromoIsActive}
																				onChange={(e) =>
																					setEditPromoIsActive(e.target.checked)
																				}
																				className="toggle-switch-input"
																			/>
																			<span className="toggle-switch-slider"></span>
																			<span className="toggle-switch-text">
																				{editPromoIsActive
																					? "Active"
																					: "Inactive"}
																			</span>
																		</label>
																	</div>
																</div>
															</div>
															<div className="edit-form-actions">
																<button
																	className="cancel-edit-form-btn"
																	onClick={handleCancelEdit}
																>
																	Cancel
																</button>
																<button
																	className="save-edit-btn"
																	onClick={handleUpdateVoucher}
																	disabled={
																		isUpdatingPromo ||
																		!editPromoDiscount ||
																		// Only require minimum days for long_stay if voucher is active
																		(editPromoIsActive &&
																			(promo.voucherType === "long_stay" ||
																				(promo.id &&
																					promo.id.includes("long_stay"))) &&
																			!editPromoMinDays)
																	}
																>
																	{isUpdatingPromo
																		? "Saving..."
																		: "Save Changes"}
																</button>
															</div>
														</div>
													</div>
												) : (
													/* View Mode */
													<>
														<div className="promo-mgmt-header">
															<div
																className="promo-mgmt-info"
																style={{
																	cursor:
																		promo.source === "property_vouchers"
																			? "pointer"
																			: "default",
																}}
																onClick={() =>
																	promo.source === "property_vouchers" &&
																	handleStartEditVoucher(promo)
																}
															>
																<FaTag className="promo-mgmt-icon" />
																<div>
																	<span className="promo-mgmt-code">
																		{promo.code}
																	</span>
																	<span className="promo-mgmt-desc">
																		{promo.description}
																	</span>
																</div>
															</div>
															<div className="promo-mgmt-actions">
																{promo.source !== "property_vouchers" && (
																	<>
																		<button
																			className={`toggle-promo-btn ${
																				promo.isActive ? "active" : "inactive"
																			}`}
																			onClick={() =>
																				handleTogglePromoStatus(
																					promo.id,
																					promo.isActive
																				)
																			}
																		>
																			{promo.isActive
																				? "Deactivate"
																				: "Activate"}
																		</button>
																		<button
																			className="delete-promo-btn"
																			onClick={() =>
																				handleDeletePromo(promo.id)
																			}
																		>
																			<FaTimes /> Delete
																		</button>
																	</>
																)}
																{promo.source === "property_vouchers" && (
																	<span className="voucher-badge">
																		Property Voucher - Click to Edit
																	</span>
																)}
															</div>
														</div>
														<div className="promo-mgmt-details">
															<div className="promo-mgmt-detail-item">
																<span className="detail-label">Discount:</span>
																<span className="detail-value">
																	{promo.discountType === "percent" ||
																	promo.discountType === "percentage"
																		? `${
																				promo.discount || promo.discountValue
																		  }%`
																		: `₱${
																				promo.discount || promo.discountValue
																		  }`}
																</span>
															</div>
															{promo.validFrom && promo.validUntil && (
																<div className="promo-mgmt-detail-item">
																	<span className="detail-label">Valid:</span>
																	<span className="detail-value">
																		{new Date(
																			promo.validFrom
																		).toLocaleDateString()}{" "}
																		-{" "}
																		{new Date(
																			promo.validUntil
																		).toLocaleDateString()}
																	</span>
																</div>
															)}
															{promo.source !== "property_vouchers" && (
																<div className="promo-mgmt-detail-item">
																	<span className="detail-label">Status:</span>
																	<span
																		className={`detail-value status-${
																			promo.isActive ? "active" : "inactive"
																		}`}
																	>
																		{promo.isActive ? "Active" : "Inactive"}
																	</span>
																</div>
															)}
															{promo.source !== "property_vouchers" && (
																<div className="promo-mgmt-detail-item">
																	<span className="detail-label">Used:</span>
																	<span className="detail-value">
																		{promo.usageCount || 0} times
																	</span>
																</div>
															)}
														</div>
													</>
												)}
											</div>
										))}
									</div>
								) : (
									<p className="no-promos-message">
										No promos created yet. Create one above!
									</p>
								)}
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Coupon Date Picker Modal */}
			{showCouponDateModal && (
				<div
					className="date-picker-modal-overlay"
					onClick={() => setShowCouponDateModal(false)}
				>
					<div
						className="date-picker-modal-content"
						onClick={(e) => e.stopPropagation()}
					>
						<button
							className="close-date-modal"
							onClick={() => setShowCouponDateModal(false)}
						>
							<FaTimes />
						</button>
						<h2>
							<FaCalendarAlt /> Select Coupon Validity Dates
						</h2>
						<div className="modal-date-info">
							<div className="selected-dates-display">
								{newCoupon.validFrom && (
									<div className="selected-date-item check-in">
										<span className="date-type">Valid From:</span>
										<span className="date-text">
											{new Date(newCoupon.validFrom).toLocaleDateString("en-US", {
												weekday: "short",
												month: "short",
												day: "numeric",
												year: "numeric",
											})}
										</span>
									</div>
								)}
								{newCoupon.validUntil && (
									<div className="selected-date-item check-out">
										<span className="date-type">Valid Until:</span>
										<span className="date-text">
											{new Date(newCoupon.validUntil).toLocaleDateString("en-US", {
												weekday: "short",
												month: "short",
												day: "numeric",
												year: "numeric",
											})}
										</span>
									</div>
								)}
								{!newCoupon.validFrom && !newCoupon.validUntil && (
									<p className="instruction-text">
										{selectingValidFrom
											? "Click on a date to select Valid From"
											: "Click on a date to select Valid Until"}
									</p>
								)}
							</div>
						</div>

						<div className="modal-calendar">
							<div className="month-view">
								<div className="month-header">
									<button onClick={previousCouponMonth} className="month-nav-btn">
										◀
									</button>
									<h3>
										{couponCurrentMonth.toLocaleString("default", {
											month: "long",
											year: "numeric",
										})}
									</h3>
									<button onClick={nextCouponMonth} className="month-nav-btn">
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
									{generateCouponCalendarDays().map((dayData, index) =>
										dayData ? (
											<div
												key={index}
												className={`calendar-day ${
													dayData.isPast ? "past" : "available"
												} ${
													dayData.dateString === newCoupon.validFrom
														? "selected-check-in"
														: ""
												} ${
													dayData.dateString === newCoupon.validUntil
														? "selected-check-out"
														: ""
												}`}
												onClick={() => {
													if (!dayData.isPast) {
														handleCouponCalendarDayClick(dayData.dateString)
													}
												}}
												title={dayData.isPast ? "Past date" : "Available"}
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
									<span className="legend-color available"></span>
									Available
								</div>
								<div className="legend-item">
									<span className="legend-color past"></span>
									Past Date
								</div>
								<div className="legend-item">
									<span className="legend-color selected-check-in"></span>
									Valid From
								</div>
								<div className="legend-item">
									<span className="legend-color selected-check-out"></span>
									Valid Until
								</div>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Date Picker Modal */}
			{showDatePickerModal && (
				<div
					className="date-picker-modal-overlay"
					onClick={() => setShowDatePickerModal(false)}
				>
					<div
						className="date-picker-modal-content"
						onClick={(e) => e.stopPropagation()}
					>
						<button
							className="close-date-modal"
							onClick={() => setShowDatePickerModal(false)}
						>
							<FaTimes />
						</button>
						<h2>
							<FaCalendarAlt /> Select Your Dates
						</h2>
						<div className="modal-date-info">
							<div className="selected-dates-display">
								{checkInDate && (
									<div className="selected-date-item check-in">
										<span className="date-type">Check-in:</span>
										<span className="date-text">
											{new Date(checkInDate).toLocaleDateString("en-US", {
												weekday: "short",
												month: "short",
												day: "numeric",
												year: "numeric",
											})}
										</span>
									</div>
								)}
								{checkOutDate && (
									<div className="selected-date-item check-out">
										<span className="date-type">Check-out:</span>
										<span className="date-text">
											{new Date(checkOutDate).toLocaleDateString("en-US", {
												weekday: "short",
												month: "short",
												day: "numeric",
												year: "numeric",
											})}
										</span>
									</div>
								)}
								{!checkInDate && !checkOutDate && (
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
													dayData.isBlocked
														? "blocked"
														: dayData.isBooked
														? "booked"
														: dayData.isPast
														? "past"
														: "available"
												} ${
													dayData.dateString === checkInDate
														? "selected-check-in"
														: ""
												} ${
													dayData.dateString === checkOutDate
														? "selected-check-out"
														: ""
												}`}
												onClick={() => {
													if (isHost && !dayData.isPast) {
														handleToggleBlockDate(dayData.dateString)
													} else {
														handleCalendarDayClick(
															dayData.dateString,
															dayData.isBooked || dayData.isBlocked
														)
													}
												}}
												title={
													dayData.isBlocked
														? "Blocked by host"
														: dayData.isBooked
														? "Already booked"
														: dayData.isPast
														? "Past date (bookable)"
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
									<span className="legend-color available"></span>
									Available
								</div>
								<div className="legend-item">
									<span className="legend-color past"></span>
									Past Date (Bookable)
								</div>
								<div className="legend-item">
									<span className="legend-color booked"></span>
									Booked/Unavailable
								</div>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Review Modal */}
			{showReviewModal && (
				<div
					className="review-modal-overlay"
					onClick={() => setShowReviewModal(false)}
				>
					<div
						className="review-modal-content"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="review-modal-header">
							<h3>✍️ Write a Review</h3>
							<button
								className="close-review-modal"
								onClick={() => setShowReviewModal(false)}
							>
								<FaTimes />
							</button>
						</div>

						<div className="review-modal-body">
							<p className="review-intro">
								Share your experience with others! Rate your stay and help
								future guests make informed decisions.
							</p>

							<div className="rating-categories">
								<div className="rating-category">
									<label>Cleanliness</label>
									<div className="star-rating-input">
										{[1, 2, 3, 4, 5].map((star) => (
											<FaStar
												key={star}
												className={
													star <= reviewFormData.cleanliness ? "active" : ""
												}
												onClick={() =>
													setReviewFormData({
														...reviewFormData,
														cleanliness: star,
													})
												}
											/>
										))}
										<span className="rating-value">
											{reviewFormData.cleanliness}
										</span>
									</div>
								</div>

								<div className="rating-category">
									<label>Accuracy</label>
									<div className="star-rating-input">
										{[1, 2, 3, 4, 5].map((star) => (
											<FaStar
												key={star}
												className={
													star <= reviewFormData.accuracy ? "active" : ""
												}
												onClick={() =>
													setReviewFormData({
														...reviewFormData,
														accuracy: star,
													})
												}
											/>
										))}
										<span className="rating-value">
											{reviewFormData.accuracy}
										</span>
									</div>
								</div>

								<div className="rating-category">
									<label>Communication</label>
									<div className="star-rating-input">
										{[1, 2, 3, 4, 5].map((star) => (
											<FaStar
												key={star}
												className={
													star <= reviewFormData.communication ? "active" : ""
												}
												onClick={() =>
													setReviewFormData({
														...reviewFormData,
														communication: star,
													})
												}
											/>
										))}
										<span className="rating-value">
											{reviewFormData.communication}
										</span>
									</div>
								</div>

								<div className="rating-category">
									<label>Location</label>
									<div className="star-rating-input">
										{[1, 2, 3, 4, 5].map((star) => (
											<FaStar
												key={star}
												className={
													star <= reviewFormData.location ? "active" : ""
												}
												onClick={() =>
													setReviewFormData({
														...reviewFormData,
														location: star,
													})
												}
											/>
										))}
										<span className="rating-value">
											{reviewFormData.location}
										</span>
									</div>
								</div>

								<div className="rating-category">
									<label>Check-in Experience</label>
									<div className="star-rating-input">
										{[1, 2, 3, 4, 5].map((star) => (
											<FaStar
												key={star}
												className={
													star <= reviewFormData.checkIn ? "active" : ""
												}
												onClick={() =>
													setReviewFormData({
														...reviewFormData,
														checkIn: star,
													})
												}
											/>
										))}
										<span className="rating-value">
											{reviewFormData.checkIn}
										</span>
									</div>
								</div>

								<div className="rating-category">
									<label>Value for Money</label>
									<div className="star-rating-input">
										{[1, 2, 3, 4, 5].map((star) => (
											<FaStar
												key={star}
												className={star <= reviewFormData.value ? "active" : ""}
												onClick={() =>
													setReviewFormData({
														...reviewFormData,
														value: star,
													})
												}
											/>
										))}
										<span className="rating-value">{reviewFormData.value}</span>
									</div>
								</div>
							</div>

							<div className="review-comment-section">
								<label>Your Review</label>
								<textarea
									placeholder="Share your experience... (minimum 20 characters)"
									value={reviewFormData.comment}
									onChange={(e) =>
										setReviewFormData({
											...reviewFormData,
											comment: e.target.value,
										})
									}
									rows={5}
									minLength={20}
								/>
								<small className="character-count">
									{reviewFormData.comment.length} characters (minimum 20)
								</small>
							</div>
						</div>

						<div className="review-modal-footer">
							<button
								className="cancel-review-btn"
								onClick={() => setShowReviewModal(false)}
								disabled={isSubmittingReview}
							>
								Cancel
							</button>
							<button
								className="submit-review-btn"
								onClick={handleSubmitReview}
								disabled={
									isSubmittingReview ||
									reviewFormData.comment.trim().length < 20
								}
							>
								{isSubmittingReview ? "Submitting..." : "Submit Review"}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* View All Bookings Modal */}
			{showAllBookingsModal && (
				<div
					className="modal-overlay"
					onClick={() => setShowAllBookingsModal(false)}
				>
					<div
						className="modal-content large-modal"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="modal-header">
							<h2>
								<FaHistory /> All Bookings for {property?.title}
							</h2>
							<button
								className="close-modal-btn"
								onClick={() => setShowAllBookingsModal(false)}
							>
								<FaTimes />
							</button>
						</div>
						<div
							className="modal-body"
							style={{ maxHeight: "70vh", overflowY: "auto" }}
						>
							{(() => {
								const today = new Date()
								today.setHours(0, 0, 0, 0)

								const upcomingBookings = propertyBookings
									.filter((booking) => {
										if (booking.status === "cancelled") return false
										const checkInDate = new Date(booking.checkInDate)
										checkInDate.setHours(0, 0, 0, 0)
										return checkInDate >= today
									})
									.sort((a, b) => {
										const dateA = new Date(a.checkInDate)
										const dateB = new Date(b.checkInDate)
										return dateA - dateB
									})

								const pastBookings = propertyBookings
									.filter((booking) => {
										if (booking.status === "cancelled") return false
										const checkInDate = new Date(booking.checkInDate)
										checkInDate.setHours(0, 0, 0, 0)
										return checkInDate < today
									})
									.sort((a, b) => {
										const dateA = new Date(a.checkInDate)
										const dateB = new Date(b.checkInDate)
										return dateB - dateA
									})

								return (
									<>
										{/* Upcoming Bookings Section */}
										<div
											className="bookings-category-section"
											style={{ marginBottom: "2rem" }}
										>
											<h3
												style={{
													display: "flex",
													alignItems: "center",
													gap: "0.5rem",
													marginBottom: "1rem",
													color: "var(--primary)",
												}}
											>
												<FaCalendarCheck /> Upcoming Bookings (
												{upcomingBookings.length})
											</h3>
											{upcomingBookings.length > 0 ? (
												<div className="bookings-list">
													{upcomingBookings.map((booking) => (
														<div
															key={booking.id}
															className="booking-history-item"
														>
															<div className="booking-header">
																<span className="booking-id">
																	#{booking.id.substring(0, 8)}
																</span>
																<span
																	className={`booking-status-badge ${booking.status}`}
																>
																	{booking.status}
																</span>
															</div>
															<div className="booking-details">
																<div className="booking-info">
																	<FaUser className="info-icon" />
																	<span>{booking.guestName || "Guest"}</span>
																</div>
																<div className="booking-info">
																	<FaCalendarAlt className="info-icon" />
																	<span>
																		{new Date(
																			booking.checkInDate
																		).toLocaleDateString()}{" "}
																		-{" "}
																		{new Date(
																			booking.checkOutDate
																		).toLocaleDateString()}
																	</span>
																</div>
																<div className="booking-info">
																	<FaUsers className="info-icon" />
																	<span>
																		{booking.numberOfGuests ||
																			booking.guests ||
																			1}{" "}
																		{booking.numberOfGuests === 1
																			? "guest"
																			: "guests"}
																	</span>
																</div>
																<div className="booking-amount">
																	₱
																	{(
																		booking.pricing?.total ||
																		booking.totalAmount ||
																		0
																	).toLocaleString()}
																</div>
															</div>
														</div>
													))}
												</div>
											) : (
												<p className="no-data">
													No upcoming bookings for this property.
												</p>
											)}
										</div>

										{/* Booking History Section */}
										<div className="bookings-category-section">
											<h3
												style={{
													display: "flex",
													alignItems: "center",
													gap: "0.5rem",
													marginBottom: "1rem",
													color: "var(--primary)",
												}}
											>
												<FaHistory /> Booking History ({pastBookings.length})
											</h3>
											{pastBookings.length > 0 ? (
												<div className="bookings-list">
													{pastBookings.map((booking) => (
														<div
															key={booking.id}
															className="booking-history-item"
														>
															<div className="booking-header">
																<span className="booking-id">
																	#{booking.id.substring(0, 8)}
																</span>
																<span
																	className={`booking-status-badge ${booking.status}`}
																>
																	{booking.status}
																</span>
															</div>
															<div className="booking-details">
																<div className="booking-info">
																	<FaUser className="info-icon" />
																	<span>{booking.guestName || "Guest"}</span>
																</div>
																<div className="booking-info">
																	<FaCalendarAlt className="info-icon" />
																	<span>
																		{new Date(
																			booking.checkInDate
																		).toLocaleDateString()}{" "}
																		-{" "}
																		{new Date(
																			booking.checkOutDate
																		).toLocaleDateString()}
																	</span>
																</div>
																<div className="booking-info">
																	<FaUsers className="info-icon" />
																	<span>
																		{booking.numberOfGuests ||
																			booking.guests ||
																			1}{" "}
																		{booking.numberOfGuests === 1
																			? "guest"
																			: "guests"}
																	</span>
																</div>
																<div className="booking-amount">
																	₱
																	{(
																		booking.pricing?.total ||
																		booking.totalAmount ||
																		0
																	).toLocaleString()}
																</div>
															</div>
														</div>
													))}
												</div>
											) : (
												<p className="no-data">
													No booking history for this property.
												</p>
											)}
										</div>
									</>
								)
							})()}
						</div>
						<div className="modal-footer">
							<button
								className="btn-primary"
								onClick={() => setShowAllBookingsModal(false)}
							>
								Close
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Wallet Payment Confirmation Modal */}
			{showWalletPaymentModal && (
				<div
					className="wallet-payment-modal-overlay"
					onClick={() => setShowWalletPaymentModal(false)}
				>
					<div
						className="wallet-payment-modal-content"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="wallet-payment-modal-header">
							<div className="wallet-icon-wrapper">
								<FaWallet />
							</div>
							<h3>Confirm E-Wallet Payment</h3>
							<button
								className="close-wallet-modal"
								onClick={() => setShowWalletPaymentModal(false)}
							>
								<FaTimes />
							</button>
						</div>

						<div className="wallet-payment-modal-body">
							<div className="wallet-payment-info">
								<p className="wallet-payment-message">
									You are about to pay for this booking using your E-Wallet
									balance.
								</p>
								<div className="wallet-payment-summary">
									<div className="summary-row">
										<span className="summary-label">Property:</span>
										<span className="summary-value">{property?.title}</span>
									</div>
									<div className="summary-row">
										<span className="summary-label">Check-in:</span>
										<span className="summary-value">
											{checkInDate
												? new Date(checkInDate).toLocaleDateString("en-US", {
														month: "short",
														day: "numeric",
														year: "numeric",
												  })
												: "Not selected"}
										</span>
									</div>
									<div className="summary-row">
										<span className="summary-label">Check-out:</span>
										<span className="summary-value">
											{checkOutDate
												? new Date(checkOutDate).toLocaleDateString("en-US", {
														month: "short",
														day: "numeric",
														year: "numeric",
												  })
												: "Not selected"}
										</span>
									</div>
									<div className="summary-row">
										<span className="summary-label">Guests:</span>
										<span className="summary-value">{numberOfGuests}</span>
									</div>
									<div className="summary-row total-row">
										<span className="summary-label">Total Amount:</span>
										<span className="summary-value total-amount">
											₱{calculatePrices().total.toLocaleString()}
										</span>
									</div>
									<div className="summary-row balance-row">
										<span className="summary-label">Current Balance:</span>
										<span className="summary-value balance-amount">
											₱{walletBalance.toLocaleString()}
										</span>
									</div>
									<div className="summary-row balance-after-row">
										<span className="summary-label">Balance After:</span>
										<span className="summary-value balance-after-amount">
											₱
											{(
												walletBalance - calculatePrices().total
											).toLocaleString()}
										</span>
									</div>
								</div>
							</div>
						</div>

						<div className="wallet-payment-modal-footer">
							<button
								className="wallet-modal-cancel-btn"
								onClick={() => setShowWalletPaymentModal(false)}
							>
								Cancel
							</button>
							<button
								className="wallet-modal-confirm-btn"
								onClick={handleConfirmWalletPayment}
							>
								<FaWallet /> Confirm Payment
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Contact Host Modal */}
			<ContactHostModal
				isOpen={showContactHostModal}
				onClose={() => setShowContactHostModal(false)}
				property={property}
				hostId={property?.hostId || property?.host?.hostId}
			/>

			{/* Wishlist View Modal */}
			{showWishlistModal && selectedWishlist && (
				<div
					className="wishlist-view-modal-overlay"
					onClick={() => setShowWishlistModal(false)}
				>
					<div
						className="wishlist-view-modal-content"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="wishlist-modal-header">
							<h2>
								<FaBookmark style={{ color: "var(--primary)" }} /> Wishlist by {selectedWishlist.guestName}
							</h2>
							<button
								className="close-modal-btn"
								onClick={() => setShowWishlistModal(false)}
							>
								×
							</button>
						</div>

						<div className="wishlist-view-body">
							{/* Property Info */}
							<div className="wishlist-property-header">
								<img
									src={property?.images?.[0] || housePlaceholder}
									alt={property?.title}
									className="wishlist-property-image"
								/>
								<div className="wishlist-property-info">
									<h3>{property?.title}</h3>
									{property?.location && (
										<div className="wishlist-location">
											<FaMapMarkerAlt />
											<span>
												{property.location.city}, {property.location.province}
											</span>
										</div>
									)}
								</div>
							</div>

							{/* Wishlist Details */}
							<div className="wishlist-details-section">
								<h4>Wishes</h4>
								<div className="wishlist-details-grid">
									{selectedWishlist.beds !== undefined && selectedWishlist.beds !== null && selectedWishlist.beds > 0 && (
										<div className="wishlist-detail-item">
											<FaBed className="wishlist-detail-icon" />
											<div>
												<span className="detail-label">Beds</span>
												<span className="detail-value">{selectedWishlist.beds}</span>
											</div>
										</div>
									)}
									{selectedWishlist.bathrooms !== undefined && selectedWishlist.bathrooms !== null && selectedWishlist.bathrooms > 0 && (
										<div className="wishlist-detail-item">
											<FaBath className="wishlist-detail-icon" />
											<div>
												<span className="detail-label">Bathrooms</span>
												<span className="detail-value">{selectedWishlist.bathrooms}</span>
											</div>
										</div>
									)}
									{selectedWishlist.bedrooms !== undefined && selectedWishlist.bedrooms !== null && selectedWishlist.bedrooms > 0 && (
										<div className="wishlist-detail-item">
											<FaHome className="wishlist-detail-icon" />
											<div>
												<span className="detail-label">Bedrooms</span>
												<span className="detail-value">{selectedWishlist.bedrooms}</span>
											</div>
										</div>
									)}
									{selectedWishlist.guests !== undefined && selectedWishlist.guests !== null && selectedWishlist.guests > 0 && (
										<div className="wishlist-detail-item">
											<FaUsers className="wishlist-detail-icon" />
											<div>
												<span className="detail-label">Guests</span>
												<span className="detail-value">{selectedWishlist.guests}</span>
											</div>
										</div>
									)}
									{selectedWishlist.parkingSpaces !== undefined && selectedWishlist.parkingSpaces !== null && selectedWishlist.parkingSpaces > 0 && (
										<div className="wishlist-detail-item">
											<FaParking className="wishlist-detail-icon" />
											<div>
												<span className="detail-label">Parking Spaces</span>
												<span className="detail-value">{selectedWishlist.parkingSpaces}</span>
											</div>
										</div>
									)}
									{selectedWishlist.wifiSpeed !== undefined && selectedWishlist.wifiSpeed !== null && selectedWishlist.wifiSpeed > 0 && (
										<div className="wishlist-detail-item">
											<FaWifi className="wishlist-detail-icon" />
											<div>
												<span className="detail-label">Wi-Fi Speed</span>
												<span className="detail-value">{selectedWishlist.wifiSpeed} Mbps</span>
											</div>
										</div>
									)}
								</div>

								{selectedWishlist.breakfastIncluded && (
									<div className="wishlist-offer-item">
										<FaUtensils className="offer-icon" />
										<span>Breakfast Included</span>
									</div>
								)}

								{selectedWishlist.notes && (
									<div className="wishlist-notes">
										<h5>
											<FaStickyNote /> Additional Notes
										</h5>
										<p>{selectedWishlist.notes}</p>
									</div>
								)}

								{selectedWishlist.createdAt && (
									<div className="wishlist-date">
										<span>
											Created: {new Date(selectedWishlist.createdAt).toLocaleDateString()}
										</span>
									</div>
								)}
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Full Size Image Modal */}
			{showFullSizeImage && (
				<div
					className="full-size-image-modal-overlay"
					onClick={() => setShowFullSizeImage(false)}
				>
					<button
						className="full-size-image-close"
						onClick={() => setShowFullSizeImage(false)}
						title="Close (ESC)"
					>
						<FaTimes />
					</button>
					{images.length > 1 && (
						<button
							className="full-size-image-nav full-size-image-prev"
							onClick={(e) => {
								e.stopPropagation()
								setFullSizeImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))
							}}
							title="Previous (←)"
						>
							<FaChevronLeft />
						</button>
					)}
					<div
						className="full-size-image-container"
						onClick={(e) => e.stopPropagation()}
					>
						<img
							src={images[fullSizeImageIndex] || housePlaceholder}
							alt={`Property view ${fullSizeImageIndex + 1}`}
							className="full-size-image"
						/>
						<div className="full-size-image-info">
							<span className="full-size-image-counter">
								{fullSizeImageIndex + 1} / {images.length}
							</span>
						</div>
					</div>
					{images.length > 1 && (
						<button
							className="full-size-image-nav full-size-image-next"
							onClick={(e) => {
								e.stopPropagation()
								setFullSizeImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))
							}}
							title="Next (→)"
						>
							<FaChevronRight />
						</button>
					)}
				</div>
			)}
			</div>
		</div>
	)
}
