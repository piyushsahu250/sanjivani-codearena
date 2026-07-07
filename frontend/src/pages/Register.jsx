import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Register() {
  const navigate = useNavigate();

  useEffect(() => {
    alert("Self-registration is disabled. Please contact admin to get your account created.");
    navigate("/login", { replace: true });
  }, [navigate]);

  return null;
}
