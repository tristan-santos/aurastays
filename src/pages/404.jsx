import { useNavigate } from "react-router-dom"
import "../sass/404.scss"
import image404 from "../assets/404 Error-rafiki (2).png"

export default function NotFound() {
	const navigate = useNavigate()
	return (
		<div className="center-box404">
			<div className="error404">
				<img src={image404} />
			</div>
			<div className="error404">
				<h1>404 — Page not found</h1>
				<h2>Something gone wrong!</h2>
				<p>The page you were looking for doesn't exist.</p>
				<button className="primary" onClick={() => navigate("/")}>
					Return home
				</button>
			</div>
		</div>
	)
}
