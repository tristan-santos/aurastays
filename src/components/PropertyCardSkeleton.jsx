import React from "react"
import "../css/PropertyCardSkeleton.css"

export default function PropertyCardSkeleton() {
	return (
		<div className="property-card-skeleton">
			<div className="skeleton skeleton-image"></div>
			<div className="skeleton-content">
				<div className="skeleton skeleton-line skeleton-title"></div>
				<div className="skeleton skeleton-line skeleton-location"></div>
				<div className="skeleton skeleton-line skeleton-price"></div>
			</div>
		</div>
	)
}
