import Navbar from "../components/Navbar"
import Hero from "../components/Hero"
import ImageGrid from "../components/ImageGrid"
import Squares from "../components/Squares"
import FeaturedProperties from "../components/FeaturedProperties"
import HowItWorks from "../components/HowItWorks"
import Stats from "../components/Stats"
import Footer from "../components/Footer"
import BackToTopButton from "../components/BackToTopButton"
import "../css/Landing.css"

export default function Landing() {
	return (
		<>
			<div className="landing-page">
				<div className="finisher-header">
					<Navbar />
					<main className="main-content">
						<Squares
							speed={0.5}
							squareSize={40}
							direction="diagonal"
							borderColor="#333"
							hoverFillColor="rgba(65, 95, 148, 0.5)"
						/>
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
		</>
	)
}
