import "./App.css"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { ToastContainer } from "react-toastify"
import "react-toastify/dist/ReactToastify.css"
import NotFound from "./pages/404"
import Landing from "./pages/Landing"
import Signup from "./pages/signup"
import VerifyEmail from "./pages/VerifyEmail"
import Login from "./pages/Login"
import DashboardHost from "./pages/dashboardHost"

function App() {
	return (
		<>
			<BrowserRouter>
				<Routes>
					<Route path="/" element={<Landing />} />
					<Route path="/dashboardHost" element={<DashboardHost />} />
					<Route path="/login" element={<Login />} />
					<Route path="/signup" element={<Signup />} />
					<Route path="/verify-email" element={<VerifyEmail />} />
					<Route path="*" element={<NotFound />} />
				</Routes>
			</BrowserRouter>
			<ToastContainer
				position="top-right"
				autoClose={5000}
				hideProgressBar={true}
				newestOnTop={true}
				closeOnClick
				rtl={false}
				pauseOnFocusLoss
				draggable
				pauseOnHover
				theme="colored	"
			/>
		</>
	)
}

export default App
