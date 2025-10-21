import React from "react"
import "../css/ImageGrid.css"

import { motion } from "framer-motion"

const images = [
	{
		src: "https://news.airbnb.com/wp-content/uploads/sites/4/2019/06/PJM020719Q202_Luxe_WanakaNZ_LivingRoom_0264-LightOn_R1.jpg?resize=2400,1260",
		alt: "Image 1",
		className: "card-a",
	},
	{
		src: "https://media.cntraveler.com/photos/5d112d50c4d7bd806dbc00a4/16:9/w_2239,h_1259,c_limit/airbnb%20luxe.jpg",
		alt: "Image 2",
		className: "card-b",
	},
	{
		src: "https://www.nerdwallet.com/assets/blog/wp-content/uploads/2022/02/Airbnb-Stay-Joshua-Tree.jpg",
		alt: "Image 3",
		className: "card-c",
	},
	{
		src: "https://thepolishedjar.com/cdn/shop/articles/airbnb-decor-ideas.jpg",
		alt: "Image 4",
		className: "card-d",
	},
]

const containerVariants = {
	hidden: { opacity: 0 },
	show: {
		opacity: 1,
		transition: {
			staggerChildren: 0.15,
		},
	},
}

const itemVariants = {
	hidden: { opacity: 0, y: 20 },
	show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

export default function ImageGrid() {
	return (
		<motion.section
			className="image-grid"
			variants={containerVariants}
			initial="hidden"
			animate="show"
		>
			{images.map((image, index) => (
				<motion.div
					key={index}
					className={`grid-item ${image.className}`}
					variants={itemVariants}
				>
					<img src={image.src} alt={image.alt} />
				</motion.div>
			))}
		</motion.section>
	)
}
