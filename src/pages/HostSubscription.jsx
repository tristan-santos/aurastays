import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import { db } from "../components/firebaseConfig"
import {
	doc,
	getDoc,
	updateDoc,
	collection,
	addDoc,
	query,
	where,
	getDocs,
	serverTimestamp,
} from "firebase/firestore"
import { toast } from "react-stacked-toast"
import {
	FaArrowLeft,
	FaCrown,
	FaCheck,
	FaTimes,
	FaCreditCard,
} from "react-icons/fa"
import "../css/HostSubscription.css"

export default function HostSubscription() {
	const navigate = useNavigate()
	const { currentUser } = useAuth()
	const [subscription, setSubscription] = useState(null)
	const [loading, setLoading] = useState(true)
	const [selectedPlan, setSelectedPlan] = useState(null)
	const [isProcessing, setIsProcessing] = useState(false)
	const [isPayPalLoaded, setIsPayPalLoaded] = useState(false)
	const paypalRef = useRef(null)
	const paypalButtonsInstanceRef = useRef(null)
	
	// Promo code states
	const [promoCode, setPromoCode] = useState("")
	const [appliedPromo, setAppliedPromo] = useState(null)
	const [promoDiscount, setPromoDiscount] = useState(0)
	const [isValidatingPromo, setIsValidatingPromo] = useState(false)

	const plans = [
		{
			id: "standard",
			name: "Standard",
			price: 0,
			isFree: true,
			maxListings: 1,
			features: [
				"1 property listing",
				"Basic analytics",
				"Standard support",
				"Featured listing",
				"Basic marketing tools",
				"Email notifications",
				"Property management dashboard",
				"Booking management",
			],
			popular: true,
		},
		{
			id: "premium",
			name: "Premium",
			price: 999,
			maxListings: -1, // Unlimited
			features: [
				"Unlimited properties",
				"Premium analytics dashboard",
				"24/7 priority support",
				"Featured listing priority",
				"Advanced marketing tools",
				"Custom branding options",
				"API access",
				"Performance insights",
				"Advanced booking management",
				"Revenue optimization tools",
			],
		},
	]

	// Handle URL parameters for subscription success/cancel
	useEffect(() => {
		const urlParams = new URLSearchParams(window.location.search)
		const success = urlParams.get("success")
		const cancelled = urlParams.get("cancelled")

		if (success === "true") {
			toast.success(
				"Subscription payment successful! Your premium plan is now active."
			)
			// Refresh subscription data
			if (currentUser?.uid) {
				fetchSubscription()
			}
			// Clean URL
			window.history.replaceState({}, document.title, window.location.pathname)
		} else if (cancelled === "true") {
			toast("Subscription was cancelled.", { type: "info" })
			window.history.replaceState({}, document.title, window.location.pathname)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	useEffect(() => {
		if (!currentUser?.uid) {
			navigate("/login")
			return
		}

		fetchSubscription()
		loadPayPalSDK()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentUser])

	// Utilities
	const getPaypalClientId = () =>
		(import.meta.env.VITE_PAYPAL_CLIENT_ID || "").toString().trim()

	const getPaypalPlanId = () =>
		(import.meta.env.VITE_PAYPAL_PREMIUM_PLAN_ID || "").toString().trim()

	const ensureEnvConfigured = () => {
		const clientId = getPaypalClientId()
		const planId = getPaypalPlanId()
		if (!clientId) {
			console.error("[HostSubscription] Missing VITE_PAYPAL_CLIENT_ID")
			toast.error("PayPal is not configured. Please contact support.")
			return false
		}
		if (!planId) {
			console.error("[HostSubscription] Missing VITE_PAYPAL_PREMIUM_PLAN_ID")
			toast.error("Subscription plan is not configured. Please contact support.")
			return false
		}
		return true
	}

	const loadPayPalSDK = () => {
		if (window.paypal) {
			setIsPayPalLoaded(true)
			return
		}

		// Check if script already exists
		const existingScript = document.querySelector(
			'script[src*="paypal.com/sdk"]'
		)
		if (existingScript) {
			existingScript.onload = () => {
				setIsPayPalLoaded(true)
			}
			return
		}

		const paypalClientId = getPaypalClientId() ||
			"AX2bN4tGrgZCaOm5C0HxY_1DAP7z8zN2K9D0yH4sJ3VxL5Q6R7S8T9U0V1W2X3Y4Z5"
		const script = document.createElement("script")
		script.src = `https://www.paypal.com/sdk/js?client-id=${paypalClientId}&vault=true&intent=subscription&currency=PHP&components=buttons`
		script.async = true
		script.onload = () => {
			setIsPayPalLoaded(true)
			console.log("PayPal Subscription SDK loaded successfully")
		}
		script.onerror = () => {
			console.error("Failed to load PayPal SDK")
			toast.error("Failed to load PayPal. Please refresh the page.")
		}
		document.body.appendChild(script)
	}

	const fetchSubscription = async () => {
		if (!currentUser?.uid) return

		try {
			setLoading(true)

			// Check user document for subscription info
			const userDoc = await getDoc(doc(db, "users", currentUser.uid))
			if (userDoc.exists()) {
				const userData = userDoc.data()
				if (userData.subscription) {
					const sub = userData.subscription

					// Check if subscription has expired (for cancelling subscriptions)
					if (sub.status === "cancelling" && sub.expiryDate) {
						const expiryDate = sub.expiryDate.toDate
							? sub.expiryDate.toDate()
							: new Date(sub.expiryDate)
						const now = new Date()

						// If expired, revert to free plan
						if (expiryDate <= now) {
							await updateDoc(doc(db, "users", currentUser.uid), {
								subscription: {
									planId: "standard",
									planName: "Standard",
									price: 0,
									status: "active",
									isDefault: true,
									startDate: new Date(),
									nextBillingDate: null,
								},
							})

							// Update subscription document if exists
							const subscriptionsQuery = query(
								collection(db, "subscriptions"),
								where("userId", "==", currentUser.uid)
							)
							const subscriptionsSnapshot = await getDocs(subscriptionsQuery)
							if (!subscriptionsSnapshot.empty) {
								await updateDoc(
									doc(db, "subscriptions", subscriptionsSnapshot.docs[0].id),
									{
										status: "expired",
										expiredAt: serverTimestamp(),
									}
								)
							}

							// Set to free plan in state
							setSubscription({
								planId: "standard",
								planName: "Standard",
								price: 0,
								status: "active",
								isDefault: true,
								startDate: new Date(),
								nextBillingDate: null,
							})
							setLoading(false)
							return
						} else {
							// Still active until expiry, show as cancelling but with premium access
							setSubscription(sub)
							setLoading(false)
							return
						}
					}

					// Active subscription
					if (sub.status === "active") {
						setSubscription(sub)
						setLoading(false)
						return
					}
				}
			}

			// Also check subscriptions collection
			const subscriptionsQuery = query(
				collection(db, "subscriptions"),
				where("userId", "==", currentUser.uid),
				where("status", "in", ["active", "pending", "cancelling"])
			)
			const subscriptionsSnapshot = await getDocs(subscriptionsQuery)
			if (!subscriptionsSnapshot.empty) {
				const subData = subscriptionsSnapshot.docs[0].data()

				// Check if cancelling subscription has expired
				if (subData.status === "cancelling" && subData.expiryDate) {
					const expiryDate = subData.expiryDate.toDate
						? subData.expiryDate.toDate()
						: new Date(subData.expiryDate)
					const now = new Date()

					if (expiryDate <= now) {
						// Expired - revert to free plan
						await updateDoc(doc(db, "users", currentUser.uid), {
							subscription: {
								planId: "standard",
								planName: "Standard",
								price: 0,
								status: "active",
								isDefault: true,
								startDate: new Date(),
								nextBillingDate: null,
							},
						})

						await updateDoc(
							doc(db, "subscriptions", subscriptionsSnapshot.docs[0].id),
							{
								status: "expired",
								expiredAt: serverTimestamp(),
							}
						)

						setSubscription({
							planId: "standard",
							planName: "Standard",
							price: 0,
							status: "active",
							isDefault: true,
							startDate: new Date(),
							nextBillingDate: null,
						})
						setLoading(false)
						return
					}
				}

				setSubscription({
					...subData,
					id: subscriptionsSnapshot.docs[0].id,
				})
				setLoading(false)
				return
			}

			// No active subscription found - set Standard (FREE) plan as default
			const defaultPlan = plans.find((p) => p.id === "standard")
			if (defaultPlan) {
				const defaultSubscription = {
					userId: currentUser.uid,
					planId: "standard",
					planName: "Standard",
					price: 0,
					status: "active",
					isDefault: true,
					startDate: new Date(),
					nextBillingDate: null,
				}

				// Save to subscriptions collection
				try {
					await addDoc(collection(db, "subscriptions"), {
						...defaultSubscription,
						startDate: serverTimestamp(),
						createdAt: serverTimestamp(),
					})

					// Update user document
					await updateDoc(doc(db, "users", currentUser.uid), {
						subscription: defaultSubscription,
					})

					setSubscription(defaultSubscription)
				} catch (error) {
					console.error("Error setting default subscription:", error)
					// Still set it in state even if save fails, so UI shows correctly
					setSubscription(defaultSubscription)
				}
			}
		} catch (error) {
			console.error("Error fetching subscription:", error)
			// On error, still set default free plan in state
			const defaultPlan = plans.find((p) => p.id === "standard")
			if (defaultPlan) {
				setSubscription({
					userId: currentUser.uid,
					planId: "standard",
					planName: "Standard",
					price: 0,
					status: "active",
					isDefault: true,
					startDate: new Date(),
					nextBillingDate: null,
				})
			}
		} finally {
			setLoading(false)
		}
	}

	const handleSubscribe = async (planId) => {
		console.log("[HostSubscription] Subscribe button clicked", {
			planId,
			currentUserUid: currentUser?.uid,
		})
		const plan = plans.find((p) => p.id === planId)
		if (!plan) {
			console.warn("[HostSubscription] Plan not found for planId:", planId)
			return
		}
		console.log("[HostSubscription] Resolved plan:", plan)

		// If it's a free plan, activate immediately without PayPal
		if (plan.price === 0 || plan.isFree) {
			console.log("[HostSubscription] Activating free plan flow")
			setIsProcessing(true)
			setSelectedPlan(planId)
			try {
				const subscriptionData = {
					userId: currentUser.uid,
					planId: planId,
					planName: plan.name,
					price: 0,
					status: "active",
					startDate: serverTimestamp(),
					nextBillingDate: null, // Free plan has no billing date
					createdAt: serverTimestamp(),
				}

				// Save to subscriptions collection
				await addDoc(collection(db, "subscriptions"), subscriptionData)

				// Update user document
				await updateDoc(doc(db, "users", currentUser.uid), {
					subscription: {
						planId: planId,
						planName: plan.name,
						price: 0,
						status: "active",
						startDate: new Date(),
						nextBillingDate: null,
					},
				})

				setSubscription(subscriptionData)
				toast.success("🎉 Free plan activated successfully!")
				setSelectedPlan(null)
			} catch (error) {
				console.error("Error activating free plan:", error)
				toast.error("Failed to activate free plan. Please try again.")
			} finally {
				setIsProcessing(false)
			}
			return
		}

		// For paid plans, use PayPal
		console.log("[HostSubscription] Paid plan selected, preparing PayPal buttons", {
			planId,
			isPayPalLoaded,
			hasPaypalRef: !!paypalRef.current,
		})

		// Validate environment before proceeding
		if (!ensureEnvConfigured()) {
			return
		}

		setSelectedPlan(planId)
		// PayPal subscription will be initialized in the effect below
	}

	useEffect(() => {
		if (selectedPlan && isPayPalLoaded && paypalRef.current && currentUser) {
			console.log("[HostSubscription] Initializing PayPal Buttons", {
				selectedPlan,
				isPayPalLoaded,
				currentUserUid: currentUser.uid,
			})

			if (!window.paypal || !window.paypal.Buttons) {
				console.error("[HostSubscription] PayPal SDK not available when initializing buttons")
				toast.error("PayPal failed to load. Please refresh and try again.")
				return
			}

			// Clear previous PayPal buttons
			paypalRef.current.innerHTML = ""

			const plan = plans.find((p) => p.id === selectedPlan)
			if (!plan || plan.price === 0) {
				console.warn("[HostSubscription] Selected plan invalid for PayPal init", {
					selectedPlan,
					plan,
				})
				return
			}

			try {
				// Clear any previously created instance
				if (paypalButtonsInstanceRef.current && paypalRef.current) {
					paypalRef.current.innerHTML = ""
					paypalButtonsInstanceRef.current = null
				}

				const buttons = window.paypal.Buttons({
					style: {
						layout: "vertical",
						color: "gold",
						shape: "rect",
						label: "subscribe",
					},
					createSubscription: async (data, actions) => {
						try {
							const envPlanId = getPaypalPlanId()
							console.log("[HostSubscription] createSubscription invoked", {
								envPlanId,
							})
							if (!envPlanId) {
								toast.error("Subscription plan is not configured. Please contact support.")
								throw new Error("Missing VITE_PAYPAL_PREMIUM_PLAN_ID")
							}
							return actions.subscription.create({ plan_id: envPlanId })
						} catch (error) {
							console.error("Error creating subscription:", error)
							throw error
						}
					},
					onApprove: async (data, actions) => {
						try {
							console.log("[HostSubscription] onApprove", {
								subscriptionID: data?.subscriptionID,
								orderID: data?.orderID,
							})
							setIsProcessing(true)
							toast("Processing your subscription...", { type: "info" })

							// Get subscription details from PayPal
							const subscriptionDetails = await actions.subscription.get()
							console.log("[HostSubscription] subscription details", subscriptionDetails)

							// Calculate billing dates
							const startDate = new Date()
							const nextBillingDate = new Date(startDate)
							nextBillingDate.setMonth(nextBillingDate.getMonth() + 1)

							// Save subscription to Firestore
							const subscriptionData = {
								userId: currentUser.uid,
								planId: selectedPlan, // Set to premium
								planName: plan.name,
								price: plan.price,
								status: "active",
								paypalSubscriptionId: data.subscriptionID,
								paypalOrderId: data.orderID,
								paypalPlanId: subscriptionDetails?.plan_id || null,
								startDate: serverTimestamp(),
								nextBillingDate: nextBillingDate,
								billingCycle: "monthly",
								createdAt: serverTimestamp(),
							}

							// Save to subscriptions collection
							const subscriptionDocRef = await addDoc(
								collection(db, "subscriptions"),
								subscriptionData
							)

							// Update user document - SET TO PREMIUM
							await updateDoc(doc(db, "users", currentUser.uid), {
								subscription: {
									planId: "premium", // Ensure it's set to premium
									planName: plan.name,
									price: plan.price,
									status: "active",
									startDate: startDate,
									nextBillingDate: nextBillingDate,
									paypalSubscriptionId: data.subscriptionID,
									maxListings: -1, // Unlimited for premium
								},
							})

							// Update subscription state
							setSubscription({
								...subscriptionData,
								id: subscriptionDocRef.id,
							})

							toast.success(
								`🎉 ${plan.name} subscription activated successfully! You now have access to premium features.`
							)
							setSelectedPlan(null)

							// Refresh subscription data
							setTimeout(() => {
								fetchSubscription()
							}, 1000)
						} catch (error) {
							console.error("Subscription activation error:", error)
							toast.error(
								"Failed to activate subscription. Please contact support if payment was processed."
							)
						} finally {
							setIsProcessing(false)
						}
					},
					onError: (err) => {
						console.error("PayPal subscription error:", err)
						toast.error("Payment processing failed. Please try again.")
						setIsProcessing(false)
						setSelectedPlan(null)
					},
					onCancel: () => {
						toast("Subscription cancelled", { type: "info" })
						setSelectedPlan(null)
					},
				})

				paypalButtonsInstanceRef.current = buttons
				buttons.render(paypalRef.current)
			} catch (e) {
				console.error("[HostSubscription] Failed to render PayPal Buttons:", e)
				toast.error("Failed to initialize PayPal buttons. Please try again.")
			}

			// Cleanup handler to avoid duplicate buttons
			return () => {
				try {
					if (paypalRef.current) {
						paypalRef.current.innerHTML = ""
					}
					paypalButtonsInstanceRef.current = null
				} catch (cleanupErr) {
					console.warn("[HostSubscription] Cleanup warning:", cleanupErr)
				}
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedPlan, isPayPalLoaded, currentUser])

	const handleCancelSubscription = async () => {
		if (
			!window.confirm(
				"Are you sure you want to cancel your subscription? You'll lose access to premium features at the end of your billing period."
			)
		) {
			return
		}

		try {
			setIsProcessing(true)

			// Calculate when the subscription will actually expire (end of current billing period)
			const nextBillingDate = subscription?.nextBillingDate
				? subscription.nextBillingDate.toDate
					? subscription.nextBillingDate.toDate()
					: new Date(subscription.nextBillingDate)
				: null

			const expiryDate = nextBillingDate || new Date()

			// If there's a PayPal subscription, cancel it via PayPal API
			if (subscription?.paypalSubscriptionId) {
				try {
					// Note: This requires a backend endpoint to cancel PayPal subscriptions
					// For now, we'll just mark it as cancelling in Firestore
					// In production, create an API endpoint: POST /api/cancel-subscription
					console.log(
						`PayPal subscription ID to cancel: ${subscription.paypalSubscriptionId}`
					)
					// TODO: Call backend API to cancel PayPal subscription
					// await fetch('/api/cancel-subscription', {
					//   method: 'POST',
					//   headers: { 'Content-Type': 'application/json' },
					//   body: JSON.stringify({ subscriptionId: subscription.paypalSubscriptionId })
					// })
				} catch (paypalError) {
					console.error("Error cancelling PayPal subscription:", paypalError)
					// Continue with Firestore cancellation even if PayPal cancellation fails
				}
			}

			// Mark subscription as cancelling (will expire at end of billing period)
			// User keeps premium access until expiryDate
			await updateDoc(doc(db, "users", currentUser.uid), {
				"subscription.status": "cancelling",
				"subscription.cancelledAt": serverTimestamp(),
				"subscription.expiryDate": expiryDate,
				// Keep premium access until expiry
				"subscription.planId": "premium",
				"subscription.planName": "Premium",
				"subscription.price": subscription?.price || 999,
			})

			// Update subscription document if exists
			if (subscription?.id) {
				await updateDoc(doc(db, "subscriptions", subscription.id), {
					status: "cancelling",
					cancelledAt: serverTimestamp(),
					expiryDate: expiryDate,
				})
			}

			// Update local state - keep premium access until expiry
			setSubscription({
				...subscription,
				status: "cancelling",
				cancelledAt: new Date(),
				expiryDate: expiryDate,
			})

			toast.success(
				`Subscription cancelled successfully. You'll continue to have premium access until ${formatDate(
					expiryDate
				)}.`
			)
		} catch (error) {
			console.error("Error cancelling subscription:", error)
			toast.error("Failed to cancel subscription")
		} finally {
			setIsProcessing(false)
		}
	}

	const formatDate = (date) => {
		if (!date) return "N/A"
		const d = date?.toDate ? date.toDate() : new Date(date)
		return d.toLocaleDateString("en-US", {
			year: "numeric",
			month: "long",
			day: "numeric",
		})
	}

	if (loading) {
		return (
			<div className="subscription-loading">
				<div className="loading-spinner"></div>
				<p>Loading subscription...</p>
			</div>
		)
	}

	return (
		<div className="host-subscription-page">
			<div className="subscription-container">
				{/* Back Button */}
				<button
					className="host-subscription-back-btn"
					onClick={() => navigate("/dashboardHost")}
				>
					<FaArrowLeft /> Back to Dashboard
				</button>

				{/* Header */}
				<div className="subscription-header">
					<h1>
						<FaCrown /> Host Subscription Plans
					</h1>
					<p>Choose the perfect plan to grow your hosting business</p>
				</div>

				{/* Current Subscription Status */}
				{subscription && subscription.status === "active" && (
					<div className="current-subscription-banner">
						<div className="banner-content">
							<FaCrown className="crown-icon" />
							<div className="banner-info">
								<h3>
									{subscription.planName || subscription.planId} Plan Active
								</h3>
								<p>
									{subscription.price === 0 || !subscription.nextBillingDate
										? "Free plan - No billing required"
										: `Next billing: ${formatDate(
												subscription.nextBillingDate
										  )}`}
								</p>
							</div>
						</div>
						{/* Only show cancel button for premium subscriptions */}
						{subscription.planId === "premium" && subscription.price > 0 && (
							<button
								className="cancel-subscription-btn"
								onClick={handleCancelSubscription}
								disabled={isProcessing}
							>
								Cancel Subscription
							</button>
						)}
					</div>
				)}

				{/* Subscription Plans */}
				<div className="subscription-plans">
					{plans.map((plan) => (
						<div
							key={plan.id}
							className={`plan-card ${plan.popular ? "popular" : ""} ${
								subscription?.planId === plan.id &&
								subscription?.status === "active"
									? "active"
									: ""
							}`}
						>
							{subscription?.planId === plan.id &&
								subscription?.status === "active" && (
									<div className="active-badge">Current Plan</div>
								)}

							<div className="plan-header">
								<h3>{plan.name}</h3>
								<div className="plan-price">
									{plan.price === 0 || plan.isFree ? (
										<span className="price-amount free-price">FREE</span>
									) : (
										<>
											<span className="subscription-price-amount">
												₱{plan.price}
											</span>
											<span className="price-period">/month</span>
										</>
									)}
								</div>
							</div>

							<ul className="plan-features">
								{plan.features.map((feature, index) => (
									<li key={index}>
										<FaCheck className="check-icon" />
										{feature}
									</li>
								))}
							</ul>

							{subscription?.planId === plan.id &&
							subscription?.status === "active" ? (
								<button className="plan-button current" disabled>
									Current Plan
								</button>
							) : plan.id === "standard" && plan.price === 0 ? (
								// Free plan is always active by default
								<button className="plan-button current" disabled>
									Default Plan
								</button>
							) : (
								<>
									<button
										className="plan-button"
										onClick={(e) => {
											// Ensure no unintended navigation/refresh happens
											if (e && typeof e.preventDefault === "function") e.preventDefault()
											if (e && typeof e.stopPropagation === "function") e.stopPropagation()
											console.log("[HostSubscription] <button.plan-button> clicked", {
												planId: plan.id,
											})
											handleSubscribe(plan.id)
										}}
										disabled={isProcessing || (plan.id !== "standard" && (!getPaypalPlanId()))}
									>
										{isProcessing && selectedPlan === plan.id ? (
											<>
												<FaCreditCard /> Processing...
											</>
										) : (
											<>Subscribe Now</>
										)}
									</button>

									{/* Inline guidance if premium plan ID is missing */}
									{plan.id !== "standard" && !getPaypalPlanId() && (
										<p className="plan-warning" style={{ marginTop: "8px", color: "#c05621", fontSize: "0.9rem" }}>
											Subscription plan not configured. Set VITE_PAYPAL_PREMIUM_PLAN_ID in .env.local
										</p>
									)}

									{selectedPlan === plan.id &&
										plan.price > 0 &&
										!plan.isFree && (
											<div className="paypal-container">
												<div ref={paypalRef}></div>
											</div>
										)}
								</>
							)}
						</div>
					))}
				</div>

				{/* FAQ Section */}
				<div className="subscription-faq">
					<h2>Frequently Asked Questions</h2>
					<div className="faq-grid">
						<div className="faq-item">
							<h4>How does monthly billing work?</h4>
							<p>
								Your subscription will be automatically renewed every month.
								You'll be charged on the same date each month. You can cancel
								anytime, and you'll continue to have access until the end of
								your billing period.
							</p>
						</div>
						<div className="faq-item">
							<h4>Can I change plans later?</h4>
							<p>
								Yes! You can upgrade or downgrade your plan at any time. Changes
								will take effect immediately, and you'll be charged or credited
								the difference.
							</p>
						</div>
						<div className="faq-item">
							<h4>What payment methods do you accept?</h4>
							<p>
								We currently accept PayPal for subscription payments. Your
								PayPal account will be automatically charged each month.
							</p>
						</div>
						<div className="faq-item">
							<h4>Can I cancel anytime?</h4>
							<p>
								Absolutely! You can cancel your subscription at any time. You'll
								continue to have access to premium features until the end of
								your current billing period.
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
