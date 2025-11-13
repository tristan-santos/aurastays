import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import { auth, db } from "../components/firebaseConfig"
import {
	collection,
	getDocs,
	query,
	where,
	limit,
	orderBy,
	updateDoc,
	doc,
	writeBatch,
	serverTimestamp,
} from "firebase/firestore"
import { toast } from "react-stacked-toast"
import { FaSearch, FaTimes } from "react-icons/fa"
import housePlaceholder from "../assets/housePlaceholder.png"
import "../css/HostList.css"
import "../css/AdminDashboard.css"
import HostDetailsModal from "../components/HostDetailsModal"
import { formatCurrencyFull } from "../utils/currencyFormatter"

export default function HostList() {
	const { currentUser, userData } = useAuth()
	const navigate = useNavigate()
	const [hosts, setHosts] = useState([])
	const [filteredHosts, setFilteredHosts] = useState([])
	const [loading, setLoading] = useState(true)
	const [searchQuery, setSearchQuery] = useState("")
	const [filterRating, setFilterRating] = useState("all") // 'all', 'high', 'medium', 'low'
	const [filterProperties, setFilterProperties] = useState("all") // 'all', 'many', 'few'
	const [sortBy, setSortBy] = useState("rating") // 'rating', 'properties', 'name'
	const [sidebarOpen, setSidebarOpen] = useState(true)
	const [selectedHost, setSelectedHost] = useState(null)
	const [showHostModal, setShowHostModal] = useState(false)
	const [currentPage, setCurrentPage] = useState(1)
	const hostsPerPage = 10

	useEffect(() => {
		fetchHostsData()
	}, [])

	useEffect(() => {
		applyFiltersAndSearch()
	}, [hosts, searchQuery, filterRating, filterProperties, sortBy])

	const fetchHostsData = async () => {
		try {
			setLoading(true)
			// Fetch all properties
			const propertiesRef = collection(db, "properties")
			const propertiesSnapshot = await getDocs(propertiesRef)
			const properties = propertiesSnapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			}))

			// Group properties by hostId and calculate average ratings
			const hostMap = new Map()

			properties.forEach((property) => {
				const hostId = property.hostId || property.host?.hostId
				if (!hostId) return

				if (!hostMap.has(hostId)) {
					hostMap.set(hostId, {
						hostId,
						properties: [],
						totalRating: 0,
						ratedPropertiesCount: 0,
					})
				}

				const hostData = hostMap.get(hostId)
				hostData.properties.push(property)

				// Only count properties with ratings > 0
				if (property.rating && property.rating > 0) {
					hostData.totalRating += property.rating
					hostData.ratedPropertiesCount += 1
				}
			})

			// Calculate average ratings and fetch user data
			const hostsList = []
			const usersRef = collection(db, "users")
			const subscriptionsRef = collection(db, "subscriptions")

			for (const [hostId, hostData] of hostMap.entries()) {
				const averageRating =
					hostData.ratedPropertiesCount > 0
						? hostData.totalRating / hostData.ratedPropertiesCount
						: 0

				// Fetch user data
				let userData = null
				try {
					const userQuery = query(
						usersRef,
						where("uid", "==", hostId),
						limit(1)
					)
					const userSnapshot = await getDocs(userQuery)
					if (!userSnapshot.empty) {
						userData = {
							id: userSnapshot.docs[0].id,
							...userSnapshot.docs[0].data(),
						}
					}
				} catch (err) {
					console.error(`Error fetching user data for host ${hostId}:`, err)
				}

				// Fetch subscription data
				let subscriptionType = "Free"
				try {
					const subscriptionQuery = query(
						subscriptionsRef,
						where("userId", "==", hostId),
						where("status", "in", ["active", "pending"])
					)
					const subscriptionSnapshot = await getDocs(subscriptionQuery)
					if (!subscriptionSnapshot.empty) {
						const subData = subscriptionSnapshot.docs[0].data()
						if (subData.planId === "premium") {
							subscriptionType = "Premium"
						}
					} else if (userData?.subscription?.planId === "premium") {
						subscriptionType = "Premium"
					}
				} catch (err) {
					console.error(
						`Error fetching subscription data for host ${hostId}:`,
						err
					)
				}

				hostsList.push({
					hostId,
					displayName:
						userData?.displayName ||
						(userData?.firstName && userData?.lastName
							? `${userData.firstName} ${userData.lastName}`
							: userData?.firstName || "Unknown Host"),
					email: userData?.email || "N/A",
					propertiesCount: hostData.properties.length,
					averageRating: Math.round(averageRating * 10) / 10,
					ratedPropertiesCount: hostData.ratedPropertiesCount,
					properties: hostData.properties,
					userData,
					subscriptionType,
				})
			}

			// Sort by average rating (descending) by default
			hostsList.sort((a, b) => b.averageRating - a.averageRating)

			setHosts(hostsList)
			setFilteredHosts(hostsList)
		} catch (err) {
			console.error("Error fetching hosts data:", err)
			toast.error("Failed to fetch hosts data")
		} finally {
			setLoading(false)
		}
	}

	const applyFiltersAndSearch = () => {
		let filtered = [...hosts]

		// Apply search filter
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase()
			filtered = filtered.filter(
				(host) =>
					host.displayName.toLowerCase().includes(query) ||
					host.email.toLowerCase().includes(query)
			)
		}

		// Apply rating filter
		if (filterRating !== "all") {
			filtered = filtered.filter((host) => {
				if (filterRating === "high") return host.averageRating >= 4.0
				if (filterRating === "medium")
					return host.averageRating >= 2.5 && host.averageRating < 4.0
				if (filterRating === "low") return host.averageRating < 2.5
				return true
			})
		}

		// Apply properties count filter
		if (filterProperties !== "all") {
			filtered = filtered.filter((host) => {
				if (filterProperties === "many") return host.propertiesCount >= 5
				if (filterProperties === "few") return host.propertiesCount < 5
				return true
			})
		}

		// Apply sorting
		filtered.sort((a, b) => {
			switch (sortBy) {
				case "rating":
					return b.averageRating - a.averageRating
				case "properties":
					return b.propertiesCount - a.propertiesCount
				case "name":
					return a.displayName.localeCompare(b.displayName)
				default:
					return 0
			}
		})

		setFilteredHosts(filtered)
		setCurrentPage(1) // Reset to first page when filters change
	}

	const clearFilters = () => {
		setSearchQuery("")
		setFilterRating("all")
		setFilterProperties("all")
		setSortBy("rating")
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

	return (
		<div className="admin-dashboard">
			<header className="admin-header">
				<div className="admin-header-content">
					<div className="admin-header-left">
						<button
							className="sidebar-toggle"
							onClick={() => setSidebarOpen(!sidebarOpen)}
						>
							<span className="hamburger-icon">{sidebarOpen ? "✕" : "☰"}</span>
						</button>
						<h1>👥 All Hosts</h1>
					</div>
					<div className="admin-user-info">
						<span>Welcome, {userData?.displayName || "Admin"}</span>
						<button onClick={handleLogout} className="logout-btn">
							Logout
						</button>
					</div>
				</div>
			</header>

			{/* Sidebar Navigation */}
			<aside className={`admin-sidebar ${sidebarOpen ? "open" : "closed"}`}>
				<nav className="sidebar-nav">
					<button
						className="sidebar-item"
						onClick={() => navigate("/admin")}
					>
						<span className="sidebar-icon">📊</span>
						<span className="sidebar-text">Dashboard</span>
					</button>
					<button
						className="sidebar-item active"
						onClick={() => navigate("/admin")}
					>
						<span className="sidebar-icon">👥</span>
						<span className="sidebar-text">Manage Host</span>
					</button>
					<button
						className="sidebar-item"
						onClick={() => navigate("/admin")}
					>
						<span className="sidebar-icon">🚩</span>
						<span className="sidebar-text">Flagging</span>
					</button>
					<button
						className="sidebar-item"
						onClick={() => navigate("/admin")}
					>
						<span className="sidebar-icon">📋</span>
						<span className="sidebar-text">Policies & Compliance</span>
					</button>
					<button
						className="sidebar-item"
						onClick={() => navigate("/admin")}
					>
						<span className="sidebar-icon">📜</span>
						<span className="sidebar-text">Terms & Conditions</span>
					</button>
					<button
						className="sidebar-item"
						onClick={() => navigate("/admin")}
					>
						<span className="sidebar-icon">🔒</span>
						<span className="sidebar-text">Privacy Policy</span>
					</button>
					<button
						className="sidebar-item"
						onClick={() => navigate("/admin")}
					>
						<span className="sidebar-icon">📄</span>
						<span className="sidebar-text">Generate Reports</span>
					</button>
					<button
						className="sidebar-item"
						onClick={() => navigate("/admin")}
					>
						<span className="sidebar-icon">🎁</span>
						<span className="sidebar-text">Promos</span>
					</button>
					<button
						className="sidebar-item"
						onClick={() => navigate("/admin")}
					>
						<span className="sidebar-icon">💰</span>
						<span className="sidebar-text">E-Wallet</span>
					</button>
				</nav>
			</aside>

			<main
				className={`admin-main ${
					sidebarOpen ? "sidebar-open" : "sidebar-closed"
				}`}
			>
				<div className="host-list-container">
					<div className="host-list-header">
						<div className="header-content">
							<h2>👥 All Hosts</h2>
							<p>Manage and view all hosts in the platform</p>
						</div>
					</div>

			{/* Search and Filter Section */}
			<div className="search-filter-section">
				<div className="search-bar">
					<FaSearch className="search-icon" />
					<input
						type="text"
						placeholder="Search by name or email..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="search-input"
					/>
					{searchQuery && (
						<button
							className="clear-search"
							onClick={() => setSearchQuery("")}
						>
							<FaTimes />
						</button>
					)}
				</div>

				<div className="filters-row">
					<div className="filter-group">
						<label>Filter by Rating:</label>
						<select
							value={filterRating}
							onChange={(e) => setFilterRating(e.target.value)}
							className="filter-select"
						>
							<option value="all">All Ratings</option>
							<option value="high">High (4.0+)</option>
							<option value="medium">Medium (2.5-3.9)</option>
							<option value="low">Low (&lt;2.5)</option>
						</select>
					</div>

					<div className="filter-group">
						<label>Filter by Properties:</label>
						<select
							value={filterProperties}
							onChange={(e) => setFilterProperties(e.target.value)}
							className="filter-select"
						>
							<option value="all">All</option>
							<option value="many">Many (5+)</option>
							<option value="few">Few (&lt;5)</option>
						</select>
					</div>

					<div className="filter-group">
						<label>Sort By:</label>
						<select
							value={sortBy}
							onChange={(e) => setSortBy(e.target.value)}
							className="filter-select"
						>
							<option value="rating">Rating</option>
							<option value="properties">Properties Count</option>
							<option value="name">Name</option>
						</select>
					</div>

					<button className="clear-filters-btn" onClick={clearFilters}>
						Clear Filters
					</button>
				</div>

				<div className="results-count">
					Showing {filteredHosts.length} of {hosts.length} hosts
					{filteredHosts.length > hostsPerPage && (
						<span className="pagination-info">
							{" "}
							(Page {currentPage} of {Math.ceil(filteredHosts.length / hostsPerPage)})
						</span>
					)}
				</div>
			</div>

			{/* Hosts Table */}
			{loading ? (
				<div className="loading-state">
					<p>Loading hosts data...</p>
				</div>
			) : filteredHosts.length === 0 ? (
				<div className="empty-state">
					<div className="empty-icon">👥</div>
					<p>No hosts found</p>
					<p className="empty-subtitle">
						{searchQuery || filterRating !== "all" || filterProperties !== "all"
							? "Try adjusting your search or filters"
							: "Hosts will appear here once they list properties"}
					</p>
				</div>
			) : (
				<>
					<div className="hosts-table-wrapper">
						<table className="hosts-table">
							<thead>
								<tr>
									<th>Host Name</th>
									<th>Email</th>
									<th>Average Rating</th>
									<th>Properties</th>
									<th>Rated Properties</th>
									<th>Subscription</th>
									<th>Actions</th>
								</tr>
							</thead>
							<tbody>
								{filteredHosts
									.slice(
										(currentPage - 1) * hostsPerPage,
										currentPage * hostsPerPage
									)
									.map((host) => (
										<tr key={host.hostId}>
											<td>
												<strong>{host.displayName}</strong>
											</td>
											<td>{host.email}</td>
											<td>
												<div className="rating-display">
													<span className="rating-value">
														{host.averageRating > 0
															? host.averageRating.toFixed(1)
															: "N/A"}
													</span>
													{host.averageRating > 0 && (
														<span className="rating-stars">
															{"⭐".repeat(Math.floor(host.averageRating))}
														</span>
													)}
												</div>
											</td>
											<td>{host.propertiesCount}</td>
											<td>{host.ratedPropertiesCount}</td>
											<td>
												<span
													className={`subscription-badge ${
														host.subscriptionType === "Premium"
															? "premium"
															: "free"
													}`}
												>
													{host.subscriptionType}
												</span>
											</td>
											<td>
												<button
													className="btn-view-details"
													onClick={() => {
														setSelectedHost(host)
														setShowHostModal(true)
													}}
												>
													View Details
												</button>
											</td>
										</tr>
									))}
							</tbody>
						</table>
					</div>

					{/* Pagination */}
					{filteredHosts.length > hostsPerPage && (
						<div className="pagination">
							<button
								className="pagination-btn"
								onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
								disabled={currentPage === 1}
							>
								Previous
							</button>
							<div className="pagination-pages">
								{Array.from({
									length: Math.ceil(filteredHosts.length / hostsPerPage),
								}).map((_, index) => {
									const pageNumber = index + 1
									// Show first page, last page, current page, and pages around current
									if (
										pageNumber === 1 ||
										pageNumber ===
											Math.ceil(filteredHosts.length / hostsPerPage) ||
										(pageNumber >= currentPage - 1 &&
											pageNumber <= currentPage + 1)
									) {
										return (
											<button
												key={pageNumber}
												className={`pagination-page ${
													currentPage === pageNumber ? "active" : ""
												}`}
												onClick={() => setCurrentPage(pageNumber)}
											>
												{pageNumber}
											</button>
										)
									} else if (
										pageNumber === currentPage - 2 ||
										pageNumber === currentPage + 2
									) {
										return (
											<span key={pageNumber} className="pagination-ellipsis">
												...
											</span>
										)
									}
									return null
								})}
							</div>
							<button
								className="pagination-btn"
								onClick={() =>
									setCurrentPage((prev) =>
										Math.min(
											prev + 1,
											Math.ceil(filteredHosts.length / hostsPerPage)
										)
									)
								}
								disabled={
									currentPage === Math.ceil(filteredHosts.length / hostsPerPage)
								}
							>
								Next
							</button>
						</div>
					)}
				</>
			)}

			{/* Host Details Modal */}
			{showHostModal && selectedHost && (
				<HostDetailsModal
					host={selectedHost}
					onClose={() => {
						setShowHostModal(false)
						setSelectedHost(null)
						setHostSubscriptionData(null)
					}}
					onRefresh={fetchHostsData}
				/>
			)}
			{false && showHostModal && selectedHost && (
				<div
					className="modal-overlay"
					onClick={() => {
						setShowHostModal(false)
						setSelectedHost(null)
					}}
				>
					<div
						className="host-details-modal"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="modal-header">
							<h2>👤 Host Details</h2>
							<button
								className="modal-close-btn"
								onClick={() => {
									setShowHostModal(false)
									setSelectedHost(null)
								}}
							>
								<FaTimes />
							</button>
						</div>

						<div className="modal-body host-details-content">
							<div className="host-details-section">
								<h3>Rating Information</h3>
								<div className="detail-grid">
									<div className="detail-item">
										<label>Average Rating:</label>
										<div className="rating-display-large">
											<span className="rating-value-large">
												{selectedHost.averageRating > 0
													? selectedHost.averageRating.toFixed(1)
													: "N/A"}
											</span>
											{selectedHost.averageRating > 0 && (
												<span className="rating-stars-large">
													{"⭐".repeat(
														Math.floor(selectedHost.averageRating)
													)}
												</span>
											)}
										</div>
									</div>
									<div className="detail-item">
										<label>Total Properties:</label>
										<span>{selectedHost.propertiesCount}</span>
									</div>
									<div className="detail-item">
										<label>Rated Properties:</label>
										<span>{selectedHost.ratedPropertiesCount}</span>
									</div>
								</div>
							</div>

							<div className="host-details-section">
								<h3>Properties List</h3>
								{selectedHost.properties.length === 0 ? (
									<p className="no-properties">No properties listed</p>
								) : (
									(() => {
										// Find top property (highest rating)
										const topProperty = selectedHost.properties.reduce(
											(top, current) => {
												const topRating = top.rating || 0
												const currentRating = current.rating || 0
												return currentRating > topRating ? current : top
											},
											selectedHost.properties[0]
										)

										// Find lowest rating property
										const lowestProperty = selectedHost.properties.reduce(
											(lowest, current) => {
												const lowestRating = lowest.rating || 0
												const currentRating = current.rating || 0
												if (lowestRating === 0 && currentRating > 0)
													return current
												if (currentRating === 0 && lowestRating > 0)
													return lowest
												return currentRating < lowestRating ? current : lowest
											},
											selectedHost.properties[0]
										)

										const displayProperties = []
										if (topProperty)
											displayProperties.push({
												...topProperty,
												label: "Top Property",
											})
										if (
											lowestProperty &&
											lowestProperty.id !== topProperty?.id
										) {
											displayProperties.push({
												...lowestProperty,
												label: "Lowest Rating",
											})
										}

										return (
											<div className="properties-list">
												{displayProperties.map((property) => (
													<div key={property.id} className="property-item">
														<div className="property-image-container">
															<img
																src={
																	property.images?.[0] ||
																	housePlaceholder
																}
																alt={property.title || "Property"}
																className="property-image"
															/>
														</div>
														<div className="property-header">
															<div>
																<span className="property-label">
																	{property.label}
																</span>
																<h4>
																	{property.title || "Untitled Property"}
																</h4>
															</div>
															<span className="property-rating">
																{property.rating > 0
																	? `${property.rating.toFixed(1)} ⭐`
																	: "No rating"}
															</span>
														</div>
														<div className="property-details">
															{property.location?.city && (
																<span className="property-location">
																	📍 {property.location.city}
																	{property.location.province &&
																		`, ${property.location.province}`}
																</span>
															)}
															{property.pricing?.basePrice && (
																<span className="property-price">
																	{formatCurrencyFull(property.pricing.basePrice)}/night
																</span>
															)}
															{property.category && (
																<span className="host-property-category-badge">
																	{property.category}
																</span>
															)}
														</div>
														{property.reviewsCount !== undefined && (
															<div className="property-reviews">
																{property.reviewsCount} review
																{property.reviewsCount !== 1 ? "s" : ""}
															</div>
														)}
													</div>
												))}
											</div>
										)
									})()
								)}
							</div>

							{selectedHost.userData && (
								<div className="host-details-section">
									<h3>Account Information</h3>
									<div className="detail-grid">
										{selectedHost.userData.firstName && (
											<div className="detail-item">
												<label>First Name:</label>
												<span>{selectedHost.userData.firstName}</span>
											</div>
										)}
										{selectedHost.userData.lastName && (
											<div className="detail-item">
												<label>Last Name:</label>
												<span>{selectedHost.userData.lastName}</span>
											</div>
										)}
										{selectedHost.userData.createdAt && (
											<div className="detail-item">
												<label>Member Since:</label>
												<span>
													{selectedHost.userData.createdAt?.toDate
														? selectedHost.userData.createdAt
																.toDate()
																.toLocaleDateString()
														: new Date(
																selectedHost.userData.createdAt
														  ).toLocaleDateString()}
												</span>
											</div>
										)}
										<div className="detail-item">
											<label>Host ID:</label>
											<span className="host-id">{selectedHost.hostId}</span>
										</div>
										{selectedHost.userData.userType && (
											<div className="detail-item">
												<label>User Type:</label>
												<span className="user-type-badge">
													{selectedHost.userData.userType}
												</span>
											</div>
										)}
										<div className="detail-item">
											<label>Subscription Type:</label>
											<span
												className={`subscription-badge ${
													selectedHost.subscriptionType?.toLowerCase() ||
													"free"
												}`}
											>
												{selectedHost.subscriptionType || "Free"}
											</span>
										</div>
									</div>
								</div>
							)}
						</div>

						<div className="modal-footer">
							<button
								className="btn-close-modal"
								onClick={() => {
									setShowHostModal(false)
									setSelectedHost(null)
								}}
							>
								Close
							</button>
						</div>
					</div>
				</div>
			)}
				</div>
			</main>
		</div>
	)
}

