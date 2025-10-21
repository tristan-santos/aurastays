import "./App.css"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import NotFound from "./pages/404"
import Landing from "./pages/Landing"

function App() {
	return (
		<>
			<BrowserRouter>
				<Routes>
					<Route path="/" element={<Landing />} />
					{/* <Route path="/dashboardHost" element={<DashboardHost />} />
					<Route path="/login" element={<Login />} />
					<Route path="/signup" element={<Signup />} /> */}
					<Route path="*" element={<NotFound />} />
				</Routes>
			</BrowserRouter>
		</>
	)
}

export default App
