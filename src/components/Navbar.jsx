import "../css/Navbar.css"
import logo from "../assets/logoPlain.png"

export default function Navbar() {
	return (
		<nav className="navbar-landing">
			<div className="navbar-brand flex-row p-4 ">
				<img src={logo} className="img logo" />
				<h1 className="text-[1.58rem] font-bold">AuraStays</h1>
			</div>
		</nav>
	)
}
