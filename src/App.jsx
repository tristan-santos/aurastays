import "./App.css"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import NotFound from "./pages/404"

function App() {
	return (
		<>
			<BrowserRouter>
				<Routes>
					<Route path="/" element={<Landing />} />
					<Route path="/BecomeHost" element={<BecomeHost />} />
					<Route path="/dashboardHost" element={<DashboardHost />} />
					<Route path="/setup" element={<Setup />} />
					<Route path="/login" element={<Login />} />
					<Route path="/signup" element={<Signup />} />
					<Route path="*" element={<NotFound />} />
				</Routes>
			</BrowserRouter>
		</>
	)
}

export default App
