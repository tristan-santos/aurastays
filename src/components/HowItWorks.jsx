import React from "react"
import { motion } from "framer-motion"
import { FaSearch, FaHeart, FaBolt } from "react-icons/fa"
import "../css/HowItWorks.css"

const steps = [
	{
		icon: <FaSearch />,
		title: "Search & Discover",
		description:
			"Browse through thousands of unique properties worldwide. Filter by location, price, amenities, and more.",
	},
	{
		icon: <FaHeart />,
		title: "Save Favorites",
		description:
			"Create wish lists and save properties you love. Compare options and find the perfect match for your trip.",
	},
	{
		icon: <FaBolt />,
		title: "Book Instantly",
		description:
			"Secure your stay with our simple booking process. Instant confirmation and 24/7 customer support.",
	},
]

const containerVariants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: { staggerChildren: 0.2, delayChildren: 0.2 },
	},
}

const itemVariants = {
	hidden: { opacity: 0, y: 30 },
	visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
}

export default function HowItWorks() {
	return (
		<section className="how-it-works">
			<h2>How It Works</h2>
			<p className="subtitle">
				Your journey to the perfect stay in three simple steps
			</p>
			<motion.div
				className="steps-container"
				variants={containerVariants}
				initial="hidden"
				whileInView="visible"
				viewport={{ once: true, amount: 0.3 }}
			>
				{steps.map((step, index) => (
					<motion.div key={index} className="step-card" variants={itemVariants}>
						<div className="step-icon">{step.icon}</div>
						<h3>{step.title}</h3>
						<p>{step.description}</p>
					</motion.div>
				))}
			</motion.div>
		</section>
	)
}
