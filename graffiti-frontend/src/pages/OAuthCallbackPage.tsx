import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

/**
 * OAuth2 callback handler. Extracts token from URL params after Google redirect
 * and stores it in AuthContext.
 */
export default function OAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      loginWithToken(token).then(() => navigate("/"));
    } else {
      navigate("/login");
    }
  }, [searchParams, loginWithToken, navigate]);

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ textAlign: "center" }}>
        <div className="auth-loading-spinner" />
        <p style={{ marginTop: 16, opacity: 0.7 }}>Completing sign in...</p>
      </div>
    </div>
  );
}
