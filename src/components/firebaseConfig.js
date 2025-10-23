// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app"
import { getFirestore } from "firebase/firestore"
import { getAuth } from "firebase/auth"
// import { getAnalytics } from "firebase/analytics"
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
	apiKey: "AIzaSyCsQXo_3k_qAqLscrKE2chuMJKZyO8B6ug",
	authDomain: "aurastays-777fc.firebaseapp.com",
	projectId: "aurastays-777fc",
	storageBucket: "aurastays-777fc.firebasestorage.app",
	messagingSenderId: "744773626453",
	appId: "1:744773626453:web:1e9e25ed8a5a48ebebc2dc",
	measurementId: "G-CPL8WHQR1C",
}
// Initialize Firebase
const app = initializeApp(firebaseConfig)

console.log(`app ${app}`)
// const analytics = getAnalytics(app)
export const db = getFirestore(app)
export const auth = getAuth(app)
