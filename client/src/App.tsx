import { Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import VerifyEmail from "./pages/VerifyEmail";
import ForgotPassword from "./pages/Forgotpassword";
import ResetPassword from "./pages/Resetpassword";
import Room from "./pages/Room";
import Lesson from "./pages/Lesson";
import AdminPanel from "./pages/AdminPanel.tsx";

export default function App() {

    return (
        <Routes>

            <Route path="/" element={<Login />} />

            <Route path="/register" element={<Register />} />

            <Route path="/verify-email" element={<VerifyEmail />} />

            <Route path="/forgot-password" element={<ForgotPassword />} />

            <Route path="/reset-password" element={<ResetPassword />} />

            <Route path="/room" element={<Room />} />

            <Route path="/lesson" element={<Lesson />} />

            <Route path="/admin" element={<AdminPanel />} />

        </Routes>
    );
}