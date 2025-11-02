import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import { db } from "../components/firebaseConfig"
import { collection, getDocs, query, where, orderBy, onSnapshot } from "firebase/firestore"
import { toast } from "react-stacked-toast"
import {
	Chart as ChartJS,
	CategoryScale,
	LinearScale,
	PointElement,
	LineElement,
	BarElement,
	ArcElement,
	Title,
	Tooltip,
	Legend,
} from "chart.js"
import { Line, Bar, Doughnut } from "react-chartjs-2"

// Register ChartJS components
ChartJS.register(
	CategoryScale,
	LinearScale,
	PointElement,
	LineElement,
	BarElement,
	ArcElement,
	Title,
	Tooltip,
	Legend
)
import {
	FaHome,
	FaCalendarCheck,
	FaDollarSign,
	FaChartLine,
	FaStar,
	FaUsers,
	FaSignOutAlt,
	FaCog,
	FaBars,
	FaUser,
	FaBookmark,
	FaWallet,
	FaGift,
	FaChevronRight,
	FaClock,
	FaTag,
	FaFileAlt,
	FaEdit,
	FaTrash,
	FaEnvelope,
	FaCalendarAlt,
	FaMapMarkerAlt,
	FaCrown,
} from "react-icons/fa"
import Wallet from "../components/Wallet"
import Promos from "../components/Promos"
import { doc, getDoc } from "firebase/firestore"
import logoPlain from "../assets/logoPlain.png"
import housePlaceholder from "../assets/housePlaceholder.png"
import "../css/DashboardHost.css"
import "../css/DashboardGuest.css"

