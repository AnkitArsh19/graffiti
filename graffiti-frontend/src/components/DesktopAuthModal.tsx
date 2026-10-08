import React, { useState, useEffect, useId } from "react";
import {
  Monitor,
  X,
  ExternalLink,
  Copy,
  CheckCircle,
  KeyRound,
  ArrowLeft,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import {
  startBrowserLogin,
  getBrowserBaseUrl,
  exchangeDesktopHandoffCode,
} from "../lib/desktopAuth";
import { apiPollDesktopSession } from "../lib/api";

interface DesktopAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DesktopAuthModal({ isOpen, onClose }: DesktopAuthModalProps) {
  const [manualMode, setManualMode] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [browserLaunched, setBrowserLaunched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate a unique session token for this modal lifecycle
  const [sessionId] = useState(() => {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return "sess_" + Math.random().toString(36).substring(2, 15);
  });

  // Automatically poll for session completion when modal is open
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    const interval = setInterval(async () => {
      if (cancelled) return;
      try {
        const res = await apiPollDesktopSession(sessionId);
        if (res?.status === "READY" && res?.code && !cancelled) {
          cancelled = true;
          clearInterval(interval);
          setLoading(true);
          await exchangeDesktopHandoffCode(res.code);
          onClose();
        }
      } catch {
        // Silently continue polling
      }
    }, 1500);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isOpen, sessionId, onClose]);

  if (!isOpen) return null;

  const browserUrl = `${getBrowserBaseUrl()}/desktop-auth?mode=login&session=${encodeURIComponent(sessionId)}`;

  async function handleLaunchBrowser() {
    setError(null);
    try {
      setBrowserLaunched(true);
      await startBrowserLogin("login", sessionId);
    } catch (err: any) {
      setError(err.message || "Failed to open browser");
      setBrowserLaunched(false);
    }
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(browserUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  }

  async function handleExchangeCode(e: React.FormEvent) {
    e.preventDefault();
    if (!manualCode.trim()) return;
    setError(null);
    setLoading(true);
    try {
      await exchangeDesktopHandoffCode(manualCode);
      onClose();
    } catch (err: any) {
      setError(err.message || "Invalid or expired 60s sign-in code.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="modal-overlay"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="modal-content"
        style={{
          width: "100%",
          maxWidth: 440,
          background: "var(--bg-panel, #121214)",
          border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))",
          borderRadius: 14,
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.6)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "var(--accent-subtle)",
                display: "grid",
                placeItems: "center",
                color: "var(--accent-primary)",
              }}
            >
              <Monitor size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
                Sign In to Graffiti Desktop
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
                Secure browser authentication
              </p>
            </div>
          </div>
          <button
            type="button"
            className="icon-action-btn"
            onClick={onClose}
            aria-label="Close"
            style={{ cursor: "pointer", background: "transparent", border: "none", color: "inherit" }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "20px" }}>
          {error && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 14px",
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.25)",
                borderRadius: 8,
                color: "var(--color-danger)",
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {!manualMode ? (
            <div>
              <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
                Log in securely in your default browser. Once signed in, Graffiti Desktop will connect automatically.
              </p>

              {browserLaunched && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 14px",
                    background: "var(--accent-subtle)",
                    border: "1px solid var(--accent-ring)",
                    borderRadius: 10,
                    marginBottom: 16,
                  }}
                >
                  <Loader2 size={18} className="spinning" style={{ color: "var(--accent-primary)", flexShrink: 0, animation: "spin 1s linear infinite" }} />
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.4 }}>
                    <strong style={{ color: "var(--text-primary)" }}>Waiting for browser sign-in...</strong>
                    <br />
                    Complete login in your browser; this app will connect automatically.
                  </div>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button
                  type="button"
                  className="auth-submit-btn"
                  onClick={handleLaunchBrowser}
                  style={{ justifyContent: "center", padding: "12px", width: "100%" }}
                >
                  {browserLaunched ? <RefreshCw size={16} /> : <ExternalLink size={16} />}
                  <span>{browserLaunched ? "Reopen Browser Sign-In" : "Sign In with Browser"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  style={{
                    padding: "10px",
                    background: "var(--bg-subtle)",
                    border: "1px solid var(--border-default)",
                    borderRadius: 8,
                    color: "var(--text-primary)",
                    fontSize: 13,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  {copied ? <CheckCircle size={15} style={{ color: "var(--color-success)" }} /> : <Copy size={15} />}
                  <span>{copied ? "Link copied to clipboard!" : "Copy sign-in link"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setManualMode(true)}
                  style={{
                    marginTop: 6,
                    background: "transparent",
                    border: "none",
                    color: "var(--accent-primary)",
                    fontSize: 12,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <KeyRound size={13} />
                  <span>Enter 60s code manually</span>
                </button>
              </div>

              <p style={{ margin: "20px 0 0", textAlign: "center", fontSize: 11, color: "var(--text-muted)" }}>
                Safe RFC 8252 pattern: URLs contain zero passwords or secrets.
              </p>
            </div>
          ) : (
            <div>
              <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--text-muted, #71717a)", lineHeight: 1.5 }}>
                Paste the 60-second sign-in code (or deep-link URL) generated in your browser:
              </p>

              <form onSubmit={handleExchangeCode} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <input
                  type="text"
                  placeholder="Paste 60s code or link here..."
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  autoFocus
                  required
                  style={{
                    padding: "10px 12px",
                    background: "rgba(0, 0, 0, 0.3)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    borderRadius: 8,
                    color: "inherit",
                    fontSize: 13,
                    fontFamily: "monospace",
                    outline: "none",
                  }}
                />

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setManualMode(false);
                      setError(null);
                    }}
                    style={{
                      flex: 1,
                      padding: "10px",
                      background: "rgba(255, 255, 255, 0.05)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: 8,
                      color: "var(--text-secondary)",
                      fontSize: 13,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <ArrowLeft size={14} />
                    <span>Back</span>
                  </button>

                  <button
                    type="submit"
                    disabled={loading || !manualCode.trim()}
                    className="auth-submit-btn"
                    style={{ flex: 1, justifyContent: "center", padding: "10px" }}
                  >
                    {loading ? <Loader2 size={16} className="spinning" style={{ animation: "spin 1s linear infinite" }} /> : <span>Connect</span>}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
