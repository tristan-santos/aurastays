import React, { useEffect, useState } from "react"
import { motion, useInView, useAnimate } from "framer-motion"
import { collection, getDocs } from "firebase/firestore"
import { db } from "./firebaseConfig" // Assuming firebaseConfig.js is in the same directory
import "../css/Stats.css"

function Counter({ from, to, suffix }) {
	const [scope, animate] = useAnimate()
	const isInView = useInView(scope, { once: true, amount: 0.5 })

	useEffect(() => {
		if (isInView) {
			animate(from, to, {
				duration: 2,
				ease: "easeOut",
				onUpdate: (latest) => {
					scope.current.textContent =
						to % 1 !== 0 ? latest.toFixed(1) : latest.toFixed(0)
				},
			})
		}
	}, [isInView, from, to, animate, scope])

	return (
		<span className="stat-value">
			<span ref={scope}>{from}</span>
			{suffix}
		</span>
	)
}

const containerVariants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: {
			staggerChildren: 0.2,
		},
	},
}

const itemVariants = {
	hidden: { opacity: 0, y: 20 },
	visible: { opacity: 1, y: 0 },
}

export default function Stats() {
	const [stats, setStats] = useState([
		{ value: 0, suffix: "", label: "Happy Guests" }, // Initial value
		{ value: 0, suffix: "", label: "Properties Listed" }, // Initial value
		{ value: 195, suffix: "", label: "Countries" },
		{ value: 0, suffix: "", label: "Average Rating" }, // Initial value
	])

	useEffect(() => {
		const fetchStats = async () => {
			try {
				const propertiesCollection = collection(db, "properties")
				const propertiesSnapshot = await getDocs(propertiesCollection)
				const propertiesCount = propertiesSnapshot.size

				const usersCollection = collection(db, "users")
				const usersSnapshot = await getDocs(usersCollection)
				const usersCount = usersSnapshot.size

				let totalRating = 0
				propertiesSnapshot.forEach((doc) => {
					totalRating += doc.data().rating // Assuming 'rating' field exists
				})

				const averageRating =
					propertiesCount > 0 ? totalRating / propertiesCount : 0

				let propertiesCountValue = propertiesCount
				let propertiesCountSuffix = ""

				if (propertiesCount >= 1000) {
					propertiesCountValue = propertiesCount / 1000
					propertiesCountSuffix = "K+"
				}

				let happyGuestsValue = usersCount
				let happyGuestsSuffix = ""

				if (usersCount >= 1000000) {
					happyGuestsValue = usersCount / 1000000
					happyGuestsSuffix = "M+"
				} else if (usersCount >= 1000) {
					happyGuestsValue = usersCount / 1000
					happyGuestsSuffix = "K+"
				}

				setStats([
					{
						value: happyGuestsValue,
						suffix: happyGuestsSuffix,
						label: "Happy Guests",
					},
					{
						value: propertiesCountValue,
						suffix: propertiesCountSuffix,
						label: "Properties Listed",
					},
					{ value: 195, suffix: "", label: "Countries" },
					{ value: averageRating, suffix: "", label: "Average Rating" },
				])
			} catch (error) {
				console.error("Error fetching stats: ", error)
			}
		}

		fetchStats()
	}, [])

	return (
		<section className="stats-section">
			<div className="stats-header">
				<h2>Trusted Worldwide</h2>
				<p>
					Join millions of travelers who have found their perfect stay with
					AuraStays
				</p>
			</div>
			<div className="stats-container">
				<motion.div
					className="stats-container"
					variants={containerVariants}
					initial="hidden"
					whileInView="visible"
					viewport={{ once: true, amount: 0.5 }}
				>
					{stats.map((stat, index) => (
						<div key={index} className="stat-item">
							<motion.div
								key={index}
								className="stat-item"
								variants={itemVariants}
							>
								<Counter from={0} to={stat.value} suffix={stat.suffix} />
								<p className="stat-label">{stat.label}</p>
							</motion.div>
						</div>
					))}
				</motion.div>
			</div>
		</section>
	)
}
