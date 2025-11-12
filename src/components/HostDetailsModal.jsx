import { useState, useEffect } from "react"
import { db } from "./firebaseConfig"
import {
	collection,
	getDocs,
	query,
	where,
	updateDoc,
	doc,
	writeBatch,
	serverTimestamp,
} from "firebase/firestore"
import { toast } from "react-stacked-toast"
import { FaTimes } from "react-icons/fa"
import housePlaceholder from "../assets/housePlaceholder.png"
import { createNotification } from "../utils/notifications"

export default function HostDetailsModal({ host, onClose, onRefresh }) {
	const [isRevoking, setIsRevoking] = useState(false)
	const [subscriptionData, setSubscriptionData] = useState(null)
	const [isFreeTrial, setIsFreeTrial] = useState(false)
	const [isRevoked, setIsRevoked] = useState(false)
	const [previousSubscription, setPreviousSubscription] = useState(null)
	const [isHostDisabled, setIsHostDisabled] = useState(false)
	const [disabledUntil, setDisabledUntil] = useState(null)
	const [isDisabling, setIsDisabling] = useState(false)

	useEffect(() => {
		if (host) {
			fetchSubscriptionData()
		}
	}, [host])

	const fetchSubscriptionData = async () => {
		try {
			// Check subscriptions collection
			const subscriptionsRef = collection(db, "subscriptions")
			const subscriptionQuery = query(
				subscriptionsRef,
				where("userId", "==", host.hostId)
			)
			const subscriptionSnapshot = await getDocs(subscriptionQuery)

			let subData = null
			if (!subscriptionSnapshot.empty) {
				subData = {
					id: subscriptionSnapshot.docs[0].id,
					...subscriptionSnapshot.docs[0].data(),
				}
			} else if (host.userData?.subscription) {
				// Check user document subscription
				subData = {
					...host.userData.subscription,
					fromUserDoc: true,
				}
			}

			setSubscriptionData(subData)

			// Check if revoked
			if (subData?.status === "revoked") {
				setIsRevoked(true)
				setPreviousSubscription(subData.previousSubscription || null)
			} else {
				setIsRevoked(false)
			}

			// Check if host is disabled
			if (host.userData?.disabled === true) {
				setIsHostDisabled(true)
				if (host.userData.disabledUntil) {
					const disabledUntilDate = host.userData.disabledUntil.toDate
						? host.userData.disabledUntil.toDate()
						: new Date(host.userData.disabledUntil)
					setDisabledUntil(disabledUntilDate)
					// Check if disabled period has passed
					const now = new Date()
					if (now >= disabledUntilDate) {
						setIsHostDisabled(false) // Auto-enabled after 7 days
					}
				} else {
					setIsHostDisabled(true) // Manually disabled, no expiry
				}
			} else {
				setIsHostDisabled(false)
			}

			// Check if free trial
			const isTrial = checkIfFreeTrial(subData, host)
			setIsFreeTrial(isTrial)
		} catch (error) {
			console.error("Error fetching subscription data:", error)
		}
	}

	const checkIfFreeTrial = (subData, hostData) => {
		// If has active premium subscription, not free trial
		if (subData?.planId === "premium" && subData?.status === "active") {
			return false
		}

		// Check if account is within 14 days of creation
		if (hostData.userData?.createdAt) {
			const createdAt = hostData.userData.createdAt.toDate
				? hostData.userData.createdAt.toDate()
				: new Date(hostData.userData.createdAt)
			const now = new Date()
			const daysSinceCreation = (now - createdAt) / (1000 * 60 * 60 * 24)
			return daysSinceCreation <= 14
		}

		return false
	}

	const handleRevokeSubscription = async () => {
		console.log("🔴 handleRevokeSubscription called", { 
			hostId: host.hostId, 
			hostName: host.displayName,
			subscriptionData: subscriptionData,
			isFreeTrial: isFreeTrial
		})
		
		if (!subscriptionData) {
			console.error("❌ No subscription data found")
			toast.error("No subscription found to revoke")
			return
		}

		if (isFreeTrial) {
			console.error("❌ Cannot revoke free trial subscription")
			toast.error("Cannot revoke free trial subscriptions")
			return
		}

		if (
			window.confirm(
				`Are you sure you want to revoke ${host.displayName}'s subscription? This will disable all their properties for 7 days.`
			)
		) {
			console.log("✅ User confirmed revoke action")
			setIsRevoking(true)
			try {
				console.log("📝 Creating batch write operation")
				const batch = writeBatch(db)

				// Store previous subscription data (only include defined values)
				const previousSub = {}
				if (subscriptionData.planId) previousSub.planId = subscriptionData.planId
				previousSub.planName = subscriptionData.planName || "Premium"
				previousSub.price = subscriptionData.price || 999
				if (subscriptionData.status) previousSub.status = subscriptionData.status
				if (subscriptionData.startDate) previousSub.startDate = subscriptionData.startDate
				if (subscriptionData.nextBillingDate) previousSub.nextBillingDate = subscriptionData.nextBillingDate
				if (subscriptionData.expiryDate) previousSub.expiryDate = subscriptionData.expiryDate
				console.log("💾 Previous subscription data stored:", previousSub)

				// Update subscription to revoked status
				if (subscriptionData.id) {
					console.log("📋 Updating subscription in subscriptions collection:", subscriptionData.id)
					// Update in subscriptions collection
					const subRef = doc(db, "subscriptions", subscriptionData.id)
					batch.update(subRef, {
						status: "revoked",
						revokedAt: serverTimestamp(),
						previousSubscription: previousSub,
					})
					console.log("✅ Subscription collection update added to batch")
				} else {
					console.log("⚠️ No subscription ID found, skipping subscriptions collection update")
				}

				// Disable host and all properties for 7 days
				const disabledUntil = new Date()
				disabledUntil.setDate(disabledUntil.getDate() + 7)
				console.log("📅 Disabled until date:", disabledUntil.toISOString())

				// Update user document subscription and mark host as disabled
				const userRef = doc(db, "users", host.hostId)
				console.log("👤 Updating user document:", host.hostId)
				batch.update(userRef, {
					"subscription.status": "revoked",
					"subscription.revokedAt": serverTimestamp(),
					"subscription.previousSubscription": previousSub,
					disabled: true,
					disabledUntil: disabledUntil,
					disabledAt: serverTimestamp(),
					disabledReason: "subscription_revoked",
				})
				console.log("✅ User document update added to batch")

				// Disable all properties for 7 days
				const propertiesRef = collection(db, "properties")
				const propertiesQuery = query(
					propertiesRef,
					where("hostId", "==", host.hostId)
				)
				console.log("🏠 Fetching properties for host:", host.hostId)
				const propertiesSnapshot = await getDocs(propertiesQuery)
				console.log("📊 Found properties:", propertiesSnapshot.docs.length)

				propertiesSnapshot.docs.forEach((propertyDoc, index) => {
					const propertyRef = doc(db, "properties", propertyDoc.id)
					console.log(`🏡 Updating property ${index + 1}/${propertiesSnapshot.docs.length}:`, propertyDoc.id)
					batch.update(propertyRef, {
						disabled: true,
						disabledUntil: disabledUntil,
						disabledReason: "subscription_revoked",
						disabledAt: serverTimestamp(),
					})
				})
				console.log("✅ All property updates added to batch")

				console.log("💾 Committing batch...")
				await batch.commit()
				console.log("✅ Batch committed successfully")

				// Create notifications for host (both subscription revoked and account disabled)
				try {
					console.log("📬 Creating notifications for host")
					
					// Notification for subscription revocation
					await createNotification(
						host.hostId,
						"subscription_revoked",
						"Subscription Revoked",
						"Your subscription has been revoked by the administrator. Your account and all properties have been temporarily disabled for 7 days. Please contact support for more information.",
						{
							subscriptionId: subscriptionData.id,
							disabledUntil: disabledUntil.toISOString(),
							hostId: host.hostId,
						}
					)
					console.log("✅ Subscription revoked notification created")
					
					// Notification for account being disabled
					await createNotification(
						host.hostId,
						"host_disabled",
						"Account Disabled",
						"Your account has been temporarily disabled by the administrator due to subscription revocation. All your properties are disabled until " + disabledUntil.toLocaleDateString() + ". Please contact support for assistance.",
						{
							disabledUntil: disabledUntil.toISOString(),
							hostId: host.hostId,
							reason: "subscription_revoked",
						}
					)
					console.log("✅ Account disabled notification created")
				} catch (notifError) {
					console.error("❌ Error creating notifications:", notifError)
				}

				console.log("🎉 Subscription revoked successfully!")
				toast.success(
					`Subscription revoked successfully. Host and all properties disabled for 7 days.`
				)
				setIsRevoked(true)
				setIsHostDisabled(true)
				setDisabledUntil(disabledUntil)
				setPreviousSubscription(previousSub)
				onRefresh()
			} catch (error) {
				console.error("❌ Error revoking subscription:", error)
				console.error("❌ Error details:", {
					message: error.message,
					code: error.code,
					stack: error.stack,
					hostId: host.hostId,
					subscriptionData: subscriptionData,
				})
				toast.error("Failed to revoke subscription. Please try again.")
			} finally {
				setIsRevoking(false)
				console.log("🏁 Revoke operation completed")
			}
		} else {
			console.log("❌ User cancelled revoke action")
		}
	}

	const handleUnrevokeSubscription = async () => {
		console.log("🟢 handleUnrevokeSubscription called", {
			hostId: host.hostId,
			hostName: host.displayName,
			previousSubscription: previousSubscription,
			subscriptionData: subscriptionData,
		})

		if (!previousSubscription) {
			console.error("❌ No previous subscription data found")
			toast.error("No previous subscription data found")
			return
		}

		if (
			window.confirm(
				`Are you sure you want to restore ${host.displayName}'s subscription?`
			)
		) {
			console.log("✅ User confirmed restore action")
			setIsRevoking(true)
			try {
				console.log("📝 Creating batch write operation")
				const batch = writeBatch(db)

				// Restore subscription
				if (subscriptionData?.id) {
					console.log("📋 Restoring subscription in subscriptions collection:", subscriptionData.id)
					const subRef = doc(db, "subscriptions", subscriptionData.id)
					
					// Build update object with only defined values
					const subUpdate = {
						unrevokedAt: serverTimestamp(),
					}
					if (previousSubscription.status) subUpdate.status = previousSubscription.status
					else subUpdate.status = "active"
					if (previousSubscription.planId) subUpdate.planId = previousSubscription.planId
					if (previousSubscription.planName) subUpdate.planName = previousSubscription.planName
					if (previousSubscription.price !== undefined) subUpdate.price = previousSubscription.price
					if (previousSubscription.startDate) subUpdate.startDate = previousSubscription.startDate
					if (previousSubscription.nextBillingDate) subUpdate.nextBillingDate = previousSubscription.nextBillingDate
					if (previousSubscription.expiryDate) subUpdate.expiryDate = previousSubscription.expiryDate
					
					console.log("📋 Subscription update data:", subUpdate)
					batch.update(subRef, subUpdate)
					console.log("✅ Subscription collection update added to batch")
				} else {
					console.log("⚠️ No subscription ID found, skipping subscriptions collection update")
				}

				// Update user document subscription and re-enable host
				const userRef = doc(db, "users", host.hostId)
				console.log("👤 Updating user document and re-enabling host:", host.hostId)
				
				// Build update object with only defined values
				const userUpdate = {
					"subscription.unrevokedAt": serverTimestamp(),
					disabled: false, // Re-enable the host
					disabledUntil: null, // Clear disabled until date
					disabledReason: null, // Clear disabled reason
					enabledAt: serverTimestamp(), // Set enabled timestamp
				}
				console.log("✅ Host re-enable flags set in userUpdate")
				if (previousSubscription.status) userUpdate["subscription.status"] = previousSubscription.status
				else userUpdate["subscription.status"] = "active"
				if (previousSubscription.planId) userUpdate["subscription.planId"] = previousSubscription.planId
				if (previousSubscription.planName) userUpdate["subscription.planName"] = previousSubscription.planName
				if (previousSubscription.price !== undefined) userUpdate["subscription.price"] = previousSubscription.price
				if (previousSubscription.startDate) userUpdate["subscription.startDate"] = previousSubscription.startDate
				if (previousSubscription.nextBillingDate) userUpdate["subscription.nextBillingDate"] = previousSubscription.nextBillingDate
				if (previousSubscription.expiryDate) userUpdate["subscription.expiryDate"] = previousSubscription.expiryDate
				
				console.log("👤 User document update data:", userUpdate)
				batch.update(userRef, userUpdate)
				console.log("✅ User document update added to batch")

				// Re-enable all properties
				const propertiesRef = collection(db, "properties")
				const propertiesQuery = query(
					propertiesRef,
					where("hostId", "==", host.hostId)
				)
				console.log("🏠 Fetching properties for host:", host.hostId)
				const propertiesSnapshot = await getDocs(propertiesQuery)
				console.log("📊 Found properties:", propertiesSnapshot.docs.length)

				propertiesSnapshot.docs.forEach((propertyDoc, index) => {
					const propertyRef = doc(db, "properties", propertyDoc.id)
					console.log(`🏡 Re-enabling property ${index + 1}/${propertiesSnapshot.docs.length}:`, propertyDoc.id)
					batch.update(propertyRef, {
						disabled: false,
						disabledUntil: null,
						disabledReason: null,
						enabledAt: serverTimestamp(),
					})
				})
				console.log("✅ All property updates added to batch")

				console.log("💾 Committing batch...")
				await batch.commit()
				console.log("✅ Batch committed successfully")

				// Create notifications for host (both subscription restored and account re-enabled)
				try {
					console.log("📬 Creating notifications for host")
					
					// Notification for subscription restoration
					await createNotification(
						host.hostId,
						"subscription_restored",
						"Subscription Restored",
						"Your subscription has been restored by the administrator. Your account and all your properties are now active again.",
						{
							subscriptionId: subscriptionData?.id,
							hostId: host.hostId,
						}
					)
					console.log("✅ Subscription restored notification created")
					
					// Notification for account being re-enabled
					await createNotification(
						host.hostId,
						"host_enabled",
						"Account Re-enabled",
						"Your account has been re-enabled by the administrator. All your properties are now active and visible to guests again.",
						{
							hostId: host.hostId,
							reason: "subscription_restored",
						}
					)
					console.log("✅ Account re-enabled notification created")
				} catch (notifError) {
					console.error("❌ Error creating notifications:", notifError)
				}

				console.log("🎉 Subscription restored successfully!")
				toast.success("Subscription restored successfully. Host re-enabled.")
				setIsRevoked(false)
				setIsHostDisabled(false)
				setDisabledUntil(null)
				setPreviousSubscription(null)
				onRefresh()
				fetchSubscriptionData() // Refresh subscription data
			} catch (error) {
				console.error("❌ Error unrevoking subscription:", error)
				console.error("❌ Error details:", {
					message: error.message,
					code: error.code,
					stack: error.stack,
					hostId: host.hostId,
					previousSubscription: previousSubscription,
					subscriptionData: subscriptionData,
				})
				toast.error("Failed to restore subscription. Please try again.")
			} finally {
				setIsRevoking(false)
				console.log("🏁 Restore operation completed")
			}
		} else {
			console.log("❌ User cancelled restore action")
		}
	}

	const handleDisableHost = async () => {
		console.log("🔴 handleDisableHost called", { hostId: host.hostId, hostName: host.displayName })
		
		if (
			window.confirm(
				`Are you sure you want to disable ${host.displayName}? This will disable all their properties for 7 days.`
			)
		) {
			console.log("✅ User confirmed disable action")
			setIsDisabling(true)
			try {
				console.log("📝 Creating batch write operation")
				const batch = writeBatch(db)

				// Calculate 7 days from now
				const disabledUntilDate = new Date()
				disabledUntilDate.setDate(disabledUntilDate.getDate() + 7)
				console.log("📅 Disabled until date:", disabledUntilDate.toISOString())

				// Update user document to mark host as disabled
				const userRef = doc(db, "users", host.hostId)
				console.log("👤 Updating user document:", host.hostId)
				batch.update(userRef, {
					disabled: true,
					disabledUntil: disabledUntilDate,
					disabledAt: serverTimestamp(),
					disabledReason: "admin_action",
				})
				console.log("✅ User document update added to batch")

				// Disable all properties for 7 days
				const propertiesRef = collection(db, "properties")
				const propertiesQuery = query(
					propertiesRef,
					where("hostId", "==", host.hostId)
				)
				console.log("🏠 Fetching properties for host:", host.hostId)
				const propertiesSnapshot = await getDocs(propertiesQuery)
				console.log("📊 Found properties:", propertiesSnapshot.docs.length)

				propertiesSnapshot.docs.forEach((propertyDoc, index) => {
					const propertyRef = doc(db, "properties", propertyDoc.id)
					console.log(`🏡 Updating property ${index + 1}/${propertiesSnapshot.docs.length}:`, propertyDoc.id)
					batch.update(propertyRef, {
						disabled: true,
						disabledUntil: disabledUntilDate,
						disabledReason: "host_disabled",
						disabledAt: serverTimestamp(),
					})
				})
				console.log("✅ All property updates added to batch")

				console.log("💾 Committing batch...")
				await batch.commit()
				console.log("✅ Batch committed successfully")

				// Create notification for host
				try {
					console.log("📬 Creating notification for host")
					await createNotification(
						host.hostId,
						"host_disabled",
						"Account Disabled",
						"Your account has been temporarily disabled by the administrator. All your properties have been disabled for 7 days (until " + disabledUntilDate.toLocaleDateString() + "). Please contact support for more information.",
						{
							disabledUntil: disabledUntilDate.toISOString(),
							hostId: host.hostId,
							reason: "admin_action",
						}
					)
					console.log("✅ Notification created successfully")
				} catch (notifError) {
					console.error("❌ Error creating notification:", notifError)
				}

				console.log("🎉 Host disabled successfully!")
				toast.success(
					`Host disabled successfully. All properties disabled for 7 days.`
				)
				setIsHostDisabled(true)
				setDisabledUntil(disabledUntilDate)
				onRefresh()
			} catch (error) {
				console.error("❌ Error disabling host:", error)
				console.error("❌ Error details:", {
					message: error.message,
					code: error.code,
					stack: error.stack,
					hostId: host.hostId,
				})
				toast.error("Failed to disable host. Please try again.")
			} finally {
				setIsDisabling(false)
				console.log("🏁 Disable operation completed")
			}
		} else {
			console.log("❌ User cancelled disable action")
		}
	}

	const handleEnableHost = async () => {
		if (
			window.confirm(
				`Are you sure you want to re-enable ${host.displayName}?`
			)
		) {
			setIsDisabling(true)
			try {
				const batch = writeBatch(db)

				// Update user document to re-enable host
				const userRef = doc(db, "users", host.hostId)
				batch.update(userRef, {
					disabled: false,
					disabledUntil: null,
					disabledReason: null,
					enabledAt: serverTimestamp(),
				})

				// Re-enable all properties
				const propertiesRef = collection(db, "properties")
				const propertiesQuery = query(
					propertiesRef,
					where("hostId", "==", host.hostId)
				)
				const propertiesSnapshot = await getDocs(propertiesQuery)

				propertiesSnapshot.docs.forEach((propertyDoc) => {
					const propertyRef = doc(db, "properties", propertyDoc.id)
					batch.update(propertyRef, {
						disabled: false,
						disabledUntil: null,
						disabledReason: null,
						enabledAt: serverTimestamp(),
					})
				})

				await batch.commit()

				// Create notification for host
				try {
					await createNotification(
						host.hostId,
						"host_enabled",
						"Account Re-enabled",
						"Your account has been re-enabled by the administrator. All your properties are now active again.",
						{
							hostId: host.hostId,
						}
					)
				} catch (notifError) {
					console.error("Error creating notification:", notifError)
				}

				toast.success("Host re-enabled successfully.")
				setIsHostDisabled(false)
				setDisabledUntil(null)
				onRefresh()
			} catch (error) {
				console.error("Error enabling host:", error)
				toast.error("Failed to re-enable host. Please try again.")
			} finally {
				setIsDisabling(false)
			}
		}
	}

	// Find top and lowest properties
	const topProperty = host.properties?.reduce(
		(top, current) => {
			const topRating = top.rating || 0
			const currentRating = current.rating || 0
			return currentRating > topRating ? current : top
		},
		host.properties[0]
	)

	const lowestProperty = host.properties?.reduce(
		(lowest, current) => {
			const lowestRating = lowest.rating || 0
			const currentRating = current.rating || 0
			if (lowestRating === 0 && currentRating > 0) return current
			if (currentRating === 0 && lowestRating > 0) return lowest
			return currentRating < lowestRating ? current : lowest
		},
		host.properties[0]
	)

	const displayProperties = []
	if (topProperty)
		displayProperties.push({ ...topProperty, label: "Top Property" })
	if (lowestProperty && lowestProperty.id !== topProperty?.id) {
		displayProperties.push({ ...lowestProperty, label: "Lowest Rating" })
	}

	return (
		<div
			className="modal-overlay"
			onClick={onClose}
		>
			<div
				className="host-details-modal"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="modal-header">
					<h2>👤 Host Details</h2>
					<button className="modal-close-btn" onClick={onClose}>
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
										{host.averageRating > 0
											? host.averageRating.toFixed(1)
											: "N/A"}
									</span>
									{host.averageRating > 0 && (
										<span className="rating-stars-large">
											{"⭐".repeat(Math.floor(host.averageRating))}
										</span>
									)}
								</div>
							</div>
							<div className="detail-item">
								<label>Total Properties:</label>
								<span>{host.propertiesCount}</span>
							</div>
							<div className="detail-item">
								<label>Rated Properties:</label>
								<span>{host.ratedPropertiesCount}</span>
							</div>
						</div>
					</div>

					<div className="host-details-section">
						<h3>Properties List</h3>
						{host.properties.length === 0 ? (
							<p className="no-properties">No properties listed</p>
						) : (
							<div className="properties-list">
								{displayProperties.map((property) => (
									<div key={property.id} className="property-item">
										<div className="property-image-container">
											<img
												src={property.images?.[0] || housePlaceholder}
												alt={property.title || "Property"}
												className="property-image"
											/>
										</div>
										<div className="property-header">
											<div>
												<span className="property-label">{property.label}</span>
												<h4>{property.title || "Untitled Property"}</h4>
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
													₱{property.pricing.basePrice.toLocaleString()}/night
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
						)}
					</div>

					{host.userData && (
						<div className="host-details-section">
							<h3>Account Information</h3>
							<div className="detail-grid">
								{host.userData.firstName && (
									<div className="detail-item">
										<label>First Name:</label>
										<span>{host.userData.firstName}</span>
									</div>
								)}
								{host.userData.lastName && (
									<div className="detail-item">
										<label>Last Name:</label>
										<span>{host.userData.lastName}</span>
									</div>
								)}
								{host.userData.createdAt && (
									<div className="detail-item">
										<label>Member Since:</label>
										<span>
											{host.userData.createdAt?.toDate
												? host.userData.createdAt.toDate().toLocaleDateString()
												: new Date(
														host.userData.createdAt
												  ).toLocaleDateString()}
										</span>
									</div>
								)}
								<div className="detail-item">
									<label>Host ID:</label>
									<span className="host-id">{host.hostId}</span>
								</div>
								{host.userData.userType && (
									<div className="detail-item">
										<label>User Type:</label>
										<span className="user-type-badge">
											{host.userData.userType}
										</span>
									</div>
								)}
								<div className="detail-item">
									<label>Subscription Type:</label>
									<span
										className={`subscription-badge ${
											host.subscriptionType?.toLowerCase() || "free"
										}`}
									>
										{host.subscriptionType || "Free"}
										{isRevoked && " (Revoked)"}
									</span>
								</div>
								<div className="detail-item">
									<label>Account Status:</label>
									<span
										className={`account-status-badge ${
											isHostDisabled ? "disabled" : "active"
										}`}
									>
										{isHostDisabled ? "🔒 Disabled" : "✅ Active"}
										{isHostDisabled && disabledUntil && (
											<span className="disabled-until">
												{" "}
												(Until: {disabledUntil.toLocaleDateString()})
											</span>
										)}
									</span>
								</div>
							</div>
						</div>
					)}
				</div>

				<div className="modal-footer">
					<button className="btn-close-modal" onClick={onClose}>
						Close
					</button>
					<div className="modal-footer-actions">
						{!isHostDisabled ? (
							<button
								className="btn-disable-host"
								onClick={handleDisableHost}
								disabled={isDisabling}
							>
								{isDisabling ? "Disabling..." : "Disable Host"}
							</button>
						) : (
							<button
								className="btn-enable-host"
								onClick={handleEnableHost}
								disabled={isDisabling}
							>
								{isDisabling ? "Enabling..." : "Re-enable Host"}
							</button>
						)}
						{!isRevoked && subscriptionData && (
							<button
								className="btn-revoke-subscription"
								onClick={handleRevokeSubscription}
								disabled={isFreeTrial || isRevoking || !subscriptionData}
							>
								{isRevoking ? "Revoking..." : "Revoke Subscription"}
							</button>
						)}
						{isRevoked && previousSubscription && (
							<button
								className="btn-unrevoke-subscription"
								onClick={handleUnrevokeSubscription}
								disabled={isRevoking}
							>
								{isRevoking ? "Restoring..." : "Restore Subscription"}
							</button>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}

