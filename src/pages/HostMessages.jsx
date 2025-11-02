import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import { db } from "../components/firebaseConfig"
import {
	collection,
	query,
	where,
	getDocs,
	orderBy,
	limit,
	updateDoc,
	doc,
	onSnapshot,
	deleteDoc,
} from "firebase/firestore"
import { FaArrowLeft, FaCheck, FaCheckDouble, FaTrash } from "react-icons/fa"
import { toast } from "react-stacked-toast"
import "../css/Messages.css"

export default function HostMessages() {
	const navigate = useNavigate()
	const { currentUser } = useAuth()
	const [notifications, setNotifications] = useState([])
	const [isLoading, setIsLoading] = useState(true)
	const [selectedNotification, setSelectedNotification] = useState(null)

	useEffect(() => {
		if (!currentUser?.uid) {
			navigate("/login")
			return
		}

		// Subscribe to real-time notifications for hosts
		// Try with orderBy first, fallback to without orderBy if index missing
		let notificationsQuery
		try {
			notificationsQuery = query(
				collection(db, "notifications"),
				where("hostId", "==", currentUser.uid),
				orderBy("createdAt", "desc"),
				limit(50)
			)
		} catch (error) {
			// If orderBy fails (missing index), try without it
			console.warn("OrderBy query failed, trying without orderBy:", error)
			notificationsQuery = query(
				collection(db, "notifications"),
				where("hostId", "==", currentUser.uid),
				limit(50)
			)
		}

		const unsubscribe = onSnapshot(
			notificationsQuery,
			(snapshot) => {
				const notifs = snapshot.docs.map((doc) => ({
					id: doc.id,
					...doc.data(),
				}))
				
				// Sort manually if orderBy didn't work
				if (notifs.length > 0 && notifs[0].createdAt) {
					notifs.sort((a, b) => {
						const dateA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt).getTime()
						const dateB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt).getTime()
						return dateB - dateA // Descending (newest first)
					})
				}
				
				setNotifications(notifs)
				setIsLoading(false)
			},
			(error) => {
				console.error("Error fetching notifications:", error)
				// If error is due to missing index, try simpler query
				if (error.code === "failed-precondition") {
					console.log("Index missing, trying simpler query...")
					const simpleQuery = query(
						collection(db, "notifications"),
						where("hostId", "==", currentUser.uid),
						limit(50)
					)
					const unsubscribeSimple = onSnapshot(
						simpleQuery,
						(snapshot) => {
							const notifs = snapshot.docs.map((doc) => ({
								id: doc.id,
								...doc.data(),
							}))
							// Sort manually
							notifs.sort((a, b) => {
								const dateA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime()
								const dateB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime()
								return dateB - dateA
							})
							setNotifications(notifs)
							setIsLoading(false)
						},
						(err) => {
							console.error("Error with simple query:", err)
							setIsLoading(false)
						}
					)
					return () => unsubscribeSimple()
				}
				setIsLoading(false)
			}
		)

		return () => unsubscribe()
	}, [currentUser, navigate])

	const markAsRead = async (notificationId) => {
		try {
			const notificationRef = doc(db, "notifications", notificationId)
			await updateDoc(notificationRef, {
				read: true,
				readAt: new Date(),
			})
		} catch (error) {
			console.error("Error marking notification as read:", error)
		}
	}

	const markAllAsRead = async () => {
		try {
			const unreadNotifications = notifications.filter((n) => !n.read)
			const promises = unreadNotifications.map((notif) =>
				updateDoc(doc(db, "notifications", notif.id), {
					read: true,
					readAt: new Date(),
				})
			)
			await Promise.all(promises)
			toast.success("All notifications marked as read")
		} catch (error) {
			console.error("Error marking all as read:", error)
			toast.error("Failed to mark all as read")
		}
	}

	const deleteNotification = async (notificationId) => {
		try {
			await deleteDoc(doc(db, "notifications", notificationId))
			if (selectedNotification?.id === notificationId) {
				setSelectedNotification(null)
			}
		} catch (error) {
			console.error("Error deleting notification:", error)
			toast.error("Failed to delete notification")
		}
	}

	const handleNotificationClick = (notification) => {
		setSelectedNotification(notification)
		if (!notification.read) {
			markAsRead(notification.id)
		}
	}

	const getNotificationIcon = (type) => {
		switch (type) {
			case "booking":
			case "new_booking":
				return "📅"
			case "booking_confirmed":
				return "✅"
			case "booking_cancelled":
				return "❌"
			case "payment":
			case "payout":
				return "💰"
			case "property_approved":
				return "🏠"
			case "property_rejected":
				return "🚫"
			case "review":
				return "⭐"
			case "security":
			case "password_change":
				return "🔒"
			default:
				return "🔔"
		}
	}

	const formatTime = (timestamp) => {
		if (!timestamp) return ""
		const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
		const now = new Date()
		const diff = now - date
		const minutes = Math.floor(diff / 60000)
		const hours = Math.floor(diff / 3600000)
		const days = Math.floor(diff / 86400000)

		if (minutes < 1) return "Just now"
		if (minutes < 60) return `${minutes}m ago`
		if (hours < 24) return `${hours}h ago`
		if (days < 7) return `${days}d ago`
		return date.toLocaleDateString()
	}

	// Group notifications by category for hosts
	const groupNotificationsByCategory = () => {
		const grouped = {
			bookings: [],
			payments: [],
			properties: [],
			reviews: [],
			security: [],
			general: [],
		}

		notifications.forEach((notification) => {
			switch (notification.type) {
				case "booking":
				case "new_booking":
				case "booking_confirmed":
				case "booking_cancelled":
					grouped.bookings.push(notification)
					break
				case "payment":
				case "payout":
				case "top_up":
					grouped.payments.push(notification)
					break
				case "property_approved":
				case "property_rejected":
					grouped.properties.push(notification)
					break
				case "review":
					grouped.reviews.push(notification)
					break
				case "password_change":
				case "security":
					grouped.security.push(notification)
					break
				default:
					grouped.general.push(notification)
			}
		})

		return grouped
	}

	const getCategoryName = (category) => {
		switch (category) {
			case "bookings":
				return "📅 Bookings"
			case "payments":
				return "💰 Payments"
			case "properties":
				return "🏠 Properties"
			case "reviews":
				return "⭐ Reviews"
			case "security":
				return "🔒 Security"
			case "general":
				return "🔔 General"
			default:
				return "Notifications"
		}
	}

	const groupedNotifications = groupNotificationsByCategory()
	const unreadCount = notifications.filter((n) => !n.read).length

	return (
		<div className="messages-container">
			{/* Header */}
			<div className="messages-header">
				<button className="messages-back-btn" onClick={() => navigate("/dashboardHost")}>
					<FaArrowLeft />
				</button>
				<div className="header-title">
					<h1>Messages</h1>
					{unreadCount > 0 && (
						<span className="unread-badge">{unreadCount}</span>
					)}
				</div>
				{unreadCount > 0 && (
					<button className="mark-all-read-btn" onClick={markAllAsRead}>
						Mark all read
					</button>
				)}
			</div>

			{/* Main Content */}
			<div className="messages-content">
				{/* Notifications List */}
				<div className="notifications-list">
					{isLoading ? (
						<div className="loading-state">
							<div className="loading-spinner"></div>
							<p>Loading notifications...</p>
						</div>
					) : notifications.length === 0 ? (
						<div className="empty-state">
							<div className="empty-icon">📭</div>
							<h3>No notifications</h3>
							<p>You're all caught up!</p>
						</div>
					) : (
						Object.entries(groupedNotifications)
							.filter(([category, categoryNotifications]) => categoryNotifications.length > 0)
							.map(([category, categoryNotifications]) => {
								return (
									<div key={category} className="notification-group">
										<div className="notification-group-header">
											<h3 className="group-title">{getCategoryName(category)}</h3>
											<span className="group-count">
												{categoryNotifications.length}{" "}
												{categoryNotifications.length === 1 ? "notification" : "notifications"}
											</span>
										</div>
										<div className="notification-group-items">
											{categoryNotifications.map((notification) => (
												<div
													key={notification.id}
													className={`notification-item ${
														!notification.read ? "unread" : ""
													} ${selectedNotification?.id === notification.id ? "selected" : ""}`}
													onClick={() => handleNotificationClick(notification)}
												>
													<div className="notification-icon">
														{getNotificationIcon(notification.type)}
													</div>
													<div className="notification-content">
														<div className="notification-header">
															<h4>{notification.title}</h4>
															<span className="notification-time">
																{formatTime(notification.createdAt)}
															</span>
														</div>
														<p className="notification-message">
															{notification.message}
														</p>
														{notification.read && (
															<div className="read-indicator">
																<FaCheckDouble />
															</div>
														)}
													</div>
													{!notification.read && (
														<div className="unread-indicator"></div>
													)}
													<button
														className="delete-notification-btn"
														onClick={(e) => {
															e.stopPropagation()
															deleteNotification(notification.id)
														}}
														title="Delete notification"
													>
														<FaTrash />
													</button>
												</div>
											))}
										</div>
									</div>
								)
							})
					)}
				</div>

				{/* Notification Detail View */}
				{selectedNotification && (
					<div className="notification-detail">
						<div className="detail-header">
							<div className="detail-icon">
								{getNotificationIcon(selectedNotification.type)}
							</div>
							<div className="detail-info">
								<h2>{selectedNotification.title}</h2>
								<span className="detail-time">
									{selectedNotification.createdAt?.toDate
										? selectedNotification.createdAt.toDate().toLocaleString()
										: new Date(selectedNotification.createdAt).toLocaleString()}
								</span>
							</div>
						</div>
						<div className="detail-body">
							<p>{selectedNotification.message}</p>
							{selectedNotification.data && (
								<div className="detail-data">
									{selectedNotification.data.bookingId && (
										<div className="data-item">
											<strong>Booking ID:</strong>{" "}
											{selectedNotification.data.bookingId}
										</div>
									)}
									{selectedNotification.data.amount && (
										<div className="data-item">
											<strong>Amount:</strong> ₱
											{selectedNotification.data.amount.toLocaleString()}
										</div>
									)}
									{selectedNotification.data.propertyTitle && (
										<div className="data-item">
											<strong>Property:</strong>{" "}
											{selectedNotification.data.propertyTitle}
										</div>
									)}
									{selectedNotification.data.propertyId && (
										<div className="data-item">
											<strong>Property ID:</strong>{" "}
											{selectedNotification.data.propertyId}
										</div>
									)}
									{selectedNotification.data.guestName && (
										<div className="data-item">
											<strong>Guest:</strong>{" "}
											{selectedNotification.data.guestName}
										</div>
									)}
								</div>
							)}
						</div>
						<div className="detail-actions">
							<button
								className="close-detail-btn"
								onClick={() => setSelectedNotification(null)}
							>
								Close
							</button>
						</div>
					</div>
				)}
			</div>
		</div>
	)
}

