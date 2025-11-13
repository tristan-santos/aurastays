/**
 * Formats a currency value with k/m abbreviations
 * @param {number} amount - The amount to format
 * @param {string} currencySymbol - The currency symbol (default: "₱")
 * @param {number} decimals - Number of decimal places (default: 1 for k, 0 for m)
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount, currencySymbol = "₱", decimals = 1) => {
	if (!amount && amount !== 0) return `${currencySymbol}0`
	
	const num = parseFloat(amount)
	if (isNaN(num)) return `${currencySymbol}0`
	
	// Handle millions (1,000,000 and above)
	if (num >= 1000000) {
		const millions = num / 1000000
		// For millions, use 1 decimal place if needed, otherwise no decimals
		const formatted = millions % 1 === 0 
			? millions.toString() 
			: millions.toFixed(decimals)
		return `${currencySymbol}${formatted}m`
	}
	
	// Handle thousands (1,000 and above, but less than 1,000,000)
	if (num >= 1000) {
		const thousands = num / 1000
		// For thousands, use 1 decimal place if needed, otherwise no decimals
		const formatted = thousands % 1 === 0 
			? thousands.toString() 
			: thousands.toFixed(decimals)
		return `${currencySymbol}${formatted}k`
	}
	
	// For amounts less than 1000, show with 2 decimal places
	return `${currencySymbol}${num.toFixed(2)}`
}

/**
 * Formats a currency value with k/m abbreviations but preserves decimal formatting for small amounts
 * @param {number} amount - The amount to format
 * @param {string} currencySymbol - The currency symbol (default: "₱")
 * @returns {string} Formatted currency string
 */
export const formatCurrencyWithDecimals = (amount, currencySymbol = "₱") => {
	if (!amount && amount !== 0) return `${currencySymbol}0.00`
	
	const num = parseFloat(amount)
	if (isNaN(num)) return `${currencySymbol}0.00`
	
	// Handle millions (1,000,000 and above)
	if (num >= 1000000) {
		const millions = num / 1000000
		const formatted = millions % 1 === 0 
			? millions.toString() 
			: millions.toFixed(1)
		return `${currencySymbol}${formatted}m`
	}
	
	// Handle thousands (1,000 and above, but less than 1,000,000)
	if (num >= 1000) {
		const thousands = num / 1000
		const formatted = thousands % 1 === 0 
			? thousands.toString() 
			: thousands.toFixed(1)
		return `${currencySymbol}${formatted}k`
	}
	
	// For amounts less than 1000, show with 2 decimal places
	return `${currencySymbol}${num.toFixed(2)}`
}

/**
 * Formats a currency value with full amount (no k/m abbreviations)
 * Always shows the full number with proper comma separators and 2 decimal places
 * @param {number} amount - The amount to format
 * @param {string} currencySymbol - The currency symbol (default: "₱")
 * @returns {string} Formatted currency string
 */
export const formatCurrencyFull = (amount, currencySymbol = "₱") => {
	if (!amount && amount !== 0) return `${currencySymbol}0.00`
	
	const num = parseFloat(amount)
	if (isNaN(num)) return `${currencySymbol}0.00`
	
	// Always show full amount with 2 decimal places and comma separators
	return `${currencySymbol}${num.toLocaleString(undefined, {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})}`
}
