import PropTypes from "prop-types"
import { useMemo } from "react"

export default function YouTubeBackground({
	videoUrl,
	zIndex = -1,
	overlayOpacity = 0.4,
	scopeToParent = false,
}) {
	// Extract YouTube video ID from various URL formats
	const videoId = useMemo(() => {
		try {
			if (!videoUrl) return ""
			// Handle youtu.be short links
			if (videoUrl.includes("youtu.be/")) {
				const after = videoUrl.split("youtu.be/")[1]
				return after.split(/[?&]/)[0]
			}
			// Handle youtube.com/watch?v=
			const url = new URL(videoUrl)
			const v = url.searchParams.get("v")
			if (v) return v
			// Fallback: last path segment
			const parts = url.pathname.split("/")
			return parts[parts.length - 1] || ""
		} catch {
			return ""
		}
	}, [videoUrl])

	const embedSrc = useMemo(() => {
		if (!videoId) return ""
		// Autoplay background settings
		return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&playsinline=1&loop=1&playlist=${videoId}&modestbranding=1&rel=0`
	}, [videoId])

	if (!embedSrc) return null

	return (
		<div
			style={{
				position: scopeToParent ? "absolute" : "fixed",
				top: 0,
				left: scopeToParent ? "50%" : 0,
				width: scopeToParent ? "100vw" : "100vw",
				height: scopeToParent ? "100%" : "100vh",
				overflow: "hidden",
				zIndex,
				pointerEvents: "none",
				backgroundColor: "#000",
				transform: scopeToParent ? "translateX(-50%)" : "none",
			}}
		>
			<div
				style={{
					position: "absolute",
					top: "50%",
					left: "50%",
					// Scale to cover container or viewport
					width: "100%",
					height: "56.25vw", // 16:9
					minHeight: "100%",
					minWidth: "177.78vh", // 16/9
					transform: "translate(-50%, -50%)",
				}}
			>
				<iframe
					title="Background Video"
					src={embedSrc}
					allow="autoplay; fullscreen; picture-in-picture"
					allowFullScreen={false}
					style={{
						position: "absolute",
						top: 0,
						left: 0,
						width: "100%",
						height: "100%",
						border: "0",
					}}
				/>
			</div>
			{/* Dark overlay filter */}
			<div
				style={{
					position: "absolute",
					inset: 0,
					background:
						"linear-gradient(rgba(0,0,0," +
						overlayOpacity +
						"), rgba(0,0,0," +
						overlayOpacity +
						"))",
				}}
			/>
		</div>
	)
}

YouTubeBackground.propTypes = {
	videoUrl: PropTypes.string.isRequired,
	zIndex: PropTypes.number,
	overlayOpacity: PropTypes.number,
	scopeToParent: PropTypes.bool,
}
