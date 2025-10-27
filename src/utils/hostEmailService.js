import emailjs from "@emailjs/browser"

// EmailJS Configuration - Host
const EMAILJS_HOST_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_HOST_PUBLIC_KEY
const EMAILJS_HOST_SERVICE_ID = import.meta.env.VITE_EMAILJS_HOST_SERVICE_ID
const EMAILJS_HOST_BOOKING_TEMPLATE_ID = import.meta.env
	.VITE_EMAILJS_HOST_BOOKING_TEMPLATE_ID
const EMAILJS_HOST_PAYOUT_TEMPLATE_ID = import.meta.env
	.VITE_EMAILJS_HOST_PAYOUT_TEMPLATE_ID

// Initialize EmailJS with Host credentials
emailjs.init(EMAILJS_HOST_PUBLIC_KEY)

/**
 * Send booking confirmation email to host
 * @param {Object} params - Email parameters
 * @param {string} params.hostEmail - Host email address
 * @param {string} params.hostName - Host name
 * @param {string} params.guestName - Guest name
 * @param {string} params.propertyName - Property name
 * @param {string} params.checkInDate - Check-in date
 * @param {string} params.checkOutDate - Check-out date
 * @param {number} params.numberOfGuests - Number of guests
 * @param {number} params.numberOfNights - Number of nights
 * @param {number} params.totalAmount - Total booking amount
 * @param {string} params.bookingId - Booking ID
 * @returns {Promise} EmailJS response
 */
export const sendHostBookingConfirmation = async ({
	hostEmail,
	hostName,
	guestName,
	propertyName,
	checkInDate,
	checkOutDate,
	numberOfGuests,
	numberOfNights,
	totalAmount,
	bookingId,
}) => {
	try {
		const templateParams = {
			to_email: hostEmail,
			hostName: hostName,
			guestName: guestName,
			propertyName: propertyName,
			checkInDate: checkInDate,
			checkOutDate: checkOutDate,
			numberOfGuests: numberOfGuests,
			numberOfNights: numberOfNights,
			totalAmount: totalAmount,
			bookingId: bookingId,
			bookingDate: new Date().toLocaleDateString("en-US", {
				year: "numeric",
				month: "long",
				day: "numeric",
			}),
		}

		console.log("Sending host booking confirmation:", templateParams)

		const response = await emailjs.send(
			EMAILJS_HOST_SERVICE_ID,
			EMAILJS_HOST_BOOKING_TEMPLATE_ID,
			templateParams
		)

		console.log("Host booking email sent successfully:", response)
		return response
	} catch (error) {
		console.error("Failed to send host booking email:", error)
		throw error
	}
}

/**
 * Send payout notification email to host
 * @param {Object} params - Email parameters
 * @param {string} params.hostEmail - Host email address
 * @param {string} params.hostName - Host name
 * @param {number} params.payoutAmount - Payout amount
 * @param {string} params.payoutDate - Payout date
 * @param {string} params.payoutMethod - Payout method (PayPal, Bank Transfer, etc.)
 * @param {string} params.payoutId - Payout ID
 * @returns {Promise} EmailJS response
 */
export const sendHostPayoutNotification = async ({
	hostEmail,
	hostName,
	payoutAmount,
	payoutDate,
	payoutMethod,
	payoutId,
}) => {
	try {
		const templateParams = {
			to_email: hostEmail,
			hostName: hostName,
			payoutAmount: payoutAmount,
			payoutDate: payoutDate,
			payoutMethod: payoutMethod,
			payoutId: payoutId,
			processedDate: new Date().toLocaleDateString("en-US", {
				year: "numeric",
				month: "long",
				day: "numeric",
			}),
		}

		console.log("Sending host payout notification:", templateParams)

		const response = await emailjs.send(
			EMAILJS_HOST_SERVICE_ID,
			EMAILJS_HOST_PAYOUT_TEMPLATE_ID,
			templateParams
		)

		console.log("Host payout email sent successfully:", response)
		return response
	} catch (error) {
		console.error("Failed to send host payout email:", error)
		throw error
	}
}

export default {
	sendHostBookingConfirmation,
	sendHostPayoutNotification,
}
