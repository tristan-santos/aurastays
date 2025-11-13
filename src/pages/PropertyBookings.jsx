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
	addDoc,
	orderBy,
	serverTimestamp,
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
	const [isApprovingCancellation, setIsApprovingCancellation] = useState({})
	const [isRejectingCancellation, setIsRejectingCancellation] = useState({})
	const [filter, setFilter] = useState("all") // all | pending | confirmed | cancelled | cancellation_requested
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

	const canApproveCancellation = (b) => {
		return (b.status || "pending") === "cancellation_requested"
	}

	const approveCancellation = async (bookingId) => {
		try {
			setIsApprovingCancellation((prev) => ({ ...prev, [bookingId]: true }))
			const booking = bookings.find((b) => b.id === bookingId)
			if (!booking) {
				toast.error("Booking not found")
				return
			}

			// Calculate refund based on policy
			// If guest cancelled a CONFIRMED booking, NO REFUND even if within 48 hours
			// Full refund only if cancelled within 48 hours AND booking was PENDING (not confirmed)
			let refundAmount = 0
			const cancellationRequestedAt = booking.cancellationRequestedAt
			const totalAmount = booking.pricing?.total || 0
			const previousStatus = booking.previousStatus || "pending"

			// Check if booking was previously confirmed
			// If guest cancelled a confirmed booking, NO REFUND
			if (previousStatus === "confirmed") {
				refundAmount = 0 // No refund for guest-cancelled confirmed bookings
			} else if (cancellationRequestedAt) {
				// Booking was pending - check 48 hour rule
				const requestedDate = cancellationRequestedAt.toDate 
					? cancellationRequestedAt.toDate() 
					: new Date(cancellationRequestedAt)
				const now = new Date()
				const hoursSinceRequest = (now - requestedDate) / (1000 * 60 * 60)
				
				// Full refund if within 48 hours and booking was pending
				if (hoursSinceRequest <= 48) {
					refundAmount = totalAmount
				}
			} else {
				// If no cancellationRequestedAt timestamp and not confirmed, assume full refund
				if (previousStatus !== "confirmed") {
					refundAmount = totalAmount
				}
			}

			// Update booking status
			await updateDoc(doc(db, "bookings", bookingId), { 
				status: "cancelled",
				cancellationApprovedAt: serverTimestamp(),
				cancellationApprovedBy: currentUser.uid,
				refundAmount: refundAmount,
				refundProcessedAt: refundAmount > 0 ? serverTimestamp() : null,
			})

			// Process refund if applicable
			if (refundAmount > 0 && booking.guestId) {
				try {
					// Get guest's current wallet balance
					const guestRef = doc(db, "users", booking.guestId)
					const guestDoc = await getDoc(guestRef)
					
					if (guestDoc.exists()) {
						const guestData = guestDoc.data()
						const currentBalance = guestData?.walletBalance || 0
						const newBalance = currentBalance + refundAmount

						// Update guest wallet
						await updateDoc(guestRef, {
							walletBalance: newBalance,
						})

						// Add transaction to guest's transaction history
						await addDoc(collection(db, "walletTransactions"), {
							userId: booking.guestId,
							type: "refund",
							amount: refundAmount,
							propertyTitle: property?.title || booking.propertyTitle || "Property",
							propertyId: booking.propertyId || propertyId || "",
							bookingId: bookingId,
							balanceBefore: currentBalance,
							balanceAfter: newBalance,
							status: "completed",
							description: `Refund for cancelled booking at ${property?.title || booking.propertyTitle || "Property"}`,
							createdAt: serverTimestamp(),
						})

						console.log(`[PropertyBookings] Refunded ₱${refundAmount.toLocaleString()} to guest wallet`)
					}

					// Decrease host's wallet balance
					const hostId = property?.hostId || booking.hostId || currentUser?.uid
					if (hostId) {
						const hostRef = doc(db, "users", hostId)
						const hostDoc = await getDoc(hostRef)
						
						if (hostDoc.exists()) {
							const hostData = hostDoc.data()
							const hostCurrentBalance = hostData?.walletBalance || 0
							const hostNewBalance = Math.max(0, hostCurrentBalance - refundAmount) // Ensure balance doesn't go negative

							// Update host wallet
							await updateDoc(hostRef, {
								walletBalance: hostNewBalance,
							})

							// Add transaction to host's transaction history
							await addDoc(collection(db, "walletTransactions"), {
								userId: hostId,
								type: "refund_deduction",
								amount: -refundAmount,
								propertyTitle: property?.title || booking.propertyTitle || "Property",
								propertyId: booking.propertyId || propertyId || "",
								bookingId: bookingId,
								guestId: booking.guestId,
								balanceBefore: hostCurrentBalance,
								balanceAfter: hostNewBalance,
								status: "completed",
								description: `Refund deduction for cancelled booking at ${property?.title || booking.propertyTitle || "Property"}`,
								createdAt: serverTimestamp(),
							})

							console.log(`[PropertyBookings] Deducted ₱${refundAmount.toLocaleString()} from host wallet`)
						}
					}
				} catch (refundError) {
					console.error("[PropertyBookings] Error processing refund:", refundError)
					toast.error("Cancellation approved but refund failed. Please contact support.")
				}
			}

			// Send message to guest about cancellation approval
			await sendBookingMessage({ ...booking, refundAmount }, "cancellation_approved", { refundAmount })

			// Send cancellation email
			await sendCancellationEmail({ ...booking, refundAmount })

			toast.success(`Cancellation approved${refundAmount > 0 ? ` and refund of ₱${refundAmount.toLocaleString()} processed` : ""}`)
			setBookings((prev) =>
				prev.map((b) =>
					b.id === bookingId ? { ...b, status: "cancelled", refundAmount } : b
				)
			)
		} catch (e) {
			console.error("Error approving cancellation:", e)
			toast.error("Failed to approve cancellation")
		} finally {
			setIsApprovingCancellation((prev) => ({ ...prev, [bookingId]: false }))
		}
	}

	const rejectCancellation = async (bookingId) => {
		try {
			setIsRejectingCancellation((prev) => ({ ...prev, [bookingId]: true }))
			// Restore to previous status - check if it was confirmed or pending before cancellation request
			const booking = bookings.find((b) => b.id === bookingId)
			if (!booking) {
				toast.error("Booking not found")
				return
			}
			// Restore to the previous status stored when cancellation was requested
			const previousStatus = booking?.previousStatus || "confirmed"
			await updateDoc(doc(db, "bookings", bookingId), { 
				status: previousStatus,
				cancellationRejectedAt: serverTimestamp(),
				cancellationRejectedBy: currentUser.uid,
			})
			
			// Send message to guest about cancellation rejection
			await sendBookingMessage(booking, "cancellation_rejected")

			toast.success("Cancellation request rejected")
			setBookings((prev) =>
				prev.map((b) =>
					b.id === bookingId ? { ...b, status: previousStatus } : b
				)
			)
		} catch (e) {
			console.error("Error rejecting cancellation:", e)
			toast.error("Failed to reject cancellation")
		} finally {
			setIsRejectingCancellation((prev) => ({ ...prev, [bookingId]: false }))
		}
	}

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

	// Send cancellation notification email using EmailJS
	const sendCancellationEmail = async (booking) => {
		try {
			const serviceId = import.meta.env.VITE_EMAILJS_HOST_SERVICE_ID || "service_6v439zx"
			const templateId = import.meta.env.VITE_EMAILJS_CANCELLATION_TEMPLATE_ID || "template_dmnc85e"
			const publicKey = import.meta.env.VITE_EMAILJS_HOST_PUBLIC_KEY
			
			if (!serviceId || !templateId || !publicKey) {
				console.warn("[PropertyBookings] Missing EmailJS env vars for cancellation email")
				return
			}

			const guestEmail = booking.guestEmail || ""
			if (!guestEmail) {
				console.warn("[PropertyBookings] No guest email found for cancellation email")
				return
			}

			// Re-initialize EmailJS to ensure fresh configuration
			emailjs.init(publicKey)
			
			// EmailJS requires 'reply_to' can also help, but the key is that the template must use {{to_email}} 
			// in the "To Email" field. Also ensure 'email' field matches for backwards compatibility
			const params = {
				to_email: guestEmail, // Primary recipient - MUST be used in template "To Email" field
				email: guestEmail, // Alternative field name some templates use
				reply_to: guestEmail, // Reply-to address
				guestName: booking.guestName || "Guest",
				propertyName: property?.title || booking.propertyTitle || "Property",
				hostName: displayName,
				orderNumber: booking.id?.substring(0, 8) || booking.id,
				date: `${formatDate(booking.checkInDate)} → ${formatDate(booking.checkOutDate)}`,
				price: (booking.pricing?.basePrice || 0).toLocaleString(),
				cleaningFee: (booking.pricing?.cleaningFee || 0).toLocaleString(),
				serviceFee: (booking.pricing?.serviceFee || 0).toLocaleString(),
				guestFee: (booking.pricing?.guestFee || 0).toLocaleString(),
				total: (booking.pricing?.total || 0).toLocaleString(),
				refundAmount: booking.refundAmount ? booking.refundAmount.toLocaleString() : "0",
			}

			console.log("[PropertyBookings] Sending cancellation email", {
				serviceId,
				templateId,
				to_email: guestEmail,
				guestEmail,
				hostEmail: userEmail,
				params
			})
			
			const response = await emailjs.send(serviceId, templateId, params)
			console.log("[PropertyBookings] Cancellation email sent successfully", {
				status: response.status,
				text: response.text,
				to_email: guestEmail
			})
		} catch (e) {
			console.error("[PropertyBookings] Failed to send cancellation email:", e)
			console.error("[PropertyBookings] Error details:", {
				message: e.message,
				text: e.text,
				guestEmail: booking.guestEmail,
				hostEmail: userEmail
			})
		}
	}

	// Send message to guest about booking status changes
	const sendBookingMessage = async (booking, messageType, additionalInfo = {}) => {
		try {
			if (!booking.guestId) {
				console.warn("[PropertyBookings] No guestId found for booking", booking.id)
				return
			}

			// Find or create conversation between host and guest
			const conversationsQuery = query(
				collection(db, "conversations"),
				where("guestId", "==", booking.guestId),
				where("hostId", "==", currentUser.uid),
				where("propertyId", "==", booking.propertyId || propertyId || "")
			)
			const conversationsSnapshot = await getDocs(conversationsQuery)

			let conversationId
			let messageBody = ""
			let messageSubject = ""
			let lastMessage = ""

			// Determine message content based on type
			switch (messageType) {
				case "approved":
					messageBody = `Your booking request for ${property?.title || booking.propertyTitle || "Property"} has been approved! Your stay is confirmed from ${formatDate(booking.checkInDate)} to ${formatDate(booking.checkOutDate)}. We look forward to hosting you!`
					messageSubject = `Booking Approved: ${property?.title || booking.propertyTitle || "Property"}`
					lastMessage = "Your booking request has been approved!"
					break
				case "cancelled_by_host":
					messageBody = `Your booking at ${property?.title || booking.propertyTitle || "Property"} has been cancelled by the host.${additionalInfo.refundAmount ? ` A refund of ₱${additionalInfo.refundAmount.toLocaleString()} has been processed and added to your e-wallet.` : ""} We apologize for any inconvenience.`
					messageSubject = `Booking Cancelled: ${property?.title || booking.propertyTitle || "Property"}`
					lastMessage = "Your booking has been cancelled by the host."
					break
				case "cancellation_approved":
					messageBody = `Your cancellation request for booking at ${property?.title || booking.propertyTitle || "Property"} has been approved. The booking has been cancelled.${additionalInfo.refundAmount ? ` A refund of ₱${additionalInfo.refundAmount.toLocaleString()} has been processed and added to your e-wallet.` : ""}`
					messageSubject = `Cancellation Request Approved: ${property?.title || booking.propertyTitle || "Property"}`
					lastMessage = "Your cancellation request has been approved."
					break
				case "cancellation_rejected":
					messageBody = `Your cancellation request for booking at ${property?.title || booking.propertyTitle || "Property"} has been rejected. The booking remains active. Please contact us if you have any questions.`
					messageSubject = `Cancellation Request Rejected: ${property?.title || booking.propertyTitle || "Property"}`
					lastMessage = "Your cancellation request has been rejected."
					break
				default:
					return
			}

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
					propertyId: booking.propertyId || propertyId || "",
					propertyTitle: property?.title || booking.propertyTitle || "Property",
					lastMessage: lastMessage,
					lastMessageAt: serverTimestamp(),
					createdAt: serverTimestamp(),
					guestUnreadCount: 1,
					hostUnreadCount: 0,
				}
				const conversationRef = await addDoc(collection(db, "conversations"), conversationData)
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
				propertyId: booking.propertyId || propertyId || "",
				propertyTitle: property?.title || booking.propertyTitle || "Property",
				read: false,
				createdAt: serverTimestamp(),
			}

			await addDoc(collection(db, "messages"), messageData)
			console.log(`[PropertyBookings] ${messageType} message sent to guest`)
		} catch (e) {
			console.error(`[PropertyBookings] Failed to send ${messageType} message:`, e)
		}
	}

	// Send message to guest about cancellation approval/rejection (kept for backward compatibility)
	const sendCancellationMessage = async (booking, isApproved) => {
		if (isApproved) {
			await sendBookingMessage(booking, "cancellation_approved", { refundAmount: booking.refundAmount })
		} else {
			await sendBookingMessage(booking, "cancellation_rejected")
		}
	}

	const canApprove = (b) => {
		const instant = Boolean(property?.availability?.instantBook)
		return !instant && (b.status || "pending") === "pending"
	}

	const approveBooking = async (bookingId) => {
		try {
			setIsApproving((prev) => ({ ...prev, [bookingId]: true }))
			const booking = bookings.find((b) => b.id === bookingId)
			if (!booking) {
				toast.error("Booking not found")
				return
			}

			await updateDoc(doc(db, "bookings", bookingId), { status: "confirmed" })
			
			// Send message to guest about booking approval
			await sendBookingMessage({ ...booking, id: bookingId }, "approved")

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
			const booking = bookings.find((b) => b.id === bookingId)
			if (!booking) {
				toast.error("Booking not found")
				return
			}

			const totalAmount = booking.pricing?.total || 0
			let refundAmount = 0

			// When host cancels a booking (especially confirmed ones), refund the guest
			const currentStatus = booking.status || "pending"
			if (currentStatus === "confirmed" || currentStatus === "pending") {
				refundAmount = totalAmount // Full refund when host cancels
			}

			// Update booking status
			await updateDoc(doc(db, "bookings", bookingId), { 
				status: "cancelled",
				cancelledBy: "host",
				cancelledAt: serverTimestamp(),
				refundAmount: refundAmount,
				refundProcessedAt: refundAmount > 0 ? serverTimestamp() : null,
			})

			// Process refund if applicable
			if (refundAmount > 0 && booking.guestId) {
				try {
					// Get guest's current wallet balance
					const guestRef = doc(db, "users", booking.guestId)
					const guestDoc = await getDoc(guestRef)
					
					if (guestDoc.exists()) {
						const guestData = guestDoc.data()
						const currentBalance = guestData?.walletBalance || 0
						const newBalance = currentBalance + refundAmount

						// Update guest wallet
						await updateDoc(guestRef, {
							walletBalance: newBalance,
						})

						// Add transaction to guest's transaction history
						await addDoc(collection(db, "walletTransactions"), {
							userId: booking.guestId,
							type: "refund",
							amount: refundAmount,
							propertyTitle: property?.title || booking.propertyTitle || "Property",
							propertyId: booking.propertyId || propertyId || "",
							bookingId: bookingId,
							balanceBefore: currentBalance,
							balanceAfter: newBalance,
							status: "completed",
							description: `Refund for cancelled booking at ${property?.title || booking.propertyTitle || "Property"}`,
							createdAt: serverTimestamp(),
						})

						console.log(`[PropertyBookings] Refunded ₱${refundAmount.toLocaleString()} to guest wallet`)
					}

					// Decrease host's wallet balance
					const hostId = property?.hostId || booking.hostId || currentUser?.uid
					if (hostId) {
						const hostRef = doc(db, "users", hostId)
						const hostDoc = await getDoc(hostRef)
						
						if (hostDoc.exists()) {
							const hostData = hostDoc.data()
							const hostCurrentBalance = hostData?.walletBalance || 0
							const hostNewBalance = Math.max(0, hostCurrentBalance - refundAmount) // Ensure balance doesn't go negative

							// Update host wallet
							await updateDoc(hostRef, {
								walletBalance: hostNewBalance,
							})

							// Add transaction to host's transaction history
							await addDoc(collection(db, "walletTransactions"), {
								userId: hostId,
								type: "refund_deduction",
								amount: -refundAmount,
								propertyTitle: property?.title || booking.propertyTitle || "Property",
								propertyId: booking.propertyId || propertyId || "",
								bookingId: bookingId,
								guestId: booking.guestId,
								balanceBefore: hostCurrentBalance,
								balanceAfter: hostNewBalance,
								status: "completed",
								description: `Refund deduction for cancelled booking at ${property?.title || booking.propertyTitle || "Property"}`,
								createdAt: serverTimestamp(),
							})

							console.log(`[PropertyBookings] Deducted ₱${refundAmount.toLocaleString()} from host wallet`)
						}
					}
				} catch (refundError) {
					console.error("[PropertyBookings] Error processing refund:", refundError)
					toast.error("Booking cancelled but refund failed. Please contact support.")
				}
			}

			// Send message to guest about cancellation
			await sendBookingMessage({ ...booking, refundAmount }, "cancelled_by_host", { refundAmount })

			// Send cancellation email to guest using EmailJS
			await sendCancellationEmail({ ...booking, refundAmount })

			toast.success(`Booking cancelled${refundAmount > 0 ? ` and refund of ₱${refundAmount.toLocaleString()} processed` : ""}`)
			setBookings((prev) =>
				prev.map((b) =>
					b.id === bookingId ? { ...b, status: "cancelled", refundAmount } : b
				)
			)
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
									filter === "cancellation_requested" ? "active" : ""
								}`}
								onClick={() => setFilter("cancellation_requested")}
							>
								Cancellations ({bookings.filter((b) => (b.status || "pending") === "cancellation_requested").length})
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
															cancellation_requested: {
																bg: "#fef3c7",
																color: "#d97706",
																border: "#d97706",
																text: "cancellation requested",
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
														gridTemplateColumns: canApproveCancellation(b) ? "1fr 1fr" : canApprove(b) ? "1fr 1fr" : "1fr",
														gap: "0.5rem",
														alignItems: "center",
														justifyContent: "flex-end",
													}}
												>
													{canApproveCancellation(b) ? (
														<>
															<button
																className="generate-report-btn"
																onClick={() => approveCancellation(b.id)}
																disabled={isApprovingCancellation[b.id]}
																title="Approve Cancellation"
																aria-label="Approve Cancellation"
																style={{
																	width: "100%",
																	display: "flex",
																	alignItems: "center",
																	justifyContent: "center",
																	padding: "0.5rem 0.4rem",
																	background: "#10b981",
																	color: "white",
																	border: "none",
																}}
															>
																<FaCheck />
															</button>
															<button
																className="premium-cancel-btn"
																onClick={() => rejectCancellation(b.id)}
																disabled={isRejectingCancellation[b.id]}
																title="Reject Cancellation"
																aria-label="Reject Cancellation"
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
														</>
													) : (
														<>
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
															{(b.status || "pending") !== "cancelled" && 
																(b.status || "pending") !== "cancellation_requested" && (
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
														</>
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
