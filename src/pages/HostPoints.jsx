import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import { db } from "../components/firebaseConfig"
import {
	doc,
	getDoc,
	collection,
	query,
	where,
	getDocs,
	orderBy,
	limit,
	updateDoc,
	addDoc,
	serverTimestamp,
} from "firebase/firestore"
import { toast } from "react-stacked-toast"
import {
	FaArrowLeft,
	FaStar,
	FaGift,
	FaTrophy,
	FaMedal,
	FaCoins,
	FaCheckCircle,
	FaCalendarAlt,
	FaCalendarCheck,
	FaPlus,
	FaMinus,
	FaFire,
	FaBook,
	FaBars,
	FaUser,
	FaSignOutAlt,
	FaEnvelope,
	FaCrown,
} from "react-icons/fa"
import "../css/HostPoints.css"
import "../css/DashboardHost.css"
import logoPlain from "../assets/logoPlain.png"

export default function HostPoints() {
	const navigate = useNavigate()
	const { currentUser, userData, logout } = useAuth()
	const [loading, setLoading] = useState(true)
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

	// Fetch user subscription status
	const fetchUserSubscription = async () => {
		if (!currentUser?.uid) return

		try {
			const userDoc = await getDoc(doc(db, "users", currentUser.uid))
			if (userDoc.exists()) {
				const userData = userDoc.data()
				const subscription = userData.subscription || null
				setUserSubscription(subscription)
			} else {
				setUserSubscription({
					planId: "standard",
					status: "active",
					price: 0,
				})
			}
		} catch (error) {
			console.error("Error fetching subscription:", error)
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
		if (userSubscription.planId === "standard" || !userSubscription.planId) {
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
		if (userSubscription.planId === "premium") {
			if (userSubscription.status === "active") {
				return true
			}
			if (
				userSubscription.status === "cancelling" &&
				userSubscription.expiryDate
			) {
				const expiryDate = userSubscription.expiryDate.toDate
					? userSubscription.expiryDate.toDate()
					: new Date(userSubscription.expiryDate)
				const now = new Date()
				return expiryDate > now
			}
		}
		return false
	}
	const [pointsData, setPointsData] = useState({
		totalPoints: 0,
		lifetimePoints: 0,
		redeemedPoints: 0,
		tier: "Bronze", // Bronze, Silver, Gold, Platinum
	})
	const [transactions, setTransactions] = useState([])
	const [rewards, setRewards] = useState([])
	const [subscription, setSubscription] = useState(null)
	const [monthlyGoals, setMonthlyGoals] = useState({
		listings: { current: 0, target: 4, completed: false },
		bookings: { current: 0, target: 4, completed: false },
	})
	const [monthlyGoalRewardClaimed, setMonthlyGoalRewardClaimed] =
		useState(false)
	const [isClaimingReward, setIsClaimingReward] = useState(false)
	const [exchangePoints, setExchangePoints] = useState("")
	const [isExchanging, setIsExchanging] = useState(false)
	const [availableRewards] = useState([
		{
			id: 1,
			name: "Featured Listing",
			description: "Get your property featured for 7 days",
			points: 500,
			icon: "⭐",
			type: "feature",
		},
		{
			id: 2,
			name: "Discount Voucher",
			description: "Get 10% off on your next premium subscription",
			points: 1000,
			icon: "🎟️",
			type: "discount",
		},
		{
			id: 3,
			name: "Priority Support",
			description: "Get priority customer support for 30 days",
			points: 750,
			icon: "💬",
			type: "support",
		},
		{
			id: 4,
			name: "Boost Property",
			description:
				"Your property will be featured on the front page of the guest page",
			points: 300,
			icon: "🚀",
			type: "boost",
		},
	])

	useEffect(() => {
		if (!currentUser?.uid) {
			navigate("/login")
			return
		}
		fetchPointsData()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentUser])

	const fetchPointsData = async () => {
		if (!currentUser?.uid) return

		try {
			setLoading(true)

			// Get user document
			const userDoc = await getDoc(doc(db, "users", currentUser.uid))
			if (userDoc.exists()) {
				const userData = userDoc.data()
				const points = userData.points || 0
				const lifetimePoints = userData.lifetimePoints || points
				const redeemedPoints = userData.redeemedPoints || 0

				// Get subscription
				const userSubscription = userData.subscription || null
				setSubscription(userSubscription)

				// Calculate tier based on lifetime points
				let tier = "Bronze"
				if (lifetimePoints >= 10000) tier = "Platinum"
				else if (lifetimePoints >= 5000) tier = "Gold"
				else if (lifetimePoints >= 2000) tier = "Silver"

				setPointsData({
					totalPoints: points,
					lifetimePoints: lifetimePoints,
					redeemedPoints: redeemedPoints,
					tier: tier,
				})
			}

			// Fetch monthly goals progress
			const now = new Date()
			const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
			const endOfMonth = new Date(
				now.getFullYear(),
				now.getMonth() + 1,
				0,
				23,
				59,
				59
			)

			// Count listings this month
			// Query by hostId (top-level field)
			const listingsQuery = query(
				collection(db, "properties"),
				where("hostId", "==", currentUser.uid)
			)
			const listingsSnapshot = await getDocs(listingsQuery)
			let allListings = listingsSnapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			}))

			// Also check for properties with host.hostId (fallback)
			const listingsQuery2 = query(
				collection(db, "properties"),
				where("host.hostId", "==", currentUser.uid)
			)
			try {
				const listingsSnapshot2 = await getDocs(listingsQuery2)
				const listings2 = listingsSnapshot2.docs.map((doc) => ({
					id: doc.id,
					...doc.data(),
				}))
				// Merge and deduplicate by id
				const existingIds = new Set(allListings.map((l) => l.id))
				const newListings = listings2.filter((l) => !existingIds.has(l.id))
				allListings = [...allListings, ...newListings]
			} catch (err) {
				console.log("Could not query by host.hostId:", err)
			}

			// Filter listings created this month
			const listingsThisMonth = allListings.filter((listing) => {
				if (!listing.createdAt) {
					// If no createdAt, include it (might be an older property)
					return true
				}
				const createdAt =
					listing.createdAt?.toDate?.() || new Date(listing.createdAt || 0)
				return createdAt >= startOfMonth && createdAt <= endOfMonth
			})

			// If no listings this month but user has listings, show total listings count
			const totalListings = allListings.length
			const listingsCount =
				listingsThisMonth.length > 0 ? listingsThisMonth.length : totalListings

			// Count bookings this month (completed bookings)
			const bookingsQuery = query(
				collection(db, "bookings"),
				where("hostId", "==", currentUser.uid)
			)
			const bookingsSnapshot = await getDocs(bookingsQuery)
			const allBookings = bookingsSnapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			}))

			const bookingsThisMonth = allBookings.filter((booking) => {
				const checkOutDate = new Date(booking.checkOutDate)
				checkOutDate.setHours(0, 0, 0, 0)
				return (
					checkOutDate >= startOfMonth &&
					checkOutDate <= endOfMonth &&
					booking.status === "completed"
				)
			})

			setMonthlyGoals({
				listings: {
					current: listingsCount,
					target: 4,
					completed: listingsCount >= 4,
				},
				bookings: {
					current: bookingsThisMonth.length,
					target: 4,
					completed: bookingsThisMonth.length >= 4,
				},
			})

			console.log("📊 Monthly Goals:", {
				listings: {
					thisMonth: listingsThisMonth.length,
					total: totalListings,
					displayed: listingsCount,
				},
				bookings: bookingsThisMonth.length,
			})

			// Check if monthly goal reward was already claimed this month
			try {
				const monthlyGoalRewardQuery = query(
					collection(db, "pointsTransactions"),
					where("userId", "==", currentUser.uid),
					where("type", "==", "monthly_goal_bonus"),
					orderBy("createdAt", "desc"),
					limit(1)
				)
				const rewardSnapshot = await getDocs(monthlyGoalRewardQuery)
				if (!rewardSnapshot.empty) {
					const rewardData = rewardSnapshot.docs[0].data()
					const rewardDate =
						rewardData.createdAt?.toDate?.() ||
						new Date(rewardData.createdAt || 0)
					// Check if reward was claimed this month
					if (rewardDate >= startOfMonth && rewardDate <= endOfMonth) {
						setMonthlyGoalRewardClaimed(true)
					} else {
						setMonthlyGoalRewardClaimed(false)
					}
				} else {
					setMonthlyGoalRewardClaimed(false)
				}
			} catch {
				// If orderBy fails, try without it
				try {
					const monthlyGoalRewardQuery2 = query(
						collection(db, "pointsTransactions"),
						where("userId", "==", currentUser.uid),
						where("type", "==", "monthly_goal_bonus"),
						limit(10)
					)
					const rewardSnapshot2 = await getDocs(monthlyGoalRewardQuery2)
					if (!rewardSnapshot2.empty) {
						// Sort manually and check the most recent
						const rewards = rewardSnapshot2.docs.map((doc) => ({
							id: doc.id,
							...doc.data(),
						}))
						rewards.sort((a, b) => {
							const dateA =
								a.createdAt?.toDate?.() || new Date(a.createdAt || 0)
							const dateB =
								b.createdAt?.toDate?.() || new Date(b.createdAt || 0)
							return dateB - dateA
						})
						const mostRecent = rewards[0]
						const rewardDate =
							mostRecent.createdAt?.toDate?.() ||
							new Date(mostRecent.createdAt || 0)
						if (rewardDate >= startOfMonth && rewardDate <= endOfMonth) {
							setMonthlyGoalRewardClaimed(true)
						} else {
							setMonthlyGoalRewardClaimed(false)
						}
					} else {
						setMonthlyGoalRewardClaimed(false)
					}
				} catch (err2) {
					console.log("Could not check monthly goal reward status:", err2)
					setMonthlyGoalRewardClaimed(false)
				}
			}

			// Fetch transaction history
			try {
				const transactionsQuery = query(
					collection(db, "pointsTransactions"),
					where("userId", "==", currentUser.uid),
					orderBy("createdAt", "desc"),
					limit(50)
				)
				const transactionsSnapshot = await getDocs(transactionsQuery)
				const transactionsList = transactionsSnapshot.docs.map((doc) => ({
					id: doc.id,
					...doc.data(),
				}))
				setTransactions(transactionsList)
			} catch (error) {
				// If orderBy fails (index not created), try without it
				console.log("Ordered query failed, trying without orderBy:", error)
				try {
					const transactionsQuery2 = query(
						collection(db, "pointsTransactions"),
						where("userId", "==", currentUser.uid),
						limit(50)
					)
					const transactionsSnapshot2 = await getDocs(transactionsQuery2)
					const transactionsList2 = transactionsSnapshot2.docs.map((doc) => ({
						id: doc.id,
						...doc.data(),
					}))
					// Sort manually by createdAt descending
					transactionsList2.sort((a, b) => {
						const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0)
						const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0)
						return dateB - dateA
					})
					setTransactions(transactionsList2)
				} catch (error2) {
					// Collection might not exist yet or no transactions
					console.log("Points transactions collection may not exist:", error2)
					setTransactions([])
				}
			}

			// Fetch redeemed rewards
			const rewardsQuery = query(
				collection(db, "redeemedRewards"),
				where("userId", "==", currentUser.uid),
				orderBy("redeemedAt", "desc"),
				limit(10)
			)

			try {
				const rewardsSnapshot = await getDocs(rewardsQuery)
				const rewardsList = rewardsSnapshot.docs.map((doc) => ({
					id: doc.id,
					...doc.data(),
				}))
				setRewards(rewardsList)
			} catch {
				console.log("Redeemed rewards collection may not exist")
				setRewards([])
			}
		} catch (error) {
			console.error("Error fetching points data:", error)
			toast.error("Failed to load points data")
		} finally {
			setLoading(false)
		}
	}

	const handleClaimMonthlyGoal = async () => {
		if (!currentUser?.uid) {
			toast.error("Please log in to claim reward")
			return
		}

		if (isClaimingReward) return

		if (!monthlyGoals.listings.completed || !monthlyGoals.bookings.completed) {
			toast.error("Complete all monthly goals to claim the reward")
			return
		}

		if (monthlyGoalRewardClaimed) {
			toast.error("Monthly goal reward already claimed this month")
			return
		}

		try {
			setIsClaimingReward(true)

			const userDocRef = doc(db, "users", currentUser.uid)
			const userDoc = await getDoc(userDocRef)

			if (!userDoc.exists()) {
				toast.error("User not found")
				return
			}

			const currentPoints = userDoc.data().points || 0
			const currentLifetimePoints = userDoc.data().lifetimePoints || 0
			const newPoints = currentPoints + 200
			const newLifetimePoints = currentLifetimePoints + 200

			// Update user points
			await updateDoc(userDocRef, {
				points: newPoints,
				lifetimePoints: newLifetimePoints,
			})

			// Add transaction record
			await addDoc(collection(db, "pointsTransactions"), {
				userId: currentUser.uid,
				type: "monthly_goal_bonus",
				amount: 200,
				description: "Monthly Goal Bonus - Completed all monthly goals",
				balanceBefore: currentPoints,
				balanceAfter: newPoints,
				createdAt: serverTimestamp(),
			})

			setMonthlyGoalRewardClaimed(true)
			toast.success("🎉 +200 points claimed for completing monthly goals!")
			fetchPointsData() // Refresh to update points display
		} catch (error) {
			console.error("Error claiming monthly goal reward:", error)
			toast.error("Failed to claim reward. Please try again.")
		} finally {
			setIsClaimingReward(false)
		}
	}

	const handleExchangePoints = async () => {
		if (!currentUser?.uid) {
			toast.error("Please log in to exchange points")
			return
		}

		const pointsToExchange = parseInt(exchangePoints)
		
		if (!pointsToExchange || pointsToExchange <= 0) {
			toast.error("Please enter a valid amount of points")
			return
		}

		if (pointsToExchange < 100) {
			toast.error("Minimum exchange is 100 points")
			return
		}

		if (pointsToExchange > pointsData.totalPoints) {
			toast.error("Insufficient points")
			return
		}

		// Exchange rate: 100 points = 100 pesos (1:1 ratio)
		const pesoAmount = pointsToExchange

		try {
			setIsExchanging(true)
			const userDocRef = doc(db, "users", currentUser.uid)
			const userDoc = await getDoc(userDocRef)

			if (!userDoc.exists()) {
				toast.error("User not found")
				return
			}

			const userData = userDoc.data()
			const currentPoints = userData.points || 0
			const currentRedeemed = userData.redeemedPoints || 0
			const currentWalletBalance = userData.walletBalance || 0

			// Update user points and add to wallet balance
			const newWalletBalance = currentWalletBalance + pesoAmount
			await updateDoc(userDocRef, {
				points: currentPoints - pointsToExchange,
				redeemedPoints: currentRedeemed + pointsToExchange,
				walletBalance: newWalletBalance,
			})

			// Add points transaction record
			await addDoc(collection(db, "pointsTransactions"), {
				userId: currentUser.uid,
				type: "exchange",
				amount: -pointsToExchange,
				description: `Exchanged ${pointsToExchange} points for ₱${pesoAmount.toLocaleString()}`,
				pesoAmount: pesoAmount,
				createdAt: serverTimestamp(),
			})

			// Add wallet transaction record
			await addDoc(collection(db, "walletTransactions"), {
				userId: currentUser.uid,
				type: "points_exchange",
				amount: pesoAmount,
				description: "Points Redeemed",
				pointsExchanged: pointsToExchange,
				balanceBefore: currentWalletBalance,
				balanceAfter: newWalletBalance,
				status: "completed",
				createdAt: serverTimestamp(),
			})

			toast.success(`Successfully exchanged ${pointsToExchange} points for ₱${pesoAmount.toLocaleString()}! Amount added to your e-wallet.`)
			setExchangePoints("")
			fetchPointsData()
		} catch (error) {
			console.error("Error exchanging points:", error)
			toast.error("Failed to exchange points. Please try again.")
		} finally {
			setIsExchanging(false)
		}
	}

	const getTierColor = (tier) => {
		switch (tier) {
			case "Platinum":
				return "#e5e7eb"
			case "Gold":
				return "#fbbf24"
			case "Silver":
				return "#94a3b8"
			case "Bronze":
				return "#cd7f32"
			default:
				return "#6b7280"
		}
	}

	const getTierIcon = (tier) => {
		switch (tier) {
			case "Platinum":
				return <FaTrophy style={{ color: "#e5e7eb" }} />
			case "Gold":
				return <FaTrophy style={{ color: "#fbbf24" }} />
			case "Silver":
				return <FaMedal style={{ color: "#94a3b8" }} />
			case "Bronze":
				return <FaMedal style={{ color: "#cd7f32" }} />
			default:
				return <FaStar />
		}
	}

	const formatDate = (date) => {
		if (!date) return "N/A"
		const d = date.toDate ? date.toDate() : new Date(date)
		return d.toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		})
	}

	// Helper function to determine if transaction is earning or redeeming
	const isEarningTransaction = (type) => {
		const earningTypes = [
			"earn",
			"property_listed",
			"monthly_goal_bonus",
			"booking_completed",
			"review_received",
		]
		return earningTypes.includes(type)
	}

	// Helper function to get transaction icon
	const getTransactionIcon = (type) => {
		switch (type) {
			case "property_listed":
				return <FaBook className="earn-icon" />
			case "monthly_goal_bonus":
				return <FaStar className="earn-icon" />
			case "booking_completed":
				return <FaCalendarCheck className="earn-icon" />
			case "review_received":
				return <FaStar className="earn-icon" />
			case "redeem":
				return <FaMinus className="redeem-icon" />
			case "exchange":
				return <FaCoins className="redeem-icon" />
			default:
				return isEarningTransaction(type) ? (
					<FaPlus className="earn-icon" />
				) : (
					<FaMinus className="redeem-icon" />
				)
		}
	}

	// Helper function to get transaction description
	const getTransactionDescription = (transaction) => {
		if (transaction.description) return transaction.description

		switch (transaction.type) {
			case "property_listed":
				return transaction.propertyTitle
					? `Points earned for listing "${transaction.propertyTitle}"`
					: "Points earned for listing a property"
			case "monthly_goal_bonus":
				return "Monthly Goal Bonus - Completed all monthly goals"
			case "booking_completed":
				return transaction.propertyTitle
					? `Points earned for completed booking at "${transaction.propertyTitle}"`
					: "Points earned for completed booking"
			case "review_received":
				return "Points earned for receiving a 5-star review"
			case "redeem":
				return transaction.description || "Redeemed reward"
			case "exchange":
				return transaction.description || `Exchanged ${Math.abs(transaction.amount || 0)} points for ₱${transaction.pesoAmount || 0}`
			default:
				return transaction.description || "Transaction"
		}
	}

	// Helper function to get transaction amount
	const getTransactionAmount = (transaction) => {
		return transaction.amount || transaction.points || 0
	}

	// Get appropriate dashboard route based on user type
	const getDashboardRoute = () => {
		if (!userData?.userType) return "/dashboardHost"
		if (userData.userType === "admin") return "/admin"
		if (userData.userType === "host") return "/dashboardHost"
		return "/dashboardGuest"
	}

	if (loading) {
		return (
			<div className="host-points-container">
				<div className="loading-state">
					<div className="spinner"></div>
					<p>Loading points and rewards...</p>
				</div>
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
				<div className="host-points-container">
					{/* Main Content */}
					<div className="points-main-content">
				{/* Points Overview */}
				<div className="points-overview-section">
					<h1 className="points-title">
						<FaStar className="title-icon" />
						Points & Rewards
					</h1>

					{/* Points Balance Card - Compact Design */}
					<div className="points-balance-card-compact" style={{
						background: "white",
						borderRadius: "16px",
						padding: "1.5rem",
						marginBottom: "2rem",
						boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
						border: "2px solid #e9ecef",
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						gap: "1.5rem",
						flexWrap: "wrap"
					}}>
						<div style={{ display: "flex", alignItems: "center", gap: "1rem", flex: "1", minWidth: "200px" }}>
							<div style={{
								background: "linear-gradient(135deg, var(--primary), var(--secondary))",
								borderRadius: "12px",
								padding: "1rem",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								minWidth: "60px",
								height: "60px"
							}}>
								<FaCoins style={{ fontSize: "2rem", color: "white" }} />
							</div>
							<div>
								<div style={{ fontSize: "0.875rem", color: "#666", marginBottom: "0.25rem" }}>
									Available Points
								</div>
								<div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--primary)" }}>
									{pointsData.totalPoints.toLocaleString()}
								</div>
							</div>
						</div>
						<div style={{
							display: "flex",
							gap: "1.5rem",
							flexWrap: "wrap",
							alignItems: "center"
						}}>
							<div style={{ textAlign: "center" }}>
								<div style={{ fontSize: "0.75rem", color: "#666", marginBottom: "0.25rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
									Tier
								</div>
								<div
									style={{
										display: "inline-flex",
										alignItems: "center",
										gap: "0.5rem",
										padding: "0.5rem 1rem",
										background: "rgba(97, 191, 156, 0.1)",
										border: `2px solid ${getTierColor(pointsData.tier)}`,
										borderRadius: "20px",
										fontWeight: 600,
										fontSize: "0.875rem",
										color: getTierColor(pointsData.tier)
									}}
								>
									{getTierIcon(pointsData.tier)}
									<span>{pointsData.tier}</span>
								</div>
							</div>
							<div style={{ textAlign: "center" }}>
								<div style={{ fontSize: "0.75rem", color: "#666", marginBottom: "0.25rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
									Lifetime
								</div>
								<div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#374151" }}>
									{pointsData.lifetimePoints.toLocaleString()}
								</div>
							</div>
							<div style={{ textAlign: "center" }}>
								<div style={{ fontSize: "0.75rem", color: "#666", marginBottom: "0.25rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
									Redeemed
								</div>
								<div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#374151" }}>
									{pointsData.redeemedPoints.toLocaleString()}
								</div>
							</div>
						</div>
					</div>

					{/* How to Earn Points */}
					<div className="earn-points-section">
						<h3>
							<FaFire /> How to Earn Points
						</h3>
						<div className="earn-points-grid">
							<div className="earn-point-card">
								<div className="earn-icon">📅</div>
								<h4>Complete Bookings</h4>
								<p>
									{subscription?.planId === "premium" &&
									subscription?.status === "active" ? (
										<>+200 points per week (max per completed booking)</>
									) : (
										<>+100 points per week (max per completed booking)</>
									)}
								</p>
							</div>
							<div className="earn-point-card">
								<div className="earn-icon">⭐</div>
								<h4>Get Reviews</h4>
								<p>+20 points per week (for 5-star reviews)</p>
							</div>
							<div className="earn-point-card">
								<div className="earn-icon">📝</div>
								<h4>Property Listings</h4>
								<p>
									{subscription?.planId === "premium" &&
									subscription?.status === "active" ? (
										<>+200 points per week (max per new listing)</>
									) : (
										<>+100 points per week (max per new listing)</>
									)}
								</p>
							</div>
							<div className="earn-point-card">
								<div className="earn-icon">🎯</div>
								<h4>Monthly Goals</h4>
								<p>Achieve Monthly Goal to gain more points</p>
							</div>
						</div>

						{/* Monthly Goals Progress */}
						<div className="monthly-goals-section">
							<h4>Monthly Goals Progress</h4>
							<div className="goals-grid">
								<div className="goal-item">
									<div className="goal-header">
										<span className="goal-label">📝 Listings</span>
										<span className="goal-progress">
											{monthlyGoals.listings.current}/
											{monthlyGoals.listings.target}
										</span>
									</div>
									<div className="goal-bar">
										<div
											className="goal-bar-fill"
											style={{
												width: `${Math.min(
													(monthlyGoals.listings.current /
														monthlyGoals.listings.target) *
														100,
													100
												)}%`,
											}}
										></div>
									</div>
									{monthlyGoals.listings.completed && (
										<span className="goal-completed">✓ Completed!</span>
									)}
								</div>
								<div className="goal-item">
									<div className="goal-header">
										<span className="goal-label">📅 Bookings</span>
										<span className="goal-progress">
											{monthlyGoals.bookings.current}/
											{monthlyGoals.bookings.target}
										</span>
									</div>
									<div className="goal-bar">
										<div
											className="goal-bar-fill"
											style={{
												width: `${Math.min(
													(monthlyGoals.bookings.current /
														monthlyGoals.bookings.target) *
														100,
													100
												)}%`,
											}}
										></div>
									</div>
									{monthlyGoals.bookings.completed && (
										<span className="goal-completed">✓ Completed!</span>
									)}
								</div>
							</div>
							<div className="monthly-goal-bonus">
								<div className="monthly-goal-bonus-content">
									<FaStar />{" "}
									{monthlyGoals.listings.completed &&
									monthlyGoals.bookings.completed
										? "Monthly Goal Achieved! +200 points bonus"
										: "Complete all monthly goals to earn +200 points bonus"}
								</div>
								{monthlyGoalRewardClaimed ? (
									<span className="monthly-goal-claimed">✓ Claimed</span>
								) : (
									<button
										className="claim-monthly-goal-btn"
										onClick={handleClaimMonthlyGoal}
										disabled={
											isClaimingReward ||
											!monthlyGoals.listings.completed ||
											!monthlyGoals.bookings.completed
										}
									>
										{isClaimingReward ? "Claiming..." : "Claim +200pts"}
									</button>
								)}
							</div>
						</div>
					</div>
				</div>

				{/* Exchange Points Section */}
				<div className="rewards-section">
					<h2 className="section-title">
						<FaCoins /> Exchange Points
					</h2>
					<div className="exchange-points-card" style={{
						background: "white",
						borderRadius: "16px",
						padding: "2rem",
						boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
						border: "2px solid #e9ecef",
						maxWidth: "600px",
						margin: "0 auto"
					}}>
						<div style={{
							textAlign: "center",
							marginBottom: "2rem"
						}}>
							<p style={{
								fontSize: "1.1rem",
								color: "#666",
								marginBottom: "0.5rem"
							}}>
								Exchange Rate
							</p>
							<h3 style={{
								fontSize: "1.8rem",
								color: "var(--primary)",
								margin: 0,
								fontWeight: 700
							}}>
								100 points = ₱100
							</h3>
						</div>
						
						<div style={{
							marginBottom: "1.5rem"
						}}>
							<label style={{
								display: "block",
								marginBottom: "0.5rem",
								fontWeight: 600,
								color: "#374151"
							}}>
								Points to Exchange
							</label>
							<input
								type="number"
								value={exchangePoints}
								onChange={(e) => {
									const value = e.target.value
									if (value === "" || (parseInt(value) >= 0 && parseInt(value) <= pointsData.totalPoints)) {
										setExchangePoints(value)
									}
								}}
								placeholder="Enter points (minimum 100)"
								min="100"
								max={pointsData.totalPoints}
								style={{
									width: "100%",
									padding: "0.75rem 1rem",
									border: "2px solid #e5e7eb",
									borderRadius: "8px",
									fontSize: "1rem",
									outline: "none",
									transition: "all 0.3s ease"
								}}
								onFocus={(e) => e.target.style.borderColor = "var(--primary)"}
								onBlur={(e) => e.target.style.borderColor = "#e5e7eb"}
							/>
							<p style={{
								marginTop: "0.5rem",
								fontSize: "0.875rem",
								color: "#6b7280"
							}}>
								Available: {pointsData.totalPoints.toLocaleString()} points
							</p>
						</div>

						{exchangePoints && parseInt(exchangePoints) >= 100 && (
							<div style={{
								background: "#f0f9ff",
								padding: "1rem",
								borderRadius: "8px",
								marginBottom: "1.5rem",
								textAlign: "center"
							}}>
								<p style={{
									margin: 0,
									color: "#1e40af",
									fontSize: "0.95rem"
								}}>
									You will receive: <strong style={{ fontSize: "1.2rem" }}>₱{parseInt(exchangePoints || 0).toLocaleString()}</strong>
								</p>
							</div>
						)}

						<button
							onClick={handleExchangePoints}
							disabled={
								isExchanging ||
								!exchangePoints ||
								parseInt(exchangePoints) < 100 ||
								parseInt(exchangePoints) > pointsData.totalPoints
							}
							style={{
								width: "100%",
								padding: "1rem",
								background: pointsData.totalPoints >= 100 && parseInt(exchangePoints || 0) >= 100 && parseInt(exchangePoints || 0) <= pointsData.totalPoints
									? "linear-gradient(135deg, var(--primary), var(--secondary))"
									: "#e5e7eb",
								color: pointsData.totalPoints >= 100 && parseInt(exchangePoints || 0) >= 100 && parseInt(exchangePoints || 0) <= pointsData.totalPoints
									? "white"
									: "#9ca3af",
								border: "none",
								borderRadius: "8px",
								fontSize: "1.1rem",
								fontWeight: 600,
								cursor: pointsData.totalPoints >= 100 && parseInt(exchangePoints || 0) >= 100 && parseInt(exchangePoints || 0) <= pointsData.totalPoints
									? "pointer"
									: "not-allowed",
								transition: "all 0.3s ease",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								gap: "0.5rem"
							}}
							onMouseEnter={(e) => {
								if (pointsData.totalPoints >= 100 && parseInt(exchangePoints || 0) >= 100 && parseInt(exchangePoints || 0) <= pointsData.totalPoints) {
									e.target.style.transform = "translateY(-2px)"
									e.target.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.15)"
								}
							}}
							onMouseLeave={(e) => {
								e.target.style.transform = "translateY(0)"
								e.target.style.boxShadow = "none"
							}}
						>
							{isExchanging ? (
								<>Processing...</>
							) : (
								<>
									<FaCoins /> Exchange Points
								</>
							)}
						</button>
					</div>
				</div>

				{/* Transaction History */}
				<div className="transactions-section">
					<h2 className="section-title">
						<FaCalendarAlt /> Transaction History
					</h2>
					{transactions.length === 0 ? (
						<div className="empty-state">
							<FaCalendarAlt className="empty-icon" />
							<p>No transactions yet</p>
							<span>Your point transactions will appear here</span>
						</div>
					) : (
						<div className="transactions-list">
							{transactions.map((transaction) => {
								const isEarn = isEarningTransaction(transaction.type)
								const amount = getTransactionAmount(transaction)
								const description = getTransactionDescription(transaction)
								const isExchange = transaction.type === "exchange"

								return (
									<div key={transaction.id} className="transaction-item">
										<div className="transaction-icon">
											{getTransactionIcon(transaction.type)}
										</div>
										<div className="transaction-details">
											<h4>{description}</h4>
											<p>{formatDate(transaction.createdAt)}</p>
											{transaction.propertyTitle && (
												<p className="transaction-property">
													Property: {transaction.propertyTitle}
												</p>
											)}
											{isExchange && transaction.pesoAmount && (
												<p className="transaction-property" style={{ color: "var(--primary)", fontWeight: 600 }}>
													Added ₱{transaction.pesoAmount.toLocaleString()} to e-wallet
												</p>
											)}
										</div>
										<div
											className={`transaction-amount ${
												isEarn ? "earn" : "redeem"
											}`}
										>
											{isEarn ? "+" : "-"}
											{Math.abs(amount).toLocaleString()} pts
										</div>
									</div>
								)
							})}
						</div>
					)}
				</div>

				{/* Redeemed Rewards */}
				{rewards.length > 0 && (
					<div className="redeemed-rewards-section">
						<h2 className="section-title">
							<FaGift /> My Redeemed Rewards
						</h2>
						<div className="redeemed-rewards-grid">
							{rewards.map((reward) => (
								<div key={reward.id} className="redeemed-reward-card">
									<div className="reward-status-badge">
										<FaCheckCircle />
										<span>{reward.status}</span>
									</div>
									<h4>{reward.rewardName}</h4>
									<p>Redeemed on {formatDate(reward.redeemedAt)}</p>
									<div className="reward-points-spent">
										<FaCoins />
										<span>{reward.pointsSpent.toLocaleString()} points</span>
									</div>
								</div>
							))}
						</div>
					</div>
				)}
					</div>
				</div>
			</main>
		</div>
	)
}
