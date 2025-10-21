// eslint-disable-next-line no-unused-vars
import React, { useEffect, useRef } from "react"
// eslint-disable-next-line no-unused-vars
import { motion, useInView, useAnimate } from "framer-motion"
import "../css/Stats.css"

const stats = [
	{ value: 2, suffix: "M+", label: "Happy Guests" },
	{ value: 50, suffix: "K+", label: "Properties Listed" },
	{ value: 195, suffix: "", label: "Countries" },
	{ value: 4.9, suffix: "", label: "Average Rating" },
]

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
