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
} from "firebase/firestore"
import { toast } from "react-stacked-toast"
import emailjs from "@emailjs/browser"
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
mapboxgl.accessToken =
	"pk.eyJ1IjoidGludGFuMjQiLCJhIjoiY21oNTFqeHA0MDJ6aTJxcHVhMjgzcHF6cSJ9.1Bl76fy8KzMBFXF-LsKyEQ"

// Initialize EmailJS
emailjs.init("MNZEXjfpJmX3C1zCG")

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
	const [selectedDate, setSelectedDate] = useState(null)
	const [bookedDates, setBookedDates] = useState([])
	const [currentMonth, setCurrentMonth] = useState(new Date())

	// Booking states
	const [checkInDate, setCheckInDate] = useState("")
	const [checkOutDate, setCheckOutDate] = useState("")
	const [numberOfGuests, setNumberOfGuests] = useState(1)
	const [isProcessingPayment, setIsProcessingPayment] = useState(false)
	const [isPayPalLoaded, setIsPayPalLoaded] = useState(false)

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
		script.src =
			"https://www.paypal.com/sdk/js?client-id=AWu1C01rCyrjqljj3axT3ztlh25ARLpdRgi3TNCYJQw4u4ihBd9yYbR_rnbPNL8JgYc1mhIB2Uxpzch2&currency=USD"
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

		// Guest fee calculation: ₱100 per guest, or ₱1,000 fixed for 8+ guests
		const guestFee = numberOfGuests >= 8 ? 1000 : numberOfGuests * 100

		const subtotal = basePrice * nights
		const total = subtotal + cleaningFee + serviceFee + guestFee

		return {
			nights,
			basePrice,
			subtotal,
			cleaningFee,
			serviceFee,
			guestFee,
			numberOfGuests,
			total,
		}
	}

	// Get today's date for min date attribute
	const getTodayDate = () => {
		const today = new Date()
		return today.toISOString().split("T")[0]
	}

	// Get tomorrow's date for check-out min date
	const getMinCheckOutDate = () => {
		if (!checkInDate) return getTodayDate()
		const checkIn = new Date(checkInDate)
		checkIn.setDate(checkIn.getDate() + 1)
		return checkIn.toISOString().split("T")[0]
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

			const bookingData = {
				propertyId,
				propertyTitle: property.title,
				hostId: property.hostId || "UI7UgbxJj4atJmzmS61fAjA2E0A3",
				guestId: currentUser.uid,
				guestName: currentUser.displayName || "Guest",
				guestEmail: currentUser.email,
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
					total: prices.total,
				},
				payment: {
					method: "paypal",
					paymentId,
					fullPaymentPaid: true,
					paymentDate: new Date().toISOString(),
					paymentDetails,
				},
				bookedDates: bookedDatesList,
				status: "pending", // Pending host review
				createdAt: serverTimestamp(),
			}

			const bookingsRef = firestoreCollection(db, "bookings")
			const docRef = await addDoc(bookingsRef, bookingData)

			// Send email to guest using EmailJS
			try {
				await emailjs.send("service_h0uu0iq", "template_oisprxq", {
					guestName: currentUser.displayName || "Guest",
					orderNumber: docRef.id.substring(0, 8).toUpperCase(),
					propertyName: property.title,
					date: `${checkInDate} to ${checkOutDate}`,
					price: prices.subtotal,
					cleaningFee: prices.cleaningFee,
					serviceFee: prices.serviceFee,
					guestFee: prices.guestFee,
					total: prices.total,
					email: currentUser.email,
				})
				console.log("Email sent successfully")
			} catch (emailError) {
				console.error("Error sending email:", emailError)
				// Don't fail the booking if email fails
			}

			toast.success("Payment successful! Booking is pending host approval.")

			// Redirect to dashboard after 2 seconds
			setTimeout(() => {
				navigate("/dashboardGuest")
			}, 2000)

			return docRef.id
		} catch (error) {
			console.error("Error creating booking:", error)
			toast.error("Failed to create booking")
			throw error
		}
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

		const prices = calculatePrices()
		const totalAmount = prices.total.toFixed(2)

		// Check if PayPal SDK is loaded
		if (!window.paypal || !isPayPalLoaded) {
			toast.info("PayPal is loading, please wait...")
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
										currency_code: "USD",
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
							const details = await actions.order.capture()
							await createBooking(details.id, details)
							setIsProcessingPayment(false)
							// Refresh booked dates
							await fetchBookedDates()
							// Clear form
							setCheckInDate("")
							setCheckOutDate("")
							setNumberOfGuests(1)
						} catch (error) {
							console.error("Payment error:", error)
							toast.error("Payment processing failed")
							setIsProcessingPayment(false)
						}
					},
					onError: (err) => {
						console.error("PayPal error:", err)
						toast.error("Payment failed")
						setIsProcessingPayment(false)
					},
					onCancel: () => {
						toast.info("Payment cancelled")
						setIsProcessingPayment(false)
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
														dayData.isBooked || dayData.isPast
															? "booked"
															: "available"
													}`}
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
							</div>
							<div className="calendar-legend">
								<div className="legend-item">
									<span className="legend-color available"></span>
									Available
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
							<div className="date-inputs">
								<div className="date-input">
									<label>Check-in</label>
									<input
										type="date"
										value={checkInDate}
										onChange={(e) => setCheckInDate(e.target.value)}
										min={getTodayDate()}
									/>
								</div>
								<div className="date-input">
									<label>Check-out</label>
									<input
										type="date"
										value={checkOutDate}
										onChange={(e) => setCheckOutDate(e.target.value)}
										min={getMinCheckOutDate()}
										disabled={!checkInDate}
									/>
								</div>
							</div>
							<div className="guests-input">
								<label>Guests</label>
								<select
									value={numberOfGuests}
									onChange={(e) => setNumberOfGuests(Number(e.target.value))}
								>
									<option value={1}>1 guest</option>
									<option value={2}>2 guests</option>
									<option value={3}>3 guests</option>
									<option value={4}>4 guests</option>
									<option value={5}>5 guests</option>
									<option value={6}>6 guests</option>
									<option value={7}>7 guests</option>
									<option value={8}>8+ guests</option>
								</select>
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
									<button
										className="book-now-btn"
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
		</div>
	)
}
