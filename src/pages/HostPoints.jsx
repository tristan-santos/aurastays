import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import { db } from "../components/firebaseConfig"
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit, updateDoc, addDoc, serverTimestamp } from "firebase/firestore"
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
	FaPlus,
	FaMinus,
	FaFire,
} from "react-icons/fa"
import "../css/HostPoints.css"
import logoPlain from "../assets/logoPlain.png"

export default function HostPoints() {
	const navigate = useNavigate()
	const { currentUser, userData } = useAuth()
	const [loading, setLoading] = useState(true)
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
			description: "Your property will be featured on the front page of the guest page",
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
			const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

			// Count listings this month
			const listingsQuery = query(
				collection(db, "properties"),
				where("hostId", "==", currentUser.uid)
			)
			const listingsSnapshot = await getDocs(listingsQuery)
			const allListings = listingsSnapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			}))

			const listingsThisMonth = allListings.filter((listing) => {
				const createdAt = listing.createdAt?.toDate?.() || new Date(listing.createdAt || 0)
				return createdAt >= startOfMonth && createdAt <= endOfMonth
			})

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
				return checkOutDate >= startOfMonth && checkOutDate <= endOfMonth && booking.status === "completed"
			})

			setMonthlyGoals({
				listings: {
					current: listingsThisMonth.length,
					target: 4,
					completed: listingsThisMonth.length >= 4,
				},
				bookings: {
					current: bookingsThisMonth.length,
					target: 4,
					completed: bookingsThisMonth.length >= 4,
				},
			})

			// Fetch transaction history
			const transactionsQuery = query(
				collection(db, "pointsTransactions"),
				where("userId", "==", currentUser.uid),
				orderBy("createdAt", "desc"),
				limit(20)
			)

			try {
				const transactionsSnapshot = await getDocs(transactionsQuery)
				const transactionsList = transactionsSnapshot.docs.map((doc) => ({
					id: doc.id,
					...doc.data(),
				}))
				setTransactions(transactionsList)
			} catch (error) {
				// Collection might not exist yet
				console.log("Points transactions collection may not exist")
				setTransactions([])
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
			} catch (error) {
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

	const handleRedeemReward = async (reward) => {
		if (!currentUser?.uid) {
			toast.error("Please log in to redeem rewards")
			return
		}

		if (pointsData.totalPoints < reward.points) {
			toast.error("Insufficient points to redeem this reward")
			return
		}

		try {
			const userDocRef = doc(db, "users", currentUser.uid)
			const userDoc = await getDoc(userDocRef)

			if (!userDoc.exists()) {
				toast.error("User not found")
				return
			}

			const currentPoints = userDoc.data().points || 0
			const currentRedeemed = userDoc.data().redeemedPoints || 0

			// Update user points
			await updateDoc(userDocRef, {
				points: currentPoints - reward.points,
				redeemedPoints: currentRedeemed + reward.points,
			})

			// Add transaction record
			await addDoc(collection(db, "pointsTransactions"), {
				userId: currentUser.uid,
				type: "redeem",
				amount: -reward.points,
				description: `Redeemed: ${reward.name}`,
				createdAt: serverTimestamp(),
			})

			// Add redeemed reward record
			await addDoc(collection(db, "redeemedRewards"), {
				userId: currentUser.uid,
				rewardId: reward.id,
				rewardName: reward.name,
				rewardType: reward.type,
				pointsSpent: reward.points,
				redeemedAt: serverTimestamp(),
				status: "active",
			})

			toast.success(`Successfully redeemed ${reward.name}!`)
			fetchPointsData()
		} catch (error) {
			console.error("Error redeeming reward:", error)
			toast.error("Failed to redeem reward. Please try again.")
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
		<div className="host-points-container">
			{/* Header */}
			<div className="points-header">
				<button className="host-points-back-button" onClick={() => navigate("/dashboardHost")}>
					<FaArrowLeft />
					<span>Back to Dashboard</span>
				</button>
				<div className="header-logo">
					<img src={logoPlain} alt="AuraStays" />
					<span className="logo-text">AuraStays</span>
				</div>
			</div>

			{/* Main Content */}
			<div className="points-main-content">
				{/* Points Overview */}
				<div className="points-overview-section">
					<h1 className="points-title">
						<FaStar className="title-icon" />
						Points & Rewards
					</h1>

					{/* Points Balance Card */}
					<div className="points-balance-card">
						<div className="balance-header">
							<h2>Available Points</h2>
							<div className="tier-badge" style={{ borderColor: getTierColor(pointsData.tier) }}>
								{getTierIcon(pointsData.tier)}
								<span style={{ color: getTierColor(pointsData.tier) }}>{pointsData.tier}</span>
							</div>
						</div>
						<div className="balance-amount">
							<FaCoins className="coins-icon" />
							<span>{pointsData.totalPoints.toLocaleString()}</span>
						</div>
						<div className="balance-stats">
							<div className="stat-item">
								<span className="stat-label">Lifetime Points</span>
								<span className="stat-value">{pointsData.lifetimePoints.toLocaleString()}</span>
							</div>
							<div className="stat-item">
								<span className="stat-label">Redeemed</span>
								<span className="stat-value">{pointsData.redeemedPoints.toLocaleString()}</span>
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
									{subscription?.planId === "premium" && subscription?.status === "active" ? (
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
									{subscription?.planId === "premium" && subscription?.status === "active" ? (
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
											{monthlyGoals.listings.current}/{monthlyGoals.listings.target}
										</span>
									</div>
									<div className="goal-bar">
										<div
											className="goal-bar-fill"
											style={{
												width: `${Math.min(
													(monthlyGoals.listings.current / monthlyGoals.listings.target) * 100,
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
											{monthlyGoals.bookings.current}/{monthlyGoals.bookings.target}
										</span>
									</div>
									<div className="goal-bar">
										<div
											className="goal-bar-fill"
											style={{
												width: `${Math.min(
													(monthlyGoals.bookings.current / monthlyGoals.bookings.target) * 100,
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
							{monthlyGoals.listings.completed && monthlyGoals.bookings.completed && (
								<div className="monthly-goal-bonus">
									<FaStar /> Monthly Goal Achieved! +200 points bonus
								</div>
							)}
						</div>
					</div>
				</div>

				{/* Available Rewards */}
				<div className="rewards-section">
					<h2 className="section-title">
						<FaGift /> Available Rewards
					</h2>
					<div className="rewards-grid">
						{availableRewards.map((reward) => (
							<div key={reward.id} className="reward-card">
								<div className="reward-icon">{reward.icon}</div>
								<h3>{reward.name}</h3>
								<p>{reward.description}</p>
								<div className="reward-cost">
									<FaCoins />
									<span>{reward.points.toLocaleString()} points</span>
								</div>
								<button
									className={`redeem-button ${
										pointsData.totalPoints >= reward.points ? "" : "disabled"
									}`}
									onClick={() => handleRedeemReward(reward)}
									disabled={pointsData.totalPoints < reward.points}
								>
									{pointsData.totalPoints >= reward.points ? (
										<>
											<FaCheckCircle /> Redeem Now
										</>
									) : (
										"Not Enough Points"
									)}
								</button>
							</div>
						))}
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
							{transactions.map((transaction) => (
								<div key={transaction.id} className="transaction-item">
									<div className="transaction-icon">
										{transaction.type === "earn" ? (
											<FaPlus className="earn-icon" />
										) : (
											<FaMinus className="redeem-icon" />
										)}
									</div>
									<div className="transaction-details">
										<h4>{transaction.description || "Transaction"}</h4>
										<p>{formatDate(transaction.createdAt)}</p>
									</div>
									<div
										className={`transaction-amount ${
											transaction.type === "earn" ? "earn" : "redeem"
										}`}
									>
										{transaction.type === "earn" ? "+" : "-"}
										{Math.abs(transaction.amount).toLocaleString()}
									</div>
								</div>
							))}
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
	)
}

