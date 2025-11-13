import React, { useState, useEffect } from "react"
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore"
import { db } from "./firebaseConfig"
import { motion } from "framer-motion"
import { FaStar } from "react-icons/fa"
import "../css/FeaturedProperties.css"
import PropertyCardSkeleton from "./PropertyCardSkeleton"

const containerVariants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: { staggerChildren: 0.1, delayChildren: 0.2 },
	},
}

const itemVariants = {
	hidden: { opacity: 0, y: 20 },
	visible: { opacity: 1, y: 0 },
}

export default function FeaturedProperties() {
	const [properties, setProperties] = useState([])
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		const fetchProperties = async () => {
			try {
				console.log("Fetching featured properties...")
				const propertiesRef = collection(db, "properties")
				// Fetch all properties to sort by boost status
				const querySnapshot = await getDocs(propertiesRef)
				console.log("Query snapshot size:", querySnapshot.size)
				let propertiesData = querySnapshot.docs.map((doc) => ({
					id: doc.id,
					...doc.data(),
				}))

				// Filter out disabled properties
				propertiesData = propertiesData.filter((property) => {
					if (property.disabled === true) {
						if (property.disabledUntil) {
							const disabledUntil = property.disabledUntil.toDate
								? property.disabledUntil.toDate()
								: new Date(property.disabledUntil)
							const now = new Date()
							if (now < disabledUntil) {
								return false // Still disabled
							}
						} else {
							return false // Permanently disabled
						}
					}
					return true
				})

				// Sort: boosted first, then featured, then by rating
				propertiesData.sort((a, b) => {
					// Boosted properties first
					if (a.boosted && !b.boosted) return -1
					if (!a.boosted && b.boosted) return 1
					
					// Then featured properties
					if (a.featured && !b.featured) return -1
					if (!a.featured && b.featured) return 1
					
					// Then by rating
					const ratingA = a.rating || 0
					const ratingB = b.rating || 0
					return ratingB - ratingA
				})

				// Limit to top 3
				propertiesData = propertiesData.slice(0, 3)
				
				console.log("Fetched properties:", propertiesData)
				setProperties(propertiesData)
			} catch (error) {
				console.error("Error fetching featured properties:", error)
				console.error("Error details:", error.message, error.code)
			} finally {
				setLoading(false)
			}
		}

		fetchProperties()
	}, [])

	return (
		<section className="featured-properties">
			<h2>Featured Properties</h2>
			<motion.div
				className="properties-container"
				variants={containerVariants}
				initial="hidden"
				whileInView="visible"
				viewport={{ once: true, amount: 0.5 }}
			>
				{loading
					? Array.from({ length: 3 }).map((_, index) => (
							<PropertyCardSkeleton key={index} />
					  ))
					: properties.map((property) => (
							<motion.div
								key={property.id}
								className="property-card"
								variants={itemVariants}
							>
								<a href="#" className="property-card-link">
									<img
										src={property.images?.[0] || property.image}
										alt={property.title}
										className="property-image"
									/>
									<div className="property-content">
										<div className="property-header">
											<h3 className="property-title-featured">
												{property.title}
											</h3>
											<div className="property-rating">
												<FaStar /> {property.rating}
											</div>
										</div>
										<p className="property-location">
											{property.location?.city
												? `${property.location.city}, ${property.location.province}`
												: property.location || "Location"}
										</p>
										<p className="property-price">
											{property.pricing?.basePrice
												? `₱${property.pricing.basePrice.toLocaleString()}/night`
												: property.price || "Price"}
										</p>
									</div>
								</a>
							</motion.div>
					  ))}
			</motion.div>
		</section>
	)
}
