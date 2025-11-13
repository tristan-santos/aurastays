import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import { db } from "../components/firebaseConfig"
import {
	collection,
	query,
	where,
	orderBy,
	limit,
	updateDoc,
	doc,
	onSnapshot,
	deleteDoc,
	addDoc,
	serverTimestamp,
} from "firebase/firestore"
import {
	FaArrowLeft,
	FaCheck,
	FaCheckDouble,
	FaTrash,
	FaBars,
	FaUser,
	FaSignOutAlt,
	FaEnvelope,
	FaHome,
	FaHeart,
	FaPaperPlane,
} from "react-icons/fa"
import { toast } from "react-stacked-toast"
import "../css/Messages.css"
import "../css/DashboardGuest.css"
import logoPlain from "../assets/logoPlain.png"

export default function Messages() {
	const navigate = useNavigate()
	const { currentUser, userData, logout } = useAuth()
	const [notifications, setNotifications] = useState([])
	const [conversations, setConversations] = useState([])
	const [selectedConversation, setSelectedConversation] = useState(null)
	const [conversationMessages, setConversationMessages] = useState([])
	const [replyMessage, setReplyMessage] = useState("")
	const [isSendingReply, setIsSendingReply] = useState(false)
	const [isLoading, setIsLoading] = useState(true)
	const [selectedNotification, setSelectedNotification] = useState(null)
	const [activeTab, setActiveTab] = useState("conversations") // "conversations" or "notifications"
	const [isMenuOpen, setIsMenuOpen] = useState(false)
	const [theme, setTheme] = useState(localStorage.getItem("theme") || "light")

	// Get user's display name
	const displayName =
		userData?.displayName || currentUser?.displayName || "User"
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
		if (!userData?.userType) return "/dashboardGuest"
		if (userData.userType === "admin") return "/admin"
		if (userData.userType === "host") return "/dashboardHost"
		return "/dashboardGuest"
	}

	useEffect(() => {
		if (!currentUser?.uid) {
			navigate("/login")
			return
		}

		// Subscribe to real-time notifications
		// Try with orderBy first, fallback to without orderBy if index missing
		let notificationsQuery
		try {
			notificationsQuery = query(
				collection(db, "notifications"),
				where("userId", "==", currentUser.uid),
				orderBy("createdAt", "desc"),
				limit(50)
			)
		} catch (error) {
			// If orderBy fails (missing index), try without it
			console.warn("OrderBy query failed, trying without orderBy:", error)
			notificationsQuery = query(
				collection(db, "notifications"),
				where("userId", "==", currentUser.uid),
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
						const dateA = a.createdAt?.toMillis
							? a.createdAt.toMillis()
							: new Date(a.createdAt).getTime()
						const dateB = b.createdAt?.toMillis
							? b.createdAt.toMillis()
							: new Date(b.createdAt).getTime()
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
						where("userId", "==", currentUser.uid),
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
								const dateA = a.createdAt?.toMillis
									? a.createdAt.toMillis()
									: new Date(a.createdAt || 0).getTime()
								const dateB = b.createdAt?.toMillis
									? b.createdAt.toMillis()
									: new Date(b.createdAt || 0).getTime()
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

	// Fetch conversations for guest
	useEffect(() => {
		if (!currentUser?.uid) return

		const conversationsQuery = query(
			collection(db, "conversations"),
			where("guestId", "==", currentUser.uid),
			orderBy("lastMessageAt", "desc")
		)

		const unsubscribe = onSnapshot(
			conversationsQuery,
			(snapshot) => {
				const convos = snapshot.docs.map((doc) => ({
					id: doc.id,
					...doc.data(),
				}))
				setConversations(convos)
			},
			(error) => {
				console.error("Error fetching conversations:", error)
				// Try without orderBy if it fails
				const simpleQuery = query(
					collection(db, "conversations"),
					where("guestId", "==", currentUser.uid)
				)
				const unsubscribeSimple = onSnapshot(
					simpleQuery,
					(snapshot) => {
						const convos = snapshot.docs.map((doc) => ({
							id: doc.id,
							...doc.data(),
						}))
						// Sort manually
						convos.sort((a, b) => {
							const dateA = a.lastMessageAt?.toMillis
								? a.lastMessageAt.toMillis()
								: new Date(a.lastMessageAt || 0).getTime()
							const dateB = b.lastMessageAt?.toMillis
								? b.lastMessageAt.toMillis()
								: new Date(b.lastMessageAt || 0).getTime()
							return dateB - dateA
						})
						setConversations(convos)
					},
					(err) => {
						console.error("Error with simple conversations query:", err)
					}
				)
				return () => unsubscribeSimple()
			}
		)

		return () => unsubscribe()
	}, [currentUser])

	// Fetch messages for selected conversation
	useEffect(() => {
		if (!selectedConversation?.id) {
			setConversationMessages([])
			return
		}

		const messagesQuery = query(
			collection(db, "messages"),
			where("conversationId", "==", selectedConversation.id),
			orderBy("createdAt", "asc")
		)

		const unsubscribe = onSnapshot(
			messagesQuery,
			(snapshot) => {
				const msgs = snapshot.docs.map((doc) => ({
					id: doc.id,
					...doc.data(),
				}))
				setConversationMessages(msgs)

				// Mark conversation as read
				if (selectedConversation.guestUnreadCount > 0) {
					updateDoc(doc(db, "conversations", selectedConversation.id), {
						guestUnreadCount: 0,
					})
				}
			},
			(error) => {
				console.error("Error fetching messages:", error)
				// Try without orderBy
				const simpleQuery = query(
					collection(db, "messages"),
					where("conversationId", "==", selectedConversation.id)
				)
				const unsubscribeSimple = onSnapshot(
					simpleQuery,
					(snapshot) => {
						const msgs = snapshot.docs.map((doc) => ({
							id: doc.id,
							...doc.data(),
						}))
						// Sort manually
						msgs.sort((a, b) => {
							const dateA = a.createdAt?.toMillis
								? a.createdAt.toMillis()
								: new Date(a.createdAt || 0).getTime()
							const dateB = b.createdAt?.toMillis
								? b.createdAt.toMillis()
								: new Date(b.createdAt || 0).getTime()
							return dateA - dateB
						})
						setConversationMessages(msgs)
					},
					(err) => {
						console.error("Error with simple messages query:", err)
					}
				)
				return () => unsubscribeSimple()
			}
		)

		return () => unsubscribe()
	}, [selectedConversation])

	// Handle reply
	const handleSendReply = async (e) => {
		e.preventDefault()
		if (!replyMessage.trim() || !selectedConversation) return

		setIsSendingReply(true)
		try {
			const messageData = {
				conversationId: selectedConversation.id,
				senderId: currentUser.uid,
				senderName: displayName,
				senderType: "guest",
				recipientId: selectedConversation.hostId,
				recipientName: selectedConversation.hostName,
				recipientType: "host",
				subject: `Reply: ${(conversationMessages[0]?.subject || "Message").replace(/^(Re: |Reply: )/, "")}`,
				body: replyMessage.trim(),
				propertyId: selectedConversation.propertyId || "",
				propertyTitle: selectedConversation.propertyTitle || "",
				read: false,
				createdAt: serverTimestamp(),
			}

			await addDoc(collection(db, "messages"), messageData)

			// Update conversation
			await updateDoc(doc(db, "conversations", selectedConversation.id), {
				lastMessage: replyMessage.substring(0, 100),
				lastMessageAt: serverTimestamp(),
				hostUnreadCount: (selectedConversation.hostUnreadCount || 0) + 1,
			})

			setReplyMessage("")
			toast.success("Reply sent successfully!")
		} catch (error) {
			console.error("Error sending reply:", error)
			toast.error("Failed to send reply")
		} finally {
			setIsSendingReply(false)
		}
	}

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
				return "📅"
			case "top_up":
				return "💰"
			case "password_change":
				return "🔒"
			case "booking_confirmed":
				return "✅"
			case "booking_cancelled":
				return "❌"
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

	// Group notifications by category
	const groupNotificationsByCategory = () => {
		const grouped = {
			wallet: [],
			bookings: [],
			security: [],
			general: [],
		}

		notifications.forEach((notification) => {
			switch (notification.type) {
				case "top_up":
					grouped.wallet.push(notification)
					break
				case "booking":
				case "booking_confirmed":
				case "booking_cancelled":
					grouped.bookings.push(notification)
					break
				case "password_change":
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
			case "wallet":
				return "💰 Wallet"
			case "bookings":
				return "📅 Bookings"
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
			{/* Navigation Header */}
			<nav className="top-navbar">
				{/* Logo */}
				<div
					className="navbar-logo"
					onClick={() => navigate(getDashboardRoute())}
				>
					<img src={logoPlain} alt="AuraStays" />
					<span className="logo-text">AuraStays</span>
				</div>

				{/* Right Section */}
				<div className="navbar-right">
					{/* Favorites */}
					<button
						className="icon-button favorites-btn"
						title="Favorites"
						onClick={() => navigate(getDashboardRoute())}
					>
						<FaHeart />
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
										navigate("/profile")
										setIsMenuOpen(false)
									}}
								>
									<FaUser />
									<span>My Profile</span>
								</button>
								<button
									className="dropdown-item"
									onClick={() => {
										navigate(getDashboardRoute())
										setIsMenuOpen(false)
									}}
								>
									<FaHome />
									<span>Dashboard</span>
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

								<button className="dropdown-item logout" onClick={handleLogout}>
									<FaSignOutAlt />
									<span>Logout</span>
								</button>
							</div>
						)}
					</div>
				</div>
			</nav>

			{/* Main Content */}
			<div className="messages-content-wrapper">
				{/* Messages Header */}
				<div className="messages-header">
					<div className="header-title">
						<h1>Messages</h1>
						{activeTab === "conversations" &&
							conversations.filter((c) => c.guestUnreadCount > 0).length >
								0 && (
								<span className="unread-badge">
									{conversations.filter((c) => c.guestUnreadCount > 0).length}
								</span>
							)}
						{activeTab === "notifications" && unreadCount > 0 && (
							<span className="unread-badge">{unreadCount}</span>
						)}
					</div>
					<div className="messages-tabs">
						<button
							className={`tab-btn ${
								activeTab === "conversations" ? "active" : ""
							}`}
							onClick={() => {
								setActiveTab("conversations")
								setSelectedNotification(null)
								setSelectedConversation(null)
							}}
						>
							Conversations
							{conversations.filter((c) => c.guestUnreadCount > 0).length >
								0 && (
								<span className="tab-badge">
									{conversations.filter((c) => c.guestUnreadCount > 0).length}
								</span>
							)}
						</button>
						<button
							className={`tab-btn ${
								activeTab === "notifications" ? "active" : ""
							}`}
							onClick={() => {
								setActiveTab("notifications")
								setSelectedConversation(null)
							}}
						>
							Notifications
							{unreadCount > 0 && (
								<span className="tab-badge">{unreadCount}</span>
							)}
						</button>
					</div>
					{activeTab === "notifications" && unreadCount > 0 && (
						<button className="mark-all-read-btn" onClick={markAllAsRead}>
							Mark all read
						</button>
					)}
				</div>

				{/* Messages Content */}
				<div className="messages-content">
					{activeTab === "conversations" ? (
						<>
							{/* Conversations List */}
							<div className="conversations-list">
								{isLoading ? (
									<div className="loading-state">
										<div className="loading-spinner"></div>
										<p>Loading conversations...</p>
									</div>
								) : conversations.length === 0 ? (
									<div className="empty-state">
										<div className="empty-icon">💬</div>
										<h3>No conversations</h3>
										<p>You haven't sent any messages yet.</p>
									</div>
								) : (
									conversations.map((conversation) => (
										<div
											key={conversation.id}
											className={`conversation-item ${
												selectedConversation?.id === conversation.id
													? "selected"
													: ""
											} ${conversation.guestUnreadCount > 0 ? "unread" : ""}`}
											onClick={() => setSelectedConversation(conversation)}
										>
											<div className="conversation-avatar">
												{getInitials(conversation.hostName)}
											</div>
											<div className="conversation-content">
												<div className="conversation-header">
													<h4>{conversation.hostName}</h4>
													<span className="conversation-time">
														{formatTime(conversation.lastMessageAt)}
													</span>
												</div>
												<p className="conversation-preview">
													{conversation.propertyTitle && (
														<span className="property-tag">
															{conversation.propertyTitle}
														</span>
													)}
													{conversation.lastMessage}
												</p>
											</div>
											{conversation.guestUnreadCount > 0 && (
												<div className="unread-badge-small">
													{conversation.guestUnreadCount}
												</div>
											)}
										</div>
									))
								)}
							</div>

							{/* Conversation Detail View */}
							{selectedConversation && (
								<div className="conversation-detail">
									<div className="conversation-detail-header">
										<button
											className="back-to-list-btn"
											onClick={() => setSelectedConversation(null)}
										>
											<FaArrowLeft />
										</button>
										<div className="conversation-detail-info">
											<h3>{selectedConversation.hostName}</h3>
											{selectedConversation.propertyTitle && (
												<p className="property-title">
													{selectedConversation.propertyTitle}
												</p>
											)}
										</div>
									</div>
									<div className="conversation-messages">
										{conversationMessages.length === 0 ? (
											<div className="empty-messages">No messages yet</div>
										) : (
											conversationMessages.map((message) => (
												<div
													key={message.id}
													className={`message-bubble ${
														message.senderType === "guest" ? "sent" : "received"
													}`}
												>
													<div className="message-header">
														<span className="message-sender">
															{message.senderName}
														</span>
														<span className="message-time">
															{formatTime(message.createdAt)}
														</span>
													</div>
													{message.subject && (
														<div className="message-subject">
															{message.subject.startsWith("Re: ") 
																? `Reply: ${message.subject.replace(/^Re: /, "")}`
																: message.subject.startsWith("Reply: ")
																? message.subject
																: message.subject}
														</div>
													)}
													<div className="message-body">{message.body}</div>
												</div>
											))
										)}
									</div>
									<form
										className="conversation-reply-form"
										onSubmit={handleSendReply}
									>
										<textarea
											value={replyMessage}
											onChange={(e) => setReplyMessage(e.target.value)}
											placeholder="Type your reply..."
											rows={3}
											disabled={isSendingReply}
										/>
										<button
											type="submit"
											className="send-reply-btn"
											disabled={!replyMessage.trim() || isSendingReply}
										>
											<FaPaperPlane />
											{isSendingReply ? "Sending..." : "Send"}
										</button>
									</form>
								</div>
							)}
						</>
					) : (
						<>
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
										.filter(
											([, categoryNotifications]) =>
												categoryNotifications.length > 0
										)
										.map(([category, categoryNotifications]) => {
											return (
												<div key={category} className="notification-group">
													<div className="notification-group-header">
														<h3 className="group-title">
															{getCategoryName(category)}
														</h3>
														<span className="group-count">
															{categoryNotifications.length}{" "}
															{categoryNotifications.length === 1
																? "notification"
																: "notifications"}
														</span>
													</div>
													<div className="notification-group-items">
														{categoryNotifications.map((notification) => (
															<div
																key={notification.id}
																className={`notification-item ${
																	!notification.read ? "unread" : ""
																} ${
																	selectedNotification?.id === notification.id
																		? "selected"
																		: ""
																}`}
																onClick={() =>
																	handleNotificationClick(notification)
																}
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
													? selectedNotification.createdAt
															.toDate()
															.toLocaleString()
													: new Date(
															selectedNotification.createdAt
													  ).toLocaleString()}
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
						</>
					)}
				</div>
			</div>
		</div>
	)
}
