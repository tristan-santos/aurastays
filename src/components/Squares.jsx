import { useEffect, useRef } from "react"
import PropTypes from "prop-types"

export default function Squares({
	speed = 0.5,
	squareSize = 40,
	direction = "diagonal",
	borderColor = "#fff",
	hoverFillColor = "#222",
}) {
	const canvasRef = useRef(null)

	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return

		const ctx = canvas.getContext("2d")
		let animationFrameId
		let squares = []

		// Set canvas size
		const resizeCanvas = () => {
			canvas.width = window.innerWidth
			canvas.height = window.innerHeight
			initSquares()
		}

		// Initialize squares
		const initSquares = () => {
			squares = []
			const cols = Math.ceil(canvas.width / squareSize)
			const rows = Math.ceil(canvas.height / squareSize)

			for (let i = 0; i < cols; i++) {
				for (let j = 0; j < rows; j++) {
					squares.push({
						x: i * squareSize,
						y: j * squareSize,
						opacity: Math.random() * 0.5,
						targetOpacity: Math.random() * 0.5,
						filled: false,
					})
				}
			}
		}

		// Draw squares
		const drawSquares = () => {
			ctx.clearRect(0, 0, canvas.width, canvas.height)

			squares.forEach((square) => {
				// Smoothly transition opacity
				square.opacity += (square.targetOpacity - square.opacity) * 0.05

				ctx.strokeStyle = borderColor
				ctx.lineWidth = 1
				ctx.globalAlpha = square.opacity

				if (square.filled) {
					ctx.fillStyle = hoverFillColor
					ctx.fillRect(square.x, square.y, squareSize, squareSize)
				}

				ctx.strokeRect(square.x, square.y, squareSize, squareSize)
			})

			ctx.globalAlpha = 1
		}

		// Animation loop
		const animate = () => {
			// Randomly change opacity of squares
			if (Math.random() < 0.01) {
				const randomSquare = squares[Math.floor(Math.random() * squares.length)]
				randomSquare.targetOpacity = Math.random() * 0.5
			}

			// Move squares based on direction
			if (direction !== "none") {
				squares.forEach((square) => {
					switch (direction) {
						case "up":
							square.y -= speed
							if (square.y < -squareSize) square.y = canvas.height
							break
						case "down":
							square.y += speed
							if (square.y > canvas.height) square.y = -squareSize
							break
						case "left":
							square.x -= speed
							if (square.x < -squareSize) square.x = canvas.width
							break
						case "right":
							square.x += speed
							if (square.x > canvas.width) square.x = -squareSize
							break
						case "diagonal":
							square.x += speed * 0.7
							square.y += speed * 0.7
							if (square.x > canvas.width) square.x = -squareSize
							if (square.y > canvas.height) square.y = -squareSize
							break
						default:
							break
					}
				})
			}

			drawSquares()
			animationFrameId = requestAnimationFrame(animate)
		}

		// Mouse hover effect
		const handleMouseMove = (e) => {
			const rect = canvas.getBoundingClientRect()
			const mouseX = e.clientX - rect.left
			const mouseY = e.clientY - rect.top

			squares.forEach((square) => {
				const distance = Math.sqrt(
					Math.pow(mouseX - (square.x + squareSize / 2), 2) +
						Math.pow(mouseY - (square.y + squareSize / 2), 2)
				)

				if (distance < squareSize * 2) {
					square.targetOpacity = 1
					square.filled = true
				} else {
					square.filled = false
				}
			})
		}

		resizeCanvas()
		animate()

		window.addEventListener("resize", resizeCanvas)
		canvas.addEventListener("mousemove", handleMouseMove)

		return () => {
			cancelAnimationFrame(animationFrameId)
			window.removeEventListener("resize", resizeCanvas)
			canvas.removeEventListener("mousemove", handleMouseMove)
		}
	}, [speed, squareSize, direction, borderColor, hoverFillColor])

	return (
		<canvas
			ref={canvasRef}
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				pointerEvents: "auto",
				zIndex: 0,
			}}
		/>
	)
}

Squares.propTypes = {
	speed: PropTypes.number,
	squareSize: PropTypes.number,
	direction: PropTypes.oneOf([
		"up",
		"down",
		"left",
		"right",
		"diagonal",
		"none",
	]),
	borderColor: PropTypes.string,
	hoverFillColor: PropTypes.string,
}
