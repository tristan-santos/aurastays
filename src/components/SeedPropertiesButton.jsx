import { useState } from "react"
import { db } from "./firebaseConfig"
import { collection, doc, setDoc } from "firebase/firestore"
import { toast } from "react-stacked-toast"
import { sampleProperties } from "../data/sampleProperties"

export default function SeedPropertiesButton() {
	const [isSeeding, setIsSeeding] = useState(false)
	const [progress, setProgress] = useState(0)

	const seedProperties = async () => {
		if (
			!window.confirm(
				`This will add ${sampleProperties.length} properties to Firebase. Continue?`
			)
		) {
			return
		}

		setIsSeeding(true)
		setProgress(0)

		try {
			const propertiesRef = collection(db, "properties")
			let successCount = 0

			for (let i = 0; i < sampleProperties.length; i++) {
				const property = sampleProperties[i]

				try {
					await setDoc(doc(propertiesRef, property.id), property)
					successCount++
					setProgress(Math.round(((i + 1) / sampleProperties.length) * 100))
				} catch (error) {
					console.error(`Error adding property ${property.id}:`, error)
				}
			}

			toast.success(
				`Successfully added ${successCount} out of ${sampleProperties.length} properties!`
			)
			console.log(`✅ Seeded ${successCount} properties to Firebase`)
		} catch (error) {
			console.error("Error seeding properties:", error)
			toast.error("Failed to seed properties. Check console for details.")
		} finally {
			setIsSeeding(false)
			setProgress(0)
		}
	}

	return (
		<div style={{ padding: "20px" }}>
			<button
				onClick={seedProperties}
				disabled={isSeeding}
				style={{
					padding: "12px 24px",
					backgroundColor: isSeeding ? "#6c757d" : "#61bf9c",
					color: "white",
					border: "none",
					borderRadius: "8px",
					fontSize: "16px",
					fontWeight: "600",
					cursor: isSeeding ? "not-allowed" : "pointer",
					boxShadow: "0 4px 12px rgba(97, 191, 156, 0.3)",
					transition: "all 0.3s ease",
				}}
			>
				{isSeeding
					? `Seeding Properties... ${progress}%`
					: `Seed ${sampleProperties.length} Properties to Firebase`}
			</button>

			{isSeeding && (
				<div style={{ marginTop: "20px" }}>
					<div
						style={{
							width: "100%",
							height: "30px",
							backgroundColor: "#e9ecef",
							borderRadius: "15px",
							overflow: "hidden",
						}}
					>
						<div
							style={{
								width: `${progress}%`,
								height: "100%",
								backgroundColor: "#61bf9c",
								transition: "width 0.3s ease",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								color: "white",
								fontWeight: "bold",
							}}
						>
							{progress}%
						</div>
					</div>
				</div>
			)}

			<div style={{ marginTop: "20px", color: "#6c757d" }}>
				<p style={{ fontSize: "14px", margin: "5px 0" }}>
					📦 <strong>Properties to add:</strong>
				</p>
				<ul style={{ fontSize: "14px", marginLeft: "20px" }}>
					<li>12 Homes (Villas, Condos, Cabins, etc.)</li>
					<li>5 Experiences (Island hopping, Cooking class, Treks, etc.)</li>
					<li>3 Services (Photography, Transport, Travel planning)</li>
				</ul>
				<p style={{ fontSize: "12px", fontStyle: "italic", marginTop: "10px" }}>
					Note: Properties will be added to the "properties" collection in
					Firestore
				</p>
			</div>
		</div>
	)
}
