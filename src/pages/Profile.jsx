import { useState, useEffect, useRef, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import { db, auth } from "../components/firebaseConfig"
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore"
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth"
import { toast } from "react-stacked-toast"
import "../css/Profile.css"
import { getFirebaseErrorMessage } from "../utils/errorMessages"
import {
	FaArrowLeft,
	FaUser,
	FaEnvelope,
	FaPhone,
	FaMapMarkerAlt,
	FaCalendarAlt,
	FaEdit,
	FaCamera,
	FaShieldAlt,
	FaCreditCard,
	FaBell,
	FaCheckCircle,
	FaExclamationTriangle,
	FaSave,
	FaTimes,
	FaMapMarkedAlt,
} from "react-icons/fa"
import viewIcon from "../assets/icons/view.png"
import hideIcon from "../assets/icons/hide.png"

export default function Profile() {
	const navigate = useNavigate()
	const { currentUser, userData } = useAuth()
	const [activeTab, setActiveTab] = useState("personal")
	const [isEditing, setIsEditing] = useState(false)
	const [isSaving, setIsSaving] = useState(false)
	const [isLoading, setIsLoading] = useState(true)
	const [showMapModal, setShowMapModal] = useState(false)
	const mapRef = useRef(null)
	const streetViewRef = useRef(null)
	const editMapRef = useRef(null)
	const editMapInstance = useRef(null)
	const editMarker = useRef(null)

	// Get user data
	const displayName =
		userData?.displayName || currentUser?.displayName || "Guest User"
	const email = userData?.email || currentUser?.email || ""
	const userType = userData?.userType || "guest"
	const joinDate = userData?.createdAt?.toDate?.() || new Date()

	// Profile data from Firebase
	const [profileData, setProfileData] = useState({
		phone: "",
		location: "",
		bio: "",
		gender: "",
		dateOfBirth: "",
		currency: "PHP (₱)",
		notifications: true,
		emailUpdates: true,
		paypalEmail: "",
		totalBookings: 0,
		reviewsWritten: 0,
		wishlistItems: 0,
		totalSpent: 0,
	})

	// Edit form data
	const [editData, setEditData] = useState({
		phone: "",
		location: "",
		bio: "",
		gender: "",
		dateOfBirth: "",
		birthDay: "",
		birthMonth: "",
		birthYear: "",
	})

	// PayPal state
	const [paypalConnected, setPaypalConnected] = useState(false)
	const [showPaypalModal, setShowPaypalModal] = useState(false)
	const [paypalEmail, setPaypalEmail] = useState("")

	// Password reset state
	const [showPasswordModal, setShowPasswordModal] = useState(false)
	const [passwordData, setPasswordData] = useState({
		currentPassword: "",
		newPassword: "",
		confirmPassword: "",
	})
	const [showCurrentPassword, setShowCurrentPassword] = useState(false)
	const [showNewPassword, setShowNewPassword] = useState(false)
	const [showConfirmPassword, setShowConfirmPassword] = useState(false)
	const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)

	// Profile picture state
	const [uploadingPhoto, setUploadingPhoto] = useState(false)
	const [profilePhotoUrl, setProfilePhotoUrl] = useState("")

	// ImgBB API Key
	const IMGBB_API_KEY = import.meta.env.VITE_IMGBB_API_KEY

	// Check if profile is incomplete
	const isProfileIncomplete =
		!profileData.phone ||
		!profileData.location ||
		!profileData.bio ||
		!profileData.gender ||
		!profileData.dateOfBirth

	// Mapbox Access Token
	const MAPBOX_TOKEN =
		"pk.eyJ1IjoidGludGFuMjQiLCJhIjoiY21oNTFqeHA0MDJ6aTJxcHVhMjgzcHF6cSJ9.1Bl76fy8KzMBFXF-LsKyEQ"

	// Load Mapbox GL JS and PayPal SDK
	useEffect(() => {
		// Load Mapbox CSS
		const link = document.createElement("link")
		link.href = "https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.css"
		link.rel = "stylesheet"
		document.head.appendChild(link)

		// Load Mapbox JS
		const script = document.createElement("script")
		script.src = "https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.js"
		script.async = true
		document.head.appendChild(script)

		// Load Mapbox Geocoder plugin
		const geocoderLink = document.createElement("link")
		geocoderLink.href =
			"https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-geocoder/v5.0.0/mapbox-gl-geocoder.css"
		geocoderLink.rel = "stylesheet"
		document.head.appendChild(geocoderLink)

		const geocoderScript = document.createElement("script")
		geocoderScript.src =
			"https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-geocoder/v5.0.0/mapbox-gl-geocoder.min.js"
		geocoderScript.async = true
		document.head.appendChild(geocoderScript)

		// Load PayPal SDK (Sandbox)
		const paypalScript = document.createElement("script")
		paypalScript.src =
			`https://www.paypal.com/sdk/js?client-id=${import.meta.env.VITE_PAYPAL_CLIENT_ID}&vault=true&intent=tokenize`
		paypalScript.async = true
		document.head.appendChild(paypalScript)

		return () => {
			// Cleanup
			if (link.parentNode) link.parentNode.removeChild(link)
			if (script.parentNode) script.parentNode.removeChild(script)
			if (geocoderLink.parentNode)
				geocoderLink.parentNode.removeChild(geocoderLink)
			if (geocoderScript.parentNode)
				geocoderScript.parentNode.removeChild(geocoderScript)
			if (paypalScript.parentNode)
				paypalScript.parentNode.removeChild(paypalScript)
		}
	}, [])

	// Fetch user stats dynamically from Firebase
	const fetchUserStats = async () => {
		if (!currentUser?.uid) return

		try {
			// Check if user is a host
			const isHost = userType === "host"

			if (isHost) {
				// Host stats
				let totalListings = 0
				let totalBookings = 0
				let totalRatings = 0
				let totalEarned = 0

				// Fetch properties to calculate total listings and average rating
				try {
					// Try querying by top-level hostId first
					let properties = []
					const propertyIds = new Set() // Track document IDs to avoid duplicates
					
					try {
						const propertiesQuery = query(
							collection(db, "properties"),
							where("hostId", "==", currentUser.uid)
						)
						const propertiesSnapshot = await getDocs(propertiesQuery)
						properties = propertiesSnapshot.docs.map((doc) => {
							propertyIds.add(doc.id)
							return { id: doc.id, ...doc.data() }
						})
						console.log("[Profile] Found properties by hostId:", properties.length)
					} catch (hostIdError) {
						console.log("Error querying by hostId:", hostIdError)
					}

					// Also check for properties with host.hostId (fallback for older properties)
					try {
						const propertiesQuery2 = query(
							collection(db, "properties"),
							where("host.hostId", "==", currentUser.uid)
						)
						const propertiesSnapshot2 = await getDocs(propertiesQuery2)
						const properties2 = propertiesSnapshot2.docs
							.map((doc) => ({ id: doc.id, ...doc.data() }))
							.filter(p => !propertyIds.has(p.id)) // Only add if not already found
						
						properties2.forEach(p => propertyIds.add(p.id))
						properties = [...properties, ...properties2]
						console.log("[Profile] Found additional properties by host.hostId:", properties2.length)
					} catch (hostHostIdError) {
						console.log("Error querying by host.hostId:", hostHostIdError)
					}

					// If still no properties, try fetching all and filtering in memory (fallback)
					if (properties.length === 0) {
						try {
							const allPropertiesSnapshot = await getDocs(collection(db, "properties"))
							properties = allPropertiesSnapshot.docs
								.map((doc) => ({ id: doc.id, ...doc.data() }))
								.filter(p => 
									(p.hostId === currentUser.uid) || 
									(p.host?.hostId === currentUser.uid)
								)
							console.log("[Profile] Found properties by fetching all:", properties.length)
						} catch (allPropertiesError) {
							console.log("Error fetching all properties:", allPropertiesError)
						}
					}
					
					totalListings = properties.length
					console.log("[Profile] Host properties found:", totalListings, properties.map(p => ({ id: p.id, title: p.title, hostId: p.hostId, hostHostId: p.host?.hostId })))
					
					// Calculate average rating from all properties
					const propertiesWithRatings = properties.filter(p => p.rating && p.rating > 0)
					if (propertiesWithRatings.length > 0) {
						const sumRatings = propertiesWithRatings.reduce((sum, p) => sum + (p.rating || 0), 0)
						totalRatings = sumRatings / propertiesWithRatings.length
					}
				} catch (propertiesError) {
					console.error("Error fetching properties:", propertiesError)
					console.log("Properties collection may not exist yet:", propertiesError)
				}

				// Fetch bookings to calculate total bookings and total earned
				try {
					const bookingsQuery = query(
						collection(db, "bookings"),
						where("hostId", "==", currentUser.uid)
					)
					const bookingsSnapshot = await getDocs(bookingsQuery)
					const bookings = bookingsSnapshot.docs.map((doc) => doc.data())
					
					totalBookings = bookings.length
					
					// Calculate total earned from all bookings
					totalEarned = bookings.reduce((sum, booking) => {
						return sum + (booking.pricing?.total || 0)
					}, 0)
				} catch (bookingError) {
					console.log("Bookings collection may not exist yet:", bookingError)
				}

				// Update profile data with calculated host stats
				setProfileData((prev) => ({
					...prev,
					totalListings,
					totalBookings,
					totalRatings: totalRatings.toFixed(1),
					totalEarned,
				}))
			} else {
				// Guest stats (keep existing logic)
				let totalBookings = 0
				let reviewsWritten = 0
				let wishlistItems = 0
				let totalSpent = 0

				// Fetch bookings to calculate total bookings and total spent
				try {
					const bookingsQuery = query(
						collection(db, "bookings"),
						where("guestId", "==", currentUser.uid)
					)
					const bookingsSnapshot = await getDocs(bookingsQuery)
					const bookings = bookingsSnapshot.docs.map((doc) => doc.data())
					
					totalBookings = bookings.length
					
					// Calculate total spent from all bookings
					totalSpent = bookings.reduce((sum, booking) => {
						return sum + (booking.pricing?.total || 0)
					}, 0)
				} catch (bookingError) {
					console.log("Bookings collection may not exist yet:", bookingError)
				}

				// Fetch reviews to calculate reviews written
				try {
					const reviewsQuery = query(
						collection(db, "reviews"),
						where("reviewerId", "==", currentUser.uid)
					)
					const reviewsSnapshot = await getDocs(reviewsQuery)
					reviewsWritten = reviewsSnapshot.docs.length
				} catch (reviewError) {
					console.log("Reviews collection may not exist yet:", reviewError)
				}

				// Fetch wishlist items from user document
				try {
					const userDocRef = doc(db, "users", currentUser.uid)
					const userDoc = await getDoc(userDocRef)
					if (userDoc.exists()) {
						const userData = userDoc.data()
						const wishes = userData.wishes || []
						wishlistItems = Array.isArray(wishes) ? wishes.length : 0
					}
				} catch (wishlistError) {
					console.log("Error fetching wishlist items:", wishlistError)
				}

				// Update profile data with calculated guest stats
				setProfileData((prev) => ({
					...prev,
					totalBookings,
					reviewsWritten,
					wishlistItems,
					totalSpent,
				}))
			}
		} catch (error) {
			console.error("Error fetching user stats:", error)
		}
	}

	// Fetch user profile data from Firestore
	useEffect(() => {
		const fetchProfileData = async () => {
			if (!currentUser?.uid) {
				setIsLoading(false)
				return
			}

			try {
				const userDocRef = doc(db, "users", currentUser.uid)
				const userDoc = await getDoc(userDocRef)

				if (userDoc.exists()) {
					const data = userDoc.data()
					const fetchedData = {
						phone: data.phone || "",
						location: data.location || "",
						bio: data.bio || "",
						gender: data.gender || "",
						dateOfBirth: data.dateOfBirth || "",
						currency: data.currency || "PHP (₱)",
						notifications:
							data.notifications !== undefined ? data.notifications : true,
						emailUpdates:
							data.emailUpdates !== undefined ? data.emailUpdates : true,
						paypalEmail: data.paypalEmail || "",
						totalBookings: 0, // Will be updated by fetchUserStats
						reviewsWritten: 0, // Will be updated by fetchUserStats
						wishlistItems: 0, // Will be updated by fetchUserStats
						totalSpent: 0, // Will be updated by fetchUserStats
					}
					setProfileData(fetchedData)

					// Parse date of birth for separate dropdowns
					let birthDay = "",
						birthMonth = "",
						birthYear = ""
					if (fetchedData.dateOfBirth) {
						const date = new Date(fetchedData.dateOfBirth)
						birthDay = String(date.getDate())
						birthMonth = String(date.getMonth() + 1)
						birthYear = String(date.getFullYear())
					}

					setEditData({
						phone: fetchedData.phone,
						location: fetchedData.location,
						bio: fetchedData.bio,
						gender: fetchedData.gender,
						dateOfBirth: fetchedData.dateOfBirth,
						birthDay,
						birthMonth,
						birthYear,
					})
					setPaypalConnected(!!data.paypalEmail)
					setPaypalEmail(data.paypalEmail || "")
					setProfilePhotoUrl(data.photoURL || currentUser?.photoURL || "")

					// Fetch user stats after profile data is loaded
					await fetchUserStats()
				}
			} catch (error) {
				console.error("Error fetching profile data:", error)
				toast.error("Failed to load profile data")
			} finally {
				setIsLoading(false)
			}
		}

		fetchProfileData()
	}, [currentUser])

	const getInitials = (name) => {
		return name
			.split(" ")
			.map((n) => n[0])
			.join("")
			.toUpperCase()
			.slice(0, 2)
	}

	const formatDate = (date) => {
		return new Date(date).toLocaleDateString("en-US", {
			month: "long",
			year: "numeric",
		})
	}

	// Handle edit mode
	const handleEdit = () => {
		// Parse date of birth for separate dropdowns
		let birthDay = "",
			birthMonth = "",
			birthYear = ""
		if (profileData.dateOfBirth) {
			const date = new Date(profileData.dateOfBirth)
			birthDay = String(date.getDate())
			birthMonth = String(date.getMonth() + 1)
			birthYear = String(date.getFullYear())
		}

		setEditData({
			phone: profileData.phone || "+",
			location: profileData.location,
			bio: profileData.bio,
			gender: profileData.gender,
			dateOfBirth: profileData.dateOfBirth,
			birthDay,
			birthMonth,
			birthYear,
		})
		setIsEditing(true)
	}

	// Place marker and reverse geocode using Mapbox
	const placeMarkerAndGetAddress = useCallback(
		async (lngLat, marker) => {
			// Update marker position
			marker.setLngLat([lngLat.lng, lngLat.lat])

			// Reverse geocode to get address using Mapbox Geocoding API
			try {
				const response = await fetch(
					`https://api.mapbox.com/geocoding/v5/mapbox.places/${lngLat.lng},${lngLat.lat}.json?access_token=${MAPBOX_TOKEN}`
				)
				const data = await response.json()

				if (data.features && data.features.length > 0) {
					const address = data.features[0].place_name
					setEditData((prev) => ({
						...prev,
						location: address,
					}))
				} else {
					toast.error("Could not fetch address for this location")
				}
			} catch (error) {
				console.error("Geocoding error:", error)
				toast.error("Failed to fetch address")
			}
		},
		[MAPBOX_TOKEN]
	)

	// Initialize Mapbox map for editing
	const initializeEditMap = useCallback(
		(center) => {
			if (!window.mapboxgl) {
				console.error("Mapbox GL JS not loaded")
				return
			}

			window.mapboxgl.accessToken = MAPBOX_TOKEN

			// Create map
			const map = new window.mapboxgl.Map({
				container: editMapRef.current,
				style: "mapbox://styles/mapbox/streets-v12",
				center: [center.lng, center.lat],
				zoom: 15,
			})

			editMapInstance.current = map

			// Add navigation controls
			map.addControl(new window.mapboxgl.NavigationControl())

			// Create draggable marker
			const marker = new window.mapboxgl.Marker({
				draggable: true,
				color: "#61bf9c",
			})
				.setLngLat([center.lng, center.lat])
				.addTo(map)

			editMarker.current = marker

			// Add geocoder control (search box)
			if (window.MapboxGeocoder) {
				const geocoder = new window.MapboxGeocoder({
					accessToken: MAPBOX_TOKEN,
					mapboxgl: window.mapboxgl,
					marker: false,
					placeholder: "Search for a location...",
				})

				map.addControl(geocoder)

				// Listen for result selection
				geocoder.on("result", (e) => {
					const location = e.result.center
					const address = e.result.place_name

					// Update marker and map
					marker.setLngLat(location)
					map.flyTo({ center: location, zoom: 17 })

					// Update input
					setEditData((prev) => ({
						...prev,
						location: address,
					}))
				})
			}

			// Click on map to place marker
			map.on("click", (e) => {
				placeMarkerAndGetAddress(e.lngLat, marker)
			})

			// Drag marker to new position
			marker.on("dragend", () => {
				const lngLat = marker.getLngLat()
				placeMarkerAndGetAddress(lngLat, marker)
			})
		},
		[placeMarkerAndGetAddress, MAPBOX_TOKEN]
	)

	// Initialize edit mode map
	useEffect(() => {
		if (
			isEditing &&
			window.mapboxgl &&
			editMapRef.current &&
			!editMapInstance.current
		) {
			// Default center (Manila, Philippines)
			let defaultCenter = { lat: 14.5995, lng: 120.9842 }

			// If user has a location, geocode it using Mapbox
			if (editData.location) {
				fetch(
					`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
						editData.location
					)}.json?access_token=${MAPBOX_TOKEN}`
				)
					.then((res) => res.json())
					.then((data) => {
						if (data.features && data.features.length > 0) {
							const [lng, lat] = data.features[0].center
							defaultCenter = { lat, lng }
						}
						initializeEditMap(defaultCenter)
					})
					.catch(() => {
						initializeEditMap(defaultCenter)
					})
			} else {
				initializeEditMap(defaultCenter)
			}
		}
	}, [isEditing, editData.location, initializeEditMap, MAPBOX_TOKEN])

	// Cleanup map instance when editing ends
	useEffect(() => {
		if (!isEditing && editMapInstance.current) {
			editMapInstance.current = null
			editMarker.current = null
		}
	}, [isEditing])

	const handleCancel = () => {
		// Parse date of birth for separate dropdowns
		let birthDay = "",
			birthMonth = "",
			birthYear = ""
		if (profileData.dateOfBirth) {
			const date = new Date(profileData.dateOfBirth)
			birthDay = String(date.getDate())
			birthMonth = String(date.getMonth() + 1)
			birthYear = String(date.getFullYear())
		}

		setEditData({
			phone: profileData.phone,
			location: profileData.location,
			bio: profileData.bio,
			gender: profileData.gender,
			dateOfBirth: profileData.dateOfBirth,
			birthDay,
			birthMonth,
			birthYear,
		})
		setIsEditing(false)
	}

	// Handle phone number input
	const handlePhoneChange = (e) => {
		let value = e.target.value

		// Always ensure it starts with +
		if (!value.startsWith("+")) {
			value = "+" + value.replace(/^\+*/, "")
		}

		// Remove any non-digit characters except the leading +
		const cleaned = "+" + value.slice(1).replace(/\D/g, "")

		// Limit to 13 characters total (+ and 12 digits)
		const limited = cleaned.slice(0, 13)

		setEditData({ ...editData, phone: limited })
	}

	// Save profile data to Firestore
	const handleSave = async () => {
		if (!currentUser?.uid) {
			toast.error("User not authenticated")
			return
		}

		// Validate phone number
		if (editData.phone && editData.phone.length < 3) {
			toast.error("Please enter a valid phone number")
			return
		}

		// Validate required fields
		if (!editData.location.trim()) {
			toast.error("Please enter your location")
			return
		}

		if (!editData.bio.trim()) {
			toast.error("Please enter your bio")
			return
		}

		if (!editData.gender) {
			toast.error("Please select your gender")
			return
		}

		// Validate date of birth fields
		if (!editData.birthDay || !editData.birthMonth || !editData.birthYear) {
			toast.error("Please enter your complete date of birth")
			return
		}

		// Create date string and validate
		const dateString = `${editData.birthYear}-${editData.birthMonth.padStart(
			2,
			"0"
		)}-${editData.birthDay.padStart(2, "0")}`
		const birthDate = new Date(dateString)

		// Validate date is valid
		if (isNaN(birthDate.getTime())) {
			toast.error("Please enter a valid date of birth")
			return
		}

		// Validate age (must be at least 18 years old)
		const today = new Date()
		let age = today.getFullYear() - birthDate.getFullYear()
		const monthDiff = today.getMonth() - birthDate.getMonth()
		if (
			monthDiff < 0 ||
			(monthDiff === 0 && today.getDate() < birthDate.getDate())
		) {
			age--
		}
		if (age < 18) {
			toast.error("You must be at least 18 years old")
			return
		}

		setIsSaving(true)
		try {
			const userDocRef = doc(db, "users", currentUser.uid)

			// Prepare update data
			const updateData = {
				phone: editData.phone === "+" ? "" : editData.phone,
				location: editData.location.trim(),
				bio: editData.bio.trim(),
				gender: editData.gender,
				dateOfBirth: dateString,
				setupComplete: true, // Mark setup as complete
				updatedAt: new Date(),
			}

			await updateDoc(userDocRef, updateData)

			setProfileData({
				...profileData,
				phone: updateData.phone,
				location: updateData.location,
				bio: updateData.bio,
				gender: updateData.gender,
				dateOfBirth: updateData.dateOfBirth,
			})

			setIsEditing(false)
			toast.success("Profile setup completed successfully!")
		} catch (error) {
			console.error("Error updating profile:", error)
			toast.error("Failed to update profile")
		} finally {
			setIsSaving(false)
		}
	}

	// Update preferences
	const handleToggleNotifications = async (field) => {
		if (!currentUser?.uid) return

		try {
			const newValue = !profileData[field]
			const userDocRef = doc(db, "users", currentUser.uid)
			await updateDoc(userDocRef, {
				[field]: newValue,
				updatedAt: new Date(),
			})

			setProfileData({
				...profileData,
				[field]: newValue,
			})

			toast.success("Preference updated!")
		} catch (error) {
			console.error("Error updating preference:", error)
			toast.error("Failed to update preference")
		}
	}

	// Update currency
	const handleCurrencyChange = async (newCurrency) => {
		if (!currentUser?.uid) return

		try {
			const userDocRef = doc(db, "users", currentUser.uid)
			await updateDoc(userDocRef, {
				currency: newCurrency,
				updatedAt: new Date(),
			})

			setProfileData({
				...profileData,
				currency: newCurrency,
			})

			toast.success("Currency updated!")
		} catch (error) {
			console.error("Error updating currency:", error)
			toast.error("Failed to update currency")
		}
	}

	// Open Maps Modal
	const openMapModal = () => {
		if (!profileData.location) {
			toast.error("Please add your location first")
			return
		}
		setShowMapModal(true)
	}

	// Upload profile picture to ImgBB
	const handleProfilePictureUpload = async (e) => {
		const file = e.target.files?.[0]
		if (!file) return

		// Validate file type
		if (!file.type.startsWith("image/")) {
			toast.error("Please select an image file")
			return
		}

		// Validate file size (max 5MB)
		if (file.size > 5 * 1024 * 1024) {
			toast.error("Image size should be less than 5MB")
			return
		}

		setUploadingPhoto(true)

		try {
			// Convert image to base64
			const reader = new FileReader()
			reader.readAsDataURL(file)

			reader.onload = async () => {
				try {
					// Get base64 string without the data:image/...;base64, prefix
					const base64Image = reader.result.split(",")[1]

					// Create form data for ImgBB upload
					const formData = new FormData()
					formData.append("image", base64Image)

					// Upload to ImgBB
					const response = await fetch(
						`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`,
						{
							method: "POST",
							body: formData,
						}
					)

					const data = await response.json()

					if (data.success) {
						const imageUrl = data.data.url

						// Save URL to Firebase
						const userDocRef = doc(db, "users", currentUser.uid)
						await updateDoc(userDocRef, {
							photoURL: imageUrl,
							updatedAt: new Date(),
						})

						setProfilePhotoUrl(imageUrl)
						toast.success("Profile picture updated successfully!")
					} else {
						console.error("ImgBB upload error:", data)
						throw new Error(data.error?.message || "Upload failed")
					}
				} catch (error) {
					console.error("Error uploading profile picture:", error)
					toast.error("Failed to upload profile picture. Please try again.")
				} finally {
					setUploadingPhoto(false)
				}
			}

			reader.onerror = () => {
				console.error("Error reading file")
				toast.error("Failed to read image file")
				setUploadingPhoto(false)
			}
		} catch (error) {
			console.error("Error uploading profile picture:", error)
			toast.error("Failed to upload profile picture")
			setUploadingPhoto(false)
		}
	}

	// Connect PayPal
	const handleConnectPaypal = async () => {
		if (!paypalEmail || !paypalEmail.includes("@")) {
			toast.error("Please enter a valid PayPal email")
			return
		}

		try {
			const userDocRef = doc(db, "users", currentUser.uid)
			await updateDoc(userDocRef, {
				paypalEmail: paypalEmail,
				updatedAt: new Date(),
			})

			setProfileData({
				...profileData,
				paypalEmail: paypalEmail,
			})

			setPaypalConnected(true)
			setShowPaypalModal(false)
			toast.success("PayPal account connected successfully!")
		} catch (error) {
			console.error("Error connecting PayPal:", error)
			toast.error("Failed to connect PayPal account")
		}
	}

	// Disconnect PayPal
	const handleDisconnectPaypal = async () => {
		try {
			const userDocRef = doc(db, "users", currentUser.uid)
			await updateDoc(userDocRef, {
				paypalEmail: "",
				updatedAt: new Date(),
			})

			setProfileData({
				...profileData,
				paypalEmail: "",
			})

			setPaypalConnected(false)
			setPaypalEmail("")
			toast.success("PayPal account disconnected")
		} catch (error) {
			console.error("Error disconnecting PayPal:", error)
			toast.error("Failed to disconnect PayPal account")
		}
	}

	// Handle password reset
	const handlePasswordReset = async () => {
		if (!currentUser) {
			toast.error("You must be logged in to change your password")
			return
		}

		// Validation
		if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
			toast.error("Please fill in all fields")
			return
		}

		if (passwordData.newPassword.length < 6) {
			toast.error("New password must be at least 6 characters long")
			return
		}

		if (passwordData.newPassword !== passwordData.confirmPassword) {
			toast.error("New password and confirm password do not match")
			return
		}

		if (passwordData.currentPassword === passwordData.newPassword) {
			toast.error("New password must be different from current password")
			return
		}

		setIsUpdatingPassword(true)

		try {
			// Re-authenticate user with current password
			const credential = EmailAuthProvider.credential(
				currentUser.email,
				passwordData.currentPassword
			)
			await reauthenticateWithCredential(currentUser, credential)

			// Update password
			await updatePassword(currentUser, passwordData.newPassword)

			// Create notification for password change
			try {
				const { createPasswordChangeNotification } = await import("../utils/notifications")
				await createPasswordChangeNotification(currentUser.uid)
			} catch (notifError) {
				console.error("Error creating password change notification:", notifError)
				// Don't fail the password change if notification fails
			}

			toast.success("Password updated successfully!")
			
			// Reset form and close modal
			setPasswordData({
				currentPassword: "",
				newPassword: "",
				confirmPassword: "",
			})
			setShowPasswordModal(false)
		} catch (error) {
			console.error("Error updating password:", error)
			toast.error(getFirebaseErrorMessage(error))
		} finally {
			setIsUpdatingPassword(false)
		}
	}

	// Initialize Mapbox for view modal
	useEffect(() => {
		if (showMapModal && window.mapboxgl && profileData.location) {
			window.mapboxgl.accessToken = MAPBOX_TOKEN

			// Geocode the location
			fetch(
				`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
					profileData.location
				)}.json?access_token=${MAPBOX_TOKEN}`
			)
				.then((res) => res.json())
				.then((data) => {
					if (data.features && data.features.length > 0) {
						const [lng, lat] = data.features[0].center

						// Initialize Map View
						const map = new window.mapboxgl.Map({
							container: mapRef.current,
							style: "mapbox://styles/mapbox/streets-v12",
							center: [lng, lat],
							zoom: 15,
						})

						// Add navigation controls
						map.addControl(new window.mapboxgl.NavigationControl())

						// Add marker
						new window.mapboxgl.Marker({ color: "#61bf9c" })
							.setLngLat([lng, lat])
							.setPopup(
								new window.mapboxgl.Popup().setHTML(
									`<strong>${profileData.location}</strong>`
								)
							)
							.addTo(map)

						// Initialize Satellite View (instead of Street View)
						const satelliteMap = new window.mapboxgl.Map({
							container: streetViewRef.current,
							style: "mapbox://styles/mapbox/satellite-streets-v12",
							center: [lng, lat],
							zoom: 17,
							pitch: 45,
						})

						// Add navigation controls to satellite view
						satelliteMap.addControl(new window.mapboxgl.NavigationControl())

						// Add marker to satellite view
						new window.mapboxgl.Marker({ color: "#61bf9c" })
							.setLngLat([lng, lat])
							.addTo(satelliteMap)
					} else {
						toast.error("Location not found. Please check your address.")
					}
				})
				.catch((error) => {
					console.error("Geocoding error:", error)
					toast.error("Failed to load map")
				})
		}
	}, [showMapModal, profileData.location, MAPBOX_TOKEN])

	if (isLoading) {
		return (
			<div className="profile-container">
				<div className="loading-container">
					<div className="loading-spinner"></div>
					<p>Loading profile...</p>
				</div>
			</div>
		)
	}

	return (
		<div className="profile-container">
			{/* Incomplete Profile Warning */}
			{isProfileIncomplete && (
				<div className="profile-warning">
					<div className="warning-content">
						<FaExclamationTriangle className="warning-icon" />
						<div className="warning-text">
							<h4>Complete Your Profile</h4>
							<p>
								Please add your phone number, location, and bio to get the most
								out of AuraStays
							</p>
						</div>
						<button
							className="complete-btn"
							onClick={() => setActiveTab("personal")}
						>
							Complete Now
						</button>
					</div>
				</div>
			)}

			{/* Header */}
			<div className="profile-header">
				<h1>My Profile</h1>
			</div>

			<div className="profile-content">
				{/* Profile Card */}
				<div className="profile-card">
					<div className="profile-banner">
						<div className="banner-overlay"></div>
					</div>

					<div className="profile-main">
						<div className="profile-avatar-section">
							<div className="profile-avatar-wrapper">
								{uploadingPhoto ? (
									<div className="profile-avatar uploading">
										<div className="loading-spinner"></div>
									</div>
								) : profilePhotoUrl || currentUser?.photoURL ? (
									<img
										src={profilePhotoUrl || currentUser.photoURL}
										alt={displayName}
										className="profile-avatar"
									/>
								) : (
									<div className="profile-avatar-initials">
										{getInitials(displayName)}
									</div>
								)}
								<input
									type="file"
									id="profile-picture-input"
									accept="image/*"
									style={{ display: "none" }}
									onChange={handleProfilePictureUpload}
									disabled={uploadingPhoto}
								/>
								<button
									className="avatar-edit-btn"
									onClick={() =>
										document.getElementById("profile-picture-input").click()
									}
									disabled={uploadingPhoto}
								>
									{uploadingPhoto ? (
										<span className="loading-spinner-small"></span>
									) : (
										<FaCamera />
									)}
								</button>
							</div>
						</div>

						<div className="profile-info">
							<h2>{displayName}</h2>
							<p className="user-email">{email}</p>
							<div className="user-meta">
								<span className="user-type">
									{userType === "host" ? "🏠 Host" : "✈️ Guest"}
								</span>
								<span className="join-date">
									<FaCalendarAlt />
									Joined {formatDate(joinDate)}
								</span>
								{userData?.termsAccepted && (
									<span className="verified-badge">
										<FaCheckCircle />
										Verified
									</span>
								)}
							</div>
						</div>
					</div>
				</div>

				{/* Tabs */}
				<div className="profile-tabs">
					<button
						className={`tab-button ${activeTab === "personal" ? "active" : ""}`}
						onClick={() => setActiveTab("personal")}
					>
						<FaUser />
						<span>Personal Info</span>
					</button>
					<button
						className={`tab-button ${activeTab === "security" ? "active" : ""}`}
						onClick={() => setActiveTab("security")}
					>
						<FaShieldAlt />
						<span>Security</span>
					</button>
					<button
						className={`tab-button ${
							activeTab === "preferences" ? "active" : ""
						}`}
						onClick={() => setActiveTab("preferences")}
					>
						<FaBell />
						<span>Preferences</span>
					</button>
				</div>

				{/* Tab Content */}
				<div className="tab-content">
					{activeTab === "personal" && (
						<div className="personal-info-section">
							<div className="section-header">
								<h3>Personal Information</h3>
								{!isEditing ? (
									<button className="edit-button" onClick={handleEdit}>
										<FaEdit />
										<span>Edit</span>
									</button>
								) : (
									<div className="edit-actions">
										<button className="cancel-button" onClick={handleCancel}>
											<FaTimes />
											<span>Cancel</span>
										</button>
										<button
											className="save-button"
											onClick={handleSave}
											disabled={isSaving}
										>
											{isSaving ? (
												<>
													<span className="loading-spinner-small"></span>
													<span>Saving...</span>
												</>
											) : (
												<>
													<FaSave />
													<span>Save</span>
												</>
											)}
										</button>
									</div>
								)}
							</div>

							{/* 2x2 Grid for Basic Info */}
							<div className="info-grid-2x2">
								<div className="info-item">
									<div className="info-icon">
										<FaUser />
									</div>
									<div className="info-content">
										<label>Full Name</label>
										<p>{displayName}</p>
									</div>
								</div>

								<div className="info-item">
									<div className="info-icon">
										<FaEnvelope />
									</div>
									<div className="info-content">
										<label>Email Address</label>
										<p>{email}</p>
									</div>
								</div>

								<div className="info-item">
									<div className="info-icon">
										<FaPhone />
									</div>
									<div className="info-content">
										<label>Phone Number</label>
										{isEditing ? (
											<div>
												<input
													type="text"
													className="edit-input"
													value={editData.phone}
													onChange={handlePhoneChange}
													placeholder="+639123456789"
													maxLength={13}
												/>
												<small className="input-hint">
													Format: +[country code][number] (max 13 characters)
												</small>
											</div>
										) : (
											<p className={!profileData.phone ? "empty-field" : ""}>
												{profileData.phone || "Not set"}
											</p>
										)}
									</div>
								</div>

								<div className="info-item">
									<div className="info-icon">
										<FaUser />
									</div>
									<div className="info-content">
										<label>Gender</label>
										{isEditing ? (
											<select
												className="edit-input"
												value={editData.gender}
												onChange={(e) =>
													setEditData({ ...editData, gender: e.target.value })
												}
											>
												<option value="">Select Gender</option>
												<option value="male">Male</option>
												<option value="female">Female</option>
												<option value="other">Other</option>
												<option value="prefer_not_to_say">
													Prefer not to say
												</option>
											</select>
										) : (
											<p className={!profileData.gender ? "empty-field" : ""}>
												{profileData.gender
													? profileData.gender.charAt(0).toUpperCase() +
													  profileData.gender.slice(1).replace(/_/g, " ")
													: "Not set"}
											</p>
										)}
									</div>
								</div>
							</div>

							{/* Rest of the fields */}
							<div className="info-grid">
								<div className="info-item full-width">
									<div className="info-icon">
										<FaCalendarAlt />
									</div>
									<div className="info-content">
										<label>Date of Birth</label>
										{isEditing ? (
											<div>
												<div className="date-dropdowns">
													<select
														className="date-select"
														value={editData.birthMonth}
														onChange={(e) =>
															setEditData({
																...editData,
																birthMonth: e.target.value,
															})
														}
													>
														<option value="">Month</option>
														<option value="1">January</option>
														<option value="2">February</option>
														<option value="3">March</option>
														<option value="4">April</option>
														<option value="5">May</option>
														<option value="6">June</option>
														<option value="7">July</option>
														<option value="8">August</option>
														<option value="9">September</option>
														<option value="10">October</option>
														<option value="11">November</option>
														<option value="12">December</option>
													</select>
													<select
														className="date-select"
														value={editData.birthDay}
														onChange={(e) =>
															setEditData({
																...editData,
																birthDay: e.target.value,
															})
														}
													>
														<option value="">Day</option>
														{Array.from({ length: 31 }, (_, i) => i + 1).map(
															(day) => (
																<option key={day} value={day}>
																	{day}
																</option>
															)
														)}
													</select>
													<select
														className="date-select"
														value={editData.birthYear}
														onChange={(e) =>
															setEditData({
																...editData,
																birthYear: e.target.value,
															})
														}
													>
														<option value="">Year</option>
														{Array.from(
															{ length: 100 },
															(_, i) => new Date().getFullYear() - 18 - i
														).map((year) => (
															<option key={year} value={year}>
																{year}
															</option>
														))}
													</select>
												</div>
												<small className="input-hint">
													You must be at least 18 years old
												</small>
											</div>
										) : (
											<p
												className={
													!profileData.dateOfBirth ? "empty-field" : ""
												}
											>
												{profileData.dateOfBirth
													? new Date(
															profileData.dateOfBirth
													  ).toLocaleDateString("en-US", {
															year: "numeric",
															month: "long",
															day: "numeric",
													  })
													: "Not set"}
											</p>
										)}
									</div>
								</div>

								<div className="info-item full-width location-item">
									<div className="info-icon">
										<FaMapMarkerAlt />
									</div>
									<div className="info-content location-content">
										<label>Location</label>
										{isEditing ? (
											<div className="location-edit-container">
												<div className="edit-map-container">
													<div ref={editMapRef} className="edit-map"></div>
													<div className="map-instructions">
														<p>
															<FaMapMarkedAlt /> Use the search box above the
															map, click anywhere, or drag the marker to set
															your location
														</p>
													</div>
												</div>
												<input
													type="text"
													className="edit-input location-display-input"
													value={editData.location}
													onChange={(e) =>
														setEditData({
															...editData,
															location: e.target.value,
														})
													}
													placeholder="Selected location will appear here"
													readOnly
												/>
											</div>
										) : (
											<div className="location-display">
												<p
													className={!profileData.location ? "empty-field" : ""}
												>
													{profileData.location || "Not set"}
												</p>
												{profileData.location && (
													<button
														className="view-map-btn"
														onClick={openMapModal}
														type="button"
													>
														<FaMapMarkedAlt />
														<span>View on Map</span>
													</button>
												)}
											</div>
										)}
									</div>
								</div>

								<div className="info-item full-width">
									<div className="info-icon">
										<FaUser />
									</div>
									<div className="info-content">
										<label>Bio</label>
										{isEditing ? (
											<textarea
												className="edit-textarea"
												value={editData.bio}
												onChange={(e) =>
													setEditData({ ...editData, bio: e.target.value })
												}
												placeholder="Tell us about yourself..."
												rows="3"
											/>
										) : (
											<p className={!profileData.bio ? "empty-field" : ""}>
												{profileData.bio || "Not set"}
											</p>
										)}
									</div>
								</div>
							</div>

							{/* Stats Section */}
							<div className="profile-stats-section">
								<h3 className="profile-stats-title">
									{userType === "host" ? "Host Stats" : "Account Stats"}
								</h3>
								<div className="profile-stats-grid">
									{userType === "host" ? (
										<>
											<div className="profile-stat-box">
												<div className="profile-stat-icon">🏠</div>
												<div className="profile-stat-content">
													<div className="profile-stat-number">
														{profileData.totalListings || 0}
													</div>
													<div className="profile-stat-label">Total Listings</div>
												</div>
											</div>
											<div className="profile-stat-box">
												<div className="profile-stat-icon">📋</div>
												<div className="profile-stat-content">
													<div className="profile-stat-number">
														{profileData.totalBookings || 0}
													</div>
													<div className="profile-stat-label">Total Bookings</div>
												</div>
											</div>
											<div className="profile-stat-box">
												<div className="profile-stat-icon">⭐</div>
												<div className="profile-stat-content">
													<div className="profile-stat-number">
														{profileData.totalRatings || "0.0"}
													</div>
													<div className="profile-stat-label">Total Ratings</div>
												</div>
											</div>
											<div className="profile-stat-box">
												<div className="profile-stat-icon">💰</div>
												<div className="profile-stat-content">
													<div className="profile-stat-number">
														{profileData.currency === "PHP (₱)"
															? `₱${(profileData.totalEarned || 0).toLocaleString(undefined, {
																	minimumFractionDigits: 2,
																	maximumFractionDigits: 2,
															  })}`
															: profileData.currency === "USD ($)"
															? `$${(profileData.totalEarned || 0).toLocaleString(undefined, {
																	minimumFractionDigits: 2,
																	maximumFractionDigits: 2,
															  })}`
															: profileData.currency === "EUR (€)"
															? `€${(profileData.totalEarned || 0).toLocaleString(undefined, {
																	minimumFractionDigits: 2,
																	maximumFractionDigits: 2,
															  })}`
															: profileData.currency === "GBP (£)"
															? `£${(profileData.totalEarned || 0).toLocaleString(undefined, {
																	minimumFractionDigits: 2,
																	maximumFractionDigits: 2,
															  })}`
															: profileData.currency === "JPY (¥)"
															? `¥${Math.round(profileData.totalEarned || 0).toLocaleString()}`
															: `₱${(profileData.totalEarned || 0).toLocaleString(undefined, {
																	minimumFractionDigits: 2,
																	maximumFractionDigits: 2,
															  })}`}
													</div>
													<div className="profile-stat-label">Total Earned</div>
												</div>
											</div>
										</>
									) : (
										<>
											<div className="profile-stat-box">
												<div className="profile-stat-icon">📋</div>
												<div className="profile-stat-content">
													<div className="profile-stat-number">
														{profileData.totalBookings || 0}
													</div>
													<div className="profile-stat-label">Total Bookings</div>
												</div>
											</div>
											<div className="profile-stat-box">
												<div className="profile-stat-icon">⭐</div>
												<div className="profile-stat-content">
													<div className="profile-stat-number">
														{profileData.reviewsWritten || 0}
													</div>
													<div className="profile-stat-label">Reviews Written</div>
												</div>
											</div>
											<div className="profile-stat-box">
												<div className="profile-stat-icon">❤️</div>
												<div className="profile-stat-content">
													<div className="profile-stat-number">
														{profileData.wishlistItems || 0}
													</div>
													<div className="profile-stat-label">Wishlist Items</div>
												</div>
											</div>
											<div className="profile-stat-box">
												<div className="profile-stat-icon">💰</div>
												<div className="profile-stat-content">
													<div className="profile-stat-number">
														{profileData.currency === "PHP (₱)"
															? `₱${(profileData.totalSpent || 0).toLocaleString(undefined, {
																	minimumFractionDigits: 2,
																	maximumFractionDigits: 2,
															  })}`
															: profileData.currency === "USD ($)"
															? `$${(profileData.totalSpent || 0).toLocaleString(undefined, {
																	minimumFractionDigits: 2,
																	maximumFractionDigits: 2,
															  })}`
															: profileData.currency === "EUR (€)"
															? `€${(profileData.totalSpent || 0).toLocaleString(undefined, {
																	minimumFractionDigits: 2,
																	maximumFractionDigits: 2,
															  })}`
															: profileData.currency === "GBP (£)"
															? `£${(profileData.totalSpent || 0).toLocaleString(undefined, {
																	minimumFractionDigits: 2,
																	maximumFractionDigits: 2,
															  })}`
															: profileData.currency === "JPY (¥)"
															? `¥${Math.round(profileData.totalSpent || 0).toLocaleString()}`
															: `₱${(profileData.totalSpent || 0).toLocaleString(undefined, {
																	minimumFractionDigits: 2,
																	maximumFractionDigits: 2,
															  })}`}
													</div>
													<div className="profile-stat-label">Total Spent</div>
												</div>
											</div>
										</>
									)}
								</div>
							</div>
						</div>
					)}

					{activeTab === "security" && (
						<div className="security-section">
							<div className="section-header">
								<h3>Security Settings</h3>
							</div>

							<div className="security-items">
								<div className="security-item">
									<div className="security-info">
										<div className="security-icon">
											<FaShieldAlt />
										</div>
										<div>
											<h4>Password</h4>
											<p>Last changed 30 days ago</p>
										</div>
									</div>
									<button 
										className="action-btn-small"
										onClick={() => setShowPasswordModal(true)}
									>
										Change
									</button>
								</div>

								<div className="security-item">
									<div className="security-info">
										<div className="security-icon">
											<FaEnvelope />
										</div>
										<div>
											<h4>Email Verification</h4>
											<p className="verified-text">
												<FaCheckCircle /> Verified
											</p>
										</div>
									</div>
								</div>
							</div>
						</div>
					)}

					{activeTab === "preferences" && (
						<div className="preferences-section">
							<div className="section-header">
								<h3>Preferences</h3>
							</div>

							<div className="preference-group">
								<h4>
									<FaCreditCard /> Currency
								</h4>
								<div className="preference-items">
									<div className="preference-item">
										<div className="preference-info">
											<label>Preferred Currency</label>
											<p>{profileData.currency}</p>
										</div>
										<select
											className="currency-select"
											value={profileData.currency}
											onChange={(e) => handleCurrencyChange(e.target.value)}
										>
											<option value="PHP (₱)">PHP (₱)</option>
											<option value="USD ($)">USD ($)</option>
											<option value="EUR (€)">EUR (€)</option>
											<option value="GBP (£)">GBP (£)</option>
											<option value="JPY (¥)">JPY (¥)</option>
										</select>
									</div>
								</div>
							</div>

							<div className="preference-group">
								<h4>
									<FaBell /> Notifications
								</h4>
								<div className="preference-items">
									<div className="preference-item">
										<div className="preference-info">
											<label>Push Notifications</label>
											<p>Get notified about bookings and updates</p>
										</div>
										<label className="toggle-switch">
											<input
												type="checkbox"
												checked={profileData.notifications}
												onChange={() =>
													handleToggleNotifications("notifications")
												}
											/>
											<span className="slider"></span>
										</label>
									</div>
									<div className="preference-item">
										<div className="preference-info">
											<label>Email Updates</label>
											<p>Receive promotional emails and offers</p>
										</div>
										<label className="toggle-switch">
											<input
												type="checkbox"
												checked={profileData.emailUpdates}
												onChange={() =>
													handleToggleNotifications("emailUpdates")
												}
											/>
											<span className="slider"></span>
										</label>
									</div>
								</div>
							</div>

							<div className="preference-group">
								<h4>
									<FaCreditCard /> Payment Methods
								</h4>
								<div className="payment-methods">
									{paypalConnected ? (
										<div className="payment-card connected">
											<div className="payment-card-icon paypal">
												<svg viewBox="0 0 24 24" fill="currentColor">
													<path d="M20.067 8.478c.492.88.556 2.014.3 3.327-.74 3.806-3.276 5.12-6.514 5.12h-.5a.805.805 0 00-.794.68l-.04.22-.63 3.993-.028.14a.678.678 0 01-.67.57H7.639a.48.48 0 01-.475-.556l.014-.06.946-5.998.038-.22a.805.805 0 01.794-.68h.5c2.096 0 3.74-.849 4.206-3.299.18-.942.086-1.726-.36-2.295a2.837 2.837 0 00-.723-.588c.177-.004.357-.006.539-.006h1.908c.747 0 1.453.088 2.086.25.172.044.34.092.503.145.316.102.611.226.887.37z" />
													<path d="M6.24 8.928a.811.811 0 01.8-.69h5.498c.66 0 1.275.073 1.826.214.144.037.284.077.42.12.136.043.268.09.395.14.127.05.25.103.368.159a3.67 3.67 0 01.382.21c.434.27.793.62 1.036 1.03.37.626.493 1.427.344 2.333-.416 2.537-1.745 3.57-3.615 3.903-.214.038-.437.062-.668.074-.231.012-.467.017-.708.017h-.897a.811.811 0 00-.8.69l-.014.076-.63 3.993-.018.096a.678.678 0 01-.67.57H5.826a.48.48 0 01-.475-.557l.014-.059 1.875-11.88z" />
												</svg>
											</div>
											<div className="payment-card-info">
												<h5>PayPal</h5>
												<p>{profileData.paypalEmail}</p>
												<span className="status-badge connected">
													Connected
												</span>
											</div>
											<button
												className="disconnect-btn"
												onClick={handleDisconnectPaypal}
											>
												Disconnect
											</button>
										</div>
									) : (
										<div className="empty-state">
											<div className="paypal-icon-large">
												<svg viewBox="0 0 24 24" fill="currentColor">
													<path d="M20.067 8.478c.492.88.556 2.014.3 3.327-.74 3.806-3.276 5.12-6.514 5.12h-.5a.805.805 0 00-.794.68l-.04.22-.63 3.993-.028.14a.678.678 0 01-.67.57H7.639a.48.48 0 01-.475-.556l.014-.06.946-5.998.038-.22a.805.805 0 01.794-.68h.5c2.096 0 3.74-.849 4.206-3.299.18-.942.086-1.726-.36-2.295a2.837 2.837 0 00-.723-.588c.177-.004.357-.006.539-.006h1.908c.747 0 1.453.088 2.086.25.172.044.34.092.503.145.316.102.611.226.887.37z" />
													<path d="M6.24 8.928a.811.811 0 01.8-.69h5.498c.66 0 1.275.073 1.826.214.144.037.284.077.42.12.136.043.268.09.395.14.127.05.25.103.368.159a3.67 3.67 0 01.382.21c.434.27.793.62 1.036 1.03.37.626.493 1.427.344 2.333-.416 2.537-1.745 3.57-3.615 3.903-.214.038-.437.062-.668.074-.231.012-.467.017-.708.017h-.897a.811.811 0 00-.8.69l-.014.076-.63 3.993-.018.096a.678.678 0 01-.67.57H5.826a.48.48 0 01-.475-.557l.014-.059 1.875-11.88z" />
												</svg>
											</div>
											<p>Connect your PayPal account to receive payments</p>
											<button
												className="add-payment-btn"
												onClick={() => setShowPaypalModal(true)}
											>
												<FaCreditCard />
												Connect PayPal
											</button>
										</div>
									)}
								</div>
							</div>
						</div>
					)}
				</div>
			</div>

			{/* PayPal Modal */}
			{showPaypalModal && (
				<div
					className="map-modal-overlay"
					onClick={() => setShowPaypalModal(false)}
				>
					<div
						className="paypal-modal-content"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="modal-header">
							<h3>
								<FaCreditCard /> Connect PayPal Account
							</h3>
							<button
								className="close-modal-btn"
								onClick={() => setShowPaypalModal(false)}
							>
								<FaTimes />
							</button>
						</div>

						<div className="modal-body">
							<div className="paypal-info">
								<div className="paypal-logo">
									<svg viewBox="0 0 24 24" fill="#003087">
										<path d="M20.067 8.478c.492.88.556 2.014.3 3.327-.74 3.806-3.276 5.12-6.514 5.12h-.5a.805.805 0 00-.794.68l-.04.22-.63 3.993-.028.14a.678.678 0 01-.67.57H7.639a.48.48 0 01-.475-.556l.014-.06.946-5.998.038-.22a.805.805 0 01.794-.68h.5c2.096 0 3.74-.849 4.206-3.299.18-.942.086-1.726-.36-2.295a2.837 2.837 0 00-.723-.588c.177-.004.357-.006.539-.006h1.908c.747 0 1.453.088 2.086.25.172.044.34.092.503.145.316.102.611.226.887.37z" />
										<path d="M6.24 8.928a.811.811 0 01.8-.69h5.498c.66 0 1.275.073 1.826.214.144.037.284.077.42.12.136.043.268.09.395.14.127.05.25.103.368.159a3.67 3.67 0 01.382.21c.434.27.793.62 1.036 1.03.37.626.493 1.427.344 2.333-.416 2.537-1.745 3.57-3.615 3.903-.214.038-.437.062-.668.074-.231.012-.467.017-.708.017h-.897a.811.811 0 00-.8.69l-.014.076-.63 3.993-.018.096a.678.678 0 01-.67.57H5.826a.48.48 0 01-.475-.557l.014-.059 1.875-11.88z" />
									</svg>
								</div>
								<p className="info-text">
									Enter your PayPal email address to connect your account. This
									is a sandbox environment for testing purposes.
								</p>
								<div className="sandbox-notice">
									<FaExclamationTriangle />
									<span>Sandbox Mode - For Testing Only</span>
								</div>
							</div>

							<div className="form-group">
								<label htmlFor="paypal-email">PayPal Email Address</label>
								<input
									id="paypal-email"
									type="email"
									className="edit-input"
									value={paypalEmail}
									onChange={(e) => setPaypalEmail(e.target.value)}
									placeholder="your-email@example.com"
								/>
								<small className="input-hint">
									Use your PayPal sandbox email for testing
								</small>
							</div>

							<div className="modal-actions">
								<button
									className="cancel-button"
									onClick={() => setShowPaypalModal(false)}
								>
									Cancel
								</button>
								<button className="connect-btn" onClick={handleConnectPaypal}>
									Connect PayPal
								</button>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Password Reset Modal */}
			{showPasswordModal && (
				<div
					className="map-modal-overlay"
					onClick={() => setShowPasswordModal(false)}
				>
					<div
						className="paypal-modal-content"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="modal-header">
							<h3>
								<FaShieldAlt /> Change Password
							</h3>
							<button
								className="close-modal-btn"
								onClick={() => setShowPasswordModal(false)}
							>
								<FaTimes />
							</button>
						</div>

						<div className="modal-body">
							<div className="password-info">
								<p className="info-text">
									Enter your current password and choose a new password. Make sure it's at least 6 characters long.
								</p>
							</div>

							<div className="form-group">
								<label htmlFor="current-password">Current Password</label>
								<div className="password-input-container">
									<input
										id="current-password"
										type={showCurrentPassword ? "text" : "password"}
										className="edit-input"
										value={passwordData.currentPassword}
										onChange={(e) =>
											setPasswordData({
												...passwordData,
												currentPassword: e.target.value,
											})
										}
										placeholder="Enter your current password"
									/>
									<img
										src={showCurrentPassword ? viewIcon : hideIcon}
										alt="Toggle password visibility"
										onClick={() => setShowCurrentPassword(!showCurrentPassword)}
										style={{ cursor: "pointer" }}
									/>
								</div>
							</div>

							<div className="form-group">
								<label htmlFor="new-password">New Password</label>
								<div className="password-input-container">
									<input
										id="new-password"
										type={showNewPassword ? "text" : "password"}
										className="edit-input"
										value={passwordData.newPassword}
										onChange={(e) =>
											setPasswordData({
												...passwordData,
												newPassword: e.target.value,
											})
										}
										placeholder="Enter your new password"
									/>
									<img
										src={showNewPassword ? viewIcon : hideIcon}
										alt="Toggle password visibility"
										onClick={() => setShowNewPassword(!showNewPassword)}
										style={{ cursor: "pointer" }}
									/>
								</div>
								<small className="input-hint">
									Password must be at least 6 characters long
								</small>
							</div>

							<div className="form-group">
								<label htmlFor="confirm-password">Confirm New Password</label>
								<div className="password-input-container">
									<input
										id="confirm-password"
										type={showConfirmPassword ? "text" : "password"}
										className="edit-input"
										value={passwordData.confirmPassword}
										onChange={(e) =>
											setPasswordData({
												...passwordData,
												confirmPassword: e.target.value,
											})
										}
										placeholder="Confirm your new password"
									/>
									<img
										src={showConfirmPassword ? viewIcon : hideIcon}
										alt="Toggle password visibility"
										onClick={() => setShowConfirmPassword(!showConfirmPassword)}
										style={{ cursor: "pointer" }}
									/>
								</div>
							</div>

							<div className="modal-actions">
								<button
									className="cancel-button"
									onClick={() => {
										setShowPasswordModal(false)
										setPasswordData({
											currentPassword: "",
											newPassword: "",
											confirmPassword: "",
										})
									}}
									disabled={isUpdatingPassword}
								>
									Cancel
								</button>
								<button
									className="connect-btn"
									onClick={handlePasswordReset}
									disabled={isUpdatingPassword}
								>
									{isUpdatingPassword ? (
										<>
											<span className="loading-spinner-small"></span>
											Updating...
										</>
									) : (
										"Update Password"
									)}
								</button>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Maps Modal */}
			{showMapModal && (
				<div
					className="map-modal-overlay"
					onClick={() => setShowMapModal(false)}
				>
					<div
						className="map-modal-content"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="map-modal-header">
							<h3>
								<FaMapMarkerAlt /> {profileData.location}
							</h3>
							<button
								className="close-modal-btn"
								onClick={() => setShowMapModal(false)}
							>
								<FaTimes />
							</button>
						</div>

						<div className="map-views">
							<div className="map-view">
								<h4>Map View</h4>
								<div ref={mapRef} className="mapbox-map"></div>
							</div>
							<div className="map-view">
								<h4>Satellite View</h4>
								<div ref={streetViewRef} className="mapbox-satellite"></div>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
