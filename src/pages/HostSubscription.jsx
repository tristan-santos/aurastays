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
	FaWallet,
	FaBars,
	FaUser,
	FaSignOutAlt,
	FaEnvelope,
} from "react-icons/fa"
import "../css/HostSubscription.css"
import "../css/DashboardHost.css"
import logoPlain from "../assets/logoPlain.png"

export default function HostSubscription() {
	const navigate = useNavigate()
	const { currentUser, userData, logout } = useAuth()
	const [subscription, setSubscription] = useState(null)
	const [loading, setLoading] = useState(true)
	const [selectedPlan, setSelectedPlan] = useState(null)
	const [isProcessing, setIsProcessing] = useState(false)
	const [isPayPalLoaded, setIsPayPalLoaded] = useState(false)
	const paypalRef = useRef(null)
	const paypalButtonsInstanceRef = useRef(null)
	
	// Payment method state
	const [paymentMethod, setPaymentMethod] = useState("paypal") // "paypal" or "wallet"
	const [walletBalance, setWalletBalance] = useState(0)
	
	// Header state
	const [isMenuOpen, setIsMenuOpen] = useState(false)
	const [theme, setTheme] = useState(localStorage.getItem("theme") || "light")
	const [userSubscription, setUserSubscription] = useState(null)
	
	// Promo code states
	const [promoCode, setPromoCode] = useState("")
	const [appliedPromo, setAppliedPromo] = useState(null)
	const [promoDiscount, setPromoDiscount] = useState(0)
	const [isValidatingPromo, setIsValidatingPromo] = useState(false)
	
	// Get user's display name
	const displayName =
		userData?.displayName || currentUser?.displayName || "Host User"
	const userEmail = userData?.email || currentUser?.email || ""

	// Get initials for default avatar
	const getInitials = (name) => {
		return name
			.split(" ")
			.map((n) => n[0])
			.join("")
			.toUpperCase()
			.slice(0, 2)
	}

	// Theme effect
	useEffect(() => {
		document.documentElement.setAttribute("data-theme", theme)
		localStorage.setItem("theme", theme)
	}, [theme])

	// Close menu when clicking outside
	useEffect(() => {
		const handleClickOutside = (event) => {
			if (isMenuOpen && !event.target.closest(".user-menu")) {
				setIsMenuOpen(false)
			}
		}

		document.addEventListener("mousedown", handleClickOutside)
		return () => {
			document.removeEventListener("mousedown", handleClickOutside)
		}
	}, [isMenuOpen])

	// Toggle theme
	const toggleTheme = (newTheme) => {
		setTheme(newTheme)
	}

	const handleLogout = async () => {
		try {
			await logout()
			navigate("/")
		} catch (error) {
			console.error("Error logging out:", error)
		}
	}

	// Get appropriate dashboard route based on user type
	const getDashboardRoute = () => {
		if (!userData?.userType) return "/dashboardHost"
		if (userData.userType === "admin") return "/admin"
		if (userData.userType === "host") return "/dashboardHost"
		return "/dashboardGuest"
	}

	// Fetch user subscription status for header
	const fetchUserSubscription = async () => {
		if (!currentUser?.uid) return

		try {
			const userDoc = await getDoc(doc(db, "users", currentUser.uid))
			if (userDoc.exists()) {
				const userDocData = userDoc.data()
				const subscription = userDocData.subscription || null
				setUserSubscription(subscription)
			}
		} catch (error) {
			console.error("Error fetching subscription:", error)
		}
	}

	// Check if user is in free trial mode
	const isFreeTrial = () => {
		if (!userSubscription || hasPremium()) return false
		if (userSubscription.planId === "standard" || !userSubscription.planId) {
			if (currentUser?.metadata?.creationTime) {
				const createdAt = new Date(currentUser.metadata.creationTime)
				const now = new Date()
				const daysSinceCreation = (now - createdAt) / (1000 * 60 * 60 * 24)
				return daysSinceCreation <= 14
			}
		}
		return false
	}

	// Check if user has premium subscription
	const hasPremium = () => {
		if (!userSubscription) return false
		if (userSubscription.planId === "premium") {
			if (userSubscription.status === "active") {
				return true
			}
			if (
				userSubscription.status === "cancelling" &&
				userSubscription.expiryDate
			) {
				const expiryDate = userSubscription.expiryDate.toDate
					? userSubscription.expiryDate.toDate()
					: new Date(userSubscription.expiryDate)
				const now = new Date()
				return expiryDate > now
			}
		}
		return false
	}

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
		fetchWalletBalance()
		fetchUserSubscription()
		loadPayPalSDK()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentUser])

	// Refresh wallet balance when payment method changes to wallet
	useEffect(() => {
		if (paymentMethod === "wallet" && currentUser?.uid) {
			fetchWalletBalance()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [paymentMethod])

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

	// Process recurring wallet payment
	const processRecurringWalletPayment = async (subscription, amount) => {
		try {
			const userRef = doc(db, "users", currentUser.uid)
			const userDoc = await getDoc(userRef)
			const currentBalance = userDoc.data()?.walletBalance || 0
			const newBalance = currentBalance - amount

			// Deduct from wallet
			await updateDoc(userRef, {
				walletBalance: newBalance,
			})

			// Record wallet transaction
			await addDoc(collection(db, "walletTransactions"), {
				userId: currentUser.uid,
				type: "subscription_payment",
				amount: amount,
				planId: subscription.planId,
				planName: subscription.planName,
				balanceBefore: currentBalance,
				balanceAfter: newBalance,
				status: "completed",
				isRecurring: true,
				createdAt: serverTimestamp(),
			})

			// Calculate next billing date
			const nextBillingDate = new Date()
			nextBillingDate.setMonth(nextBillingDate.getMonth() + 1)

			// Update subscription
			await updateDoc(userRef, {
				"subscription.nextBillingDate": nextBillingDate,
				"subscription.lastPaymentDate": serverTimestamp(),
			})

			// Update subscription document
			const subscriptionsQuery = query(
				collection(db, "subscriptions"),
				where("userId", "==", currentUser.uid),
				where("status", "==", "active")
			)
			const subscriptionsSnapshot = await getDocs(subscriptionsQuery)
			if (!subscriptionsSnapshot.empty) {
				await updateDoc(
					doc(db, "subscriptions", subscriptionsSnapshot.docs[0].id),
					{
						nextBillingDate: nextBillingDate,
						lastPaymentDate: serverTimestamp(),
					}
				)
			}

			// Update wallet balance in state
			setWalletBalance(newBalance)

			console.log("[HostSubscription] Recurring wallet payment processed successfully")
		} catch (error) {
			console.error("Error processing recurring wallet payment:", error)
			throw error
		}
	}

	const fetchWalletBalance = async () => {
		if (!currentUser?.uid) return

		try {
			// First check if userData from context has walletBalance (might be more up-to-date)
			if (userData?.walletBalance !== undefined) {
				const balance = Number(userData.walletBalance) || 0
				console.log("[HostSubscription] Wallet balance from userData context:", balance)
				setWalletBalance(balance)
			}

			// Always fetch from Firestore to ensure we have the latest
			const userDoc = await getDoc(doc(db, "users", currentUser.uid))
			if (userDoc.exists()) {
				const userDocData = userDoc.data()
				const balance = Number(userDocData?.walletBalance) || 0
				console.log("[HostSubscription] Wallet balance fetched from Firestore:", balance, "Raw value:", userDocData?.walletBalance)
				setWalletBalance(balance)
			} else {
				console.warn("[HostSubscription] User document not found")
				// Fallback to userData from context if available
				if (userData?.walletBalance !== undefined) {
					setWalletBalance(Number(userData.walletBalance) || 0)
				} else {
					setWalletBalance(0)
				}
			}
		} catch (error) {
			console.error("Error fetching wallet balance:", error)
			// Fallback to userData from context if available
			if (userData?.walletBalance !== undefined) {
				setWalletBalance(Number(userData.walletBalance) || 0)
			} else {
				setWalletBalance(0)
			}
		}
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

					// Active subscription - check for recurring wallet payments
					if (sub.status === "active") {
						// Check if it's a wallet subscription and needs renewal
						if (sub.paymentMethod === "wallet" && sub.nextBillingDate) {
							const nextBilling = sub.nextBillingDate.toDate
								? sub.nextBillingDate.toDate()
								: new Date(sub.nextBillingDate)
							const now = new Date()
							const daysUntilBilling = Math.ceil((nextBilling - now) / (1000 * 60 * 60 * 24))

							// Check wallet balance 2 days before billing
							if (daysUntilBilling <= 2 && daysUntilBilling >= 0) {
								const walletBalance = userData?.walletBalance || 0
								const subscriptionPrice = sub.price || 999

								if (walletBalance < subscriptionPrice) {
									// Insufficient balance - revoke subscription
									await updateDoc(doc(db, "users", currentUser.uid), {
										subscription: {
											planId: "standard",
											planName: "Standard",
											price: 0,
											status: "revoked",
											revokedAt: serverTimestamp(),
											revokedReason: "insufficient_wallet_balance",
											startDate: sub.startDate,
											nextBillingDate: null,
										},
									})

									// Update subscription document
									const subscriptionsQuery = query(
										collection(db, "subscriptions"),
										where("userId", "==", currentUser.uid),
										where("status", "==", "active")
									)
									const subscriptionsSnapshot = await getDocs(subscriptionsQuery)
									if (!subscriptionsSnapshot.empty) {
										await updateDoc(
											doc(db, "subscriptions", subscriptionsSnapshot.docs[0].id),
											{
												status: "revoked",
												revokedAt: serverTimestamp(),
												revokedReason: "insufficient_wallet_balance",
											}
										)
									}

									setSubscription({
										planId: "standard",
										planName: "Standard",
										price: 0,
										status: "revoked",
									})
									setLoading(false)
									toast.error(
										"Subscription revoked due to insufficient wallet balance. Please add funds and resubscribe."
									)
									return
								}
							}

							// Process recurring payment if billing date has passed
							if (nextBilling <= now) {
								const walletBalance = userData?.walletBalance || 0
								const subscriptionPrice = sub.price || 999

								if (walletBalance >= subscriptionPrice) {
									// Process recurring payment
									await processRecurringWalletPayment(sub, subscriptionPrice)
									// Update subscription with new billing date
									const updatedSub = {
										...sub,
										nextBillingDate: (() => {
											const next = new Date()
											next.setMonth(next.getMonth() + 1)
											return next
										})(),
									}
									setSubscription(updatedSub)
									setLoading(false)
									toast.success("Recurring payment processed successfully!")
									return
								} else {
									// Insufficient balance - revoke subscription
									await updateDoc(doc(db, "users", currentUser.uid), {
										subscription: {
											planId: "standard",
											planName: "Standard",
											price: 0,
											status: "revoked",
											revokedAt: serverTimestamp(),
											revokedReason: "insufficient_wallet_balance",
											startDate: sub.startDate,
											nextBillingDate: null,
										},
									})

									// Update subscription document
									const subscriptionsQuery = query(
										collection(db, "subscriptions"),
										where("userId", "==", currentUser.uid),
										where("status", "==", "active")
									)
									const subscriptionsSnapshot = await getDocs(subscriptionsQuery)
									if (!subscriptionsSnapshot.empty) {
										await updateDoc(
											doc(db, "subscriptions", subscriptionsSnapshot.docs[0].id),
											{
												status: "revoked",
												revokedAt: serverTimestamp(),
												revokedReason: "insufficient_wallet_balance",
											}
										)
									}

									setSubscription({
										planId: "standard",
										planName: "Standard",
										price: 0,
										status: "revoked",
									})
									setLoading(false)
									toast.error(
										"Subscription revoked due to insufficient wallet balance. Please add funds and resubscribe."
									)
									return
								}
							}
						}

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
				where("status", "in", ["active", "pending", "cancelling", "revoked"])
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
			paymentMethod,
		})
		const plan = plans.find((p) => p.id === planId)
		if (!plan) {
			console.warn("[HostSubscription] Plan not found for planId:", planId)
			return
		}
		console.log("[HostSubscription] Resolved plan:", plan)

		// Check if user has a cancelled subscription that hasn't expired yet
		if (subscription?.status === "cancelling" && subscription?.expiryDate) {
			const expiryDate = subscription.expiryDate.toDate
				? subscription.expiryDate.toDate()
				: new Date(subscription.expiryDate)
			const now = new Date()

			// If subscription hasn't expired, allow resubscription
			if (expiryDate > now) {
				// Resubscribe - reactivate the subscription
				setIsProcessing(true)
				try {
					const userRef = doc(db, "users", currentUser.uid)
					const userDoc = await getDoc(userRef)
					const currentBalance = userDoc.data()?.walletBalance || 0
					const finalPrice = plan.price - promoDiscount

					if (paymentMethod === "wallet" && currentBalance < finalPrice) {
						toast.error(`Insufficient wallet balance. You need ₱${finalPrice.toLocaleString()}, but you have ₱${currentBalance.toLocaleString()}.`)
						setIsProcessing(false)
						return
					}

					// Calculate new billing dates
					const startDate = new Date()
					const nextBillingDate = new Date(startDate)
					nextBillingDate.setMonth(nextBillingDate.getMonth() + 1)

					if (paymentMethod === "wallet") {
						const newBalance = currentBalance - finalPrice

						// Deduct from wallet
						await updateDoc(userRef, {
							walletBalance: newBalance,
						})

						// Record wallet transaction
						await addDoc(collection(db, "walletTransactions"), {
							userId: currentUser.uid,
							type: "subscription_payment",
							amount: finalPrice,
							planId: planId,
							planName: plan.name,
							balanceBefore: currentBalance,
							balanceAfter: newBalance,
							status: "completed",
							isResubscription: true,
							createdAt: serverTimestamp(),
						})

						setWalletBalance(newBalance)
					}

					// Reactivate subscription
					await updateDoc(userRef, {
						subscription: {
							planId: planId,
							planName: plan.name,
							price: finalPrice,
							status: "active",
							paymentMethod: paymentMethod,
							startDate: startDate,
							nextBillingDate: nextBillingDate,
							maxListings: plan.maxListings,
							reactivatedAt: serverTimestamp(),
						},
					})

					// Update subscription document
					const subscriptionsQuery = query(
						collection(db, "subscriptions"),
						where("userId", "==", currentUser.uid)
					)
					const subscriptionsSnapshot = await getDocs(subscriptionsQuery)
					if (!subscriptionsSnapshot.empty) {
						await updateDoc(
							doc(db, "subscriptions", subscriptionsSnapshot.docs[0].id),
							{
								status: "active",
								planId: planId,
								planName: plan.name,
								price: finalPrice,
								paymentMethod: paymentMethod,
								startDate: serverTimestamp(),
								nextBillingDate: nextBillingDate,
								reactivatedAt: serverTimestamp(),
							}
						)
					}

					setSubscription({
						planId: planId,
						planName: plan.name,
						price: finalPrice,
						status: "active",
						paymentMethod: paymentMethod,
						startDate: startDate,
						nextBillingDate: nextBillingDate,
					})

					toast.success(
						`🎉 Subscription reactivated successfully! You'll continue to have premium access.`
					)
					setSelectedPlan(null)
					setTimeout(() => {
						fetchSubscription()
						fetchWalletBalance()
					}, 1000)
				} catch (error) {
					console.error("Error reactivating subscription:", error)
					toast.error("Failed to reactivate subscription. Please try again.")
				} finally {
					setIsProcessing(false)
				}
				return
			}
		}

		// If it's a free plan, activate immediately without payment
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

		// For paid plans, check payment method
		if (paymentMethod === "wallet") {
			// Handle e-wallet payment
			await handleWalletPayment(planId)
		} else {
			// For PayPal payment
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
	}

	const handleWalletPayment = async (planId) => {
		const plan = plans.find((p) => p.id === planId)
		if (!plan) return

		const finalPrice = plan.price - promoDiscount
		
		// Check wallet balance
		if (walletBalance < finalPrice) {
			toast.error(`Insufficient wallet balance. You need ₱${finalPrice.toLocaleString()}, but you have ₱${walletBalance.toLocaleString()}.`)
			return
		}

		setIsProcessing(true)
		setSelectedPlan(planId)

		try {
			toast("Processing subscription payment from wallet...", { type: "info" })

			// Get current wallet balance
			const userRef = doc(db, "users", currentUser.uid)
			const userDoc = await getDoc(userRef)
			const currentBalance = userDoc.data()?.walletBalance || 0
			const newBalance = currentBalance - finalPrice

			// Calculate billing dates
			const startDate = new Date()
			const nextBillingDate = new Date(startDate)
			nextBillingDate.setMonth(nextBillingDate.getMonth() + 1)

			// Deduct from wallet
			await updateDoc(userRef, {
				walletBalance: newBalance,
			})

			// Record wallet transaction
			await addDoc(collection(db, "walletTransactions"), {
				userId: currentUser.uid,
				type: "subscription_payment",
				amount: finalPrice,
				planId: planId,
				planName: plan.name,
				balanceBefore: currentBalance,
				balanceAfter: newBalance,
				status: "completed",
				createdAt: serverTimestamp(),
			})

			// Save subscription to Firestore
			const subscriptionData = {
				userId: currentUser.uid,
				planId: planId,
				planName: plan.name,
				price: finalPrice,
				status: "active",
				paymentMethod: "wallet",
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

			// Update user document
			await updateDoc(doc(db, "users", currentUser.uid), {
				subscription: {
					planId: planId,
					planName: plan.name,
					price: finalPrice,
					status: "active",
					paymentMethod: "wallet",
					startDate: startDate,
					nextBillingDate: nextBillingDate,
					maxListings: plan.maxListings,
				},
			})

			// Update subscription state
			setSubscription({
				...subscriptionData,
				id: subscriptionDocRef.id,
			})

			// Update wallet balance in state
			setWalletBalance(newBalance)

			toast.success(
				`🎉 ${plan.name} subscription activated successfully! ₱${finalPrice.toLocaleString()} deducted from your wallet.`
			)
			setSelectedPlan(null)

			// Refresh subscription data
			setTimeout(() => {
				fetchSubscription()
				fetchWalletBalance()
			}, 1000)
		} catch (error) {
			console.error("Wallet payment error:", error)
			toast.error("Failed to process wallet payment. Please try again.")
		} finally {
			setIsProcessing(false)
		}
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
		<div className="host-dashboard-wrapper">
			{/* Header */}
			<header className="host-dashboard-header">
				<div className="host-header-inner">
					<div className="host-dashboard-title" onClick={() => navigate(getDashboardRoute())} style={{ cursor: "pointer" }}>
						<img src={logoPlain} alt="AuraStays" />
						<span className="logo-text">AuraStays</span>
					</div>
					<div className="host-user-info">
						<span className="host-user-name">{displayName.split(" ")[0]}</span>
						{isFreeTrial() && (
							<span className="host-plan-badge free-trial">
								⏱️ Free Trial
							</span>
						)}
						{userSubscription && !isFreeTrial() && (
							<span
								className={`host-plan-badge ${
									userSubscription.planId === "premium" ? "premium" : "free"
								}`}
							>
								{userSubscription.planId === "premium" && (
									<FaCrown className="plan-icon" />
								)}
								{userSubscription.planId === "premium"
									? "Premium"
									: "Free Plan"}
							</span>
						)}
					</div>
					<div className="host-header-buttons">
						{/* Messages */}
						<button
							className="host-icon-button host-messages-btn"
							title="Messages"
							onClick={() => navigate("/hostMessage")}
						>
							<FaEnvelope />
						</button>
						{/* User Menu */}
						<div className="user-menu">
							<button
								className="user-menu-button"
								onClick={() => setIsMenuOpen(!isMenuOpen)}
							>
								<FaBars className="menu-icon" />
								<div className="user-avatar">
									{userData?.photoURL || currentUser?.photoURL ? (
										<img
											src={userData?.photoURL || currentUser.photoURL}
											alt={displayName}
										/>
									) : (
										<div className="avatar-initials">
											{getInitials(displayName)}
										</div>
									)}
								</div>
							</button>

							{/* Dropdown Menu */}
							{isMenuOpen && (
								<div
									className="user-dropdown"
									onClick={(e) => e.stopPropagation()}
								>
									<div className="dropdown-header">
										<div className="dropdown-avatar">
											{userData?.photoURL || currentUser?.photoURL ? (
												<img
													src={userData?.photoURL || currentUser.photoURL}
													alt={displayName}
												/>
											) : (
												<div className="avatar-initials-large">
													{getInitials(displayName)}
												</div>
											)}
										</div>
										<div className="dropdown-info">
											<div className="dropdown-name">{displayName}</div>
											<div className="dropdown-email">{userEmail}</div>
										</div>
									</div>

									<div className="dropdown-divider"></div>

									<button
										className="dropdown-item"
										onClick={() => {
											navigate("/host/subscription")
											setIsMenuOpen(false)
										}}
									>
										<FaCrown />
										<span>Subscription</span>
									</button>
									<button
										className="dropdown-item"
										onClick={() => {
											navigate("/profile")
											setIsMenuOpen(false)
										}}
									>
										<FaUser />
										<span>My Profile</span>
									</button>
									<div className="dropdown-theme-section">
										<span className="theme-label">THEME</span>
										<div className="theme-buttons">
											<button
												className={`theme-btn ${
													theme === "light" ? "active" : ""
												}`}
												onClick={() => toggleTheme("light")}
											>
												☀️ Light
											</button>
											<button
												className={`theme-btn ${
													theme === "dark" ? "active" : ""
												}`}
												onClick={() => toggleTheme("dark")}
											>
												🌙 Dark
											</button>
										</div>
									</div>

									<div className="dropdown-divider"></div>

									<button
										className="dropdown-item logout"
										onClick={handleLogout}
									>
										<FaSignOutAlt />
										<span>Logout</span>
									</button>
								</div>
							)}
						</div>
					</div>
				</div>
			</header>

			<main className="dashboard-main">
				<div className="host-subscription-page">
					<div className="subscription-container">
						{/* Page Header */}
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
								<FaTimes /> Cancel Subscription
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
							) : subscription?.status === "cancelling" &&
							  subscription?.planId === plan.id &&
							  subscription?.expiryDate ? (
								<button
									className="plan-button"
									onClick={(e) => {
										if (e && typeof e.preventDefault === "function") e.preventDefault()
										if (e && typeof e.stopPropagation === "function") e.stopPropagation()
										handleSubscribe(plan.id)
									}}
									disabled={isProcessing}
								>
									{isProcessing && selectedPlan === plan.id ? (
										<>
											{paymentMethod === "wallet" ? <FaWallet /> : <FaCreditCard />} Reactivating...
										</>
									) : (
										<>Resubscribe Now</>
									)}
								</button>
							) : plan.id === "standard" && plan.price === 0 ? (
								// Free plan is always active by default
								<button className="plan-button current" disabled>
									Default Plan
								</button>
							) : (
								<>
									{/* Payment Method Selection */}
									{plan.price > 0 && !plan.isFree && (
										<div className="payment-method-selector">
											<label className="payment-method-label">Payment Method:</label>
											<div className="payment-method-options">
												<button
													className={`payment-method-btn ${paymentMethod === "paypal" ? "active" : ""}`}
													onClick={() => setPaymentMethod("paypal")}
													disabled={isProcessing}
												>
													<FaCreditCard /> PayPal
												</button>
												<button
													className={`payment-method-btn ${paymentMethod === "wallet" ? "active" : ""}`}
													onClick={() => setPaymentMethod("wallet")}
													disabled={isProcessing}
												>
													<FaWallet /> E-Wallet
													{walletBalance > 0 && (
														<span className="wallet-balance-badge">
															₱{walletBalance.toLocaleString()}
														</span>
													)}
												</button>
											</div>
											{paymentMethod === "wallet" && (
												<div className="wallet-payment-info">
													<p className="wallet-balance-text">
														Wallet Balance: <strong>₱{walletBalance.toLocaleString()}</strong>
													</p>
													{walletBalance < plan.price && (
														<p className="wallet-insufficient" style={{ color: "#e74c3c", fontSize: "0.9rem", marginTop: "4px" }}>
															⚠️ Insufficient balance. You need ₱{(plan.price - walletBalance).toLocaleString()} more
														</p>
													)}
												</div>
											)}
										</div>
									)}

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
										disabled={
											isProcessing || 
											(plan.id !== "standard" && paymentMethod === "paypal" && !getPaypalPlanId()) ||
											(plan.id !== "standard" && paymentMethod === "wallet" && walletBalance < plan.price)
										}
									>
										{isProcessing && selectedPlan === plan.id ? (
											<>
												{paymentMethod === "wallet" ? <FaWallet /> : <FaCreditCard />} Processing...
											</>
										) : (
											<>Subscribe Now</>
										)}
									</button>

									{/* Inline guidance if premium plan ID is missing */}
									{plan.id !== "standard" && paymentMethod === "paypal" && !getPaypalPlanId() && (
										<p className="plan-warning" style={{ marginTop: "8px", color: "#c05621", fontSize: "0.9rem" }}>
											Subscription plan not configured. Set VITE_PAYPAL_PREMIUM_PLAN_ID in .env.local
										</p>
									)}

									{selectedPlan === plan.id &&
										plan.price > 0 &&
										!plan.isFree &&
										paymentMethod === "paypal" && (
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
								We accept PayPal and E-Wallet payments for subscriptions. You can
								pay using your PayPal account (automatic monthly billing) or use
								your e-wallet balance for one-time payments. E-wallet payments are
								instant and convenient!
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
			</main>
		</div>
	)
}
