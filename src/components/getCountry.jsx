// src/utils/getCountry.tsx

export default function getCountry(code) {
	switch (code) {
		case "+61":
			return "Australia"
		case "+880":
			return "Bangladesh"
		case "+55":
			return "Brazil"
		case "+86":
			return "China"
		case "+33":
			return "France"
		case "+49":
			return "Germany"
		case "+852":
			return "Hong Kong"
		case "+91":
			return "India"
		case "+62":
			return "Indonesia"
		case "+98":
			return "Iran"
		case "+972":
			return "Israel"
		case "+81":
			return "Japan"
		case "+60":
			return "Malaysia"
		case "+853":
			return "Macau"
		case "+64":
			return "New Zealand"
		case "+92":
			return "Pakistan"
		case "+63":
			return "Philippines"
		case "+7":
			return "Russia"
		case "+65":
			return "Singapore"
		case "+27":
			return "South Africa"
		case "+82":
			return "South Korea"
		case "+34":
			return "Spain"
		case "+94":
			return "Sri Lanka"
		case "+66":
			return "Thailand"
		case "+90":
			return "Turkey"
		case "+971":
			return "United Arab Emirates"
		case "+44":
			return "United Kingdom"
		case "+1":
			return "United States"
		default:
			return "Unknown Country"
	}
}
