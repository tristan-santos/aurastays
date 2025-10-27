import { useState, useEffect } from "react"
import { useAuth } from "../contexts/AuthContext"
import { useNavigate } from "react-router-dom"
import { db } from "./firebaseConfig"
import { collection, query, where, getDocs, orderBy } from "firebase/firestore"
import {
	FaCalendarAlt,
	FaUsers,
	FaClock,
	FaCheckCircle,
	FaHourglassHalf,
	FaTimesCircle,
	FaTimes,
	FaReceipt,
	FaMapMarkerAlt,
	FaMoneyBillWave,
} from "react-icons/fa"
import housePlaceholder from "../assets/housePlaceholder.png"
import "../css/Bookings.css"

export default function Bookings() {
	const { currentUser } = useAuth()
	const navigate = useNavigate()
	const [upcomingTrips, setUpcomingTrips] = useState([])
	const [previousBookings, setPreviousBookings] = useState([])
	const [activeTab, setActiveTab] = useState("upcoming") // 'upcoming' or 'previous'
	const [isLoading, setIsLoading] = useState(true)
	const [showInvoiceModal, setShowInvoiceModal] = useState(false)
	const [selectedBooking, setSelectedBooking] = useState(null)

	useEffect(() => {
		if (currentUser) {
			fetchBookings()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentUser])

	const fetchBookings = async () => {
		setIsLoading(true)
		try {
			const q = query(
				collection(db, "bookings"),
				where("guestId", "==", currentUser.uid),
				orderBy("createdAt", "desc")
			)

			const snapshot = await getDocs(q)
			const bookings = snapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			}))

			const today = new Date()
			today.setHours(0, 0, 0, 0)

			// Separate upcoming and previous
			const upcoming = bookings.filter((booking) => {
				const checkInDate = new Date(booking.checkInDate)
				return checkInDate >= today
			})

			const previous = bookings.filter((booking) => {
				const checkOutDate = new Date(booking.checkOutDate)
				return checkOutDate < today
			})

			setUpcomingTrips(upcoming)
			setPreviousBookings(previous)
		} catch (error) {
			console.error("Error fetching bookings:", error)
			// Don't show error if it's just empty collection
			if (error.code !== "permission-denied" && error.code !== "not-found") {
				console.log("Bookings collection may not exist yet")
			}
			// Set empty arrays so UI shows empty state
			setUpcomingTrips([])
			setPreviousBookings([])
		} finally {
			setIsLoading(false)
		}
	}

	const getStatusBadge = (status) => {
		switch (status) {
			case "confirmed":
				return (
					<span className="status-badge confirmed">
						<FaCheckCircle /> Confirmed
					</span>
				)
			case "pending":
				return (
					<span className="status-badge pending">
						<FaHourglassHalf /> Pending
					</span>
				)
			case "cancelled":
				return (
					<span className="status-badge cancelled">
						<FaTimesCircle /> Cancelled
					</span>
				)
			case "completed":
				return (
					<span className="status-badge completed">
						<FaCheckCircle /> Completed
					</span>
				)
			default:
				return <span className="status-badge">{status}</span>
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

	const getDaysUntil = (dateString) => {
		const checkIn = new Date(dateString)
		const today = new Date()
		today.setHours(0, 0, 0, 0)
		const diffTime = checkIn - today
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
		return diffDays
	}

	const handleViewProperty = (propertyId) => {
		navigate(`/property/${propertyId}`)
	}

	const handleViewInvoice = (booking) => {
		setSelectedBooking(booking)
		setShowInvoiceModal(true)
	}

	const formatDateTime = (timestamp) => {
		if (!timestamp) return "N/A"
		const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
		return date.toLocaleString("en-US", {
			year: "numeric",
			month: "long",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		})
	}

	const renderBookingCard = (booking) => (
		<div key={booking.id} className="booking-card">
			<div
				className="booking-image"
				style={{
					backgroundImage: `url(${booking.propertyImage || housePlaceholder})`,
				}}
			>
				{activeTab === "upcoming" && (
					<div className="days-until">
						{getDaysUntil(booking.checkInDate) === 0
							? "Today!"
							: getDaysUntil(booking.checkInDate) === 1
							? "Tomorrow"
							: `In ${getDaysUntil(booking.checkInDate)} days`}
					</div>
				)}
			</div>

			<div className="booking-details">
				<div className="booking-header">
					<h3 className="booking-title">{booking.propertyTitle}</h3>
					{getStatusBadge(booking.status)}
				</div>

				<div className="booking-info">
					<div className="info-item">
						<FaCalendarAlt className="info-icon" />
						<div className="info-text">
							<span className="info-label">Check-in</span>
							<span className="info-value">
								{formatDate(booking.checkInDate)}
							</span>
						</div>
					</div>

					<div className="info-item">
						<FaCalendarAlt className="info-icon" />
						<div className="info-text">
							<span className="info-label">Check-out</span>
							<span className="info-value">
								{formatDate(booking.checkOutDate)}
							</span>
						</div>
					</div>

					<div className="info-item">
						<FaUsers className="info-icon" />
						<div className="info-text">
							<span className="info-label">Guests</span>
							<span className="info-value">{booking.numberOfGuests}</span>
						</div>
					</div>

					<div className="info-item">
						<FaClock className="info-icon" />
						<div className="info-text">
							<span className="info-label">Nights</span>
							<span className="info-value">{booking.numberOfNights}</span>
						</div>
					</div>
				</div>

				<div className="booking-footer">
					<div className="booking-total">
						<span className="total-label">Total Paid:</span>
						<span className="total-amount">
							₱{booking.pricing?.total?.toLocaleString() || "0"}
						</span>
					</div>
					<div className="booking-actions">
						<button
							className="view-invoice-btn"
							onClick={() => handleViewInvoice(booking)}
						>
							<FaReceipt /> Invoice
						</button>
						<button
							className="view-property-btn"
							onClick={() => handleViewProperty(booking.propertyId)}
						>
							View Property
						</button>
					</div>
				</div>
			</div>
		</div>
	)

	return (
		<div className="bookings-container">
			<div className="bookings-header">
				<h2>My Bookings</h2>
				<div className="bookings-tabs">
					<button
						className={`tab-btn ${activeTab === "upcoming" ? "active" : ""}`}
						onClick={() => setActiveTab("upcoming")}
					>
						Upcoming Trips ({upcomingTrips.length})
					</button>
					<button
						className={`tab-btn ${activeTab === "previous" ? "active" : ""}`}
						onClick={() => setActiveTab("previous")}
					>
						Previous ({previousBookings.length})
					</button>
				</div>
			</div>

			<div className="bookings-content">
				{isLoading ? (
					<div className="loading-state">
						<div className="spinner"></div>
						<p>Loading bookings...</p>
					</div>
				) : activeTab === "upcoming" ? (
					upcomingTrips.length > 0 ? (
						<div className="bookings-grid">
							{upcomingTrips.map((booking) => renderBookingCard(booking))}
						</div>
					) : (
						<div className="empty-state">
							<FaCalendarAlt className="empty-icon" />
							<h3>No Upcoming Trips</h3>
							<p>Start planning your next adventure!</p>
							<button
								className="browse-btn"
								onClick={() => navigate("/dashboardGuest")}
							>
								Browse Properties
							</button>
						</div>
					)
				) : previousBookings.length > 0 ? (
					<div className="bookings-grid">
						{previousBookings.map((booking) => renderBookingCard(booking))}
					</div>
				) : (
					<div className="empty-state">
						<FaCalendarAlt className="empty-icon" />
						<h3>No Previous Bookings</h3>
						<p>Your past trips will appear here</p>
					</div>
				)}
			</div>

			{/* Invoice Modal */}
			{showInvoiceModal && selectedBooking && (
				<div
					className="modal-overlay"
					onClick={() => setShowInvoiceModal(false)}
				>
					<div
						className="modal-content invoice-modal"
						onClick={(e) => e.stopPropagation()}
					>
						<button
							className="close-modal-btn"
							onClick={() => setShowInvoiceModal(false)}
						>
							<FaTimes />
						</button>

						<div className="invoice-header">
							<div className="invoice-header-content">
								<FaReceipt className="invoice-icon" />
								<div>
									<h2>Booking Invoice</h2>
									<p className="invoice-id">ID: {selectedBooking.id}</p>
								</div>
							</div>
							{getStatusBadge(selectedBooking.status)}
						</div>

						<div className="invoice-divider"></div>

						<div className="invoice-property-section">
							<div
								className="invoice-property-image"
								style={{
									backgroundImage: `url(${
										selectedBooking.propertyImage || housePlaceholder
									})`,
								}}
							></div>
							<div className="invoice-property-info">
								<h3>{selectedBooking.propertyTitle}</h3>
								{selectedBooking.propertyLocation && (
									<div className="invoice-location">
										<FaMapMarkerAlt />
										<span>{selectedBooking.propertyLocation}</span>
									</div>
								)}
							</div>
						</div>

						<div className="invoice-divider"></div>

						<div className="invoice-details-section">
							<h3 className="section-title">Booking Details</h3>
							<div className="invoice-details-grid">
								<div className="invoice-detail-item">
									<span className="detail-label">
										<FaCalendarAlt /> Check-in
									</span>
									<span className="detail-value">
										{formatDate(selectedBooking.checkInDate)}
									</span>
								</div>
								<div className="invoice-detail-item">
									<span className="detail-label">
										<FaCalendarAlt /> Check-out
									</span>
									<span className="detail-value">
										{formatDate(selectedBooking.checkOutDate)}
									</span>
								</div>
								<div className="invoice-detail-item">
									<span className="detail-label">
										<FaUsers /> Guests
									</span>
									<span className="detail-value">
										{selectedBooking.numberOfGuests}
									</span>
								</div>
								<div className="invoice-detail-item">
									<span className="detail-label">
										<FaClock /> Nights
									</span>
									<span className="detail-value">
										{selectedBooking.numberOfNights}
									</span>
								</div>
							</div>
						</div>

						<div className="invoice-divider"></div>

						<div className="invoice-pricing-section">
							<h3 className="section-title">Payment Summary</h3>
							<div className="pricing-breakdown">
								<div className="pricing-row">
									<span>
										₱{selectedBooking.pricing?.pricePerNight?.toLocaleString()}{" "}
										× {selectedBooking.numberOfNights} nights
									</span>
									<span>
										₱{selectedBooking.pricing?.subtotal?.toLocaleString()}
									</span>
								</div>
								<div className="pricing-row">
									<span>Cleaning Fee</span>
									<span>
										₱{selectedBooking.pricing?.cleaningFee?.toLocaleString()}
									</span>
								</div>
								<div className="pricing-row">
									<span>Service Fee</span>
									<span>
										₱{selectedBooking.pricing?.serviceFee?.toLocaleString()}
									</span>
								</div>
								<div className="pricing-row total-row">
									<span>
										<FaMoneyBillWave /> Total
									</span>
									<span className="total-price">
										₱{selectedBooking.pricing?.total?.toLocaleString()}
									</span>
								</div>
							</div>
						</div>

						<div className="invoice-divider"></div>

						<div className="invoice-payment-section">
							<div className="payment-method-badge">
								<FaCheckCircle />
								<span>
									Paid via{" "}
									{selectedBooking.paymentMethod === "wallet"
										? "E-Wallet"
										: "PayPal"}
								</span>
							</div>
							<div className="invoice-date">
								<span>
									Booked on: {formatDateTime(selectedBooking.createdAt)}
								</span>
							</div>
						</div>

						<div className="invoice-footer">
							<p>Thank you for booking with AuraStays!</p>
							<p className="invoice-footer-note">
								For any inquiries, please contact our support team.
							</p>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
