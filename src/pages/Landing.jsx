import Navbar from "../components/Navbar"
import Hero from "../components/Hero"
import ImageGrid from "../components/ImageGrid"
import FeaturedProperties from "../components/FeaturedProperties"
import HowItWorks from "../components/HowItWorks"
import Stats from "../components/Stats"
import Footer from "../components/Footer"
import BackToTopButton from "../components/BackToTopButton"
import "../css/Landing.css"

export default function Landing() {
	return (
		<div className="landing-page">
			<div className="finisher-header">
				<Navbar />
				<main className="main-content">
					<Hero />
					<ImageGrid />
				</main>
				<FeaturedProperties />
				<HowItWorks />
				<BackToTopButton />
				<Stats />
				<Footer />
			</div>
		</div>
	)
}
