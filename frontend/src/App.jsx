import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import StudentDashboard from "./pages/StudentDashboard";
import StudentTestResult from "./pages/StudentTestResult";

// Lazy-loaded: pulls in @tensorflow/tfjs + blazeface for face detection, which is only
// needed once a student actually opens a test — bundling it eagerly would add that weight
// to every page load for every user (login, admin, staff included).
const TestTaking = lazy(() => import("./pages/TestTaking"));
import AdminDashboard from "./pages/AdminDashboard";
import StaffDashboard from "./pages/StaffDashboard";
import CreateQuestion from "./pages/CreateQuestion";
import QuestionBank from "./pages/QuestionBank";
import CreateTest from "./pages/CreateTest";
import TestResults from "./pages/TestResults";
import TestPreview from "./pages/TestPreview";
import AccountSettings from "./pages/AccountSettings";
import BulkUpload from "./pages/BulkUpload";
import ClassManagement from "./pages/ClassManagement";
import InstituteManagement from "./pages/InstituteManagement";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import ForceChangePassword from "./pages/ForceChangePassword";

const HOME_BY_ROLE = { STUDENT: "/dashboard", STAFF: "/staff", ADMIN: "/admin" };

function Protected({ roles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function Home() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />;
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
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/change-password" element={<ForceChangePassword />} />
          <Route path="/account" element={<Protected><AccountSettings /></Protected>} />

          {/* Student */}
          <Route path="/dashboard" element={<Protected roles={["STUDENT"]}><StudentDashboard /></Protected>} />
          <Route
            path="/test/:id"
            element={
              <Protected roles={["STUDENT"]}>
                <Suspense fallback={<div style={{ padding: 48 }} className="mono">Loading test…</div>}>
                  <TestTaking />
                </Suspense>
              </Protected>
            }
          />
          <Route path="/test/:id/result" element={<Protected roles={["STUDENT"]}><StudentTestResult /></Protected>} />

          {/* Staff (and Admin, who can also manage tests/questions) */}
          <Route path="/staff" element={<Protected roles={["ADMIN", "STAFF"]}><StaffDashboard /></Protected>} />
          <Route path="/staff/questions" element={<Protected roles={["ADMIN", "STAFF"]}><QuestionBank /></Protected>} />
          <Route path="/staff/questions/new" element={<Protected roles={["ADMIN", "STAFF"]}><CreateQuestion /></Protected>} />
          <Route path="/staff/questions/:id/edit" element={<Protected roles={["ADMIN", "STAFF"]}><CreateQuestion /></Protected>} />
          <Route path="/staff/tests/new" element={<Protected roles={["ADMIN", "STAFF"]}><CreateTest /></Protected>} />
          <Route path="/staff/tests/:id/edit" element={<Protected roles={["ADMIN", "STAFF"]}><CreateTest /></Protected>} />
          <Route path="/staff/tests/:id/results" element={<Protected roles={["ADMIN", "STAFF"]}><TestResults /></Protected>} />
          <Route path="/staff/tests/:id/preview" element={<Protected roles={["ADMIN", "STAFF"]}><TestPreview /></Protected>} />

          {/* Admin only: account management */}
          <Route path="/admin" element={<Protected roles={["ADMIN"]}><AdminDashboard /></Protected>} />
          <Route path="/admin/bulk-upload" element={<Protected roles={["ADMIN"]}><BulkUpload /></Protected>} />
          <Route path="/admin/classes" element={<Protected roles={["ADMIN"]}><ClassManagement /></Protected>} />
          <Route path="/admin/institutes" element={<Protected roles={["ADMIN"]}><InstituteManagement /></Protected>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
