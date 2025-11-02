import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import { db } from "../components/firebaseConfig"
import {
	collection,
	getDocs,
	query,
	where,
} from "firebase/firestore"
import { toast } from "react-stacked-toast"
import { FaCalendarCheck } from "react-icons/fa"
import "../css/HostBookingsDashboard.css"

export default function HostBookingsDashboard() {
	const { currentUser } = useAuth()
	const navigate = useNavigate()
	const [loading, setLoading] = useState(true)
	const [currentMonth, setCurrentMonth] = useState(new Date())
	const [allBookings, setAllBookings] = useState([])

	useEffect(() => {
		if (currentUser) {
			fetchBookings()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentUser])

	const fetchBookings = async () => {
		if (!currentUser?.uid) return

		setLoading(true)
		try {
			const bookingsRef = collection(db, "bookings")
			const bookingsQuery = query(
				bookingsRef,
				where("hostId", "==", currentUser.uid)
			)
			const bookingsSnapshot = await getDocs(bookingsQuery)
			const bookingsList = bookingsSnapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			}))

			setAllBookings(bookingsList)
		} catch (error) {
			console.error("Error fetching bookings:", error)
			toast.error("Failed to load bookings")
		} finally {
			setLoading(false)
		}
	}

	// Get today's date string in YYYY-MM-DD format
	const getTodayDate = () => {
		const today = new Date()
		today.setHours(0, 0, 0, 0)
		return today.toISOString().split("T")[0]
	}

	// Check if a date has a booking
	const getBookingForDate = (dateString) => {
		return allBookings.find((booking) => {
			const checkIn = new Date(booking.checkInDate)
			const checkOut = new Date(booking.checkOutDate)
			const date = new Date(dateString)

			checkIn.setHours(0, 0, 0, 0)
			checkOut.setHours(0, 0, 0, 0)
			date.setHours(0, 0, 0, 0)

			const checkInStr = checkIn.toISOString().split("T")[0]
			const checkOutStr = checkOut.toISOString().split("T")[0]
			const dateStr = date.toISOString().split("T")[0]

			return dateStr >= checkInStr && dateStr <= checkOutStr
		})
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
			const booking = getBookingForDate(dateString)
			const date = new Date(dateString)
			const today = new Date(getTodayDate())
			const isPast = date < today

			let dayType = "available"
			if (booking) {
				const checkIn = new Date(booking.checkInDate).toISOString().split("T")[0]
				const checkOut = new Date(booking.checkOutDate).toISOString().split("T")[0]
				if (dateString === checkIn) {
					dayType = "check-in"
				} else if (dateString === checkOut) {
					dayType = "check-out"
				} else {
					dayType = "booked"
				}
			} else if (isPast) {
				dayType = "past"
			}

			days.push({
				day,
				dateString,
				dayType,
				booking,
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
			<div className="host-bookings-loading">
				<div className="loading-spinner"></div>
				<p>Loading calendar...</p>
			</div>
		)
	}

	return (
		<div className="host-bookings-dashboard">
			<div className="dashboard-header">
				<button
					className="back-button"
					onClick={() => navigate("/dashboardHost")}
				>
					← Back to Dashboard
				</button>
				<h1>
					<FaCalendarCheck style={{ marginRight: "0.5rem" }} /> Bookings Calendar
				</h1>
			</div>

			<div className="calendar-container">
				<div className="calendar-card">
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
										className={`calendar-day ${dayData.dayType}`}
										title={
											dayData.booking
												? `${dayData.booking.propertyTitle || "Property"} - Guest: ${dayData.booking.guestName || "Guest"}`
												: dayData.dayType === "past"
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
							<span className="legend-color check-in"></span>
							Check-in
						</div>
						<div className="legend-item">
							<span className="legend-color booked"></span>
							Booked Period
						</div>
						<div className="legend-item">
							<span className="legend-color check-out"></span>
							Check-out
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
