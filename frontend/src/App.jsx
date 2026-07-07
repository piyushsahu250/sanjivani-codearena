import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import StudentDashboard from "./pages/StudentDashboard";
import TestTaking from "./pages/TestTaking";
import AdminDashboard from "./pages/AdminDashboard";
import StaffDashboard from "./pages/StaffDashboard";
import CreateQuestion from "./pages/CreateQuestion";
import CreateTest from "./pages/CreateTest";
import TestResults from "./pages/TestResults";

const HOME_BY_ROLE = { STUDENT: "/dashboard", STAFF: "/staff", ADMIN: "/admin" };

function Protected({ roles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function Home() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={HOME_BY_ROLE[user.role] || "/login"} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Student */}
          <Route path="/dashboard" element={<Protected roles={["STUDENT"]}><StudentDashboard /></Protected>} />
          <Route path="/test/:id" element={<Protected roles={["STUDENT"]}><TestTaking /></Protected>} />

          {/* Staff (and Admin, who can also manage tests/questions) */}
          <Route path="/staff" element={<Protected roles={["ADMIN", "STAFF"]}><StaffDashboard /></Protected>} />
          <Route path="/staff/questions/new" element={<Protected roles={["ADMIN", "STAFF"]}><CreateQuestion /></Protected>} />
          <Route path="/staff/tests/new" element={<Protected roles={["ADMIN", "STAFF"]}><CreateTest /></Protected>} />
          <Route path="/staff/tests/:id/results" element={<Protected roles={["ADMIN", "STAFF"]}><TestResults /></Protected>} />

          {/* Admin only: account management */}
          <Route path="/admin" element={<Protected roles={["ADMIN"]}><AdminDashboard /></Protected>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
