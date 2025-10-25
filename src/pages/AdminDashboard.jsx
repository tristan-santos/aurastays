import { useAuth } from "../contexts/AuthContext"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { auth, db } from "../components/firebaseConfig"
import { collection, getDocs, updateDoc, doc, setDoc } from "firebase/firestore"
import { toast } from "react-stacked-toast"
import {
	Chart as ChartJS,
	CategoryScale,
	LinearScale,
	PointElement,
	LineElement,
	BarElement,
	ArcElement,
	Title,
	Tooltip,
	Legend,
} from "chart.js"
import { Line, Bar, Doughnut } from "react-chartjs-2"
import "../css/AdminDashboard.css"

// Register ChartJS components
ChartJS.register(
	CategoryScale,
	LinearScale,
	PointElement,
	LineElement,
	BarElement,
	ArcElement,
	Title,
	Tooltip,
	Legend
)

const AdminDashboard = () => {
	const { currentUser, userData } = useAuth()
	const navigate = useNavigate()
	const [stats, setStats] = useState({
		totalUsers: 0,
		totalHosts: 0,
		totalGuests: 0,
		totalProperties: 0,
		totalBookings: 0,
		totalRevenue: 0,
		pendingPayouts: 0,
	})
	const [recentBookings, setRecentBookings] = useState([])
	const [bestReviews, setBestReviews] = useState([])
	const [lowestReviews, setLowestReviews] = useState([])
	const [pendingPayouts, setPendingPayouts] = useState([])
	const [loading, setLoading] = useState(true)
	const [chartData, setChartData] = useState({
		bookings: null,
		revenue: null,
		propertyTypes: null,
	})
	const [activeTab, setActiveTab] = useState("dashboard")
	const [policies, setPolicies] = useState({
		serviceFeeHost: 15, // percentage
		serviceFeeGuest: 12, // percentage
		guestFeePerPerson: 100, // fixed amount in pesos
		guestFeeFor8Plus: 1000, // fixed amount for 8+ guests
		cancellationWindowHours: 48,
		minPropertyRating: 3.0,
		maxCancellationsBeforeReview: 3,
	})
	const [recentUsers, setRecentUsers] = useState([])
	const [reportModal, setReportModal] = useState({
		isOpen: false,
		type: "",
		data: null,
		title: "",
	})

	useEffect(() => {
		fetchAdminData()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	const fetchAdminData = async () => {
		try {
			setLoading(true)

			// Fetch all collections in parallel with error handling
			let usersSnapshot, propertiesSnapshot, bookingsSnapshot, payoutsSnapshot

			try {
				const results = await Promise.allSettled([
					getDocs(collection(db, "users")),
					getDocs(collection(db, "properties")),
					getDocs(collection(db, "bookings")).catch(() => ({ docs: [] })),
					getDocs(collection(db, "payouts")).catch(() => ({ docs: [] })),
				])

				usersSnapshot =
					results[0].status === "fulfilled" ? results[0].value : { docs: [] }
				propertiesSnapshot =
					results[1].status === "fulfilled" ? results[1].value : { docs: [] }
				bookingsSnapshot =
					results[2].status === "fulfilled" ? results[2].value : { docs: [] }
				payoutsSnapshot =
					results[3].status === "fulfilled" ? results[3].value : { docs: [] }
			} catch (err) {
				console.error("Error fetching collections:", err)
				// Set empty defaults
				usersSnapshot = { docs: [] }
				propertiesSnapshot = { docs: [] }
				bookingsSnapshot = { docs: [] }
				payoutsSnapshot = { docs: [] }
			}

			// Process users with defaults
			const allUsers = usersSnapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			}))
			const totalUsers = allUsers.length || 0
			const totalHosts =
				allUsers.filter((user) => user.userType === "host").length || 0
			const totalGuests =
				allUsers.filter((user) => user.userType === "guest").length || 0

			// Get recent users (last 10)
			const sortedUsers = [...allUsers].sort((a, b) => {
				const dateA = a.createdAt?.toDate?.() || new Date(0)
				const dateB = b.createdAt?.toDate?.() || new Date(0)
				return dateB - dateA
			})
			setRecentUsers(sortedUsers.slice(0, 10))

			// Process properties with defaults
			const allProperties = propertiesSnapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			}))
			const totalProperties = allProperties.length || 0

			// Sort properties by rating for best/lowest reviews
			if (allProperties.length > 0) {
				const sortedByRating = [...allProperties].sort(
					(a, b) => (b.rating || 0) - (a.rating || 0)
				)
				setBestReviews(sortedByRating.slice(0, 5))
				setLowestReviews(sortedByRating.slice(-5).reverse())
			} else {
				setBestReviews([])
				setLowestReviews([])
			}

			// Process bookings with defaults
			const allBookings = bookingsSnapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			}))
			const totalBookings = allBookings.length || 0
			const totalRevenue =
				allBookings.reduce(
					(sum, booking) => sum + (booking.totalPrice || 0),
					0
				) || 0
			setRecentBookings(allBookings.slice(0, 10))

			// Process payouts with defaults
			const payoutsList = payoutsSnapshot.docs
				.map((doc) => ({
					id: doc.id,
					...doc.data(),
				}))
				.filter((payout) => payout.status === "pending")
			setPendingPayouts(payoutsList)
			const pendingPayoutsTotal =
				payoutsList.reduce((sum, payout) => sum + (payout.amount || 0), 0) || 0

			setStats({
				totalUsers: totalUsers || 0,
				totalHosts: totalHosts || 0,
				totalGuests: totalGuests || 0,
				totalProperties: totalProperties || 0,
				totalBookings: totalBookings || 0,
				totalRevenue: totalRevenue || 0,
				pendingPayouts: pendingPayoutsTotal || 0,
			})

			// Prepare chart data
			prepareChartData(allBookings, allProperties)
		} catch (error) {
			console.error("Error fetching admin data:", error)
			toast.error("Some data failed to load, showing defaults")

			// Set all defaults on error
			setStats({
				totalUsers: 0,
				totalHosts: 0,
				totalGuests: 0,
				totalProperties: 0,
				totalBookings: 0,
				totalRevenue: 0,
				pendingPayouts: 0,
			})
			setBestReviews([])
			setLowestReviews([])
			setRecentBookings([])
			setPendingPayouts([])

			// Prepare empty chart data
			prepareChartData([], [])
		} finally {
			setLoading(false)
		}
	}

	const prepareChartData = (bookings = [], properties = []) => {
		// Bookings trend (last 7 days)
		const last7Days = [...Array(7)].map((_, i) => {
			const date = new Date()
			date.setDate(date.getDate() - (6 - i))
			return date.toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
			})
		})

		const bookingsPerDay = last7Days.map((day) => {
			return (
				bookings.filter((booking) => {
					const bookingDate = booking.createdAt?.toDate?.()
					if (!bookingDate) return false
					return (
						bookingDate?.toLocaleDateString("en-US", {
							month: "short",
							day: "numeric",
						}) === day
					)
				}).length || 0
			)
		})

		// Revenue trend (last 7 days)
		const revenuePerDay = last7Days.map((day) => {
			return (
				bookings
					.filter((booking) => {
						const bookingDate = booking.createdAt?.toDate?.()
						if (!bookingDate) return false
						return (
							bookingDate?.toLocaleDateString("en-US", {
								month: "short",
								day: "numeric",
							}) === day
						)
					})
					.reduce((sum, booking) => sum + (booking.totalPrice || 0), 0) || 0
			)
		})

		// Property types distribution
		const propertyTypes =
			properties.length > 0
				? properties.reduce((acc, property) => {
						const category = property.category || "other"
						acc[category] = (acc[category] || 0) + 1
						return acc
				  }, {})
				: { none: 1 }

		setChartData({
			bookings: {
				labels: last7Days,
				datasets: [
					{
						label: "Bookings",
						data: bookingsPerDay,
						borderColor: "rgb(65, 95, 148)",
						backgroundColor: "rgba(65, 95, 148, 0.1)",
						tension: 0.4,
					},
				],
			},
			revenue: {
				labels: last7Days,
				datasets: [
					{
						label: "Revenue (₱)",
						data: revenuePerDay,
						backgroundColor: "rgba(217, 198, 111, 0.8)",
						borderColor: "rgb(217, 198, 111)",
						borderWidth: 1,
					},
				],
			},
			propertyTypes: {
				labels:
					properties.length > 0
						? Object.keys(propertyTypes).map(
								(key) => key.charAt(0).toUpperCase() + key.slice(1)
						  )
						: ["No Properties"],
				datasets: [
					{
						data: Object.values(propertyTypes),
						backgroundColor: [
							"rgba(65, 95, 148, 0.8)",
							"rgba(217, 198, 111, 0.8)",
							"rgba(97, 191, 156, 0.8)",
							"rgba(255, 99, 132, 0.8)",
						],
						borderWidth: 2,
						borderColor: "#fff",
					},
				],
			},
		})
	}

	const handleApprovePayout = async (payoutId, amount) => {
		try {
			await updateDoc(doc(db, "payouts", payoutId), {
				status: "approved",
				approvedAt: new Date(),
				approvedBy: currentUser.uid,
			})
			toast.success(`Payout of ₱${amount.toLocaleString()} approved`)
			fetchAdminData()
		} catch (err) {
			console.error("Error approving payout:", err)
			toast.error("Failed to approve payout")
		}
	}

	const handleRejectPayout = async (payoutId) => {
		try {
			await updateDoc(doc(db, "payouts", payoutId), {
				status: "rejected",
				rejectedAt: new Date(),
				rejectedBy: currentUser.uid,
			})
			toast.success("Payout rejected")
			fetchAdminData()
		} catch (err) {
			console.error("Error rejecting payout:", err)
			toast.error("Failed to reject payout")
		}
	}

	const handleLogout = async () => {
		try {
			await auth.signOut()
			toast.success("Logged out successfully")
			navigate("/")
		} catch (err) {
			console.error("Error logging out:", err)
			toast.error("Error logging out")
		}
	}

	const handleUpdatePolicies = async () => {
		try {
			// Save to Firebase (creates if doesn't exist, updates if it does)
			await setDoc(doc(db, "settings", "policies"), policies, { merge: true })
			toast.success("✅ Policies updated successfully!")
		} catch (err) {
			console.error("Error updating policies:", err)
			toast.error("❌ Failed to update policies: " + err.message)
		}
	}

	const updateAllPropertiesOwner = async () => {
		const confirmed = window.confirm(
			"This will update all properties to be owned by the host user. Continue?"
		)
		if (!confirmed) return

		try {
			const propertiesSnapshot = await getDocs(collection(db, "properties"))
			const updatePromises = []

			propertiesSnapshot.forEach((docSnapshot) => {
				const propertyRef = doc(db, "properties", docSnapshot.id)
				updatePromises.push(
					updateDoc(propertyRef, {
						hostId: "UI7UgbxJj4atJmzmS61fAjA2E0A3",
					})
				)
			})

			await Promise.all(updatePromises)
			toast.success(
				`✅ Successfully updated ${updatePromises.length} properties!`
			)
		} catch (err) {
			console.error("Error updating properties:", err)
			toast.error("❌ Failed to update properties: " + err.message)
		}
	}

	const openReportModal = async (reportType) => {
		let reportData = {}
		let reportTitle = ""

		try {
			switch (reportType) {
				case "users":
					reportTitle = "Users_Report"
					reportData = {
						generatedAt: new Date().toISOString(),
						summary: {
							totalUsers: stats.totalUsers,
							totalHosts: stats.totalHosts,
							totalGuests: stats.totalGuests,
						},
						recentUsers: recentUsers.map((u) => ({
							name: u.displayName || "N/A",
							email: u.email || "N/A",
							userType: u.userType || "N/A",
							createdAt: u.createdAt?.toDate?.()?.toLocaleDateString() || "N/A",
						})),
					}
					break

				case "properties": {
					// Fetch fresh data from Firebase
					const propertiesSnapshot = await getDocs(collection(db, "properties"))
					const allPropertiesData = propertiesSnapshot.docs.map((doc) => ({
						id: doc.id,
						...doc.data(),
					}))

					console.log("All Properties Fresh Data:", allPropertiesData)
					reportTitle = "Properties_Report"

					const allPropertiesMapped = allPropertiesData.map((p) => ({
						title: p.title || p.name || "Untitled",
						rating: p.rating || 0,
						reviews: p.reviewsCount || p.reviews || 0,
						category: p.category || p.type || "N/A",
						host:
							p.hostName ||
							(typeof p.host === "object" ? p.host?.hostName : p.host) ||
							"N/A",
					}))
					console.log("Mapped All Properties:", allPropertiesMapped)

					reportData = {
						generatedAt: new Date().toISOString(),
						summary: {
							totalProperties: allPropertiesData.length,
							avgRating:
								allPropertiesData.length > 0
									? (
											allPropertiesData.reduce(
												(sum, p) => sum + (p.rating || 0),
												0
											) / allPropertiesData.length
									  ).toFixed(2)
									: 0,
						},
						topRated: bestReviews.slice(0, 10).map((p) => ({
							title: p.title || p.name || "Untitled",
							rating: p.rating || 0,
							reviews: p.reviewsCount || p.reviews || 0,
							category: p.category || p.type || "N/A",
						})),
						needsAttention: lowestReviews.slice(0, 10).map((p) => ({
							title: p.title || p.name || "Untitled",
							rating: p.rating || 0,
							reviews: p.reviewsCount || p.reviews || 0,
							category: p.category || p.type || "N/A",
						})),
						allProperties: allPropertiesMapped,
					}
					console.log("Properties Report Data:", reportData)
					break
				}

				case "bookings":
					reportTitle = "Bookings_Report"
					reportData = {
						generatedAt: new Date().toISOString(),
						summary: {
							totalBookings: stats.totalBookings,
							totalRevenue: stats.totalRevenue,
							avgBookingValue:
								stats.totalBookings > 0
									? (stats.totalRevenue / stats.totalBookings).toFixed(2)
									: 0,
						},
						recentBookings: recentBookings.map((b) => ({
							guest: b.guestName || "N/A",
							property: b.propertyTitle || "N/A",
							checkIn: b.checkIn || "N/A",
							status: b.status || "pending",
							amount: b.totalPrice || 0,
						})),
					}
					break

				case "revenue": {
					reportTitle = "Revenue_Report"
					const hostFees = stats.totalRevenue * (policies.serviceFeeHost / 100)
					const guestFees =
						stats.totalRevenue * (policies.serviceFeeGuest / 100)
					reportData = {
						generatedAt: new Date().toISOString(),
						summary: {
							totalRevenue: stats.totalRevenue,
							hostServiceFees: hostFees.toFixed(2),
							guestServiceFees: guestFees.toFixed(2),
							totalServiceFees: (hostFees + guestFees).toFixed(2),
							netRevenue: (stats.totalRevenue - hostFees - guestFees).toFixed(
								2
							),
						},
						chartData: chartData.revenue,
					}
					break
				}

				case "payouts":
					reportTitle = "Payouts_Report"
					reportData = {
						generatedAt: new Date().toISOString(),
						summary: {
							pendingPayouts: stats.pendingPayouts,
							totalRequests: pendingPayouts.length,
						},
						pending: pendingPayouts.map((p) => ({
							host: p.hostName || "Host",
							email: p.hostEmail,
							amount: p.amount || 0,
							method: p.method || "PayPal",
							requestedAt:
								p.createdAt?.toDate?.()?.toLocaleDateString() || "N/A",
						})),
					}
					break

				default:
					toast.error("Invalid report type")
					return
			}

			// Open modal with report data
			setReportModal({
				isOpen: true,
				type: reportType,
				data: reportData,
				title: reportTitle.replace(/_/g, " "),
			})
		} catch (err) {
			console.error("Error preparing report:", err)
			toast.error("Failed to prepare report")
		}
	}

	const exportReportAsPDF = async () => {
		try {
			// Dynamically import React-PDF components
			const { Document, Page, Text, View, StyleSheet, pdf } = await import(
				"@react-pdf/renderer"
			)

			const { data, title, type } = reportModal

			// Define styles
			const styles = StyleSheet.create({
				page: {
					padding: 30,
					fontSize: 11,
					fontFamily: "Helvetica",
				},
				header: {
					fontSize: 24,
					marginBottom: 10,
					color: "#415f94",
					fontFamily: "Helvetica-Bold",
				},
				subtitle: {
					fontSize: 10,
					marginBottom: 20,
					color: "#666",
				},
				section: {
					marginBottom: 15,
				},
				sectionTitle: {
					fontSize: 16,
					marginBottom: 10,
					color: "#d9c36f",
					fontFamily: "Helvetica-Bold",
				},
				summaryGrid: {
					flexDirection: "row",
					flexWrap: "wrap",
					marginBottom: 15,
				},
				summaryItem: {
					width: "48%",
					marginBottom: 8,
					padding: 8,
					backgroundColor: "#f8f9fa",
					borderLeftWidth: 3,
					borderLeftColor: "#d9c36f",
				},
				summaryLabel: {
					fontSize: 9,
					color: "#666",
					marginBottom: 3,
				},
				summaryValue: {
					fontSize: 12,
					color: "#415f94",
					fontFamily: "Helvetica-Bold",
				},
				table: {
					marginTop: 10,
				},
				tableRow: {
					flexDirection: "row",
					borderBottomWidth: 1,
					borderBottomColor: "#e0e0e0",
					minHeight: 30,
					alignItems: "center",
				},
				tableHeader: {
					backgroundColor: "#415f94",
					color: "#fff",
					fontFamily: "Helvetica-Bold",
				},
				tableCell: {
					padding: 8,
					fontSize: 9,
				},
			})

			// Create PDF Document
			const PDFDocument = (
				<Document>
					<Page size="A4" style={styles.page}>
						{/* Header */}
						<Text style={styles.header}>{title}</Text>
						<Text style={styles.subtitle}>
							Generated: {new Date().toLocaleDateString()}{" "}
							{new Date().toLocaleTimeString()}
						</Text>

						{/* Summary Section */}
						{data.summary && (
							<View style={styles.section}>
								<Text style={styles.sectionTitle}>Summary</Text>
								<View style={styles.summaryGrid}>
									{Object.entries(data.summary).map(([key, value]) => {
										const label = key.replace(/([A-Z])/g, " $1").trim()
										const displayLabel =
											label.charAt(0).toUpperCase() + label.slice(1)
										return (
											<View key={key} style={styles.summaryItem}>
												<Text style={styles.summaryLabel}>{displayLabel}:</Text>
												<Text style={styles.summaryValue}>{value}</Text>
											</View>
										)
									})}
								</View>
							</View>
						)}

						{/* Users Table */}
						{type === "users" && data.recentUsers && (
							<View style={styles.section}>
								<Text style={styles.sectionTitle}>Recent Users</Text>
								<View style={styles.table}>
									<View style={[styles.tableRow, styles.tableHeader]}>
										<Text style={[styles.tableCell, { width: "25%" }]}>
											Name
										</Text>
										<Text style={[styles.tableCell, { width: "35%" }]}>
											Email
										</Text>
										<Text style={[styles.tableCell, { width: "20%" }]}>
											Type
										</Text>
										<Text style={[styles.tableCell, { width: "20%" }]}>
											Created
										</Text>
									</View>
									{data.recentUsers.slice(0, 15).map((user, idx) => (
										<View key={idx} style={styles.tableRow}>
											<Text style={[styles.tableCell, { width: "25%" }]}>
												{user.name}
											</Text>
											<Text style={[styles.tableCell, { width: "35%" }]}>
												{user.email}
											</Text>
											<Text style={[styles.tableCell, { width: "20%" }]}>
												{user.userType}
											</Text>
											<Text style={[styles.tableCell, { width: "20%" }]}>
												{user.createdAt}
											</Text>
										</View>
									))}
								</View>
							</View>
						)}

						{/* Properties Tables */}
						{type === "properties" && (
							<>
								{data.topRated && data.topRated.length > 0 && (
									<View style={styles.section}>
										<Text style={styles.sectionTitle}>
											Top Rated Properties
										</Text>
										<View style={styles.table}>
											<View style={[styles.tableRow, styles.tableHeader]}>
												<Text style={[styles.tableCell, { width: "40%" }]}>
													Title
												</Text>
												<Text style={[styles.tableCell, { width: "15%" }]}>
													Rating
												</Text>
												<Text style={[styles.tableCell, { width: "20%" }]}>
													Reviews
												</Text>
												<Text style={[styles.tableCell, { width: "25%" }]}>
													Category
												</Text>
											</View>
											{data.topRated.map((prop, idx) => (
												<View key={idx} style={styles.tableRow}>
													<Text style={[styles.tableCell, { width: "40%" }]}>
														{prop.title}
													</Text>
													<Text style={[styles.tableCell, { width: "15%" }]}>
														{prop.rating}
													</Text>
													<Text style={[styles.tableCell, { width: "20%" }]}>
														{prop.reviews}
													</Text>
													<Text style={[styles.tableCell, { width: "25%" }]}>
														{prop.category}
													</Text>
												</View>
											))}
										</View>
									</View>
								)}

								{data.needsAttention && data.needsAttention.length > 0 && (
									<View style={styles.section}>
										<Text style={styles.sectionTitle}>⚠️ Needs Attention</Text>
										<View style={styles.table}>
											<View style={[styles.tableRow, styles.tableHeader]}>
												<Text style={[styles.tableCell, { width: "40%" }]}>
													Title
												</Text>
												<Text style={[styles.tableCell, { width: "15%" }]}>
													Rating
												</Text>
												<Text style={[styles.tableCell, { width: "20%" }]}>
													Reviews
												</Text>
												<Text style={[styles.tableCell, { width: "25%" }]}>
													Category
												</Text>
											</View>
											{data.needsAttention.map((prop, idx) => (
												<View key={idx} style={styles.tableRow}>
													<Text style={[styles.tableCell, { width: "40%" }]}>
														{prop.title}
													</Text>
													<Text style={[styles.tableCell, { width: "15%" }]}>
														{prop.rating}
													</Text>
													<Text style={[styles.tableCell, { width: "20%" }]}>
														{prop.reviews}
													</Text>
													<Text style={[styles.tableCell, { width: "25%" }]}>
														{prop.category}
													</Text>
												</View>
											))}
										</View>
									</View>
								)}

								{data.allProperties && data.allProperties.length > 0 && (
									<View style={styles.section} break>
										<Text style={styles.sectionTitle}>
											📋 All Properties ({data.allProperties.length} total)
										</Text>
										<View style={styles.table}>
											<View style={[styles.tableRow, styles.tableHeader]}>
												<Text style={[styles.tableCell, { width: "30%" }]}>
													Title
												</Text>
												<Text style={[styles.tableCell, { width: "20%" }]}>
													Host
												</Text>
												<Text style={[styles.tableCell, { width: "12%" }]}>
													Rating
												</Text>
												<Text style={[styles.tableCell, { width: "15%" }]}>
													Reviews
												</Text>
												<Text style={[styles.tableCell, { width: "23%" }]}>
													Category
												</Text>
											</View>
											{data.allProperties.map((prop, idx) => (
												<View key={idx} style={styles.tableRow}>
													<Text style={[styles.tableCell, { width: "30%" }]}>
														{prop.title}
													</Text>
													<Text style={[styles.tableCell, { width: "20%" }]}>
														{prop.host}
													</Text>
													<Text style={[styles.tableCell, { width: "12%" }]}>
														{prop.rating}
													</Text>
													<Text style={[styles.tableCell, { width: "15%" }]}>
														{prop.reviews}
													</Text>
													<Text style={[styles.tableCell, { width: "23%" }]}>
														{prop.category}
													</Text>
												</View>
											))}
										</View>
									</View>
								)}
							</>
						)}

						{/* Bookings Table */}
						{type === "bookings" && data.recentBookings && (
							<View style={styles.section}>
								<Text style={styles.sectionTitle}>Recent Bookings</Text>
								<View style={styles.table}>
									<View style={[styles.tableRow, styles.tableHeader]}>
										<Text style={[styles.tableCell, { width: "25%" }]}>
											Guest
										</Text>
										<Text style={[styles.tableCell, { width: "30%" }]}>
											Property
										</Text>
										<Text style={[styles.tableCell, { width: "20%" }]}>
											Check-in
										</Text>
										<Text style={[styles.tableCell, { width: "15%" }]}>
											Status
										</Text>
										<Text style={[styles.tableCell, { width: "10%" }]}>
											Amount
										</Text>
									</View>
									{data.recentBookings.slice(0, 15).map((booking, idx) => (
										<View key={idx} style={styles.tableRow}>
											<Text style={[styles.tableCell, { width: "25%" }]}>
												{booking.guest}
											</Text>
											<Text style={[styles.tableCell, { width: "30%" }]}>
												{booking.property}
											</Text>
											<Text style={[styles.tableCell, { width: "20%" }]}>
												{booking.checkIn}
											</Text>
											<Text style={[styles.tableCell, { width: "15%" }]}>
												{booking.status}
											</Text>
											<Text style={[styles.tableCell, { width: "10%" }]}>
												₱{booking.amount}
											</Text>
										</View>
									))}
								</View>
							</View>
						)}

						{/* Payouts Table */}
						{type === "payouts" && data.pending && (
							<View style={styles.section}>
								<Text style={styles.sectionTitle}>Pending Payouts</Text>
								<View style={styles.table}>
									<View style={[styles.tableRow, styles.tableHeader]}>
										<Text style={[styles.tableCell, { width: "25%" }]}>
											Host
										</Text>
										<Text style={[styles.tableCell, { width: "30%" }]}>
											Email
										</Text>
										<Text style={[styles.tableCell, { width: "15%" }]}>
											Amount
										</Text>
										<Text style={[styles.tableCell, { width: "15%" }]}>
											Method
										</Text>
										<Text style={[styles.tableCell, { width: "15%" }]}>
											Requested
										</Text>
									</View>
									{data.pending.slice(0, 15).map((payout, idx) => (
										<View key={idx} style={styles.tableRow}>
											<Text style={[styles.tableCell, { width: "25%" }]}>
												{payout.host}
											</Text>
											<Text style={[styles.tableCell, { width: "30%" }]}>
												{payout.email}
											</Text>
											<Text style={[styles.tableCell, { width: "15%" }]}>
												₱{payout.amount}
											</Text>
											<Text style={[styles.tableCell, { width: "15%" }]}>
												{payout.method}
											</Text>
											<Text style={[styles.tableCell, { width: "15%" }]}>
												{payout.requestedAt}
											</Text>
										</View>
									))}
								</View>
							</View>
						)}
					</Page>
				</Document>
			)

			// Generate PDF blob
			const blob = await pdf(PDFDocument).toBlob()

			// Create download link
			const url = URL.createObjectURL(blob)
			const link = document.createElement("a")
			link.href = url
			const timestamp = Date.now()
			link.download = `${title.replace(/ /g, "_")}_${timestamp}.pdf`
			document.body.appendChild(link)
			link.click()
			document.body.removeChild(link)
			URL.revokeObjectURL(url)

			toast.success(`📄 ${title} exported as PDF!`)
			setReportModal({ isOpen: false, type: "", data: null, title: "" })
		} catch (err) {
			console.error("Error exporting PDF:", err)
			toast.error(
				"Failed to export PDF. Make sure @react-pdf/renderer is installed."
			)
		}
	}

	if (loading) {
		return (
			<div className="admin-loading">
				<div className="loading-spinner"></div>
				<p>Loading admin dashboard...</p>
			</div>
		)
	}

	return (
		<div className="admin-dashboard">
			<header className="admin-header">
				<div className="admin-header-content">
					<h1>📊 Admin Dashboard</h1>
					<div className="admin-user-info">
						<span>Welcome, {userData?.displayName || "Admin"}</span>
						<button
							onClick={updateAllPropertiesOwner}
							className="update-properties-btn"
							style={{
								background: "var(--secondary)",
								color: "white",
								marginRight: "1rem",
							}}
						>
							🏠 Update Properties Owner
						</button>
						<button
							onClick={() => navigate("/")}
							className="back-to-landing-btn"
						>
							Back to Landing
						</button>
						<button onClick={handleLogout} className="logout-btn">
							Logout
						</button>
					</div>
				</div>

				{/* Navigation Tabs */}
				<div className="admin-tabs">
					<button
						className={`tab-btn ${activeTab === "dashboard" ? "active" : ""}`}
						onClick={() => setActiveTab("dashboard")}
					>
						<span className="tab-icon">📊</span>
						<span>Dashboard</span>
					</button>
					<button
						className={`tab-btn ${activeTab === "policies" ? "active" : ""}`}
						onClick={() => setActiveTab("policies")}
					>
						<span className="tab-icon">📋</span>
						<span>Policies & Compliance</span>
					</button>
					<button
						className={`tab-btn ${activeTab === "terms" ? "active" : ""}`}
						onClick={() => setActiveTab("terms")}
					>
						<span className="tab-icon">📜</span>
						<span>Terms & Conditions</span>
					</button>
					<button
						className={`tab-btn ${activeTab === "privacy" ? "active" : ""}`}
						onClick={() => setActiveTab("privacy")}
					>
						<span className="tab-icon">🔒</span>
						<span>Privacy Policy</span>
					</button>
					<button
						className={`tab-btn ${activeTab === "reports" ? "active" : ""}`}
						onClick={() => setActiveTab("reports")}
					>
						<span className="tab-icon">📄</span>
						<span>Generate Reports</span>
					</button>
				</div>
			</header>

			<main className="admin-main">
				{/* Dashboard Content */}
				{activeTab === "dashboard" && (
					<>
						{/* Bento Box Grid Layout */}
						<div className="bento-grid">
							{/* Quick Stats - Row 1 */}
							<div className="bento-card stats-overview">
								<h2>📈 Overview</h2>
								<div className="mini-stats">
									<div className="mini-stat">
										<div className="mini-stat-icon">👥</div>
										<div>
											<h3>{stats.totalUsers}</h3>
											<p>Total Users</p>
										</div>
									</div>
									<div className="mini-stat">
										<div className="mini-stat-icon">🏠</div>
										<div>
											<h3>{stats.totalProperties}</h3>
											<p>Properties</p>
										</div>
									</div>
									<div className="mini-stat">
										<div className="mini-stat-icon">📅</div>
										<div>
											<h3>{stats.totalBookings}</h3>
											<p>Bookings</p>
										</div>
									</div>
									<div className="mini-stat">
										<div className="mini-stat-icon">💰</div>
										<div>
											<h3>₱{stats.totalRevenue.toLocaleString()}</h3>
											<p>Revenue</p>
										</div>
									</div>
								</div>
							</div>

							{/* Bookings Chart */}
							<div className="bento-card chart-card">
								<h2>📊 Bookings Trend (Last 7 Days)</h2>
								{chartData.bookings && (
									<Line
										data={chartData.bookings}
										options={{
											responsive: true,
											maintainAspectRatio: false,
											plugins: {
												legend: {
													display: false,
												},
											},
											scales: {
												y: {
													beginAtZero: true,
													ticks: {
														stepSize: 1,
													},
												},
											},
										}}
									/>
								)}
							</div>

							{/* Revenue Chart */}
							<div className="bento-card chart-card">
								<h2>💵 Revenue Trend (Last 7 Days)</h2>
								{chartData.revenue && (
									<Bar
										data={chartData.revenue}
										options={{
											responsive: true,
											maintainAspectRatio: false,
											plugins: {
												legend: {
													display: false,
												},
											},
											scales: {
												y: {
													beginAtZero: true,
												},
											},
										}}
									/>
								)}
							</div>

							{/* Property Types Distribution */}
							<div className="bento-card donut-card">
								<h2>🏘️ Property Distribution</h2>
								{chartData.propertyTypes && (
									<Doughnut
										data={chartData.propertyTypes}
										options={{
											responsive: true,
											maintainAspectRatio: false,
											plugins: {
												legend: {
													position: "bottom",
												},
											},
										}}
									/>
								)}
							</div>

							{/* Best Reviews */}
							<div className="bento-card reviews-card">
								<h2>⭐ Top Rated Properties</h2>
								<div className="reviews-list">
									{bestReviews.length === 0 ? (
										<div className="empty-state">
											<p>No properties yet</p>
										</div>
									) : (
										bestReviews.map((property) => (
											<div key={property.id} className="review-item">
												<img
													src={property.images?.[0] || "/placeholder.png"}
													alt={property.title}
												/>
												<div className="review-info">
													<h4>{property.title}</h4>
													<div className="review-rating">
														<span>⭐ {property.rating || 0}</span>
														<span className="review-count">
															({property.reviewsCount || 0} reviews)
														</span>
													</div>
												</div>
											</div>
										))
									)}
								</div>
							</div>

							{/* Lowest Reviews */}
							<div className="bento-card reviews-card">
								<h2>⚠️ Needs Attention</h2>
								<div className="reviews-list">
									{lowestReviews.length === 0 ? (
										<div className="empty-state">
											<p>No properties yet</p>
										</div>
									) : (
										lowestReviews.map((property) => (
											<div key={property.id} className="review-item">
												<img
													src={property.images?.[0] || "/placeholder.png"}
													alt={property.title}
												/>
												<div className="review-info">
													<h4>{property.title}</h4>
													<div className="review-rating">
														<span>⭐ {property.rating || 0}</span>
														<span className="review-count">
															({property.reviewsCount || 0} reviews)
														</span>
													</div>
												</div>
											</div>
										))
									)}
								</div>
							</div>

							{/* Recent Bookings */}
							<div className="bento-card bookings-card">
								<h2>📝 Recent Bookings</h2>
								<div className="bookings-table-wrapper">
									{recentBookings.length === 0 ? (
										<div className="empty-state">
											<p>No bookings yet</p>
										</div>
									) : (
										<table className="bookings-table">
											<thead>
												<tr>
													<th>Guest</th>
													<th>Property</th>
													<th>Check-in</th>
													<th>Status</th>
													<th>Amount</th>
												</tr>
											</thead>
											<tbody>
												{recentBookings.map((booking) => (
													<tr key={booking.id}>
														<td>{booking.guestName || "N/A"}</td>
														<td>{booking.propertyTitle || "N/A"}</td>
														<td>
															{booking.checkIn
																? new Date(booking.checkIn).toLocaleDateString()
																: "N/A"}
														</td>
														<td>
															<span
																className={`booking-status ${
																	booking.status || "pending"
																}`}
															>
																{booking.status || "pending"}
															</span>
														</td>
														<td>
															₱{(booking.totalPrice || 0).toLocaleString()}
														</td>
													</tr>
												))}
											</tbody>
										</table>
									)}
								</div>
							</div>

							{/* Payment Review Section */}
							<div className="bento-card payouts-card">
								<h2>💳 Pending Payouts</h2>
								<div className="payout-summary">
									<div className="payout-total">
										<span>Total Pending:</span>
										<strong>₱{stats.pendingPayouts.toLocaleString()}</strong>
									</div>
								</div>
								<div className="payouts-list">
									{pendingPayouts.length === 0 ? (
										<div className="empty-payouts">
											<p>✅ No pending payouts</p>
										</div>
									) : (
										pendingPayouts.map((payout) => (
											<div key={payout.id} className="payout-item">
												<div className="payout-info">
													<div className="payout-host">
														<strong>{payout.hostName || "Host"}</strong>
														<span className="payout-email">
															{payout.hostEmail}
														</span>
													</div>
													<div className="payout-details">
														<span className="payout-amount">
															₱{(payout.amount || 0).toLocaleString()}
														</span>
														<span className="payout-date">
															{payout.createdAt
																?.toDate?.()
																?.toLocaleDateString() || "N/A"}
														</span>
													</div>
													<div className="payout-method">
														<span>Method: {payout.method || "PayPal"}</span>
														<span>Account: {payout.accountId || "N/A"}</span>
													</div>
												</div>
												<div className="payout-actions">
													<button
														className="approve-btn"
														onClick={() =>
															handleApprovePayout(payout.id, payout.amount)
														}
													>
														✓ Approve
													</button>
													<button
														className="reject-btn"
														onClick={() => handleRejectPayout(payout.id)}
													>
														✗ Reject
													</button>
												</div>
											</div>
										))
									)}
								</div>
							</div>
						</div>
					</>
				)}

				{/* Policies & Compliance Tab */}
				{activeTab === "policies" && (
					<div className="content-section policies-section">
						<div className="section-header">
							<h2>📋 Policies & Compliance</h2>
							<p>
								Manage platform policies, service fees, and compliance rules
							</p>
						</div>

						{/* Service Fees Configuration */}
						<div className="policy-card">
							<h3>💰 Service Fee Structure</h3>
							<div className="fee-config">
								<div className="fee-item">
									<label>
										<strong>Host Service Fee</strong>
										<span className="fee-description">
											Fee charged to hosts on each booking
										</span>
									</label>
									<div className="fee-input">
										<input
											type="number"
											value={policies.serviceFeeHost}
											onChange={(e) =>
												setPolicies({
													...policies,
													serviceFeeHost: parseFloat(e.target.value),
												})
											}
											min="0"
											max="100"
											step="0.5"
										/>
										<span className="fee-unit">%</span>
									</div>
								</div>
								<div className="fee-item">
									<label>
										<strong>Guest Service Fee</strong>
										<span className="fee-description">
											Fee charged to guests on each booking
										</span>
									</label>
									<div className="fee-input">
										<input
											type="number"
											value={policies.serviceFeeGuest}
											onChange={(e) =>
												setPolicies({
													...policies,
													serviceFeeGuest: parseFloat(e.target.value),
												})
											}
											min="0"
											max="100"
											step="0.5"
										/>
										<span className="fee-unit">%</span>
									</div>
								</div>
								<div className="fee-item">
									<label>
										<strong>Guest Fee (Per Person):</strong>
										<span className="fee-description">
											Additional charge per guest for bookings
										</span>
									</label>
									<div className="fee-input">
										<span className="fee-unit">₱</span>
										<input
											type="number"
											value={policies.guestFeePerPerson}
											onChange={(e) =>
												setPolicies({
													...policies,
													guestFeePerPerson: parseFloat(e.target.value),
												})
											}
											min="0"
											step="50"
										/>
									</div>
								</div>
								<div className="fee-item">
									<label>
										<strong>Guest Fee (8+ Guests Fixed):</strong>
										<span className="fee-description">
											Fixed fee for bookings with 8 or more guests
										</span>
									</label>
									<div className="fee-input">
										<span className="fee-unit">₱</span>
										<input
											type="number"
											value={policies.guestFeeFor8Plus}
											onChange={(e) =>
												setPolicies({
													...policies,
													guestFeeFor8Plus: parseFloat(e.target.value),
												})
											}
											min="0"
											step="100"
										/>
									</div>
								</div>
								<button
									className="save-policies-btn"
									onClick={handleUpdatePolicies}
								>
									Save Fee Changes
								</button>
							</div>
						</div>

						{/* Property Listing Rules */}
						<div className="policy-card">
							<h3>🏠 Property Listing Rules</h3>
							<div className="policy-content">
								<div className="policy-item">
									<h4>Listing Requirements</h4>
									<ul>
										<li>
											All properties must have at least 5 high-quality photos
										</li>
										<li>Accurate description with minimum 100 characters</li>
										<li>Complete amenities list and house rules</li>
										<li>Valid address and location coordinates</li>
										<li>
											Clear pricing structure (base price, cleaning fee,
											additional fees)
										</li>
										<li>Calendar availability must be updated regularly</li>
									</ul>
								</div>
								<div className="policy-item">
									<h4>Property Standards</h4>
									<ul>
										<li>Properties must meet basic safety standards</li>
										<li>Accurate representation of space and amenities</li>
										<li>Must comply with local regulations and laws</li>
										<li>No misleading or false information</li>
									</ul>
								</div>
							</div>
						</div>

						{/* Property Removal Policy */}
						<div className="policy-card warning-card">
							<h3>⚠️ Property Removal & Delisting Policy</h3>
							<div className="policy-content">
								<div className="policy-item">
									<h4>Automatic Removal Triggers</h4>
									<ul>
										<li>
											<strong>Low Rating:</strong> Properties with rating below{" "}
											<input
												type="number"
												className="inline-input"
												value={policies.minPropertyRating}
												onChange={(e) =>
													setPolicies({
														...policies,
														minPropertyRating: parseFloat(e.target.value),
													})
												}
												min="1"
												max="5"
												step="0.1"
											/>{" "}
											stars for 3 consecutive months
										</li>
										<li>
											<strong>Multiple Cancellations:</strong> Hosts canceling
											more than{" "}
											<input
												type="number"
												className="inline-input"
												value={policies.maxCancellationsBeforeReview}
												onChange={(e) =>
													setPolicies({
														...policies,
														maxCancellationsBeforeReview: parseInt(
															e.target.value
														),
													})
												}
												min="1"
												max="10"
											/>{" "}
											bookings in 6 months
										</li>
										<li>
											<strong>Violation of Terms:</strong> Any breach of
											community standards or terms of service
										</li>
										<li>
											<strong>Inactive Listings:</strong> No calendar updates
											for 90+ days
										</li>
										<li>
											<strong>Fraudulent Activity:</strong> Detected scams, fake
											listings, or payment fraud
										</li>
									</ul>
								</div>
								<div className="policy-item">
									<h4>Removal Process</h4>
									<ol>
										<li>Warning notification sent to host</li>
										<li>30-day period to resolve issues</li>
										<li>If unresolved, listing is suspended</li>
										<li>Host can appeal within 14 days</li>
										<li>Final decision made by admin review</li>
									</ol>
								</div>
							</div>
						</div>

						{/* Cancellation Rules */}
						<div className="policy-card">
							<h3>🔄 Cancellation Rules</h3>
							<div className="policy-content">
								<div className="policy-item">
									<h4>Guest Cancellation Policy</h4>
									<ul>
										<li>
											<strong>Flexible:</strong> Full refund if cancelled{" "}
											<input
												type="number"
												className="inline-input"
												value={policies.cancellationWindowHours}
												onChange={(e) =>
													setPolicies({
														...policies,
														cancellationWindowHours: parseInt(e.target.value),
													})
												}
												min="24"
												max="168"
											/>{" "}
											hours before check-in
										</li>
										<li>
											<strong>Moderate:</strong> 50% refund if cancelled 1-7
											days before check-in
										</li>
										<li>
											<strong>Strict:</strong> No refund if cancelled within 7
											days of check-in
										</li>
										<li>Service fees are non-refundable in all cases</li>
									</ul>
								</div>
								<div className="policy-item">
									<h4>Host Cancellation Policy</h4>
									<ul>
										<li>Host cancellations are strongly discouraged</li>
										<li>Guest receives full refund including all fees</li>
										<li>Host incurs a cancellation fee of ₱1,000</li>
										<li>
											Listing may be suspended after multiple cancellations
										</li>
										<li>
											Cancellation impacts host's rating and reliability score
										</li>
									</ul>
								</div>
								<div className="policy-item">
									<h4>Emergency Cancellations</h4>
									<ul>
										<li>
											Valid for natural disasters, emergencies, or safety
											concerns
										</li>
										<li>Requires documentation and admin approval</li>
										<li>No penalties applied if approved</li>
										<li>Full refund provided to guests</li>
									</ul>
								</div>
							</div>
						</div>

						{/* Rules and Regulations */}
						<div className="policy-card">
							<h3>📏 Platform Rules & Regulations</h3>
							<div className="policy-content">
								<div className="policy-item">
									<h4>Host Obligations</h4>
									<ul>
										<li>Respond to booking inquiries within 24 hours</li>
										<li>Maintain property as described in listing</li>
										<li>Provide check-in instructions before arrival</li>
										<li>Be available for guest support during stay</li>
										<li>Report any property damage or issues immediately</li>
										<li>Keep calendar updated and accurate</li>
									</ul>
								</div>
								<div className="policy-item">
									<h4>Guest Obligations</h4>
									<ul>
										<li>Treat property with respect and care</li>
										<li>Follow house rules set by host</li>
										<li>Report any issues or damages immediately</li>
										<li>Complete booking checkout procedures</li>
										<li>Leave honest and constructive reviews</li>
										<li>Number of guests must not exceed listing capacity</li>
									</ul>
								</div>
								<div className="policy-item">
									<h4>Prohibited Activities</h4>
									<ul>
										<li>Off-platform transactions or payments</li>
										<li>
											Discrimination based on race, religion, gender, etc.
										</li>
										<li>Fraudulent listings or misrepresentation</li>
										<li>Hosting commercial events without permission</li>
										<li>Subletting or unauthorized property use</li>
										<li>Harassment or inappropriate behavior</li>
									</ul>
								</div>
							</div>
						</div>

						{/* Community Standards */}
						<div className="policy-card">
							<h3>🤝 Community Standards</h3>
							<div className="policy-content">
								<div className="policy-item">
									<h4>Safety & Security</h4>
									<ul>
										<li>All properties must have working smoke detectors</li>
										<li>Fire extinguishers required for all listings</li>
										<li>Emergency contact information must be provided</li>
										<li>Secure entry systems recommended</li>
										<li>Report suspicious activity immediately</li>
									</ul>
								</div>
								<div className="policy-item">
									<h4>Trust & Verification</h4>
									<ul>
										<li>Email verification required for all users</li>
										<li>Phone verification recommended</li>
										<li>Government ID verification for hosts</li>
										<li>Professional photography encouraged</li>
										<li>Accurate property descriptions mandatory</li>
									</ul>
								</div>
							</div>
						</div>

						<button
							className="save-policies-btn primary"
							onClick={handleUpdatePolicies}
						>
							💾 Save All Policy Changes
						</button>
					</div>
				)}

				{/* Terms & Conditions Tab */}
				{activeTab === "terms" && (
					<div className="content-section terms-section">
						<div className="section-header">
							<h2>📜 Terms & Conditions</h2>
							<p>Legal terms governing the use of AuraStays platform</p>
						</div>

						<div className="legal-document">
							<div className="legal-section">
								<h3>1. Acceptance of Terms</h3>
								<p>
									By accessing and using AuraStays ("the Platform"), you accept
									and agree to be bound by these Terms and Conditions. If you do
									not agree to these terms, please do not use our services.
								</p>
							</div>

							<div className="legal-section">
								<h3>2. User Accounts</h3>
								<h4>2.1 Account Creation</h4>
								<ul>
									<li>
										Users must provide accurate and complete registration
										information
									</li>
									<li>Users must be at least 18 years of age</li>
									<li>
										One account per user; multiple accounts are prohibited
									</li>
									<li>Account credentials must be kept confidential</li>
								</ul>
								<h4>2.2 Account Responsibilities</h4>
								<ul>
									<li>
										Users are responsible for all activities under their account
									</li>
									<li>
										Users must notify us immediately of any unauthorized access
									</li>
									<li>
										We reserve the right to suspend or terminate accounts for
										violations
									</li>
								</ul>
							</div>

							<div className="legal-section">
								<h3>3. Host Terms</h3>
								<h4>3.1 Listing Creation</h4>
								<ul>
									<li>
										Hosts must have legal right to list and rent the property
									</li>
									<li>
										All listing information must be accurate and up-to-date
									</li>
									<li>Hosts must comply with local laws and regulations</li>
									<li>
										Hosts are responsible for obtaining necessary permits and
										licenses
									</li>
								</ul>
								<h4>3.2 Host Fees & Payments</h4>
								<ul>
									<li>
										Hosts agree to pay a service fee of{" "}
										{policies.serviceFeeHost}% per booking
									</li>
									<li>Service fees are automatically deducted from payouts</li>
									<li>Hosts are responsible for applicable taxes</li>
									<li>
										Payouts processed within 24 hours after guest check-in
									</li>
								</ul>
							</div>

							<div className="legal-section">
								<h3>4. Guest Terms</h3>
								<h4>4.1 Booking & Reservations</h4>
								<ul>
									<li>
										Guests must book properties for personal, non-commercial use
									</li>
									<li>Number of guests cannot exceed listing capacity</li>
									<li>Guests must follow house rules set by hosts</li>
									<li>Bookings are subject to host acceptance</li>
								</ul>
								<h4>4.2 Guest Fees & Payments</h4>
								<ul>
									<li>
										Guests agree to pay a service fee of{" "}
										{policies.serviceFeeGuest}% per booking
									</li>
									<li>
										Guest fee of ₱{policies.guestFeePerPerson} per person for
										bookings
									</li>
									<li>
										For bookings with 8 or more guests, a fixed guest fee of ₱
										{policies.guestFeeFor8Plus.toLocaleString()} applies
									</li>
									<li>All charges must be paid in full at time of booking</li>
									<li>
										Payment is processed securely through approved methods
									</li>
									<li>Guests responsible for any damage caused during stay</li>
								</ul>
							</div>

							<div className="legal-section">
								<h3>5. Cancellations & Refunds</h3>
								<ul>
									<li>
										Cancellation policies vary by listing (Flexible, Moderate,
										Strict)
									</li>
									<li>
										Refund amount depends on cancellation policy and timing
									</li>
									<li>
										Service fees are non-refundable except in special
										circumstances
									</li>
									<li>Host cancellations result in full refund to guests</li>
								</ul>
							</div>

							<div className="legal-section">
								<h3>6. Prohibited Activities</h3>
								<ul>
									<li>No fraudulent, illegal, or harmful activities</li>
									<li>No discrimination or harassment</li>
									<li>No unauthorized commercial use of properties</li>
									<li>No circumventing platform for direct bookings</li>
									<li>No false reviews or manipulation of ratings</li>
								</ul>
							</div>

							<div className="legal-section">
								<h3>7. Liability & Disclaimers</h3>
								<h4>7.1 Platform Liability</h4>
								<ul>
									<li>
										AuraStays acts as an intermediary between hosts and guests
									</li>
									<li>We do not own, manage, or control listed properties</li>
									<li>We are not responsible for host or guest conduct</li>
									<li>Use of platform is at user's own risk</li>
								</ul>
								<h4>7.2 Limitation of Liability</h4>
								<ul>
									<li>
										We are not liable for indirect, incidental, or consequential
										damages
									</li>
									<li>
										Total liability limited to amount paid for the booking
									</li>
									<li>
										We do not guarantee availability or accuracy of listings
									</li>
								</ul>
							</div>

							<div className="legal-section">
								<h3>8. Intellectual Property</h3>
								<ul>
									<li>All platform content is property of AuraStays</li>
									<li>Users retain ownership of their uploaded content</li>
									<li>
										Users grant us license to use content for platform
										operations
									</li>
									<li>Unauthorized use of platform content is prohibited</li>
								</ul>
							</div>

							<div className="legal-section">
								<h3>9. Dispute Resolution</h3>
								<ul>
									<li>
										Users agree to attempt good-faith resolution of disputes
									</li>
									<li>
										Platform may mediate disputes between hosts and guests
									</li>
									<li>Unresolved disputes subject to binding arbitration</li>
									<li>Legal actions must be filed in our jurisdiction</li>
								</ul>
							</div>

							<div className="legal-section">
								<h3>10. Modifications to Terms</h3>
								<ul>
									<li>
										We reserve the right to modify these terms at any time
									</li>
									<li>Users will be notified of significant changes</li>
									<li>Continued use after changes constitutes acceptance</li>
									<li>
										Users may terminate account if they disagree with changes
									</li>
								</ul>
							</div>

							<div className="legal-section">
								<h3>11. Termination</h3>
								<ul>
									<li>We may terminate or suspend accounts for violations</li>
									<li>Users may close their accounts at any time</li>
									<li>Obligations survive account termination</li>
									<li>
										Outstanding payments must be settled before termination
									</li>
								</ul>
							</div>

							<div className="legal-section">
								<h3>12. Contact Information</h3>
								<p>For questions about these terms, contact us at:</p>
								<ul>
									<li>Email: legal@aurastays.com</li>
									<li>Phone: +63 123 456 7890</li>
									<li>Address: Manila, Philippines</li>
								</ul>
							</div>

							<div className="legal-footer">
								<p>
									<strong>Last Updated:</strong>{" "}
									{new Date().toLocaleDateString()}
								</p>
								<p>
									<em>
										By using AuraStays, you agree to these Terms & Conditions
									</em>
								</p>
							</div>
						</div>
					</div>
				)}

				{/* Privacy Policy Tab */}
				{activeTab === "privacy" && (
					<div className="content-section privacy-section">
						<div className="section-header">
							<h2>🔒 Privacy Policy</h2>
							<p>How we collect, use, and protect your personal information</p>
						</div>

						<div className="legal-document">
							<div className="legal-section">
								<h3>1. Introduction</h3>
								<p>
									AuraStays ("we," "our," or "us") is committed to protecting
									your privacy. This Privacy Policy explains how we collect,
									use, disclose, and safeguard your information when you use our
									platform.
								</p>
							</div>

							<div className="legal-section">
								<h3>2. Information We Collect</h3>
								<h4>2.1 Information You Provide</h4>
								<ul>
									<li>
										<strong>Account Information:</strong> Name, email, phone
										number, date of birth, gender
									</li>
									<li>
										<strong>Profile Information:</strong> Profile picture, bio,
										preferences
									</li>
									<li>
										<strong>Payment Information:</strong> Credit card details,
										PayPal account (processed securely)
									</li>
									<li>
										<strong>Identity Verification:</strong> Government ID,
										address verification
									</li>
									<li>
										<strong>Communications:</strong> Messages, reviews, support
										inquiries
									</li>
								</ul>
								<h4>2.2 Automatically Collected Information</h4>
								<ul>
									<li>
										<strong>Device Information:</strong> IP address, browser
										type, device type
									</li>
									<li>
										<strong>Usage Data:</strong> Pages visited, search queries,
										booking history
									</li>
									<li>
										<strong>Location Data:</strong> GPS location (with
										permission)
									</li>
									<li>
										<strong>Cookies:</strong> Session data, preferences,
										analytics
									</li>
								</ul>
								<h4>2.3 Information from Third Parties</h4>
								<ul>
									<li>Social media profiles (if you connect accounts)</li>
									<li>Payment processors (transaction data)</li>
									<li>Background check services (for hosts)</li>
								</ul>
							</div>

							<div className="legal-section">
								<h3>3. How We Use Your Information</h3>
								<h4>3.1 Platform Operations</h4>
								<ul>
									<li>Create and manage user accounts</li>
									<li>Process bookings and payments</li>
									<li>Facilitate communication between hosts and guests</li>
									<li>Provide customer support</li>
									<li>Verify identities and prevent fraud</li>
								</ul>
								<h4>3.2 Improvement & Personalization</h4>
								<ul>
									<li>Personalize search results and recommendations</li>
									<li>Analyze usage patterns and trends</li>
									<li>Improve platform features and functionality</li>
									<li>Conduct research and analytics</li>
								</ul>
								<h4>3.3 Communications</h4>
								<ul>
									<li>Send booking confirmations and updates</li>
									<li>Notify about account activity</li>
									<li>Send promotional emails (opt-out available)</li>
									<li>Provide customer support responses</li>
								</ul>
								<h4>3.4 Legal & Safety</h4>
								<ul>
									<li>Comply with legal obligations</li>
									<li>Enforce terms and policies</li>
									<li>Protect against fraud and abuse</li>
									<li>Resolve disputes</li>
								</ul>
							</div>

							<div className="legal-section">
								<h3>4. Information Sharing</h3>
								<h4>4.1 With Other Users</h4>
								<ul>
									<li>Public profile information (name, photo, reviews)</li>
									<li>Booking details shared with hosts/guests</li>
									<li>Messages and communications</li>
								</ul>
								<h4>4.2 With Service Providers</h4>
								<ul>
									<li>Payment processors (secure transaction handling)</li>
									<li>Cloud hosting providers (data storage)</li>
									<li>Analytics services (usage insights)</li>
									<li>Email service providers (communications)</li>
								</ul>
								<h4>4.3 Legal Requirements</h4>
								<ul>
									<li>Law enforcement (when required by law)</li>
									<li>Court orders and legal processes</li>
									<li>Protection of rights and safety</li>
								</ul>
								<h4>4.4 Business Transfers</h4>
								<ul>
									<li>Mergers, acquisitions, or asset sales</li>
									<li>Users will be notified of any ownership changes</li>
								</ul>
							</div>

							<div className="legal-section">
								<h3>5. Data Security</h3>
								<ul>
									<li>Industry-standard encryption (SSL/TLS)</li>
									<li>Secure password hashing and storage</li>
									<li>Regular security audits and updates</li>
									<li>Access controls and authentication</li>
									<li>Payment data handled by PCI-compliant processors</li>
									<li>Employee training on data protection</li>
								</ul>
								<p>
									<em>
										Note: While we implement strong security measures, no system
										is 100% secure. Users should maintain strong passwords and
										protect account credentials.
									</em>
								</p>
							</div>

							<div className="legal-section">
								<h3>6. Your Privacy Rights</h3>
								<h4>6.1 Access & Control</h4>
								<ul>
									<li>
										<strong>Access:</strong> Request copy of your personal data
									</li>
									<li>
										<strong>Correction:</strong> Update inaccurate information
									</li>
									<li>
										<strong>Deletion:</strong> Request account and data deletion
									</li>
									<li>
										<strong>Portability:</strong> Export your data
									</li>
									<li>
										<strong>Opt-Out:</strong> Unsubscribe from marketing emails
									</li>
								</ul>
								<h4>6.2 How to Exercise Rights</h4>
								<ul>
									<li>Access account settings to update information</li>
									<li>Contact privacy@aurastays.com for requests</li>
									<li>Response provided within 30 days</li>
								</ul>
							</div>

							<div className="legal-section">
								<h3>7. Cookies & Tracking</h3>
								<h4>7.1 Types of Cookies We Use</h4>
								<ul>
									<li>
										<strong>Essential Cookies:</strong> Required for platform
										functionality
									</li>
									<li>
										<strong>Analytics Cookies:</strong> Track usage and
										performance
									</li>
									<li>
										<strong>Marketing Cookies:</strong> Personalize
										advertisements
									</li>
									<li>
										<strong>Preference Cookies:</strong> Remember your settings
									</li>
								</ul>
								<h4>7.2 Cookie Management</h4>
								<ul>
									<li>Browser settings to block or delete cookies</li>
									<li>Opt-out tools for advertising cookies</li>
									<li>Some features may not work without cookies</li>
								</ul>
							</div>

							<div className="legal-section">
								<h3>8. Data Retention</h3>
								<ul>
									<li>Account data retained while account is active</li>
									<li>
										Booking records kept for 7 years (tax/legal requirements)
									</li>
									<li>Communication logs retained for 3 years</li>
									<li>Deleted data may remain in backups for 90 days</li>
									<li>Some data retained longer for legal compliance</li>
								</ul>
							</div>

							<div className="legal-section">
								<h3>9. Children's Privacy</h3>
								<ul>
									<li>Platform not intended for users under 18</li>
									<li>We do not knowingly collect data from children</li>
									<li>Parents should monitor children's internet use</li>
									<li>Contact us if we inadvertently collected child data</li>
								</ul>
							</div>

							<div className="legal-section">
								<h3>10. International Data Transfers</h3>
								<ul>
									<li>Data may be transferred and processed internationally</li>
									<li>We ensure adequate protection for transferred data</li>
									<li>Standard contractual clauses used where required</li>
								</ul>
							</div>

							<div className="legal-section">
								<h3>11. Changes to Privacy Policy</h3>
								<ul>
									<li>We may update this policy periodically</li>
									<li>Users notified of significant changes</li>
									<li>Continued use implies acceptance of changes</li>
									<li>Review policy regularly for updates</li>
								</ul>
							</div>

							<div className="legal-section">
								<h3>12. Contact Us</h3>
								<p>For privacy-related questions or requests:</p>
								<ul>
									<li>
										<strong>Email:</strong> privacy@aurastays.com
									</li>
									<li>
										<strong>Phone:</strong> +63 123 456 7890
									</li>
									<li>
										<strong>Address:</strong> Data Protection Officer,
										AuraStays, Manila, Philippines
									</li>
								</ul>
							</div>

							<div className="legal-footer">
								<p>
									<strong>Last Updated:</strong>{" "}
									{new Date().toLocaleDateString()}
								</p>
								<p>
									<em>
										Your privacy is important to us. We are committed to
										protecting your personal information.
									</em>
								</p>
							</div>
						</div>
					</div>
				)}

				{/* Reports Generation Tab */}
				{activeTab === "reports" && (
					<div className="content-section reports-section">
						<div className="section-header">
							<h2>📄 Generate Reports</h2>
							<p>Export comprehensive reports in JSON and CSV formats</p>
						</div>

						<div className="reports-grid">
							{/* Users Report */}
							<div className="report-card">
								<div className="report-icon">👥</div>
								<h3>Users Report</h3>
								<p>
									Complete user data including registration dates, user types,
									and activity
								</p>
								<div className="report-stats">
									<div className="stat">
										<span className="stat-value">{stats.totalUsers}</span>
										<span className="stat-label">Total Users</span>
									</div>
									<div className="stat">
										<span className="stat-value">{stats.totalHosts}</span>
										<span className="stat-label">Hosts</span>
									</div>
									<div className="stat">
										<span className="stat-value">{stats.totalGuests}</span>
										<span className="stat-label">Guests</span>
									</div>
								</div>
								<button
									className="generate-report-btn"
									onClick={() => openReportModal("users")}
								>
									📊 Generate Users Report
								</button>
							</div>

							{/* Properties Report */}
							<div className="report-card">
								<div className="report-icon">🏠</div>
								<h3>Properties Report</h3>
								<p>
									Detailed property listings with ratings, reviews, and
									performance metrics
								</p>
								<div className="report-stats">
									<div className="stat">
										<span className="stat-value">{stats.totalProperties}</span>
										<span className="stat-label">Total Properties</span>
									</div>
									<div className="stat">
										<span className="stat-value">
											{bestReviews.length > 0
												? (
														bestReviews.reduce(
															(sum, p) => sum + (p.rating || 0),
															0
														) / bestReviews.length
												  ).toFixed(1)
												: "0.0"}
										</span>
										<span className="stat-label">Avg Rating</span>
									</div>
								</div>
								<button
									className="generate-report-btn"
									onClick={() => openReportModal("properties")}
								>
									📊 Generate Properties Report
								</button>
							</div>

							{/* Bookings Report */}
							<div className="report-card">
								<div className="report-icon">📅</div>
								<h3>Bookings Report</h3>
								<p>
									Complete booking history with guest info, dates, status, and
									amounts
								</p>
								<div className="report-stats">
									<div className="stat">
										<span className="stat-value">{stats.totalBookings}</span>
										<span className="stat-label">Total Bookings</span>
									</div>
									<div className="stat">
										<span className="stat-value">
											₱
											{stats.totalBookings > 0
												? Math.round(
														stats.totalRevenue / stats.totalBookings
												  ).toLocaleString()
												: "0"}
										</span>
										<span className="stat-label">Avg Value</span>
									</div>
								</div>
								<button
									className="generate-report-btn"
									onClick={() => openReportModal("bookings")}
								>
									📊 Generate Bookings Report
								</button>
							</div>

							{/* Revenue Report */}
							<div className="report-card">
								<div className="report-icon">💰</div>
								<h3>Revenue Report</h3>
								<p>
									Financial overview with revenue trends, service fees, and
									earnings breakdown
								</p>
								<div className="report-stats">
									<div className="stat">
										<span className="stat-value">
											₱{stats.totalRevenue.toLocaleString()}
										</span>
										<span className="stat-label">Total Revenue</span>
									</div>
									<div className="stat">
										<span className="stat-value">
											₱
											{(
												stats.totalRevenue *
												((policies.serviceFeeHost + policies.serviceFeeGuest) /
													100)
											)
												.toFixed(0)
												.toLocaleString()}
										</span>
										<span className="stat-label">Service Fees</span>
									</div>
								</div>
								<button
									className="generate-report-btn"
									onClick={() => openReportModal("revenue")}
								>
									📊 Generate Revenue Report
								</button>
							</div>

							{/* Payouts Report */}
							<div className="report-card">
								<div className="report-icon">💳</div>
								<h3>Payouts Report</h3>
								<p>
									Host payout requests with amounts, methods, and processing
									status
								</p>
								<div className="report-stats">
									<div className="stat">
										<span className="stat-value">
											₱{stats.pendingPayouts.toLocaleString()}
										</span>
										<span className="stat-label">Pending Amount</span>
									</div>
									<div className="stat">
										<span className="stat-value">{pendingPayouts.length}</span>
										<span className="stat-label">Requests</span>
									</div>
								</div>
								<button
									className="generate-report-btn"
									onClick={() => openReportModal("payouts")}
								>
									📊 Generate Payouts Report
								</button>
							</div>

							{/* All Reports Combined */}
							<div className="report-card featured">
								<div className="report-icon">📑</div>
								<h3>Complete System Report</h3>
								<p>
									Generate all reports at once for comprehensive platform
									overview
								</p>
								<div className="report-stats full-width">
									<p className="report-description">
										Includes users, properties, bookings, revenue, and payouts
										data in both JSON and CSV formats
									</p>
								</div>
								<button
									className="generate-report-btn primary"
									onClick={() => {
										toast.info(
											"💡 Please generate each report individually to preview before exporting"
										)
									}}
								>
									ℹ️ View Report Instructions
								</button>
							</div>
						</div>

						<div className="reports-info">
							<h3>ℹ️ Report Information</h3>
							<div className="info-grid">
								<div className="info-item">
									<h4>📄 Export Formats</h4>
									<p>
										All reports are exported in both <strong>JSON</strong> (for
										data processing) and <strong>CSV</strong> (for spreadsheets)
										formats
									</p>
								</div>
								<div className="info-item">
									<h4>📊 Data Included</h4>
									<p>
										Reports contain complete data including timestamps, user
										information, financial details, and statistical summaries
									</p>
								</div>
								<div className="info-item">
									<h4>🔒 Security</h4>
									<p>
										Reports contain sensitive data. Handle exported files
										securely and store them in protected locations
									</p>
								</div>
								<div className="info-item">
									<h4>⏱️ Real-Time Data</h4>
									<p>
										All reports reflect current platform data at the moment of
										generation
									</p>
								</div>
							</div>
						</div>
					</div>
				)}

				{/* Report Preview Modal */}
				{reportModal.isOpen && (
					<div
						className="report-modal-overlay"
						onClick={() =>
							setReportModal({ isOpen: false, type: "", data: null, title: "" })
						}
					>
						<div
							className="report-modal-content"
							onClick={(e) => e.stopPropagation()}
						>
							<div className="report-modal-header">
								<h2>📊 {reportModal.title}</h2>
								<button
									className="close-modal-btn"
									onClick={() =>
										setReportModal({
											isOpen: false,
											type: "",
											data: null,
											title: "",
										})
									}
								>
									✕
								</button>
							</div>

							<div className="report-modal-body">
								{/* Summary Section */}
								{reportModal.data?.summary && (
									<div className="report-section">
										<h3>📈 Summary</h3>
										<div className="summary-grid">
											{Object.entries(reportModal.data.summary).map(
												([key, value]) => {
													const label = key.replace(/([A-Z])/g, " $1").trim()
													const displayLabel =
														label.charAt(0).toUpperCase() + label.slice(1)
													return (
														<div key={key} className="summary-item">
															<span className="summary-label">
																{displayLabel}:
															</span>
															<span className="summary-value">{value}</span>
														</div>
													)
												}
											)}
										</div>
									</div>
								)}

								{/* Data Tables */}
								{reportModal.type === "users" &&
									reportModal.data?.recentUsers && (
										<div className="report-section">
											<h3>👥 Recent Users</h3>
											<div className="report-table-wrapper">
												<table className="report-table">
													<thead>
														<tr>
															<th>Name</th>
															<th>Email</th>
															<th>User Type</th>
															<th>Created At</th>
														</tr>
													</thead>
													<tbody>
														{reportModal.data.recentUsers.map((user, idx) => (
															<tr key={idx}>
																<td>{user.name}</td>
																<td>{user.email}</td>
																<td>
																	<span
																		className={`type-badge ${user.userType}`}
																	>
																		{user.userType}
																	</span>
																</td>
																<td>{user.createdAt}</td>
															</tr>
														))}
													</tbody>
												</table>
											</div>
										</div>
									)}

								{reportModal.type === "properties" && (
									<>
										{reportModal.data?.topRated &&
											reportModal.data.topRated.length > 0 && (
												<div className="report-section">
													<h3>⭐ Top Rated Properties</h3>
													<div className="report-table-wrapper">
														<table className="report-table">
															<thead>
																<tr>
																	<th>Title</th>
																	<th>Rating</th>
																	<th>Reviews</th>
																	<th>Category</th>
																</tr>
															</thead>
															<tbody>
																{reportModal.data.topRated.map((prop, idx) => (
																	<tr key={idx}>
																		<td>{prop.title}</td>
																		<td>
																			<span className="rating-badge">
																				⭐ {prop.rating}
																			</span>
																		</td>
																		<td>{prop.reviews}</td>
																		<td>{prop.category}</td>
																	</tr>
																))}
															</tbody>
														</table>
													</div>
												</div>
											)}
										{reportModal.data?.needsAttention &&
											reportModal.data.needsAttention.length > 0 && (
												<div className="report-section">
													<h3>⚠️ Needs Attention</h3>
													<div className="report-table-wrapper">
														<table className="report-table">
															<thead>
																<tr>
																	<th>Title</th>
																	<th>Rating</th>
																	<th>Reviews</th>
																	<th>Category</th>
																</tr>
															</thead>
															<tbody>
																{reportModal.data.needsAttention.map(
																	(prop, idx) => (
																		<tr key={idx}>
																			<td>{prop.title}</td>
																			<td>
																				<span className="rating-badge warning">
																					⭐ {prop.rating}
																				</span>
																			</td>
																			<td>{prop.reviews}</td>
																			<td>{prop.category}</td>
																		</tr>
																	)
																)}
															</tbody>
														</table>
													</div>
												</div>
											)}
										{reportModal.data?.allProperties &&
											reportModal.data.allProperties.length > 0 && (
												<div className="report-section">
													<h3>📋 All Properties</h3>
													<div className="report-table-wrapper">
														<table className="report-table">
															<thead>
																<tr>
																	<th>Title</th>
																	<th>Host</th>
																	<th>Rating</th>
																	<th>Reviews</th>
																	<th>Category</th>
																</tr>
															</thead>
															<tbody>
																{reportModal.data.allProperties.map(
																	(prop, idx) => (
																		<tr key={idx}>
																			<td>{prop.title}</td>
																			<td>{prop.host}</td>
																			<td>
																				<span className="rating-badge">
																					⭐ {prop.rating}
																				</span>
																			</td>
																			<td>{prop.reviews}</td>
																			<td>{prop.category}</td>
																		</tr>
																	)
																)}
															</tbody>
														</table>
													</div>
												</div>
											)}
									</>
								)}

								{reportModal.type === "bookings" &&
									reportModal.data?.recentBookings && (
										<div className="report-section">
											<h3>📅 Recent Bookings</h3>
											<div className="report-table-wrapper">
												<table className="report-table">
													<thead>
														<tr>
															<th>Guest</th>
															<th>Property</th>
															<th>Check-in</th>
															<th>Status</th>
															<th>Amount</th>
														</tr>
													</thead>
													<tbody>
														{reportModal.data.recentBookings.map(
															(booking, idx) => (
																<tr key={idx}>
																	<td>{booking.guest}</td>
																	<td>{booking.property}</td>
																	<td>{booking.checkIn}</td>
																	<td>
																		<span
																			className={`status-badge ${booking.status}`}
																		>
																			{booking.status}
																		</span>
																	</td>
																	<td>₱{booking.amount}</td>
																</tr>
															)
														)}
													</tbody>
												</table>
											</div>
										</div>
									)}

								{reportModal.type === "payouts" &&
									reportModal.data?.pending && (
										<div className="report-section">
											<h3>💳 Pending Payouts</h3>
											<div className="report-table-wrapper">
												<table className="report-table">
													<thead>
														<tr>
															<th>Host</th>
															<th>Email</th>
															<th>Amount</th>
															<th>Method</th>
															<th>Requested At</th>
														</tr>
													</thead>
													<tbody>
														{reportModal.data.pending.map((payout, idx) => (
															<tr key={idx}>
																<td>{payout.host}</td>
																<td>{payout.email}</td>
																<td>₱{payout.amount}</td>
																<td>{payout.method}</td>
																<td>{payout.requestedAt}</td>
															</tr>
														))}
													</tbody>
												</table>
											</div>
										</div>
									)}
							</div>

							<div className="report-modal-footer">
								<button className="export-pdf-btn" onClick={exportReportAsPDF}>
									📄 Export as PDF
								</button>
								<button
									className="cancel-btn"
									onClick={() =>
										setReportModal({
											isOpen: false,
											type: "",
											data: null,
											title: "",
										})
									}
								>
									Cancel
								</button>
							</div>
						</div>
					</div>
				)}
			</main>
		</div>
	)
}

export default AdminDashboard
