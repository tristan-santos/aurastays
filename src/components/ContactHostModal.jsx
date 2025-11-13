import { useState } from "react"
import { useAuth } from "../contexts/AuthContext"
import { db } from "./firebaseConfig"
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, getDoc } from "firebase/firestore"
import { toast } from "react-stacked-toast"
import { FaTimes } from "react-icons/fa"
import "../css/ContactHostModal.css"
import { getFirebaseErrorMessage } from "../utils/errorMessages"

export default function ContactHostModal({ isOpen, onClose, property, hostId }) {
	const { currentUser, userData } = useAuth()
	const [subject, setSubject] = useState("")
	const [body, setBody] = useState("")
	const [isSending, setIsSending] = useState(false)

	const handleSubmit = async (e) => {
		e.preventDefault()
		
		if (!currentUser) {
			toast.error("Please login to contact the host")
			onClose()
			return
		}

		if (!subject.trim()) {
			toast.error("Please enter a subject")
			return
		}

		if (!body.trim()) {
			toast.error("Please enter a message")
			return
		}

		if (!hostId) {
			toast.error("Host information not available")
			return
		}

		setIsSending(true)

		try {
			// Get guest and host user data
			const guestName = userData?.displayName || currentUser?.displayName || "Guest"
			const guestEmail = userData?.email || currentUser?.email || ""
			
			// Get host user data
			const hostDoc = await getDoc(doc(db, "users", hostId))
			const hostData = hostDoc.exists() ? hostDoc.data() : null
			const hostName = hostData?.displayName || property?.host?.hostName || "Host"
			const hostEmail = hostData?.email || ""

			// Create or find conversation
			// Check if conversation already exists
			const conversationsQuery = query(
				collection(db, "conversations"),
				where("guestId", "==", currentUser.uid),
				where("hostId", "==", hostId),
				where("propertyId", "==", property?.id || "")
			)
			const conversationsSnapshot = await getDocs(conversationsQuery)
			
			let conversationId
			if (!conversationsSnapshot.empty) {
				// Use existing conversation
				conversationId = conversationsSnapshot.docs[0].id
			} else {
				// Create new conversation
				const conversationData = {
					guestId: currentUser.uid,
					guestName,
					guestEmail,
					hostId,
					hostName,
					hostEmail,
					propertyId: property?.id || "",
					propertyTitle: property?.title || "",
					lastMessage: body.substring(0, 100),
					lastMessageAt: serverTimestamp(),
					createdAt: serverTimestamp(),
					guestUnreadCount: 0,
					hostUnreadCount: 1, // Host has new message
				}
				const conversationRef = await addDoc(collection(db, "conversations"), conversationData)
				conversationId = conversationRef.id
			}

			// Add message to messages subcollection
			const messageData = {
				conversationId,
				senderId: currentUser.uid,
				senderName: guestName,
				senderType: "guest",
				recipientId: hostId,
				recipientName: hostName,
				recipientType: "host",
				subject: subject.trim(),
				body: body.trim(),
				propertyId: property?.id || "",
				propertyTitle: property?.title || "",
				read: false,
				createdAt: serverTimestamp(),
			}

			await addDoc(collection(db, "messages"), messageData)

			// Update conversation last message
			const { updateDoc } = await import("firebase/firestore")
			await updateDoc(doc(db, "conversations", conversationId), {
				lastMessage: body.substring(0, 100),
				lastMessageAt: serverTimestamp(),
				hostUnreadCount: (await getDoc(doc(db, "conversations", conversationId))).data()?.hostUnreadCount || 0 + 1,
			})

			toast.success("Message sent successfully!")
			setSubject("")
			setBody("")
			onClose()
		} catch (error) {
			console.error("Error sending message:", error)
			toast.error(getFirebaseErrorMessage(error))
		} finally {
			setIsSending(false)
		}
	}

	if (!isOpen) return null

	return (
		<div className="contact-host-modal-overlay" onClick={onClose}>
			<div className="contact-host-modal-content" onClick={(e) => e.stopPropagation()}>
				<div className="contact-host-modal-header">
					<h2>Contact Host</h2>
					<button className="contact-host-modal-close" onClick={onClose}>
						<FaTimes />
					</button>
				</div>

				<form onSubmit={handleSubmit} className="contact-host-form-content">
					<div className="form-group">
						<label htmlFor="subject">Subject</label>
						<input
							type="text"
							id="subject"
							value={subject}
							onChange={(e) => setSubject(e.target.value)}
							placeholder="Enter message subject"
							disabled={isSending}
							required
						/>
					</div>

					<div className="form-group">
						<label htmlFor="body">Message</label>
						<textarea
							id="body"
							value={body}
							onChange={(e) => setBody(e.target.value)}
							placeholder="Enter your message to the host..."
							rows={6}
							disabled={isSending}
							required
						/>
					</div>

					<div className="contact-host-modal-actions">
						<button
							type="button"
							className="btn-cancel"
							onClick={onClose}
							disabled={isSending}
						>
							Cancel
						</button>
						<button
							type="submit"
							className="btn-send"
							disabled={isSending}
						>
							{isSending ? "Sending..." : "Send Message"}
						</button>
					</div>
				</form>
			</div>
		</div>
	)
}

