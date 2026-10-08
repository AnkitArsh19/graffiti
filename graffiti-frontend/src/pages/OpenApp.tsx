import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Monitor, Copy, CheckCircle, ExternalLink, ShieldCheck } from "lucide-react";
import { apiCompleteDesktopHandoff } from "../lib/api";

export default function OpenApp() {
  const [searchParams] = useSearchParams();
  const [code] = useState(() => searchParams.get("code") || "");
  const [session] = useState(() => searchParams.get("session") || "");
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const deepLinkUrl = `graffiti://auth/callback?code=${encodeURIComponent(code)}`;

  useEffect(() => {
    // Sanitize browser URL and history immediately so query params are not visible in address bar
    if (window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (session && code) {
      apiCompleteDesktopHandoff(session, code).catch(() => {});
    }
  }, [session, code]);

  useEffect(() => {
    if (code) {
      // Automatically attempt protocol launch
      const timer = setTimeout(() => {
        window.location.href = deepLinkUrl;
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [code, deepLinkUrl]);

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    } catch {}
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(deepLinkUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {}
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 440, textAlign: "center" }}>
        <div className="auth-logo">
          <Link to="/" title="Graffiti">
            <img src="/graffiti-logo-dark.png" alt="Graffiti" className="auth-logo-img" />
          </Link>
        </div>

        <div style={{
          width: 58,
          height: 58,
          borderRadius: "50%",
          background: "var(--accent-subtle)",
          color: "var(--accent-primary)",
          display: "grid",
          placeItems: "center",
          margin: "0 auto 16px"
        }}>
          <Monitor size={28} />
        </div>

        <h1 className="auth-title">Open Graffiti Desktop</h1>
        <p className="auth-subtitle">
          You are signed in! A browser prompt should appear to open Graffiti Desktop. If it didn't, click the button below.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 24 }}>
          <a
            href={deepLinkUrl}
            className="auth-submit-btn"
            style={{ textDecoration: "none", justifyContent: "center" }}
          >
            <ExternalLink size={16} />
            <span>Open Graffiti Desktop</span>
          </a>

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
              gap: 8
            }}
          >
            {copiedLink ? <CheckCircle size={15} style={{ color: "var(--color-success)" }} /> : <Copy size={15} />}
            <span>{copiedLink ? "App link copied to clipboard!" : "Copy app link"}</span>
          </button>
        </div>

        {code && (
          <div style={{
            marginTop: 20,
            padding: 14,
            background: "var(--bg-subtle)",
            border: "1px solid var(--border-default)",
            borderRadius: 8,
            textAlign: "left"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>60s Sign-in Code</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                <ShieldCheck size={12} /> Single-use
              </span>
            </div>

            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              borderRadius: 6,
              padding: "6px 10px"
            }}>
              <span style={{ fontSize: 12, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 240, color: "var(--text-primary)" }}>
                {code}
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                style={{
                  background: "transparent",
                  border: "none",
                  color: copiedCode ? "var(--color-success)" : "var(--accent-primary)",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "2px 6px"
                }}
              >
                {copiedCode ? "Copied!" : "Copy Code"}
              </button>
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--text-muted)", lineHeight: 1.4 }}>
              Paste this code into the desktop app if your browser blocks protocol popups.
            </p>
          </div>
        )}

        <p style={{ marginTop: 24, fontSize: 12, color: "var(--text-muted)" }}>
          You can safely close this browser tab after connecting.
        </p>
      </div>
    </div>
  );
}
