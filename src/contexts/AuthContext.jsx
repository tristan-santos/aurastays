import { createContext, useContext, useEffect, useState } from "react"
import { auth, db } from "../components/firebaseConfig"
import { onAuthStateChanged } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import { toast } from "react-stacked-toast"
import { getFirebaseErrorMessage } from "../utils/errorMessages"

const AuthContext = createContext()

export const useAuth = () => {
	const context = useContext(AuthContext)
	if (!context) {
		throw new Error("useAuth must be used within an AuthProvider")
	}
	return context
}

export const AuthProvider = ({ children }) => {
	const [currentUser, setCurrentUser] = useState(null)
	const [userData, setUserData] = useState(null)
	const [loading, setLoading] = useState(true)
	const [isAuthenticated, setIsAuthenticated] = useState(false)
	const [isLoggingOut, setIsLoggingOut] = useState(false)

	useEffect(() => {
		const unsubscribe = onAuthStateChanged(auth, async (user) => {
			// Skip processing if we're in the middle of logging out
			if (isLoggingOut) {
				return
			}

			if (user) {
				try {
					// First, check if user is verified (in users collection)
					const userDoc = await getDoc(doc(db, "users", user.uid))
					if (userDoc.exists()) {
						const userData = userDoc.data()
						setUserData(userData)
						setCurrentUser(user)
						setIsAuthenticated(true)
					} else {
						// If not in users, check if they're in pendingUsers (signup in progress)
						const pendingUserDoc = await getDoc(
							doc(db, "pendingUsers", user.uid)
						)
						if (pendingUserDoc.exists()) {
							// User is in signup/verification process, allow them to stay signed in
							console.log("✅ User found in pendingUsers - signup in progress")
							setCurrentUser(user)
							setUserData(null) // No user data yet until verified
							setIsAuthenticated(false) // Not fully authenticated until verified
						} else {
							// User exists in auth but not in Firestore at all
							// Only show error and sign out if not already logging out
							console.log("⚠️ User not found in Firestore")
							await auth.signOut()
							setCurrentUser(null)
							setUserData(null)
							setIsAuthenticated(false)
						}
					}
				} catch (error) {
					console.error("Error fetching user data:", error)
					// Only handle error if not logging out
					if (!isLoggingOut) {
						await auth.signOut()
						setCurrentUser(null)
						setUserData(null)
						setIsAuthenticated(false)
						toast.error(getFirebaseErrorMessage(error))
					}
				}
			} else {
				// User is logged out
				setCurrentUser(null)
				setUserData(null)
				setIsAuthenticated(false)
			}
			setLoading(false)
		})

		return unsubscribe
	}, [isLoggingOut])

	const logout = async () => {
		setIsLoggingOut(true)
		try {
			await auth.signOut()
			setCurrentUser(null)
			setUserData(null)
			setIsAuthenticated(false)
		} catch (error) {
			console.error("Error logging out:", error)
			throw error
		} finally {
			setIsLoggingOut(false)
		}
	}

	const value = {
		currentUser,
		userData,
		isAuthenticated,
		loading,
		setUserData,
		logout,
	}

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