export default function DashboardHost() {
	const { currentUser, userData, logout } = useAuth()
	const navigate = useNavigate()
	const location = useLocation()
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
	const [loading, setLoading] = useState(true)
	const [isMenuOpen, setIsMenuOpen] = useState(false)
	const [theme, setTheme] = useState(localStorage.getItem("theme") || "light")
	const [todayBookings, setTodayBookings] = useState([])
	const [upcomingBookings, setUpcomingBookings] = useState([])
	const [walletBalance, setWalletBalance] = useState(0)
	const [activePromos, setActivePromos] = useState([])
	const [showWalletModal, setShowWalletModal] = useState(false)
	const [showPromosModal, setShowPromosModal] = useState(false)
	const [drafts, setDrafts] = useState([])
	const [showDraftsModal, setShowDraftsModal] = useState(false)
	const [deletingDraft, setDeletingDraft] = useState(null)
	const [draftsCategoryFilter, setDraftsCategoryFilter] = useState(null)
	const [unreadNotifications, setUnreadNotifications] = useState(0)
	const [activeCategory, setActiveCategory] = useState("home")
	const [filteredProperties, setFilteredProperties] = useState([])
	const [previousBookings, setPreviousBookings] = useState([])
	const [showBookingsModal, setShowBookingsModal] = useState(false)
	const [bookingsModalType, setBookingsModalType] = useState("previous")
	const [bookingsList, setBookingsList] = useState({
		previous: [],
		today: [],
		upcoming: [],
	})
	const [chartData, setChartData] = useState({
		monthlyRevenue: null,
		totalRevenue: null,
		bookings: null,
		reviews: null,
	})
	const [totalReviews, setTotalReviews] = useState(0)
	const [isGeneratingReport, setIsGeneratingReport] = useState(false)
	const [userSubscription, setUserSubscription] = useState(null)
	const [showPremiumModal, setShowPremiumModal] = useState(false)
	const [premiumFeatureName, setPremiumFeatureName] = useState("")

	// Reset category to "home" whenever component mounts or route changes
	useEffect(() => {
		setActiveCategory("home")
	}, [location.pathname])

	useEffect(() => {
		if (currentUser) {
			fetchHostData()
			fetchUserSubscription()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentUser])

	// Fetch user subscription status
	const fetchUserSubscription = async () => {
		if (!currentUser?.uid) return

		try {
			const userDoc = await getDoc(doc(db, "users", currentUser.uid))
			if (userDoc.exists()) {
				const userData = userDoc.data()
				const subscription = userData.subscription || null

				// Check if cancelling subscription has expired
				if (subscription && subscription.status === "cancelling" && subscription.expiryDate) {
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

	// Check if user has premium subscription (including cancelling subscriptions until expiry)
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
			if (userSubscription.status === "cancelling" && userSubscription.expiryDate) {
				const expiryDate = userSubscription.expiryDate.toDate
					? userSubscription.expiryDate.toDate()
					: new Date(userSubscription.expiryDate)
				const now = new Date()
				return expiryDate > now // Still has premium access until expiry
			}
		}

		return false
	}

	// Check if subscription has expired and needs to be reverted
	useEffect(() => {
		const checkSubscriptionExpiry = async () => {
			if (!currentUser?.uid || !userSubscription) return

			// Check if cancelling subscription has expired
			if (
				userSubscription.status === "cancelling" &&
				userSubscription.expiryDate
			) {
				const expiryDate = userSubscription.expiryDate.toDate
					? userSubscription.expiryDate.toDate()
					: new Date(userSubscription.expiryDate)
				const now = new Date()

				if (expiryDate <= now) {
					// Subscription expired - revert to free plan
					try {
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

						toast.info("Your premium subscription has expired. You've been moved to the free plan.")
					} catch (error) {
						console.error("Error reverting to free plan:", error)
					}
				}
			}
		}

		// Check expiry on mount and set interval to check periodically
		checkSubscriptionExpiry()
		const interval = setInterval(checkSubscriptionExpiry, 60000) // Check every minute

		return () => clearInterval(interval)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentUser, userSubscription])

	// Check premium access before accessing premium features
	const checkPremiumAccess = (featureName) => {
		if (!hasPremium()) {
			setPremiumFeatureName(featureName)
			setShowPremiumModal(true)
			return false
		}
		return true
	}

	// Real-time listener for unread notifications
	useEffect(() => {
		if (!currentUser?.uid) return

		const notificationsQuery = query(
			collection(db, "notifications"),
			where("hostId", "==", currentUser.uid),
			where("read", "==", false)
		)

		const unsubscribe = onSnapshot(
			notificationsQuery,
			(snapshot) => {
				setUnreadNotifications(snapshot.size)
			},
			(error) => {
				// If query fails (missing index), try without read filter
				if (error.code === "failed-precondition") {
					const simpleQuery = query(
						collection(db, "notifications"),
						where("hostId", "==", currentUser.uid)
					)
					const unsubscribeSimple = onSnapshot(
						simpleQuery,
						(snapshot) => {
							const unread = snapshot.docs.filter(
								(doc) => !doc.data().read
							).length
							setUnreadNotifications(unread)
						},
						(err) => {
							console.error("Error with simple notifications query:", err)
						}
					)
					return () => unsubscribeSimple()
				}
				console.error("Error listening to notifications:", error)
			}
		)

		return () => unsubscribe()
	}, [currentUser])

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (event) => {
			if (isMenuOpen && !event.target.closest(".user-menu")) {
				setIsMenuOpen(false)
			}
		}
		document.addEventListener("mousedown", handleClickOutside)
		return () => document.removeEventListener("mousedown", handleClickOutside)
	}, [isMenuOpen])

	const fetchHostData = async () => {
		try {
			setLoading(true)
			const hostId = currentUser.uid

			// Fetch properties with error handling
			let propertiesList = []
			try {
				const propertiesRef = collection(db, "properties")
				const propertiesQuery = query(
					propertiesRef,
					where("hostId", "==", hostId)
				)
				const propertiesSnapshot = await getDocs(propertiesQuery)
				propertiesList = propertiesSnapshot.docs.map((doc) => ({
					id: doc.id,
					...doc.data(),
				}))
			} catch (error) {
				console.error("Error fetching properties:", error)
				propertiesList = []
			}
			setProperties(propertiesList)

			// Fetch bookings with graceful error handling (orderBy may require index)
			let bookingsList = []
			try {
				const bookingsRef = collection(db, "bookings")
				const bookingsQuery = query(
					bookingsRef,
					where("hostId", "==", hostId),
					orderBy("createdAt", "desc")
				)
				const bookingsSnapshot = await getDocs(bookingsQuery)
				bookingsList = bookingsSnapshot.docs.map((doc) => ({
					id: doc.id,
					...doc.data(),
				}))
			} catch (error) {
				// If orderBy fails (likely missing index), try without orderBy
				if (
					error.code === "failed-precondition" ||
					error.code === "unimplemented"
				) {
					try {
						const bookingsRef = collection(db, "bookings")
						const bookingsQuery = query(
							bookingsRef,
							where("hostId", "==", hostId)
						)
						const bookingsSnapshot = await getDocs(bookingsQuery)
						bookingsList = bookingsSnapshot.docs.map((doc) => ({
							id: doc.id,
							...doc.data(),
						}))
						// Sort in memory
						bookingsList.sort((a, b) => {
							const dateA =
								a.createdAt?.toDate?.() || new Date(a.createdAt || 0)
							const dateB =
								b.createdAt?.toDate?.() || new Date(b.createdAt || 0)
							return dateB - dateA
						})
					} catch (retryError) {
						console.error("Error fetching bookings:", retryError)
						bookingsList = []
					}
				} else {
					console.error("Error fetching bookings:", error)
					bookingsList = []
				}
			}

			// Calculate stats with safe defaults
			const totalRevenue = bookingsList.reduce(
				(sum, booking) => sum + (booking.pricing?.total || 0),
				0
			)
			const activeBookings = bookingsList.filter(
				(b) => b.status === "confirmed"
			).length
			const avgRating =
				propertiesList.length > 0
					? propertiesList.reduce((sum, p) => sum + (p.rating || 0), 0) /
					  propertiesList.length
					: 0

			// Monthly revenue
			const currentMonth = new Date().getMonth()
			const monthlyRevenue = bookingsList
				.filter((b) => {
					const bookingDate =
						b.createdAt?.toDate?.() || new Date(b.createdAt || 0)
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

			// Filter today's and upcoming bookings
			const today = new Date()
			today.setHours(0, 0, 0, 0)
			const todayStr = today.toISOString().split("T")[0]

			const todayList = bookingsList.filter((booking) => {
				const checkIn = new Date(booking.checkInDate)
				const checkOut = new Date(booking.checkOutDate)
				const checkInStr = checkIn.toISOString().split("T")[0]
				const checkOutStr = checkOut.toISOString().split("T")[0]
				return checkInStr === todayStr || checkOutStr === todayStr
			})

			const upcomingList = bookingsList
				.filter((booking) => {
					const checkIn = new Date(booking.checkInDate)
					return checkIn > today && booking.status === "confirmed"
				})
				.sort((a, b) => {
					const dateA = new Date(a.checkInDate)
					const dateB = new Date(b.checkInDate)
					return dateA - dateB
				})

			setTodayBookings(todayList)
			setUpcomingBookings(upcomingList.slice(0, 5))

			// Calculate previous bookings (checkout date < today)
			const previousList = bookingsList
				.filter((booking) => {
					const checkOut = new Date(booking.checkOutDate)
					return checkOut < today
				})
				.sort((a, b) => {
					const dateA = new Date(a.checkOutDate)
					const dateB = new Date(b.checkOutDate)
					return dateB - dateA // Most recent first
				})

			setPreviousBookings(previousList)

			// Set initial filtered properties (homes)
			const homes = propertiesList.filter((p) => p.category === "home")
			setFilteredProperties(homes)

			// Fetch wallet balance
			await fetchWalletBalance()

			// Fetch promos
			await fetchPromos()

			// Fetch drafts
			await fetchDrafts()

			// Fetch unread notifications
			await fetchUnreadNotifications()

			// Fetch reviews and prepare chart data
			await fetchReviews(propertiesList, bookingsList)
		} catch (error) {
			console.error("Unexpected error fetching host data:", error)
			// Only show error for critical failures, not for empty collections
			if (error.code !== "permission-denied" && error.code !== "not-found") {
				console.log("Dashboard loaded with default values")
			}
			// Set defaults
			setStats({
				totalProperties: 0,
				totalBookings: 0,
				totalRevenue: 0,
				avgRating: "0.0",
				activeBookings: 0,
				monthlyRevenue: 0,
			})
			setRecentBookings([])
			setProperties([])
		} finally {
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

	// Get user's display name
	const displayName =
		userData?.displayName || currentUser?.displayName || "Host"
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

	const fetchWalletBalance = async () => {
		if (!currentUser?.uid) return

		try {
			const userDoc = await getDoc(doc(db, "users", currentUser.uid))
			if (userDoc.exists()) {
				const data = userDoc.data()
				setWalletBalance(data.walletBalance || 0)
			}
		} catch (error) {
			console.error("Error fetching wallet balance:", error)
		}
	}

	const fetchPromos = async () => {
		try {
			if (!currentUser?.uid) return

			// Only fetch promos created by the current host
			const promosQuery = query(
				collection(db, "promos"),
				where("createdBy", "==", currentUser.uid)
			)
			const promosSnapshot = await getDocs(promosQuery)
			const now = new Date()
			const promosData = promosSnapshot.docs
				.map((doc) => ({
					id: doc.id,
					...doc.data(),
				}))
				.filter((promo) => {
					if (!promo.isActive) return false
					if (promo.validUntil) {
						const expiryDate = new Date(promo.validUntil)
						if (expiryDate < now) return false
					}
					if (promo.validFrom) {
						const startDate = new Date(promo.validFrom)
						if (startDate > now) return false
					}
					if (
						promo.usageLimit > 0 &&
						(promo.usageCount || 0) >= promo.usageLimit
					) {
						return false
					}
					return true
				})

			setActivePromos(promosData.slice(0, 3))
		} catch (error) {
			console.error("Error fetching promos:", error)
			// If query fails (missing index), try without filter
			try {
				const promosSnapshot = await getDocs(collection(db, "promos"))
				const now = new Date()
				const promosData = promosSnapshot.docs
					.map((doc) => ({
						id: doc.id,
						...doc.data(),
					}))
					.filter((promo) => {
						// Filter by createdBy in memory
						if (promo.createdBy !== currentUser?.uid) return false
						if (!promo.isActive) return false
						if (promo.validUntil) {
							const expiryDate = new Date(promo.validUntil)
							if (expiryDate < now) return false
						}
						if (promo.validFrom) {
							const startDate = new Date(promo.validFrom)
							if (startDate > now) return false
						}
						if (
							promo.usageLimit > 0 &&
							(promo.usageCount || 0) >= promo.usageLimit
						) {
							return false
						}
						return true
					})

				setActivePromos(promosData.slice(0, 3))
			} catch (retryError) {
				console.error("Error fetching promos (retry):", retryError)
			}
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

	const fetchDrafts = async () => {
		if (!currentUser?.uid) return

		try {
			const draftsQuery = query(
				collection(db, "propertyDrafts"),
				where("hostId", "==", currentUser.uid),
				where("status", "!=", "published")
			)
			const draftsSnapshot = await getDocs(draftsQuery)
			const draftsList = draftsSnapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			}))

			// Sort by updatedAt (newest first)
			draftsList.sort((a, b) => {
				const dateA = a.updatedAt?.toDate?.() || new Date(a.updatedAt || 0)
				const dateB = b.updatedAt?.toDate?.() || new Date(b.updatedAt || 0)
				return dateB - dateA
			})

			setDrafts(draftsList)
		} catch (error) {
			// If status field doesn't exist yet, try without it
			try {
				const draftsQuery = query(
					collection(db, "propertyDrafts"),
					where("hostId", "==", currentUser.uid)
				)
				const draftsSnapshot = await getDocs(draftsQuery)
				const draftsList = draftsSnapshot.docs
					.map((doc) => ({
						id: doc.id,
						...doc.data(),
					}))
					.filter((draft) => draft.status !== "published")

				draftsList.sort((a, b) => {
					const dateA = a.updatedAt?.toDate?.() || new Date(a.updatedAt || 0)
					const dateB = b.updatedAt?.toDate?.() || new Date(b.updatedAt || 0)
					return dateB - dateA
				})

				setDrafts(draftsList)
			} catch (retryError) {
				console.error("Error fetching drafts:", retryError)
			}
		}
	}

	const handleDeleteDraft = async (draftId) => {
		if (!window.confirm("Are you sure you want to delete this draft?")) {
			return
		}

		setDeletingDraft(draftId)
		try {
			const { deleteDoc } = await import("firebase/firestore")
			await deleteDoc(doc(db, "propertyDrafts", draftId))
			setDrafts(drafts.filter((d) => d.id !== draftId))
			toast.success("Draft deleted successfully")
		} catch (error) {
			console.error("Error deleting draft:", error)
			toast.error("Failed to delete draft")
		} finally {
			setDeletingDraft(null)
		}
	}

	const handleEditDraft = (draftId) => {
		navigate(`/host/list-property?draftId=${draftId}`)
	}

	const fetchUnreadNotifications = async () => {
		if (!currentUser?.uid) return

		try {
			const notificationsQuery = query(
				collection(db, "notifications"),
				where("hostId", "==", currentUser.uid),
				where("read", "==", false)
			)
			const notificationsSnapshot = await getDocs(notificationsQuery)
			setUnreadNotifications(notificationsSnapshot.size)
		} catch (error) {
			// If query fails (missing index), try without read filter
			try {
				const notificationsQuery = query(
					collection(db, "notifications"),
					where("hostId", "==", currentUser.uid)
				)
				const notificationsSnapshot = await getDocs(notificationsQuery)
				const unread = notificationsSnapshot.docs.filter(
					(doc) => !doc.data().read
				).length
				setUnreadNotifications(unread)
			} catch (retryError) {
				console.error("Error fetching unread notifications:", retryError)
			}
		}
	}

	// Filter properties by category
	useEffect(() => {
		const filtered = properties.filter((p) => p.category === activeCategory)
		setFilteredProperties(filtered)
	}, [properties, activeCategory])

	const handleCategoryChange = (category) => {
		setActiveCategory(category)
	}

	const formatPrice = (price, currency = "PHP") => {
		if (currency === "PHP") {
			return `₱${price.toLocaleString()}`
		}
		return `$${price.toLocaleString()}`
	}

	const getPropertyTypeName = (property) => {
		if (property.category === "home") {
			return property.propertyType || property.type || "Property"
		} else if (property.category === "experience") {
			return property.experienceType || property.type || "Experience"
		} else if (property.category === "service") {
			return property.serviceType || property.type || "Service"
		}
		return "Listing"
	}

	const handleShowBookings = (type) => {
		setBookingsModalType(type)
		// Update bookings list based on type
		if (type === "previous") {
			setBookingsList({ previous: previousBookings, today: [], upcoming: [] })
		} else if (type === "today") {
			setBookingsList({ previous: [], today: todayBookings, upcoming: [] })
		} else if (type === "upcoming") {
			setBookingsList({ previous: [], today: [], upcoming: upcomingBookings })
		}
		setShowBookingsModal(true)
	}

	const getStatusBadge = (status) => {
		switch (status) {
			case "confirmed":
				return <span className="host-status-badge host-status-confirmed">Confirmed</span>
			case "pending":
				return <span className="host-status-badge host-status-pending">Pending</span>
			case "completed":
				return <span className="host-status-badge host-status-completed">Completed</span>
			case "cancelled":
				return <span className="host-status-badge host-status-cancelled">Cancelled</span>
			default:
				return <span className="host-status-badge">{status}</span>
		}
	}

	const fetchReviews = async (propertiesList, bookingsList) => {
		if (!currentUser?.uid) return

		try {
			// Get all property IDs for this host
			const propertyIds = propertiesList.map((p) => p.id)

			if (propertyIds.length === 0) {
				setTotalReviews(0)
				prepareChartData([], bookingsList, [])
				return
			}

			// Fetch all reviews for host's properties
			// Note: Firestore 'in' query limit is 10, so we'll batch if needed
			let allReviews = []
			for (let i = 0; i < propertyIds.length; i += 10) {
				const batch = propertyIds.slice(i, i + 10)
				const reviewsQuery = query(
					collection(db, "reviews"),
					where("propertyId", "in", batch),
					where("status", "==", "approved")
				)
				const reviewsSnapshot = await getDocs(reviewsQuery)
				const batchReviews = reviewsSnapshot.docs.map((doc) => ({
					id: doc.id,
					...doc.data(),
				}))
				allReviews = [...allReviews, ...batchReviews]
			}

			setTotalReviews(allReviews.length)
			prepareChartData(propertiesList, bookingsList, allReviews)
		} catch (error) {
			console.error("Error fetching reviews:", error)
			setTotalReviews(0)
			prepareChartData(propertiesList, bookingsList, [])
		}
	}

	const prepareChartData = (propertiesList, bookingsList, reviewsList) => {
		// Monthly Revenue Chart (last 6 months)
		const months = []
		const revenueData = []
		const currentDate = new Date()

		for (let i = 5; i >= 0; i--) {
			const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1)
			const monthName = date.toLocaleDateString("en-US", { month: "short" })
			months.push(monthName)

			const monthRevenue = bookingsList
				.filter((booking) => {
					const bookingDate =
						booking.createdAt?.toDate?.() || new Date(booking.createdAt || 0)
					return (
						bookingDate.getMonth() === date.getMonth() &&
						bookingDate.getFullYear() === date.getFullYear()
					)
				})
				.reduce((sum, booking) => sum + (booking.pricing?.total || 0), 0)

			revenueData.push(monthRevenue)
		}

		// Total Revenue Doughnut Chart (This Year vs Last Year)
		const currentYear = new Date().getFullYear()
		const thisYearRevenue = bookingsList
			.filter((booking) => {
				const bookingDate =
					booking.createdAt?.toDate?.() || new Date(booking.createdAt || 0)
				return bookingDate.getFullYear() === currentYear
			})
			.reduce((sum, booking) => sum + (booking.pricing?.total || 0), 0)

		const lastYearRevenue = bookingsList
			.filter((booking) => {
				const bookingDate =
					booking.createdAt?.toDate?.() || new Date(booking.createdAt || 0)
				return bookingDate.getFullYear() === currentYear - 1
			})
			.reduce((sum, booking) => sum + (booking.pricing?.total || 0), 0)

		// Bookings Trend (last 6 months)
		const bookingsData = months.map((monthName, index) => {
			const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - (5 - index), 1)
			return bookingsList.filter((booking) => {
				const bookingDate =
					booking.createdAt?.toDate?.() || new Date(booking.createdAt || 0)
				return (
					bookingDate.getMonth() === date.getMonth() &&
					bookingDate.getFullYear() === date.getFullYear()
				)
			}).length
		})

		// Reviews Trend (last 6 months)
		const reviewsData = months.map((monthName, index) => {
			const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - (5 - index), 1)
			return reviewsList.filter((review) => {
				const reviewDate = review.createdAt?.toDate?.() || new Date(review.createdAt || 0)
				return (
					reviewDate.getMonth() === date.getMonth() &&
					reviewDate.getFullYear() === date.getFullYear()
				)
			}).length
		})

		setChartData({
			monthlyRevenue: {
				labels: months,
				datasets: [
					{
						label: "Revenue (₱)",
						data: revenueData,
						borderColor: "rgb(97, 191, 156)",
						backgroundColor: "rgba(97, 191, 156, 0.1)",
						tension: 0.4,
						fill: true,
					},
				],
			},
			totalRevenue: {
				labels: [`${currentYear}`, `${currentYear - 1}`],
				datasets: [
					{
						data: [thisYearRevenue, lastYearRevenue],
						backgroundColor: [
							"rgba(97, 191, 156, 0.8)",
							"rgba(217, 195, 111, 0.8)",
						],
						borderWidth: 2,
						borderColor: "#fff",
					},
				],
			},
			bookings: {
				labels: months,
				datasets: [
					{
						label: "Bookings",
						data: bookingsData,
						backgroundColor: "rgba(65, 95, 148, 0.8)",
						borderColor: "rgb(65, 95, 148)",
						borderWidth: 1,
					},
				],
			},
			reviews: {
				labels: months,
				datasets: [
					{
						label: "Reviews",
						data: reviewsData,
						backgroundColor: "rgba(245, 158, 11, 0.8)",
						borderColor: "rgb(245, 158, 11)",
						borderWidth: 1,
					},
				],
			},
		})
	}

	// Report Generation Functions
	const generateHostReport = async (reportType) => {
		// Check premium access
		if (!checkPremiumAccess("Report Generation")) {
			return
		}

		try {
			setIsGeneratingReport(true)
			const { Document, Page, Text, View, StyleSheet, pdf } = await import(
				"@react-pdf/renderer"
			)

			let reportData = {}
			let reportTitle = ""

			switch (reportType) {
				case "properties":
					reportTitle = "Host_Properties_Report"
					reportData = {
						generatedAt: new Date().toISOString(),
						summary: {
							totalProperties: stats.totalProperties,
							averageRating: stats.avgRating,
							totalReviews: totalReviews,
						},
						properties: filteredProperties.map((p) => ({
							title: p.title || "Untitled",
							category: p.category || "N/A",
							type: getPropertyTypeName(p),
							rating: p.rating || 0,
							reviews: p.reviewsCount || 0,
							price: formatPrice(
								p.pricing?.basePrice || p.pricing?.price || 0,
								p.pricing?.currency
							),
							location: `${p.location?.city || ""}, ${p.location?.province || ""}`,
							status: p.status || "active",
						})),
					}
					break

				case "bookings":
					reportTitle = "Host_Bookings_Report"
					reportData = {
						generatedAt: new Date().toISOString(),
						summary: {
							totalBookings: stats.totalBookings,
							todayBookings: todayBookings.length,
							upcomingBookings: upcomingBookings.length,
							previousBookings: previousBookings.length,
						},
						bookings: bookingsList.previous
							.concat(bookingsList.today, bookingsList.upcoming)
							.slice(0, 50)
							.map((b) => ({
								property: b.propertyTitle || "N/A",
								guest: b.guestName || "N/A",
								checkIn: formatDate(b.checkInDate),
								checkOut: formatDate(b.checkOutDate),
								status: b.status || "pending",
								total: `₱${(b.pricing?.total || 0).toLocaleString()}`,
								guests: b.numberOfGuests || b.guests || 1,
							})),
					}
					break

				case "revenue":
					reportTitle = "Host_Revenue_Report"
					const months = []
					const revenueByMonth = []
					for (let i = 5; i >= 0; i--) {
						const date = new Date(
							new Date().getFullYear(),
							new Date().getMonth() - i,
							1
						)
						months.push(date.toLocaleDateString("en-US", { month: "short" }))
						const monthRevenue = bookingsList.previous
							.concat(bookingsList.today, bookingsList.upcoming)
							.filter((booking) => {
								const bookingDate =
									booking.createdAt?.toDate?.() || new Date(booking.createdAt || 0)
								return (
									bookingDate.getMonth() === date.getMonth() &&
									bookingDate.getFullYear() === date.getFullYear()
								)
							})
							.reduce((sum, booking) => sum + (booking.pricing?.total || 0), 0)
						revenueByMonth.push(monthRevenue)
					}

					reportData = {
						generatedAt: new Date().toISOString(),
						summary: {
							totalRevenue: `₱${stats.totalRevenue.toLocaleString()}`,
							monthlyRevenue: `₱${stats.monthlyRevenue.toLocaleString()}`,
							averageBookingValue:
								stats.totalBookings > 0
									? `₱${Math.round(stats.totalRevenue / stats.totalBookings).toLocaleString()}`
									: "₱0",
						},
						monthlyBreakdown: months.map((month, idx) => ({
							month,
							revenue: `₱${revenueByMonth[idx].toLocaleString()}`,
						})),
					}
					break

				case "complete":
					reportTitle = "Host_Complete_Report"
					reportData = {
						generatedAt: new Date().toISOString(),
						hostInfo: {
							name: displayName,
							email: userEmail,
						},
						overview: {
							totalProperties: stats.totalProperties,
							totalBookings: stats.totalBookings,
							totalRevenue: `₱${stats.totalRevenue.toLocaleString()}`,
							averageRating: stats.avgRating,
							totalReviews: totalReviews,
							walletBalance: `₱${walletBalance.toLocaleString()}`,
						},
						properties: {
							summary: {
								total: stats.totalProperties,
								homes: filteredProperties.filter((p) => p.category === "home").length,
								services: filteredProperties.filter((p) => p.category === "service").length,
								experiences: filteredProperties.filter(
									(p) => p.category === "experience"
								).length,
							},
							list: filteredProperties.slice(0, 20).map((p) => ({
								title: p.title || "Untitled",
								category: p.category || "N/A",
								type: getPropertyTypeName(p),
								rating: p.rating || 0,
								reviews: p.reviewsCount || 0,
								price: formatPrice(
									p.pricing?.basePrice || p.pricing?.price || 0,
									p.pricing?.currency
								),
							})),
						},
						bookings: {
							summary: {
								total: stats.totalBookings,
								today: todayBookings.length,
								upcoming: upcomingBookings.length,
								previous: previousBookings.length,
							},
							recent: bookingsList.previous
								.concat(bookingsList.today, bookingsList.upcoming)
								.slice(0, 20)
								.map((b) => ({
									property: b.propertyTitle || "N/A",
									guest: b.guestName || "N/A",
									checkIn: formatDate(b.checkInDate),
									status: b.status || "pending",
									total: `₱${(b.pricing?.total || 0).toLocaleString()}`,
								})),
						},
					}
					break
			}

			// Define styles
			const styles = StyleSheet.create({
				page: {
					padding: 30,
					fontSize: 11,
					fontFamily: "Helvetica",
				},
				header: {
					fontSize: 24,
					marginBottom: 10,
					color: "#61BF9C",
					fontFamily: "Helvetica-Bold",
				},
				subtitle: {
					fontSize: 10,
					marginBottom: 20,
					color: "#666",
				},
				section: {
					marginBottom: 15,
				},
				sectionTitle: {
					fontSize: 16,
					marginBottom: 10,
					color: "#D9C36F",
					fontFamily: "Helvetica-Bold",
				},
				summaryGrid: {
					flexDirection: "row",
					flexWrap: "wrap",
					marginBottom: 15,
				},
				summaryItem: {
					width: "48%",
					marginBottom: 8,
					padding: 8,
					backgroundColor: "#f8f9fa",
					borderLeftWidth: 3,
					borderLeftColor: "#61BF9C",
				},
				summaryLabel: {
					fontSize: 9,
					color: "#666",
					marginBottom: 3,
				},
				summaryValue: {
					fontSize: 12,
					color: "#415f94",
					fontFamily: "Helvetica-Bold",
				},
				table: {
					marginTop: 10,
				},
				tableRow: {
					flexDirection: "row",
					borderBottomWidth: 1,
					borderBottomColor: "#e0e0e0",
					minHeight: 30,
					alignItems: "center",
				},
				tableHeader: {
					backgroundColor: "#61BF9C",
					color: "#fff",
					fontFamily: "Helvetica-Bold",
				},
				tableCell: {
					padding: 8,
					fontSize: 9,
				},
			})

			// Create PDF Document
			const PDFDocument = (
				<Document>
					<Page size="A4" style={styles.page}>
						<Text style={styles.header}>{reportTitle.replace(/_/g, " ")}</Text>
						<Text style={styles.subtitle}>
							Generated: {new Date().toLocaleDateString()}{" "}
							{new Date().toLocaleTimeString()}
						</Text>

						{reportType === "complete" && reportData.hostInfo && (
							<View style={styles.section}>
								<Text style={styles.sectionTitle}>Host Information</Text>
								<Text style={styles.summaryLabel}>Name: {reportData.hostInfo.name}</Text>
								<Text style={styles.summaryLabel}>Email: {reportData.hostInfo.email}</Text>
							</View>
						)}

						{reportData.summary && (
							<View style={styles.section}>
								<Text style={styles.sectionTitle}>Summary</Text>
								<View style={styles.summaryGrid}>
									{Object.entries(reportData.summary).map(([key, value]) => {
										const label = key.replace(/([A-Z])/g, " $1").trim()
										const displayLabel =
											label.charAt(0).toUpperCase() + label.slice(1)
										return (
											<View key={key} style={styles.summaryItem}>
												<Text style={styles.summaryLabel}>{displayLabel}:</Text>
												<Text style={styles.summaryValue}>{value}</Text>
											</View>
										)
									})}
								</View>
							</View>
						)}

						{reportType === "complete" && reportData.overview && (
							<View style={styles.section}>
								<Text style={styles.sectionTitle}>Overview</Text>
								<View style={styles.summaryGrid}>
									{Object.entries(reportData.overview).map(([key, value]) => {
										const label = key.replace(/([A-Z])/g, " $1").trim()
										const displayLabel =
											label.charAt(0).toUpperCase() + label.slice(1)
										return (
											<View key={key} style={styles.summaryItem}>
												<Text style={styles.summaryLabel}>{displayLabel}:</Text>
												<Text style={styles.summaryValue}>{value}</Text>
											</View>
										)
									})}
								</View>
							</View>
						)}

						{reportData.properties && (
							<View style={styles.section} break>
								<Text style={styles.sectionTitle}>
									Properties ({reportData.properties.list.length})
								</Text>
								<View style={styles.table}>
									<View style={[styles.tableRow, styles.tableHeader]}>
										<Text style={[styles.tableCell, { width: "40%" }]}>Title</Text>
										<Text style={[styles.tableCell, { width: "20%" }]}>Category</Text>
										<Text style={[styles.tableCell, { width: "15%" }]}>Rating</Text>
										<Text style={[styles.tableCell, { width: "25%" }]}>Price</Text>
									</View>
									{reportData.properties.list.map((prop, idx) => (
										<View key={idx} style={styles.tableRow}>
											<Text style={[styles.tableCell, { width: "40%" }]}>
												{prop.title}
											</Text>
											<Text style={[styles.tableCell, { width: "20%" }]}>
												{prop.category}
											</Text>
											<Text style={[styles.tableCell, { width: "15%" }]}>
												{prop.rating}
											</Text>
											<Text style={[styles.tableCell, { width: "25%" }]}>
												{prop.price}
											</Text>
										</View>
									))}
								</View>
							</View>
						)}

						{reportData.bookings && (
							<View style={styles.section} break>
								<Text style={styles.sectionTitle}>
									Bookings ({reportData.bookings.recent.length})
								</Text>
								<View style={styles.table}>
									<View style={[styles.tableRow, styles.tableHeader]}>
										<Text style={[styles.tableCell, { width: "30%" }]}>Property</Text>
										<Text style={[styles.tableCell, { width: "25%" }]}>Guest</Text>
										<Text style={[styles.tableCell, { width: "20%" }]}>Check-in</Text>
										<Text style={[styles.tableCell, { width: "15%" }]}>Status</Text>
										<Text style={[styles.tableCell, { width: "10%" }]}>Amount</Text>
									</View>
									{reportData.bookings.recent.map((booking, idx) => (
										<View key={idx} style={styles.tableRow}>
											<Text style={[styles.tableCell, { width: "30%" }]}>
												{booking.property}
											</Text>
											<Text style={[styles.tableCell, { width: "25%" }]}>
												{booking.guest}
											</Text>
											<Text style={[styles.tableCell, { width: "20%" }]}>
												{booking.checkIn}
											</Text>
											<Text style={[styles.tableCell, { width: "15%" }]}>
												{booking.status}
											</Text>
											<Text style={[styles.tableCell, { width: "10%" }]}>
												{booking.total}
											</Text>
										</View>
									))}
								</View>
							</View>
						)}

						{reportType === "properties" && reportData.properties && (
							<View style={styles.section}>
								<Text style={styles.sectionTitle}>Properties List</Text>
								<View style={styles.table}>
									<View style={[styles.tableRow, styles.tableHeader]}>
										<Text style={[styles.tableCell, { width: "30%" }]}>Title</Text>
										<Text style={[styles.tableCell, { width: "20%" }]}>Category</Text>
										<Text style={[styles.tableCell, { width: "15%" }]}>Rating</Text>
										<Text style={[styles.tableCell, { width: "20%" }]}>Price</Text>
										<Text style={[styles.tableCell, { width: "15%" }]}>Status</Text>
									</View>
									{reportData.properties.map((prop, idx) => (
										<View key={idx} style={styles.tableRow}>
											<Text style={[styles.tableCell, { width: "30%" }]}>
												{prop.title}
											</Text>
											<Text style={[styles.tableCell, { width: "20%" }]}>
												{prop.category}
											</Text>
											<Text style={[styles.tableCell, { width: "15%" }]}>
												{prop.rating}
											</Text>
											<Text style={[styles.tableCell, { width: "20%" }]}>
												{prop.price}
											</Text>
											<Text style={[styles.tableCell, { width: "15%" }]}>
												{prop.status}
											</Text>
										</View>
									))}
								</View>
							</View>
						)}

						{reportType === "bookings" && reportData.bookings && (
							<View style={styles.section}>
								<Text style={styles.sectionTitle}>Bookings List</Text>
								<View style={styles.table}>
									<View style={[styles.tableRow, styles.tableHeader]}>
										<Text style={[styles.tableCell, { width: "25%" }]}>Property</Text>
										<Text style={[styles.tableCell, { width: "20%" }]}>Guest</Text>
										<Text style={[styles.tableCell, { width: "18%" }]}>Check-in</Text>
										<Text style={[styles.tableCell, { width: "18%" }]}>Check-out</Text>
										<Text style={[styles.tableCell, { width: "12%" }]}>Status</Text>
										<Text style={[styles.tableCell, { width: "7%" }]}>Total</Text>
									</View>
									{reportData.bookings.map((booking, idx) => (
										<View key={idx} style={styles.tableRow}>
											<Text style={[styles.tableCell, { width: "25%" }]}>
												{booking.property}
											</Text>
											<Text style={[styles.tableCell, { width: "20%" }]}>
												{booking.guest}
											</Text>
											<Text style={[styles.tableCell, { width: "18%" }]}>
												{booking.checkIn}
											</Text>
											<Text style={[styles.tableCell, { width: "18%" }]}>
												{booking.checkOut}
											</Text>
											<Text style={[styles.tableCell, { width: "12%" }]}>
												{booking.status}
											</Text>
											<Text style={[styles.tableCell, { width: "7%" }]}>
												{booking.total}
											</Text>
										</View>
									))}
								</View>
							</View>
						)}

						{reportType === "revenue" && reportData.monthlyBreakdown && (
							<View style={styles.section}>
								<Text style={styles.sectionTitle}>Monthly Revenue Breakdown</Text>
								<View style={styles.table}>
									<View style={[styles.tableRow, styles.tableHeader]}>
										<Text style={[styles.tableCell, { width: "50%" }]}>Month</Text>
										<Text style={[styles.tableCell, { width: "50%" }]}>Revenue</Text>
									</View>
									{reportData.monthlyBreakdown.map((item, idx) => (
										<View key={idx} style={styles.tableRow}>
											<Text style={[styles.tableCell, { width: "50%" }]}>
												{item.month}
											</Text>
											<Text style={[styles.tableCell, { width: "50%" }]}>
												{item.revenue}
											</Text>
										</View>
									))}
								</View>
							</View>
						)}
					</Page>
				</Document>
			)

			// Generate PDF blob
			const blob = await pdf(PDFDocument).toBlob()

			// Create download link
			const url = URL.createObjectURL(blob)
			const link = document.createElement("a")
			link.href = url
			const timestamp = Date.now()
			link.download = `${reportTitle}_${timestamp}.pdf`
			document.body.appendChild(link)
			link.click()
			document.body.removeChild(link)
			URL.revokeObjectURL(url)

			toast.success(`📄 ${reportTitle.replace(/_/g, " ")} exported as PDF!`)
		} catch (err) {
			console.error("Error generating PDF report:", err)
			toast.error(
				"Failed to generate PDF report. Make sure @react-pdf/renderer is installed."
			)
		} finally {
			setIsGeneratingReport(false)
		}
	}

	if (loading) {
		return (
			<div className="host-loading-wrapper">
				<div className="host-loading-spinner"></div>
				<p>Loading dashboard...</p>
			</div>
		)
	}

	return (
		<div className="host-dashboard-wrapper">
			{/* Header */}
			<header className="host-dashboard-header">
				<div className="host-header-inner">
					<div className="host-dashboard-title">
						<img src={logoPlain} alt="AuraStays" />
						<span className="logo-text">AuraStays</span>
					</div>
					<div className="host-user-info">
						<span className="host-user-name">{displayName.split(" ")[0]}</span>
						{userSubscription && (
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
							{unreadNotifications > 0 && (
								<span className="host-badge">{unreadNotifications}</span>
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
									<button
										className="dropdown-item"
										onClick={() => {
											navigate("/wishlist/new")
											setIsMenuOpen(false)
										}}
									>
										<FaBookmark />
										<span>Wishlist</span>
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
				{/* Section 1: Welcoming Title and Quick Actions */}
				<div className="hero-section">
					<h1>Welcome back, {displayName.split(" ")[0]}! 👋</h1>
					<p>Manage your properties and bookings</p>

					{/* Quick Actions */}
					<div className="quick-actions">
						<button className="action-btn" onClick={() => navigate("/host/bookings")}>
							<FaCalendarAlt />
							<span>Calendar</span>
						</button>
						<button className="action-btn" onClick={() => navigate("/host/points")}>
							<FaStar />
							<span>Points</span>
						</button>
						<button
							className="action-btn promo-btn"
							onClick={() => setShowPromosModal(true)}
						>
							<FaGift />
							<span>Coupons</span>
						</button>
					</div>
				</div>

				{/* Section 2: Quick Stats */}
				<div className="quick-stats">
					<div
						className="stat-card clickable-stat-card"
						onClick={() => handleShowBookings("previous")}
						style={{ cursor: "pointer" }}
					>
						<div className="stat-icon">📋</div>
						<div className="stat-info">
							<div className="stat-number">{previousBookings.length}</div>
							<div className="quick-stat-label">Previous Bookings</div>
						</div>
					</div>
					<div
						className="stat-card clickable-stat-card"
						onClick={() => handleShowBookings("today")}
						style={{ cursor: "pointer" }}
					>
						<div className="stat-icon">📅</div>
						<div className="stat-info">
							<div className="stat-number">{todayBookings.length}</div>
							<div className="quick-stat-label">Today's Bookings</div>
						</div>
					</div>
					<div
						className="stat-card clickable-stat-card"
						onClick={() => handleShowBookings("upcoming")}
						style={{ cursor: "pointer" }}
					>
						<div className="stat-icon">✈️</div>
						<div className="stat-info">
							<div className="stat-number">{upcomingBookings.length}</div>
							<div className="quick-stat-label">Upcoming Bookings</div>
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
								₱{walletBalance.toLocaleString()}
							</div>
							<div className="quick-stat-label">E-Wallet</div>
						</div>
					</div>
				</div>

				{/* Section 3: Categorization */}
				<section className="categories-section">
					<h2>Your Properties</h2>
					<p className="section-subtitle">
						Manage and view your listings by category
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
								activeCategory === "service" ? "active" : ""
							}`}
							onClick={() => handleCategoryChange("service")}
						>
							<span className="tab-icon">🛎️</span>
							<span className="tab-label">Services</span>
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
					</div>

					{/* Category Content */}
					<div className="category-content">
						{loading ? (
							<div className="loading-container">
								<div className="loading-spinner"></div>
								<p>Loading properties...</p>
							</div>
						) : filteredProperties.length === 0 ? (
							<div className="no-results">
								<p>No properties found in this category</p>
								<div className="no-results-actions">
									<button
										className="category-create-btn"
										onClick={() => navigate(`/host/list-property?category=${activeCategory}`)}
									>
										<FaHome />
										<span>Create {activeCategory === "home" ? "Home" : activeCategory === "service" ? "Service" : "Experience"}</span>
									</button>
									<button
										className="category-drafts-btn"
										onClick={() => {
											setDraftsCategoryFilter(activeCategory)
											setShowDraftsModal(true)
										}}
									>
										<FaFileAlt />
										<span>Drafts ({drafts.filter(d => d.formData?.category === activeCategory).length})</span>
									</button>
								</div>
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
															{property.rating || "N/A"}
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
																{property.capacity.beds || 0} beds
															</span>
														</div>
														<div className="detail-item">
															<span className="listing-icon">🛁</span>
															<span className="detail-text">
																{property.capacity.bathrooms || 0} bath
															</span>
														</div>
														<div className="detail-item">
															<span className="listing-icon">👥</span>
															<span className="detail-text">
																{property.capacity.guests || 0} guests
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
																	{property.capacity?.minGuests || 0}-
																	{property.capacity?.maxGuests || 0} guests
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
																{property.location?.serviceable
																	? "Multiple Locations"
																	: property.location?.city || "Location"}
															</span>
														</div>
													</div>
												)}

												<div className="listing-footer">
													<div className="listing-price">
														<span className="listing-price-amount">
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
											onClick={() => {
												// Could navigate to a dedicated properties page later
												toast.info(`Showing ${filteredProperties.length} properties in this category`)
											}}
										>
											View All {filteredProperties.length} Properties
										</button>
									</div>
								)}
							</>
						)}
					</div>
				</section>

				{/* Section 4: Statistics & Charts */}
				{hasPremium() ? (
					<section className="host-stats-section">
						<h2>📊 Statistics & Analytics</h2>
						<p className="section-subtitle">
							Track your performance and growth over time
						</p>

					<div className="host-stats-charts-grid">
						{/* Monthly Revenue Chart */}
						<div className="host-chart-card">
							<h3>💵 Monthly Revenue</h3>
							{chartData.monthlyRevenue ? (
								<Line
									data={chartData.monthlyRevenue}
									options={{
										responsive: true,
										maintainAspectRatio: true,
										aspectRatio: 2,
										plugins: {
											legend: {
												display: false,
											},
											tooltip: {
												callbacks: {
													label: function (context) {
														return `₱${context.parsed.y.toLocaleString()}`
													},
												},
											},
										},
										scales: {
											y: {
												beginAtZero: true,
												ticks: {
													callback: function (value) {
														return "₱" + value.toLocaleString()
													},
												},
											},
										},
									}}
								/>
							) : (
								<div className="chart-placeholder">Loading chart data...</div>
							)}
						</div>

						{/* Total Revenue Chart */}
						<div className="host-chart-card">
							<h3>💰 Total Revenue</h3>
							<div className="host-revenue-stats">
								<div className="host-revenue-total">
									<span className="revenue-label">This Year</span>
									<span className="revenue-amount">
										₱{stats.totalRevenue.toLocaleString()}
									</span>
								</div>
							</div>
							{chartData.totalRevenue ? (
								<Doughnut
									data={chartData.totalRevenue}
									options={{
										responsive: true,
										maintainAspectRatio: true,
										aspectRatio: 2,
										plugins: {
											legend: {
												position: "bottom",
											},
											tooltip: {
												callbacks: {
													label: function (context) {
														return `${context.label}: ₱${context.parsed.toLocaleString()}`
													},
												},
											},
										},
									}}
								/>
							) : (
								<div className="chart-placeholder">Loading chart data...</div>
							)}
						</div>

						{/* Total Bookings Chart */}
						<div className="host-chart-card">
							<h3>📅 Total Bookings</h3>
							<div className="host-stat-number-large">{stats.totalBookings}</div>
							{chartData.bookings ? (
								<Bar
									data={chartData.bookings}
									options={{
										responsive: true,
										maintainAspectRatio: true,
										aspectRatio: 2,
										plugins: {
											legend: {
												display: false,
											},
										},
										scales: {
											y: {
												beginAtZero: true,
												ticks: {
													stepSize: 1,
												},
											},
										},
									}}
								/>
							) : (
								<div className="chart-placeholder">Loading chart data...</div>
							)}
						</div>

						{/* Total Reviews Chart */}
						<div className="host-chart-card">
							<h3>⭐ Total Reviews</h3>
							<div className="host-stat-number-large">{totalReviews}</div>
							{chartData.reviews ? (
								<Bar
									data={chartData.reviews}
									options={{
										responsive: true,
										maintainAspectRatio: true,
										aspectRatio: 2,
										plugins: {
											legend: {
												display: false,
											},
										},
										scales: {
											y: {
												beginAtZero: true,
												ticks: {
													stepSize: 1,
												},
											},
										},
									}}
								/>
							) : (
								<div className="chart-placeholder">Loading chart data...</div>
							)}
						</div>
					</div>
				</section>
				) : (
					<section className="host-stats-section premium-locked-section">
						<div className="premium-locked-overlay" onClick={() => checkPremiumAccess("Statistics & Analytics")}>
							<FaCrown className="premium-lock-icon" />
							<h2>📊 Statistics & Analytics</h2>
							<p className="premium-lock-message">
								Upgrade to Premium to unlock advanced analytics and insights
							</p>
							<button
								className="premium-unlock-btn"
								onClick={() => checkPremiumAccess("Statistics & Analytics")}
							>
								<FaCrown /> Upgrade to Premium
							</button>
						</div>
					</section>
				)}

				{/* Section 5: Report Generation */}
				{hasPremium() ? (
					<section className="host-reports-section">
						<h2>📄 Generate Reports</h2>
						<p className="section-subtitle">
							Export your host data and analytics as PDF reports
						</p>

					<div className="host-reports-grid">
						<div className="host-report-card">
							<div className="report-icon">🏠</div>
							<h3>Properties Report</h3>
							<p>
								Complete list of your properties with ratings, reviews, and pricing
								information
							</p>
							<div className="report-stats">
								<div className="stat">
									<span className="stat-value">{stats.totalProperties}</span>
									<span className="stat-label">Total Properties</span>
								</div>
								<div className="stat">
									<span className="stat-value">{stats.avgRating}</span>
									<span className="stat-label">Avg Rating</span>
								</div>
							</div>
							<button
								className="generate-report-btn"
								onClick={() => generateHostReport("properties")}
								disabled={isGeneratingReport}
							>
								{isGeneratingReport ? "⏳ Generating..." : "📊 Generate Properties Report"}
							</button>
						</div>

						<div className="host-report-card">
							<div className="report-icon">📅</div>
							<h3>Bookings Report</h3>
							<p>
								Detailed booking history with guest information, dates, status, and
								amounts
							</p>
							<div className="report-stats">
								<div className="stat">
									<span className="stat-value">{stats.totalBookings}</span>
									<span className="stat-label">Total Bookings</span>
								</div>
								<div className="stat">
									<span className="stat-value">{upcomingBookings.length}</span>
									<span className="stat-label">Upcoming</span>
								</div>
							</div>
							<button
								className="generate-report-btn"
								onClick={() => generateHostReport("bookings")}
								disabled={isGeneratingReport}
							>
								{isGeneratingReport ? "⏳ Generating..." : "📊 Generate Bookings Report"}
							</button>
						</div>

						<div className="host-report-card">
							<div className="report-icon">💰</div>
							<h3>Revenue Report</h3>
							<p>
								Financial overview with revenue trends and monthly breakdown
							</p>
							<div className="report-stats">
								<div className="stat">
									<span className="stat-value">
										₱{stats.totalRevenue.toLocaleString()}
									</span>
									<span className="stat-label">Total Revenue</span>
								</div>
								<div className="stat">
									<span className="stat-value">
										₱{stats.monthlyRevenue.toLocaleString()}
									</span>
									<span className="stat-label">This Month</span>
								</div>
							</div>
							<button
								className="generate-report-btn"
								onClick={() => generateHostReport("revenue")}
								disabled={isGeneratingReport}
							>
								{isGeneratingReport ? "⏳ Generating..." : "📊 Generate Revenue Report"}
							</button>
						</div>

						<div className="host-report-card featured">
							<div className="report-icon">📑</div>
							<h3>Complete Host Report</h3>
							<p>
								Generate a comprehensive report with all your properties, bookings,
								revenue, and analytics in one document
							</p>
							<div className="report-stats full-width">
								<p className="report-description">
									Includes properties overview, bookings summary, revenue breakdown,
									and performance metrics
								</p>
							</div>
							<button
								className="generate-report-btn primary"
								onClick={() => generateHostReport("complete")}
								disabled={isGeneratingReport}
							>
								{isGeneratingReport
									? "⏳ Generating..."
									: "📊 Generate Complete Report"}
							</button>
						</div>
					</div>
				</section>
				) : (
					<section className="host-reports-section premium-locked-section">
						<div className="premium-locked-overlay" onClick={() => checkPremiumAccess("Report Generation")}>
							<FaCrown className="premium-lock-icon" />
							<h2>📄 Generate Reports</h2>
							<p className="premium-lock-message">
								Upgrade to Premium to generate comprehensive PDF reports
							</p>
							<button
								className="premium-unlock-btn"
								onClick={() => checkPremiumAccess("Report Generation")}
							>
								<FaCrown /> Upgrade to Premium
							</button>
						</div>
					</section>
				)}
			</main>

			{/* Drafts Modal */}
			{showDraftsModal && (
				<div className="host-modal-overlay" onClick={() => {
					setShowDraftsModal(false)
					setDraftsCategoryFilter(null)
				}}>
					<div className="host-modal-content" onClick={(e) => e.stopPropagation()}>
						<div className="host-modal-header">
							<h2>Saved Drafts{draftsCategoryFilter ? ` - ${draftsCategoryFilter === "home" ? "Homes" : draftsCategoryFilter === "service" ? "Services" : "Experiences"}` : ""}</h2>
							<button
								className="host-modal-close"
								onClick={() => {
									setShowDraftsModal(false)
									setDraftsCategoryFilter(null)
								}}
							>
								×
							</button>
						</div>
					<div className="host-drafts-list">
						{draftsCategoryFilter && (
							<div className="host-drafts-filter-info">
								<p>Showing drafts for: <strong>{draftsCategoryFilter === "home" ? "Homes" : draftsCategoryFilter === "service" ? "Services" : "Experiences"}</strong></p>
								<button
									className="host-clear-filter-btn"
									onClick={() => setDraftsCategoryFilter(null)}
								>
									Show All
								</button>
							</div>
						)}
						{(() => {
							const filteredDrafts = draftsCategoryFilter
								? drafts.filter((d) => d.formData?.category === draftsCategoryFilter)
								: drafts
							
							return filteredDrafts.length > 0 ? (
								filteredDrafts.map((draft) => (
									<div key={draft.id} className="host-draft-item">
										<div className="host-draft-info">
											<h4>
												{draft.formData?.title || "Untitled Property"}
											</h4>
											<p className="host-draft-meta">
												{draft.formData?.category
													? draft.formData.category.charAt(0).toUpperCase() +
													  draft.formData.category.slice(1)
													: "Draft"} • Step {draft.currentStep || 1} of 6
											</p>
											<p className="host-draft-date">
												Last updated:{" "}
												{draft.updatedAt?.toDate
													? draft.updatedAt.toDate().toLocaleDateString()
													: "Recently"}
											</p>
										</div>
										<div className="host-draft-actions">
											<button
												className="host-draft-edit-button"
												onClick={() => handleEditDraft(draft.id)}
											>
												<FaEdit /> Edit
											</button>
											<button
												className="host-draft-delete-button"
												onClick={() => handleDeleteDraft(draft.id)}
												disabled={deletingDraft === draft.id}
											>
												<FaTrash />
											</button>
										</div>
									</div>
								))
							) : (
								<div className="host-empty-message">
									<FaFileAlt className="empty-icon" />
									<p>
										{draftsCategoryFilter
											? `No saved drafts for ${draftsCategoryFilter === "home" ? "Homes" : draftsCategoryFilter === "service" ? "Services" : "Experiences"}`
											: "No saved drafts"}
									</p>
									<button
										className="host-create-draft-button"
										onClick={() => {
											setShowDraftsModal(false)
											navigate(
												draftsCategoryFilter
													? `/host/list-property?category=${draftsCategoryFilter}`
													: "/host/list-property"
											)
										}}
									>
										Create New Listing
									</button>
								</div>
							)
						})()}
						</div>
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
									? "✈️ Upcoming Bookings"
									: bookingsModalType === "today"
									? "📅 Today's Bookings"
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
							{bookingsList[bookingsModalType]?.length === 0 ? (
								<div className="empty-bookings">
									<FaCalendarAlt className="empty-icon" />
									<p>
										{bookingsModalType === "upcoming"
											? "No upcoming bookings"
											: bookingsModalType === "today"
											? "No bookings for today"
											: "No previous bookings"}
									</p>
								</div>
							) : (
								<div className="bookings-grid">
									{bookingsList[bookingsModalType]?.map((booking) => (
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
												<span className={`booking-status-badge ${booking.status}`}>
													{booking.status}
												</span>
											</div>
											<div className="booking-info">
												<h3 className="booking-title">
													{booking.propertyTitle || "Property"}
												</h3>
												<div className="booking-dates">
													<FaCalendarAlt />
													<span>
														{formatDate(booking.checkInDate)} - {formatDate(booking.checkOutDate)}
													</span>
												</div>
												<div className="booking-stats">
													<span>
														👥 {booking.numberOfGuests || booking.guests || 1} guest
														{(booking.numberOfGuests || booking.guests || 1) > 1 ? "s" : ""}
													</span>
													{booking.numberOfNights && (
														<span>
															🌙 {booking.numberOfNights} night
															{booking.numberOfNights > 1 ? "s" : ""}
														</span>
													)}
												</div>
												<div className="booking-price">
													<span>Total:</span>
													<strong>
														₱{booking.pricing?.total?.toLocaleString() || 0}
													</strong>
												</div>
												{booking.guestName && (
													<div className="booking-guest">
														<FaUsers /> Guest: {booking.guestName}
													</div>
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
			{showPromosModal && (
				<Promos
					isOpen={showPromosModal}
					onClose={() => setShowPromosModal(false)}
					userId={currentUser?.uid || null}
				/>
			)}

			{/* Premium Feature Modal */}
			{showPremiumModal && (
				<div
					className="modal-overlay premium-modal-overlay"
					onClick={() => setShowPremiumModal(false)}
				>
					<div
						className="modal-content premium-modal-content"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="premium-modal-header">
							<FaCrown className="premium-crown-icon" />
							<h2>Premium Feature</h2>
							<button
								className="close-modal-btn"
								onClick={() => setShowPremiumModal(false)}
							>
								×
							</button>
						</div>
						<div className="premium-modal-body">
							<p className="premium-feature-name">
								"{premiumFeatureName}" is a Premium feature
							</p>
							<p className="premium-description">
								Upgrade to Premium plan to unlock:
							</p>
							<ul className="premium-features-list">
								<li>✅ Unlimited property listings</li>
								<li>✅ Premium analytics dashboard</li>
								<li>✅ Advanced report generation</li>
								<li>✅ 24/7 priority support</li>
								<li>✅ Advanced marketing tools</li>
								<li>✅ Custom branding options</li>
								<li>✅ API access</li>
								<li>✅ Performance insights</li>
							</ul>
							<div className="premium-modal-actions">
								<button
									className="premium-subscribe-btn"
									onClick={() => {
										setShowPremiumModal(false)
										navigate("/host/subscription")
									}}
								>
									<FaCrown /> Upgrade to Premium - ₱999/month
								</button>
								<button
									className="premium-cancel-btn"
									onClick={() => setShowPremiumModal(false)}
								>
									Maybe Later
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
