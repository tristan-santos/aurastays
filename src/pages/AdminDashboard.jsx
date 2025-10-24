import { useAuth } from "../contexts/AuthContext"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { auth, db } from "../components/firebaseConfig"
import { collection, getDocs, query, orderBy } from "firebase/firestore"
import { toast } from "react-stacked-toast"
import SeedPropertiesButton from "../components/SeedPropertiesButton"
import "../css/AdminDashboard.css"

const AdminDashboard = () => {
	const { currentUser, userData } = useAuth()
	const navigate = useNavigate()
	const [stats, setStats] = useState({
		totalUsers: 0,
		totalHosts: 0,
		totalGuests: 0,
		recentSignups: 0,
	})
	const [recentUsers, setRecentUsers] = useState([])
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		fetchAdminData()
	}, [])

	const fetchAdminData = async () => {
		try {
			setLoading(true)

			// Get all users
			const usersQuery = query(
				collection(db, "users"),
				orderBy("createdAt", "desc")
			)
			const usersSnapshot = await getDocs(usersQuery)
			const allUsers = usersSnapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			}))

			// Calculate statistics
			const totalUsers = allUsers.length
			const totalHosts = allUsers.filter(
				(user) => user.userType === "host"
			).length
			const totalGuests = allUsers.filter(
				(user) => user.userType === "guest"
			).length

			// Recent signups (last 7 days)
			const sevenDaysAgo = new Date()
			sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
			const recentSignups = allUsers.filter((user) => {
				const createdAt = user.createdAt?.toDate?.() || new Date()
				return createdAt > sevenDaysAgo
			}).length

			setStats({
				totalUsers,
				totalHosts,
				totalGuests,
				recentSignups,
			})

			// Get recent users (last 10)
			setRecentUsers(allUsers.slice(0, 10))
		} catch (error) {
			console.error("Error fetching admin data:", error)
			toast.error("Failed to load admin data")
		} finally {
			setLoading(false)
		}
	}

	const handleLogout = async () => {
		try {
			await auth.signOut()
			toast.success("Logged out successfully")
		} catch (error) {
			toast.error("Error logging out")
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
					<h1>Admin Dashboard</h1>
					<div className="admin-user-info">
						<span>Welcome, {userData?.displayName || "Admin"}</span>
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
			</header>

			<main className="admin-main">
				<div className="admin-stats">
					<div className="stat-card">
						<div className="stat-icon">👥</div>
						<div className="stat-content">
							<h3>Total Users</h3>
							<p className="stat-number">{stats.totalUsers}</p>
						</div>
					</div>

					<div className="stat-card">
						<div className="stat-icon">🏠</div>
						<div className="stat-content">
							<h3>Hosts</h3>
							<p className="stat-number">{stats.totalHosts}</p>
						</div>
					</div>

					<div className="stat-card">
						<div className="stat-icon">👤</div>
						<div className="stat-content">
							<h3>Guests</h3>
							<p className="stat-number">{stats.totalGuests}</p>
						</div>
					</div>

					<div className="stat-card">
						<div className="stat-icon">📈</div>
						<div className="stat-content">
							<h3>Recent Signups</h3>
							<p className="stat-number">{stats.recentSignups}</p>
							<small>Last 7 days</small>
						</div>
					</div>
				</div>

				{/* Seed Properties Button */}
				<div
					className="admin-section"
					style={{
						backgroundColor: "white",
						borderRadius: "12px",
						padding: "24px",
						marginBottom: "24px",
						boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
					}}
				>
					<h2 style={{ marginBottom: "16px", color: "#2c3e50" }}>
						Database Management
					</h2>
					<SeedPropertiesButton />
				</div>

				<div className="admin-sections">
					<div className="admin-section">
						<h2>Recent Users</h2>
						<div className="users-table">
							<table>
								<thead>
									<tr>
										<th>Name</th>
										<th>Email</th>
										<th>Type</th>
										<th>Signup Date</th>
										<th>Status</th>
									</tr>
								</thead>
								<tbody>
									{recentUsers.map((user) => (
										<tr key={user.id}>
											<td>{user.displayName || "N/A"}</td>
											<td>{user.email}</td>
											<td>
												<span className={`user-type ${user.userType}`}>
													{user.userType}
												</span>
											</td>
											<td>
												{user.createdAt?.toDate?.()?.toLocaleDateString() ||
													"N/A"}
											</td>
											<td>
												<span
													className={`status ${
														user.termsAccepted ? "verified" : "pending"
													}`}
												>
													{user.termsAccepted ? "Verified" : "Pending"}
												</span>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>

					<div className="admin-section">
						<h2>System Information</h2>
						<div className="system-info">
							<div className="info-item">
								<strong>App Version:</strong> 1.0.0
							</div>
							<div className="info-item">
								<strong>Last Updated:</strong> {new Date().toLocaleDateString()}
							</div>
							<div className="info-item">
								<strong>Database:</strong> Firebase Firestore
							</div>
							<div className="info-item">
								<strong>Authentication:</strong> Firebase Auth
							</div>
						</div>
					</div>
				</div>
			</main>
		</div>
	)
}

export default AdminDashboard
