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
				const propertiesRef = collection(db, "properties")
				const q = query(propertiesRef, orderBy("rating", "desc"), limit(3))
				const querySnapshot = await getDocs(q)
				const propertiesData = querySnapshot.docs.map((doc) => ({
					id: doc.id,
					...doc.data(),
				}))
				setProperties(propertiesData)
			} catch (error) {
				console.error("Error fetching featured properties:", error)
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
											<h3>{property.title}</h3>
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
