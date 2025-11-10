import Navbar from "../components/Navbar"
import Hero from "../components/Hero"
import ImageGrid from "../components/ImageGrid"
import YouTubeBackground from "../components/YouTubeBackground"
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
					<main className="main-content" style={{ position: "relative" }}>
						<YouTubeBackground
							videoUrl={"https://youtu.be/7_29vB7_lBs?si=fBEA0q_UnFhtrknX"}
							zIndex={1}
							overlayOpacity={0.75}
							scopeToParent={true}
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
