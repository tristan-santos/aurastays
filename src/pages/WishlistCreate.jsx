import { useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { doc, getDoc, updateDoc, arrayUnion } from "firebase/firestore"
import { db } from "../components/firebaseConfig"
import { useAuth } from "../contexts/AuthContext"
import { toast } from "react-stacked-toast"
import "../css/WishlistCreate.css"
import {
	FaBookmark,
	FaBed,
	FaBath,
	FaHome,
	FaUsers,
	FaParking,
	FaWifi,
	FaUtensils,
	FaStickyNote,
	FaArrowLeft,
	FaMapMarkerAlt,
	FaStar,
	FaEye,
} from "react-icons/fa"
import housePlaceholder from "../assets/housePlaceholder.png"

export default function WishlistCreate() {
	const navigate = useNavigate()
	const location = useLocation()
	const { currentUser } = useAuth()

	const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search])
	const propertyId = searchParams.get("propertyId") || location.state?.propertyId || ""

	const [property, setProperty] = useState(null)
	const [isLoading, setIsLoading] = useState(false)

	// Form fields (amenities, offers, etc.)
	const [beds, setBeds] = useState("")
	const [bathrooms, setBathrooms] = useState("")
	const [bedrooms, setBedrooms] = useState("")
	const [guests, setGuests] = useState("")
	const [parkingSpaces, setParkingSpaces] = useState("")
	const [wifiSpeed, setWifiSpeed] = useState("")
	const [breakfastIncluded, setBreakfastIncluded] = useState(false)
	const [notes, setNotes] = useState("")
	const [wishlistCreated, setWishlistCreated] = useState(false)
	const [createdWishlist, setCreatedWishlist] = useState(null)
	const [showWishlistModal, setShowWishlistModal] = useState(false)

	const formatPrice = (price, currency = "PHP") => {
		if (currency === "PHP") {
			return `₱${price.toLocaleString()}`
		}
		return `$${price.toLocaleString()}`
	}

	useEffect(() => {
		const loadProperty = async () => {
			if (!propertyId) return
			try {
				const snap = await getDoc(doc(db, "properties", propertyId))
				if (snap.exists()) setProperty({ id: snap.id, ...snap.data() })
			} catch (e) {
				console.error("Error loading property:", e)
			}
		}
		loadProperty()
	}, [propertyId])

	// Auto-fill form inputs based on property data
	useEffect(() => {
		if (!property) return

		// Auto-fill capacity fields
		if (property.capacity) {
			if (property.capacity.beds) setBeds(property.capacity.beds.toString())
			if (property.capacity.bathrooms) setBathrooms(property.capacity.bathrooms.toString())
			if (property.capacity.bedrooms) setBedrooms(property.capacity.bedrooms.toString())
			if (property.capacity.guests) setGuests(property.capacity.guests.toString())
			else if (property.capacity.maxGuests) setGuests(property.capacity.maxGuests.toString())
		}

		// Auto-fill amenities
		if (property.amenities) {
			if (property.amenities.parkingSpaces) setParkingSpaces(property.amenities.parkingSpaces.toString())
			if (property.amenities.wifiSpeed) setWifiSpeed(property.amenities.wifiSpeed.toString())
		}

		// Auto-fill offers
		if (property.offers) {
			if (property.offers.breakfastIncluded !== undefined) setBreakfastIncluded(property.offers.breakfastIncluded)
			// If wifi is available as an offer, set default to 25 mbps
			if (property.offers.wifi !== undefined && property.offers.wifi === true) {
				setWifiSpeed("25")
			}
		}
	}, [property])

	// Check if wishlist already exists
	useEffect(() => {
		const checkExistingWishlist = async () => {
			if (!currentUser?.uid || !propertyId) return
			try {
				const userRef = doc(db, "users", currentUser.uid)
				const userSnap = await getDoc(userRef)
				if (userSnap.exists()) {
					const data = userSnap.data()
					const wishes = Array.isArray(data.wishes) ? data.wishes : []
					const existingWish = wishes.find((w) => w.propertyId === propertyId)
					if (existingWish) {
						// Check if wishlist is created (isCreated flag)
						const isCreated = existingWish.isCreated === true
						setWishlistCreated(isCreated)
						setCreatedWishlist(existingWish)
						// Auto-fill form with existing wishlist
						if (existingWish.beds !== undefined) setBeds(existingWish.beds.toString())
						if (existingWish.bathrooms !== undefined) setBathrooms(existingWish.bathrooms.toString())
						if (existingWish.bedrooms !== undefined) setBedrooms(existingWish.bedrooms.toString())
						if (existingWish.guests !== undefined) setGuests(existingWish.guests.toString())
						if (existingWish.parkingSpaces !== undefined) setParkingSpaces(existingWish.parkingSpaces.toString())
						if (existingWish.wifiSpeed !== undefined) setWifiSpeed(existingWish.wifiSpeed.toString())
						if (existingWish.breakfastIncluded !== undefined) setBreakfastIncluded(existingWish.breakfastIncluded)
						if (existingWish.notes !== undefined) setNotes(existingWish.notes)
					} else {
						// No existing wishlist, set default isCreated to false
						setWishlistCreated(false)
					}
				} else {
					// No user document, set default isCreated to false
					setWishlistCreated(false)
				}
			} catch (e) {
				console.error("Error checking existing wishlist:", e)
			}
		}
		checkExistingWishlist()
	}, [currentUser, propertyId])

	const handleSubmit = async (e) => {
		e.preventDefault()
		if (!currentUser?.uid) {
			toast.error("Please login to create a wishlist")
			return
		}
		if (!propertyId) {
			toast.error("Missing property context")
			return
		}
		try {
			setIsLoading(true)
			const userRef = doc(db, "users", currentUser.uid)
			const userSnap = await getDoc(userRef)
			const entry = {
				propertyId,
				beds: Number(beds) || 0,
				bathrooms: Number(bathrooms) || 0,
				bedrooms: Number(bedrooms) || 0,
				guests: Number(guests) || 0,
				parkingSpaces: Number(parkingSpaces) || 0,
				wifiSpeed: Number(wifiSpeed) || 0,
				breakfastIncluded: Boolean(breakfastIncluded),
				notes: notes.trim(),
				isCreated: true,
				updatedAt: new Date().toISOString(),
			}

			let wishes = []
			if (userSnap.exists()) {
				const data = userSnap.data()
				wishes = Array.isArray(data.wishes) ? data.wishes : []
			}

			// Check if wishlist already exists
			const existingIndex = wishes.findIndex((w) => w.propertyId === propertyId)
			if (existingIndex !== -1) {
				// Update existing wishlist
				wishes[existingIndex] = {
					...wishes[existingIndex],
					...entry,
					createdAt: wishes[existingIndex].createdAt || new Date().toISOString(),
					isCreated: true,
				}
				entry.createdAt = wishes[existingIndex].createdAt
				entry.isCreated = true
			} else {
				// Create new wishlist
				entry.createdAt = new Date().toISOString()
				wishes.push(entry)
			}

			await updateDoc(userRef, { wishes })
			setCreatedWishlist(entry)
			setWishlistCreated(true)
			toast.success("Wishlist created successfully!")
			setShowWishlistModal(true)
		} catch (e) {
			console.error("Error creating wishlist:", e)
			toast.error("Failed to create wishlist")
		} finally {
			setIsLoading(false)
		}
	}

	return (
		<div className="wishlist-create-container">
			<div className="wishlist-create-wrapper">
				{/* Header */}
				<div className="wishlist-create-header">
					<h1>
						<FaBookmark style={{ color: "var(--primary)" }} /> Create Wishlist
					</h1>
				</div>

				{/* Property Info Card */}
				{property && (
					<div className="property-info-card">
						<div className="property-info-image">
							<img
								src={property.images?.[0] || housePlaceholder}
								alt={property.title}
							/>
						</div>
						<div className="property-info-details">
							<h3>{property.title || "Property"}</h3>
							{property.location && (
								<div className="property-location">
									<FaMapMarkerAlt />
									<span>
										{property.location.city}, {property.location.province}
										{property.location.country && `, ${property.location.country}`}
									</span>
								</div>
							)}
							<div className="property-meta">
								{property.rating && (
									<div className="property-rating">
										<FaStar style={{ color: "#f59e0b" }} />
										<span>{property.rating}</span>
										{property.reviewsCount > 0 && (
											<span className="reviews-count">({property.reviewsCount} reviews)</span>
										)}
									</div>
								)}
								{property.pricing && (
									<div className="property-price">
										<span className="wishlist-price-amount">
											{formatPrice(
												property.pricing.basePrice || property.pricing.price || 0,
												property.pricing.currency
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
								)}
							</div>
							{property.capacity && (
								<div className="property-amenities">
									{property.capacity.beds > 0 && (
										<div className="amenity-item">
											<FaBed /> {property.capacity.beds} bed{property.capacity.beds > 1 ? "s" : ""}
										</div>
									)}
									{property.capacity.bathrooms > 0 && (
										<div className="amenity-item">
											<FaBath /> {property.capacity.bathrooms} bath{property.capacity.bathrooms > 1 ? "s" : ""}
										</div>
									)}
									{(property.capacity.guests || property.capacity.maxGuests) && (
										<div className="amenity-item">
											<FaUsers /> {(property.capacity.guests || property.capacity.maxGuests)} guest
											{(property.capacity.guests || property.capacity.maxGuests) > 1 ? "s" : ""}
										</div>
									)}
								</div>
							)}
							<button
								className="view-property-btn"
								onClick={() => navigate(`/property/${property.id}`)}
							>
								<FaEye /> View Property
							</button>
						</div>
					</div>
				)}

				{/* Form */}
				<form onSubmit={handleSubmit} className="wishlist-create-form">
					{/* Amenities Section */}
					<div className="form-section">
						<h2 className="form-section-title">
							<span className="section-icon">🏠</span> Amenities
						</h2>
						<div className="amenities-grid">
							<div className="form-group">
								<label>
									<FaBed className="label-icon" /> Beds
								</label>
								<input
									type="number"
									min="0"
									placeholder="0"
									value={beds}
									onChange={(e) => setBeds(e.target.value)}
								/>
							</div>
							<div className="form-group">
								<label>
									<FaBath className="label-icon" /> Bathrooms
								</label>
								<input
									type="number"
									min="0"
									placeholder="0"
									value={bathrooms}
									onChange={(e) => setBathrooms(e.target.value)}
								/>
							</div>
							<div className="form-group">
								<label>
									<FaHome className="label-icon" /> Bedrooms
								</label>
								<input
									type="number"
									min="0"
									placeholder="0"
									value={bedrooms}
									onChange={(e) => setBedrooms(e.target.value)}
								/>
							</div>
							<div className="form-group">
								<label>
									<FaUsers className="label-icon" /> Guests
								</label>
								<input
									type="number"
									min="0"
									placeholder="0"
									value={guests}
									onChange={(e) => setGuests(e.target.value)}
								/>
							</div>
							<div className="form-group">
								<label>
									<FaParking className="label-icon" /> Parking Spaces
								</label>
								<input
									type="number"
									min="0"
									placeholder="0"
									value={parkingSpaces}
									onChange={(e) => setParkingSpaces(e.target.value)}
								/>
							</div>
							<div className="form-group">
								<label>
									<FaWifi className="label-icon" /> Wi‑Fi Speed (Mbps)
								</label>
								<input
									type="number"
									min="0"
									placeholder="0"
									value={wifiSpeed}
									onChange={(e) => setWifiSpeed(e.target.value)}
								/>
							</div>
						</div>
					</div>

					{/* Offers Section */}
					<div className="form-section">
						<h2 className="form-section-title">
							<span className="section-icon">✨</span> Offers & Services
						</h2>
						<div className="checkbox-group">
							<label className="checkbox-item">
								<input
									type="checkbox"
									checked={breakfastIncluded}
									onChange={(e) => setBreakfastIncluded(e.target.checked)}
								/>
								<span>
									<FaUtensils className="checkbox-icon" />
									Breakfast Included
								</span>
							</label>
						</div>
					</div>

					{/* Notes Section */}
					<div className="form-section">
						<h2 className="form-section-title">
							<span className="section-icon">
								<FaStickyNote />
							</span>{" "}
							Additional Notes
						</h2>
						<div className="form-group">
							<textarea
								rows={4}
								placeholder="Share any additional wishes or preferences for this property..."
								value={notes}
								onChange={(e) => setNotes(e.target.value)}
							/>
						</div>
					</div>

					{/* Actions */}
					<div className="form-actions">
						{wishlistCreated && createdWishlist ? (
							<button
								type="button"
								onClick={() => setShowWishlistModal(true)}
								className="btn-submit"
							>
								<FaBookmark /> View Wishlist
							</button>
						) : (
							<button type="submit" disabled={isLoading} className="btn-submit">
								{isLoading ? "Creating..." : "Create Wishlist"}
							</button>
						)}
					</div>
				</form>

				{/* View Wishlist Modal */}
				{showWishlistModal && createdWishlist && property && (
					<div
						className="wishlist-view-modal-overlay"
						onClick={() => setShowWishlistModal(false)}
					>
						<div
							className="wishlist-view-modal-content"
							onClick={(e) => e.stopPropagation()}
						>
							<div className="wishlist-modal-header">
								<h2>
									<FaBookmark style={{ color: "var(--primary)" }} /> My Wishlist
								</h2>
								<button
									className="close-modal-btn"
									onClick={() => setShowWishlistModal(false)}
								>
									×
								</button>
							</div>

							<div className="wishlist-view-body">
								{/* Property Info */}
								<div className="wishlist-property-header">
									<img
										src={property.images?.[0] || housePlaceholder}
										alt={property.title}
										className="wishlist-property-image"
									/>
									<div className="wishlist-property-info">
										<h3>{property.title}</h3>
										{property.location && (
											<div className="wishlist-location">
												<FaMapMarkerAlt />
												<span>
													{property.location.city}, {property.location.province}
												</span>
											</div>
										)}
									</div>
								</div>

								{/* Wishlist Details */}
								<div className="wishlist-details-section">
									<h4>Your Wishes</h4>
									<div className="wishlist-details-grid">
										{createdWishlist.beds > 0 && (
											<div className="wishlist-detail-item">
												<FaBed className="detail-icon" />
												<div>
													<span className="detail-label">Beds</span>
													<span className="detail-value">{createdWishlist.beds}</span>
												</div>
											</div>
										)}
										{createdWishlist.bathrooms > 0 && (
											<div className="wishlist-detail-item">
												<FaBath className="detail-icon" />
												<div>
													<span className="detail-label">Bathrooms</span>
													<span className="detail-value">{createdWishlist.bathrooms}</span>
												</div>
											</div>
										)}
										{createdWishlist.bedrooms > 0 && (
											<div className="wishlist-detail-item">
												<FaHome className="detail-icon" />
												<div>
													<span className="detail-label">Bedrooms</span>
													<span className="detail-value">{createdWishlist.bedrooms}</span>
												</div>
											</div>
										)}
										{createdWishlist.guests > 0 && (
											<div className="wishlist-detail-item">
												<FaUsers className="detail-icon" />
												<div>
													<span className="detail-label">Guests</span>
													<span className="detail-value">{createdWishlist.guests}</span>
												</div>
											</div>
										)}
										{createdWishlist.parkingSpaces !== undefined && createdWishlist.parkingSpaces !== null && (
											<div className="wishlist-detail-item">
												<FaParking className="detail-icon" />
												<div>
													<span className="detail-label">Parking Spaces</span>
													<span className="detail-value">{createdWishlist.parkingSpaces}</span>
												</div>
											</div>
										)}
										{createdWishlist.wifiSpeed > 0 && (
											<div className="wishlist-detail-item">
												<FaWifi className="detail-icon" />
												<div>
													<span className="detail-label">Wi-Fi Speed</span>
													<span className="detail-value">{createdWishlist.wifiSpeed} Mbps</span>
												</div>
											</div>
										)}
									</div>

									{createdWishlist.breakfastIncluded && (
										<div className="wishlist-offer-item">
											<FaUtensils className="offer-icon" />
											<span>Breakfast Included</span>
										</div>
									)}

									{createdWishlist.notes && (
										<div className="wishlist-notes">
											<h5>
												<FaStickyNote /> Additional Notes
											</h5>
											<p>{createdWishlist.notes}</p>
										</div>
									)}

									{createdWishlist.createdAt && (
										<div className="wishlist-date">
											Created: {new Date(createdWishlist.createdAt).toLocaleDateString()}
										</div>
									)}
								</div>
							</div>

							<div className="wishlist-modal-footer">
								<button
									className="btn-close-modal"
									onClick={() => setShowWishlistModal(false)}
								>
									Close
								</button>
								<button
									className="btn-edit-wishlist"
									onClick={() => {
										setShowWishlistModal(false)
										setWishlistCreated(false)
										// Auto-fill form with existing wishlist data
										if (createdWishlist) {
											if (createdWishlist.beds !== undefined) setBeds(createdWishlist.beds.toString())
											if (createdWishlist.bathrooms !== undefined) setBathrooms(createdWishlist.bathrooms.toString())
											if (createdWishlist.bedrooms !== undefined) setBedrooms(createdWishlist.bedrooms.toString())
											if (createdWishlist.guests !== undefined) setGuests(createdWishlist.guests.toString())
											if (createdWishlist.parkingSpaces !== undefined) setParkingSpaces(createdWishlist.parkingSpaces.toString())
											if (createdWishlist.wifiSpeed !== undefined) setWifiSpeed(createdWishlist.wifiSpeed.toString())
											if (createdWishlist.breakfastIncluded !== undefined) setBreakfastIncluded(createdWishlist.breakfastIncluded)
											if (createdWishlist.notes !== undefined) setNotes(createdWishlist.notes)
										}
									}}
								>
									Edit Wishlist
								</button>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	)
}
