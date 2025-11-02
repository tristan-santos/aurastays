import { useState, useEffect } from "react"
import { FaTimes, FaGift, FaTag, FaCopy, FaCheck } from "react-icons/fa"
import { db } from "./firebaseConfig"
import { collection, getDocs, query, where } from "firebase/firestore"
import "../css/Promos.css"

export default function Promos({ isOpen, onClose, userId = null }) {
	const [copiedCode, setCopiedCode] = useState(null)
	const [promos, setPromos] = useState([])
	const [isLoading, setIsLoading] = useState(true)

	useEffect(() => {
		if (isOpen) {
			fetchPromos()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isOpen, userId])

	const fetchPromos = async () => {
		setIsLoading(true)
		try {
			// If userId is provided, only show promos created by that user (for hosts)
			// If userId is null, show all non-admin promos (for guests)
			
			// If userId is provided, filter by createdBy directly in the query
			if (userId) {
				const promosQuery = query(
					collection(db, "promos"),
					where("createdBy", "==", userId)
				)
				const promosSnapshot = await getDocs(promosQuery)
				
				const now = new Date()
				const promosData = promosSnapshot.docs
					.map((doc) => ({
						id: doc.id,
						...doc.data(),
					}))
					.filter((promo) => {
						// Must be active
						if (!promo.isActive) return false
						
						// Filter out expired promos
						if (promo.validUntil) {
							const expiryDate = new Date(promo.validUntil)
							if (expiryDate < now) return false
						}
						
						// Filter out promos that haven't started yet
						if (promo.validFrom) {
							const startDate = new Date(promo.validFrom)
							if (startDate > now) return false
						}
						
						// Filter out promos that reached their usage limit
						if (
							promo.usageLimit > 0 &&
							(promo.usageCount || 0) >= promo.usageLimit
						) {
							return false
						}
						
						return true
					})
				
				setPromos(promosData)
				setIsLoading(false)
				return
			}

			// For guests: get admin user ID to filter out admin-created promos
			let adminUserId = null
			try {
				const adminEmail = "adminAurastays@aurastays.com"
				const usersQuery = query(
					collection(db, "users"),
					where("email", "==", adminEmail)
				)
				const usersSnapshot = await getDocs(usersQuery)
				if (!usersSnapshot.empty) {
					adminUserId = usersSnapshot.docs[0].id
				}
			} catch (adminError) {
				console.error("Error fetching admin user ID:", adminError)
			}

			// Try to fetch all promos first, then filter
			const promosSnapshot = await getDocs(collection(db, "promos"))

			console.log("Total promos in database:", promosSnapshot.docs.length)

			const now = new Date()
			const promosData = promosSnapshot.docs
				.map((doc) => {
					const data = doc.data()
					console.log("Promo data:", { id: doc.id, ...data })
					return {
						id: doc.id,
						...data,
					}
				})
				.filter((promo) => {
					// Filter out admin-created promos (for guests)
					if (adminUserId && promo.createdBy === adminUserId) {
						console.log(`Promo ${promo.code} was created by admin, excluding`)
						return false
					}

					// Must be active
					if (!promo.isActive) {
						console.log(`Promo ${promo.code} is not active`)
						return false
					}

					// Filter out expired promos
					if (promo.validUntil) {
						const expiryDate = new Date(promo.validUntil)
						if (expiryDate < now) {
							console.log(`Promo ${promo.code} has expired`)
							return false
						}
					}

					// Filter out promos that haven't started yet
					if (promo.validFrom) {
						const startDate = new Date(promo.validFrom)
						if (startDate > now) {
							console.log(`Promo ${promo.code} hasn't started yet`)
							return false
						}
					}

					// Filter out promos that reached their usage limit
					if (
						promo.usageLimit > 0 &&
						(promo.usageCount || 0) >= promo.usageLimit
					) {
						console.log(`Promo ${promo.code} reached usage limit`)
						return false
					}

					return true
				})

			console.log("Active promos after filtering:", promosData)
			setPromos(promosData)
		} catch (error) {
			console.error("Error fetching promos:", error)
			console.error("Error details:", error.message)
			setPromos([])
		} finally {
			setIsLoading(false)
		}
	}

	const getCategoryColor = (category) => {
		const colors = {
			all: "#27ae60",
			properties: "#3498db",
			experiences: "#e67e22",
			service: "#9b59b6",
		}
		return colors[category] || "#f39c12"
	}

	const formatDiscount = (promo) => {
		if (promo.discountType === "percentage") {
			return `${promo.discountValue}% OFF`
		} else {
			return `₱${promo.discountValue} OFF`
		}
	}

	const formatDate = (dateString) => {
		if (!dateString) return "No expiry"
		const date = new Date(dateString)
		return date.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		})
	}

	const getCategoryLabel = (category) => {
		const labels = {
			all: "All Categories",
			properties: "Properties",
			experiences: "Experiences",
			service: "Service",
		}
		return labels[category] || category
	}

	const handleCopyCode = (code) => {
		navigator.clipboard.writeText(code)
		setCopiedCode(code)
		setTimeout(() => setCopiedCode(null), 2000)
	}

	if (!isOpen) return null

	return (
		<div className="promo-modal-overlay" onClick={onClose}>
			<div className="promo-modal-content" onClick={(e) => e.stopPropagation()}>
				<div className="promo-modal-header">
					<div className="promo-header-title">
						<FaGift className="promo-header-icon" />
						<h2>🎉 Available Promos</h2>
					</div>
					<button className="close-promo-modal" onClick={onClose}>
						<FaTimes />
					</button>
				</div>

				<div className="promo-modal-body">
					<div className="promo-info-banner">
						<FaTag className="banner-icon" />
						<p>
							Copy the promo code and apply it at checkout to enjoy exclusive
							discounts!
						</p>
					</div>

					{isLoading ? (
						<div className="promo-loading">
							<div className="spinner"></div>
							<p>Loading available promos...</p>
						</div>
					) : promos.length === 0 ? (
						<div className="no-promos">
							<FaGift className="no-promos-icon" />
							<h3>No Active Promos</h3>
							<p>Check back later for exciting deals and discounts!</p>
						</div>
					) : (
						<>
							<div className="promos-grid">
								{promos.map((promo) => (
									<div
										key={promo.id}
										className="promo-card"
										style={{
											borderColor: getCategoryColor(promo.applicableTo),
										}}
									>
										<div className="promo-header">
											<div
												className="promo-badge"
												style={{
													background: getCategoryColor(promo.applicableTo),
												}}
											>
												{formatDiscount(promo)}
											</div>
											<span className="promo-category">
												{getCategoryLabel(promo.applicableTo)}
											</span>
										</div>

										<div className="promo-content">
											<h3 className="promo-title">{promo.code}</h3>
											<p className="promo-description">{promo.description}</p>

											<div className="promo-details">
												{promo.minPurchase > 0 && (
													<div className="promo-detail-item">
														<span className="detail-label">Min. Spend:</span>
														<span className="detail-value">
															₱{promo.minPurchase.toLocaleString()}
														</span>
													</div>
												)}
												{promo.maxDiscount > 0 &&
													promo.discountType === "percentage" && (
														<div className="promo-detail-item">
															<span className="detail-label">
																Max. Discount:
															</span>
															<span className="detail-value">
																₱{promo.maxDiscount.toLocaleString()}
															</span>
														</div>
													)}
												<div className="promo-detail-item">
													<span className="detail-label">Valid Until:</span>
													<span className="detail-value">
														{formatDate(promo.validUntil)}
													</span>
												</div>
												{promo.usageLimit > 0 && (
													<div className="promo-detail-item">
														<span className="detail-label">Remaining:</span>
														<span className="detail-value">
															{promo.usageLimit - (promo.usageCount || 0)} uses
														</span>
													</div>
												)}
											</div>
										</div>

										<div className="promo-code-section">
											<div className="promo-code-box">
												<span className="promo-code">{promo.code}</span>
												<button
													className="copy-code-btn"
													onClick={() => handleCopyCode(promo.code)}
												>
													{copiedCode === promo.code ? (
														<>
															<FaCheck /> Copied!
														</>
													) : (
														<>
															<FaCopy /> Copy
														</>
													)}
												</button>
											</div>
										</div>
									</div>
								))}
							</div>

							<div className="promo-footer-note">
								<p>
									📢 <strong>Note:</strong> Promo codes cannot be combined with
									other offers. Terms and conditions apply.
								</p>
							</div>
						</>
					)}
				</div>
			</div>
		</div>
	)
}
