import { useAuth } from "../contexts/AuthContext"
import { useEffect, useState, useRef, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { auth, db } from "../components/firebaseConfig"
import {
	collection,
	getDocs,
	updateDoc,
	doc,
	setDoc,
	addDoc,
	deleteDoc,
	query,
	where,
	limit,
	serverTimestamp,
	orderBy,
} from "firebase/firestore"
import { toast } from "react-stacked-toast"
import { FaCalendarAlt, FaTimes } from "react-icons/fa"
import housePlaceholder from "../assets/housePlaceholder.png"
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
import jsPDF from "jspdf"
import "../css/AdminDashboard.css"

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

// Component to show tooltip only when text is truncated
const DescriptionWithTooltip = ({ text }) => {
	const textRef = useRef(null)
	const [showTooltip, setShowTooltip] = useState(false)
	const [isTruncated, setIsTruncated] = useState(false)

	useEffect(() => {
		const checkTruncation = () => {
			if (textRef.current) {
				const isOverflowing =
					textRef.current.scrollWidth > textRef.current.clientWidth
				setIsTruncated(isOverflowing)
			}
		}

		checkTruncation()
		window.addEventListener("resize", checkTruncation)
		return () => window.removeEventListener("resize", checkTruncation)
	}, [text])

	return (
		<div
			className="promo-description-wrapper"
			onMouseEnter={() => isTruncated && setShowTooltip(true)}
			onMouseLeave={() => setShowTooltip(false)}
		>
			<span ref={textRef} className="promo-description-text">
				{text}
			</span>
			{showTooltip && isTruncated && (
				<div className="promo-description-tooltip">{text}</div>
			)}
		</div>
	)
}

const AdminDashboard = () => {
	const { currentUser, userData } = useAuth()
	const navigate = useNavigate()
	const [stats, setStats] = useState({
		totalUsers: 0,
		totalHosts: 0,
		totalGuests: 0,
		totalProperties: 0,
		totalBookings: 0,
		totalRevenue: 0,
	})
	const [recentBookings, setRecentBookings] = useState([])
	const [bestReviews, setBestReviews] = useState([])
	const [lowestReviews, setLowestReviews] = useState([])
	const [hosts, setHosts] = useState([])
	const [selectedHost, setSelectedHost] = useState(null)
	const [showHostModal, setShowHostModal] = useState(false)
	const [loading, setLoading] = useState(true)
	const [chartData, setChartData] = useState({
		bookings: null,
		revenue: null,
		propertyTypes: null,
	})
	const [activeTab, setActiveTab] = useState("dashboard")
	const [activePolicySubTab, setActivePolicySubTab] = useState("policies")
	const [activeReportTab, setActiveReportTab] = useState("users")
	const [allUsersData, setAllUsersData] = useState([])
	const [allPropertiesData, setAllPropertiesData] = useState([])
	const [allBookingsData, setAllBookingsData] = useState([])
	
	// Filter states for each report tab
	const [userFilters, setUserFilters] = useState({
		search: "",
		userType: "all", // all, host, guest, admin
	})
	const [propertyFilters, setPropertyFilters] = useState({
		search: "",
		category: "all",
		minRating: "",
		maxRating: "",
	})
	const [bookingFilters, setBookingFilters] = useState({
		search: "",
		status: "all", // all, pending, confirmed, completed, cancelled
		minAmount: "",
		maxAmount: "",
	})
	const [revenueFilters, setRevenueFilters] = useState({
		search: "",
		status: "all",
		minAmount: "",
		maxAmount: "",
	})
	const [policies, setPolicies] = useState({
		serviceFeeHost: 15, // percentage
		serviceFeeGuest: 800, // fixed amount in pesos
		guestFeePerPerson: 100, // fixed amount in pesos per guest
		walletWithdrawalFee: 1, // percentage
		cancellationWindowHours: 48,
		minPropertyRating: 3.0,
		cleaningFee: 500, // fixed amount in pesos (default cleaning fee per property)
		serviceFeePerProperty: 200, // fixed amount in pesos (service fee per property listing)
	})
	const [recentUsers, setRecentUsers] = useState([])
	const [reportModal, setReportModal] = useState({
		isOpen: false,
		type: "",
		data: null,
		title: "",
	})
	const [showPromoWizard, setShowPromoWizard] = useState(false)
	const [promoWizardStep, setPromoWizardStep] = useState(1)
	const [promoFormData, setPromoFormData] = useState({
		code: "",
		description: "",
		discountType: "percentage", // 'percentage' or 'fixed'
		discountValue: 0,
		minPurchase: 0,
		maxDiscount: 0,
		usageLimit: 0,
		usagePerUser: 1,
		validFrom: "",
		validUntil: "",
		isActive: true,
		applicableTo: "all", // 'all', 'properties', 'experiences'
	})
	const [isCreatingPromo, setIsCreatingPromo] = useState(false)
	const [promos, setPromos] = useState([])
	const [promoFilter, setPromoFilter] = useState("all") // 'all', 'active', 'inactive', 'expired', 'scheduled', 'host'
	const [adminUserId, setAdminUserId] = useState(null)
	const [walletBalance, setWalletBalance] = useState(0)
	const [walletTransactions, setWalletTransactions] = useState([])
	const [loadingWallet, setLoadingWallet] = useState(false)
	const [bookingEarnings, setBookingEarnings] = useState({ serviceFee: 0, guestFee: 0, total: 0 })
	const [completedBookings, setCompletedBookings] = useState([])
	const [subscriptions, setSubscriptions] = useState([])
	const [subscriptionRevenue, setSubscriptionRevenue] = useState(0)
	const [sidebarOpen, setSidebarOpen] = useState(true)
	const [adminPaypalEmail, setAdminPaypalEmail] = useState("")
	const [showPaypalModal, setShowPaypalModal] = useState(false)
	const [paypalEmailInput, setPaypalEmailInput] = useState("")
	const [flaggedProperties, setFlaggedProperties] = useState([])
	const [loadingFlagged, setLoadingFlagged] = useState(false)
	const [selectedReport, setSelectedReport] = useState(null)
	const [showReportModal, setShowReportModal] = useState(false)

	// Calendar state for promo validity dates
	const [promoCalendarMonth, setPromoCalendarMonth] = useState(new Date())
	const [selectingValidFrom, setSelectingValidFrom] = useState(true)
	const [showPromoDatePicker, setShowPromoDatePicker] = useState(false)

	useEffect(() => {
		fetchAdminData()
		fetchPlatformPolicies()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	useEffect(() => {
		if (activeTab === "wallet") {
			fetchWalletData()
		} else if (activeTab === "manageHost") {
			fetchHostsData()
		} else if (activeTab === "flagging") {
			fetchFlaggedProperties()
		}
	}, [activeTab])

	// Helper function to handle tab change and close sidebar on mobile
	const handleTabChange = (tab) => {
		setActiveTab(tab)
		// Close sidebar on mobile devices (screen width <= 768px)
		if (window.innerWidth <= 768) {
			setSidebarOpen(false)
		}
	}

	const fetchAdminData = async () => {
		try {
			setLoading(true)

			// Fetch all collections in parallel with error handling
			let usersSnapshot,
				propertiesSnapshot,
				bookingsSnapshot,
				promosSnapshot

			try {
				const results = await Promise.allSettled([
					getDocs(collection(db, "users")),
					getDocs(collection(db, "properties")),
					getDocs(collection(db, "bookings")).catch(() => ({ docs: [] })),
					getDocs(collection(db, "promos")).catch(() => ({ docs: [] })),
				])

				usersSnapshot =
					results[0].status === "fulfilled" ? results[0].value : { docs: [] }
				propertiesSnapshot =
					results[1].status === "fulfilled" ? results[1].value : { docs: [] }
				bookingsSnapshot =
					results[2].status === "fulfilled" ? results[2].value : { docs: [] }
				promosSnapshot =
					results[3].status === "fulfilled" ? results[3].value : { docs: [] }
			} catch (err) {
				console.error("Error fetching collections:", err)
				// Set empty defaults
				usersSnapshot = { docs: [] }
				propertiesSnapshot = { docs: [] }
				bookingsSnapshot = { docs: [] }
				promosSnapshot = { docs: [] }
			}

			// Process users with defaults
			const allUsers = usersSnapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			}))
			const totalUsers = allUsers.length || 0
			const totalHosts =
				allUsers.filter((user) => user.userType === "host").length || 0
			const totalGuests =
				allUsers.filter((user) => user.userType === "guest").length || 0
			
			// Get admin user ID for filtering host-created promos
			const adminUser = allUsers.find(
				(user) => user.email === "adminAurastays@aurastays.com" || user.userType === "admin"
			)
			if (adminUser) {
				setAdminUserId(adminUser.id)
			}

			// Get recent users (last 10)
			const sortedUsers = [...allUsers].sort((a, b) => {
				const dateA = a.createdAt?.toDate?.() || new Date(0)
				const dateB = b.createdAt?.toDate?.() || new Date(0)
				return dateB - dateA
			})
			setRecentUsers(sortedUsers.slice(0, 10))
			// Store all users data for reports table
			setAllUsersData(allUsers)

			// Process properties with defaults
			const allProperties = propertiesSnapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			}))
			const totalProperties = allProperties.length || 0

			// Sort properties by rating for best/lowest reviews
			if (allProperties.length > 0) {
				const sortedByRating = [...allProperties].sort(
					(a, b) => (b.rating || 0) - (a.rating || 0)
				)
				setBestReviews(sortedByRating.slice(0, 5))
				setLowestReviews(sortedByRating.slice(-5).reverse())
			} else {
				setBestReviews([])
				setLowestReviews([])
			}
			// Store all properties data for reports table
			setAllPropertiesData(allProperties)

			// Process bookings with defaults
			const allBookings = bookingsSnapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			}))
			const totalBookings = allBookings.length || 0
			
			// Debug: Log all bookings
			console.log("📊 All bookings:", allBookings.length)
			console.log("📊 Sample booking:", allBookings[0])
			
			// Get today's date for comparison
			const today = new Date()
			today.setHours(0, 0, 0, 0)
			
			// Calculate revenue from:
			// 1. Bookings with status "completed"
			// 2. Bookings with status "confirmed" (these are paid and should count as revenue)
			// Exclude cancelled and pending bookings
			const completedBookings = allBookings.filter((booking) => {
				// Exclude cancelled bookings
				if (booking.status === "cancelled") {
					return false
				}
				
				// Exclude pending bookings (not paid yet)
				if (booking.status === "pending") {
					return false
				}
				
				// Include explicitly completed bookings
				if (booking.status === "completed") {
					return true
				}
				
				// Include confirmed bookings (these are paid)
				if (booking.status === "confirmed") {
					return true
				}
				
				return false
			})
			
			console.log("✅ Completed bookings (status=completed or confirmed):", completedBookings.length)
			console.log("✅ Completed bookings data:", completedBookings)
			
			// Debug: Check pricing structure and status
			allBookings.forEach((booking, index) => {
				console.log(`Booking ${index + 1}:`, {
					id: booking.id,
					status: booking.status,
					checkOutDate: booking.checkOutDate,
					pricing: booking.pricing,
					pricingTotal: booking.pricing?.total,
					isCompleted: completedBookings.some(b => b.id === booking.id)
				})
			})
			
			const totalRevenue =
				completedBookings.reduce(
					(sum, booking) => {
						const revenue = booking.pricing?.total || 0
						console.log(`Adding revenue: ${revenue} from booking ${booking.id} (status: ${booking.status})`)
						return sum + revenue
					},
					0
				) || 0
			
			console.log("💰 Total Revenue Calculated:", totalRevenue)
			setRecentBookings(allBookings.slice(0, 10))
			// Store all bookings data for reports table
			setAllBookingsData(allBookings)

			// Process promos
			const allPromos = promosSnapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			}))
			setPromos(allPromos)

			setStats({
				totalUsers: totalUsers || 0,
				totalHosts: totalHosts || 0,
				totalGuests: totalGuests || 0,
				totalProperties: totalProperties || 0,
				totalBookings: totalBookings || 0,
				totalRevenue: totalRevenue || 0,
			})

			// Prepare chart data
			prepareChartData(allBookings, allProperties)
		} catch (error) {
			console.error("Error fetching admin data:", error)
			toast.error("Some data failed to load, showing defaults")

			// Set all defaults on error
			setStats({
				totalUsers: 0,
				totalHosts: 0,
				totalGuests: 0,
				totalProperties: 0,
				totalBookings: 0,
				totalRevenue: 0,
			})
			setBestReviews([])
			setLowestReviews([])
			setRecentBookings([])

			// Prepare empty chart data
			prepareChartData([], [])
		} finally {
			setLoading(false)
		}
	}

	const prepareChartData = (bookings = [], properties = []) => {
		// Bookings trend (last 7 days)
		const last7Days = [...Array(7)].map((_, i) => {
			const date = new Date()
			date.setDate(date.getDate() - (6 - i))
			return date.toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
			})
		})

		const bookingsPerDay = last7Days.map((day) => {
			return (
				bookings.filter((booking) => {
					const bookingDate = booking.createdAt?.toDate?.()
					if (!bookingDate) return false
					return (
						bookingDate?.toLocaleDateString("en-US", {
							month: "short",
							day: "numeric",
						}) === day
					)
				}).length || 0
			)
		})

		// Revenue trend (last 7 days) - from completed and confirmed bookings (exclude cancelled/pending)
		const revenuePerDay = last7Days.map((day) => {
			return (
				bookings
					.filter((booking) => {
						// Exclude cancelled and pending
						if (booking.status === "cancelled" || booking.status === "pending") {
							return false
						}
						
						const bookingDate = booking.createdAt?.toDate?.()
						if (!bookingDate) return false
						
						// Include completed or confirmed bookings
						return (
							(booking.status === "completed" || booking.status === "confirmed") &&
							bookingDate?.toLocaleDateString("en-US", {
								month: "short",
								day: "numeric",
							}) === day
						)
					})
					.reduce((sum, booking) => sum + (booking.pricing?.total || 0), 0) || 0
			)
		})

		// Property types distribution
		const propertyTypes =
			properties.length > 0
				? properties.reduce((acc, property) => {
						const category = property.category || "other"
						acc[category] = (acc[category] || 0) + 1
						return acc
				  }, {})
				: { none: 1 }

		setChartData({
			bookings: {
				labels: last7Days,
				datasets: [
					{
						label: "Bookings",
						data: bookingsPerDay,
						borderColor: "rgb(65, 95, 148)",
						backgroundColor: "rgba(65, 95, 148, 0.1)",
						tension: 0.4,
					},
				],
			},
			revenue: {
				labels: last7Days,
				datasets: [
					{
						label: "Revenue (₱)",
						data: revenuePerDay,
						backgroundColor: "rgba(217, 198, 111, 0.8)",
						borderColor: "rgb(217, 198, 111)",
						borderWidth: 1,
					},
				],
			},
			propertyTypes: {
				labels:
					properties.length > 0
						? Object.keys(propertyTypes).map(
								(key) => key.charAt(0).toUpperCase() + key.slice(1)
						  )
						: ["No Properties"],
				datasets: [
					{
						data: Object.values(propertyTypes),
						backgroundColor: [
							"rgba(65, 95, 148, 0.8)",
							"rgba(217, 198, 111, 0.8)",
							"rgba(97, 191, 156, 0.8)",
							"rgba(255, 99, 132, 0.8)",
						],
						borderWidth: 2,
						borderColor: "#fff",
					},
				],
			},
		})
	}


	const fetchHostsData = async () => {
		try {
			setLoading(true)

			// Fetch all properties
			const propertiesRef = collection(db, "properties")
			const propertiesSnapshot = await getDocs(propertiesRef)
			const properties = propertiesSnapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			}))

			// Group properties by hostId and calculate average ratings
			const hostMap = new Map()

			properties.forEach((property) => {
				const hostId = property.hostId || property.host?.hostId
				if (!hostId) return

				if (!hostMap.has(hostId)) {
					hostMap.set(hostId, {
						hostId,
						properties: [],
						totalRating: 0,
						ratedPropertiesCount: 0,
					})
				}

				const hostData = hostMap.get(hostId)
				hostData.properties.push(property)

				// Only count properties with ratings > 0
				if (property.rating && property.rating > 0) {
					hostData.totalRating += property.rating
					hostData.ratedPropertiesCount += 1
				}
			})

			// Calculate average ratings and fetch user data
			const hostsList = []
			const usersRef = collection(db, "users")
			const subscriptionsRef = collection(db, "subscriptions")

			for (const [hostId, hostData] of hostMap.entries()) {
				const averageRating =
					hostData.ratedPropertiesCount > 0
						? hostData.totalRating / hostData.ratedPropertiesCount
						: 0

				// Fetch user data
				let userData = null
				try {
					const userQuery = query(
						usersRef,
						where("uid", "==", hostId),
						limit(1)
					)
					const userSnapshot = await getDocs(userQuery)
					if (!userSnapshot.empty) {
						userData = {
							id: userSnapshot.docs[0].id,
							...userSnapshot.docs[0].data(),
						}
					}
				} catch (err) {
					console.error(`Error fetching user data for host ${hostId}:`, err)
				}

				// Fetch subscription data
				let subscriptionType = "Free"
				try {
					const subscriptionQuery = query(
						subscriptionsRef,
						where("userId", "==", hostId),
						where("status", "in", ["active", "pending"])
					)
					const subscriptionSnapshot = await getDocs(subscriptionQuery)
					if (!subscriptionSnapshot.empty) {
						const subData = subscriptionSnapshot.docs[0].data()
						if (subData.planId === "premium") {
							subscriptionType = "Premium"
						}
					} else if (userData?.subscription?.planId === "premium") {
						subscriptionType = "Premium"
					}
				} catch (err) {
					console.error(
						`Error fetching subscription data for host ${hostId}:`,
						err
					)
				}

				hostsList.push({
					hostId,
					displayName:
						userData?.displayName ||
						(userData?.firstName && userData?.lastName
							? `${userData.firstName} ${userData.lastName}`
							: userData?.firstName || "Unknown Host"),
					email: userData?.email || "N/A",
					propertiesCount: hostData.properties.length,
					averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
					ratedPropertiesCount: hostData.ratedPropertiesCount,
					properties: hostData.properties,
					userData,
					subscriptionType,
				})
			}

			// Sort by average rating (descending)
			hostsList.sort((a, b) => b.averageRating - a.averageRating)

			setHosts(hostsList)
			setLoading(false)
		} catch (err) {
			console.error("Error fetching hosts data:", err)
			toast.error("Failed to fetch hosts data")
			setLoading(false)
		}
	}

	const handleLogout = async () => {
		try {
			await auth.signOut()
			toast.success("Logged out successfully")
			navigate("/")
		} catch (err) {
			console.error("Error logging out:", err)
			toast.error("Error logging out")
		}
	}

	const handleUpdatePolicies = async () => {
		try {
			// Save to Firebase (creates if doesn't exist, updates if it does)
			await setDoc(doc(db, "settings", "policies"), policies, { merge: true })
			toast.success("✅ Policies updated successfully!")
		} catch (err) {
			console.error("Error updating policies:", err)
			toast.error("❌ Failed to update policies: " + err.message)
		}
	}

	const handleExportAllPolicies = () => {
		try {
			const pdfDoc = new jsPDF()
			let yPosition = 20
			const pageWidth = pdfDoc.internal.pageSize.getWidth()
			const pageHeight = pdfDoc.internal.pageSize.getHeight()
			const margin = 20
			const maxWidth = pageWidth - 2 * margin

			// Helper function to clean text - remove emojis and special characters that cause issues
			const cleanText = (text) => {
				if (!text) return ""
				// Remove emojis and replace currency symbol with PHP
				return text
					.replace(/[\u{1F300}-\u{1F9FF}]/gu, "") // Remove emojis
					.replace(/[\u{1F600}-\u{1F64F}]/gu, "") // Remove emoticons
					.replace(/[\u{1F680}-\u{1F6FF}]/gu, "") // Remove transport symbols
					.replace(/[\u{2600}-\u{26FF}]/gu, "") // Remove misc symbols
					.replace(/[\u{2700}-\u{27BF}]/gu, "") // Remove dingbats
					.replace(/₱/g, "PHP ") // Replace peso sign with PHP
					.replace(/\s+/g, " ") // Replace multiple spaces with single space
					.trim()
			}

			// Helper function to add a new page if needed
			const checkPageBreak = (requiredSpace = 20) => {
				if (yPosition + requiredSpace > pageHeight - margin) {
					pdfDoc.addPage()
					yPosition = 20
					return true
				}
				return false
			}

			// Helper function to add text with word wrap
			const addText = (text, fontSize, isBold = false, color = [0, 0, 0]) => {
				const cleanedText = cleanText(text)
				pdfDoc.setFontSize(fontSize)
				pdfDoc.setTextColor(color[0], color[1], color[2])
				if (isBold) {
					pdfDoc.setFont(undefined, "bold")
				} else {
					pdfDoc.setFont(undefined, "normal")
				}
				const lines = pdfDoc.splitTextToSize(cleanedText, maxWidth)
				lines.forEach((line) => {
					checkPageBreak(10)
					pdfDoc.text(line, margin, yPosition)
					yPosition += 7
				})
			}

			// Helper function to add a section header
			const addSectionHeader = (text, emoji = "") => {
				checkPageBreak(25)
				yPosition += 5
				const headerText = emoji ? `${text}` : text
				addText(headerText, 18, true, [65, 95, 148])
				yPosition += 3
			}

			// Helper function to add a subsection
			const addSubsection = (title, emoji = "") => {
				checkPageBreak(15)
				yPosition += 3
				const subsectionText = emoji ? `${title}` : title
				addText(subsectionText, 14, true, [102, 102, 102])
				yPosition += 2
			}

			// Helper function to add a list
			const addList = (items, isOrdered = false) => {
				items.forEach((item, index) => {
					checkPageBreak(10)
					const prefix = isOrdered ? `${index + 1}. ` : "- "
					addText(`${prefix}${item}`, 10, false, [68, 68, 68])
				})
			}

			// Title Page
			pdfDoc.setFillColor(65, 95, 148)
			pdfDoc.rect(0, 0, pageWidth, 50, "F")
			pdfDoc.setTextColor(255, 255, 255)
			pdfDoc.setFontSize(24)
			pdfDoc.setFont(undefined, "bold")
			pdfDoc.text("AuraStays Policy Management", pageWidth / 2, 25, {
				align: "center",
			})
			pdfDoc.setFontSize(12)
			pdfDoc.setFont(undefined, "normal")
			pdfDoc.text(
				`Generated on ${new Date().toLocaleDateString("en-US", {
					year: "numeric",
					month: "long",
					day: "numeric",
				})}`,
				pageWidth / 2,
				35,
				{ align: "center" }
			)
			yPosition = 60

			// ========== POLICIES & COMPLIANCE SECTION ==========
			addSectionHeader("Policies & Compliance")
			addText(
				"Manage platform policies, service fees, and compliance rules",
				10,
				false,
				[102, 102, 102]
			)
			yPosition += 5

			// Service Fee Structure
			addSubsection("Service Fee Structure")
			addText(`Guest Service Fee: PHP ${policies.serviceFeeGuest}`, 10, true)
			addText("Fixed fee charged to guests on each booking", 9, false, [102, 102, 102])
			yPosition += 2
			addText(
				`Guest Fee (Per Person): PHP ${policies.guestFeePerPerson}`,
				10,
				true
			)
			addText("Additional charge per guest for bookings", 9, false, [102, 102, 102])
			yPosition += 5

			// Property Listing Rules
			addSubsection("Property Listing Rules")
			addText("Listing Requirements", 11, true, [102, 102, 102])
			addList([
				"All properties must have at least 1 high-quality photo",
				"Accurate description with minimum 100 characters",
				"Complete amenities list and house rules",
				"Valid address and location coordinates",
				"Clear pricing structure (base price, cleaning fee, additional fees)",
				"Calendar availability must be updated regularly",
			])
			yPosition += 3
			addText("Property Standards", 11, true, [102, 102, 102])
			addList([
				"Properties must meet basic safety standards",
				"Accurate representation of space and amenities",
				"Must comply with local regulations and laws",
				"No misleading or false information",
			])
			yPosition += 5

			// Subscription Removal Policy
			addSubsection("Subscription Removal Policy")
			addText("Subscription Removal", 11, true, [102, 102, 102])
			addList([
				`Low Rating: Hosts with average rating below ${policies.minPropertyRating} stars for 3 consecutive months`,
				"Violation of Terms: Any breach of community standards or terms of service",
				"Inactive Listings: No calendar updates for 90+ days",
				"Fraudulent Activity: Detected scams, fake listings, or payment fraud",
			])
			yPosition += 3
			addText("Removal Process", 11, true, [102, 102, 102])
			addList(
				[
					"Warning notification sent to host",
					"30-day period to resolve issues",
					"If unresolved, listing is suspended",
					"Host can appeal within 14 days",
					"Final decision made by admin review",
				],
				true
			)
			yPosition += 5

			// Cancellation Rules
			addSubsection("Cancellation Rules")
			addText("Guest Cancellation Policy", 11, true, [102, 102, 102])
			addList([
				`Flexible: Full refund if cancelled ${policies.cancellationWindowHours} hours before check-in`,
				"Strict: No cancellation after book confirming",
				"Service fees are non-refundable in all cases",
			])
			yPosition += 3
			addText("Host Cancellation Policy", 11, true, [102, 102, 102])
			addList([
				"Host cancellations are strongly discouraged",
				"Guest receives full refund including all fees",
			])
			yPosition += 5

			// Platform Rules & Regulations
			addSubsection("Platform Rules & Regulations")
			addText("Host Obligations", 11, true, [102, 102, 102])
			addList([
				"Respond to booking inquiries within 24 hours",
				"Maintain property as described in listing",
				"Provide check-in instructions before arrival",
				"Be available for guest support during stay",
				"Report any property damage or issues immediately",
				"Keep calendar updated and accurate",
			])
			yPosition += 3
			addText("Guest Obligations", 11, true, [102, 102, 102])
			addList([
				"Treat property with respect and care",
				"Follow house rules set by host",
				"Report any issues or damages immediately",
				"Complete booking checkout procedures",
				"Leave honest and constructive reviews",
				"Number of guests must not exceed listing capacity",
			])
			yPosition += 3
			addText("Prohibited Activities", 11, true, [102, 102, 102])
			addList([
				"Off-platform transactions or payments",
				"Discrimination based on race, religion, gender, etc.",
				"Fraudulent listings or misrepresentation",
				"Hosting commercial events without permission",
				"Subletting or unauthorized property use",
				"Harassment or inappropriate behavior",
			])
			yPosition += 5

			// Community Standards
			addSubsection("Community Standards")
			addText("Safety & Security", 11, true, [102, 102, 102])
			addList([
				"All properties must have working smoke detectors",
				"Fire extinguishers required for all listings",
				"Emergency contact information must be provided",
				"Secure entry systems recommended",
				"Report suspicious activity immediately",
			])
			yPosition += 3
			addText("Trust & Verification", 11, true, [102, 102, 102])
			addList([
				"Email verification required for all users",
				"Phone verification recommended",
				"Government ID verification for hosts",
				"Professional photography encouraged",
				"Accurate property descriptions mandatory",
			])
			yPosition += 10

			// ========== TERMS & CONDITIONS SECTION ==========
			addSectionHeader("Terms & Conditions")
			addText("Legal terms governing the use of AuraStays platform", 10, false, [
				102, 102, 102,
			])
			yPosition += 5

			// Terms content (abbreviated for PDF - key points)
			const termsSections = [
				{
					title: "1. Acceptance of Terms",
					content:
						"By accessing and using AuraStays (\"the Platform\"), you accept and agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not use our services.",
				},
				{
					title: "2. User Accounts",
					content:
						"Users must provide accurate and complete registration information. Users must be at least 18 years of age. One account per user; multiple accounts are prohibited. Account credentials must be kept confidential.",
				},
				{
					title: "3. Host Terms",
					content:
						"Hosts must have legal right to list and rent the property. All listing information must be accurate and up-to-date. Hosts must comply with local laws and regulations. Hosts agree to pay a service fee per booking.",
				},
				{
					title: "4. Guest Terms",
					content:
						"Guests must book properties for personal, non-commercial use. Number of guests cannot exceed listing capacity. Guests must follow house rules set by hosts. Guests agree to pay service fees and guest fees per person.",
				},
				{
					title: "5. Cancellations & Refunds",
					content:
						"Cancellation policies vary by listing (Flexible, Moderate, Strict). Refund amount depends on cancellation policy and timing. Service fees are non-refundable except in special circumstances.",
				},
				{
					title: "6. Prohibited Activities",
					content:
						"No fraudulent, illegal, or harmful activities. No discrimination or harassment. No unauthorized commercial use of properties. No circumventing platform for direct bookings.",
				},
				{
					title: "7. Liability & Disclaimers",
					content:
						"AuraStays acts as an intermediary between hosts and guests. We do not own, manage, or control listed properties. We are not responsible for host or guest conduct. Use of platform is at user's own risk.",
				},
				{
					title: "8. Intellectual Property",
					content:
						"All platform content is property of AuraStays. Users retain ownership of their uploaded content. Users grant us license to use content for platform operations.",
				},
				{
					title: "9. Dispute Resolution",
					content:
						"Users agree to attempt good-faith resolution of disputes. Platform may mediate disputes between hosts and guests. Unresolved disputes subject to binding arbitration.",
				},
				{
					title: "10. Modifications to Terms",
					content:
						"We reserve the right to modify these terms at any time. Users will be notified of significant changes. Continued use after changes constitutes acceptance.",
				},
				{
					title: "11. Termination",
					content:
						"We may terminate or suspend accounts for violations. Users may close their accounts at any time. Obligations survive account termination.",
				},
				{
					title: "12. Contact Information",
					content:
						"For questions about these terms, contact us at: Email: legal@aurastays.com, Phone: +63 123 456 7890, Address: Manila, Philippines",
				},
			]

			termsSections.forEach((section) => {
				checkPageBreak(20)
				addText(section.title, 12, true, [65, 95, 148])
				yPosition += 2
				addText(section.content, 10, false, [68, 68, 68])
				yPosition += 5
			})
			yPosition += 5

			// ========== PRIVACY POLICY SECTION ==========
			addSectionHeader("Privacy Policy")
			addText(
				"How we collect, use, and protect your personal information",
				10,
				false,
				[102, 102, 102]
			)
			yPosition += 5

			const privacySections = [
				{
					title: "1. Introduction",
					content:
						"AuraStays (\"we,\" \"our,\" or \"us\") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform.",
				},
				{
					title: "2. Information We Collect",
					content:
						"We collect account information (name, email, phone), profile information, payment information (processed securely), identity verification data, communications, device information, usage data, location data, and cookies.",
				},
				{
					title: "3. How We Use Your Information",
					content:
						"We use information for platform operations (creating accounts, processing bookings), improvement & personalization, communications (confirmations, updates), and legal & safety compliance.",
				},
				{
					title: "4. Information Sharing",
					content:
						"We share information with other users (public profiles, booking details), service providers (payment processors, cloud hosting), legal requirements (law enforcement when required), and business transfers (mergers, acquisitions).",
				},
				{
					title: "5. Data Security",
					content:
						"We implement industry-standard encryption (SSL/TLS), secure password hashing, regular security audits, access controls, and PCI-compliant payment processing.",
				},
				{
					title: "6. Your Privacy Rights",
					content:
						"You have the right to access, correct, delete, export, and opt-out of your personal data. Contact privacy@aurastays.com for requests. Response provided within 30 days.",
				},
				{
					title: "7. Cookies & Tracking",
					content:
						"We use essential cookies (required for functionality), analytics cookies (track usage), marketing cookies (personalize ads), and preference cookies (remember settings).",
				},
				{
					title: "8. Data Retention",
					content:
						"Account data retained while account is active. Booking records kept for 7 years (tax/legal requirements). Communication logs retained for 3 years.",
				},
				{
					title: "9. Children's Privacy",
					content:
						"Platform not intended for users under 18. We do not knowingly collect data from children. Parents should monitor children's internet use.",
				},
				{
					title: "10. International Data Transfers",
					content:
						"Data may be transferred and processed internationally. We ensure adequate protection for transferred data. Standard contractual clauses used where required.",
				},
				{
					title: "11. Changes to Privacy Policy",
					content:
						"We may update this policy periodically. Users notified of significant changes. Continued use implies acceptance of changes.",
				},
				{
					title: "12. Contact Us",
					content:
						"For privacy-related questions or requests: Email: privacy@aurastays.com, Phone: +63 123 456 7890, Address: Data Protection Officer, AuraStays, Manila, Philippines",
				},
			]

			privacySections.forEach((section) => {
				checkPageBreak(20)
				addText(section.title, 12, true, [65, 95, 148])
				yPosition += 2
				addText(section.content, 10, false, [68, 68, 68])
				yPosition += 5
			})

			// Footer on last page
			checkPageBreak(15)
			yPosition += 5
			pdfDoc.setDrawColor(200, 200, 200)
			pdfDoc.line(margin, yPosition, pageWidth - margin, yPosition)
			yPosition += 5
			pdfDoc.setFontSize(8)
			pdfDoc.setTextColor(150, 150, 150)
			pdfDoc.text(
				`This document was generated on ${new Date().toLocaleString()}. For the most up-to-date policies, please visit the AuraStays platform.`,
				pageWidth / 2,
				yPosition,
				{ align: "center" }
			)

			// Save the PDF
			pdfDoc.save(`AuraStays-Policy-Management-${new Date().toISOString().split("T")[0]}.pdf`)
			toast.success("📄 Policy document exported successfully!")
		} catch (err) {
			console.error("Error exporting policies:", err)
			toast.error("❌ Failed to export policies: " + err.message)
		}
	}

	const fetchPlatformPolicies = async () => {
		try {
			const policiesDoc = await getDocs(collection(db, "settings"))
			const policiesData = policiesDoc.docs
				.find((doc) => doc.id === "policies")
				?.data()

			if (policiesData) {
				setPolicies({
					serviceFeeHost: policiesData.serviceFeeHost || 15,
					serviceFeeGuest: policiesData.serviceFeeGuest || 800,
					guestFeePerPerson: policiesData.guestFeePerPerson || 100,
					walletWithdrawalFee: policiesData.walletWithdrawalFee || 1,
					cancellationWindowHours: policiesData.cancellationWindowHours || 48,
					minPropertyRating: policiesData.minPropertyRating || 3.0,
					cleaningFee: policiesData.cleaningFee || 500,
					serviceFeePerProperty: policiesData.serviceFeePerProperty || 200,
				})
			}
		} catch (err) {
			console.error("Error fetching policies:", err)
			// Keep default values if fetch fails
		}
	}

	const fetchFlaggedProperties = async () => {
		try {
			setLoadingFlagged(true)
			const reportsRef = collection(db, "propertyReports")
			const reportsSnapshot = await getDocs(
				query(reportsRef, orderBy("createdAt", "desc"))
			)
			const reports = reportsSnapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			}))
			setFlaggedProperties(reports)
		} catch (err) {
			console.error("Error fetching flagged properties:", err)
			toast.error("Failed to fetch flagged properties")
		} finally {
			setLoadingFlagged(false)
		}
	}

	const handleResolveReport = async (reportId, action) => {
		try {
			const reportRef = doc(db, "propertyReports", reportId)
			await updateDoc(reportRef, {
				status: action, // 'resolved' or 'dismissed'
				resolvedAt: serverTimestamp(),
				resolvedBy: currentUser.uid,
			})
			toast.success(`Report ${action === "resolved" ? "resolved" : "dismissed"}`)
			fetchFlaggedProperties()
		} catch (err) {
			console.error("Error resolving report:", err)
			toast.error("Failed to resolve report")
		}
	}

	const fetchWalletData = async () => {
		try {
			setLoadingWallet(true)
			const preferredEmail =
				(import.meta?.env?.VITE_ADMIN_EMAIL || "").trim() ||
				"admin@aurastays.com"

			// Get admin user document
			console.log("[AdminDashboard][Wallet] Looking up admin account", {
				preferredEmail,
			})
			const { query, where, limit } = await import("firebase/firestore")
			const usersCollection = collection(db, "users")
			// 1) Try preferred email
			const emailQuery = query(
				usersCollection,
				where("email", "==", preferredEmail),
				limit(1)
			)
			let adminSnapshot = await getDocs(emailQuery)
			// 2) Fallback: userType == 'admin'
			if (adminSnapshot.empty) {
				const byUserType = query(
					usersCollection,
					where("userType", "==", "admin"),
					limit(1)
				)
				adminSnapshot = await getDocs(byUserType)
			}
			// 3) Fallback: isAdmin == true
			if (adminSnapshot.empty) {
				const byIsAdmin = query(
					usersCollection,
					where("isAdmin", "==", true),
					limit(1)
				)
				adminSnapshot = await getDocs(byIsAdmin)
			}

			console.log("[AdminDashboard][Wallet] Admin query result", {
				snapshotEmpty: adminSnapshot.empty,
				count: adminSnapshot.size,
			})
			if (!adminSnapshot.empty) {
				const adminDoc = adminSnapshot.docs[0]
				const adminData = adminDoc.data()
				console.log("[AdminDashboard][Wallet] Admin doc found", {
					adminId: adminDoc.id,
					hasWalletBalance: typeof adminData?.walletBalance !== "undefined",
					hasPaypalEmail: !!adminData?.paypalEmail,
				})
				setWalletBalance(adminData?.walletBalance || 0)
				setAdminPaypalEmail(adminData?.paypalEmail || "")
				setPaypalEmailInput(adminData?.paypalEmail || "")

				// Fetch wallet transactions for admin
				const txQuery = query(
					collection(db, "walletTransactions"),
					where("userId", "==", adminDoc.id)
				)
				console.log("[AdminDashboard][Wallet] Fetching admin transactions", {
					adminId: adminDoc.id,
				})
				const txSnapshot = await getDocs(txQuery)
				const transactions = txSnapshot.docs.map((doc) => ({
					id: doc.id,
					...doc.data(),
				}))

				// Sort by date, newest first
				transactions.sort((a, b) => {
					const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0
					const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0
					return timeB - timeA
				})

				console.log("[AdminDashboard][Wallet] Transactions loaded", {
					count: transactions.length,
				})
				setWalletTransactions(transactions)

				// Calculate earnings from completed/confirmed bookings
				try {
					const bookingsSnapshot = await getDocs(collection(db, "bookings"))
					const allBookings = bookingsSnapshot.docs.map((doc) => ({
						id: doc.id,
						...doc.data(),
					}))

					// Filter completed and confirmed bookings
					const completedBookingsList = allBookings.filter((booking) => {
						if (booking.status === "cancelled") return false
						if (booking.status === "pending") return false
						return booking.status === "completed" || booking.status === "confirmed"
					})

					// Store completed bookings for transaction history
					setCompletedBookings(completedBookingsList)

					// Calculate total service fee and guest fee earnings
					let totalServiceFee = 0
					let totalGuestFee = 0

					completedBookingsList.forEach((booking) => {
						const serviceFee = booking.pricing?.serviceFee || 0
						const guestFee = booking.pricing?.guestFee || 0
						totalServiceFee += serviceFee
						totalGuestFee += guestFee
					})

					setBookingEarnings({
						serviceFee: totalServiceFee,
						guestFee: totalGuestFee,
						total: totalServiceFee + totalGuestFee,
					})
				} catch (error) {
					console.error("[AdminDashboard][Wallet] Error calculating booking earnings:", error)
					setBookingEarnings({ serviceFee: 0, guestFee: 0, total: 0 })
					setCompletedBookings([])
				}

				// Fetch subscriptions and calculate subscription revenue
				try {
					const subscriptionsSnapshot = await getDocs(collection(db, "subscriptions"))
					const allSubscriptions = subscriptionsSnapshot.docs.map((doc) => ({
						id: doc.id,
						...doc.data(),
					}))

					// Filter active subscriptions
					const activeSubscriptions = allSubscriptions.filter(
						(sub) => sub.status === "active"
					)

					// Store subscriptions for transaction history
					setSubscriptions(activeSubscriptions)

					// Calculate total subscription revenue
					let totalSubscriptionRevenue = 0
					activeSubscriptions.forEach((subscription) => {
						const price = subscription.price || 0
						totalSubscriptionRevenue += price
					})

					setSubscriptionRevenue(totalSubscriptionRevenue)
				} catch (error) {
					console.error("[AdminDashboard][Wallet] Error fetching subscriptions:", error)
					setSubscriptions([])
					setSubscriptionRevenue(0)
				}
			} else {
				console.warn(
					"[AdminDashboard][Wallet] Admin account not found for email",
					preferredEmail
				)
				// Auto-initialize admin account document
				try {
					const { addDoc } = await import("firebase/firestore")
					const initData = {
						email: preferredEmail,
						role: "admin",
						walletBalance: 0,
						paypalEmail: "",
						createdAt: new Date(),
						updatedAt: new Date(),
					}
					console.log(
						"[AdminDashboard][Wallet] Initializing admin account with default wallet",
						initData
					)
					const createdRef = await addDoc(collection(db, "users"), initData)
					console.log("[AdminDashboard][Wallet] Admin account created", {
						adminId: createdRef.id,
					})
					toast.success("Admin wallet initialized. Reloading data...")
					// Re-run the loader to populate state from the new doc
					// Simple approach: recall this function after a tick
					setTimeout(async () => {
						try {
							let adminSnapshot2 = await getDocs(
								query(
									collection(db, "users"),
									where("email", "==", preferredEmail),
									limit(1)
								)
							)
							if (adminSnapshot2.empty) {
								adminSnapshot2 = await getDocs(
									query(
										collection(db, "users"),
										where("userType", "==", "admin"),
										limit(1)
									)
								)
							}
							if (!adminSnapshot2.empty) {
								const adminDoc2 = adminSnapshot2.docs[0]
								const adminData2 = adminDoc2.data()
								console.log(
									"[AdminDashboard][Wallet] Admin doc found after init",
									{
										adminId: adminDoc2.id,
										walletBalance: adminData2?.walletBalance,
									}
								)
								setWalletBalance(adminData2?.walletBalance || 0)
								setAdminPaypalEmail(adminData2?.paypalEmail || "")
								setPaypalEmailInput(adminData2?.paypalEmail || "")
							}
						} catch (reErr) {
							console.error(
								"[AdminDashboard][Wallet] Post-init reload failed:",
								reErr
							)
						}
					}, 300)
				} catch (initErr) {
					console.error(
						"[AdminDashboard][Wallet] Failed to initialize admin account",
						initErr
					)
					toast.error("Admin account not found")
				}
			}
		} catch (err) {
			console.error("Error fetching wallet data:", err)
			toast.error("Failed to load wallet data")
		} finally {
			setLoadingWallet(false)
		}
	}

	const handleConnectPaypal = async () => {
		if (!paypalEmailInput || !paypalEmailInput.includes("@")) {
			toast.error("Please enter a valid PayPal email")
			return
		}

		try {
			const preferredEmail =
				(import.meta?.env?.VITE_ADMIN_EMAIL || "").trim() ||
				"admin@aurastays.com"
			const { query, where, limit } = await import("firebase/firestore")
			const usersCollection = collection(db, "users")
			let adminSnapshot = await getDocs(
				query(usersCollection, where("email", "==", preferredEmail), limit(1))
			)
			if (adminSnapshot.empty) {
				adminSnapshot = await getDocs(
					query(usersCollection, where("userType", "==", "admin"), limit(1))
				)
			}
			if (adminSnapshot.empty) {
				adminSnapshot = await getDocs(
					query(usersCollection, where("isAdmin", "==", true), limit(1))
				)
			}

			if (!adminSnapshot.empty) {
				const adminDoc = adminSnapshot.docs[0]
				const adminRef = doc(db, "users", adminDoc.id)

				await updateDoc(adminRef, {
					paypalEmail: paypalEmailInput,
					updatedAt: new Date(),
				})

				setAdminPaypalEmail(paypalEmailInput)
				setShowPaypalModal(false)
				toast.success("PayPal account connected successfully!")
			}
		} catch (error) {
			console.error("Error connecting PayPal:", error)
			toast.error("Failed to connect PayPal account")
		}
	}

	const handleDisconnectPaypal = async () => {
		try {
			const preferredEmail =
				(import.meta?.env?.VITE_ADMIN_EMAIL || "").trim() ||
				"admin@aurastays.com"
			const { query, where, limit } = await import("firebase/firestore")
			const usersCollection = collection(db, "users")
			let adminSnapshot = await getDocs(
				query(usersCollection, where("email", "==", preferredEmail), limit(1))
			)
			if (adminSnapshot.empty) {
				adminSnapshot = await getDocs(
					query(usersCollection, where("userType", "==", "admin"), limit(1))
				)
			}
			if (adminSnapshot.empty) {
				adminSnapshot = await getDocs(
					query(usersCollection, where("isAdmin", "==", true), limit(1))
				)
			}

			if (!adminSnapshot.empty) {
				const adminDoc = adminSnapshot.docs[0]
				const adminRef = doc(db, "users", adminDoc.id)

				await updateDoc(adminRef, {
					paypalEmail: "",
					updatedAt: new Date(),
				})

				setAdminPaypalEmail("")
				setPaypalEmailInput("")
				toast.success("PayPal account disconnected")
			}
		} catch (error) {
			console.error("Error disconnecting PayPal:", error)
			toast.error("Failed to disconnect PayPal account")
		}
	}

	// Promo Wizard Functions
	const handlePromoInputChange = (field, value) => {
		setPromoFormData((prev) => ({
			...prev,
			[field]: value,
		}))
	}

	// Calendar functions for promo validity dates
	const generatePromoCalendarDays = () => {
		const year = promoCalendarMonth.getFullYear()
		const month = promoCalendarMonth.getMonth()
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
			const date = new Date(dateString)
			const today = new Date()
			today.setHours(0, 0, 0, 0)
			days.push({
				day,
				dateString,
				isPast: date < today,
			})
		}
		return days
	}

	const previousPromoMonth = () => {
		setPromoCalendarMonth(
			new Date(
				promoCalendarMonth.getFullYear(),
				promoCalendarMonth.getMonth() - 1
			)
		)
	}

	const nextPromoMonth = () => {
		setPromoCalendarMonth(
			new Date(
				promoCalendarMonth.getFullYear(),
				promoCalendarMonth.getMonth() + 1
			)
		)
	}

	const handlePromoDateClick = (dateString) => {
		const selectedDate = new Date(dateString)
		const today = new Date()
		today.setHours(0, 0, 0, 0)

		if (selectedDate < today) {
			toast.error("Cannot select past dates")
			return
		}

		// Format as datetime-local format (YYYY-MM-DDTHH:mm)
		const dateTimeString = `${dateString}T00:00`

		if (selectingValidFrom) {
			handlePromoInputChange("validFrom", dateTimeString)
			setSelectingValidFrom(false)
			// If validUntil is before validFrom, clear it
			if (
				promoFormData.validUntil &&
				new Date(promoFormData.validUntil) < selectedDate
			) {
				handlePromoInputChange("validUntil", "")
			}
		} else {
			// Selecting validUntil
			if (
				promoFormData.validFrom &&
				new Date(promoFormData.validFrom) > selectedDate
			) {
				toast.error("Valid Until must be after Valid From")
				return
			}
			handlePromoInputChange("validUntil", dateTimeString)
			setShowPromoDatePicker(false)
		}
	}

	const openPromoDatePicker = (isValidFrom) => {
		setSelectingValidFrom(isValidFrom)
		setShowPromoDatePicker(true)
	}

	const formatPromoDate = (dateString) => {
		if (!dateString) return ""
		const date = new Date(dateString)
		return date.toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		})
	}

	const handleNextStep = () => {
		// Validation for each step
		if (promoWizardStep === 1) {
			// Step 1: Basic Information
			if (!promoFormData.code || promoFormData.code.trim().length === 0) {
				toast.error("❌ Promo code is required")
				return
			}
			if (promoFormData.code.trim().length < 3) {
				toast.error("❌ Promo code must be at least 3 characters")
				return
			}
			if (
				!promoFormData.description ||
				promoFormData.description.trim().length === 0
			) {
				toast.error("❌ Description is required")
				return
			}
			if (promoFormData.description.trim().length < 10) {
				toast.error("❌ Description must be at least 10 characters")
				return
			}
		} else if (promoWizardStep === 2) {
			// Step 2: Discount Settings
			if (!promoFormData.discountValue || promoFormData.discountValue <= 0) {
				toast.error("❌ Discount value must be greater than 0")
				return
			}
			if (
				promoFormData.discountType === "percentage" &&
				promoFormData.discountValue > 100
			) {
				toast.error("❌ Percentage discount cannot exceed 100%")
				return
			}
			if (promoFormData.minPurchase < 0) {
				toast.error("❌ Minimum purchase cannot be negative")
				return
			}
			if (promoFormData.maxDiscount < 0) {
				toast.error("❌ Maximum discount cannot be negative")
				return
			}
		} else if (promoWizardStep === 3) {
			// Step 3: Usage Limits
			if (promoFormData.usageLimit < 0) {
				toast.error("❌ Usage limit cannot be negative")
				return
			}
			if (!promoFormData.usagePerUser || promoFormData.usagePerUser < 1) {
				toast.error("❌ Usage per user must be at least 1")
				return
			}
		}
		setPromoWizardStep(promoWizardStep + 1)
	}

	const handlePreviousStep = () => {
		setPromoWizardStep(promoWizardStep - 1)
	}

	const handleCreatePromo = async () => {
		try {
			setIsCreatingPromo(true)

			// Comprehensive validation of all fields

			// Step 1 validation: Basic Information
			if (!promoFormData.code || promoFormData.code.trim().length === 0) {
				toast.error("❌ Promo code is required")
				setPromoWizardStep(1)
				setIsCreatingPromo(false)
				return
			}

			if (promoFormData.code.trim().length < 3) {
				toast.error("❌ Promo code must be at least 3 characters")
				setPromoWizardStep(1)
				setIsCreatingPromo(false)
				return
			}

			if (
				!promoFormData.description ||
				promoFormData.description.trim().length === 0
			) {
				toast.error("❌ Description is required")
				setPromoWizardStep(1)
				setIsCreatingPromo(false)
				return
			}

			if (promoFormData.description.trim().length < 10) {
				toast.error("❌ Description must be at least 10 characters")
				setPromoWizardStep(1)
				setIsCreatingPromo(false)
				return
			}

			// Step 2 validation: Discount Settings
			if (!promoFormData.discountValue || promoFormData.discountValue <= 0) {
				toast.error("❌ Discount value must be greater than 0")
				setPromoWizardStep(2)
				setIsCreatingPromo(false)
				return
			}

			if (promoFormData.discountType === "percentage") {
				if (promoFormData.discountValue > 100) {
					toast.error("❌ Percentage discount cannot exceed 100%")
					setPromoWizardStep(2)
					setIsCreatingPromo(false)
					return
				}
			}

			if (promoFormData.minPurchase < 0) {
				toast.error("❌ Minimum purchase cannot be negative")
				setPromoWizardStep(2)
				setIsCreatingPromo(false)
				return
			}

			if (promoFormData.maxDiscount < 0) {
				toast.error("❌ Maximum discount cannot be negative")
				setPromoWizardStep(2)
				setIsCreatingPromo(false)
				return
			}

			// Step 3 validation: Usage Limits
			if (promoFormData.usageLimit < 0) {
				toast.error("❌ Usage limit cannot be negative")
				setPromoWizardStep(3)
				setIsCreatingPromo(false)
				return
			}

			if (!promoFormData.usagePerUser || promoFormData.usagePerUser < 1) {
				toast.error("❌ Usage per user must be at least 1")
				setPromoWizardStep(3)
				setIsCreatingPromo(false)
				return
			}

			// Step 4 validation: Validity Period
			if (promoFormData.validFrom && promoFormData.validUntil) {
				const fromDate = new Date(promoFormData.validFrom)
				const untilDate = new Date(promoFormData.validUntil)

				if (fromDate >= untilDate) {
					toast.error("❌ Valid From date must be before Valid Until date")
					setPromoWizardStep(4)
					setIsCreatingPromo(false)
					return
				}
			}

			// Create promo object
			const promoData = {
				...promoFormData,
				code: promoFormData.code.toUpperCase().trim(),
				description: promoFormData.description.trim(),
				isActive: Boolean(promoFormData.isActive), // Ensure boolean type
				usedBy: [],
				usageCount: 0,
				createdAt: new Date().toISOString(),
				createdBy: currentUser.uid,
			}

			// Add to Firebase
			await addDoc(collection(db, "promos"), promoData)

			toast.success("🎉 Promo created successfully!")
			setShowPromoWizard(false)
			setPromoWizardStep(1)
			setPromoFormData({
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
				applicableTo: "all",
			})
			// Refresh the data to show the new promo
			fetchAdminData()
		} catch (err) {
			console.error("Error creating promo:", err)
			toast.error("❌ Failed to create promo: " + err.message)
		} finally {
			setIsCreatingPromo(false)
		}
	}

	const handleDeletePromo = async (promoId, promoCode) => {
		if (
			!window.confirm(`Are you sure you want to delete promo "${promoCode}"?`)
		) {
			return
		}

		try {
			await deleteDoc(doc(db, "promos", promoId))
			toast.success(`🗑️ Promo "${promoCode}" deleted successfully!`)
			// Refresh the data
			fetchAdminData()
		} catch (err) {
			console.error("Error deleting promo:", err)
			toast.error("❌ Failed to delete promo: " + err.message)
		}
	}

	const handleTogglePromoStatus = async (promoId, currentStatus) => {
		try {
			// Convert to boolean and toggle
			const newStatus = currentStatus === true ? false : true
			await updateDoc(doc(db, "promos", promoId), {
				isActive: newStatus,
			})
			toast.success(
				`✅ Promo ${newStatus ? "activated" : "deactivated"} successfully!`
			)
			// Refresh the data
			fetchAdminData()
		} catch (err) {
			console.error("Error updating promo:", err)
			toast.error("❌ Failed to update promo: " + err.message)
		}
	}

	const handleCancelPromoWizard = () => {
		setShowPromoWizard(false)
		setPromoWizardStep(1)
		setPromoFormData({
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
			applicableTo: "all",
		})
	}

	const _updateAllPropertiesOwner = async () => {
		const confirmed = window.confirm(
			"This will update all properties to be owned by the host user. Continue?"
		)
		if (!confirmed) return

		try {
			const propertiesSnapshot = await getDocs(collection(db, "properties"))
			const updatePromises = []

			propertiesSnapshot.forEach((docSnapshot) => {
				const propertyRef = doc(db, "properties", docSnapshot.id)
				updatePromises.push(
					updateDoc(propertyRef, {
						hostId: "UI7UgbxJj4atJmzmS61fAjA2E0A3",
					})
				)
			})

			await Promise.all(updatePromises)
			toast.success(
				`✅ Successfully updated ${updatePromises.length} properties!`
			)
		} catch (err) {
			console.error("Error updating properties:", err)
			toast.error("❌ Failed to update properties: " + err.message)
		}
	}

	// Get unique categories for property filter
	const uniqueCategories = useMemo(() => {
		const categories = new Set()
		allPropertiesData.forEach((property) => {
			const cat = property.category || property.type
			if (cat) categories.add(cat)
		})
		return Array.from(categories).sort()
	}, [allPropertiesData])

	// Filtered data using useMemo
	const filteredUsersData = useMemo(() => {
		let filtered = [...allUsersData]
		
		// Search filter
		if (userFilters.search.trim()) {
			const search = userFilters.search.toLowerCase()
			filtered = filtered.filter(
				(user) =>
					(user.displayName || "").toLowerCase().includes(search) ||
					(user.email || "").toLowerCase().includes(search)
			)
		}
		
		// User type filter
		if (userFilters.userType !== "all") {
			filtered = filtered.filter((user) => (user.userType || "guest") === userFilters.userType)
		}
		
		return filtered
	}, [allUsersData, userFilters])

	const filteredPropertiesData = useMemo(() => {
		let filtered = [...allPropertiesData]
		
		// Search filter
		if (propertyFilters.search.trim()) {
			const search = propertyFilters.search.toLowerCase()
			filtered = filtered.filter(
				(property) =>
					(property.title || property.name || "").toLowerCase().includes(search) ||
					(property.category || property.type || "").toLowerCase().includes(search)
			)
		}
		
		// Category filter
		if (propertyFilters.category !== "all") {
			filtered = filtered.filter(
				(property) => (property.category || property.type || "") === propertyFilters.category
			)
		}
		
		// Rating filters
		if (propertyFilters.minRating) {
			const minRating = parseFloat(propertyFilters.minRating)
			filtered = filtered.filter((property) => (property.rating || 0) >= minRating)
		}
		if (propertyFilters.maxRating) {
			const maxRating = parseFloat(propertyFilters.maxRating)
			filtered = filtered.filter((property) => (property.rating || 0) <= maxRating)
		}
		
		return filtered
	}, [allPropertiesData, propertyFilters])

	const filteredBookingsData = useMemo(() => {
		let filtered = [...allBookingsData]
		
		// Search filter
		if (bookingFilters.search.trim()) {
			const search = bookingFilters.search.toLowerCase()
			filtered = filtered.filter(
				(booking) =>
					(booking.guestName || "").toLowerCase().includes(search) ||
					(booking.propertyTitle || "").toLowerCase().includes(search)
			)
		}
		
		// Status filter
		if (bookingFilters.status !== "all") {
			filtered = filtered.filter((booking) => (booking.status || "pending") === bookingFilters.status)
		}
		
		// Amount filters
		if (bookingFilters.minAmount) {
			const minAmount = parseFloat(bookingFilters.minAmount)
			filtered = filtered.filter((booking) => (booking.pricing?.total || 0) >= minAmount)
		}
		if (bookingFilters.maxAmount) {
			const maxAmount = parseFloat(bookingFilters.maxAmount)
			filtered = filtered.filter((booking) => (booking.pricing?.total || 0) <= maxAmount)
		}
		
		return filtered
	}, [allBookingsData, bookingFilters])

	const filteredRevenueData = useMemo(() => {
		let filtered = allBookingsData.filter(b => b.status !== "cancelled" && b.status !== "pending")
		
		// Search filter
		if (revenueFilters.search.trim()) {
			const search = revenueFilters.search.toLowerCase()
			filtered = filtered.filter(
				(booking) =>
					(booking.guestName || "").toLowerCase().includes(search) ||
					(booking.propertyTitle || "").toLowerCase().includes(search)
			)
		}
		
		// Status filter
		if (revenueFilters.status !== "all") {
			filtered = filtered.filter((booking) => (booking.status || "pending") === revenueFilters.status)
		}
		
		// Amount filters
		if (revenueFilters.minAmount) {
			const minAmount = parseFloat(revenueFilters.minAmount)
			filtered = filtered.filter((booking) => (booking.pricing?.total || 0) >= minAmount)
		}
		if (revenueFilters.maxAmount) {
			const maxAmount = parseFloat(revenueFilters.maxAmount)
			filtered = filtered.filter((booking) => (booking.pricing?.total || 0) <= maxAmount)
		}
		
		return filtered
	}, [allBookingsData, revenueFilters])

	const openReportModal = async (reportType) => {
		let reportData = {}
		let reportTitle = ""

		try {
			switch (reportType) {
				case "users":
					reportTitle = "Users_Report"
					// Use filtered data if filters are applied, otherwise use all data
					const usersToExport = userFilters.search || userFilters.userType !== "all" 
						? filteredUsersData 
						: allUsersData
					reportData = {
						generatedAt: new Date().toISOString(),
						summary: {
							totalUsers: usersToExport.length,
							totalHosts: usersToExport.filter(u => u.userType === "host").length,
							totalGuests: usersToExport.filter(u => u.userType === "guest").length,
						},
						recentUsers: usersToExport.map((u) => ({
							name: u.displayName || "N/A",
							email: u.email || "N/A",
							userType: u.userType || "N/A",
							createdAt: u.createdAt?.toDate?.()?.toLocaleDateString() || "N/A",
						})),
					}
					break

				case "properties": {
					// Use filtered data if filters are applied, otherwise use all data
					const propertiesToExport = propertyFilters.search || propertyFilters.category !== "all" || propertyFilters.minRating || propertyFilters.maxRating
						? filteredPropertiesData 
						: allPropertiesData
					
					reportTitle = "Properties_Report"

					const allPropertiesMapped = propertiesToExport.map((p) => ({
						title: p.title || p.name || "Untitled",
						rating: p.rating || 0,
						reviews: p.reviewsCount || p.reviews || 0,
						category: p.category || p.type || "N/A",
						host:
							p.hostName ||
							(typeof p.host === "object" ? p.host?.hostName : p.host) ||
							"N/A",
					}))

					// Sort by rating for bestReviews and lowestReviews
					const sortedByRating = [...propertiesToExport].sort((a, b) => (b.rating || 0) - (a.rating || 0))
					const bestReviews = sortedByRating.filter(p => (p.rating || 0) > 0)
					const lowestReviews = [...sortedByRating].reverse().filter(p => (p.rating || 0) > 0)

					reportData = {
						generatedAt: new Date().toISOString(),
						summary: {
							totalProperties: propertiesToExport.length,
							avgRating:
								propertiesToExport.length > 0
									? (
											propertiesToExport.reduce(
												(sum, p) => sum + (p.rating || 0),
												0
											) / propertiesToExport.length
									  ).toFixed(2)
									: 0,
						},
						topRated: bestReviews.slice(0, 10).map((p) => ({
							title: p.title || p.name || "Untitled",
							rating: p.rating || 0,
							reviews: p.reviewsCount || p.reviews || 0,
							category: p.category || p.type || "N/A",
						})),
						needsAttention: lowestReviews.slice(0, 10).map((p) => ({
							title: p.title || p.name || "Untitled",
							rating: p.rating || 0,
							reviews: p.reviewsCount || p.reviews || 0,
							category: p.category || p.type || "N/A",
						})),
						allProperties: allPropertiesMapped,
					}
					break
				}

				case "bookings":
					reportTitle = "Bookings_Report"
					// Use filtered data if filters are applied, otherwise use all data
					const bookingsToExport = bookingFilters.search || bookingFilters.status !== "all" || bookingFilters.minAmount || bookingFilters.maxAmount
						? filteredBookingsData 
						: allBookingsData
					
					const bookingsTotalRevenue = bookingsToExport.reduce((sum, b) => sum + (b.pricing?.total || 0), 0)
					
					reportData = {
						generatedAt: new Date().toISOString(),
						summary: {
							totalBookings: bookingsToExport.length,
							totalRevenue: bookingsTotalRevenue,
							avgBookingValue:
								bookingsToExport.length > 0
									? (bookingsTotalRevenue / bookingsToExport.length).toFixed(2)
									: 0,
						},
						recentBookings: bookingsToExport.map((b) => {
							// Helper function to format date
							const formatDate = (dateField) => {
								if (!dateField) return "N/A"
								if (dateField.toDate && typeof dateField.toDate === "function") {
									return dateField.toDate().toLocaleDateString()
								}
								if (typeof dateField === "string") {
									return dateField
								}
								if (dateField instanceof Date) {
									return dateField.toLocaleDateString()
								}
								try {
									const date = new Date(dateField)
									if (!isNaN(date.getTime())) {
										return date.toLocaleDateString()
									}
								} catch (e) {
									// Ignore
								}
								return "N/A"
							}
							
							const checkIn = b.checkInDate || b.checkIn
							const checkOut = b.checkOutDate || b.checkOut
							
							return {
								guest: b.guestName || "N/A",
								property: b.propertyTitle || "N/A",
								checkIn: formatDate(checkIn),
								checkOut: formatDate(checkOut),
								status: b.status || "pending",
								amount: b.pricing?.total || 0,
							}
						}),
					}
					break

				case "revenue": {
					reportTitle = "Revenue_Report"
					// Use filtered data if filters are applied, otherwise use all data
					const revenueToExport = revenueFilters.search || revenueFilters.status !== "all" || revenueFilters.minAmount || revenueFilters.maxAmount
						? filteredRevenueData 
						: allBookingsData.filter(b => b.status !== "cancelled" && b.status !== "pending")
					
					const revenueTotal = revenueToExport.reduce((sum, b) => sum + (b.pricing?.total || 0), 0)
					const hostFees = revenueTotal * (policies.serviceFeeHost / 100)
					const guestFees = revenueToExport.length * policies.serviceFeeGuest // Fixed fee per booking
					const totalServiceFees = hostFees + guestFees
					const netRevenue = revenueTotal - totalServiceFees
					
					reportData = {
						generatedAt: new Date().toISOString(),
						summary: {
							totalRevenue: revenueTotal,
							hostServiceFees: hostFees.toFixed(2),
							guestServiceFees: guestFees.toFixed(2),
							totalServiceFees: totalServiceFees.toFixed(2),
							netRevenue: netRevenue.toFixed(2),
						},
						chartData: chartData.revenue,
					}
					break
				}


				case "complete":
				case "system": {
					// Generate complete system report combining all data
					reportTitle = "Complete_System_Report"

					// Fetch fresh properties data
					const propertiesSnapshot = await getDocs(collection(db, "properties"))
					let allPropertiesData = propertiesSnapshot.docs.map((doc) => ({
						id: doc.id,
						...doc.data(),
					}))

					// Dynamically calculate reviews count and rating for each property
					allPropertiesData = await Promise.all(
						allPropertiesData.map(async (property) => {
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

					// Sort by rating for bestReviews and lowestReviews
					const sortedByRating = [...allPropertiesData].sort((a, b) => (b.rating || 0) - (a.rating || 0))
					const bestReviews = sortedByRating.filter(p => (p.rating || 0) > 0)
					const lowestReviews = [...sortedByRating].reverse().filter(p => (p.rating || 0) > 0)

					const hostFees = stats.totalRevenue * (policies.serviceFeeHost / 100)
					const guestFees =
						stats.totalRevenue * (policies.serviceFeeGuest / 100)

					reportData = {
						generatedAt: new Date().toISOString(),
						reportType: "Complete System Report",
						platformOverview: {
							totalUsers: stats.totalUsers,
							totalHosts: stats.totalHosts,
							totalGuests: stats.totalGuests,
							totalProperties: stats.totalProperties,
							totalBookings: stats.totalBookings,
							totalRevenue: stats.totalRevenue,
						},
						users: {
							summary: {
								total: stats.totalUsers,
								hosts: stats.totalHosts,
								guests: stats.totalGuests,
							},
							recentUsers: recentUsers.slice(0, 20).map((u) => ({
								name: u.displayName || "N/A",
								email: u.email || "N/A",
								userType: u.userType || "N/A",
								createdAt:
									u.createdAt?.toDate?.()?.toLocaleDateString() || "N/A",
							})),
						},
						properties: {
							summary: {
								total: allPropertiesData.length,
								avgRating:
									allPropertiesData.length > 0
										? (
												allPropertiesData.reduce(
													(sum, p) => sum + (p.rating || 0),
													0
												) / allPropertiesData.length
										  ).toFixed(2)
										: 0,
							},
							topRated: bestReviews.slice(0, 10).map((p) => ({
								title: p.title || p.name || "Untitled",
								rating: p.rating || 0,
								reviews: p.reviewsCount || 0,
								category: p.category || p.type || "N/A",
							})),
							lowRated: lowestReviews.slice(0, 10).map((p) => ({
								title: p.title || p.name || "Untitled",
								rating: p.rating || 0,
								reviews: p.reviewsCount || 0,
								category: p.category || p.type || "N/A",
							})),
						},
						bookings: {
							summary: {
								total: stats.totalBookings,
								totalRevenue: stats.totalRevenue,
								avgValue:
									stats.totalBookings > 0
										? (stats.totalRevenue / stats.totalBookings).toFixed(2)
										: 0,
							},
							recent: recentBookings.slice(0, 20).map((b) => ({
								guest: b.guestName || "N/A",
								property: b.propertyTitle || "N/A",
								checkIn: b.checkIn || "N/A",
								checkOut: b.checkOut || "N/A",
								status: b.status || "pending",
								amount: b.pricing?.total || 0,
							})),
						},
						revenue: {
							summary: {
								totalRevenue: stats.totalRevenue,
								hostServiceFees: hostFees.toFixed(2),
								guestServiceFees: guestFees.toFixed(2),
								totalServiceFees: (hostFees + guestFees).toFixed(2),
								netRevenue: (stats.totalRevenue - hostFees - guestFees).toFixed(
									2
								),
							},
						},
						policies: {
							serviceFeeHost: policies.serviceFeeHost,
							serviceFeeGuest: policies.serviceFeeGuest,
							guestFeePerPerson: policies.guestFeePerPerson,
							walletWithdrawalFee: policies.walletWithdrawalFee,
							cancellationWindowHours: policies.cancellationWindowHours,
							minPropertyRating: policies.minPropertyRating,
						},
					}
					break
				}

				default:
					toast.error("Invalid report type")
					return
			}

			// Open modal with report data
			setReportModal({
				isOpen: true,
				type: reportType,
				data: reportData,
				title: reportTitle.replace(/_/g, " "),
			})
		} catch (err) {
			console.error("Error preparing report:", err)
			toast.error("Failed to prepare report")
		}
	}

	const exportReportAsPDF = async () => {
		try {
			// Dynamically import React-PDF components
			const { Document, Page, Text, View, StyleSheet, pdf } = await import(
				"@react-pdf/renderer"
			)

			const { data, title, type } = reportModal

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
					color: "#415f94",
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
					color: "#d9c36f",
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
					borderLeftColor: "#d9c36f",
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
					backgroundColor: "#415f94",
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
						{/* Header */}
						<Text style={styles.header}>{title}</Text>
						<Text style={styles.subtitle}>
							Generated: {new Date().toLocaleDateString()}{" "}
							{new Date().toLocaleTimeString()}
						</Text>

						{/* Summary Section */}
						{data.summary && (
							<View style={styles.section}>
								<Text style={styles.sectionTitle}>Summary</Text>
								<View style={styles.summaryGrid}>
									{Object.entries(data.summary).map(([key, value]) => {
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

						{/* Users Table */}
						{type === "users" && data.recentUsers && (
							<View style={styles.section}>
								<Text style={styles.sectionTitle}>Recent Users</Text>
								<View style={styles.table}>
									<View style={[styles.tableRow, styles.tableHeader]}>
										<Text style={[styles.tableCell, { width: "25%" }]}>
											Name
										</Text>
										<Text style={[styles.tableCell, { width: "35%" }]}>
											Email
										</Text>
										<Text style={[styles.tableCell, { width: "20%" }]}>
											Type
										</Text>
										<Text style={[styles.tableCell, { width: "20%" }]}>
											Created
										</Text>
									</View>
									{data.recentUsers.slice(0, 15).map((user, idx) => (
										<View key={idx} style={styles.tableRow}>
											<Text style={[styles.tableCell, { width: "25%" }]}>
												{user.name}
											</Text>
											<Text style={[styles.tableCell, { width: "35%" }]}>
												{user.email}
											</Text>
											<Text style={[styles.tableCell, { width: "20%" }]}>
												{user.userType}
											</Text>
											<Text style={[styles.tableCell, { width: "20%" }]}>
												{user.createdAt}
											</Text>
										</View>
									))}
								</View>
							</View>
						)}

						{/* Properties Tables */}
						{type === "properties" && (
							<>
								{data.topRated && data.topRated.length > 0 && (
									<View style={styles.section}>
										<Text style={styles.sectionTitle}>
											Top Rated Properties
										</Text>
										<View style={styles.table}>
											<View style={[styles.tableRow, styles.tableHeader]}>
												<Text style={[styles.tableCell, { width: "40%" }]}>
													Title
												</Text>
												<Text style={[styles.tableCell, { width: "15%" }]}>
													Rating
												</Text>
												<Text style={[styles.tableCell, { width: "20%" }]}>
													Reviews
												</Text>
												<Text style={[styles.tableCell, { width: "25%" }]}>
													Category
												</Text>
											</View>
											{data.topRated.map((prop, idx) => (
												<View key={idx} style={styles.tableRow}>
													<Text style={[styles.tableCell, { width: "40%" }]}>
														{prop.title}
													</Text>
													<Text style={[styles.tableCell, { width: "15%" }]}>
														{prop.rating}
													</Text>
													<Text style={[styles.tableCell, { width: "20%" }]}>
														{prop.reviews}
													</Text>
													<Text style={[styles.tableCell, { width: "25%" }]}>
														{prop.category}
													</Text>
												</View>
											))}
										</View>
									</View>
								)}

								{data.needsAttention && data.needsAttention.length > 0 && (
									<View style={styles.section}>
										<Text style={styles.sectionTitle}>⚠️ Needs Attention</Text>
										<View style={styles.table}>
											<View style={[styles.tableRow, styles.tableHeader]}>
												<Text style={[styles.tableCell, { width: "40%" }]}>
													Title
												</Text>
												<Text style={[styles.tableCell, { width: "15%" }]}>
													Rating
												</Text>
												<Text style={[styles.tableCell, { width: "20%" }]}>
													Reviews
												</Text>
												<Text style={[styles.tableCell, { width: "25%" }]}>
													Category
												</Text>
											</View>
											{data.needsAttention.map((prop, idx) => (
												<View key={idx} style={styles.tableRow}>
													<Text style={[styles.tableCell, { width: "40%" }]}>
														{prop.title}
													</Text>
													<Text style={[styles.tableCell, { width: "15%" }]}>
														{prop.rating}
													</Text>
													<Text style={[styles.tableCell, { width: "20%" }]}>
														{prop.reviews}
													</Text>
													<Text style={[styles.tableCell, { width: "25%" }]}>
														{prop.category}
													</Text>
												</View>
											))}
										</View>
									</View>
								)}

								{data.allProperties && data.allProperties.length > 0 && (
									<View style={styles.section} break>
										<Text style={styles.sectionTitle}>
											📋 All Properties ({data.allProperties.length} total)
										</Text>
										<View style={styles.table}>
											<View style={[styles.tableRow, styles.tableHeader]}>
												<Text style={[styles.tableCell, { width: "30%" }]}>
													Title
												</Text>
												<Text style={[styles.tableCell, { width: "20%" }]}>
													Host
												</Text>
												<Text style={[styles.tableCell, { width: "12%" }]}>
													Rating
												</Text>
												<Text style={[styles.tableCell, { width: "15%" }]}>
													Reviews
												</Text>
												<Text style={[styles.tableCell, { width: "23%" }]}>
													Category
												</Text>
											</View>
											{data.allProperties.map((prop, idx) => (
												<View key={idx} style={styles.tableRow}>
													<Text style={[styles.tableCell, { width: "30%" }]}>
														{prop.title}
													</Text>
													<Text style={[styles.tableCell, { width: "20%" }]}>
														{prop.host}
													</Text>
													<Text style={[styles.tableCell, { width: "12%" }]}>
														{prop.rating}
													</Text>
													<Text style={[styles.tableCell, { width: "15%" }]}>
														{prop.reviews}
													</Text>
													<Text style={[styles.tableCell, { width: "23%" }]}>
														{prop.category}
													</Text>
												</View>
											))}
										</View>
									</View>
								)}
							</>
						)}

						{/* Bookings Table */}
						{type === "bookings" && data.recentBookings && (
							<View style={styles.section}>
								<Text style={styles.sectionTitle}>Recent Bookings</Text>
								<View style={styles.table}>
									<View style={[styles.tableRow, styles.tableHeader]}>
										<Text style={[styles.tableCell, { width: "25%" }]}>
											Guest
										</Text>
										<Text style={[styles.tableCell, { width: "30%" }]}>
											Property
										</Text>
										<Text style={[styles.tableCell, { width: "20%" }]}>
											Check-in
										</Text>
										<Text style={[styles.tableCell, { width: "15%" }]}>
											Status
										</Text>
										<Text style={[styles.tableCell, { width: "10%" }]}>
											Amount
										</Text>
									</View>
									{data.recentBookings.slice(0, 15).map((booking, idx) => (
										<View key={idx} style={styles.tableRow}>
											<Text style={[styles.tableCell, { width: "25%" }]}>
												{booking.guest}
											</Text>
											<Text style={[styles.tableCell, { width: "30%" }]}>
												{booking.property}
											</Text>
											<Text style={[styles.tableCell, { width: "20%" }]}>
												{booking.checkIn}
											</Text>
											<Text style={[styles.tableCell, { width: "15%" }]}>
												{booking.status}
											</Text>
											<Text style={[styles.tableCell, { width: "10%" }]}>
												₱{booking.amount}
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
			link.download = `${title.replace(/ /g, "_")}_${timestamp}.pdf`
			document.body.appendChild(link)
			link.click()
			document.body.removeChild(link)
			URL.revokeObjectURL(url)

			toast.success(`📄 ${title} exported as PDF!`)
			setReportModal({ isOpen: false, type: "", data: null, title: "" })
		} catch (err) {
			console.error("Error exporting PDF:", err)
			toast.error(
				"Failed to export PDF. Make sure @react-pdf/renderer is installed."
			)
		}
	}

	if (loading) {
		return (
			<div className="admin-loading">
				<div className="loading-spinner"></div>
				<p>Loading admin dashboard...</p>
			</div>
		)
	}

	return (
		<div className="admin-dashboard">
			<header className="admin-header">
				<div className="admin-header-content">
					<div className="admin-header-left">
						<button
							className="sidebar-toggle"
							onClick={() => setSidebarOpen(!sidebarOpen)}
						>
							<span className="hamburger-icon">{sidebarOpen ? "✕" : "☰"}</span>
						</button>
						<h1>📊 Admin Dashboard</h1>
					</div>
					<div className="admin-user-info">
						<span>Welcome, {userData?.displayName || "Admin"}</span>

						<button onClick={handleLogout} className="logout-btn">
							Logout
						</button>
					</div>
				</div>
			</header>

			{/* Sidebar Navigation */}
			<aside className={`admin-sidebar ${sidebarOpen ? "open" : "closed"}`}>
				<nav className="sidebar-nav">
					<button
						className={`sidebar-item ${
							activeTab === "dashboard" ? "active" : ""
						}`}
						onClick={() => handleTabChange("dashboard")}
					>
						<span className="sidebar-icon">📊</span>
						<span className="sidebar-text">Dashboard</span>
					</button>
					<button
						className={`sidebar-item ${
							activeTab === "manageHost" ? "active" : ""
						}`}
						onClick={() => handleTabChange("manageHost")}
					>
						<span className="sidebar-icon">👥</span>
						<span className="sidebar-text">Manage Host</span>
					</button>
					<button
						className={`sidebar-item ${
							activeTab === "flagging" ? "active" : ""
						}`}
						onClick={() => handleTabChange("flagging")}
					>
						<span className="sidebar-icon">🚩</span>
						<span className="sidebar-text">Flagging</span>
					</button>
					<button
						className={`sidebar-item ${
							activeTab === "policy" ? "active" : ""
						}`}
						onClick={() => handleTabChange("policy")}
					>
						<span className="sidebar-icon">📋</span>
						<span className="sidebar-text">Policy</span>
					</button>
					<button
						className={`sidebar-item ${
							activeTab === "reports" ? "active" : ""
						}`}
						onClick={() => handleTabChange("reports")}
					>
						<span className="sidebar-icon">📄</span>
						<span className="sidebar-text">Generate Reports</span>
					</button>
					<button
						className={`sidebar-item ${activeTab === "promos" ? "active" : ""}`}
						onClick={() => handleTabChange("promos")}
					>
						<span className="sidebar-icon">🎁</span>
						<span className="sidebar-text">Promos</span>
					</button>
					<button
						className={`sidebar-item ${activeTab === "wallet" ? "active" : ""}`}
						onClick={() => handleTabChange("wallet")}
					>
						<span className="sidebar-icon">💰</span>
						<span className="sidebar-text">E-Wallet</span>
					</button>
				</nav>
			</aside>

			{/* Sidebar Overlay for Mobile */}
			<div
				className={`sidebar-overlay ${sidebarOpen ? "active" : ""}`}
				onClick={() => setSidebarOpen(false)}
			/>

			<main
				className={`admin-main ${
					sidebarOpen ? "sidebar-open" : "sidebar-closed"
				}`}
			>
				{/* Dashboard Content */}
				{activeTab === "dashboard" && (
					<>
						{/* Bento Box Grid Layout */}
						<div className="bento-grid">
							{/* Quick Stats - Row 1 */}
							<div className="bento-card stats-overview">
								<h2>📈 Overview</h2>
								<div className="mini-stats">
									<div className="mini-stat">
										<div className="mini-stat-icon">👥</div>
										<div>
											<h3>{stats.totalUsers}</h3>
											<p>Total Users</p>
										</div>
									</div>
									<div className="mini-stat">
										<div className="mini-stat-icon">🏠</div>
										<div>
											<h3>{stats.totalProperties}</h3>
											<p>Properties</p>
										</div>
									</div>
									<div className="mini-stat">
										<div className="mini-stat-icon">📅</div>
										<div>
											<h3>{stats.totalBookings}</h3>
											<p>Bookings</p>
										</div>
									</div>
									<div className="mini-stat">
										<div className="mini-stat-icon">💰</div>
										<div>
											<h3>₱{stats.totalRevenue.toLocaleString()}</h3>
											<p>Revenue</p>
										</div>
									</div>
								</div>
							</div>

							{/* Bookings Chart */}
							<div className="bento-card chart-card">
								<h2>📊 Bookings Trend (Last 7 Days)</h2>
								{chartData.bookings && (
									<Line
										data={chartData.bookings}
										options={{
											responsive: true,
											maintainAspectRatio: false,
											animation: {
												duration: 1000,
												easing: "easeInOutQuart",
											},
											interaction: {
												intersect: false,
												mode: "index",
											},
											plugins: {
												legend: {
													display: false,
												},
												tooltip: {
													enabled: true,
													backgroundColor: "rgba(65, 95, 148, 0.95)",
													titleColor: "#ffffff",
													bodyColor: "#ffffff",
													borderColor: "#415F94",
													borderWidth: 2,
													cornerRadius: 12,
													padding: 12,
													displayColors: true,
													titleFont: {
														size: 14,
														weight: "bold",
													},
													bodyFont: {
														size: 13,
														weight: "normal",
													},
													boxPadding: 8,
													usePointStyle: true,
													callbacks: {
														title: (context) => {
															return context[0].label || "Data Point"
														},
														label: (context) => {
															return `Bookings: ${context.parsed.y}`
														},
													},
													animation: {
														duration: 200,
													},
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
											elements: {
												point: {
													radius: 4,
													hoverRadius: 8,
													hoverBorderWidth: 3,
													hoverBorderColor: "#415F94",
												},
												line: {
													tension: 0.4,
													borderWidth: 3,
													hoverBorderWidth: 4,
												},
											},
										}}
									/>
								)}
							</div>

							{/* Revenue Chart */}
							<div className="bento-card chart-card">
								<h2>💵 Revenue Trend (Last 7 Days)</h2>
								{chartData.revenue && (
									<Bar
										data={chartData.revenue}
										options={{
											responsive: true,
											maintainAspectRatio: false,
											animation: {
												duration: 1000,
												easing: "easeInOutQuart",
											},
											interaction: {
												intersect: false,
												mode: "index",
											},
											plugins: {
												legend: {
													display: false,
												},
												tooltip: {
													enabled: true,
													backgroundColor: "rgba(65, 95, 148, 0.95)",
													titleColor: "#ffffff",
													bodyColor: "#ffffff",
													borderColor: "#415F94",
													borderWidth: 2,
													cornerRadius: 12,
													padding: 12,
													displayColors: true,
													titleFont: {
														size: 14,
														weight: "bold",
													},
													bodyFont: {
														size: 13,
														weight: "normal",
													},
													boxPadding: 8,
													usePointStyle: true,
													callbacks: {
														title: (context) => {
															return context[0].label || "Data Point"
														},
														label: (context) => {
															return `Revenue: PHP ${context.parsed.y.toLocaleString()}`
														},
													},
													animation: {
														duration: 200,
													},
												},
											},
											scales: {
												y: {
													beginAtZero: true,
												},
											},
											elements: {
												bar: {
													borderRadius: 6,
													borderSkipped: false,
													hoverBorderWidth: 2,
													hoverBorderColor: "#415F94",
												},
											},
											onHover: (event, activeElements) => {
												event.native.target.style.cursor = activeElements.length
													? "pointer"
													: "default"
											},
										}}
									/>
								)}
							</div>

							{/* Property Types Distribution */}
							<div className="bento-card donut-card">
								<h2>🏘️ Property Distribution</h2>
								{chartData.propertyTypes && (
									<Doughnut
										data={chartData.propertyTypes}
										options={{
											responsive: true,
											maintainAspectRatio: false,
											animation: {
												duration: 1000,
												easing: "easeInOutQuart",
												animateRotate: true,
												animateScale: true,
											},
											interaction: {
												intersect: true,
											},
											plugins: {
												legend: {
													position: "bottom",
													labels: {
														usePointStyle: true,
														padding: 15,
														font: {
															size: 12,
														},
													},
												},
												tooltip: {
													enabled: true,
													backgroundColor: "rgba(65, 95, 148, 0.95)",
													titleColor: "#ffffff",
													bodyColor: "#ffffff",
													borderColor: "#415F94",
													borderWidth: 2,
													cornerRadius: 12,
													padding: 12,
													displayColors: true,
													titleFont: {
														size: 14,
														weight: "bold",
													},
													bodyFont: {
														size: 13,
														weight: "normal",
													},
													boxPadding: 8,
													usePointStyle: true,
													callbacks: {
														title: (context) => {
															return context[0].label || "Category"
														},
														label: (context) => {
															const label = context.label || ""
															const value = context.parsed || 0
															const total = context.dataset.data.reduce(
																(a, b) => a + b,
																0
															)
															const percentage = ((value / total) * 100).toFixed(1)
															return `${label}: ${value} (${percentage}%)`
														},
													},
													animation: {
														duration: 200,
													},
												},
											},
											elements: {
												arc: {
													borderWidth: 2,
													hoverBorderWidth: 4,
													hoverOffset: 8,
												},
											},
											onHover: (event, activeElements) => {
												event.native.target.style.cursor = activeElements.length
													? "pointer"
													: "default"
											},
										}}
									/>
								)}
							</div>

							{/* Best Reviews */}
							<div className="bento-card reviews-card">
								<h2>⭐ Top Rated Properties</h2>
								<div className="reviews-list">
									{bestReviews.length === 0 ? (
										<div className="empty-state">
											<p>No properties yet</p>
										</div>
									) : (
										bestReviews.map((property) => (
											<div key={property.id} className="review-item">
												<img
													src={property.images?.[0] || "/placeholder.png"}
													alt={property.title}
												/>
												<div className="review-info">
													<h4>{property.title}</h4>
													<div className="review-rating">
														<span>⭐ {property.rating || 0}</span>
														<span className="review-count">
															({property.reviewsCount || 0} reviews)
														</span>
													</div>
												</div>
											</div>
										))
									)}
								</div>
							</div>

							{/* Lowest Reviews */}
							<div className="bento-card reviews-card">
								<h2>⚠️ Needs Attention</h2>
								<div className="reviews-list">
									{lowestReviews.length === 0 ? (
										<div className="empty-state">
											<p>No properties yet</p>
										</div>
									) : (
										lowestReviews.map((property) => (
											<div key={property.id} className="review-item">
												<img
													src={property.images?.[0] || "/placeholder.png"}
													alt={property.title}
												/>
												<div className="review-info">
													<h4>{property.title}</h4>
													<div className="review-rating">
														<span>⭐ {property.rating || 0}</span>
														<span className="review-count">
															({property.reviewsCount || 0} reviews)
														</span>
													</div>
												</div>
											</div>
										))
									)}
								</div>
							</div>

							{/* Recent Bookings */}
							<div className="bento-card bookings-card">
								<h2>📝 Recent Bookings</h2>
								<div className="bookings-table-wrapper">
									{recentBookings.length === 0 ? (
										<div className="empty-state">
											<p>No bookings yet</p>
										</div>
									) : (
										<table className="bookings-table">
											<thead>
												<tr>
													<th>Guest</th>
													<th>Property</th>
													<th>Status</th>
													<th>Amount</th>
												</tr>
											</thead>
											<tbody>
												{recentBookings.map((booking) => (
													<tr key={booking.id}>
														<td>{booking.guestName || "N/A"}</td>
														<td>{booking.propertyTitle || "N/A"}</td>
														<td>
															<span
																className={`booking-status ${
																	booking.status || "pending"
																}`}
															>
																{booking.status || "pending"}
															</span>
														</td>
														<td>
															₱{(booking.pricing?.total || 0).toLocaleString()}
														</td>
													</tr>
												))}
											</tbody>
										</table>
									)}
								</div>
							</div>

							{/* Payment Review Section */}
						</div>
					</>
				)}

				{/* Policy Tab - Combined Policies, Terms & Conditions, and Privacy Policy */}
				{activeTab === "policy" && (
					<div className="content-section policy-section">
						<div className="section-header policy-header">
							<div className="policy-header-content">
								<div className="policy-header-text">
									<h2>📋 Policy Management</h2>
									<p>Manage platform policies, terms, and privacy settings</p>
								</div>
								<button
									className="export-policy-btn"
									onClick={handleExportAllPolicies}
									title="Export all policies to PDF"
								>
									<span className="export-icon">📄</span>
									<span className="export-text">Export All Policy</span>
								</button>
							</div>
						</div>

						{/* Internal Navigation Tabs */}
						<div className="policy-subtabs">
							<button
								className={`policy-subtab ${
									activePolicySubTab === "policies" ? "active" : ""
								}`}
								onClick={() => setActivePolicySubTab("policies")}
							>
								<span className="subtab-icon">📋</span>
								<span className="subtab-text">Policies & Compliance</span>
							</button>
							<button
								className={`policy-subtab ${
									activePolicySubTab === "terms" ? "active" : ""
								}`}
								onClick={() => setActivePolicySubTab("terms")}
							>
								<span className="subtab-icon">📜</span>
								<span className="subtab-text">Terms & Conditions</span>
							</button>
							<button
								className={`policy-subtab ${
									activePolicySubTab === "privacy" ? "active" : ""
								}`}
								onClick={() => setActivePolicySubTab("privacy")}
							>
								<span className="subtab-icon">🔒</span>
								<span className="subtab-text">Privacy Policy</span>
							</button>
						</div>

						{/* Policies & Compliance Sub-Tab */}
						{activePolicySubTab === "policies" && (
							<div className="policies-subsection">

						{/* Service Fees Configuration */}
						<div className="policy-card">
							<h3>💰 Service Fee Structure</h3>
							<div className="fee-config">
								<div className="fee-item">
									<label>
										<strong>Guest Service Fee</strong>
										<span className="fee-description">
											Fixed fee charged to guests on each booking
										</span>
									</label>
									<div className="fee-input">
										<span className="fee-unit">₱</span>
										<input
											type="number"
											value={policies.serviceFeeGuest}
											onChange={(e) =>
												setPolicies({
													...policies,
													serviceFeeGuest: parseFloat(e.target.value),
												})
											}
											min="0"
											step="50"
										/>
									</div>
								</div>
								<div className="fee-item">
									<label>
										<strong>Guest Fee (Per Person):</strong>
										<span className="fee-description">
											Additional charge per guest for bookings
										</span>
									</label>
									<div className="fee-input">
										<span className="fee-unit">₱</span>
										<input
											type="number"
											value={policies.guestFeePerPerson}
											onChange={(e) =>
												setPolicies({
													...policies,
													guestFeePerPerson: parseFloat(e.target.value),
												})
											}
											min="0"
											step="50"
										/>
									</div>
								</div>
								<button
									className="save-policies-btn"
									onClick={handleUpdatePolicies}
								>
									Save Fee Changes
								</button>
							</div>
						</div>

						{/* Property Listing Rules */}
						<div className="policy-card">
							<h3>🏠 Property Listing Rules</h3>
							<div className="policy-content">
								<div className="policy-item">
									<h4>Listing Requirements</h4>
									<ul>
										<li>
											All properties must have at least 1 high-quality photo
										</li>
										<li>Accurate description with minimum 100 characters</li>
										<li>Complete amenities list and house rules</li>
										<li>Valid address and location coordinates</li>
										<li>
											Clear pricing structure (base price, cleaning fee,
											additional fees)
										</li>
										<li>Calendar availability must be updated regularly</li>
									</ul>
								</div>
								<div className="policy-item">
									<h4>Property Standards</h4>
									<ul>
										<li>Properties must meet basic safety standards</li>
										<li>Accurate representation of space and amenities</li>
										<li>Must comply with local regulations and laws</li>
										<li>No misleading or false information</li>
									</ul>
								</div>
							</div>
						</div>

						{/* Subscription Removal Policy */}
						<div className="policy-card warning-card">
							<h3>⚠️ Subscription Removal Policy</h3>
							<div className="policy-content">
								<div className="policy-item">
									<h4>Subscription Removal</h4>
									<ul>
										<li>
											<strong>Low Rating:</strong> Hosts with average rating
											below{" "}
											<input
												type="number"
												className="inline-input"
												value={policies.minPropertyRating}
												onChange={(e) =>
													setPolicies({
														...policies,
														minPropertyRating: parseFloat(e.target.value),
													})
												}
												min="1"
												max="5"
												step="0.1"
											/>{" "}
											stars for 3 consecutive months
										</li>
										<li>
											<strong>Violation of Terms:</strong> Any breach of
											community standards or terms of service
										</li>
										<li>
											<strong>Inactive Listings:</strong> No calendar updates
											for 90+ days
										</li>
										<li>
											<strong>Fraudulent Activity:</strong> Detected scams, fake
											listings, or payment fraud
										</li>
									</ul>
								</div>
								<div className="policy-item">
									<h4>Removal Process</h4>
									<ol>
										<li>Warning notification sent to host</li>
										<li>30-day period to resolve issues</li>
										<li>If unresolved, listing is suspended</li>
										<li>Host can appeal within 14 days</li>
										<li>Final decision made by admin review</li>
									</ol>
								</div>
							</div>
						</div>

						{/* Cancellation Rules */}
						<div className="policy-card">
							<h3>🔄 Cancellation Rules</h3>
							<div className="policy-content">
								<div className="policy-item">
									<h4>Guest Cancellation Policy</h4>
									<ul>
										<li>
											<strong>Flexible:</strong> Full refund if cancelled{" "}
											<input
												type="number"
												className="inline-input"
												value={policies.cancellationWindowHours}
												onChange={(e) =>
													setPolicies({
														...policies,
														cancellationWindowHours: parseInt(e.target.value),
													})
												}
												min="24"
												max="168"
											/>{" "}
											hours before check-in
										</li>
										<li>
											<strong>Strict:</strong> No cancellation after book confirming
										</li>
										<li>Service fees are non-refundable in all cases</li>
									</ul>
								</div>
								<div className="policy-item">
									<h4>Host Cancellation Policy</h4>
									<ul>
										<li>Host cancellations are strongly discouraged</li>
										<li>Guest receives full refund including all fees</li>
									</ul>
								</div>
							</div>
						</div>

						{/* Rules and Regulations */}
						<div className="policy-card">
							<h3>📏 Platform Rules & Regulations</h3>
							<div className="policy-content">
								<div className="policy-item">
									<h4>Host Obligations</h4>
									<ul>
										<li>Respond to booking inquiries within 24 hours</li>
										<li>Maintain property as described in listing</li>
										<li>Provide check-in instructions before arrival</li>
										<li>Be available for guest support during stay</li>
										<li>Report any property damage or issues immediately</li>
										<li>Keep calendar updated and accurate</li>
									</ul>
								</div>
								<div className="policy-item">
									<h4>Guest Obligations</h4>
									<ul>
										<li>Treat property with respect and care</li>
										<li>Follow house rules set by host</li>
										<li>Report any issues or damages immediately</li>
										<li>Complete booking checkout procedures</li>
										<li>Leave honest and constructive reviews</li>
										<li>Number of guests must not exceed listing capacity</li>
									</ul>
								</div>
								<div className="policy-item">
									<h4>Prohibited Activities</h4>
									<ul>
										<li>Off-platform transactions or payments</li>
										<li>
											Discrimination based on race, religion, gender, etc.
										</li>
										<li>Fraudulent listings or misrepresentation</li>
										<li>Hosting commercial events without permission</li>
										<li>Subletting or unauthorized property use</li>
										<li>Harassment or inappropriate behavior</li>
									</ul>
								</div>
							</div>
						</div>

						{/* Community Standards */}
						<div className="policy-card">
							<h3>🤝 Community Standards</h3>
							<div className="policy-content">
								<div className="policy-item">
									<h4>Safety & Security</h4>
									<ul>
										<li>All properties must have working smoke detectors</li>
										<li>Fire extinguishers required for all listings</li>
										<li>Emergency contact information must be provided</li>
										<li>Secure entry systems recommended</li>
										<li>Report suspicious activity immediately</li>
									</ul>
								</div>
								<div className="policy-item">
									<h4>Trust & Verification</h4>
									<ul>
										<li>Email verification required for all users</li>
										<li>Phone verification recommended</li>
										<li>Government ID verification for hosts</li>
										<li>Professional photography encouraged</li>
										<li>Accurate property descriptions mandatory</li>
									</ul>
								</div>
							</div>
						</div>

								<button
									className="save-policies-btn primary"
									onClick={handleUpdatePolicies}
								>
									💾 Save All Policy Changes
								</button>
							</div>
						)}

						{/* Terms & Conditions Sub-Tab */}
						{activePolicySubTab === "terms" && (
							<div className="terms-subsection">
								<div className="legal-document">
							<div className="legal-section">
								<h3>1. Acceptance of Terms</h3>
								<p>
									By accessing and using AuraStays ("the Platform"), you accept
									and agree to be bound by these Terms and Conditions. If you do
									not agree to these terms, please do not use our services.
								</p>
							</div>

							<div className="legal-section">
								<h3>2. User Accounts</h3>
								<h4>2.1 Account Creation</h4>
								<ul>
									<li>
										Users must provide accurate and complete registration
										information
									</li>
									<li>Users must be at least 18 years of age</li>
									<li>
										One account per user; multiple accounts are prohibited
									</li>
									<li>Account credentials must be kept confidential</li>
								</ul>
								<h4>2.2 Account Responsibilities</h4>
								<ul>
									<li>
										Users are responsible for all activities under their account
									</li>
									<li>
										Users must notify us immediately of any unauthorized access
									</li>
									<li>
										We reserve the right to suspend or terminate accounts for
										violations
									</li>
								</ul>
							</div>

							<div className="legal-section">
								<h3>3. Host Terms</h3>
								<h4>3.1 Listing Creation</h4>
								<ul>
									<li>
										Hosts must have legal right to list and rent the property
									</li>
									<li>
										All listing information must be accurate and up-to-date
									</li>
									<li>Hosts must comply with local laws and regulations</li>
									<li>
										Hosts are responsible for obtaining necessary permits and
										licenses
									</li>
								</ul>
								<h4>3.2 Host Fees & Payments</h4>
								<ul>
									<li>
										Hosts agree to pay a service fee of{" "}
										{policies.serviceFeeHost}% per booking
									</li>
									<li>Hosts are responsible for applicable taxes</li>
								</ul>
							</div>

							<div className="legal-section">
								<h3>4. Guest Terms</h3>
								<h4>4.1 Booking & Reservations</h4>
								<ul>
									<li>
										Guests must book properties for personal, non-commercial use
									</li>
									<li>Number of guests cannot exceed listing capacity</li>
									<li>Guests must follow house rules set by hosts</li>
									<li>Bookings are subject to host acceptance</li>
								</ul>
								<h4>4.2 Guest Fees & Payments</h4>
								<ul>
									<li>
										Guests agree to pay a service fee of ₱
										{policies.serviceFeeGuest} per booking
									</li>
									<li>
										Guest fee of ₱{policies.guestFeePerPerson} per person for
										all bookings
									</li>
									<li>All charges must be paid in full at time of booking</li>
									<li>
										Payment is processed securely through approved methods
									</li>
									<li>Guests responsible for any damage caused during stay</li>
								</ul>
								<h4>4.3 E-Wallet & Withdrawals</h4>
								<ul>
									<li>
										Users can maintain an e-wallet balance for booking payments
									</li>
									<li>
										E-wallet can be topped up using approved payment methods
									</li>
									<li>
										Withdrawal requests are subject to a{" "}
										{policies.walletWithdrawalFee}% processing fee
									</li>
									<li>Minimum withdrawal amount is ₱100</li>
									<li>Withdrawals are processed instantly to PayPal</li>
									<li>
										Users are responsible for maintaining valid PayPal account
										details
									</li>
								</ul>
							</div>

							<div className="legal-section">
								<h3>5. Cancellations & Refunds</h3>
								<ul>
									<li>
										Cancellation policies vary by listing (Flexible, Moderate,
										Strict)
									</li>
									<li>
										Refund amount depends on cancellation policy and timing
									</li>
									<li>
										Service fees are non-refundable except in special
										circumstances
									</li>
									<li>Host cancellations result in full refund to guests</li>
								</ul>
							</div>

							<div className="legal-section">
								<h3>6. Prohibited Activities</h3>
								<ul>
									<li>No fraudulent, illegal, or harmful activities</li>
									<li>No discrimination or harassment</li>
									<li>No unauthorized commercial use of properties</li>
									<li>No circumventing platform for direct bookings</li>
									<li>No false reviews or manipulation of ratings</li>
								</ul>
							</div>

							<div className="legal-section">
								<h3>7. Liability & Disclaimers</h3>
								<h4>7.1 Platform Liability</h4>
								<ul>
									<li>
										AuraStays acts as an intermediary between hosts and guests
									</li>
									<li>We do not own, manage, or control listed properties</li>
									<li>We are not responsible for host or guest conduct</li>
									<li>Use of platform is at user's own risk</li>
								</ul>
								<h4>7.2 Limitation of Liability</h4>
								<ul>
									<li>
										We are not liable for indirect, incidental, or consequential
										damages
									</li>
									<li>
										Total liability limited to amount paid for the booking
									</li>
									<li>
										We do not guarantee availability or accuracy of listings
									</li>
								</ul>
							</div>

							<div className="legal-section">
								<h3>8. Intellectual Property</h3>
								<ul>
									<li>All platform content is property of AuraStays</li>
									<li>Users retain ownership of their uploaded content</li>
									<li>
										Users grant us license to use content for platform
										operations
									</li>
									<li>Unauthorized use of platform content is prohibited</li>
								</ul>
							</div>

							<div className="legal-section">
								<h3>9. Dispute Resolution</h3>
								<ul>
									<li>
										Users agree to attempt good-faith resolution of disputes
									</li>
									<li>
										Platform may mediate disputes between hosts and guests
									</li>
									<li>Unresolved disputes subject to binding arbitration</li>
									<li>Legal actions must be filed in our jurisdiction</li>
								</ul>
							</div>

							<div className="legal-section">
								<h3>10. Modifications to Terms</h3>
								<ul>
									<li>
										We reserve the right to modify these terms at any time
									</li>
									<li>Users will be notified of significant changes</li>
									<li>Continued use after changes constitutes acceptance</li>
									<li>
										Users may terminate account if they disagree with changes
									</li>
								</ul>
							</div>

							<div className="legal-section">
								<h3>11. Termination</h3>
								<ul>
									<li>We may terminate or suspend accounts for violations</li>
									<li>Users may close their accounts at any time</li>
									<li>Obligations survive account termination</li>
									<li>
										Outstanding payments must be settled before termination
									</li>
								</ul>
							</div>

							<div className="legal-section">
								<h3>12. Contact Information</h3>
								<p>For questions about these terms, contact us at:</p>
								<ul>
									<li>Email: legal@aurastays.com</li>
									<li>Phone: +63 123 456 7890</li>
									<li>Address: Manila, Philippines</li>
								</ul>
							</div>

									<div className="legal-footer">
										<p>
											<strong>Last Updated:</strong>{" "}
											{new Date().toLocaleDateString()}
										</p>
										<p>
											<em>
												By using AuraStays, you agree to these Terms & Conditions
											</em>
										</p>
									</div>
								</div>
							</div>
						)}

						{/* Privacy Policy Sub-Tab */}
						{activePolicySubTab === "privacy" && (
							<div className="privacy-subsection">
								<div className="legal-document">
							<div className="legal-section">
								<h3>1. Introduction</h3>
								<p>
									AuraStays ("we," "our," or "us") is committed to protecting
									your privacy. This Privacy Policy explains how we collect,
									use, disclose, and safeguard your information when you use our
									platform.
								</p>
							</div>

							<div className="legal-section">
								<h3>2. Information We Collect</h3>
								<h4>2.1 Information You Provide</h4>
								<ul>
									<li>
										<strong>Account Information:</strong> Name, email, phone
										number, date of birth, gender
									</li>
									<li>
										<strong>Profile Information:</strong> Profile picture, bio,
										preferences
									</li>
									<li>
										<strong>Payment Information:</strong> Credit card details,
										PayPal account (processed securely)
									</li>
									<li>
										<strong>Identity Verification:</strong> Government ID,
										address verification
									</li>
									<li>
										<strong>Communications:</strong> Messages, reviews, support
										inquiries
									</li>
								</ul>
								<h4>2.2 Automatically Collected Information</h4>
								<ul>
									<li>
										<strong>Device Information:</strong> IP address, browser
										type, device type
									</li>
									<li>
										<strong>Usage Data:</strong> Pages visited, search queries,
										booking history
									</li>
									<li>
										<strong>Location Data:</strong> GPS location (with
										permission)
									</li>
									<li>
										<strong>Cookies:</strong> Session data, preferences,
										analytics
									</li>
								</ul>
								<h4>2.3 Information from Third Parties</h4>
								<ul>
									<li>Social media profiles (if you connect accounts)</li>
									<li>Payment processors (transaction data)</li>
									<li>Background check services (for hosts)</li>
								</ul>
							</div>

							<div className="legal-section">
								<h3>3. How We Use Your Information</h3>
								<h4>3.1 Platform Operations</h4>
								<ul>
									<li>Create and manage user accounts</li>
									<li>Process bookings and payments</li>
									<li>Facilitate communication between hosts and guests</li>
									<li>Provide customer support</li>
									<li>Verify identities and prevent fraud</li>
								</ul>
								<h4>3.2 Improvement & Personalization</h4>
								<ul>
									<li>Personalize search results and recommendations</li>
									<li>Analyze usage patterns and trends</li>
									<li>Improve platform features and functionality</li>
									<li>Conduct research and analytics</li>
								</ul>
								<h4>3.3 Communications</h4>
								<ul>
									<li>Send booking confirmations and updates</li>
									<li>Notify about account activity</li>
									<li>Send promotional emails (opt-out available)</li>
									<li>Provide customer support responses</li>
								</ul>
								<h4>3.4 Legal & Safety</h4>
								<ul>
									<li>Comply with legal obligations</li>
									<li>Enforce terms and policies</li>
									<li>Protect against fraud and abuse</li>
									<li>Resolve disputes</li>
								</ul>
							</div>

							<div className="legal-section">
								<h3>4. Information Sharing</h3>
								<h4>4.1 With Other Users</h4>
								<ul>
									<li>Public profile information (name, photo, reviews)</li>
									<li>Booking details shared with hosts/guests</li>
									<li>Messages and communications</li>
								</ul>
								<h4>4.2 With Service Providers</h4>
								<ul>
									<li>Payment processors (secure transaction handling)</li>
									<li>Cloud hosting providers (data storage)</li>
									<li>Analytics services (usage insights)</li>
									<li>Email service providers (communications)</li>
								</ul>
								<h4>4.3 Legal Requirements</h4>
								<ul>
									<li>Law enforcement (when required by law)</li>
									<li>Court orders and legal processes</li>
									<li>Protection of rights and safety</li>
								</ul>
								<h4>4.4 Business Transfers</h4>
								<ul>
									<li>Mergers, acquisitions, or asset sales</li>
									<li>Users will be notified of any ownership changes</li>
								</ul>
							</div>

							<div className="legal-section">
								<h3>5. Data Security</h3>
								<ul>
									<li>Industry-standard encryption (SSL/TLS)</li>
									<li>Secure password hashing and storage</li>
									<li>Regular security audits and updates</li>
									<li>Access controls and authentication</li>
									<li>Payment data handled by PCI-compliant processors</li>
									<li>Employee training on data protection</li>
								</ul>
								<p>
									<em>
										Note: While we implement strong security measures, no system
										is 100% secure. Users should maintain strong passwords and
										protect account credentials.
									</em>
								</p>
							</div>

							<div className="legal-section">
								<h3>6. Your Privacy Rights</h3>
								<h4>6.1 Access & Control</h4>
								<ul>
									<li>
										<strong>Access:</strong> Request copy of your personal data
									</li>
									<li>
										<strong>Correction:</strong> Update inaccurate information
									</li>
									<li>
										<strong>Deletion:</strong> Request account and data deletion
									</li>
									<li>
										<strong>Portability:</strong> Export your data
									</li>
									<li>
										<strong>Opt-Out:</strong> Unsubscribe from marketing emails
									</li>
								</ul>
								<h4>6.2 How to Exercise Rights</h4>
								<ul>
									<li>Access account settings to update information</li>
									<li>Contact privacy@aurastays.com for requests</li>
									<li>Response provided within 30 days</li>
								</ul>
							</div>

							<div className="legal-section">
								<h3>7. Cookies & Tracking</h3>
								<h4>7.1 Types of Cookies We Use</h4>
								<ul>
									<li>
										<strong>Essential Cookies:</strong> Required for platform
										functionality
									</li>
									<li>
										<strong>Analytics Cookies:</strong> Track usage and
										performance
									</li>
									<li>
										<strong>Marketing Cookies:</strong> Personalize
										advertisements
									</li>
									<li>
										<strong>Preference Cookies:</strong> Remember your settings
									</li>
								</ul>
								<h4>7.2 Cookie Management</h4>
								<ul>
									<li>Browser settings to block or delete cookies</li>
									<li>Opt-out tools for advertising cookies</li>
									<li>Some features may not work without cookies</li>
								</ul>
							</div>

							<div className="legal-section">
								<h3>8. Data Retention</h3>
								<ul>
									<li>Account data retained while account is active</li>
									<li>
										Booking records kept for 7 years (tax/legal requirements)
									</li>
									<li>Communication logs retained for 3 years</li>
									<li>Deleted data may remain in backups for 90 days</li>
									<li>Some data retained longer for legal compliance</li>
								</ul>
							</div>

							<div className="legal-section">
								<h3>9. Children's Privacy</h3>
								<ul>
									<li>Platform not intended for users under 18</li>
									<li>We do not knowingly collect data from children</li>
									<li>Parents should monitor children's internet use</li>
									<li>Contact us if we inadvertently collected child data</li>
								</ul>
							</div>

							<div className="legal-section">
								<h3>10. International Data Transfers</h3>
								<ul>
									<li>Data may be transferred and processed internationally</li>
									<li>We ensure adequate protection for transferred data</li>
									<li>Standard contractual clauses used where required</li>
								</ul>
							</div>

							<div className="legal-section">
								<h3>11. Changes to Privacy Policy</h3>
								<ul>
									<li>We may update this policy periodically</li>
									<li>Users notified of significant changes</li>
									<li>Continued use implies acceptance of changes</li>
									<li>Review policy regularly for updates</li>
								</ul>
							</div>

							<div className="legal-section">
								<h3>12. Contact Us</h3>
								<p>For privacy-related questions or requests:</p>
								<ul>
									<li>
										<strong>Email:</strong> privacy@aurastays.com
									</li>
									<li>
										<strong>Phone:</strong> +63 123 456 7890
									</li>
									<li>
										<strong>Address:</strong> Data Protection Officer,
										AuraStays, Manila, Philippines
									</li>
								</ul>
							</div>

									<div className="legal-footer">
										<p>
											<strong>Last Updated:</strong>{" "}
											{new Date().toLocaleDateString()}
										</p>
										<p>
											<em>
												Your privacy is important to us. We are committed to
												protecting your personal information.
											</em>
										</p>
									</div>
								</div>
							</div>
						)}
					</div>
				)}

				{/* Reports Generation Tab */}
				{activeTab === "reports" && (
					<div className="content-section reports-section">
						<div className="section-header">
							<h2>📄 Generate Reports</h2>
							<p>Export comprehensive reports in JSON and CSV formats</p>
						</div>

						{/* Report Tabs */}
						<div className="report-tabs">
							<button
								className={`report-tab ${activeReportTab === "users" ? "active" : ""}`}
								onClick={() => setActiveReportTab("users")}
							>
								👥 Users
							</button>
							<button
								className={`report-tab ${activeReportTab === "properties" ? "active" : ""}`}
								onClick={() => setActiveReportTab("properties")}
							>
								🏠 Properties
							</button>
							<button
								className={`report-tab ${activeReportTab === "bookings" ? "active" : ""}`}
								onClick={() => setActiveReportTab("bookings")}
							>
								📅 Bookings
							</button>
							<button
								className={`report-tab ${activeReportTab === "revenue" ? "active" : ""}`}
								onClick={() => setActiveReportTab("revenue")}
							>
								💰 Revenue
							</button>
						</div>

						{/* Users Tab Content */}
						{activeReportTab === "users" && (
							<div className="report-tab-content">
								<div className="report-tab-header">
									<h3>👥 Users Report</h3>
									<p>Complete user data including registration dates, user types, and activity</p>
									<div className="report-stats-summary">
										<div className="stat-summary">
											<span className="stat-value">{filteredUsersData.length}</span>
											<span className="stat-label">Filtered Users</span>
										</div>
										<div className="stat-summary">
											<span className="stat-value">{filteredUsersData.filter(u => u.userType === "host").length}</span>
											<span className="stat-label">Hosts</span>
										</div>
										<div className="stat-summary">
											<span className="stat-value">{filteredUsersData.filter(u => u.userType === "guest").length}</span>
											<span className="stat-label">Guests</span>
										</div>
									</div>
									<button
										className="generate-report-btn"
										onClick={() => openReportModal("users")}
									>
										📊 Export Users Report
									</button>
								</div>
								
								{/* Users Filter */}
								<div className="report-filters">
									<div className="filter-group">
										<label>Search</label>
										<input
											type="text"
											placeholder="Search by name or email..."
											value={userFilters.search}
											onChange={(e) => setUserFilters({ ...userFilters, search: e.target.value })}
											className="filter-input"
										/>
									</div>
									<div className="filter-group">
										<label>User Type</label>
										<select
											value={userFilters.userType}
											onChange={(e) => setUserFilters({ ...userFilters, userType: e.target.value })}
											className="filter-select"
										>
											<option value="all">All Types</option>
											<option value="host">Host</option>
											<option value="guest">Guest</option>
											<option value="admin">Admin</option>
										</select>
									</div>
									<button
										className="clear-filters-btn"
										onClick={() => setUserFilters({ search: "", userType: "all" })}
									>
										Clear Filters
									</button>
								</div>

								<div className="report-table-wrapper">
									<table className="report-table">
										<thead>
											<tr>
												<th>Name</th>
												<th>Email</th>
												<th>User Type</th>
												<th>Registration Date</th>
											</tr>
										</thead>
										<tbody>
											{filteredUsersData.length === 0 ? (
												<tr>
													<td colSpan="4" className="empty-state">No users found</td>
												</tr>
											) : (
												filteredUsersData.map((user) => (
													<tr key={user.id}>
														<td>{user.displayName || "N/A"}</td>
														<td>{user.email || "N/A"}</td>
														<td>
															<span className={`user-type-badge ${user.userType || "guest"}`}>
																{user.userType || "guest"}
															</span>
														</td>
														<td>
															{user.createdAt?.toDate?.()?.toLocaleDateString() || "N/A"}
														</td>
													</tr>
												))
											)}
										</tbody>
									</table>
								</div>
							</div>
						)}

						{/* Properties Tab Content */}
						{activeReportTab === "properties" && (
							<div className="report-tab-content">
								<div className="report-tab-header">
									<h3>🏠 Properties Report</h3>
									<p>Detailed property listings with ratings, reviews, and performance metrics</p>
									<div className="report-stats-summary">
										<div className="stat-summary">
											<span className="stat-value">{filteredPropertiesData.length}</span>
											<span className="stat-label">Filtered Properties</span>
										</div>
										<div className="stat-summary">
											<span className="stat-value">
												{filteredPropertiesData.length > 0
													? (
															filteredPropertiesData.reduce(
																(sum, p) => sum + (p.rating || 0),
																0
															) / filteredPropertiesData.length
													  ).toFixed(1)
													: "0.0"}
											</span>
											<span className="stat-label">Avg Rating</span>
										</div>
									</div>
									<button
										className="generate-report-btn"
										onClick={() => openReportModal("properties")}
									>
										📊 Export Properties Report
									</button>
								</div>
								
								{/* Properties Filter */}
								<div className="report-filters">
									<div className="filter-group">
										<label>Search</label>
										<input
											type="text"
											placeholder="Search by title or category..."
											value={propertyFilters.search}
											onChange={(e) => setPropertyFilters({ ...propertyFilters, search: e.target.value })}
											className="filter-input"
										/>
									</div>
									<div className="filter-group">
										<label>Category</label>
										<select
											value={propertyFilters.category}
											onChange={(e) => setPropertyFilters({ ...propertyFilters, category: e.target.value })}
											className="filter-select"
										>
											<option value="all">All Categories</option>
											{uniqueCategories.map((cat) => (
												<option key={cat} value={cat}>
													{cat.charAt(0).toUpperCase() + cat.slice(1)}
												</option>
											))}
										</select>
									</div>
									<div className="filter-group">
										<label>Min Rating</label>
										<input
											type="number"
											placeholder="0.0"
											min="0"
											max="5"
											step="0.1"
											value={propertyFilters.minRating}
											onChange={(e) => setPropertyFilters({ ...propertyFilters, minRating: e.target.value })}
											className="filter-input"
										/>
									</div>
									<div className="filter-group">
										<label>Max Rating</label>
										<input
											type="number"
											placeholder="5.0"
											min="0"
											max="5"
											step="0.1"
											value={propertyFilters.maxRating}
											onChange={(e) => setPropertyFilters({ ...propertyFilters, maxRating: e.target.value })}
											className="filter-input"
										/>
									</div>
									<button
										className="clear-filters-btn"
										onClick={() => setPropertyFilters({ search: "", category: "all", minRating: "", maxRating: "" })}
									>
										Clear Filters
									</button>
								</div>

								<div className="report-table-wrapper">
									<table className="report-table">
										<thead>
											<tr>
												<th>Title</th>
												<th>Category</th>
												<th>Rating</th>
												<th>Reviews</th>
												<th>Price</th>
											</tr>
										</thead>
										<tbody>
											{filteredPropertiesData.length === 0 ? (
												<tr>
													<td colSpan="5" className="empty-state">No properties found</td>
												</tr>
											) : (
												filteredPropertiesData.map((property) => (
													<tr key={property.id}>
														<td>{property.title || property.name || "Untitled"}</td>
														<td>{property.category || property.type || "N/A"}</td>
														<td>
															<span className="rating-badge">
																⭐ {property.rating?.toFixed(1) || "0.0"}
															</span>
														</td>
														<td>{property.reviewsCount || property.reviews || 0}</td>
														<td>₱{(property.price || property.basePrice || 0).toLocaleString()}</td>
													</tr>
												))
											)}
										</tbody>
									</table>
								</div>
							</div>
						)}

						{/* Bookings Tab Content */}
						{activeReportTab === "bookings" && (
							<div className="report-tab-content">
								<div className="report-tab-header">
									<h3>📅 Bookings Report</h3>
									<p>Complete booking history with guest info, dates, status, and amounts</p>
									<div className="report-stats-summary">
										<div className="stat-summary">
											<span className="stat-value">{filteredBookingsData.length}</span>
											<span className="stat-label">Filtered Bookings</span>
										</div>
										<div className="stat-summary">
											<span className="stat-value">
												₱
												{filteredBookingsData.length > 0
													? Math.round(
															filteredBookingsData.reduce((sum, b) => sum + (b.pricing?.total || 0), 0) / filteredBookingsData.length
													  ).toLocaleString()
													: "0"}
											</span>
											<span className="stat-label">Avg Value</span>
										</div>
									</div>
									<button
										className="generate-report-btn"
										onClick={() => openReportModal("bookings")}
									>
										📊 Export Bookings Report
									</button>
								</div>
								
								{/* Bookings Filter */}
								<div className="report-filters">
									<div className="filter-group">
										<label>Search</label>
										<input
											type="text"
											placeholder="Search by guest or property..."
											value={bookingFilters.search}
											onChange={(e) => setBookingFilters({ ...bookingFilters, search: e.target.value })}
											className="filter-input"
										/>
									</div>
									<div className="filter-group">
										<label>Status</label>
										<select
											value={bookingFilters.status}
											onChange={(e) => setBookingFilters({ ...bookingFilters, status: e.target.value })}
											className="filter-select"
										>
											<option value="all">All Status</option>
											<option value="pending">Pending</option>
											<option value="confirmed">Confirmed</option>
											<option value="completed">Completed</option>
											<option value="cancelled">Cancelled</option>
										</select>
									</div>
									<div className="filter-group">
										<label>Min Amount (₱)</label>
										<input
											type="number"
											placeholder="0"
											min="0"
											value={bookingFilters.minAmount}
											onChange={(e) => setBookingFilters({ ...bookingFilters, minAmount: e.target.value })}
											className="filter-input"
										/>
									</div>
									<div className="filter-group">
										<label>Max Amount (₱)</label>
										<input
											type="number"
											placeholder="No limit"
											min="0"
											value={bookingFilters.maxAmount}
											onChange={(e) => setBookingFilters({ ...bookingFilters, maxAmount: e.target.value })}
											className="filter-input"
										/>
									</div>
									<button
										className="clear-filters-btn"
										onClick={() => setBookingFilters({ search: "", status: "all", minAmount: "", maxAmount: "" })}
									>
										Clear Filters
									</button>
								</div>

								<div className="report-table-wrapper">
									<table className="report-table">
										<thead>
											<tr>
												<th>Guest</th>
												<th>Property</th>
												<th>Check In</th>
												<th>Check Out</th>
												<th>Status</th>
												<th>Amount</th>
											</tr>
										</thead>
										<tbody>
											{filteredBookingsData.length === 0 ? (
												<tr>
													<td colSpan="6" className="empty-state">No bookings found</td>
												</tr>
											) : (
												filteredBookingsData.map((booking) => {
													// Helper function to format date - check multiple possible field names
													const formatDate = (dateField) => {
														if (!dateField) return "N/A"
														
														// If it's a Firestore timestamp
														if (dateField.toDate && typeof dateField.toDate === "function") {
															return dateField.toDate().toLocaleDateString()
														}
														
														// If it's already a string
														if (typeof dateField === "string") {
															return dateField
														}
														
														// If it's a Date object
														if (dateField instanceof Date) {
															return dateField.toLocaleDateString()
														}
														
														// Try to parse as date
														try {
															const date = new Date(dateField)
															if (!isNaN(date.getTime())) {
																return date.toLocaleDateString()
															}
														} catch (e) {
															// Ignore
														}
														
														return "N/A"
													}
													
													// Check for checkInDate or checkIn
													const checkIn = booking.checkInDate || booking.checkIn
													// Check for checkOutDate or checkOut
													const checkOut = booking.checkOutDate || booking.checkOut
													
													return (
														<tr key={booking.id}>
															<td>{booking.guestName || "N/A"}</td>
															<td>{booking.propertyTitle || "N/A"}</td>
															<td>{formatDate(checkIn)}</td>
															<td>{formatDate(checkOut)}</td>
															<td>
																<span className={`booking-status ${booking.status || "pending"}`}>
																	{booking.status || "pending"}
																</span>
															</td>
															<td>₱{(booking.pricing?.total || 0).toLocaleString()}</td>
														</tr>
													)
												})
											)}
										</tbody>
									</table>
								</div>
							</div>
						)}

						{/* Revenue Tab Content */}
						{activeReportTab === "revenue" && (
							<div className="report-tab-content">
								<div className="report-tab-header">
									<h3>💰 Revenue Report</h3>
									<p>Financial overview with revenue trends, service fees, and earnings breakdown</p>
									<div className="report-stats-summary">
										<div className="stat-summary">
											<span className="stat-value">
												₱{filteredRevenueData.reduce((sum, b) => sum + (b.pricing?.total || 0), 0).toLocaleString()}
											</span>
											<span className="stat-label">Filtered Revenue</span>
										</div>
										<div className="stat-summary">
											<span className="stat-value">
												₱
												{filteredRevenueData.length > 0
													? (
															filteredRevenueData.reduce((sum, b) => {
																const amount = b.pricing?.total || 0
																const hostFee = amount * (policies.serviceFeeHost / 100)
																const guestFee = policies.serviceFeeGuest
																return sum + hostFee + guestFee
															}, 0)
													  ).toFixed(0).toLocaleString()
													: "0"}
											</span>
											<span className="stat-label">Service Fees</span>
										</div>
									</div>
									<button
										className="generate-report-btn"
										onClick={() => openReportModal("revenue")}
									>
										📊 Export Revenue Report
									</button>
								</div>
								
								{/* Revenue Filter */}
								<div className="report-filters">
									<div className="filter-group">
										<label>Search</label>
										<input
											type="text"
											placeholder="Search by guest or property..."
											value={revenueFilters.search}
											onChange={(e) => setRevenueFilters({ ...revenueFilters, search: e.target.value })}
											className="filter-input"
										/>
									</div>
									<div className="filter-group">
										<label>Status</label>
										<select
											value={revenueFilters.status}
											onChange={(e) => setRevenueFilters({ ...revenueFilters, status: e.target.value })}
											className="filter-select"
										>
											<option value="all">All Status</option>
											<option value="confirmed">Confirmed</option>
											<option value="completed">Completed</option>
										</select>
									</div>
									<div className="filter-group">
										<label>Min Amount (₱)</label>
										<input
											type="number"
											placeholder="0"
											min="0"
											value={revenueFilters.minAmount}
											onChange={(e) => setRevenueFilters({ ...revenueFilters, minAmount: e.target.value })}
											className="filter-input"
										/>
									</div>
									<div className="filter-group">
										<label>Max Amount (₱)</label>
										<input
											type="number"
											placeholder="No limit"
											min="0"
											value={revenueFilters.maxAmount}
											onChange={(e) => setRevenueFilters({ ...revenueFilters, maxAmount: e.target.value })}
											className="filter-input"
										/>
									</div>
									<button
										className="clear-filters-btn"
										onClick={() => setRevenueFilters({ search: "", status: "all", minAmount: "", maxAmount: "" })}
									>
										Clear Filters
									</button>
								</div>

								<div className="report-table-wrapper">
									<table className="report-table">
										<thead>
											<tr>
												<th>Booking ID</th>
												<th>Guest</th>
												<th>Property</th>
												<th>Booking Amount</th>
												<th>Service Fee</th>
												<th>Net Revenue</th>
												<th>Status</th>
											</tr>
										</thead>
										<tbody>
											{filteredRevenueData.length === 0 ? (
												<tr>
													<td colSpan="7" className="empty-state">No revenue data found</td>
												</tr>
											) : (
												filteredRevenueData.map((booking) => {
													const bookingAmount = booking.pricing?.total || 0
													// serviceFeeHost is percentage, serviceFeeGuest is fixed amount
													const hostServiceFee = bookingAmount * (policies.serviceFeeHost / 100)
													const guestServiceFee = policies.serviceFeeGuest
													const totalServiceFee = hostServiceFee + guestServiceFee
													const netRevenue = bookingAmount - totalServiceFee
													return (
														<tr key={booking.id}>
															<td>{booking.id.substring(0, 8)}...</td>
															<td>{booking.guestName || "N/A"}</td>
															<td>{booking.propertyTitle || "N/A"}</td>
															<td>₱{bookingAmount.toLocaleString()}</td>
															<td>₱{totalServiceFee.toFixed(2).toLocaleString()}</td>
															<td>₱{netRevenue.toFixed(2).toLocaleString()}</td>
															<td>
																<span className={`booking-status ${booking.status || "pending"}`}>
																	{booking.status || "pending"}
																</span>
															</td>
														</tr>
													)
												})
											)}
										</tbody>
									</table>
								</div>
							</div>
						)}

						<div className="reports-info">
							<h3>ℹ️ Report Information</h3>
							<div className="info-grid">
								<div className="info-item">
									<h4>📄 Export Formats</h4>
									<p>
										All reports are exported in both <strong>JSON</strong> (for
										data processing) and <strong>CSV</strong> (for spreadsheets)
										formats
									</p>
								</div>
								<div className="info-item">
									<h4>📊 Data Included</h4>
									<p>
										Reports contain complete data including timestamps, user
										information, financial details, and statistical summaries
									</p>
								</div>
								<div className="info-item">
									<h4>🔒 Security</h4>
									<p>
										Reports contain sensitive data. Handle exported files
										securely and store them in protected locations
									</p>
								</div>
								<div className="info-item">
									<h4>⏱️ Real-Time Data</h4>
									<p>
										All reports reflect current platform data at the moment of
										generation
									</p>
								</div>
							</div>
						</div>
					</div>
				)}

				{/* Promos Tab */}
				{activeTab === "promos" && (
					<div className="content-section promos-section">
						<div className="section-header">
							<div>
								<h2>🎁 Promo Codes Management</h2>
								<p>Create and manage promotional codes for your platform</p>
							</div>
							<button
								className="create-promo-btn"
								onClick={() => setShowPromoWizard(true)}
							>
								<span>+ Create New Promo</span>
							</button>
						</div>

						<div className="promos-info">
							<div className="info-card">
								<div className="info-icon">🎯</div>
								<div>
									<h4>Total Promos</h4>
									<p>{promos.length} promotional codes</p>
								</div>
							</div>
							<div className="info-card">
								<div className="info-icon">✅</div>
								<div>
									<h4>Active Promos</h4>
									<p>
										{
											promos.filter((p) => {
												const now = new Date()
												const validFrom = p.validFrom
													? new Date(p.validFrom)
													: null
												const validUntil = p.validUntil
													? new Date(p.validUntil)
													: null
												const isExpired = validUntil && validUntil < now
												const isScheduled = validFrom && validFrom > now
												return p.isActive === true && !isExpired && !isScheduled
											}).length
										}{" "}
										active campaigns
									</p>
								</div>
							</div>
							<div className="info-card">
								<div className="info-icon">⏸️</div>
								<div>
									<h4>Inactive Promos</h4>
									<p>
										{
											promos.filter((p) => {
												const now = new Date()
												const validFrom = p.validFrom
													? new Date(p.validFrom)
													: null
												const isScheduled = validFrom && validFrom > now
												return p.isActive === false && !isScheduled
											}).length
										}{" "}
										inactive codes
									</p>
								</div>
							</div>
							<div className="info-card">
								<div className="info-icon">⏰</div>
								<div>
									<h4>Expired Promos</h4>
									<p>
										{
											promos.filter((p) => {
												const now = new Date()
												const validUntil = p.validUntil
													? new Date(p.validUntil)
													: null
												return validUntil && validUntil < now
											}).length
										}{" "}
										expired codes
									</p>
								</div>
							</div>
							<div className="info-card">
								<div className="info-icon">📅</div>
								<div>
									<h4>Scheduled Promos</h4>
									<p>
										{
											promos.filter((p) => {
												const now = new Date()
												const validFrom = p.validFrom
													? new Date(p.validFrom)
													: null
												return validFrom && validFrom > now
											}).length
										}{" "}
										scheduled codes
									</p>
								</div>
							</div>
						</div>

						{/* Filter Controls */}
						<div className="promos-filters">
							<div className="filter-tabs">
								<button
									className={`filter-tab ${
										promoFilter === "all" ? "active" : ""
									}`}
									onClick={() => setPromoFilter("all")}
								>
									All ({promos.length})
								</button>
								<button
									className={`filter-tab ${
										promoFilter === "active" ? "active" : ""
									}`}
									onClick={() => setPromoFilter("active")}
								>
									Active (
									{
										promos.filter((p) => {
											const now = new Date()
											const validFrom = p.validFrom
												? new Date(p.validFrom)
												: null
											const validUntil = p.validUntil
												? new Date(p.validUntil)
												: null
											const isExpired = validUntil && validUntil < now
											const isScheduled = validFrom && validFrom > now
											return p.isActive === true && !isExpired && !isScheduled
										}).length
									}
									)
								</button>
								<button
									className={`filter-tab ${
										promoFilter === "inactive" ? "active" : ""
									}`}
									onClick={() => setPromoFilter("inactive")}
								>
									Inactive (
									{
										promos.filter((p) => {
											const now = new Date()
											const validFrom = p.validFrom
												? new Date(p.validFrom)
												: null
											const isScheduled = validFrom && validFrom > now
											return p.isActive === false && !isScheduled
										}).length
									}
									)
								</button>
								<button
									className={`filter-tab ${
										promoFilter === "expired" ? "active" : ""
									}`}
									onClick={() => setPromoFilter("expired")}
								>
									Expired (
									{
										promos.filter((p) => {
											const now = new Date()
											const validUntil = p.validUntil
												? new Date(p.validUntil)
												: null
											return validUntil && validUntil < now
										}).length
									}
									)
								</button>
								<button
									className={`filter-tab ${
										promoFilter === "scheduled" ? "active" : ""
									}`}
									onClick={() => setPromoFilter("scheduled")}
								>
									Scheduled (
									{
										promos.filter((p) => {
											const now = new Date()
											const validFrom = p.validFrom
												? new Date(p.validFrom)
												: null
											return validFrom && validFrom > now
										}).length
									}
									)
								</button>
								<button
									className={`filter-tab ${
										promoFilter === "host" ? "active" : ""
									}`}
									onClick={() => setPromoFilter("host")}
								>
									Host (
									{
										promos.filter((p) => {
											// Filter promos created by hosts (not admin)
											return p.createdBy && p.createdBy !== adminUserId
										}).length
									}
									)
								</button>
							</div>
						</div>

						{/* Promos Table */}
						<div className="promos-table-container">
							{promos.length === 0 ? (
								<div className="empty-state">
									<div className="empty-icon">🎁</div>
									<h3>No Promo Codes Yet</h3>
									<p>Create your first promo code to get started</p>
									<button
										className="create-promo-btn"
										onClick={() => setShowPromoWizard(true)}
									>
										+ Create New Promo
									</button>
								</div>
							) : (
								<div className="promos-table-wrapper">
									<table className="promos-table">
										<thead>
											<tr>
												<th>Code</th>
												<th>Description</th>
												<th>Discount</th>
												<th>Min Purchase</th>
												<th>Usage</th>
												<th>Valid Period</th>
												<th>Status</th>
												<th>Actions</th>
											</tr>
										</thead>
										<tbody>
											{promos
												.filter((promo) => {
													const now = new Date()
													const validFrom = promo.validFrom
														? new Date(promo.validFrom)
														: null
													const validUntil = promo.validUntil
														? new Date(promo.validUntil)
														: null
													const isExpired = validUntil && validUntil < now
													const isScheduled = validFrom && validFrom > now

													if (promoFilter === "active")
														return (
															promo.isActive === true &&
															!isExpired &&
															!isScheduled
														)
													if (promoFilter === "inactive")
														return promo.isActive === false && !isScheduled
													if (promoFilter === "expired") return isExpired
													if (promoFilter === "scheduled") return isScheduled
													if (promoFilter === "host")
														return promo.createdBy && promo.createdBy !== adminUserId
													return true
												})
												.map((promo) => {
													const now = new Date()
													const validFrom = promo.validFrom
														? new Date(promo.validFrom)
														: null
													const validUntil = promo.validUntil
														? new Date(promo.validUntil)
														: null
													const isExpired = validUntil && validUntil < now
													const isNotStarted = validFrom && validFrom > now

													return (
														<tr
															key={promo.id}
															className={
																!promo.isActive || isExpired
																	? "inactive-row"
																	: ""
															}
														>
															<td>
																<strong className="promo-code">
																	{promo.code}
																</strong>
															</td>
															<td className="promo-description">
																<DescriptionWithTooltip
																	text={promo.description}
																/>
															</td>
															<td style={{ verticalAlign: "middle" }}>
																{(() => {
																	const discountValue = promo.discountValue || 0
																	const discountType =
																		promo.discountType || "fixed"

																	if (discountValue > 0) {
																		return discountType === "percentage" ? (
																			<span className="discount-badge percentage">
																				{discountValue}%
																				{promo.maxDiscount > 0 &&
																					` (Max ₱${promo.maxDiscount})`}
																			</span>
																		) : (
																			<span className="discount-badge fixedPrice">
																				₱{discountValue}
																			</span>
																		)
																	}
																	return (
																		<span
																			style={{
																				color: "#999",
																				fontStyle: "italic",
																			}}
																		>
																			No discount
																		</span>
																	)
																})()}
															</td>
															<td>
																{promo.minPurchase > 0 ? (
																	<span>₱{promo.minPurchase}</span>
																) : (
																	<span style={{ color: "#999" }}>None</span>
																)}
															</td>
															<td>
																<div className="usage-info">
																	<span className="usage-count">
																		{promo.usageCount || 0}
																		{promo.usageLimit > 0
																			? ` / ${promo.usageLimit}`
																			: " / ∞"}
																	</span>
																	<small className="usage-per-user">
																		{promo.usagePerUser} per user
																	</small>
																</div>
															</td>
															<td>
																<div className="validity-info">
																	{promo.validFrom ? (
																		<small>
																			From:{" "}
																			{new Date(
																				promo.validFrom
																			).toLocaleDateString()}
																		</small>
																	) : (
																		<small>No start date</small>
																	)}
																	{promo.validUntil ? (
																		<small>
																			Until:{" "}
																			{new Date(
																				promo.validUntil
																			).toLocaleDateString()}
																		</small>
																	) : (
																		<small>No end date</small>
																	)}
																</div>
															</td>
															<td>
																<div className="status-badges">
																	{promo.isActive ? (
																		<span className="status-badge active">
																			Active
																		</span>
																	) : (
																		<span className="status-badge inactive">
																			Inactive
																		</span>
																	)}
																	{isExpired && (
																		<span className="status-badge expired">
																			Expired
																		</span>
																	)}
																	{isNotStarted && (
																		<span className="status-badge scheduled">
																			Scheduled
																		</span>
																	)}
																</div>
															</td>
															<td>
																<div className="promo-actions">
																	<button
																		className="toggle-status-btn"
																		onClick={() =>
																			handleTogglePromoStatus(
																				promo.id,
																				promo.isActive
																			)
																		}
																		title={
																			promo.isActive ? "Deactivate" : "Activate"
																		}
																	>
																		{promo.isActive ? "⏸️" : "▶️"}
																	</button>
																	<button
																		className="delete-promo-btn"
																		onClick={() =>
																			handleDeletePromo(promo.id, promo.code)
																		}
																		title="Delete Promo"
																	>
																		🗑️
																	</button>
																</div>
															</td>
														</tr>
													)
												})}
										</tbody>
									</table>
									{promos.filter((promo) => {
										const now = new Date()
										const validFrom = promo.validFrom
											? new Date(promo.validFrom)
											: null
										const validUntil = promo.validUntil
											? new Date(promo.validUntil)
											: null
										const isExpired = validUntil && validUntil < now
										const isScheduled = validFrom && validFrom > now

										if (promoFilter === "active")
											return (
												promo.isActive === true && !isExpired && !isScheduled
											)
										if (promoFilter === "inactive")
											return promo.isActive === false && !isScheduled
										if (promoFilter === "expired") return isExpired
										if (promoFilter === "scheduled") return isScheduled
										if (promoFilter === "host")
											return promo.createdBy && promo.createdBy !== adminUserId
										return true
									}).length === 0 && (
										<div className="empty-state">
											<div className="empty-icon">🔍</div>
											<h3>No {promoFilter} promos found</h3>
											<p>Try changing the filter or create a new promo code</p>
										</div>
									)}
								</div>
							)}
						</div>
					</div>
				)}

				{/* Report Preview Modal */}
				{reportModal.isOpen && (
					<div
						className="report-modal-overlay"
						onClick={() =>
							setReportModal({ isOpen: false, type: "", data: null, title: "" })
						}
					>
						<div
							className="report-modal-content"
							onClick={(e) => e.stopPropagation()}
						>
							<div className="report-modal-header">
								<h2>📊 {reportModal.title}</h2>
								<button
									className="close-modal-btn"
									onClick={() =>
										setReportModal({
											isOpen: false,
											type: "",
											data: null,
											title: "",
										})
									}
								>
									✕
								</button>
							</div>

							<div className="report-modal-body">
								{/* Summary Section */}
								{reportModal.data?.summary && (
									<div className="report-section">
										<h3>📈 Summary</h3>
										<div className="summary-grid">
											{Object.entries(reportModal.data.summary).map(
												([key, value]) => {
													const label = key.replace(/([A-Z])/g, " $1").trim()
													const displayLabel =
														label.charAt(0).toUpperCase() + label.slice(1)
													return (
														<div key={key} className="summary-item">
															<span className="summary-label">
																{displayLabel}:
															</span>
															<span className="summary-value">{value}</span>
														</div>
													)
												}
											)}
										</div>
									</div>
								)}

								{/* Data Tables */}
								{reportModal.type === "users" &&
									reportModal.data?.recentUsers && (
										<div className="report-section">
											<h3>👥 Recent Users</h3>
											<div className="report-table-wrapper">
												<table className="report-table">
													<thead>
														<tr>
															<th>Name</th>
															<th>Email</th>
															<th>User Type</th>
															<th>Created At</th>
														</tr>
													</thead>
													<tbody>
														{reportModal.data.recentUsers.map((user, idx) => (
															<tr key={idx}>
																<td>{user.name}</td>
																<td>{user.email}</td>
																<td>
																	<span
																		className={`type-badge ${user.userType}`}
																	>
																		{user.userType}
																	</span>
																</td>
																<td>{user.createdAt}</td>
															</tr>
														))}
													</tbody>
												</table>
											</div>
										</div>
									)}

								{reportModal.type === "properties" && (
									<>
										{reportModal.data?.topRated &&
											reportModal.data.topRated.length > 0 && (
												<div className="report-section">
													<h3>⭐ Top Rated Properties</h3>
													<div className="report-table-wrapper">
														<table className="report-table">
															<thead>
																<tr>
																	<th>Title</th>
																	<th>Rating</th>
																	<th>Reviews</th>
																	<th>Category</th>
																</tr>
															</thead>
															<tbody>
																{reportModal.data.topRated.map((prop, idx) => (
																	<tr key={idx}>
																		<td>{prop.title}</td>
																		<td>
																			<span className="rating-badge">
																				⭐ {prop.rating}
																			</span>
																		</td>
																		<td>{prop.reviews}</td>
																		<td>{prop.category}</td>
																	</tr>
																))}
															</tbody>
														</table>
													</div>
												</div>
											)}
										{reportModal.data?.needsAttention &&
											reportModal.data.needsAttention.length > 0 && (
												<div className="report-section">
													<h3>⚠️ Needs Attention</h3>
													<div className="report-table-wrapper">
														<table className="report-table">
															<thead>
																<tr>
																	<th>Title</th>
																	<th>Rating</th>
																	<th>Reviews</th>
																	<th>Category</th>
																</tr>
															</thead>
															<tbody>
																{reportModal.data.needsAttention.map(
																	(prop, idx) => (
																		<tr key={idx}>
																			<td>{prop.title}</td>
																			<td>
																				<span className="rating-badge warning">
																					⭐ {prop.rating}
																				</span>
																			</td>
																			<td>{prop.reviews}</td>
																			<td>{prop.category}</td>
																		</tr>
																	)
																)}
															</tbody>
														</table>
													</div>
												</div>
											)}
										{reportModal.data?.allProperties &&
											reportModal.data.allProperties.length > 0 && (
												<div className="report-section">
													<h3>📋 All Properties</h3>
													<div className="report-table-wrapper">
														<table className="report-table">
															<thead>
																<tr>
																	<th>Title</th>
																	<th>Host</th>
																	<th>Rating</th>
																	<th>Reviews</th>
																	<th>Category</th>
																</tr>
															</thead>
															<tbody>
																{reportModal.data.allProperties.map(
																	(prop, idx) => (
																		<tr key={idx}>
																			<td>{prop.title}</td>
																			<td>{prop.host}</td>
																			<td>
																				<span className="rating-badge">
																					⭐ {prop.rating}
																				</span>
																			</td>
																			<td>{prop.reviews}</td>
																			<td>{prop.category}</td>
																		</tr>
																	)
																)}
															</tbody>
														</table>
													</div>
												</div>
											)}
									</>
								)}

								{reportModal.type === "bookings" &&
									reportModal.data?.recentBookings && (
										<div className="report-section">
											<h3>📅 Recent Bookings</h3>
											<div className="report-table-wrapper">
												<table className="report-table">
													<thead>
														<tr>
															<th>Guest</th>
															<th>Property</th>
															<th>Status</th>
															<th>Amount</th>
														</tr>
													</thead>
													<tbody>
														{reportModal.data.recentBookings.map(
															(booking, idx) => (
																<tr key={idx}>
																	<td>{booking.guest}</td>
																	<td>{booking.property}</td>
																	<td>
																		<span
																			className={`status-badge ${booking.status}`}
																		>
																			{booking.status}
																		</span>
																	</td>
																	<td>₱{booking.amount}</td>
																</tr>
															)
														)}
													</tbody>
												</table>
											</div>
										</div>
									)}


								{/* Complete System Report */}
								{(reportModal.type === "complete" ||
									reportModal.type === "system") &&
									reportModal.data && (
										<>
											{/* Platform Overview */}
											{reportModal.data.platformOverview && (
												<div className="report-section">
													<h3>🌐 Platform Overview</h3>
													<div className="summary-grid">
														{Object.entries(
															reportModal.data.platformOverview
														).map(([key, value]) => {
															const label = key
																.replace(/([A-Z])/g, " $1")
																.trim()
															const displayLabel =
																label.charAt(0).toUpperCase() + label.slice(1)
															return (
																<div key={key} className="summary-item">
																	<strong>{displayLabel}:</strong>{" "}
																	{typeof value === "number" &&
																	key.includes("revenue")
																		? `₱${value.toLocaleString()}`
																		: value.toLocaleString()}
																</div>
															)
														})}
													</div>
												</div>
											)}

											{/* Users Summary */}
											{reportModal.data.users && (
												<div className="report-section">
													<h3>👥 Users Overview</h3>
													<div className="summary-grid">
														<div className="summary-item">
															<strong>Total Users:</strong>{" "}
															{reportModal.data.users.summary.total}
														</div>
														<div className="summary-item">
															<strong>Hosts:</strong>{" "}
															{reportModal.data.users.summary.hosts}
														</div>
														<div className="summary-item">
															<strong>Guests:</strong>{" "}
															{reportModal.data.users.summary.guests}
														</div>
													</div>
												</div>
											)}

											{/* Properties Summary */}
											{reportModal.data.properties && (
												<div className="report-section">
													<h3>🏠 Properties Overview</h3>
													<div className="summary-grid">
														<div className="summary-item">
															<strong>Total Properties:</strong>{" "}
															{reportModal.data.properties.summary.total}
														</div>
														<div className="summary-item">
															<strong>Average Rating:</strong> ⭐{" "}
															{reportModal.data.properties.summary.avgRating}
														</div>
													</div>
													{reportModal.data.properties.topRated?.length > 0 && (
														<div style={{ marginTop: "1rem" }}>
															<h4>⭐ Top Rated (Top 5)</h4>
															<div className="report-table-wrapper">
																<table className="report-table">
																	<thead>
																		<tr>
																			<th>Property</th>
																			<th>Rating</th>
																			<th>Reviews</th>
																			<th>Category</th>
																		</tr>
																	</thead>
																	<tbody>
																		{reportModal.data.properties.topRated
																			.slice(0, 5)
																			.map((prop, idx) => (
																				<tr key={idx}>
																					<td>{prop.title}</td>
																					<td>
																						<span className="rating-badge">
																							⭐ {prop.rating}
																						</span>
																					</td>
																					<td>{prop.reviews}</td>
																					<td>{prop.category}</td>
																				</tr>
																			))}
																	</tbody>
																</table>
															</div>
														</div>
													)}
												</div>
											)}

											{/* Bookings Summary */}
											{reportModal.data.bookings && (
												<div className="report-section">
													<h3>📅 Bookings Overview</h3>
													<div className="summary-grid">
														<div className="summary-item">
															<strong>Total Bookings:</strong>{" "}
															{reportModal.data.bookings.summary.total}
														</div>
														<div className="summary-item">
															<strong>Total Revenue:</strong> ₱
															{reportModal.data.bookings.summary.totalRevenue.toLocaleString()}
														</div>
														<div className="summary-item">
															<strong>Average Value:</strong> ₱
															{reportModal.data.bookings.summary.avgValue}
														</div>
													</div>
												</div>
											)}

											{/* Revenue Summary */}
											{reportModal.data.revenue && (
												<div className="report-section">
													<h3>💰 Revenue Overview</h3>
													<div className="summary-grid">
														<div className="summary-item">
															<strong>Total Revenue:</strong> ₱
															{parseFloat(
																reportModal.data.revenue.summary.totalRevenue
															).toLocaleString()}
														</div>
														<div className="summary-item">
															<strong>Host Service Fees:</strong> ₱
															{parseFloat(
																reportModal.data.revenue.summary.hostServiceFees
															).toLocaleString()}
														</div>
														<div className="summary-item">
															<strong>Guest Service Fees:</strong> ₱
															{parseFloat(
																reportModal.data.revenue.summary
																	.guestServiceFees
															).toLocaleString()}
														</div>
														<div className="summary-item">
															<strong>Total Service Fees:</strong> ₱
															{parseFloat(
																reportModal.data.revenue.summary
																	.totalServiceFees
															).toLocaleString()}
														</div>
														<div className="summary-item">
															<strong>Net Revenue:</strong> ₱
															{parseFloat(
																reportModal.data.revenue.summary.netRevenue
															).toLocaleString()}
														</div>
													</div>
												</div>
											)}


											{/* Policies Summary */}
											{reportModal.data.policies && (
												<div className="report-section">
													<h3>📋 Platform Policies</h3>
													<div className="summary-grid">
														<div className="summary-item">
															<strong>Host Service Fee:</strong>{" "}
															{reportModal.data.policies.serviceFeeHost}%
														</div>
														<div className="summary-item">
															<strong>Guest Service Fee:</strong> ₱
															{reportModal.data.policies.serviceFeeGuest}
														</div>
														<div className="summary-item">
															<strong>Guest Fee Per Person:</strong> ₱
															{reportModal.data.policies.guestFeePerPerson}
														</div>
														<div className="summary-item">
															<strong>Wallet Withdrawal Fee:</strong>{" "}
															{reportModal.data.policies.walletWithdrawalFee}%
														</div>
														<div className="summary-item">
															<strong>Cancellation Window:</strong>{" "}
															{
																reportModal.data.policies
																	.cancellationWindowHours
															}{" "}
															hours
														</div>
														<div className="summary-item">
															<strong>Min Property Rating:</strong> ⭐{" "}
															{reportModal.data.policies.minPropertyRating}
														</div>
													</div>
												</div>
											)}
										</>
									)}
							</div>

							<div className="report-modal-footer">
								<button className="export-pdf-btn" onClick={exportReportAsPDF}>
									📄 Export as PDF
								</button>
								<button
									className="cancel-btn"
									onClick={() =>
										setReportModal({
											isOpen: false,
											type: "",
											data: null,
											title: "",
										})
									}
								>
									Cancel
								</button>
							</div>
						</div>
					</div>
				)}

				{/* Promo Wizard Modal */}
				{showPromoWizard && (
					<div
						className="promo-wizard-overlay"
						onClick={handleCancelPromoWizard}
					>
						<div
							className="promo-wizard-modal"
							onClick={(e) => e.stopPropagation()}
						>
							<div className="wizard-header">
								<h2>✨ Create New Promo Code</h2>
								<p className="wizard-subtitle">Step {promoWizardStep} of 4</p>
								<button
									className="wizard-close-btn"
									onClick={handleCancelPromoWizard}
								>
									×
								</button>
							</div>

							<div className="wizard-progress">
								<div className="progress-bar">
									<div
										className="progress-fill"
										style={{ width: `${(promoWizardStep / 4) * 100}%` }}
									></div>
								</div>
								<div className="progress-steps">
									<div
										className={`progress-step ${
											promoWizardStep > 1
												? "completed"
												: promoWizardStep === 1
												? "active"
												: ""
										}`}
									>
										1
									</div>
									<div
										className={`progress-step ${
											promoWizardStep > 2
												? "completed"
												: promoWizardStep === 2
												? "active"
												: ""
										}`}
									>
										2
									</div>
									<div
										className={`progress-step ${
											promoWizardStep > 3
												? "completed"
												: promoWizardStep === 3
												? "active"
												: ""
										}`}
									>
										3
									</div>
									<div
										className={`progress-step ${
											promoWizardStep === 4 ? "active" : ""
										}`}
									>
										4
									</div>
								</div>
							</div>

							<div className="wizard-body">
								{/* Step 1: Basic Info */}
								{promoWizardStep === 1 && (
									<div className="wizard-step">
										<h3>📝 Basic Information</h3>
										<div className="form-group">
											<label>
												Promo Code <span className="required">*</span>
											</label>
											<input
												type="text"
												placeholder="e.g., SUMMER2024"
												value={promoFormData.code}
												onChange={(e) =>
													handlePromoInputChange(
														"code",
														e.target.value.toUpperCase()
													)
												}
												minLength={3}
												maxLength={20}
												required
											/>
											<small>
												Minimum 3 characters, uppercase letters and numbers only
											</small>
										</div>
										<div className="form-group">
											<label>
												Description <span className="required">*</span>
											</label>
											<textarea
												placeholder="Brief description of this promo"
												value={promoFormData.description}
												onChange={(e) =>
													handlePromoInputChange("description", e.target.value)
												}
												rows={3}
												minLength={10}
												required
											/>
											<small>Minimum 10 characters required</small>
										</div>
										<div className="form-group">
											<label>Applicable To</label>
											<select
												value={promoFormData.applicableTo}
												onChange={(e) => {
													const newApplicableTo = e.target.value
													handlePromoInputChange(
														"applicableTo",
														newApplicableTo
													)
													// Reset minPurchase to 0 when selecting "host"
													if (newApplicableTo === "host") {
														handlePromoInputChange("minPurchase", 0)
													}
												}}
											>
												<option value="all">All Categories</option>
												<option value="properties">Properties Only</option>
												<option value="experiences">Experiences Only</option>
												<option value="service">Service Only</option>
											</select>
										</div>
									</div>
								)}

								{/* Step 2: Discount Settings */}
								{promoWizardStep === 2 && (
									<div className="wizard-step">
										<h3>💰 Discount Settings</h3>
										<div className="form-group">
											<label>Discount Type</label>
											<div className="radio-group">
												<label className="radio-label">
													<input
														type="radio"
														name="discountType"
														value="percentage"
														checked={
															promoFormData.discountType === "percentage"
														}
														onChange={(e) =>
															handlePromoInputChange(
																"discountType",
																e.target.value
															)
														}
													/>
													<span>Percentage (%)</span>
												</label>
												<label className="radio-label">
													<input
														type="radio"
														name="discountType"
														value="fixed"
														checked={promoFormData.discountType === "fixed"}
														onChange={(e) =>
															handlePromoInputChange(
																"discountType",
																e.target.value
															)
														}
													/>
													<span>Fixed Amount (₱)</span>
												</label>
											</div>
										</div>
										<div className="form-group">
											<label>
												Discount Value <span className="required">*</span>
											</label>
											<input
												type="number"
												placeholder={
													promoFormData.discountType === "percentage"
														? "e.g., 20"
														: "e.g., 500"
												}
												value={promoFormData.discountValue || ""}
												onChange={(e) =>
													handlePromoInputChange(
														"discountValue",
														parseFloat(e.target.value) || 0
													)
												}
												min="0.01"
												step={
													promoFormData.discountType === "percentage"
														? "1"
														: "10"
												}
												max={
													promoFormData.discountType === "percentage"
														? "100"
														: undefined
												}
												required
											/>
											<small>
												{promoFormData.discountType === "percentage"
													? "Enter percentage (0-100), required"
													: "Enter amount in PHP, required"}
											</small>
										</div>
										{promoFormData.discountType === "percentage" && (
											<div className="form-group">
												<label>Maximum Discount (₱)</label>
												<input
													type="number"
													placeholder="e.g., 1000"
													value={promoFormData.maxDiscount || ""}
													onChange={(e) =>
														handlePromoInputChange(
															"maxDiscount",
															parseFloat(e.target.value) || 0
														)
													}
													min="0"
													step="100"
													disabled={promoFormData.discountValue >= 100}
												/>
												<small>
													{promoFormData.discountValue >= 100 ? (
														<span
															style={{ color: "#999", fontStyle: "italic" }}
														>
															Not applicable for 100% discount
														</span>
													) : (
														"Optional: Maximum discount amount in pesos"
													)}
												</small>
											</div>
										)}
										{promoFormData.applicableTo !== "host" && (
											<div className="form-group">
												<label>Minimum Purchase Amount (₱)</label>
												<input
													type="number"
													placeholder="e.g., 1000"
													value={promoFormData.minPurchase || ""}
													onChange={(e) =>
														handlePromoInputChange(
															"minPurchase",
															parseFloat(e.target.value) || 0
														)
													}
													min="0"
													step="100"
												/>
												<small>Minimum amount required to use this promo</small>
											</div>
										)}
									</div>
								)}

								{/* Step 3: Usage Limits */}
								{promoWizardStep === 3 && (
									<div className="wizard-step">
										<h3>🎯 Usage Limits</h3>
										<div className="form-group">
											<label>Total Usage Limit</label>
											<input
												type="number"
												placeholder="0 for unlimited"
												value={promoFormData.usageLimit || ""}
												onChange={(e) =>
													handlePromoInputChange(
														"usageLimit",
														parseInt(e.target.value) || 0
													)
												}
												min="0"
											/>
											<small>
												Total number of times this promo can be used (0 for
												unlimited)
											</small>
										</div>
										<div className="form-group">
											<label>
												Usage Per User <span className="required">*</span>
											</label>
											<input
												type="number"
												placeholder="1"
												value={promoFormData.usagePerUser || ""}
												onChange={(e) =>
													handlePromoInputChange(
														"usagePerUser",
														parseInt(e.target.value) || 1
													)
												}
												min="1"
												required
											/>
											<small>
												How many times each user can use this promo (minimum 1,
												required)
											</small>
										</div>
									</div>
								)}

								{/* Step 4: Validity Period */}
								{promoWizardStep === 4 && (
									<div className="wizard-step">
										<h3>⏰ Validity Period</h3>
										<div className="form-group">
											<label>Valid From</label>
											<div
												style={{
													display: "flex",
													gap: "0.5rem",
													alignItems: "center",
												}}
											>
												<button
													type="button"
													onClick={() => openPromoDatePicker(true)}
													style={{
														flex: 1,
														padding: "0.75rem",
														border: "1px solid #ddd",
														borderRadius: "8px",
														background: "#fff",
														cursor: "pointer",
														display: "flex",
														alignItems: "center",
														justifyContent: "space-between",
														gap: "0.5rem",
													}}
												>
													<span>
														{promoFormData.validFrom
															? formatPromoDate(promoFormData.validFrom)
															: "Select start date"}
													</span>
													<FaCalendarAlt />
												</button>
												{promoFormData.validFrom && (
													<button
														type="button"
														onClick={() =>
															handlePromoInputChange("validFrom", "")
														}
														style={{
															padding: "0.5rem",
															border: "none",
															background: "#f0f0f0",
															borderRadius: "4px",
															cursor: "pointer",
														}}
													>
														<FaTimes />
													</button>
												)}
											</div>
											<small>Leave empty to start immediately</small>
										</div>
										<div className="form-group">
											<label>Valid Until</label>
											<div
												style={{
													display: "flex",
													gap: "0.5rem",
													alignItems: "center",
												}}
											>
												<button
													type="button"
													onClick={() => openPromoDatePicker(false)}
													style={{
														flex: 1,
														padding: "0.75rem",
														border: "1px solid #ddd",
														borderRadius: "8px",
														background: "#fff",
														cursor: "pointer",
														display: "flex",
														alignItems: "center",
														justifyContent: "space-between",
														gap: "0.5rem",
													}}
												>
													<span>
														{promoFormData.validUntil
															? formatPromoDate(promoFormData.validUntil)
															: "Select end date"}
													</span>
													<FaCalendarAlt />
												</button>
												{promoFormData.validUntil && (
													<button
														type="button"
														onClick={() =>
															handlePromoInputChange("validUntil", "")
														}
														style={{
															padding: "0.5rem",
															border: "none",
															background: "#f0f0f0",
															borderRadius: "4px",
															cursor: "pointer",
														}}
													>
														<FaTimes />
													</button>
												)}
											</div>
											<small>Leave empty for no expiration</small>
										</div>
										<div className="form-group">
											<label className="checkbox-label">
												<input
													type="checkbox"
													checked={promoFormData.isActive}
													onChange={(e) =>
														handlePromoInputChange("isActive", e.target.checked)
													}
												/>
												<span style={{ marginLeft: "1rem" }}>
													Activate promo immediately
												</span>
											</label>
										</div>

										{/* Summary */}
										<div className="promo-summary">
											<h4>📋 Summary - Review Before Creating</h4>
											<div className="summary-item">
												<strong>Code:</strong>{" "}
												{promoFormData.code || (
													<span
														style={{ color: "#ff6b6b", fontStyle: "italic" }}
													>
														Not set
													</span>
												)}
											</div>
											<div className="summary-item">
												<strong>Description:</strong>{" "}
												{promoFormData.description || (
													<span
														style={{ color: "#ff6b6b", fontStyle: "italic" }}
													>
														Not set
													</span>
												)}
											</div>
											<div className="summary-item">
												<strong>Applicable To:</strong>{" "}
												{promoFormData.applicableTo === "all"
													? "All Categories"
													: promoFormData.applicableTo.charAt(0).toUpperCase() +
													  promoFormData.applicableTo.slice(1)}
											</div>
											<div className="summary-item">
												<strong>Discount:</strong>{" "}
												{promoFormData.discountValue > 0 ? (
													<>
														{promoFormData.discountType === "percentage"
															? `${promoFormData.discountValue}%`
															: `₱${promoFormData.discountValue}`}
														{promoFormData.maxDiscount > 0 &&
															promoFormData.discountType === "percentage" &&
															promoFormData.discountValue < 100 &&
															` (Max ₱${promoFormData.maxDiscount})`}
													</>
												) : (
													<span
														style={{ color: "#ff6b6b", fontStyle: "italic" }}
													>
														Not set
													</span>
												)}
											</div>
											<div className="summary-item">
												<strong>Min Purchase:</strong>{" "}
												{promoFormData.minPurchase > 0
													? `₱${promoFormData.minPurchase}`
													: "No minimum"}
											</div>
											<div className="summary-item">
												<strong>Usage Limit:</strong>{" "}
												{promoFormData.usageLimit > 0
													? `${promoFormData.usageLimit} total uses`
													: "Unlimited"}
											</div>
											<div className="summary-item">
												<strong>Usage Per User:</strong>{" "}
												{promoFormData.usagePerUser || 1} time(s)
											</div>
											<div className="summary-item">
												<strong>Valid Period:</strong>{" "}
												{promoFormData.validFrom || promoFormData.validUntil ? (
													<>
														{promoFormData.validFrom
															? new Date(
																	promoFormData.validFrom
															  ).toLocaleDateString()
															: "No start date"}{" "}
														to{" "}
														{promoFormData.validUntil
															? new Date(
																	promoFormData.validUntil
															  ).toLocaleDateString()
															: "No end date"}
													</>
												) : (
													"No date restrictions"
												)}
											</div>
											<div className="summary-item">
												<strong>Status:</strong>{" "}
												{promoFormData.isActive ? (
													<span style={{ color: "#28a745" }}>✓ Active</span>
												) : (
													<span style={{ color: "#dc3545" }}>✗ Inactive</span>
												)}
											</div>
										</div>
									</div>
								)}
							</div>

							<div className="wizard-footer">
								<div className="footer-buttons">
									{promoWizardStep > 1 && (
										<button
											className="wizard-btn secondary"
											onClick={handlePreviousStep}
											disabled={isCreatingPromo}
										>
											← Previous
										</button>
									)}
									{promoWizardStep < 4 ? (
										<button
											className="wizard-btn primary"
											onClick={handleNextStep}
											disabled={isCreatingPromo}
										>
											Next →
										</button>
									) : (
										<button
											className="wizard-btn primary"
											onClick={handleCreatePromo}
											disabled={isCreatingPromo}
										>
											{isCreatingPromo ? "Creating..." : "🎉 Create Promo"}
										</button>
									)}
								</div>
							</div>
						</div>
					</div>
				)}

				{/* Promo Date Picker Modal */}
				{showPromoDatePicker && (
					<div
						className="date-picker-modal-overlay"
						onClick={() => setShowPromoDatePicker(false)}
						style={{
							position: "fixed",
							top: 0,
							left: 0,
							right: 0,
							bottom: 0,
							background: "rgba(0, 0, 0, 0.5)",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							zIndex: 10000,
						}}
					>
						<div
							className="date-picker-modal-content"
							onClick={(e) => e.stopPropagation()}
							style={{
								background: "#fff",
								borderRadius: "12px",
								padding: "2rem",
								maxWidth: "500px",
								width: "90%",
								maxHeight: "90vh",
								overflow: "auto",
								position: "relative",
							}}
						>
							<button
								className="close-date-modal"
								onClick={() => setShowPromoDatePicker(false)}
								style={{
									position: "absolute",
									top: "1rem",
									right: "1rem",
									background: "none",
									border: "none",
									fontSize: "1.5rem",
									cursor: "pointer",
									color: "#666",
								}}
							>
								<FaTimes />
							</button>
							<h2 style={{ marginTop: 0, marginBottom: "1rem" }}>
								<FaCalendarAlt style={{ marginRight: "0.5rem" }} />
								Select {selectingValidFrom ? "Start" : "End"} Date
							</h2>
							<div className="modal-calendar" style={{ marginTop: "1rem" }}>
								<div className="month-view">
									<div
										className="month-header"
										style={{
											display: "flex",
											justifyContent: "space-between",
											alignItems: "center",
											marginBottom: "1rem",
										}}
									>
										<button
											onClick={previousPromoMonth}
											className="month-nav-btn"
											style={{
												background: "none",
												border: "1px solid #ddd",
												borderRadius: "4px",
												padding: "0.5rem",
												cursor: "pointer",
											}}
										>
											◀
										</button>
										<h3 style={{ margin: 0 }}>
											{promoCalendarMonth.toLocaleString("default", {
												month: "long",
												year: "numeric",
											})}
										</h3>
										<button
											onClick={nextPromoMonth}
											className="month-nav-btn"
											style={{
												background: "none",
												border: "1px solid #ddd",
												borderRadius: "4px",
												padding: "0.5rem",
												cursor: "pointer",
											}}
										>
											▶
										</button>
									</div>
									<div
										className="calendar-days"
										style={{
											display: "grid",
											gridTemplateColumns: "repeat(7, 1fr)",
											gap: "0.5rem",
										}}
									>
										{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
											(day) => (
												<div
													key={day}
													className="day-label"
													style={{
														textAlign: "center",
														fontWeight: "bold",
														padding: "0.5rem",
														color: "#666",
													}}
												>
													{day}
												</div>
											)
										)}
										{generatePromoCalendarDays().map((dayData, index) =>
											dayData ? (
												<div
													key={index}
													className={`calendar-day ${
														dayData.isPast ? "past" : "available"
													} ${
														(promoFormData.validFrom &&
															dayData.dateString ===
																promoFormData.validFrom.split("T")[0]) ||
														(promoFormData.validUntil &&
															dayData.dateString ===
																promoFormData.validUntil.split("T")[0])
															? "selected"
															: ""
													}`}
													onClick={() => {
														if (!dayData.isPast) {
															handlePromoDateClick(dayData.dateString)
														}
													}}
													style={{
														padding: "0.75rem",
														textAlign: "center",
														borderRadius: "4px",
														cursor: dayData.isPast ? "not-allowed" : "pointer",
														background: dayData.isPast
															? "#f0f0f0"
															: (promoFormData.validFrom &&
																	dayData.dateString ===
																		promoFormData.validFrom.split("T")[0]) ||
															  (promoFormData.validUntil &&
																	dayData.dateString ===
																		promoFormData.validUntil.split("T")[0])
															? "var(--primary)"
															: "#fff",
														color: dayData.isPast
															? "#999"
															: (promoFormData.validFrom &&
																	dayData.dateString ===
																		promoFormData.validFrom.split("T")[0]) ||
															  (promoFormData.validUntil &&
																	dayData.dateString ===
																		promoFormData.validUntil.split("T")[0])
															? "#fff"
															: "#333",
														border: "1px solid #ddd",
													}}
													title={
														dayData.isPast
															? "Past date (cannot select)"
															: "Click to select"
													}
												>
													{dayData.day}
												</div>
											) : (
												<div
													key={index}
													className="calendar-day empty"
													style={{ padding: "0.75rem" }}
												></div>
											)
										)}
									</div>
								</div>
							</div>
						</div>
					</div>
				)}

				{/* E-Wallet Tab */}
				{activeTab === "wallet" && (
					<div className="content-section wallet-section">
						<div className="section-header">
							<div>
								<h2>💰 Admin E-Wallet</h2>
								<p>Manage admin wallet balance and view transaction history</p>
							</div>
						</div>

						{loadingWallet ? (
							<div className="loading-state">
								<div className="spinner"></div>
								<p>Loading wallet data...</p>
							</div>
						) : (
							<>
								{/* Wallet Balance Card */}
								<div className="wallet-balance-card">
									<div className="balance-header">
										<div className="balance-icon">💳</div>
										<div className="balance-info">
											<p className="balance-label">Available Balance</p>
											<h1 className="balance-amount">
												₱
												{walletBalance.toLocaleString("en-PH", {
													minimumFractionDigits: 2,
													maximumFractionDigits: 2,
												})}
											</h1>
										</div>
									</div>
									<div className="balance-stats">
										<div className="stat-item">
											<span className="stat-label">Total Transactions</span>
											<span className="stat-value">
												{walletTransactions.length + 
													subscriptions.filter(sub => (sub.price || 0) > 0).length + 
													completedBookings.filter(booking => {
														const serviceFee = booking.pricing?.serviceFee || 0
														const guestFee = booking.pricing?.guestFee || 0
														return (serviceFee + guestFee) > 0
													}).length}
											</span>
										</div>
										<div className="stat-item">
											<span className="stat-label">This Month</span>
											<span className="stat-value">
												{(() => {
													const thisMonth = new Date()
													const currentMonth = thisMonth.getMonth()
													const currentYear = thisMonth.getFullYear()
													
													// Count wallet transactions this month
													const walletTxThisMonth = walletTransactions.filter((tx) => {
														const txDate = tx.createdAt?.toDate?.() || new Date()
														return (
															txDate.getMonth() === currentMonth &&
															txDate.getFullYear() === currentYear
														)
													}).length
													
													// Count subscriptions this month
													const subscriptionsThisMonth = subscriptions.filter((sub) => {
														const subDate = sub.createdAt?.toDate?.() || sub.createdAt || sub.startDate?.toDate?.() || sub.startDate || new Date(0)
														const price = sub.price || 0
														return (
															price > 0 &&
															subDate.getMonth() === currentMonth &&
															subDate.getFullYear() === currentYear
														)
													}).length
													
													// Count bookings this month
													const bookingsThisMonth = completedBookings.filter((booking) => {
														const bookingDate = booking.createdAt?.toDate?.() || booking.createdAt || new Date(0)
														const serviceFee = booking.pricing?.serviceFee || 0
														const guestFee = booking.pricing?.guestFee || 0
														return (
															(serviceFee + guestFee) > 0 &&
															bookingDate.getMonth() === currentMonth &&
															bookingDate.getFullYear() === currentYear
														)
													}).length
													
													return walletTxThisMonth + subscriptionsThisMonth + bookingsThisMonth
												})()}
											</span>
										</div>
									</div>
									<div className="balance-earnings">
										<div className="earnings-header">
											<span className="earnings-label">💰 Earnings from Bookings</span>
										</div>
										<div className="earnings-breakdown">
											<div className="earnings-item">
												<span className="earnings-type">Service Fee:</span>
												<span className="earnings-amount">
													₱{bookingEarnings.serviceFee.toLocaleString("en-PH", {
														minimumFractionDigits: 2,
														maximumFractionDigits: 2,
													})}
												</span>
											</div>
											<div className="earnings-item">
												<span className="earnings-type">Guest Fee:</span>
												<span className="earnings-amount">
													₱{bookingEarnings.guestFee.toLocaleString("en-PH", {
														minimumFractionDigits: 2,
														maximumFractionDigits: 2,
													})}
												</span>
											</div>
											<div className="earnings-item">
												<span className="earnings-type">Subscription Revenue:</span>
												<span className="earnings-amount">
													₱{subscriptionRevenue.toLocaleString("en-PH", {
														minimumFractionDigits: 2,
														maximumFractionDigits: 2,
													})}
												</span>
											</div>
											<div className="earnings-item total">
												<span className="earnings-type">Total Earnings:</span>
												<span className="earnings-amount">
													₱{(bookingEarnings.total + subscriptionRevenue).toLocaleString("en-PH", {
														minimumFractionDigits: 2,
														maximumFractionDigits: 2,
													})}
												</span>
											</div>
										</div>
									</div>
								</div>

								{/* PayPal Connection Card */}
								<div className="paypal-connection-card">
									<h3>💳 PayPal Account</h3>
									{adminPaypalEmail ? (
										<div className="paypal-connected">
											<div className="paypal-info">
												<div className="paypal-logo">💳</div>
												<div>
													<p className="paypal-status">✅ Connected</p>
													<p className="paypal-email">{adminPaypalEmail}</p>
													<p className="paypal-note">
														This PayPal account is used for processing guest
														withdrawals
													</p>
												</div>
											</div>
											<button
												className="disconnect-paypal-btn"
												onClick={handleDisconnectPaypal}
											>
												Disconnect
											</button>
										</div>
									) : (
										<div className="paypal-disconnected">
											<div className="paypal-warning">
												<span className="warning-icon">⚠️</span>
												<div>
													<p className="warning-title">PayPal Not Connected</p>
													<p className="warning-text">
														Connect your PayPal account to process guest
														withdrawals
													</p>
												</div>
											</div>
											<button
												className="connect-paypal-btn"
												onClick={() => setShowPaypalModal(true)}
											>
												Connect PayPal
											</button>
										</div>
									)}
								</div>

								{/* Transaction History */}
								<div className="transactions-section">
									<h3>📊 Transaction History</h3>

									{walletTransactions.length === 0 && completedBookings.length === 0 && subscriptions.length === 0 ? (
										<div className="empty-state">
											<div className="empty-icon">📭</div>
											<p>No transactions yet</p>
										</div>
									) : (
										<div className="transactions-table-wrapper">
											<table className="transactions-table">
												<thead>
													<tr>
														<th>Date & Time</th>
														<th>Type</th>
														<th>Description</th>
														<th>Amount</th>
														<th>Balance</th>
														<th>Status</th>
													</tr>
												</thead>
												<tbody>
													{/* Subscription Payments */}
													{subscriptions
														.filter((subscription) => {
															const price = subscription.price || 0
															return price > 0
														})
														.sort((a, b) => {
															const dateA = a.createdAt?.toDate?.() || a.createdAt || a.startDate?.toDate?.() || a.startDate || new Date(0)
															const dateB = b.createdAt?.toDate?.() || b.createdAt || b.startDate?.toDate?.() || b.startDate || new Date(0)
															return dateB - dateA
														})
														.map((subscription) => {
															const subDate = subscription.createdAt?.toDate?.() || subscription.createdAt || subscription.startDate?.toDate?.() || subscription.startDate || new Date()
															const price = subscription.price || 0

															return (
																<tr key={`subscription-${subscription.id}`}>
																	<td>
																		<div className="tx-date">
																			<div>
																				{subDate.toLocaleDateString("en-PH")}
																			</div>
																			<div className="tx-time">
																				{subDate.toLocaleTimeString("en-PH", {
																					hour: "2-digit",
																					minute: "2-digit",
																				})}
																			</div>
																		</div>
																	</td>
																	<td>
																		<span className="tx-type subscription_payment">
																			👑 Subscription Payment
																		</span>
																	</td>
																	<td>
																		<div className="tx-description">
																			{subscription.planName && (
																				<div className="property-title">
																					{subscription.planName} Plan
																				</div>
																			)}
																			{subscription.userId && (
																				<div className="recipient">
																					Host Subscription
																				</div>
																			)}
																			{subscription.paymentMethod && (
																				<div className="fee-item">
																					Payment: {subscription.paymentMethod === "wallet" ? "E-Wallet" : subscription.paymentMethod === "paypal" ? "PayPal" : subscription.paymentMethod}
																				</div>
																			)}
																		</div>
																	</td>
																	<td>
																		<span className="tx-amount positive">
																			+₱{price.toLocaleString("en-PH", {
																				minimumFractionDigits: 2,
																				maximumFractionDigits: 2,
																			})}
																		</span>
																	</td>
																	<td>
																		—
																	</td>
																	<td>
																		<span className={`status-badge ${subscription.status}`}>
																			{subscription.status === "active" && "✅"}
																			{subscription.status || "N/A"}
																		</span>
																	</td>
																</tr>
															)
														})}
													{/* Booking Earnings */}
													{completedBookings
														.filter((booking) => {
															const serviceFee = booking.pricing?.serviceFee || 0
															const guestFee = booking.pricing?.guestFee || 0
															return (serviceFee + guestFee) > 0
														})
														.sort((a, b) => {
															const dateA = a.createdAt?.toDate?.() || a.createdAt || new Date(0)
															const dateB = b.createdAt?.toDate?.() || b.createdAt || new Date(0)
															return dateB - dateA
														})
														.map((booking) => {
															const bookingDate = booking.createdAt?.toDate?.() || booking.createdAt || new Date()
															const serviceFee = booking.pricing?.serviceFee || 0
															const guestFee = booking.pricing?.guestFee || 0
															const totalEarnings = serviceFee + guestFee

															return (
																<tr key={`booking-${booking.id}`}>
																	<td>
																		<div className="tx-date">
																			<div>
																				{bookingDate.toLocaleDateString("en-PH")}
																			</div>
																			<div className="tx-time">
																				{bookingDate.toLocaleTimeString("en-PH", {
																					hour: "2-digit",
																					minute: "2-digit",
																				})}
																			</div>
																		</div>
																	</td>
																	<td>
																		<span className="tx-type booking_earning">
																			💰 Booking Earnings
																		</span>
																	</td>
																	<td>
																		<div className="tx-description">
																			{booking.propertyTitle && (
																				<div className="property-title">
																					{booking.propertyTitle}
																				</div>
																			)}
																			{booking.guestName && (
																				<div className="recipient">
																					Guest: {booking.guestName}
																				</div>
																			)}
																			<div className="fee-breakdown">
																				<div className="fee-item">
																					Service Fee: ₱{serviceFee.toLocaleString("en-PH", {
																						minimumFractionDigits: 2,
																						maximumFractionDigits: 2,
																					})}
																				</div>
																				<div className="fee-item">
																					Guest Fee: ₱{guestFee.toLocaleString("en-PH", {
																						minimumFractionDigits: 2,
																						maximumFractionDigits: 2,
																					})}
																				</div>
																			</div>
																		</div>
																	</td>
																	<td>
																		<span className="tx-amount positive">
																			+₱{totalEarnings.toLocaleString("en-PH", {
																				minimumFractionDigits: 2,
																				maximumFractionDigits: 2,
																			})}
																		</span>
																	</td>
																	<td>
																		—
																	</td>
																	<td>
																		<span className={`status-badge ${booking.status}`}>
																			{booking.status === "completed" && "✅"}
																			{booking.status === "confirmed" && "✅"}
																			{booking.status || "N/A"}
																		</span>
																	</td>
																</tr>
															)
														})}
													{/* Wallet Transactions */}
													{walletTransactions
														.filter((tx) => {
															const amount = tx.amount || 0
															return amount !== 0
														})
														.map((tx) => {
															const txDate =
																tx.createdAt?.toDate?.() || new Date()
															const isIncoming = [
																"booking_received",
																"top_up",
															].includes(tx.type)
															const isOutgoing = [
																"payment",
															].includes(tx.type)

															return (
															<tr key={tx.id}>
																<td>
																	<div className="tx-date">
																		<div>
																			{txDate.toLocaleDateString("en-PH")}
																		</div>
																		<div className="tx-time">
																			{txDate.toLocaleTimeString("en-PH", {
																				hour: "2-digit",
																				minute: "2-digit",
																			})}
																		</div>
																	</div>
																</td>
																<td>
																	<span className={`tx-type ${tx.type}`}>
																		{tx.type === "booking_received" &&
																			"📥 Booking"}
																		{tx.type === "top_up" && "➕ Top Up"}
																		{tx.type === "payment" && "💳 Payment"}
																		{![
																			"booking_received",
																			"top_up",
																			"payment",
																		].includes(tx.type) && `📝 ${tx.type}`}
																	</span>
																</td>
																<td>
																	<div className="tx-description">
																		{tx.propertyTitle && (
																			<div className="property-title">
																				{tx.propertyTitle}
																			</div>
																		)}
																		{tx.recipientEmail && (
																			<div className="recipient">
																				To: {tx.recipientEmail}
																			</div>
																		)}
																		{tx.paypalEmail && (
																			<div className="recipient">
																				From: {tx.paypalEmail}
																			</div>
																		)}
																		{tx.fee && (
																			<div className="fee">
																				Fee: ₱{tx.fee.toFixed(2)}
																			</div>
																		)}
																	</div>
																</td>
																<td>
																	<span
																		className={`tx-amount ${
																			isIncoming
																				? "positive"
																				: isOutgoing
																				? "negative"
																				: ""
																		}`}
																	>
																		{isIncoming && "+"}
																		{isOutgoing && "-"}₱
																		{(tx.amount || 0).toLocaleString("en-PH", {
																			minimumFractionDigits: 2,
																			maximumFractionDigits: 2,
																		})}
																	</span>
																</td>
																<td>
																	₱
																	{(tx.balanceAfter || 0).toLocaleString(
																		"en-PH",
																		{
																			minimumFractionDigits: 2,
																			maximumFractionDigits: 2,
																		}
																	)}
																</td>
																<td>
																	<span className={`status-badge ${tx.status}`}>
																		{tx.status === "completed" && "✅"}
																		{tx.status === "pending" && "⏳"}
																		{tx.status === "failed" && "❌"}{" "}
																		{tx.status || "N/A"}
																	</span>
																</td>
															</tr>
														)
													})}
												</tbody>
											</table>
										</div>
									)}
								</div>
							</>
						)}

						{/* PayPal Connection Modal */}
						{showPaypalModal && (
							<div
								className="modal-overlay"
								onClick={() => setShowPaypalModal(false)}
							>
								<div
									className="paypal-modal"
									onClick={(e) => e.stopPropagation()}
								>
									<div className="modal-header">
										<h3>💳 Connect PayPal Account</h3>
										<button
											className="close-modal-btn"
											onClick={() => setShowPaypalModal(false)}
										>
											✕
										</button>
									</div>

									<div className="modal-body">
										<div className="paypal-modal-info">
											<p className="info-text">
												Connect your PayPal account to process guest withdrawal
												requests. This email will be used to send payments when
												guests withdraw funds.
											</p>
											<div className="sandbox-notice">
												⚠️ Sandbox Mode - For Testing Only
											</div>
										</div>

										<div className="form-group">
											<label htmlFor="paypal-email-admin">
												PayPal Email Address
											</label>
											<input
												id="paypal-email-admin"
												type="email"
												className="paypal-email-input"
												placeholder="admin@paypal.com"
												value={paypalEmailInput}
												onChange={(e) => setPaypalEmailInput(e.target.value)}
											/>
										</div>

										<div className="modal-actions">
											<button
												className="cancel-btn"
												onClick={() => setShowPaypalModal(false)}
											>
												Cancel
											</button>
											<button
												className="connect-btn"
												onClick={handleConnectPaypal}
											>
												Connect PayPal
											</button>
										</div>
									</div>
								</div>
							</div>
						)}
					</div>
				)}


				{/* Flagging Tab */}
				{activeTab === "flagging" && (
					<div className="content-section flagging-section">
						<div className="section-header">
							<div>
								<h2>🚩 Flagged Properties</h2>
								<p>Review and manage property reports from guests</p>
							</div>
						</div>

						{loadingFlagged ? (
							<div className="loading-state">
								<p>Loading flagged properties...</p>
							</div>
						) : flaggedProperties.length === 0 ? (
							<div className="empty-state">
								<div className="empty-icon">✅</div>
								<p>No flagged properties</p>
								<p className="empty-subtitle">
									All properties are in good standing
								</p>
							</div>
						) : (
							<div className="flagged-properties-list">
								{flaggedProperties.map((report) => (
									<div
										key={report.id}
										className={`flagged-item ${
											report.status === "pending"
												? "pending"
												: report.status === "resolved"
												? "resolved"
												: "dismissed"
										}`}
									>
										<div className="flagged-header">
											<div className="flagged-info">
												<h3>{report.propertyTitle}</h3>
												<div className="flagged-meta">
													<span className="report-reason">
														Reason: {report.reason || "Not specified"}
													</span>
													<span className="report-date">
														Reported:{" "}
														{report.createdAt?.toDate?.()?.toLocaleDateString() ||
															"N/A"}
													</span>
												</div>
											</div>
											<div className="flagged-status">
												<span
													className={`status-badge ${
														report.status === "pending"
															? "pending"
															: report.status === "resolved"
															? "resolved"
															: "dismissed"
													}`}
												>
													{report.status === "pending"
														? "⏳ Pending"
														: report.status === "resolved"
														? "✅ Resolved"
														: "❌ Dismissed"}
												</span>
											</div>
										</div>
										<div className="flagged-details">
											<div className="report-details">
												<p>
													<strong>Reporter:</strong> {report.reporterName} (
													{report.reporterEmail})
												</p>
												<p>
													<strong>Property ID:</strong> {report.propertyId}
												</p>
												{report.description && (
													<div className="report-description">
														<strong>Description:</strong>
														<p>{report.description}</p>
													</div>
												)}
											</div>
											{report.status === "pending" && (
												<div className="flagged-actions">
													<button
														className="btn-resolve"
														onClick={() =>
															handleResolveReport(report.id, "resolved")
														}
													>
														✅ Resolve
													</button>
													<button
														className="btn-dismiss"
														onClick={() =>
															handleResolveReport(report.id, "dismissed")
														}
													>
														❌ Dismiss
													</button>
													<button
														className="btn-view-property"
														onClick={() =>
															navigate(`/property/${report.propertyId}`)
														}
													>
														👁️ View Property
													</button>
												</div>
											)}
										</div>
									</div>
								))}
							</div>
						)}
					</div>
				)}

				{/* Manage Host Tab */}
				{activeTab === "manageHost" && (
					<div className="content-section manage-host-section">
						<div className="section-header">
							<div>
								<h2>👥 Manage Hosts</h2>
								<p>View and manage all hosts with their average ratings</p>
							</div>
						</div>

						{loading ? (
							<div className="loading-state">
								<p>Loading hosts data...</p>
							</div>
						) : hosts.length === 0 ? (
							<div className="empty-state">
								<div className="empty-icon">👥</div>
								<p>No hosts found</p>
								<p className="empty-subtitle">
									Hosts will appear here once they list properties
								</p>
							</div>
						) : (
							<>
								{/* Top 5 Hosts */}
								<div className="hosts-section">
									<div className="hosts-section-header">
										<h3>⭐ Top 5 Hosts</h3>
									</div>
									<div className="hosts-table-wrapper">
										<table className="hosts-table">
											<thead>
												<tr>
													<th>Host Name</th>
													<th>Email</th>
													<th>Average Rating</th>
													<th>Properties</th>
													<th>Rated Properties</th>
													<th>Actions</th>
												</tr>
											</thead>
											<tbody>
												{hosts.slice(0, 5).map((host) => (
													<tr key={host.hostId}>
														<td>
															<strong>{host.displayName}</strong>
														</td>
														<td>{host.email}</td>
														<td>
															<div className="rating-display">
																<span className="rating-value">
																	{host.averageRating > 0
																		? host.averageRating.toFixed(1)
																		: "N/A"}
																</span>
																{host.averageRating > 0 && (
																	<span className="rating-stars">
																		{"⭐".repeat(Math.floor(host.averageRating))}
																	</span>
																)}
															</div>
														</td>
														<td>{host.propertiesCount}</td>
														<td>{host.ratedPropertiesCount}</td>
														<td>
															<button
																className="btn-view-details"
																onClick={() => {
																	setSelectedHost(host)
																	setShowHostModal(true)
																}}
															>
																View Details
															</button>
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								</div>

								{/* Least 5 Hosts */}
								<div className="hosts-section">
									<div className="hosts-section-header">
										<h3>📉 Least 5 Hosts</h3>
									</div>
									<div className="hosts-table-wrapper">
										<table className="hosts-table">
											<thead>
												<tr>
													<th>Host Name</th>
													<th>Email</th>
													<th>Average Rating</th>
													<th>Properties</th>
													<th>Rated Properties</th>
													<th>Actions</th>
												</tr>
											</thead>
											<tbody>
												{hosts.slice(-5).map((host) => (
													<tr key={host.hostId}>
														<td>
															<strong>{host.displayName}</strong>
														</td>
														<td>{host.email}</td>
														<td>
															<div className="rating-display">
																<span className="rating-value">
																	{host.averageRating > 0
																		? host.averageRating.toFixed(1)
																		: "N/A"}
																</span>
																{host.averageRating > 0 && (
																	<span className="rating-stars">
																		{"⭐".repeat(Math.floor(host.averageRating))}
																	</span>
																)}
															</div>
														</td>
														<td>{host.propertiesCount}</td>
														<td>{host.ratedPropertiesCount}</td>
														<td>
															<button
																className="btn-view-details"
																onClick={() => {
																	setSelectedHost(host)
																	setShowHostModal(true)
																}}
															>
																View Details
															</button>
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								</div>

								{/* View All Button */}
								<div className="view-all-section">
									<button
										className="btn-view-all"
										onClick={() => navigate("/hostList")}
									>
										View All Hosts ({hosts.length})
									</button>
								</div>
							</>
						)}
					</div>
				)}

				{/* Host Details Modal */}
				{showHostModal && selectedHost && (
					<div
						className="modal-overlay"
						onClick={() => {
							setShowHostModal(false)
							setSelectedHost(null)
						}}
					>
						<div
							className="host-details-modal"
							onClick={(e) => e.stopPropagation()}
						>
							<div className="modal-header">
								<h2>👤 Host Details</h2>
								<button
									className="modal-close-btn"
									onClick={() => {
										setShowHostModal(false)
										setSelectedHost(null)
									}}
								>
									<FaTimes />
								</button>
							</div>

							<div className="modal-body host-details-content">
								<div className="host-details-section">
									<h3>Rating Information</h3>
									<div className="detail-grid">
										<div className="detail-item">
											<label>Average Rating:</label>
											<div className="rating-display-large">
												<span className="rating-value-large">
													{selectedHost.averageRating > 0
														? selectedHost.averageRating.toFixed(1)
														: "N/A"}
												</span>
												{selectedHost.averageRating > 0 && (
													<span className="rating-stars-large">
														{"⭐".repeat(
															Math.floor(selectedHost.averageRating)
														)}
													</span>
												)}
											</div>
										</div>
										<div className="detail-item">
											<label>Total Properties:</label>
											<span>{selectedHost.propertiesCount}</span>
										</div>
										<div className="detail-item">
											<label>Rated Properties:</label>
											<span>{selectedHost.ratedPropertiesCount}</span>
										</div>
									</div>
								</div>

								<div className="host-details-section">
									<h3>Properties List</h3>
									{selectedHost.properties.length === 0 ? (
										<p className="no-properties">No properties listed</p>
									) : (
										(() => {
											// Find top property (highest rating)
											const topProperty = selectedHost.properties.reduce(
												(top, current) => {
													const topRating = top.rating || 0
													const currentRating = current.rating || 0
													return currentRating > topRating ? current : top
												},
												selectedHost.properties[0]
											)

											// Find lowest rating property
											const lowestProperty = selectedHost.properties.reduce(
												(lowest, current) => {
													const lowestRating = lowest.rating || 0
													const currentRating = current.rating || 0
													// Only consider properties with ratings > 0, or if all are 0, return the first
													if (lowestRating === 0 && currentRating > 0)
														return current
													if (currentRating === 0 && lowestRating > 0)
														return lowest
													return currentRating < lowestRating ? current : lowest
												},
												selectedHost.properties[0]
											)

											const displayProperties = []
											if (topProperty)
												displayProperties.push({
													...topProperty,
													label: "Top Property",
												})
											if (
												lowestProperty &&
												lowestProperty.id !== topProperty?.id
											) {
												displayProperties.push({
													...lowestProperty,
													label: "Lowest Rating",
												})
											}

											return (
												<div className="properties-list">
													{displayProperties.map((property) => (
														<div key={property.id} className="property-item">
															<div className="property-image-container">
																<img
																	src={property.images?.[0] || housePlaceholder}
																	alt={property.title || "Property"}
																	className="property-image"
																/>
															</div>
															<div className="property-header">
																<div>
																	<span className="property-label">
																		{property.label}
																	</span>
																	<h4>
																		{property.title || "Untitled Property"}
																	</h4>
																</div>
																<span className="property-rating">
																	{property.rating > 0
																		? `${property.rating.toFixed(1)} ⭐`
																		: "No rating"}
																</span>
															</div>
															<div className="property-details">
																{property.location?.city && (
																	<span className="property-location">
																		📍 {property.location.city}
																		{property.location.province &&
																			`, ${property.location.province}`}
																	</span>
																)}
																{property.pricing?.basePrice && (
																	<span className="property-price">
																		₱
																		{property.pricing.basePrice.toLocaleString()}
																		/night
																	</span>
																)}
																{property.category && (
																	<span className="host-property-category-badge">
																		{property.category}
																	</span>
																)}
															</div>
															{property.reviewsCount !== undefined && (
																<div className="property-reviews">
																	{property.reviewsCount} review
																	{property.reviewsCount !== 1 ? "s" : ""}
																</div>
															)}
														</div>
													))}
												</div>
											)
										})()
									)}
								</div>

								{selectedHost.userData && (
									<div className="host-details-section">
										<h3>Account Information</h3>
										<div className="detail-grid">
											{selectedHost.userData.firstName && (
												<div className="detail-item">
													<label>First Name:</label>
													<span>{selectedHost.userData.firstName}</span>
												</div>
											)}
											{selectedHost.userData.lastName && (
												<div className="detail-item">
													<label>Last Name:</label>
													<span>{selectedHost.userData.lastName}</span>
												</div>
											)}
											{selectedHost.userData.createdAt && (
												<div className="detail-item">
													<label>Member Since:</label>
													<span>
														{selectedHost.userData.createdAt?.toDate
															? selectedHost.userData.createdAt
																	.toDate()
																	.toLocaleDateString()
															: new Date(
																	selectedHost.userData.createdAt
															  ).toLocaleDateString()}
													</span>
												</div>
											)}
											<div className="detail-item">
												<label>Host ID:</label>
												<span className="host-id">{selectedHost.hostId}</span>
											</div>
											{selectedHost.userData.userType && (
												<div className="detail-item">
													<label>User Type:</label>
													<span className="user-type-badge">
														{selectedHost.userData.userType}
													</span>
												</div>
											)}
											<div className="detail-item">
												<label>Subscription Type:</label>
												<span
													className={`subscription-badge ${
														selectedHost.subscriptionType?.toLowerCase() ||
														"free"
													}`}
												>
													{selectedHost.subscriptionType || "Free"}
												</span>
											</div>
										</div>
									</div>
								)}
							</div>

							<div className="modal-footer">
								<button
									className="btn-close-modal"
									onClick={() => {
										setShowHostModal(false)
										setSelectedHost(null)
									}}
								>
									Close
								</button>
							</div>
						</div>
					</div>
				)}
			</main>
		</div>
	)
}

export default AdminDashboard
