import { useState, useRef, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import { db } from "../components/firebaseConfig"
import {
	collection,
	addDoc,
	updateDoc,
	doc,
	getDoc,
	setDoc,
	getDocs,
	serverTimestamp,
	query,
	where,
} from "firebase/firestore"
import { toast } from "react-stacked-toast"
import {
	FaHome,
	FaUtensils,
	FaCamera,
	FaMapMarkerAlt,
	FaImages,
	FaCheckCircle,
	FaChevronLeft,
	FaChevronRight,
	FaUpload,
	FaTimes,
	FaMountain,
	FaBuilding,
	FaSwimmingPool,
	FaUmbrellaBeach,
	FaTree,
	FaCity,
	FaShip,
	FaCar,
	FaBed,
	FaBath,
	FaUsers,
	FaPlus,
	FaSave,
	FaTicketAlt,
	FaGift,
	FaCalendarCheck,
	FaCalendarAlt,
	FaStar,
} from "react-icons/fa"
import "../css/PropertyListingWizard.css"
import "../css/Search.css"

const IMGBB_API_KEY = import.meta.env.VITE_IMGBB_API_KEY
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

// Property type options based on category
const PROPERTY_TYPES = {
	home: [
		{ id: "villa", name: "Villa", icon: FaHome },
		{ id: "condo", name: "Condo", icon: FaBuilding },
		{ id: "cabin", name: "Cabin", icon: FaMountain },
		{ id: "house", name: "House", icon: FaHome },
		{ id: "bungalow", name: "Bungalow", icon: FaUmbrellaBeach },
		{ id: "penthouse", name: "Penthouse", icon: FaCity },
		{ id: "nipa", name: "Nipa Hut", icon: FaTree },
		{ id: "apartment", name: "Apartment", icon: FaBuilding },
	],
	service: [
		{ id: "photography", name: "Photography", icon: FaCamera },
		{ id: "transportation", name: "Transportation", icon: FaCar },
		{ id: "culinary", name: "Culinary", icon: FaUtensils },
		{ id: "tour", name: "Tour Guide", icon: FaMapMarkerAlt },
		{ id: "planning", name: "Travel Planning", icon: FaCheckCircle },
	],
	experience: [
		{ id: "island", name: "Island Hopping", icon: FaShip },
		{ id: "diving", name: "Diving", icon: FaSwimmingPool },
		{ id: "photography", name: "Photography Tour", icon: FaCamera },
		{ id: "culinary", name: "Culinary Experience", icon: FaUtensils },
		{ id: "cultural", name: "Cultural Tour", icon: FaHome },
	],
}

// Common amenities
const COMMON_AMENITIES = {
	home: [
		"WiFi",
		"Air Conditioning",
		"Kitchen",
		"Free Parking",
		"TV",
		"Washing Machine",
		"Pool",
		"Beach Access",
		"Balcony",
		"Gym Access",
		"Workspace",
		"Fireplace",
		"Garden",
		"BBQ Grill",
		"Security System",
	],
	service: [
		"Professional Equipment",
		"Insurance",
		"24/7 Support",
		"Flexible Scheduling",
		"Multiple Languages",
		"Pick-up Service",
		"Online Gallery",
	],
	experience: [
		"Equipment Included",
		"Guide Included",
		"Meals Included",
		"Transportation",
		"Photos Included",
		"Refreshments",
		"Safety Equipment",
	],
}

export default function PropertyListingWizard() {
	const { currentUser, userData } = useAuth()
	const navigate = useNavigate()
	const mapContainerRef = useRef(null)
	const mapInstanceRef = useRef(null)
	const markerRef = useRef(null)

	const [currentStep, setCurrentStep] = useState(1)
	const [loading, setLoading] = useState(false)
	const [uploadingImages, setUploadingImages] = useState(false)
	const [draftId, setDraftId] = useState(null)
	const [savingDraft, setSavingDraft] = useState(false)
	const [isDragging, setIsDragging] = useState(false)
	const [platformFees, setPlatformFees] = useState({
		cleaningFee: 500,
		serviceFee: 200,
	})

	const [formData, setFormData] = useState({
		// Step 1
		category: "", // home, service, experience
		// Step 2
		propertyType: "",
		customPropertyType: "", // For "others" option
		// Step 3
		title: "",
		description: "",
		location: {
			address: "",
			city: "",
			province: "",
			country: "Philippines",
			zipCode: "",
			coordinates: { latitude: 14.5547, longitude: 121.0244 },
		},
		pricing: {
			basePrice: "",
			currency: "PHP",
		},
		// Step 4
		images: [],
		// Step 5
		amenities: [],
		customAmenity: "",
		// Step 6
		capacity: {
			guests: 0,
			bedrooms: 0,
			beds: 0,
			bathrooms: 0,
		},
		houseRules: [],
		customHouseRule: "",
		mealIncluded: [],
		availability: {
			instantBook: false,
			minNights: 1,
			maxNights: 30,
		},
		// Step 7
		vouchers: {
			types: [], // Array of voucher types like ["early_bird", "christmas", "yearly", etc.]
			details: {}, // Object with voucher details: { early_bird: { discount: "", duration: "" }, ... }
		},
	})

	const totalSteps = 7

	// Calendar modal state for voucher dates
	const [showDateModal, setShowDateModal] = useState(false)
	const [selectingStartDate, setSelectingStartDate] = useState(true)
	const [currentMonth, setCurrentMonth] = useState(new Date())
	const [activeVoucherId, setActiveVoucherId] = useState(null)

	// Fetch platform fees from admin settings
	useEffect(() => {
		const fetchPlatformFees = async () => {
			try {
				const policiesDoc = await getDocs(collection(db, "settings"))
				const policiesData = policiesDoc.docs
					.find((doc) => doc.id === "policies")
					?.data()

				if (policiesData) {
					setPlatformFees({
						cleaningFee: policiesData.cleaningFee || 500,
						serviceFee: policiesData.serviceFeePerProperty || 200,
					})
				}
			} catch (error) {
				console.error("Error fetching platform fees:", error)
				// Keep default values if fetch fails
			}
		}

		fetchPlatformFees()
	}, [])

	// Load Mapbox GL JS
	useEffect(() => {
		// Check if already loaded
		if (window.mapboxgl && window.MapboxGeocoder) {
			return
		}

		// Check if scripts are already in the document
		const existingMapboxGL = document.getElementById("mapbox-gl-js")
		const existingGeocoder = document.getElementById("mapbox-geocoder-js")

		if (existingMapboxGL || existingGeocoder) {
			console.log("Mapbox scripts already loaded in document")
			return
		}

		// Load Mapbox CSS
		const link = document.createElement("link")
		link.href = "https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.css"
		link.rel = "stylesheet"
		link.id = "mapbox-gl-css"
		document.head.appendChild(link)

		// Load Mapbox JS
		const script = document.createElement("script")
		script.src = "https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.js"
		script.async = true
		script.id = "mapbox-gl-js"
		document.head.appendChild(script)

		// Load Mapbox Geocoder CSS
		const geocoderLink = document.createElement("link")
		geocoderLink.href =
			"https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-geocoder/v5.0.0/mapbox-gl-geocoder.css"
		geocoderLink.rel = "stylesheet"
		geocoderLink.id = "mapbox-geocoder-css"
		document.head.appendChild(geocoderLink)

		// Load Mapbox Geocoder JS
		const geocoderScript = document.createElement("script")
		geocoderScript.src =
			"https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-geocoder/v5.0.0/mapbox-gl-geocoder.min.js"
		geocoderScript.async = true
		geocoderScript.id = "mapbox-geocoder-js"
		document.head.appendChild(geocoderScript)

		// Set access token when Mapbox is loaded
		script.onload = () => {
			if (window.mapboxgl) {
				window.mapboxgl.accessToken = MAPBOX_TOKEN
				console.log("Mapbox GL JS loaded successfully")
			}
		}

		// Note: We don't clean up these scripts to avoid reloading issues
	}, [])

	// Load draft on mount (only if draftId is in URL params)
	useEffect(() => {
		const loadDraft = async () => {
			if (!currentUser) return

			try {
				// Only load draft if draftId is explicitly provided in URL
				const urlParams = new URLSearchParams(window.location.search)
				const draftIdParam = urlParams.get("draftId")

				if (draftIdParam) {
					// Load specific draft
					const draftDoc = await getDoc(doc(db, "propertyDrafts", draftIdParam))
					if (draftDoc.exists() && draftDoc.data().hostId === currentUser.uid) {
						const draftData = draftDoc.data()
						setDraftId(draftIdParam)
						// Merge old draft data with new defaults to ensure all fields exist
						setFormData({
							...draftData.formData,
							vouchers: draftData.formData.vouchers || {
								types: [],
								details: {},
							},
						})
						setCurrentStep(draftData.currentStep || 1)
						toast.success("Draft loaded successfully!")
					}
				}
				// Don't auto-load drafts if no draftId in URL
			} catch (error) {
				console.error("Error loading draft:", error)
			}
		}

		loadDraft()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentUser])

	// Initialize Mapbox map
	useEffect(() => {
		if (
			currentStep === 3 &&
			mapContainerRef.current &&
			!mapInstanceRef.current
		) {
			if (!window.mapboxgl) {
				toast.error("Mapbox not loaded. Please refresh the page.")
				return
			}

			window.mapboxgl.accessToken = MAPBOX_TOKEN

			const map = new window.mapboxgl.Map({
				container: mapContainerRef.current,
				style: "mapbox://styles/mapbox/streets-v12",
				center: [
					formData.location.coordinates.longitude,
					formData.location.coordinates.latitude,
				],
				zoom: 13,
			})

			mapInstanceRef.current = map

			// Add navigation controls
			map.addControl(new window.mapboxgl.NavigationControl())

			// Create draggable marker
			const marker = new window.mapboxgl.Marker({
				draggable: true,
				color: "#415f94",
			})
				.setLngLat([
					formData.location.coordinates.longitude,
					formData.location.coordinates.latitude,
				])
				.addTo(map)

			markerRef.current = marker

			// Add geocoder
			if (window.MapboxGeocoder) {
				const geocoder = new window.MapboxGeocoder({
					accessToken: MAPBOX_TOKEN,
					mapboxgl: window.mapboxgl,
					marker: false,
					placeholder: "Search for a location...",
				})

				map.addControl(geocoder)

				geocoder.on("result", async (e) => {
					const location = e.result.center
					const address = e.result.place_name

					marker.setLngLat(location)
					map.flyTo({ center: location, zoom: 17 })

					// Extract city and province from address
					const context = e.result.context || []
					let city = ""
					let province = ""
					let zipCode = ""

					context.forEach((item) => {
						if (item.id.startsWith("place")) {
							city = item.text
						}
						if (item.id.startsWith("region")) {
							province = item.text
						}
						if (item.id.startsWith("postcode")) {
							zipCode = item.text
						}
					})

					setFormData((prev) => ({
						...prev,
						location: {
							...prev.location,
							address,
							city,
							province,
							zipCode,
							coordinates: { latitude: location[1], longitude: location[0] },
						},
					}))
				})
			}

			// Handle marker drag
			marker.on("dragend", async () => {
				const lngLat = marker.getLngLat()

				// Reverse geocode
				try {
					const response = await fetch(
						`https://api.mapbox.com/geocoding/v5/mapbox.places/${lngLat.lng},${lngLat.lat}.json?access_token=${MAPBOX_TOKEN}`
					)
					const data = await response.json()

					if (data.features && data.features.length > 0) {
						const address = data.features[0].place_name
						const context = data.features[0].context || []
						let city = ""
						let province = ""
						let zipCode = ""

						context.forEach((item) => {
							if (item.id.startsWith("place")) {
								city = item.text
							}
							if (item.id.startsWith("region")) {
								province = item.text
							}
							if (item.id.startsWith("postcode")) {
								zipCode = item.text
							}
						})

						setFormData((prev) => ({
							...prev,
							location: {
								...prev.location,
								address,
								city,
								province,
								zipCode,
								coordinates: { latitude: lngLat.lat, longitude: lngLat.lng },
							},
						}))
					}
				} catch (error) {
					console.error("Geocoding error:", error)
				}
			})

			// Cleanup
			return () => {
				if (mapInstanceRef.current) {
					mapInstanceRef.current.remove()
					mapInstanceRef.current = null
				}
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentStep])

	// Handle image upload
	const handleImageUpload = async (files) => {
		if (!files || files.length === 0) return

		const filesArray = Array.from(files)
		const currentImageCount = formData.images.length
		const maxPhotos = 7

		// Check if adding these files would exceed the limit
		if (currentImageCount + filesArray.length > maxPhotos) {
			const remainingSlots = maxPhotos - currentImageCount
			if (remainingSlots > 0) {
				toast.error(
					`You can only upload ${remainingSlots} more photo(s). Maximum ${maxPhotos} photos allowed.`
				)
				filesArray.splice(remainingSlots)
			} else {
				toast.error(
					`Maximum ${maxPhotos} photos allowed. Please remove some photos first.`
				)
				return
			}
		}

		setUploadingImages(true)
		const newImages = []

		try {
			for (const file of filesArray) {
				if (file.size > 10 * 1024 * 1024) {
					toast.error(`${file.name} is too large. Maximum size is 10MB.`)
					continue
				}

				// Validate file type
				if (!file.type.startsWith("image/")) {
					toast.error(`${file.name} is not an image file.`)
					continue
				}

				const formData = new FormData()
				formData.append("image", file)

				const response = await fetch(
					`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`,
					{
						method: "POST",
						body: formData,
					}
				)

				const data = await response.json()

				if (data.success) {
					newImages.push(data.data.url)
				} else {
					toast.error(`Failed to upload ${file.name}`)
				}
			}

			setFormData((prev) => ({
				...prev,
				images: [...prev.images, ...newImages],
			}))

			if (newImages.length > 0) {
				toast.success(`Successfully uploaded ${newImages.length} image(s)`)
			}
		} catch (error) {
			console.error("Error uploading images:", error)
			toast.error("Failed to upload images. Please try again.")
		} finally {
			setUploadingImages(false)
		}
	}

	const handleDragOver = (e) => {
		e.preventDefault()
		e.stopPropagation()
		setIsDragging(true)
	}

	const handleDragLeave = (e) => {
		e.preventDefault()
		e.stopPropagation()
		setIsDragging(false)
	}

	const handleDrop = (e) => {
		e.preventDefault()
		e.stopPropagation()
		setIsDragging(false)

		const files = e.dataTransfer.files
		if (files && files.length > 0) {
			handleImageUpload(files)
		}
	}

	const removeImage = (index) => {
		setFormData((prev) => ({
			...prev,
			images: prev.images.filter((_, i) => i !== index),
		}))
	}

	const handleNext = () => {
		// Validation
		if (currentStep === 1 && !formData.category) {
			toast.error("Please select a category")
			return
		}
		if (currentStep === 2) {
			if (!formData.propertyType) {
				toast.error("Please select a property type")
				return
			}
			if (
				formData.propertyType === "others" &&
				!formData.customPropertyType.trim()
			) {
				toast.error("Please specify the property type")
				return
			}
		}
		if (currentStep === 3) {
			if (!formData.title.trim()) {
				toast.error("Please enter a property title")
				return
			}
			if (!formData.description.trim()) {
				toast.error("Please enter a description")
				return
			}
			if (!formData.location.address) {
				toast.error("Please select a location")
				return
			}
			if (!formData.pricing.basePrice) {
				toast.error("Please enter a base price")
				return
			}
		}
		if (currentStep === 4 && formData.images.length === 0) {
			toast.error("Please upload at least one image")
			return
		}
		if (currentStep === 4 && formData.images.length > 7) {
			toast.error("Maximum 7 photos allowed. Please remove excess photos.")
			return
		}
		if (currentStep === 6) {
			if (!formData.capacity.guests || parseInt(formData.capacity.guests) < 1) {
				toast.error("Please enter maximum guests")
				return
			}
			if (formData.category === "home") {
				if (!formData.capacity.beds || parseInt(formData.capacity.beds) < 1) {
					toast.error("Please enter number of beds")
					return
				}
				if (
					!formData.capacity.bathrooms ||
					parseInt(formData.capacity.bathrooms) < 1
				) {
					toast.error("Please enter number of bathrooms")
					return
				}
			}
		}
		if (currentStep === 7) {
			// Validate long_stay vouchers have minimum days set
			if (formData.vouchers.types.includes("long_stay")) {
				const longStayDetails = formData.vouchers.details["long_stay"]
				if (!longStayDetails?.minDays && !longStayDetails?.minimumDays) {
					toast.error("Please enter minimum days for Long Stay Discount")
					return
				}
				const minDays = parseInt(longStayDetails?.minDays || longStayDetails?.minimumDays || 0)
				if (minDays < 1) {
					toast.error("Minimum days must be at least 1")
					return
				}
			}
		}

		if (currentStep < totalSteps) {
			setCurrentStep(currentStep + 1)
		}
	}

	const handlePrevious = () => {
		if (currentStep > 1) {
			setCurrentStep(currentStep - 1)
		}
	}

	const handleStepClick = (stepNumber) => {
		// Only allow navigation to steps that have been completed (less than or equal to current step)
		if (stepNumber <= currentStep && stepNumber >= 1) {
			setCurrentStep(stepNumber)
		}
	}

	const handleSaveDraft = async () => {
		if (!currentUser) {
			toast.error("Please login to save a draft")
			navigate("/login")
			return
		}

		setSavingDraft(true)

		try {
			const draftData = {
				hostId: currentUser.uid,
				formData: formData,
				currentStep: currentStep,
				updatedAt: serverTimestamp(),
			}

			if (draftId) {
				// Update existing draft
				await updateDoc(doc(db, "propertyDrafts", draftId), draftData)
				toast.success("Draft updated successfully!")
			} else {
				// Create new draft
				const newDraftRef = doc(collection(db, "propertyDrafts"))
				await setDoc(newDraftRef, {
					...draftData,
					createdAt: serverTimestamp(),
				})
				setDraftId(newDraftRef.id)
				toast.success("Draft saved successfully!")
			}
		} catch (error) {
			console.error("Error saving draft:", error)
			toast.error("Failed to save draft. Please try again.")
		} finally {
			setSavingDraft(false)
		}
	}

	const handleSubmit = async () => {
		if (!currentUser) {
			toast.error("Please login to create a listing")
			navigate("/login")
			return
		}

		setLoading(true)

		try {
			// Check subscription limits before creating property
			const userDoc = await getDoc(doc(db, "users", currentUser.uid))
			let userSubscription = null

			if (userDoc.exists()) {
				const userData = userDoc.data()
				userSubscription = userData.subscription || null
			}

			// If no subscription, check subscriptions collection
			if (
				!userSubscription ||
				!userSubscription.status ||
				userSubscription.status !== "active"
			) {
				const subscriptionsQuery = query(
					collection(db, "subscriptions"),
					where("userId", "==", currentUser.uid),
					where("status", "==", "active")
				)
				const subscriptionsSnapshot = await getDocs(subscriptionsQuery)
				if (!subscriptionsSnapshot.empty) {
					const subData = subscriptionsSnapshot.docs[0].data()
					userSubscription = subData
				} else {
					// Default to free plan if no subscription found
					userSubscription = { planId: "standard", maxListings: 1 }
				}
			}

			// Determine max listings based on plan
			let maxListings = -1 // Unlimited by default
			if (userSubscription?.planId === "standard") {
				maxListings = 1
			} else if (userSubscription?.planId === "premium") {
				maxListings = -1 // Unlimited
			} else {
				// Default to free plan restrictions
				maxListings = 1
			}

			// Count existing properties if there's a limit
			if (maxListings > 0) {
				const propertiesQuery = query(
					collection(db, "properties"),
					where("host.hostId", "==", currentUser.uid),
					where("status", "==", "active")
				)
				const propertiesSnapshot = await getDocs(propertiesQuery)
				const existingCount = propertiesSnapshot.size

				if (existingCount >= maxListings) {
					toast.error(
						`You've reached your listing limit (${maxListings} property). Please upgrade to Premium plan for unlimited listings.`
					)
					setLoading(false)
					setTimeout(() => {
						navigate("/host/subscription")
					}, 2000)
					return
				}
			}

			// Helper function to remove undefined values from nested objects
			const removeUndefined = (obj) => {
				if (obj === null || obj === undefined) {
					return null
				}
				if (Array.isArray(obj)) {
					return obj.map(removeUndefined)
				}
				if (typeof obj !== "object") {
					return obj
				}
				const cleaned = {}
				for (const key in obj) {
					if (obj[key] !== undefined) {
						cleaned[key] = removeUndefined(obj[key])
					}
				}
				return cleaned
			}

			// Clean vouchers data to remove undefined values
			const cleanedVouchers = removeUndefined(formData.vouchers)

			// Prepare property data
			const propertyDataRaw = {
				hostId: currentUser.uid, // Add top-level hostId for filtering
				category: formData.category,
				propertyType:
					formData.propertyType === "others"
						? formData.customPropertyType.trim()
						: formData.propertyType,
				title: formData.title.trim(),
				description: formData.description.trim(),
				location: {
					...formData.location,
					coordinates: {
						latitude: formData.location.coordinates.latitude,
						longitude: formData.location.coordinates.longitude,
					},
				},
				pricing: {
					basePrice: parseFloat(formData.pricing.basePrice),
					currency: formData.pricing.currency,
					cleaningFee: platformFees.cleaningFee,
					serviceFee: platformFees.serviceFee,
				},
				images: formData.images,
				amenities: formData.amenities,
				capacity: {
					guests: parseInt(formData.capacity.guests) || 1,
					bedrooms: parseInt(formData.capacity.bedrooms) || 0,
					beds: parseInt(formData.capacity.beds) || 1,
					bathrooms: parseInt(formData.capacity.bathrooms) || 1,
				},
				houseRules: formData.houseRules,
				mealIncluded: formData.mealIncluded,
				availability: formData.availability,
				vouchers: cleanedVouchers,
				host: {
					hostId: currentUser.uid,
					hostName: userData?.displayName || "Host",
					hostSince: new Date().toISOString(),
					verified: true,
					superhost: false,
				},
				rating: 0,
				reviewsCount: 0,
				status: "active",
				featured: false,
				createdAt: serverTimestamp(),
			}

			// Clean entire property data to remove any undefined values
			const propertyData = removeUndefined(propertyDataRaw)

			// Save to Firestore - Firestore will auto-generate the document ID
			const docRef = await addDoc(collection(db, "properties"), propertyData)
			const propertyId = docRef.id // Use the Firestore-generated document ID
			// Ensure the document stores its own Firestore ID for consistent lookups
			try {
				await updateDoc(docRef, {
					id: propertyId,
					property_id: propertyId,
				})
				console.log("✅ Synced property id fields to Firestore doc ID:", propertyId)
			} catch (syncErr) {
				console.error("❌ Failed to sync property id fields:", syncErr)
			}

			// Delete draft if it exists
			if (draftId) {
				try {
					await updateDoc(doc(db, "propertyDrafts", draftId), {
						status: "published",
						publishedAt: serverTimestamp(),
					})
				} catch (error) {
					console.error("Error updating draft status:", error)
				}
			}

			// Add +100 points to user account for listing a property
			try {
				const userRef = doc(db, "users", currentUser.uid)
				const userDocSnapshot = await getDoc(userRef)
				
				if (userDocSnapshot.exists()) {
					const userDocData = userDocSnapshot.data()
					const currentPoints = userDocData.points || 0
					const currentLifetimePoints = userDocData.lifetimePoints || 0
					const newPoints = currentPoints + 100
					const newLifetimePoints = currentLifetimePoints + 100

					await updateDoc(userRef, {
						points: newPoints,
						lifetimePoints: newLifetimePoints,
					})

					// Record points transaction
					await addDoc(collection(db, "pointsTransactions"), {
						userId: currentUser.uid,
						type: "property_listed",
						points: 100,
						description: "Points earned for listing a property",
						propertyTitle: propertyData.title,
						propertyId: propertyId,
						balanceBefore: currentPoints,
						balanceAfter: newPoints,
						createdAt: serverTimestamp(),
					})

					console.log(`✅ Added 100 points for listing property. New balance: ${newPoints}`)
				}
			} catch (pointsError) {
				console.error("Error adding points:", pointsError)
				// Don't fail the property listing if points update fails
			}

			// Clear all drafts if user is not premium (only for non-premium users)
			if (userSubscription?.planId !== "premium") {
				try {
					const draftsQuery = query(
						collection(db, "propertyDrafts"),
						where("hostId", "==", currentUser.uid)
					)
					const draftsSnapshot = await getDocs(draftsQuery)
					
					// Delete all drafts
					const deletePromises = draftsSnapshot.docs.map((draftDoc) =>
						updateDoc(doc(db, "propertyDrafts", draftDoc.id), {
							status: "deleted",
							deletedAt: serverTimestamp(),
						})
					)
					
					await Promise.all(deletePromises)
					console.log(`✅ Cleared ${draftsSnapshot.size} draft(s) for non-premium user`)
				} catch (draftError) {
					console.error("Error clearing drafts:", draftError)
					// Don't fail the property creation if draft clearing fails
				}
			}

			toast.success("Property listed successfully! +100 points earned!")
			navigate("/dashboardHost")
		} catch (error) {
			console.error("Error creating property:", error)
			toast.error("Failed to create listing. Please try again.")
		} finally {
			setLoading(false)
		}
	}

	const toggleAmenity = (amenity) => {
		setFormData((prev) => ({
			...prev,
			amenities: prev.amenities.includes(amenity)
				? prev.amenities.filter((a) => a !== amenity)
				: [...prev.amenities, amenity],
		}))
	}

	const addCustomAmenity = () => {
		const trimmedAmenity = formData.customAmenity.trim()
		if (trimmedAmenity && !formData.amenities.includes(trimmedAmenity)) {
			setFormData((prev) => ({
				...prev,
				amenities: [...prev.amenities, trimmedAmenity],
				customAmenity: "",
			}))
			toast.success(`"${trimmedAmenity}" added successfully!`)
		} else if (formData.amenities.includes(trimmedAmenity)) {
			toast.error("This amenity is already added")
		}
	}

	const removeCustomAmenity = (amenityToRemove) => {
		// Only allow removal of custom amenities (not predefined ones)
		const isPredefined =
			COMMON_AMENITIES[formData.category]?.includes(amenityToRemove)
		if (!isPredefined) {
			setFormData((prev) => ({
				...prev,
				amenities: prev.amenities.filter((a) => a !== amenityToRemove),
			}))
			toast.success(`"${amenityToRemove}" removed`)
		}
	}

	// Get custom amenities (those not in the predefined list)
	const getCustomAmenities = () => {
		const predefined = COMMON_AMENITIES[formData.category] || []
		return formData.amenities.filter((amenity) => !predefined.includes(amenity))
	}

	const progressPercentage = (currentStep / totalSteps) * 100

	// Calendar helper functions for voucher dates
	const getTodayDate = () => {
		const today = new Date()
		return today.toISOString().split("T")[0]
	}

	const generateCalendarDays = () => {
		const year = currentMonth.getFullYear()
		const month = currentMonth.getMonth()
		const firstDay = new Date(year, month, 1).getDay()
		const daysInMonth = new Date(year, month + 1, 0).getDate()

		const days = []
		for (let i = 0; i < firstDay; i++) days.push(null)
		for (let day = 1; day <= daysInMonth; day++) {
			const dateString = `${year}-${String(month + 1).padStart(
				2,
				"0"
			)}-${String(day).padStart(2, "0")}`
			days.push({
				day,
				dateString,
				isPast: new Date(dateString) < new Date(getTodayDate()),
			})
		}
		return days
	}

	const previousMonth = () => {
		setCurrentMonth(
			new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1)
		)
	}

	const nextMonth = () => {
		setCurrentMonth(
			new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1)
		)
	}

	const handleCalendarDayClick = (dateString) => {
		if (!activeVoucherId) return

		if (selectingStartDate) {
			// Selecting start date
			setFormData((prev) => ({
				...prev,
				vouchers: {
					...prev.vouchers,
					details: {
						...prev.vouchers.details,
						[activeVoucherId]: {
							...prev.vouchers.details[activeVoucherId],
							startDate: dateString,
							endDate: "",
						},
					},
				},
			}))
			setSelectingStartDate(false)
		} else {
			// Selecting end date
			const startDate = formData.vouchers.details[activeVoucherId]?.startDate
			if (startDate && new Date(dateString) <= new Date(startDate)) {
				toast.error("End date must be after start date")
				return
			}
			setFormData((prev) => ({
				...prev,
				vouchers: {
					...prev.vouchers,
					details: {
						...prev.vouchers.details,
						[activeVoucherId]: {
							...prev.vouchers.details[activeVoucherId],
							endDate: dateString,
						},
					},
				},
			}))
			setSelectingStartDate(true)
			setShowDateModal(false)
		}
	}

	const openDateModal = (voucherId) => {
		setActiveVoucherId(voucherId)
		setSelectingStartDate(true)
		setShowDateModal(true)
	}

	return (
		<div className="listing-wizard-container">
			<div className="listing-wizard-header">
				<button
					className="back-to-dashboard"
					onClick={() => navigate("/dashboardHost")}
				>
					<FaChevronLeft /> Back to Dashboard
				</button>
				<h1>Create a New Listing</h1>
				<div className="progress-bar-container">
					<div
						className="progress-bar"
						style={{ width: `${progressPercentage}%` }}
					></div>
				</div>
				<div className="steps-indicator">
					{Array.from({ length: totalSteps }).map((_, index) => {
						const stepNumber = index + 1
						const isCompleted = stepNumber <= currentStep
						const isCurrent = stepNumber === currentStep

						return (
							<div
								key={index}
								className={`step-dot ${isCompleted ? "active" : ""} ${
									isCurrent ? "current" : ""
								} ${isCompleted ? "clickable" : ""}`}
								onClick={() => handleStepClick(stepNumber)}
								title={
									isCompleted
										? `Go to step ${stepNumber}`
										: `Complete step ${stepNumber - 1} first`
								}
							>
								{stepNumber}
							</div>
						)
					})}
				</div>
			</div>

			<div className="listing-wizard-content">
				{/* Step 1: Category Selection */}
				{currentStep === 1 && (
					<div className="wizard-step">
						<h2>What type of property are you listing?</h2>
						<p className="step-description">
							Choose the category that best describes your offering
						</p>
						<div className="category-selection">
							<button
								className={`category-card ${
									formData.category === "home" ? "selected" : ""
								}`}
								onClick={() => setFormData({ ...formData, category: "home" })}
							>
								<FaHome className="category-icon" />
								<h3>Home</h3>
								<p>Rent out your space</p>
							</button>
							<button
								className={`category-card ${
									formData.category === "service" ? "selected" : ""
								}`}
								onClick={() =>
									setFormData({ ...formData, category: "service" })
								}
							>
								<FaUtensils className="category-icon" />
								<h3>Service</h3>
								<p>Offer your services</p>
							</button>
							<button
								className={`category-card ${
									formData.category === "experience" ? "selected" : ""
								}`}
								onClick={() =>
									setFormData({ ...formData, category: "experience" })
								}
							>
								<FaCamera className="category-icon" />
								<h3>Experience</h3>
								<p>Share an experience</p>
							</button>
						</div>
					</div>
				)}

				{/* Step 2: Property Type */}
				{currentStep === 2 && (
					<div className="wizard-step">
						<h2>What type of {formData.category} is it?</h2>
						<p className="step-description">Select the specific type</p>
						<div className="property-type-grid">
							{PROPERTY_TYPES[formData.category]?.map((type) => {
								const Icon = type.icon
								return (
									<button
										key={type.id}
										className={`property-type-card ${
											formData.propertyType === type.id ? "selected" : ""
										}`}
										onClick={() =>
											setFormData({
												...formData,
												propertyType: type.id,
												customPropertyType: "", // Clear custom type when selecting predefined
											})
										}
									>
										<Icon className="property-type-icon" />
										<span>{type.name}</span>
									</button>
								)
							})}
							{/* Others Option */}
							<button
								className={`property-type-card ${
									formData.propertyType === "others" ? "selected" : ""
								}`}
								onClick={() =>
									setFormData({
										...formData,
										propertyType: "others",
									})
								}
							>
								<FaPlus className="property-type-icon" />
								<span>Others</span>
							</button>
						</div>

						{/* Custom Property Type Input */}
						{formData.propertyType === "others" && (
							<div className="custom-type-input">
								<label>Specify Property Type *</label>
								<input
									type="text"
									placeholder="e.g., Treehouse, Boat, RV, Tiny Home, etc."
									value={formData.customPropertyType}
									onChange={(e) =>
										setFormData({
											...formData,
											customPropertyType: e.target.value,
										})
									}
									maxLength={50}
								/>
								<p className="input-hint">
									Enter the type of {formData.category} you're listing
								</p>
							</div>
						)}
					</div>
				)}

				{/* Step 3: Property Info */}
				{currentStep === 3 && (
					<div className="wizard-step">
						<h2>
							Tell us about your{" "}
							{formData.propertyType === "others"
								? formData.customPropertyType || "property"
								: PROPERTY_TYPES[formData.category]?.find(
										(t) => t.id === formData.propertyType
								  )?.name || formData.propertyType}
						</h2>
						<p className="step-description">
							Add details to help guests find your listing
						</p>

						<div className="form-group">
							<label>Property Title *</label>
							<input
								type="text"
								placeholder="e.g., Cozy Mountain Cabin with Lake View"
								value={formData.title}
								onChange={(e) =>
									setFormData({ ...formData, title: e.target.value })
								}
								maxLength={100}
							/>
						</div>

						<div className="form-group">
							<label>Description *</label>
							<textarea
								placeholder="Describe your property, its unique features, and what guests can expect..."
								value={formData.description}
								onChange={(e) =>
									setFormData({ ...formData, description: e.target.value })
								}
								rows={6}
								maxLength={2000}
							/>
							<span className="char-count">
								{formData.description.length}/2000
							</span>
						</div>

						<div className="form-group">
							<label>Location *</label>
							<div className="map-container">
								<div ref={mapContainerRef} className="map-wrapper"></div>
							</div>
							<input
								type="text"
								placeholder="Address"
								value={formData.location.address}
								readOnly
								className="address-display"
							/>
							<div className="location-details">
								<input
									type="text"
									placeholder="City"
									value={formData.location.city}
									onChange={(e) =>
										setFormData({
											...formData,
											location: { ...formData.location, city: e.target.value },
										})
									}
								/>
								<input
									type="text"
									placeholder="Province"
									value={formData.location.province}
									onChange={(e) =>
										setFormData({
											...formData,
											location: {
												...formData.location,
												province: e.target.value,
											},
										})
									}
								/>
								<input
									type="text"
									placeholder="Zip Code"
									value={formData.location.zipCode}
									onChange={(e) =>
										setFormData({
											...formData,
											location: {
												...formData.location,
												zipCode: e.target.value,
											},
										})
									}
								/>
							</div>
						</div>

						<div className="pricing-group">
							<div className="form-group">
								<label>Base Price per Night (₱) *</label>
								<input
									type="number"
									placeholder="5000"
									value={formData.pricing.basePrice}
									onChange={(e) =>
										setFormData({
											...formData,
											pricing: {
												...formData.pricing,
												basePrice: e.target.value,
											},
										})
									}
									min="0"
									step="100"
								/>
							</div>
						</div>
					</div>
				)}

				{/* Step 4: Images */}
				{currentStep === 4 && (
					<div className="wizard-step">
						<h2>
							Add photos of your {formData.title || formData.propertyType}
						</h2>
						<p className="step-description">
							Upload photos to make your listing stand out (Maximum 7 photos)
						</p>

						<div className="image-upload-section">
							<div
								className={`image-upload-box ${isDragging ? "drag-over" : ""} ${
									uploadingImages ? "uploading" : ""
								} ${formData.images.length >= 7 ? "max-reached" : ""}`}
								onDragOver={handleDragOver}
								onDragLeave={handleDragLeave}
								onDrop={handleDrop}
							>
								<input
									type="file"
									id="image-upload"
									multiple
									accept="image/*"
									onChange={(e) => handleImageUpload(e.target.files)}
									disabled={uploadingImages || formData.images.length >= 7}
									style={{ display: "none" }}
								/>
								<label
									htmlFor="image-upload"
									className={`upload-button ${
										formData.images.length >= 7 ? "disabled" : ""
									}`}
								>
									<FaUpload />{" "}
									{uploadingImages
										? "Uploading..."
										: formData.images.length >= 7
										? "Maximum Photos Reached"
										: "Upload Images"}
								</label>
								<p className="upload-hint">
									{formData.images.length >= 7 ? (
										<>Maximum 7 photos reached. Remove photos to add more.</>
									) : (
										<>
											Drop images here or click to upload (Max 7 photos, 10MB
											each)
										</>
									)}
								</p>
								{formData.images.length > 0 && (
									<p className="image-count-hint">
										{formData.images.length} / 7 photos uploaded
									</p>
								)}
							</div>

							<div className="images-grid">
								{formData.images.map((url, index) => (
									<div key={index} className="image-preview">
										<img src={url} alt={`Property ${index + 1}`} />
										<button
											className="remove-image"
											onClick={() => removeImage(index)}
										>
											<FaTimes />
										</button>
										{index === 0 && (
											<span className="primary-badge">Primary</span>
										)}
									</div>
								))}
							</div>
						</div>
					</div>
				)}

				{/* Step 5: Amenities */}
				{currentStep === 5 && (
					<div className="wizard-step">
						<h2>What amenities do you offer?</h2>
						<p className="step-description">Select all that apply</p>

						<div className="amenities-grid">
							{COMMON_AMENITIES[formData.category]?.map((amenity) => (
								<label key={amenity} className="amenity-checkbox">
									<input
										type="checkbox"
										checked={formData.amenities.includes(amenity)}
										onChange={() => toggleAmenity(amenity)}
									/>
									<span>{amenity}</span>
								</label>
							))}
						</div>

						<div className="custom-amenity-section">
							<label className="custom-amenity-label">
								<FaPlus /> Add Custom Amenity
							</label>
							<div className="custom-amenity-input">
								<input
									type="text"
									placeholder="e.g., Hot Tub, Sauna, Gaming Room, etc."
									value={formData.customAmenity}
									onChange={(e) =>
										setFormData({ ...formData, customAmenity: e.target.value })
									}
									onKeyPress={(e) => e.key === "Enter" && addCustomAmenity()}
								/>
								<button
									onClick={addCustomAmenity}
									className="custom-add-button"
									disabled={!formData.customAmenity.trim()}
								>
									<FaPlus /> Add
								</button>
							</div>

							{getCustomAmenities().length > 0 && (
								<div className="custom-amenities-list">
									<h4 className="custom-list-title">Your Custom Amenities</h4>
									<div className="custom-amenities-items">
										{getCustomAmenities().map((amenity, index) => (
											<div key={index} className="custom-amenity-item">
												<span className="custom-amenity-name">
													<FaCheckCircle className="check-icon" />
													{amenity}
												</span>
												<button
													type="button"
													className="remove-custom-amenity"
													onClick={() => removeCustomAmenity(amenity)}
													title="Remove amenity"
												>
													<FaTimes />
												</button>
											</div>
										))}
									</div>
								</div>
							)}
						</div>
					</div>
				)}

				{/* Step 6: Capacity & Details */}
				{currentStep === 6 && (
					<div className="wizard-step">
						<h2>How many guests can stay?</h2>
						<p className="step-description">
							Share details about your property's capacity
						</p>

						<div className="capacity-grid">
							<div className="capacity-item">
								<FaUsers className="capacity-icon" />
								<label>Maximum Guests *</label>
								<input
									type="number"
									placeholder="4"
									value={formData.capacity.guests}
									onChange={(e) =>
										setFormData({
											...formData,
											capacity: {
												...formData.capacity,
												guests: e.target.value,
											},
										})
									}
									min="1"
								/>
							</div>

							{formData.category === "home" && (
								<>
									<div className="capacity-item">
										<FaBed className="capacity-icon" />
										<label>Bedrooms</label>
										<input
											type="number"
											placeholder="2"
											value={formData.capacity.bedrooms}
											onChange={(e) =>
												setFormData({
													...formData,
													capacity: {
														...formData.capacity,
														bedrooms: e.target.value,
													},
												})
											}
											min="0"
										/>
									</div>
									<div className="capacity-item">
										<FaBed className="capacity-icon" />
										<label>Beds</label>
										<input
											type="number"
											placeholder="2"
											value={formData.capacity.beds}
											onChange={(e) =>
												setFormData({
													...formData,
													capacity: {
														...formData.capacity,
														beds: e.target.value,
													},
												})
											}
											min="1"
										/>
									</div>
									<div className="capacity-item">
										<FaBath className="capacity-icon" />
										<label>Bathrooms</label>
										<input
											type="number"
											placeholder="1"
											value={formData.capacity.bathrooms}
											onChange={(e) =>
												setFormData({
													...formData,
													capacity: {
														...formData.capacity,
														bathrooms: e.target.value,
													},
												})
											}
											min="1"
										/>
									</div>
								</>
							)}
						</div>

						<div className="form-group">
							<label>Meal Included</label>
							<div className="meal-checkbox-grid">
								<label className="meal-checkbox">
									<input
										type="checkbox"
										checked={formData.mealIncluded.includes("breakfast")}
										onChange={() => {
											const meals = formData.mealIncluded.includes("breakfast")
												? formData.mealIncluded.filter((m) => m !== "breakfast")
												: [...formData.mealIncluded, "breakfast"]
											setFormData({ ...formData, mealIncluded: meals })
										}}
									/>
									<span>Breakfast</span>
								</label>
								<label className="meal-checkbox">
									<input
										type="checkbox"
										checked={formData.mealIncluded.includes("lunch")}
										onChange={() => {
											const meals = formData.mealIncluded.includes("lunch")
												? formData.mealIncluded.filter((m) => m !== "lunch")
												: [...formData.mealIncluded, "lunch"]
											setFormData({ ...formData, mealIncluded: meals })
										}}
									/>
									<span>Lunch</span>
								</label>
								<label className="meal-checkbox">
									<input
										type="checkbox"
										checked={formData.mealIncluded.includes("dinner")}
										onChange={() => {
											const meals = formData.mealIncluded.includes("dinner")
												? formData.mealIncluded.filter((m) => m !== "dinner")
												: [...formData.mealIncluded, "dinner"]
											setFormData({ ...formData, mealIncluded: meals })
										}}
									/>
									<span>Dinner</span>
								</label>
							</div>
						</div>

						<div className="form-group">
							<label>House Rules</label>
							<p
								className="step-description"
								style={{ marginBottom: "1rem", fontSize: "0.9rem" }}
							>
								Select the rules that apply to your property
							</p>
							<div className="amenities-grid">
								{[
									"No smoking",
									"No parties or events",
									"Pets not allowed",
									"Check-in after 2:00 PM",
									"Check-out before 12:00 PM",
									"No loud music",
									"Quiet hours after 10 PM",
								].map((rule) => (
									<label key={rule} className="amenity-checkbox">
										<input
											type="checkbox"
											checked={formData.houseRules.includes(rule)}
											onChange={() => {
												const rules = formData.houseRules.includes(rule)
													? formData.houseRules.filter((r) => r !== rule)
													: [...formData.houseRules, rule]
												setFormData({ ...formData, houseRules: rules })
											}}
										/>
										<span>{rule}</span>
									</label>
								))}
							</div>
							<div
								className="custom-amenity-section"
								style={{ marginTop: "2rem" }}
							>
								<label className="custom-amenity-label">
									<FaPlus /> Add Custom House Rule
								</label>
								<div className="custom-amenity-input">
									<input
										type="text"
										placeholder="e.g., No shoes inside, No cooking after 10 PM, etc."
										value={formData.customHouseRule || ""}
										onChange={(e) =>
											setFormData({
												...formData,
												customHouseRule: e.target.value,
											})
										}
										onKeyPress={(e) => {
											if (e.key === "Enter") {
												const trimmedRule = formData.customHouseRule?.trim()
												if (
													trimmedRule &&
													!formData.houseRules.includes(trimmedRule)
												) {
													setFormData({
														...formData,
														houseRules: [...formData.houseRules, trimmedRule],
														customHouseRule: "",
													})
													toast.success(`"${trimmedRule}" added successfully!`)
												} else if (formData.houseRules.includes(trimmedRule)) {
													toast.error("This rule is already added")
												}
											}
										}}
									/>
									<button
										className="custom-add-button"
										onClick={() => {
											const trimmedRule = formData.customHouseRule?.trim()
											if (
												trimmedRule &&
												!formData.houseRules.includes(trimmedRule)
											) {
												setFormData({
													...formData,
													houseRules: [...formData.houseRules, trimmedRule],
													customHouseRule: "",
												})
												toast.success(`"${trimmedRule}" added successfully!`)
											} else if (formData.houseRules.includes(trimmedRule)) {
												toast.error("This rule is already added")
											}
										}}
										disabled={!formData.customHouseRule?.trim()}
									>
										<FaPlus /> Add
									</button>
								</div>
								{formData.houseRules.filter(
									(rule) =>
										![
											"No smoking",
											"No parties or events",
											"Pets not allowed",
											"Check-in after 2:00 PM",
											"Check-out before 12:00 PM",
											"No loud music",
											"Quiet hours after 10 PM",
										].includes(rule)
								).length > 0 && (
									<div className="custom-amenities-list">
										<h4 className="custom-list-title">Your Custom Rules</h4>
										<div className="custom-amenities-items">
											{formData.houseRules
												.filter(
													(rule) =>
														![
															"No smoking",
															"No parties or events",
															"Pets not allowed",
															"Check-in after 2:00 PM",
															"Check-out before 12:00 PM",
															"No loud music",
															"Quiet hours after 10 PM",
														].includes(rule)
												)
												.map((rule, index) => (
													<div key={index} className="custom-amenity-item">
														<span className="custom-amenity-name">
															<FaCheckCircle className="check-icon" />
															{rule}
														</span>
														<button
															type="button"
															className="remove-custom-amenity"
															onClick={() => {
																setFormData({
																	...formData,
																	houseRules: formData.houseRules.filter(
																		(r) => r !== rule
																	),
																})
																toast.success(`"${rule}" removed`)
															}}
															title="Remove rule"
														>
															<FaTimes />
														</button>
													</div>
												))}
										</div>
									</div>
								)}
							</div>
						</div>

						<div className="form-group">
							<label>Booking Availability</label>
							<p
								className="step-description"
								style={{ marginBottom: "1rem", fontSize: "0.9rem" }}
							>
								Configure how guests can book your property
							</p>
							<div
								style={{
									display: "flex",
									flexDirection: "column",
									gap: "1.5rem",
								}}
							>
								<label className="amenity-checkbox" style={{ padding: "1rem" }}>
									<input
										type="checkbox"
										checked={formData.availability.instantBook}
										onChange={(e) =>
											setFormData({
												...formData,
												availability: {
													...formData.availability,
													instantBook: e.target.checked,
												},
											})
										}
									/>
									<span>
										<strong>Instant Book</strong> - Allow guests to book
										immediately without approval
									</span>
								</label>
								<div
									style={{
										display: "grid",
										gridTemplateColumns: "repeat(2, 1fr)",
										gap: "1rem",
									}}
								>
									<div className="capacity-item">
										<label>Minimum Nights</label>
										<input
											type="number"
											placeholder="1"
											value={formData.availability.minNights}
											onChange={(e) =>
												setFormData({
													...formData,
													availability: {
														...formData.availability,
														minNights: parseInt(e.target.value) || 1,
													},
												})
											}
											min="1"
										/>
									</div>
									<div className="capacity-item">
										<label>Maximum Nights</label>
										<input
											type="number"
											placeholder="30"
											value={formData.availability.maxNights}
											onChange={(e) =>
												setFormData({
													...formData,
													availability: {
														...formData.availability,
														maxNights: parseInt(e.target.value) || 30,
													},
												})
											}
											min="1"
										/>
									</div>
								</div>
							</div>
						</div>
					</div>
				)}

				{/* Step 7: Voucher System */}
				{currentStep === 7 && (
					<div className="wizard-step">
						<h2>Configure Voucher System</h2>
						<p className="step-description">
							Select the voucher types that can be used for this property
						</p>

						<div className="form-group">
							<label>Voucher Types</label>
							<p
								className="step-description"
								style={{ marginBottom: "1rem", fontSize: "0.9rem" }}
							>
								Choose which types of promotional vouchers guests can use when
								booking this property
							</p>
							<div className="amenities-grid">
								{[
									{
										id: "early_bird",
										name: "Early Bird Promo",
										icon: FaCalendarCheck,
										description: "Discounts for bookings made well in advance",
									},
									{
										id: "christmas",
										name: "Christmas Special",
										icon: FaGift,
										description: "Holiday season promotions",
									},
									{
										id: "new_year",
										name: "New Year Special",
										icon: FaGift,
										description: "Year-end and new year deals",
									},
									{
										id: "valentines",
										name: "Valentine's Special",
										icon: FaGift,
										description: "Romantic getaway discounts",
									},
									{
										id: "summer",
										name: "Summer Special",
										icon: FaStar,
										description: "Summer season promotions",
									},
									{
										id: "anniversary",
										name: "Anniversary Promo",
										icon: FaGift,
										description: "Celebrate 1 year of listing",
									},
									{
										id: "weekend",
										name: "Weekend Getaway",
										icon: FaTicketAlt,
										description: "Weekend booking discounts",
									},
									{
										id: "long_stay",
										name: "Long Stay Discount",
										icon: FaTicketAlt,
										description: "Extended stay promotions",
									},
									{
										id: "flash_sale",
										name: "Flash Sale",
										icon: FaTicketAlt,
										description: "Limited time flash promotions",
									},
								].map((voucher) => {
									const IconComponent = voucher.icon
									return (
										<div
											key={voucher.id}
											style={{
												border: "2px solid #e0e0e0",
												borderRadius: "12px",
												padding: "1.5rem",
												cursor: "pointer",
												transition: "all 0.3s ease",
												background: formData.vouchers.types.includes(voucher.id)
													? "rgba(97, 191, 156, 0.05)"
													: "white",
											}}
											onClick={() => {
												const isAdding = !formData.vouchers.types.includes(
													voucher.id
												)
												const types = isAdding
													? [...formData.vouchers.types, voucher.id]
													: formData.vouchers.types.filter(
															(t) => t !== voucher.id
													  )
												
												// Initialize voucher details based on type
												const voucherDetails = { ...formData.vouchers.details[voucher.id] }
												if (isAdding) {
													voucherDetails.discount = voucherDetails.discount || "20"
													// For long_stay, initialize with empty minDays (user must fill it)
													if (voucher.id === "long_stay") {
														// Don't set minDays here, let user fill it
														// But ensure dates are removed
														delete voucherDetails.startDate
														delete voucherDetails.endDate
													}
												}
												
												setFormData({
													...formData,
													vouchers: {
														...formData.vouchers,
														types,
														details: isAdding
															? {
																	...formData.vouchers.details,
																	[voucher.id]: voucherDetails,
															  }
															: formData.vouchers.details,
													},
												})
											}}
											onMouseEnter={(e) => {
												if (!formData.vouchers.types.includes(voucher.id)) {
													e.currentTarget.style.borderColor = "var(--primary)"
													e.currentTarget.style.transform = "translateY(-2px)"
												}
											}}
											onMouseLeave={(e) => {
												if (!formData.vouchers.types.includes(voucher.id)) {
													e.currentTarget.style.borderColor = "#e0e0e0"
													e.currentTarget.style.transform = "translateY(0)"
												}
											}}
										>
											<div
												style={{
													display: "flex",
													alignItems: "center",
													gap: "1rem",
													marginBottom: "0.5rem",
												}}
											>
												<span
													style={{
														fontSize: "1.5rem",
														color: "var(--primary)",
													}}
												>
													<IconComponent />
												</span>
												<strong
													style={{
														color: formData.vouchers.types.includes(voucher.id)
															? "var(--primary)"
															: "#222",
														fontSize: "1rem",
													}}
												>
													{voucher.name}
												</strong>
											</div>
											<p
												style={{
													margin: 0,
													fontSize: "0.85rem",
													color: "#717171",
												}}
											>
												{voucher.description}
											</p>
											{formData.vouchers.types.includes(voucher.id) && (
												<div
													style={{
														marginTop: "1rem",
														paddingTop: "1rem",
														borderTop: "1px solid #e0e0e0",
														display: "flex",
														flexDirection: "column",
														gap: "0.75rem",
													}}
													onClick={(e) => e.stopPropagation()}
												>
													<div
														style={{
															display: "flex",
															gap: "0.75rem",
															alignItems: "center",
														}}
													>
														<input
															type="number"
															placeholder="Discount"
															value={
																formData.vouchers.details[voucher.id]
																	?.discount || "20"
															}
															onChange={(e) =>
																setFormData({
																	...formData,
																	vouchers: {
																		...formData.vouchers,
																		details: {
																			...formData.vouchers.details,
																			[voucher.id]: {
																				...formData.vouchers.details[
																					voucher.id
																				],
																				discount: e.target.value,
																			},
																		},
																	},
																})
															}
															style={{
																flex: 1,
																padding: "0.5rem",
																border: "1px solid #b0b0b0",
																borderRadius: "6px",
																fontSize: "0.9rem",
															}}
															min="0"
														/>
														<select
															value={
																formData.vouchers.details[voucher.id]
																	?.discountType || "percent"
															}
															onChange={(e) =>
																setFormData({
																	...formData,
																	vouchers: {
																		...formData.vouchers,
																		details: {
																			...formData.vouchers.details,
																			[voucher.id]: {
																				...formData.vouchers.details[
																					voucher.id
																				],
																				discountType: e.target.value,
																			},
																		},
																	},
																})
															}
															style={{
																padding: "0.5rem",
																border: "1px solid #b0b0b0",
																borderRadius: "6px",
																fontSize: "0.9rem",
																background: "white",
																width: "80px",
															}}
														>
															<option value="percent">%</option>
															<option value="price">₱</option>
														</select>
													</div>
													{/* For long_stay, show minimum days field instead of date button */}
													{voucher.id === "long_stay" ? (
														<div className="form-group" style={{ marginTop: "0.5rem" }}>
															<label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", fontWeight: "500" }}>
																Minimum Days to Make a Discount *
															</label>
															<input
																type="number"
																placeholder="e.g., 7"
																value={
																	formData.vouchers.details[voucher.id]
																		?.minDays || formData.vouchers.details[voucher.id]
																		?.minimumDays || ""
																}
																onChange={(e) =>
																	setFormData({
																		...formData,
																		vouchers: {
																			...formData.vouchers,
																			details: {
																				...formData.vouchers.details,
																				[voucher.id]: {
																					...formData.vouchers.details[
																						voucher.id
																					],
																					minDays: e.target.value,
																					minimumDays: e.target.value,
																					// Remove dates if they exist
																					startDate: undefined,
																					endDate: undefined,
																				},
																			},
																		},
																	})
																}
																style={{
																	width: "100%",
																	padding: "0.5rem",
																	border: "1px solid #b0b0b0",
																	borderRadius: "6px",
																	fontSize: "0.9rem",
																}}
																min="1"
																required
															/>
															<small style={{ display: "block", marginTop: "0.25rem", fontSize: "0.75rem", color: "#666" }}>
																Minimum number of days required to apply this discount
															</small>
														</div>
													) : ![
														"christmas",
														"new_year",
														"valentines",
														"summer",
														"anniversary",
														"weekend",
													].includes(voucher.id) && (
														<button
															type="button"
															onClick={() => openDateModal(voucher.id)}
															style={{
																width: "100%",
																padding: "0.75rem",
																border: "1px solid #b0b0b0",
																borderRadius: "6px",
																fontSize: "0.9rem",
																background: "white",
																cursor: "pointer",
																display: "flex",
																alignItems: "center",
																justifyContent: "center",
																gap: "0.5rem",
																transition: "all 0.2s ease",
															}}
															onMouseEnter={(e) => {
																e.target.style.borderColor = "var(--primary)"
																e.target.style.background =
																	"rgba(97, 191, 156, 0.05)"
															}}
															onMouseLeave={(e) => {
																e.target.style.borderColor = "#b0b0b0"
																e.target.style.background = "white"
															}}
														>
															<FaCalendarAlt />
															<span>
																{formData.vouchers.details[voucher.id]
																	?.startDate &&
																formData.vouchers.details[voucher.id]?.endDate
																	? `${new Date(
																			formData.vouchers.details[
																				voucher.id
																			].startDate
																	  ).toLocaleDateString()} → ${new Date(
																			formData.vouchers.details[
																				voucher.id
																			].endDate
																	  ).toLocaleDateString()}`
																	: "Select date range"}
															</span>
														</button>
													)}
												</div>
											)}
										</div>
									)
								})}
							</div>
							<p
								className="step-description"
								style={{
									marginTop: "1.5rem",
									fontSize: "0.85rem",
									fontStyle: "italic",
									color: "#999",
								}}
							>
								💡 Set the discount percentage and duration for each selected
								voucher
							</p>
						</div>
					</div>
				)}

				{/* Navigation Buttons */}
				<div className="wizard-navigation">
					<div className="nav-left">
						{currentStep > 1 && (
							<button
								className="nav-button prev-button"
								onClick={handlePrevious}
							>
								<FaChevronLeft /> Previous
							</button>
						)}
						{currentStep >= 2 && (
							<button
								className="nav-button save-draft-button"
								onClick={handleSaveDraft}
								disabled={savingDraft}
							>
								<FaSave />{" "}
								{savingDraft
									? "Saving..."
									: draftId
									? "Update Draft"
									: "Save to Draft"}
							</button>
						)}
					</div>

					{currentStep < totalSteps ? (
						<button className="nav-button next-button" onClick={handleNext}>
							Next <FaChevronRight />
						</button>
					) : (
						<button
							className="nav-button submit-button"
							onClick={handleSubmit}
							disabled={loading}
						>
							{loading ? "Publishing..." : "Publish Listing"}
						</button>
					)}
				</div>
			</div>

			{/* Calendar Modal for Voucher Dates */}
			{showDateModal && (
				<div
					className="date-picker-modal-overlay"
					onClick={() => setShowDateModal(false)}
				>
					<div
						className="date-picker-modal-content"
						onClick={(e) => e.stopPropagation()}
					>
						<button
							className="close-date-modal"
							onClick={() => setShowDateModal(false)}
						>
							<FaTimes />
						</button>
						<h2>
							<FaCalendarAlt /> Select Voucher Date Range
						</h2>
						<div className="modal-date-info">
							<div className="selected-dates-display">
								{formData.vouchers.details[activeVoucherId]?.startDate && (
									<div className="selected-date-item check-in">
										<span className="date-type">Start Date:</span>
										<span className="date-text">
											{new Date(
												formData.vouchers.details[activeVoucherId].startDate
											).toLocaleDateString()}
										</span>
									</div>
								)}
								{formData.vouchers.details[activeVoucherId]?.endDate && (
									<div className="selected-date-item check-out">
										<span className="date-type">End Date:</span>
										<span className="date-text">
											{new Date(
												formData.vouchers.details[activeVoucherId].endDate
											).toLocaleDateString()}
										</span>
									</div>
								)}
								{!formData.vouchers.details[activeVoucherId]?.startDate &&
									!formData.vouchers.details[activeVoucherId]?.endDate && (
										<p className="instruction-text">
											{selectingStartDate
												? "Click on a date to select start date"
												: "Click on a date to select end date"}
										</p>
									)}
							</div>
						</div>

						<div className="modal-calendar">
							<div className="month-view">
								<div className="month-header">
									<button onClick={previousMonth} className="month-nav-btn">
										◀
									</button>
									<h3>
										{currentMonth.toLocaleString("default", {
											month: "long",
											year: "numeric",
										})}
									</h3>
									<button onClick={nextMonth} className="month-nav-btn">
										▶
									</button>
								</div>
								<div className="calendar-days">
									{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
										(day) => (
											<div key={day} className="day-label">
												{day}
											</div>
										)
									)}
									{generateCalendarDays().map((dayData, index) =>
										dayData ? (
											<div
												key={index}
												className={`calendar-day ${
													dayData.isPast ? "past" : "available"
												} ${
													dayData.dateString ===
													formData.vouchers.details[activeVoucherId]?.startDate
														? "selected-check-in"
														: ""
												} ${
													dayData.dateString ===
													formData.vouchers.details[activeVoucherId]?.endDate
														? "selected-check-out"
														: ""
												}`}
												onClick={() =>
													handleCalendarDayClick(dayData.dateString)
												}
												title={dayData.isPast ? "Past date" : "Available"}
											>
												{dayData.day}
											</div>
										) : (
											<div key={index} className="calendar-day empty"></div>
										)
									)}
								</div>
							</div>
							<div className="calendar-legend">
								<div className="legend-item">
									<span className="legend-color available"></span>
									Available
								</div>
								<div className="legend-item">
									<span className="legend-color past"></span>
									Past Date
								</div>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
