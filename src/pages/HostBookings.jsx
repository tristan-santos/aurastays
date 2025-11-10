import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import { db } from "../components/firebaseConfig"
import {
	collection,
	getDocs,
	query,
	where,
} from "firebase/firestore"
import { FaCalendarAlt, FaHome, FaUsers } from "react-icons/fa"
import { toast } from "react-stacked-toast"
import "../css/DashboardHost.css"
import housePlaceholder from "../assets/housePlaceholder.png"

export default function HostBookings() {
	const { currentUser } = useAuth()
	const navigate = useNavigate()
	const [loading, setLoading] = useState(true)
	const [properties, setProperties] = useState([])
	const [bookingsByPropertyId, setBookingsByPropertyId] = useState({})
	const [activeCategory, setActiveCategory] = useState("all")

	useEffect(() => {
		if (!currentUser?.uid) return
		loadData()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentUser])

	const loadData = async () => {
		setLoading(true)
		try {
			// 1) Fetch all properties for this host
			const propertiesRef = collection(db, "properties")
			const propertiesQuery = query(
				propertiesRef,
				where("hostId", "==", currentUser.uid)
			)
			const propertiesSnapshot = await getDocs(propertiesQuery)
			const props = propertiesSnapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			}))
			setProperties(props)

			// 2) Fetch bookings for each property (batch by propertyId)
			const bookingsRef = collection(db, "bookings")
			const results = {}
			// Query by hostId to avoid 'in' limitations if many properties
			const bookingsQuery = query(
				bookingsRef,
				where("hostId", "==", currentUser.uid)
			)
			const bookingsSnapshot = await getDocs(bookingsQuery)
			const bookings = bookingsSnapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			}))
			for (const b of bookings) {
				if (!results[b.propertyId]) results[b.propertyId] = []
				results[b.propertyId].push(b)
			}
			// Sort bookings per property by check-in date ascending
			Object.keys(results).forEach((pid) => {
				results[pid].sort((a, b) => {
					return new Date(a.checkInDate) - new Date(b.checkInDate)
				})
			})
			setBookingsByPropertyId(results)
		} catch (e) {
			console.error("Error loading host bookings:", e)
			toast.error("Failed to load bookings")
		} finally {
			setLoading(false)
		}
	}

	const formatDate = (d) => {
		const date = new Date(d)
		return date.toLocaleDateString()
	}

	const filteredProperties =
		activeCategory === "all"
			? properties
			: properties.filter((p) => p.category === activeCategory)

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
			<header className="host-dashboard-header">
				<div className="host-header-inner">
					<div className="host-dashboard-title">
						<FaCalendarAlt style={{ marginRight: "8px" }} />
						<span className="logo-text">Bookings</span>
					</div>
					<div className="host-header-buttons">
						<button className="host-icon-button" onClick={() => navigate("/dashboardHost")}>
							← Back
						</button>
					</div>
				</div>
			</header>

			<main className="dashboard-main">
				<section className="categories-section">
					<h2>Your Properties and Bookings</h2>
					<p className="section-subtitle">
						View all bookings grouped by your properties
					</p>

					<div className="category-tabs">
						<button
							className={`category-tab ${activeCategory === "all" ? "active" : ""}`}
							onClick={() => setActiveCategory("all")}
						>
							<span className="tab-icon">🌟</span>
							<span className="tab-label">All</span>
						</button>
						<button
							className={`category-tab ${activeCategory === "home" ? "active" : ""}`}
							onClick={() => setActiveCategory("home")}
						>
							<span className="tab-icon">🏠</span>
							<span className="tab-label">Homes</span>
						</button>
						<button
							className={`category-tab ${activeCategory === "service" ? "active" : ""}`}
							onClick={() => setActiveCategory("service")}
						>
							<span className="tab-icon">🛎️</span>
							<span className="tab-label">Services</span>
						</button>
						<button
							className={`category-tab ${activeCategory === "experience" ? "active" : ""}`}
							onClick={() => setActiveCategory("experience")}
						>
							<span className="tab-icon">✨</span>
							<span className="tab-label">Experiences</span>
						</button>
					</div>

					{filteredProperties.length === 0 ? (
						<div className="no-results">
							<p>No properties found.</p>
							<div className="no-results-actions">
								<button
									className="category-create-btn"
									onClick={() => navigate("/host/list-property")}
								>
									<FaHome />
									<span>Create Listing</span>
								</button>
							</div>
						</div>
					) : (
						<div className="listings-grid">
							{filteredProperties.map((property) => {
								const bookings = bookingsByPropertyId[property.id] || []
								return (
									<div key={property.id} className="listing-card">
										<div
											className="listing-image"
											style={{
												backgroundImage: `url(${property.images?.[0] || housePlaceholder})`,
											}}
											onClick={() => navigate(`/property/${property.id}`)}
											title="View property"
										>
											<span className="listing-badge">
												{property.category?.toUpperCase() || "LISTING"}
											</span>
										</div>
										<div className="listing-content">
											<div className="listing-header">
												<h3 className="listing-title">{property.title || "Untitled"}</h3>
												<div className="listing-rating">
													<span className="star">⭐</span>
													<span className="rating-text">{property.rating || 0}</span>
													<span className="reviews-count">
														({property.reviewsCount || 0})
													</span>
												</div>
											</div>
											<div className="listing-type" style={{ marginBottom: "0.5rem" }}>
												<span className="type-badge">
													{property.propertyType || property.type || "Listing"}
												</span>
											</div>

											{bookings.length === 0 ? (
												<div className="host-empty-message" style={{ padding: "0.75rem 0" }}>
													<p>No bookings yet for this property.</p>
												</div>
											) : (
												<div style={{ textAlign: "right", marginTop: "0.5rem" }}>
													<button
														className="view-property-btn"
														onClick={() => navigate(`/propertyBookings/${property.id}`)}
													>
														View all bookings
													</button>
												</div>
											)}
										</div>
									</div>
								)
							})}
						</div>
					)}
				</section>
			</main>
		</div>
	)
}


