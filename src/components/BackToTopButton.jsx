import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { FaArrowUp } from "react-icons/fa"
import "../css/BackToTopButton.css"

export default function BackToTopButton() {
	const [isVisible, setIsVisible] = useState(false)

	const toggleVisibility = () => {
		if (window.scrollY > 300) {
			setIsVisible(true)
		} else {
			setIsVisible(false)
		}
	}

	const scrollToTop = () => {
		window.scrollTo({
			top: 0,
			behavior: "smooth",
		})
	}

	useEffect(() => {
		window.addEventListener("scroll", toggleVisibility)
		return () => {
			window.removeEventListener("scroll", toggleVisibility)
		}
	}, [])

	return (
		<AnimatePresence>
			{isVisible && (
				<motion.button
					className="back-to-top-button"
					onClick={scrollToTop}
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: 20 }}
					transition={{ duration: 0.3 }}
				>
					<FaArrowUp />
				</motion.button>
			)}
		</AnimatePresence>
	)
}
