import "../css/Navbar.css"
import logo from "../assets/logoPlain.png"
import { Link } from "react-router-dom"

export default function Navbar() {
	return (
		<nav className="navbar-landing">
			<div className="navbar-brand flex-row p-4 ">
				<img src={logo} className="img logo" />
				<h1 className="text-[1rem] font-bold">AuraStays</h1>
			</div>
			<div className="nav-links">
				<button className="pt-3 pb-3 pl-5 pr-5 bg-(--secondary) font-[650] rounded-xl">
					Login
				</button>
			</div>
		</nav>
	)
}
