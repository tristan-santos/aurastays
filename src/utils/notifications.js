import { collection, addDoc, serverTimestamp } from "firebase/firestore"
import { db } from "../components/firebaseConfig"

/**
 * Create a notification for a user
 * @param {string} userId - The user ID to send notification to
 * @param {string} type - Type of notification (booking, top_up, password_change, etc.)
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {object} data - Additional data (optional)
 */
export const createNotification = async (userId, type, title, message, data = {}) => {
	try {
		if (!userId) {
			throw new Error("userId is required to create notification")
		}

		const notificationData = {
			userId,
			type,
			title,
			message,
			data,
			read: false,
			createdAt: serverTimestamp(),
		}

		const docRef = await addDoc(collection(db, "notifications"), notificationData)
		console.log(`✅ Notification created: ${type} for user ${userId}`, docRef.id)
		return docRef.id
	} catch (error) {
		console.error("Error creating notification:", error)
		console.error("Notification data:", { userId, type, title, message })
		throw error // Re-throw so caller can handle it
	}
}

/**
 * Create booking notification
 */
export const createBookingNotification = async (userId, bookingData) => {
	const { propertyTitle, bookingId, totalAmount, checkInDate, checkOutDate } =
		bookingData

	const checkIn = checkInDate?.toDate
		? checkInDate.toDate().toLocaleDateString()
		: new Date(checkInDate).toLocaleDateString()
	const checkOut = checkOutDate?.toDate
		? checkOutDate.toDate().toLocaleDateString()
		: new Date(checkOutDate).toLocaleDateString()

	await createNotification(
		userId,
		"booking",
		"Booking Confirmed",
		`Your booking for ${propertyTitle} has been confirmed. Check-in: ${checkIn}, Check-out: ${checkOut}`,
		{
			bookingId,
			propertyTitle,
			amount: totalAmount,
			checkInDate,
			checkOutDate,
		}
	)
}

/**
 * Create top-up notification
 */
export const createTopUpNotification = async (userId, amount) => {
	// Ensure amount is a number
	const amountNum = typeof amount === "number" ? amount : parseFloat(amount)
	
	if (!userId) {
		console.error("Cannot create notification: userId is missing")
		return
	}
	
	if (isNaN(amountNum) || amountNum <= 0) {
		console.error("Cannot create notification: invalid amount", amount)
		return
	}

	try {
		await createNotification(
			userId,
			"top_up",
			"Wallet Top-Up Successful",
			`You've successfully topped up your wallet with ₱${amountNum.toLocaleString()}`,
			{
				amount: amountNum,
			}
		)
		console.log(`✅ Top-up notification created successfully for user ${userId}, amount: ₱${amountNum}`)
	} catch (error) {
		console.error("Error in createTopUpNotification:", error)
		throw error
	}
}

/**
 * Create password change notification
 */
export const createPasswordChangeNotification = async (userId) => {
	await createNotification(
		userId,
		"password_change",
		"Password Changed",
		"Your password has been successfully changed. If you didn't make this change, please contact support immediately.",
		{}
	)
}

/**
 * Create booking confirmation notification (when host confirms)
 */
export const createBookingConfirmedNotification = async (
	userId,
	bookingData
) => {
	const { propertyTitle, bookingId } = bookingData

	await createNotification(
		userId,
		"booking_confirmed",
		"Booking Approved",
		`Your booking for ${propertyTitle} has been approved by the host.`,
		{
			bookingId,
			propertyTitle,
		}
	)
}

/**
 * Create booking cancellation notification
 */
export const createBookingCancelledNotification = async (
	userId,
	bookingData
) => {
	const { propertyTitle, bookingId } = bookingData

	await createNotification(
		userId,
		"booking_cancelled",
		"Booking Cancelled",
		`Your booking for ${propertyTitle} has been cancelled.`,
		{
			bookingId,
			propertyTitle,
		}
	)
}

/**
 * Create invoice notification for guest
 */
export const createInvoiceNotification = async (userId, invoiceData) => {
	const { invoiceNumber, bookingId, propertyTitle, totalAmount, checkInDate, checkOutDate } = invoiceData

	const checkIn = checkInDate?.toDate
		? checkInDate.toDate().toLocaleDateString()
		: new Date(checkInDate).toLocaleDateString()
	const checkOut = checkOutDate?.toDate
		? checkOutDate.toDate().toLocaleDateString()
		: new Date(checkOutDate).toLocaleDateString()

	await createNotification(
		userId,
		"invoice",
		"Invoice Generated",
		`Invoice ${invoiceNumber} has been generated for your booking at ${propertyTitle}. Amount: ₱${totalAmount.toLocaleString()}. Check-in: ${checkIn}, Check-out: ${checkOut}`,
		{
			invoiceNumber,
			bookingId,
			propertyTitle,
			amount: totalAmount,
			checkInDate,
			checkOutDate,
		}
	)
}

