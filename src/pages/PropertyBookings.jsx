import { useEffect, useState, useMemo } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import { db } from "../components/firebaseConfig"
import {
	doc,
	getDoc,
	collection,
	query,
	where,
	getDocs,
	updateDoc,
	orderBy,
} from "firebase/firestore"
import { toast } from "react-stacked-toast"
import {
	FaArrowLeft,
	FaCalendarAlt,
	FaUsers,
	FaCheck,
	FaTimes,
	FaBars,
	FaUser,
	FaSignOutAlt,
	FaEnvelope,
	FaCrown,
} from "react-icons/fa"
import "../css/DashboardHost.css"
import emailjs from "@emailjs/browser"
import logoPlain from "../assets/logoPlain.png"

export default function PropertyBookings() {
	const { propertyId } = useParams()
	const navigate = useNavigate()
	const { currentUser, userData, logout } = useAuth()
	const [loading, setLoading] = useState(true)
	const [property, setProperty] = useState(null)
	const [bookings, setBookings] = useState([])
	const [isApproving, setIsApproving] = useState({})
	const [isCancelling, setIsCancelling] = useState({})
	const [filter, setFilter] = useState("all") // all | pending | confirmed | cancelled
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

	// Get appropriate dashboard route based on user type
	const getDashboardRoute = () => {
		if (!userData?.userType) return "/dashboardHost"
		if (userData.userType === "admin") return "/admin"
		if (userData.userType === "host") return "/dashboardHost"
		return "/dashboardGuest"
	}

	// Fetch user subscription status
	const fetchUserSubscription = async () => {
		if (!currentUser?.uid) return

		try {
			const userDoc = await getDoc(doc(db, "users", currentUser.uid))
			if (userDoc.exists()) {
				const userData = userDoc.data()
				const subscription = userData.subscription || null

				// Check if cancelling subscription has expired
				if (
					subscription &&
					subscription.status === "cancelling" &&
					subscription.expiryDate
				) {
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

	// Check if user is in free trial mode
	const isFreeTrial = () => {
		if (!userSubscription || hasPremium()) return false

		// User is in free trial if:
		// 1. On free/standard plan
		// 2. Account created within last 14 days (trial period)
		if (userSubscription.planId === "standard" || !userSubscription.planId) {
			// Use Firebase Auth metadata for account creation time
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

		// Premium access if:
		// 1. Active premium subscription
		// 2. Cancelling premium subscription that hasn't expired yet
		if (userSubscription.planId === "premium") {
			if (userSubscription.status === "active") {
				return true
			}

			// Check if cancelling subscription is still valid (not expired)
			if (
				userSubscription.status === "cancelling" &&
				userSubscription.expiryDate
			) {
				const expiryDate = userSubscription.expiryDate.toDate
					? userSubscription.expiryDate.toDate()
					: new Date(userSubscription.expiryDate)
				const now = new Date()
				return expiryDate > now // Still has premium access until expiry
			}
		}

		return false
	}

	useEffect(() => {
		loadData()
		if (currentUser?.uid) {
			fetchUserSubscription()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [propertyId, currentUser])

	const loadData = async () => {
		if (!propertyId) return
		setLoading(true)
		try {
			console.log("[PropertyBookings] loadData start", {
				routePropertyId: propertyId,
			})
			const propRef = doc(db, "properties", propertyId)
			const propSnap = await getDoc(propRef)
			if (!propSnap.exists()) {
				// Try resolving by custom data.id and then redirect to canonical docsId
				try {
					console.warn(
						"[PropertyBookings] Property doc not found by docsId, trying data.id resolution",
						{ propertyId }
					)
					const propsRef = collection(db, "properties")
					const byDataId = query(propsRef, where("id", "==", propertyId))
					const byDataIdSnap = await getDocs(byDataId)
					console.log(
						"[PropertyBookings] data.id search size:",
						byDataIdSnap.size
					)
					if (!byDataIdSnap.empty) {
						const found = byDataIdSnap.docs[0]
						const pdata = found.data()
						const { id: customId, ...rest } = pdata || {}
						console.log("[PropertyBookings] Resolved property via data.id", {
							docsId: found.id,
							customId,
						})
						setProperty({ id: found.id, customId, ...rest })
						// Redirect to canonical route with Firestore doc ID
						navigate(`/propertyBookings/${found.id}`, { replace: true })
					} else {
						console.error(
							"[PropertyBookings] Property not found by docsId or data.id",
							{ propertyId }
						)
						toast.error("Property not found")
						navigate("/dashboardHost")
						return
					}
				} catch (resolveErr) {
					console.error(
						"[PropertyBookings] Error resolving property by data.id:",
						resolveErr
					)
					toast.error("Property not found")
					navigate("/dashboardHost")
					return
				}
			} else {
				const pdata = propSnap.data()
				const { id: customId, ...rest } = pdata || {}
				console.log("[PropertyBookings] Loaded property by docsId", {
					docsId: propSnap.id,
					customId,
				})
				setProperty({ id: propSnap.id, customId, ...rest })
			}

			// Fetch bookings by any known property identifier:
			// - Current route param (propertyId)
			// - Firestore docsId (set above as propSnap.id or found.id)
			// - Custom property data id (property.customId)
			const bookingsRef = collection(db, "bookings")
			const idsToTry = new Set()
			idsToTry.add(propertyId)
			// After property set, we can use the latest identifiers
			const docsId = propSnap.exists() ? propSnap.id : undefined
			if (docsId) idsToTry.add(docsId)
			// Note: when we resolved by data.id, we already redirected; however, add it defensively
			const propData = propSnap.exists() ? propSnap.data() : undefined
			const customDataId = propData?.id
			if (customDataId) idsToTry.add(customDataId)
			console.log(
				"[PropertyBookings] IDs to query for bookings:",
				Array.from(idsToTry)
			)

			// Execute queries sequentially (to avoid 'in' limit issues) and merge results
			const all = []
			const seen = new Set()
			for (const pid of idsToTry) {
				console.log("[PropertyBookings] Querying bookings for propertyId:", pid)
				const baseQ = query(bookingsRef, where("propertyId", "==", pid))
				// Try with orderBy first; if index required, fall back to simple where
				try {
					const orderedQ = query(baseQ, orderBy("createdAt", "desc"))
					const snap = await getDocs(orderedQ)
					console.log("[PropertyBookings] Ordered query size", {
						pid,
						size: snap.size,
					})
					snap.docs.forEach((d) => {
						if (!seen.has(d.id)) {
							seen.add(d.id)
							all.push({ id: d.id, ...d.data() })
						}
					})
				} catch (err) {
					console.warn(
						"[PropertyBookings] Ordered query failed, falling back without orderBy",
						{
							pid,
							code: err?.code,
							message: err?.message,
						}
					)
					const snap = await getDocs(baseQ)
					console.log("[PropertyBookings] Fallback query size", {
						pid,
						size: snap.size,
					})
					snap.docs.forEach((d) => {
						if (!seen.has(d.id)) {
							seen.add(d.id)
							all.push({ id: d.id, ...d.data() })
						}
					})
				}
			}
			// Fallback: sort in-memory by createdAt desc
			all.sort((a, b) => {
				const da = a.createdAt?.toDate?.() || new Date(a.createdAt || 0)
				const db = b.createdAt?.toDate?.() || new Date(b.createdAt || 0)
				return db - da
			})
			console.log("[PropertyBookings] Total bookings loaded:", all.length)
			setBookings(all)
		} catch (e) {
			console.error("[PropertyBookings] Error loading property bookings:", e)
			toast.error("Failed to load bookings")
		} finally {
			console.log("[PropertyBookings] loadData end")
			setLoading(false)
		}
	}

	const filtered = useMemo(() => {
		if (filter === "all") return bookings
		return bookings.filter((b) => (b.status || "pending") === filter)
	}, [bookings, filter])

	// Debug: Log booking statuses to verify visibility
	useEffect(() => {
		if (!bookings || bookings.length === 0) {
			console.log("[PropertyBookings] No bookings to display.")
			return
		}
		const summary = bookings.reduce(
			(acc, b) => {
				const st = (b.status || "pending").toLowerCase()
				acc.total += 1
				acc[st] = (acc[st] || 0) + 1
				return acc
			},
			{ total: 0 }
		)
		console.log("[PropertyBookings] Bookings status summary:", summary)
		console.log(
			"[PropertyBookings] First 5 booking statuses:",
			bookings
				.slice(0, 5)
				.map((b) => ({ id: b.id, status: b.status || "pending" }))
		)
	}, [bookings])

	const formatDate = (d) => {
		const dt = new Date(d)
		return dt.toLocaleDateString()
	}

	const sendBookingStatusEmail = async (booking, status) => {
		try {
			const serviceId = import.meta.env.VITE_EMAILJS_HOST_SERVICE_ID
			const templateId = import.meta.env.VITE_EMAILJS_HOST_BOOKING_TEMPLATE_ID
			const publicKey = import.meta.env.VITE_EMAILJS_HOST_PUBLIC_KEY
			if (!serviceId || !templateId || !publicKey) {
				console.log("serviceId", serviceId)
				console.log("templateId", templateId)
				console.log("publicKey", publicKey)
				console.warn("[PropertyBookings] Missing EmailJS env vars")
				return
			}
			emailjs.init(publicKey)
			const params = {
				order_id: booking.id,
				guestName: booking.guestName || "Guest",
				propertyName: property?.title || "Property",
				status: status,
				orderNumber: booking.id?.substring(0, 8),
				date: `${formatDate(booking.checkInDate)} → ${formatDate(
					booking.checkOutDate
				)}`,
				price: (booking.pricing?.basePrice || 0).toLocaleString(),
				cleaningFee: (booking.pricing?.cleaningFee || 0).toLocaleString(),
				serviceFee: (booking.pricing?.serviceFee || 0).toLocaleString(),
				guestFee: (booking.pricing?.guestFee || 0).toLocaleString(),
				total: (booking.pricing?.total || 0).toLocaleString(),
				email: booking.guestEmail || "",
			}
			console.log("[PropertyBookings] Sending booking status email", {
				serviceId,
				templateId,
				params,
			})
			await emailjs.send(serviceId, templateId, params)
			console.log("[PropertyBookings] Email sent")
		} catch (e) {
			console.error("[PropertyBookings] Failed to send email:", e)
		}
	}

	const canApprove = (b) => {
		const instant = Boolean(property?.availability?.instantBook)
		return !instant && (b.status || "pending") === "pending"
	}

	const approveBooking = async (bookingId) => {
		try {
			setIsApproving((prev) => ({ ...prev, [bookingId]: true }))
			await updateDoc(doc(db, "bookings", bookingId), { status: "confirmed" })
			toast.success("Booking approved")
			setBookings((prev) =>
				prev.map((b) =>
					b.id === bookingId ? { ...b, status: "confirmed" } : b
				)
			)
			const approved = bookings.find((b) => b.id === bookingId) || {}
			await sendBookingStatusEmail({ ...approved, id: bookingId }, "approved")
		} catch (e) {
			console.error("Error approving booking:", e)
			toast.error("Failed to approve booking")
		} finally {
			setIsApproving((prev) => ({ ...prev, [bookingId]: false }))
		}
	}

	const cancelBooking = async (bookingId) => {
		try {
			setIsCancelling((prev) => ({ ...prev, [bookingId]: true }))
			await updateDoc(doc(db, "bookings", bookingId), { status: "cancelled" })
			toast.success("Booking cancelled")
			setBookings((prev) =>
				prev.map((b) =>
					b.id === bookingId ? { ...b, status: "cancelled" } : b
				)
			)
			const cancelled = bookings.find((b) => b.id === bookingId) || {}
			await sendBookingStatusEmail({ ...cancelled, id: bookingId }, "cancelled")
		} catch (e) {
			console.error("Error cancelling booking:", e)
			toast.error("Failed to cancel booking")
		} finally {
			setIsCancelling((prev) => ({ ...prev, [bookingId]: false }))
		}
	}

	if (loading) {
		return (
			<div className="host-loading-wrapper">
				<div className="host-loading-spinner"></div>
				<p>Loading bookings...</p>
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
				{/* Page Header */}
				<div className="page-header-section">
					<div className="page-header-content">
						<h1 className="page-title">
							Bookings for <strong>{property?.title || "Property"}</strong>
						</h1>
						<p className="page-subtitle">
							View and manage all bookings for this property
						</p>
					</div>
				</div>
				<section className="categories-section">
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
							marginBottom: "1rem",
						}}
					>
						<h2>All Bookings</h2>
						<div className="category-tabs" style={{ margin: 0 }}>
							<button
								className={`category-tab ${filter === "all" ? "active" : ""}`}
								onClick={() => setFilter("all")}
							>
								All
							</button>
							<button
								className={`category-tab ${
									filter === "pending" ? "active" : ""
								}`}
								onClick={() => setFilter("pending")}
							>
								Pending
							</button>
							<button
								className={`category-tab ${
									filter === "confirmed" ? "active" : ""
								}`}
								onClick={() => setFilter("confirmed")}
							>
								Approved
							</button>
							<button
								className={`category-tab ${
									filter === "cancelled" ? "active" : ""
								}`}
								onClick={() => setFilter("cancelled")}
							>
								Cancelled
							</button>
						</div>
					</div>

					{filtered.length === 0 ? (
						<div className="host-empty-message">
							<p>No bookings found.</p>
						</div>
					) : (
						<div
							className="booking-table"
							style={{ width: "100%", overflowX: "auto" }}
						>
							<div
								className="booking-table-header"
								style={{
									display: "grid",
									gridTemplateColumns: "1.2fr 1fr 160px 140px 220px",
									gap: "0.75rem",
									padding: "0.75rem 1rem",
									borderBottom: "1px solid #e5e7eb",
									background: "#f8f9fa",
									borderRadius: "8px 8px 0 0",
									fontWeight: 600,
									color: "#415f94",
								}}
							>
								<div style={{ textAlign: "center" }}>Dates</div>
								<div style={{ textAlign: "left" }}>Guests / Nights</div>
								<div style={{ textAlign: "center" }}>Status</div>
								<div style={{ textAlign: "center" }}>Total</div>
								<div style={{ textAlign: "center" }}>Actions</div>
							</div>

							<div className="booking-table-body">
								{filtered.map(
									(b) => (
										// Debug: log each row's status during render
										console.log("[PropertyBookings] Rendering row", {
											id: b.id,
											status: b.status || "pending",
										}),
										(
											<div
												key={b.id}
												className="booking-table-row"
												style={{
													display: "grid",
													gridTemplateColumns: "1.2fr 1fr 160px 140px 220px",
													gap: "0.75rem",
													alignItems: "center",
													padding: "0.9rem 1rem",
													borderBottom: "1px solid #eef0f3",
													background: "#ffffff",
												}}
											>
												{/* Dates */}
												<div
													style={{
														display: "flex",
														alignItems: "center",
														gap: "0.5rem",
														color: "#374151",
													}}
												>
													<FaCalendarAlt />
													<span>
														{formatDate(b.checkInDate)} →{" "}
														{formatDate(b.checkOutDate)}
													</span>
												</div>

												{/* Guests / Nights */}
												<div
													style={{
														display: "flex",
														alignItems: "center",
														gap: "1rem",
														color: "#374151",
													}}
												>
													<span>
														<FaUsers /> {b.numberOfGuests || b.guests || 1}{" "}
														guest
														{(b.numberOfGuests || b.guests || 1) > 1 ? "s" : ""}
													</span>
													{b.numberOfNights && (
														<span>
															🌙 {b.numberOfNights} night
															{b.numberOfNights > 1 ? "s" : ""}
														</span>
													)}
												</div>

												{/* Status */}
												<div style={{ textAlign: "center" }}>
													{(() => {
														const st = (b.status || "pending").toLowerCase()
														const stylesMap = {
															confirmed: {
																bg: "#ecfdf5",
																color: "#10b981",
																border: "#10b981",
																text: "approved",
															},
															pending: {
																bg: "#fff7ed",
																color: "#f59e0b",
																border: "#f59e0b",
																text: "pending",
															},
															cancelled: {
																bg: "#fef2f2",
																color: "#ef4444",
																border: "#ef4444",
																text: "cancelled",
															},
														}
														const s = stylesMap[st] || stylesMap.pending
														return (
															<span
																style={{
																	display: "inline-block",
																	padding: "0.25rem 0.5rem",
																	borderRadius: "9999px",
																	background: s.bg,
																	color: s.color,
																	border: `1px solid ${s.border}`,
																	fontWeight: 600,
																	minWidth: 100,
																	textTransform: "capitalize",
																}}
															>
																{s.text}
															</span>
														)
													})()}
												</div>

												{/* Total */}
												<div
													style={{
														textAlign: "center",
														fontWeight: 700,
														color: "#415f94",
														whiteSpace: "nowrap",
													}}
												>
													₱{(b.pricing?.total || 0).toLocaleString()}
												</div>

												{/* Actions (right side) */}
												<div
													style={{
														display: "grid",
														gridTemplateColumns: "1fr 1fr",
														gap: "0.5rem",
														alignItems: "center",
														justifyContent: "flex-end",
													}}
												>
													{canApprove(b) && (
														<button
															className="generate-report-btn"
															onClick={() => approveBooking(b.id)}
															disabled={isApproving[b.id]}
															title="Approve"
															aria-label="Approve"
															style={{
																width: "100%",
																display: "flex",
																alignItems: "center",
																justifyContent: "center",
																padding: "0.5rem 0.4rem",
															}}
														>
															<FaCheck />
														</button>
													)}
													{(b.status || "pending") !== "cancelled" && (
														<button
															className="premium-cancel-btn"
															onClick={() => cancelBooking(b.id)}
															disabled={isCancelling[b.id]}
															title="Cancel"
															aria-label="Cancel"
															style={{
																width: "100%",
																display: "flex",
																alignItems: "center",
																justifyContent: "center",
																padding: "0.5rem 0.4rem",
																background: "#ffffff",
																color: "#ef4444",
																border: "1px solid #ef4444",
															}}
														>
															<FaTimes color="#ef4444" />
														</button>
													)}
												</div>
											</div>
										)
									)
								)}
							</div>
						</div>
					)}
				</section>
			</main>
		</div>
	)
}
