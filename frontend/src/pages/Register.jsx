import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Register() {
  const navigate = useNavigate();

  useEffect(() => {
    alert("User registration is managed by the administrator. Please contact your institute administrator to receive your login credentials.");
    navigate("/login", { replace: true });
  }, [navigate]);

  return null;
}
