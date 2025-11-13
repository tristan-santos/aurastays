import { useState, useEffect, useRef } from "react"
import { useAuth } from "../contexts/AuthContext"
import { db } from "./firebaseConfig"
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
import { getFirebaseErrorMessage } from "../utils/errorMessages"
import {
	FaWallet,
	FaPlus,
	FaTimes,
	FaHistory,
	FaArrowUp,
	FaArrowDown,
	FaMoneyBillWave,
	FaMinus,
	FaCoins,
	FaCrown,
} from "react-icons/fa"
import "../css/Wallet.css"
import { formatCurrency, formatCurrencyFull } from "../utils/currencyFormatter"

export default function Wallet() {
	const { currentUser } = useAuth()
	const [walletBalance, setWalletBalance] = useState(0)
	const [showTopUpModal, setShowTopUpModal] = useState(false)
	const [showWithdrawModal, setShowWithdrawModal] = useState(false)
	const [showTransactionsModal, setShowTransactionsModal] = useState(false)
	const [topUpAmount, setTopUpAmount] = useState("")
	const [withdrawAmount, setWithdrawAmount] = useState("")
	const [paypalEmail, setPaypalEmail] = useState("")
	const [isProcessing, setIsProcessing] = useState(false)
	const [isPayPalLoaded, setIsPayPalLoaded] = useState(false)
	const [transactions, setTransactions] = useState([])
	const [withdrawalFeePercent] = useState(1) // 1% withdrawal fee
	const paypalRef = useRef(null)
	const paypalWithdrawRef = useRef(null)

	useEffect(() => {
		if (currentUser) {
			fetchWalletBalance()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentUser])

	// Load PayPal SDK
	useEffect(() => {
		if ((showTopUpModal || showWithdrawModal) && !window.paypal) {
			const script = document.createElement("script")
			script.src = `https://www.paypal.com/sdk/js?client-id=${
				import.meta.env.VITE_PAYPAL_CLIENT_ID
			}&currency=PHP`
			script.async = true
			script.onload = () => {
				setIsPayPalLoaded(true)
			}
			script.onerror = () => {
				toast.error("Failed to load PayPal. Please try again.")
			}
			document.body.appendChild(script)
		} else if ((showTopUpModal || showWithdrawModal) && window.paypal) {
			setIsPayPalLoaded(true)
		}
	}, [showTopUpModal, showWithdrawModal])

	// Render PayPal button for top-up
	useEffect(() => {
		if (isPayPalLoaded && showTopUpModal && topUpAmount && paypalRef.current) {
			const amount = parseFloat(topUpAmount)
			if (amount < 100) {
				return
			}

			paypalRef.current.innerHTML = ""

			window.paypal
				.Buttons({
					createOrder: (data, actions) => {
						return actions.order.create({
							purchase_units: [
								{
									amount: {
										value: amount.toFixed(2),
										currency_code: "PHP",
									},
									description: `AuraStays Wallet Top-Up - ₱${amount.toFixed(
										2
									)}`,
								},
							],
						})
					},
					onApprove: async (data, actions) => {
						setIsProcessing(true)
						try {
							const details = await actions.order.capture()

							if (details.status === "COMPLETED") {
								await topUpWallet(amount, details.id)
								toast.success(
									`Successfully added ₱${amount.toFixed(2)} to your wallet!`
								)
								setShowTopUpModal(false)
								setTopUpAmount("")
							}
						} catch (error) {
							console.error("Top-up error:", error)
							toast.error("Failed to process top-up. Please try again.")
						} finally {
							setIsProcessing(false)
						}
					},
					onError: (err) => {
						console.error("PayPal error:", err)
						toast.error("Payment failed. Please try again.")
						setIsProcessing(false)
					},
					onCancel: () => {
						toast("Payment cancelled.")
					},
				})
				.render(paypalRef.current)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isPayPalLoaded, showTopUpModal, topUpAmount])

	// Render PayPal button for withdrawal
	useEffect(() => {
		if (
			isPayPalLoaded &&
			showWithdrawModal &&
			withdrawAmount &&
			paypalWithdrawRef.current
		) {
			const amount = parseFloat(withdrawAmount)
			if (amount < 100 || amount > walletBalance) {
				return
			}

			// Calculate amounts
			const fee = amount * (withdrawalFeePercent / 100)
			const amountAfterFee = amount - fee

			paypalWithdrawRef.current.innerHTML = ""

			// Note: In production, you'd use PayPal Payouts API
			// This is a simplified simulation
			const withdrawBtn = document.createElement("button")
			withdrawBtn.className = "paypal-withdraw-button"
			withdrawBtn.textContent = `Withdraw ₱${amountAfterFee.toFixed(
				2
			)} to PayPal`
			withdrawBtn.onclick = async () => {
				if (!paypalEmail || !paypalEmail.includes("@")) {
					toast.error("Please enter a valid PayPal email address")
					return
				}

				setIsProcessing(true)
				try {
					await withdrawWallet(amount, paypalEmail)
					toast.success(
						`Successfully withdrew ₱${amountAfterFee.toFixed(
							2
						)} to ${paypalEmail} (₱${fee.toFixed(2)} fee). Reloading...`
					)
					setShowWithdrawModal(false)
					setWithdrawAmount("")
					setPaypalEmail("")

					// Reload page after 2 seconds
					setTimeout(() => {
						window.location.reload()
					}, 2000)
				} catch (error) {
					console.error("Withdrawal error:", error)
					toast.error(getFirebaseErrorMessage(error))
					setIsProcessing(false)
				}
			}
			paypalWithdrawRef.current.appendChild(withdrawBtn)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isPayPalLoaded, showWithdrawModal, withdrawAmount, walletBalance])

	const fetchWalletBalance = async () => {
		try {
			const userDoc = await getDoc(doc(db, "users", currentUser.uid))
			if (userDoc.exists()) {
				const balance = userDoc.data().walletBalance || 0
				setWalletBalance(balance)
			}
		} catch (error) {
			console.error("Error fetching wallet balance:", error)
		}
	}

	const topUpWallet = async (amount, paymentId) => {
		try {
			const userRef = doc(db, "users", currentUser.uid)
			const userDoc = await getDoc(userRef)
			const currentBalance = userDoc.data()?.walletBalance || 0
			const newBalance = currentBalance + amount

			await updateDoc(userRef, {
				walletBalance: newBalance,
			})

			await addDoc(collection(db, "walletTransactions"), {
				userId: currentUser.uid,
				type: "top_up",
				amount: amount,
				paymentMethod: "paypal",
				paymentId: paymentId,
				balanceBefore: currentBalance,
				balanceAfter: newBalance,
				status: "completed",
				createdAt: serverTimestamp(),
			})

			setWalletBalance(newBalance)

			// Create notification for top-up
			try {
				const { createTopUpNotification } = await import("../utils/notifications")
				// Ensure amount is a number
				const amountNum = typeof amount === "number" ? amount : parseFloat(amount)
				if (!isNaN(amountNum)) {
					await createTopUpNotification(currentUser.uid, amountNum)
					console.log(`✅ Top-up notification created for ₱${amountNum}`)
				} else {
					console.error("Invalid amount for notification:", amount)
				}
			} catch (notifError) {
				console.error("Error creating top-up notification:", notifError)
				console.error("Notification error details:", {
					userId: currentUser.uid,
					amount: amount,
					error: notifError.message,
				})
				// Don't fail the top-up if notification fails
			}
		} catch (error) {
			console.error("Error updating wallet:", error)
			throw error
		}
	}

	const fetchTransactions = async () => {
		try {
			const q = query(
				collection(db, "walletTransactions"),
				where("userId", "==", currentUser.uid)
			)

			const snapshot = await getDocs(q)

			const txns = snapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			}))

			// Sort in-memory by createdAt (newest first) and limit to 20
			const sortedTxns = txns
				.sort((a, b) => {
					const timeA = a.createdAt?.toMillis
						? a.createdAt.toMillis()
						: new Date(a.createdAt).getTime()
					const timeB = b.createdAt?.toMillis
						? b.createdAt.toMillis()
						: new Date(b.createdAt).getTime()
					return timeB - timeA
				})
				.slice(0, 20)

			setTransactions(sortedTxns)
		} catch (error) {
			console.error("Error fetching transactions:", error)
			if (error.code !== "permission-denied" && error.code !== "not-found") {
				console.log("Transactions collection may not exist yet")
			}
			setTransactions([])
		}
	}

	const handleViewTransactions = () => {
		setShowTransactionsModal(true)
		fetchTransactions()
	}

	const formatDate = (timestamp) => {
		if (!timestamp) return "N/A"
		const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
		return date.toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		})
	}

	const withdrawWallet = async (amount, email) => {
		try {
			const userRef = doc(db, "users", currentUser.uid)
			const userDoc = await getDoc(userRef)
			const currentBalance = userDoc.data()?.walletBalance || 0

			const fee = amount * (withdrawalFeePercent / 100)
			const amountAfterFee = amount - fee
			const newBalance = currentBalance - amount

			if (newBalance < 0) {
				throw new Error("Insufficient balance")
			}

			if (!email || !email.includes("@")) {
				throw new Error("Please enter a valid PayPal email")
			}

			// Get admin account
			const preferredEmail =
				(import.meta?.env?.VITE_ADMIN_EMAIL || "").trim() ||
				"admin@aurastays.com"
			const {
				query: firestoreQuery,
				where,
				getDocs,
				limit,
			} = await import("firebase/firestore")
			console.log("[Wallet][Withdraw] Looking up admin account", {
				preferredEmail,
			})
			let adminSnapshot = await getDocs(
				firestoreQuery(
					collection(db, "users"),
					where("email", "==", preferredEmail),
					limit(1)
				)
			)
			if (adminSnapshot.empty) {
				adminSnapshot = await getDocs(
					firestoreQuery(
						collection(db, "users"),
						where("userType", "==", "admin"),
						limit(1)
					)
				)
			}
			if (adminSnapshot.empty) {
				adminSnapshot = await getDocs(
					firestoreQuery(
						collection(db, "users"),
						where("isAdmin", "==", true),
						limit(1)
					)
				)
			}

			if (adminSnapshot.empty) {
				console.warn(
					"[Wallet][Withdraw] Admin account not found for preferredEmail",
					preferredEmail
				)
				throw new Error("Admin account not found. Please contact support.")
			}

			const adminDoc = adminSnapshot.docs[0]
			const adminRef = doc(db, "users", adminDoc.id)
			const adminData = adminDoc.data()
			const adminCurrentBalance = adminData?.walletBalance || 0
			console.log("[Wallet][Withdraw] Admin doc found", {
				adminId: adminDoc.id,
				adminCurrentBalance,
			})

			// Check if admin has sufficient funds for payout
			if (adminCurrentBalance < amount) {
				throw new Error(
					"Insufficient admin funds for withdrawal. Please contact support."
				)
			}

			// Deduct from guest wallet
			await updateDoc(userRef, {
				walletBalance: newBalance,
			})

			// Deduct from admin wallet
			const adminNewBalance = adminCurrentBalance - amount
			await updateDoc(adminRef, {
				walletBalance: adminNewBalance,
			})

			// Record guest withdrawal transaction
			await addDoc(collection(db, "walletTransactions"), {
				userId: currentUser.uid,
				type: "withdrawal",
				amount: amount,
				fee: fee,
				amountReceived: amountAfterFee,
				paymentMethod: "paypal",
				paypalEmail: email,
				balanceBefore: currentBalance,
				balanceAfter: newBalance,
				processedBy: "admin",
				adminId: adminDoc.id,
				status: "completed",
				createdAt: serverTimestamp(),
			})

			// Record admin payout transaction
			await addDoc(collection(db, "walletTransactions"), {
				userId: adminDoc.id,
				type: "withdrawal_payout",
				amount: amount,
				fee: fee,
				amountPaidOut: amountAfterFee,
				paymentMethod: "paypal",
				recipientEmail: email,
				recipientId: currentUser.uid,
				balanceBefore: adminCurrentBalance,
				balanceAfter: adminNewBalance,
				status: "completed",
				createdAt: serverTimestamp(),
			})

			setWalletBalance(newBalance)
		} catch (error) {
			console.error("Error processing withdrawal:", error)
			throw error
		}
	}

	const getTransactionIcon = (type) => {
		switch (type) {
			case "top_up":
				return <FaArrowDown className="txn-icon green" />
			case "payment":
				return <FaArrowUp className="txn-icon red" />
			case "withdrawal":
				return <FaArrowUp className="txn-icon orange" />
			case "refund":
				return <FaArrowDown className="txn-icon blue" />
			case "refund_deduction":
				return <FaArrowUp className="txn-icon red" />
			case "booking_earning":
				return <FaArrowDown className="txn-icon green" />
			case "booking_received":
				return <FaArrowDown className="txn-icon green" />
			case "points_exchange":
				return <FaCoins className="txn-icon green" />
			case "subscription_payment":
				return <FaCrown className="txn-icon red" />
			default:
				return <FaMoneyBillWave className="txn-icon" />
		}
	}

	return (
		<div className="wallet-widget">
			<div className="wallet-header">
				<FaWallet className="wallet-icon" />
				<div className="wallet-balance-info">
					<span className="wallet-label">E-Wallet Balance</span>
					<span className="wallet-balance">
						{formatCurrencyFull(walletBalance)}
					</span>
				</div>
			</div>

			<div className="wallet-actions">
				<button
					className="wallet-btn primary"
					onClick={() => setShowTopUpModal(true)}
				>
					<FaPlus /> Top Up
				</button>
				<button
					className="wallet-btn withdraw"
					onClick={() => setShowWithdrawModal(true)}
				>
					<FaMinus /> Withdraw
				</button>
				<button
					className="wallet-btn secondary"
					onClick={handleViewTransactions}
				>
					<FaHistory /> History
				</button>
			</div>

			{/* Top-Up Modal */}
			{showTopUpModal && (
				<div className="modal-overlay" onClick={() => setShowTopUpModal(false)}>
					<div
						className="modal-content wallet-modal"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="modal-header">
							<h3>Top Up E-Wallet</h3>
							<button
								className="close-modal"
								onClick={() => setShowTopUpModal(false)}
							>
								<FaTimes />
							</button>
						</div>

						<div className="modal-body">
							<div className="topup-input-group">
								<label>Enter Amount</label>
								<div className="amount-input-wrapper">
									<span className="currency-symbol">₱</span>
									<input
										type="number"
										placeholder="Enter amount (min ₱100)"
										value={topUpAmount}
										onChange={(e) => setTopUpAmount(e.target.value)}
										min="100"
										step="100"
									/>
								</div>
							</div>

							<div className="quick-amounts">
								<span className="quick-label">Quick amounts:</span>
								<div className="quick-buttons">
									{[500, 1000, 2000, 5000].map((amt) => (
										<button
											key={amt}
											className="quick-amount-btn"
											onClick={() => setTopUpAmount(amt.toString())}
										>
											₱{amt}
										</button>
									))}
								</div>
							</div>

							{parseFloat(topUpAmount) >= 100 && (
								<div className="paypal-section">
									<p className="payment-instruction">
										Click below to pay with PayPal:
									</p>
									<div
										ref={paypalRef}
										className="paypal-button-container"
									></div>
									{isProcessing && (
										<div className="processing-overlay">
											<div className="spinner"></div>
											<p>Processing payment...</p>
										</div>
									)}
								</div>
							)}

							{topUpAmount && parseFloat(topUpAmount) < 100 && (
								<p className="error-message">Minimum top-up amount is ₱100</p>
							)}
						</div>
					</div>
				</div>
			)}

			{/* Withdraw Modal */}
			{showWithdrawModal && (
				<div
					className="modal-overlay"
					onClick={() => {
						setShowWithdrawModal(false)
						setPaypalEmail("")
						setWithdrawAmount("")
					}}
				>
					<div
						className="modal-content wallet-modal"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="modal-header">
							<h3>💰 Withdraw Funds</h3>
							<button
								className="close-modal"
								onClick={() => {
									setShowWithdrawModal(false)
									setPaypalEmail("")
									setWithdrawAmount("")
								}}
							>
								<FaTimes />
							</button>
						</div>

						<div className="modal-body">
							<div className="withdrawal-info-banner">
								<p>
									<strong>📌 Important:</strong> A {withdrawalFeePercent}%
									processing fee will be deducted from your withdrawal amount.
								</p>
							</div>

							<div className="current-balance-display">
								<span className="balance-label">Available Balance:</span>
								<span className="balance-value">
									{formatCurrencyFull(walletBalance)}
								</span>
							</div>

							<div className="topup-input-group">
								<label>Withdrawal Amount</label>
								<div className="amount-input-wrapper">
									<span className="currency-symbol">₱</span>
									<input
										type="number"
										placeholder="Enter amount (min ₱100)"
										value={withdrawAmount}
										onChange={(e) => setWithdrawAmount(e.target.value)}
										min="100"
										step="100"
										max={walletBalance}
									/>
								</div>
							</div>

							<div className="topup-input-group">
								<label>PayPal Email Address</label>
								<div className="amount-input-wrapper">
									<input
										type="email"
										placeholder="your.email@example.com"
										value={paypalEmail}
										onChange={(e) => setPaypalEmail(e.target.value)}
										style={{ paddingLeft: "16px" }}
									/>
								</div>
							</div>

							{withdrawAmount && parseFloat(withdrawAmount) >= 100 && (
								<div className="withdrawal-summary">
									<div className="summary-row">
										<span>Withdrawal Amount:</span>
										<strong>
											{formatCurrency(parseFloat(withdrawAmount) || 0)}
										</strong>
									</div>
									<div className="summary-row fee-row">
										<span>Processing Fee ({withdrawalFeePercent}%):</span>
										<strong className="fee-amount">
											-₱
											{(
												parseFloat(withdrawAmount) *
												(withdrawalFeePercent / 100)
											).toFixed(2)}
										</strong>
									</div>
									<div className="summary-row total-row">
										<span>You will receive:</span>
										<strong className="total-amount">
											₱
											{(
												parseFloat(withdrawAmount) -
												parseFloat(withdrawAmount) *
													(withdrawalFeePercent / 100)
											).toFixed(2)}
										</strong>
									</div>
								</div>
							)}

							{withdrawAmount && parseFloat(withdrawAmount) < 100 && (
								<p className="error-message">
									Minimum withdrawal amount is ₱100
								</p>
							)}

							{withdrawAmount && parseFloat(withdrawAmount) > walletBalance && (
								<p className="error-message">Insufficient balance</p>
							)}

							{parseFloat(withdrawAmount) >= 100 &&
								parseFloat(withdrawAmount) <= walletBalance &&
								paypalEmail &&
								paypalEmail.includes("@") && (
									<div className="paypal-section">
										<p className="payment-instruction">
											Withdraw to your PayPal account:
										</p>
										<div
											ref={paypalWithdrawRef}
											className="paypal-button-container"
										></div>
										{isProcessing && (
											<div className="processing-overlay">
												<div className="spinner"></div>
												<p>Processing withdrawal...</p>
											</div>
										)}
									</div>
								)}

							{withdrawAmount &&
								parseFloat(withdrawAmount) >= 100 &&
								parseFloat(withdrawAmount) <= walletBalance &&
								(!paypalEmail || !paypalEmail.includes("@")) && (
									<p className="error-message">
										Please enter a valid PayPal email address
									</p>
								)}

							<p className="withdrawal-note">
								💳 Funds will be transferred to your PayPal account instantly.
							</p>
						</div>
					</div>
				</div>
			)}

			{/* Transactions Modal */}
			{showTransactionsModal && (
				<div
					className="modal-overlay"
					onClick={() => setShowTransactionsModal(false)}
				>
					<div
						className="modal-content transactions-modal"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="modal-header-wallet">
							<h3>Transaction History</h3>
							<button
								className="close-modal"
								onClick={() => setShowTransactionsModal(false)}
							>
								<FaTimes />
							</button>
						</div>

						<div className="modal-body">
							{transactions.length === 0 ? (
								<div className="no-transactions">
									<FaHistory className="empty-icon" />
									<p>No transactions yet</p>
								</div>
							) : (
								<div className="transactions-list">
									{transactions.map((txn) => (
										<div key={txn.id} className="transaction-item">
											<div className="txn-left">
												{getTransactionIcon(txn.type)}
												<div className="txn-details">
													<div className="txn-type">
														{txn.type === "top_up" && "Wallet Top-Up"}
														{txn.type === "payment" && "Booking Payment"}
														{txn.type === "withdrawal" && "Withdrawal"}
														{txn.type === "refund" && "Refund"}
														{txn.type === "refund_deduction" && "Refund Deduction"}
														{txn.type === "booking_earning" && "Booking Earning"}
														{txn.type === "booking_received" && "Booking Received"}
														{txn.type === "points_exchange" && (txn.description || "Points Redeemed")}
														{txn.type === "subscription_payment" && (txn.planName ? `${txn.planName} Subscription` : "Subscription Payment")}
														{!txn.type && (txn.description || "Transaction")}
													</div>
													<div className="txn-date">
														{formatDate(txn.createdAt)}
													</div>
													{txn.propertyTitle && (
														<div className="txn-property">
															{txn.propertyTitle}
														</div>
													)}
												</div>
											</div>
											<div className="txn-right">
												<div
													className={`txn-amount ${
														txn.type === "payment" || txn.type === "withdrawal" || txn.type === "subscription_payment" || txn.type === "refund_deduction" || (txn.amount < 0)
															? "negative"
															: "positive"
													}`}
												>
													{txn.type === "payment" || txn.type === "withdrawal" || txn.type === "subscription_payment" || txn.type === "refund_deduction" || (txn.amount < 0)
														? "-"
														: "+"}
													{formatCurrency(Math.abs(txn.amount || 0))}
												</div>
												{txn.type === "withdrawal" && txn.fee && (
													<div className="txn-fee">
														Fee: {formatCurrency(txn.fee || 0)}
													</div>
												)}
												<div className="txn-balance">
													Balance: {formatCurrencyFull(txn.balanceAfter || 0)}
												</div>
											</div>
										</div>
									))}
								</div>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
