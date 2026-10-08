import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getGoogleOAuthUrl, apiCompleteDesktopHandoff } from "../lib/api";
import { issueDesktopHandoffCode } from "../lib/desktopAuth";
import { Monitor, ArrowRight, Mail, Lock, User, CheckCircle } from "lucide-react";

export default function DesktopAuthEntry() {
  const { user, isAuthenticated, login, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") || "login";
  const session = searchParams.get("session") || "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [transferring, setTransferring] = useState(false);

  async function handleContinueWithActiveSession() {
    setTransferring(true);
    setError(null);
    try {
      const code = await issueDesktopHandoffCode("Graffiti Desktop App");
      if (session) {
        await apiCompleteDesktopHandoff(session, code).catch(() => {});
      }
      const sessionParam = session ? `&session=${encodeURIComponent(session)}` : "";
      navigate(`/open-app?code=${encodeURIComponent(code)}${sessionParam}`, { replace: true });
    } catch (err: any) {
      setError(err.message || "Failed to generate handoff code");
      setTransferring(false);
    }
  }

  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      const code = await issueDesktopHandoffCode("Graffiti Desktop App");
      if (session) {
        await apiCompleteDesktopHandoff(session, code).catch(() => {});
      }
      const sessionParam = session ? `&session=${encodeURIComponent(session)}` : "";
      navigate(`/open-app?code=${encodeURIComponent(code)}${sessionParam}`, { replace: true });
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 440 }}>
        <div className="auth-logo">
          <Link to="/" title="Graffiti">
            <img src="/graffiti-logo-dark.png" alt="Graffiti" className="auth-logo-img" />
          </Link>
        </div>

        {isAuthenticated && user ? (
          /* Active Session Detected - 1-Click Desktop Connect */
          <div>
            <div style={{
              width: 54,
              height: 54,
              borderRadius: "50%",
              background: "var(--accent-subtle)",
              color: "var(--accent-primary)",
              display: "grid",
              placeItems: "center",
              margin: "0 auto 16px"
            }}>
              <Monitor size={26} />
            </div>

            <h1 className="auth-title">Connect to Desktop</h1>
            <p className="auth-subtitle">
              You are signed in on this browser. Continue to connect your Graffiti desktop app.
            </p>

            {error && <div className="auth-error">{error}</div>}

            {/* Profile preview card */}
            <div style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              borderRadius: 10,
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              margin: "20px 0",
              textAlign: "left"
            }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: "var(--accent-primary)",
                color: "var(--accent-text)",
                display: "grid",
                placeItems: "center",
                fontWeight: 700,
                fontSize: 16,
                flexShrink: 0
              }}>
                {(user.name || user.email || "U")[0].toUpperCase()}
              </div>
              <div style={{ overflow: "hidden", flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                  {user.name || "Graffiti User"}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                  {user.email}
                </div>
              </div>
              <CheckCircle size={18} style={{ color: "var(--color-success)", flexShrink: 0 }} />
            </div>

            <button
              type="button"
              className="auth-submit-btn"
              onClick={handleContinueWithActiveSession}
              disabled={transferring}
              style={{ width: "100%", justifyContent: "center" }}
            >
              <Monitor size={18} />
              <span>{transferring ? "Connecting..." : `Continue as ${user.name || "User"}`}</span>
            </button>

            <button
              type="button"
              onClick={() => logout()}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-muted)",
                fontSize: 12,
                marginTop: 16,
                cursor: "pointer",
                textDecoration: "underline"
              }}
            >
              Sign in with a different account
            </button>
          </div>
        ) : (
          /* Not Signed In - Sign In Form With Desktop Handoff */
          <div>
            <h1 className="auth-title">Sign in for Desktop</h1>
            <p className="auth-subtitle">Log in securely with your browser to connect your Graffiti desktop app.</p>

            {error && <div className="auth-error">{error}</div>}

            <form onSubmit={handleLoginSubmit} className="auth-form">
              <div className="auth-field">
                <Mail size={16} className="auth-field-icon" />
                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="auth-field">
                <Lock size={16} className="auth-field-icon" />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="auth-submit-btn" disabled={loading}>
                {loading ? "Signing in..." : "Sign In & Connect Desktop"}
                {!loading && <ArrowRight size={16} />}
              </button>
            </form>

            <div className="auth-divider">
              <span>or</span>
            </div>

            <a href={getGoogleOAuthUrl(session ? `desktop:${session}` : "desktop")} className="auth-google-btn">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>Continue with Google</span>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
