import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import StudentDashboard from "./pages/StudentDashboard";
import TestTaking from "./pages/TestTaking";
import AdminDashboard from "./pages/AdminDashboard";
import CreateQuestion from "./pages/CreateQuestion";
import CreateTest from "./pages/CreateTest";
import TestResults from "./pages/TestResults";

function Protected({ roles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function Home() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "STUDENT" ? "/dashboard" : "/admin"} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/dashboard" element={<Protected roles={["STUDENT"]}><StudentDashboard /></Protected>} />
          <Route path="/test/:id" element={<Protected roles={["STUDENT"]}><TestTaking /></Protected>} />

          <Route path="/admin" element={<Protected roles={["ADMIN", "FACULTY"]}><AdminDashboard /></Protected>} />
          <Route path="/admin/questions/new" element={<Protected roles={["ADMIN", "FACULTY"]}><CreateQuestion /></Protected>} />
          <Route path="/admin/tests/new" element={<Protected roles={["ADMIN", "FACULTY"]}><CreateTest /></Protected>} />
          <Route path="/admin/tests/:id/results" element={<Protected roles={["ADMIN", "FACULTY"]}><TestResults /></Protected>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
