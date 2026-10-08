import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ShortcutsProvider } from "./contexts/ShortcutsContext";
import App from "./App";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import OAuthCallbackPage from "./pages/OAuthCallbackPage";
import DashboardPage from "./pages/DashboardPage";
import DesktopAuthEntry from "./pages/DesktopAuthEntry";
import OpenApp from "./pages/OpenApp";
import "./styles.css";

/**
 * Route guard that redirects unauthenticated users to login.
 * Shows a loading state while auth is being validated.
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: "center" }}>
          <div className="auth-loading-spinner" />
          <p style={{ marginTop: 16, opacity: 0.7 }}>Loading...</p>
        </div>
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/**
 * Redirect authenticated users away from auth pages.
 */
function GuestRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRouter() {
  return (
    <Routes>
      {/* Auth pages */}
      <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
      <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
      <Route path="/auth/oauth2/callback" element={<OAuthCallbackPage />} />
      <Route path="/desktop-auth" element={<DesktopAuthEntry />} />
      <Route path="/open-app" element={<OpenApp />} />

      {/* Main Whiteboard (accessible to anyone - fully offline local storage by default) */}
      <Route path="/" element={<App />} />

      {/* Dashboard (requires auth - for cloud room management) */}
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />

      {/* Collaborative room (accessible to anyone - anonymous allowed) */}
      <Route path="/room/:slug" element={<App />} />

      {/* Local offline whiteboard alias */}
      <Route path="/local" element={<App />} />

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ShortcutsProvider>
          <AppRouter />
        </ShortcutsProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
