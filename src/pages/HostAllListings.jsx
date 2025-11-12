import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import { db } from "../components/firebaseConfig"
import { collection, getDocs, query, where } from "firebase/firestore"
import {
	FaArrowLeft,
	FaHome,
	FaMapMarkerAlt,
	FaStar,
	FaUsers,
	FaEdit,
	FaTrash,
} from "react-icons/fa"
import housePlaceholder from "../assets/housePlaceholder.png"
import "../css/DashboardHost.css"
import "../css/DashboardGuest.css"

export default function HostAllListings() {
	const navigate = useNavigate()
	const location = useLocation()
	const { currentUser } = useAuth()
	const [properties, setProperties] = useState([])
	const [loading, setLoading] = useState(true)
	const [activeCategory, setActiveCategory] = useState("all")

	useEffect(() => {
		if (currentUser) {
			fetchProperties()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentUser])

	// Set category from navigation state if provided
	useEffect(() => {
		if (location.state?.category) {
			setActiveCategory(location.state.category)
		}
	}, [location.state])

	const fetchProperties = async () => {
		if (!currentUser?.uid) return
		try {
			setLoading(true)
			const propertiesQuery = query(
				collection(db, "properties"),
				where("hostId", "==", currentUser.uid)
			)
			const snapshot = await getDocs(propertiesQuery)
			const propertiesList = snapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			}))
			setProperties(propertiesList)
		} catch (error) {
			console.error("Error fetching properties:", error)
		} finally {
			setLoading(false)
		}
	}

	const filteredProperties =
		activeCategory === "all"
			? properties
			: properties.filter((p) => p.category === activeCategory)

	const formatPrice = (price, currency = "PHP") => {
		if (currency === "PHP") {
			return `₱${price.toLocaleString()}`
		}
		return `$${price.toLocaleString()}`
	}

	const getPropertyTypeName = (property) => {
		if (property.propertyType) {
			return property.propertyType
				.split("_")
				.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
				.join(" ")
		}
		return property.category || "Property"
	}

	return (
		<div className="dashboard-container">
			<div className="dashboard-header">
				<h1>All My Listings</h1>
			</div>

			<div className="dashboard-content">
				{/* Category Tabs */}
				<div className="category-tabs">
					<button
						className={`category-tab ${activeCategory === "all" ? "active" : ""}`}
						onClick={() => setActiveCategory("all")}
					>
						<span className="tab-icon">🏠</span>
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

				{/* Listings Grid */}
				{loading ? (
					<div className="loading-container">
						<div className="loading-spinner"></div>
						<p>Loading listings...</p>
					</div>
				) : filteredProperties.length === 0 ? (
					<div className="no-results">
						<p>
							No properties found in{" "}
							{activeCategory === "home"
								? "Homes"
								: activeCategory === "service"
								? "Services"
								: activeCategory === "experience"
								? "Experiences"
								: "this category"}
							.
						</p>
					</div>
				) : (
					<div className="listings-grid">
						{filteredProperties.map((property) => (
							<div key={property.id} className="listing-card">
								<div
									className="listing-image"
									style={{
										backgroundImage: `url(${
											property.images?.[0] || housePlaceholder
										})`,
									}}
									onClick={() => navigate(`/property/${property.id}`)}
								>
									{property.featured && (
										<span className="listing-badge">Featured</span>
									)}
								</div>
								<div className="listing-content">
									<div className="listing-header">
										<h3 className="listing-title">{property.title}</h3>
										<div className="listing-rating">
											<span className="star">⭐</span>
											<span className="rating-text">
												{property.rating || 0}
											</span>
											<span className="reviews-count">
												({property.reviewsCount || 0})
											</span>
										</div>
									</div>
									<div className="listing-location">
										<FaMapMarkerAlt className="location-icon" />
										<span>
											{property.location?.city},{" "}
											{property.location?.province}
										</span>
									</div>

									<div className="listing-type">
										<span className="type-badge">
											{getPropertyTypeName(property)}
										</span>
									</div>

									{property.category === "home" && property.capacity && (
										<div className="listing-details">
											{property.capacity.bedrooms > 0 && (
												<div className="detail-item">
													<span className="listing-icon">🚪</span>
													<span className="detail-text">
														{property.capacity.bedrooms}{" "}
														{property.capacity.bedrooms === 1
															? "bedroom"
															: "bedrooms"}
													</span>
												</div>
											)}
											<div className="detail-item">
												<span className="listing-icon">🛏️</span>
												<span className="detail-text">
													{property.capacity.beds || 0}{" "}
													{property.capacity.beds === 1 ? "bed" : "beds"}
												</span>
											</div>
											<div className="detail-item">
												<span className="listing-icon">🛁</span>
												<span className="detail-text">
													{property.capacity.bathrooms || 0}{" "}
													{property.capacity.bathrooms === 1
														? "bath"
														: "baths"}
												</span>
											</div>
											<div className="detail-item">
												<span className="listing-icon">👥</span>
												<span className="detail-text">
													{property.capacity.guests || 0}{" "}
													{property.capacity.guests === 1 ? "guest" : "guests"}
												</span>
											</div>
										</div>
									)}

									{property.category === "experience" && property.duration && (
										<div className="listing-details">
											<div className="detail-item">
												<span className="listing-icon">⏰</span>
												<span className="detail-text">
													{property.duration.hours}h
												</span>
											</div>
											<div className="detail-item">
												<span className="listing-icon">👥</span>
												<span className="detail-text">
													{property.capacity?.minGuests ||
														property.capacity?.guests ||
														0}
													-
													{property.capacity?.maxGuests ||
														property.capacity?.guests ||
														0}{" "}
													{property.capacity?.maxGuests === 1
														? "guest"
														: "guests"}
												</span>
											</div>
										</div>
									)}

									{property.category === "service" && (
										<div className="listing-details">
											<div className="detail-item">
												<span className="listing-icon">📍</span>
												<span className="detail-text">
													{property.location?.serviceable
														? "Multiple Locations"
														: property.location?.city || "Location"}
												</span>
											</div>
										</div>
									)}

									<div className="listing-footer">
										<div className="listing-price">
											<span className="listing-price-amount">
												{formatPrice(
													property.pricing?.basePrice ||
														property.pricing?.price ||
														0,
													property.pricing?.currency
												)}
											</span>
											<span className="price-period">
												{property.category === "home"
													? "/ night"
													: property.category === "experience"
													? "/ person"
													: ""}
											</span>
										</div>
										<div className="listing-actions">
											<button
												className="view-btn"
												onClick={() => navigate(`/property/${property.id}`)}
											>
												View Details
											</button>
										</div>
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	)
}



