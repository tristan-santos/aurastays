import { useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import Typed from "typed.js"
import "../css/Hero.css"

export default function Hero() {
	const navigate = useNavigate()
	const el = useRef(null)

	useEffect(() => {
		const typed = new Typed(el.current, {
			strings: [
				"Elevated Escapes, Effortless Booking!!",
				"Find Your Place. Find Your Aura..",
				"Discover Unique Stays.",
			],
			typeSpeed: 100,
			backSpeed: 100,
			loop: true,
		})

		return () => {
			typed.destroy()
		}
	}, [])

	return (
		<section className="hero">
			<div className="hero-content">
				<h1 className="font-[700]">
					<span ref={el} />
				</h1>
				<p className="font-[450]">
					The curated platform for sustainable and serene stays. Effortless
					booking for experiences that refresh the mind and body
				</p>
				<div className="hero-buttons">
					<button
						className="btn-primary"
						onClick={() => {
							navigate("/login")
						}}
					>
						Explore More
					</button>
					<button className="btn-secondary" onClick={() => navigate("/signup")}>
						Become a Host
					</button>
				</div>
			</div>
		</section>
	)
}
