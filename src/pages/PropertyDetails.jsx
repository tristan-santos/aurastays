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
} from "firebase/firestore"
import { toast } from "react-stacked-toast"
import emailjs from "@emailjs/browser"
import { sendHostBookingConfirmation } from "../utils/hostEmailService"
import {
	FaArrowLeft,
	FaHeart,
	FaShare,
	FaStar,
	FaMapMarkerAlt,
	FaUser,
	FaCalendarAlt,
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
} from "react-icons/fa"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import "../css/PropertyDetails.css"
import housePlaceholder from "../assets/housePlaceholder.png"

// Mapbox token
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

// Initialize EmailJS (Guest)
emailjs.init(import.meta.env.VITE_EMAILJS_GUEST_PUBLIC_KEY)

export default function PropertyDetails() {
	const { propertyId } = useParams()
	const navigate = useNavigate()
	const { currentUser } = useAuth()
	const [property, setProperty] = useState(null)
	const [loading, setLoading] = useState(true)
	const [isFavorite, setIsFavorite] = useState(false)
	const [isInWishlist, setIsInWishlist] = useState(false)
	const [selectedImage, setSelectedImage] = useState(0)
	const [showShareModal, setShowShareModal] = useState(false)
	const [showAllPhotos, setShowAllPhotos] = useState(false)
	const [bookedDates, setBookedDates] = useState([])
	const [currentMonth, setCurrentMonth] = useState(new Date())
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

	// Map ref
	const mapContainer = useRef(null)
	const map = useRef(null)
	const paypalRef = useRef(null)

	// Get the full shareable URL
	const shareableUrl = `${window.location.origin}/property/${propertyId}`

	useEffect(() => {
		fetchPropertyDetails()
		fetchBookedDates()
		if (currentUser) {
			checkFavoriteStatus()
			checkWishlistStatus()
			fetchWalletBalance()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [propertyId, currentUser])

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
			const propertyDoc = await getDoc(doc(db, "properties", propertyId))
			if (propertyDoc.exists()) {
				setProperty({ id: propertyDoc.id, ...propertyDoc.data() })
			} else {
				toast.error("Property not found")
				navigate("/dashboard-guest")
			}
		} catch (error) {
			console.error("Error fetching property:", error)
			toast.error("Failed to load property details")
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
			} = await import("firebase/firestore")
			const bookingsRef = firestoreCollection(db, "bookings")
			const q = query(bookingsRef, where("propertyId", "==", propertyId))
			const querySnapshot = await getDocsFirestore(q)

			const dates = []
			querySnapshot.forEach((doc) => {
				const booking = doc.data()
				if (booking.status !== "cancelled") {
					dates.push(...(booking.bookedDates || []))
				}
			})
			setBookedDates(dates)
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

	// Calculate prices
	const calculatePrices = () => {
		const nights = calculateNights()
		const basePrice = property?.pricing?.basePrice || 0
		const cleaningFee = 500
		const serviceFee = 800

		// Guest fee calculation: ₱100 per guest
		const guestFee = numberOfGuests * 100

		const subtotal = basePrice * nights
		const totalBeforeDiscount = subtotal + cleaningFee + serviceFee + guestFee
		const total = totalBeforeDiscount - promoDiscount

		return {
			nights,
			basePrice,
			subtotal,
			cleaningFee,
			serviceFee,
			guestFee,
			numberOfGuests,
			promoDiscount,
			totalBeforeDiscount,
			total,
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
					userName = userData.displayName || currentUser.displayName || "Guest"
				}
			} catch (err) {
				console.log("Using auth email as fallback:", err)
			}

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
				status: "pending", // Pending host review
				createdAt: serverTimestamp(),
			}

			const bookingsRef = firestoreCollection(db, "bookings")
			const docRef = await addDoc(bookingsRef, bookingData)

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
				toast.error("Booking confirmed, but failed to send invoice email.")
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
				navigate("/dashboardGuest")
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

		// Confirm payment
		const confirmed = window.confirm(
			`Pay ₱${totalAmount.toLocaleString()} from your wallet for this booking?`
		)
		if (!confirmed) return

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

	// Handle calendar day click for booking
	const handleCalendarDayClick = (dateString, isBooked) => {
		if (isBooked) {
			toast.error("This date is already booked")
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
			days.push({
				day,
				dateString,
				isBooked: isDateBooked(dateString),
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
				<Link to="/dashboard-guest" className="back-link">
					Return to Dashboard
				</Link>
			</div>
		)
	}

	const images = property.images || [housePlaceholder]
	const hostInfo = property.host || {}

	return (
		<div className="property-details-container">
			{/* Header */}
			<header className="property-details-header">
				<button onClick={() => navigate(-1)} className="back-btn">
					<FaArrowLeft /> Back
				</button>
				<div className="header-actions">
					<button
						onClick={() => setShowShareModal(true)}
						className="action-btn"
					>
						<FaShare /> Share
					</button>
					<button
						onClick={toggleFavorite}
						className={`action-btn ${isFavorite ? "active" : ""}`}
					>
						<FaHeart /> {isFavorite ? "Favorited" : "Favorite"}
					</button>
					<button
						onClick={toggleWishlist}
						className={`action-btn ${isInWishlist ? "active" : ""}`}
					>
						<FaBookmark /> {isInWishlist ? "Saved" : "Save"}
					</button>
				</div>
			</header>

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
				<div className="main-photo" onClick={() => setShowAllPhotos(true)}>
					<img
						src={images[selectedImage] || housePlaceholder}
						alt="Main view"
					/>
					<button className="view-all-photos-btn">
						View all {images.length} photos
					</button>
				</div>
				<div className="photo-thumbnails">
					{images.slice(0, 4).map((img, index) => (
						<div
							key={index}
							className={`thumbnail ${selectedImage === index ? "active" : ""}`}
							onClick={() => setSelectedImage(index)}
						>
							<img src={img} alt={`View ${index + 1}`} />
						</div>
					))}
					{images.length > 4 && (
						<div
							className="thumbnail more"
							onClick={() => setShowAllPhotos(true)}
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
														dayData.isBooked
															? "booked"
															: dayData.isPast
															? "past"
															: "available"
													}`}
													title={
														dayData.isBooked
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
									Booked/Unavailable
								</div>
							</div>
						</div>
					</section>

					{/* Reviews */}
					<section className="reviews-section">
						<h2>
							<FaStar /> Reviews
						</h2>
						{property.rating && (
							<div className="reviews-summary">
								<div className="rating-big">
									<FaStar /> {property.rating}
								</div>
								<div className="review-count">
									{property.reviewsCount || 0} reviews
								</div>
							</div>
						)}
						<div className="reviews-list">
							{(property.reviews || []).slice(0, 5).map((review, index) => (
								<div key={index} className="review-item">
									<div className="review-header">
										<div className="reviewer-info">
											<div className="reviewer-avatar">
												{review.userName?.[0] || "U"}
											</div>
											<div>
												<h4>{review.userName || "Guest"}</h4>
												<span className="review-date">{review.date}</span>
											</div>
										</div>
										<div className="review-rating">
											<FaStar /> {review.rating}
										</div>
									</div>
									<p className="review-text">{review.comment}</p>
								</div>
							))}
						</div>
						{!property.reviews || property.reviews.length === 0 ? (
							<p className="no-reviews">No reviews yet</p>
						) : null}
					</section>

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

				{/* Right Column - Booking Card */}
				<div className="content-right">
					<div className="booking-card">
						<div className="price-section">
							<div className="price">
								₱{property.pricing?.basePrice?.toLocaleString() || "N/A"}
								<span className="per-night">/ night</span>
							</div>
							{property.rating && (
								<div className="rating-small">
									<FaStar /> {property.rating} ({property.reviewsCount || 0})
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
							<button className="contact-host-btn">Contact Host</button>
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
													{new Date(checkOutDate).toLocaleDateString("en-US", {
														month: "short",
														day: "numeric",
														year: "numeric",
													})}
												</span>
											</>
										) : (
											<span className="placeholder">Click to select dates</span>
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
										{property.capacity?.guests || property.capacity?.maxGuests}{" "}
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
													₱{prices.basePrice.toLocaleString()} x {prices.nights}{" "}
													{prices.nights === 1 ? "night" : "nights"}
												</span>
												<span>₱{prices.subtotal.toLocaleString()}</span>
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

										{/* Show discount in breakdown if promo is applied */}
										{appliedPromo && (
											<div className="breakdown-item promo-discount">
												<span className="promo-label">🎁 Promo Discount</span>
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
				</div>
			</div>

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
								<img key={index} src={img} alt={`Property view ${index + 1}`} />
							))}
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
													dayData.isBooked
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
		</div>
	)
}
