import "../css/Navbar.css"
import logo from "../assets/logoPlain.png"
import { Link } from "react-router-dom"
import { useEffect, useState, useRef } from "react"

export default function Navbar() {
	const [usePrimaryBrand, setUsePrimaryBrand] = useState(false)
	const navRef = useRef(null)

	useEffect(() => {
		const triggers = [
			".featured-properties",
			".how-it-works",
			".stats-section",
		]
			.map((sel) => document.querySelector(sel))
			.filter(Boolean)
		if (triggers.length === 0) return

		const update = () => {
			const navH = navRef.current?.offsetHeight || 0
			// If any target section top has crossed under the navbar height,
			// switch to primary brand color.
			const crossed = triggers.some((el) => {
				const rect = el.getBoundingClientRect()
				return rect.top <= navH
			})
			setUsePrimaryBrand(crossed)
		}

		update()
		window.addEventListener("scroll", update, { passive: true })
		window.addEventListener("resize", update)
		return () => {
			window.removeEventListener("scroll", update)
			window.removeEventListener("resize", update)
		}
	}, [])

	return (
		<nav
			ref={navRef}
			className={`navbar-landing${usePrimaryBrand ? " scrolled-primary" : ""}`}
		>
			<div className="navbar-brand flex-row p-4 ">
				<img src={logo} className="img logo" />
				<h1 className="text-[1rem] font-bold">AuraStays</h1>
			</div>
			<div className="nav-links">
				<Link to="/login">
					<button className="pt-3 pb-3 pl-5 pr-5 bg-(--secondary) font-[650] rounded-xl">
						Login
					</button>
				</Link>
			</div>
		</nav>
	)
}
