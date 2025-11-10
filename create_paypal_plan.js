import https from "https"
import { Buffer } from "buffer"

// PayPal credentials
const clientId =
	"AWu1C01rCyrjqljj3axT3ztlh25ARLpdRgi3TNCYJQw4u4ihBd9yYbR_rnbPNL8JgYc1mhIB2Uxpzch2"
const clientSecret =
	"ENLC6Shy7xlueozqsVna9MiJzIC-mcOG5EWQKNWWkDJQhvkfaFVCyRJY3KA7DLQpna1UqpNdmIRTzpJp"

// Function to get access token
function getAccessToken() {
	return new Promise((resolve, reject) => {
		const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")

		const options = {
			hostname: "api-m.sandbox.paypal.com",
			path: "/v1/oauth2/token",
			method: "POST",
			headers: {
				Accept: "application/json",
				"Accept-Language": "en_US",
				Authorization: `Basic ${auth}`,
				"Content-Type": "application/x-www-form-urlencoded",
			},
		}

		const req = https.request(options, (res) => {
			let data = ""

			res.on("data", (chunk) => {
				data += chunk
			})

			res.on("end", () => {
				try {
					const response = JSON.parse(data)
					if (response.access_token) {
						resolve(response.access_token)
					} else {
						reject(new Error(`Failed to get access token: ${data}`))
					}
				} catch (error) {
					reject(error)
				}
			})
		})

		req.on("error", (error) => {
			reject(error)
		})

		req.write("grant_type=client_credentials")
		req.end()
	})
}

// Function to create product
function createProduct(accessToken) {
	return new Promise((resolve, reject) => {
		const productData = {
			name: "AuraStays Premium Host",
			description: "Premium hosting features for hosts on AuraStays",
			type: "SERVICE",
			category: "SOFTWARE",
		}

		const options = {
			hostname: "api-m.sandbox.paypal.com",
			path: "/v1/catalogs/products",
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${accessToken}`,
			},
		}

		const req = https.request(options, (res) => {
			let data = ""

			res.on("data", (chunk) => {
				data += chunk
			})

			res.on("end", () => {
				console.log("Product creation response:", data)
				console.log("Response status:", res.statusCode)
				try {
					const response = JSON.parse(data)
					if (response.id) {
						resolve(response.id)
					} else {
						reject(new Error(`Failed to create product: ${data}`))
					}
				} catch (error) {
					reject(error)
				}
			})
		})

		req.on("error", (error) => {
			reject(error)
		})

		req.write(JSON.stringify(productData))
		req.end()
	})
}

// Function to create billing plan
function createBillingPlan(accessToken, productId) {
	return new Promise((resolve, reject) => {
		const planData = {
			product_id: productId,
			name: "AuraStays Premium Host Plan",
			description:
				"Monthly subscription for premium hosting features on AuraStays",
			billing_cycles: [
				{
					frequency: {
						interval_unit: "MONTH",
						interval_count: 1,
					},
					tenure_type: "REGULAR",
					sequence: 1,
					total_cycles: 0,
					pricing_scheme: {
						fixed_price: {
							value: "999.00",
							currency_code: "PHP",
						},
					},
				},
			],
			payment_preferences: {
				auto_bill_outstanding: true,
				setup_fee: {
					value: "999.00",
					currency_code: "PHP",
				},
				setup_fee_failure_action: "CONTINUE",
				payment_failure_threshold: 3,
			},
		}

		const options = {
			hostname: "api-m.sandbox.paypal.com",
			path: "/v2/billing/plans",
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${accessToken}`,
			},
		}

		const req = https.request(options, (res) => {
			let data = ""

			res.on("data", (chunk) => {
				data += chunk
			})

			res.on("end", () => {
				console.log("Billing plan creation response:", data)
				console.log("Response status:", res.statusCode)
				try {
					const response = JSON.parse(data)
					if (response.id) {
						resolve(response)
					} else {
						reject(new Error(`Failed to create billing plan: ${data}`))
					}
				} catch (error) {
					reject(error)
				}
			})
		})

		req.on("error", (error) => {
			reject(error)
		})

		console.log("Plan Data:", JSON.stringify(planData, null, 2))
		req.write(JSON.stringify(planData))
		req.end()
	})
}

// Function to activate billing plan
function activateBillingPlan(accessToken, planId) {
	return new Promise((resolve, reject) => {
		const options = {
			hostname: "api-m.sandbox.paypal.com",
			path: `/v1/payments/billing-plans/${planId}`,
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${accessToken}`,
			},
		}

		const req = https.request(options, (res) => {
			let data = ""

			res.on("data", (chunk) => {
				data += chunk
			})

			res.on("end", () => {
				if (res.statusCode === 200) {
					resolve({ success: true })
				} else {
					reject(new Error(`Failed to activate billing plan: ${data}`))
				}
			})
		})

		req.on("error", (error) => {
			reject(error)
		})

		// PayPal activation patch
		const patchData = [
			{
				op: "replace",
				path: "/",
				value: {
					state: "ACTIVE",
				},
			},
		]

		req.write(JSON.stringify(patchData))
		req.end()
	})
}

// Main execution
async function main() {
	try {
		console.log("Getting PayPal access token...")
		const accessToken = await getAccessToken()
		console.log("Access token obtained successfully")

		console.log("Creating product...")
		const productId = await createProduct(accessToken)
		console.log("Product created:", productId)

		console.log("Creating billing plan...")
		const plan = await createBillingPlan(accessToken, productId)
		console.log("Billing plan created:", plan.id)

		console.log("Activating billing plan...")
		await activateBillingPlan(accessToken, plan.id)
		console.log("Billing plan activated successfully")

		console.log("\n=== SUCCESS ===")
		console.log(`PayPal Premium Plan ID: ${plan.id}`)
		console.log("\nAdd this to your .env file:")
		console.log(`VITE_PAYPAL_PREMIUM_PLAN_ID=${plan.id}`)
	} catch (error) {
		console.error("Error:", error.message)
	}
}

main()
