import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  Download,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { openExternalBrowser } from "../lib/desktopAuth";

export interface DesktopUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentVersion: string;
}

export function compareVersions(v1: string, v2: string): number {
  const clean1 = v1.replace(/^v/, "").trim().split(".").map((n) => parseInt(n, 10) || 0);
  const clean2 = v2.replace(/^v/, "").trim().split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(clean1.length, clean2.length); i++) {
    const num1 = clean1[i] ?? 0;
    const num2 = clean2[i] ?? 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

interface ReleaseInfo {
  version: string;
  name: string;
  date: string;
  notes: string;
  downloadUrl: string;
  htmlUrl: string;
}

export function DesktopUpdateModal({
  isOpen,
  onClose,
  currentVersion,
}: DesktopUpdateModalProps) {
  const [status, setStatus] = useState<"checking" | "up-to-date" | "update-available" | "error">("checking");
  const [releaseInfo, setReleaseInfo] = useState<ReleaseInfo | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  const checkForUpdates = useCallback(async () => {
    setStatus("checking");
    setErrorDetails(null);

    try {
      const response = await fetch("https://api.github.com/repos/AnkitArsh19/graffiti/releases/latest", {
        headers: {
          Accept: "application/vnd.github.v3+json",
        },
      });

      if (!response.ok) {
        throw new Error(`GitHub API returned status ${response.status}`);
      }

      const data = await response.json();
      const rawTag = (data.tag_name || "").trim();
      const cleanTag = rawTag.replace(/^v/, "");

      // Find Windows setup.exe asset, or construct direct download link
      let downloadUrl = `https://github.com/AnkitArsh19/graffiti/releases/download/${cleanTag}/Graffiti_${cleanTag}_x64-setup.exe`;
      if (Array.isArray(data.assets) && data.assets.length > 0) {
        const exeAsset = data.assets.find(
          (a: any) => typeof a.name === "string" && a.name.endsWith(".exe")
        );
        if (exeAsset?.browser_download_url) {
          downloadUrl = exeAsset.browser_download_url;
        }
      }

      const release: ReleaseInfo = {
        version: cleanTag,
        name: data.name || `Graffiti Desktop v${cleanTag}`,
        date: data.published_at
          ? new Date(data.published_at).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : "Recent Release",
        notes: data.body || "Performance enhancements, bug fixes, and stability improvements.",
        downloadUrl,
        htmlUrl: data.html_url || "https://github.com/AnkitArsh19/graffiti/releases/latest",
      };

      setReleaseInfo(release);

      const comparison = compareVersions(cleanTag, currentVersion);
      if (comparison > 0) {
        setStatus("update-available");
      } else {
        setStatus("up-to-date");
      }
    } catch (err: any) {
      console.warn("Failed to check GitHub releases:", err);
      setStatus("error");
      setErrorDetails(err?.message || "Unable to reach GitHub release servers");
    }
  }, [currentVersion]);

  useEffect(() => {
    if (isOpen) {
      checkForUpdates();
    }
  }, [isOpen, checkForUpdates]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
      }}
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-panel, #18181b)",
          border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.14))",
          borderRadius: "14px",
          maxWidth: 480,
          width: "100%",
          padding: 24,
          boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
          color: "var(--text-primary, #f4f4f5)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: "rgba(212, 163, 89, 0.15)",
                color: "var(--accent-primary, #d4a359)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <RefreshCw size={18} className={status === "checking" ? "animate-spin" : ""} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Check for Updates</h3>
              <span style={{ fontSize: 12, color: "var(--text-muted, #a1a1aa)" }}>
                Installed: v{currentVersion}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted, #a1a1aa)",
              cursor: "pointer",
              padding: 4,
              borderRadius: 6,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* State Content */}
        {status === "checking" && (
          <div style={{ padding: "28px 0", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <RefreshCw size={24} className="animate-spin" style={{ color: "var(--accent-primary, #d4a359)" }} />
            <div style={{ fontSize: 14, fontWeight: 500 }}>Connecting to GitHub Releases...</div>
            <div style={{ fontSize: 12, color: "var(--text-muted, #a1a1aa)" }}>Verifying latest builds for Graffiti Desktop</div>
          </div>
        )}

        {status === "up-to-date" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div
              style={{
                background: "rgba(34, 197, 94, 0.12)",
                border: "1px solid rgba(34, 197, 94, 0.25)",
                borderRadius: 10,
                padding: "14px 16px",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <CheckCircle2 size={24} style={{ color: "#22c55e", flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#f4f4f5" }}>
                  Graffiti Desktop is Up to Date
                </div>
                <div style={{ fontSize: 12, color: "#a1a1aa", marginTop: 2 }}>
                  Version v{currentVersion} is currently the latest release.
                </div>
              </div>
            </div>

            <div style={{ fontSize: 12, color: "var(--text-muted, #a1a1aa)", lineHeight: 1.5 }}>
              All collaborative whiteboard features, local notebook storage, and offline geometry engines are operating on the newest release channel.
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
              <button
                type="button"
                onClick={checkForUpdates}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  background: "transparent",
                  color: "#e4e4e7",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 500,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <RefreshCw size={13} />
                <span>Check Again</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: "8px 18px",
                  borderRadius: 8,
                  background: "var(--accent-primary, #d4a359)",
                  border: "none",
                  color: "#09090b",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Done
              </button>
            </div>
          </div>
        )}

        {status === "update-available" && releaseInfo && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div
              style={{
                background: "rgba(212, 163, 89, 0.14)",
                border: "1px solid rgba(212, 163, 89, 0.35)",
                borderRadius: 10,
                padding: "14px 16px",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <Download size={24} style={{ color: "var(--accent-primary, #d4a359)", flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#f4f4f5" }}>
                  New Release Available: v{releaseInfo.version}
                </div>
                <div style={{ fontSize: 12, color: "#d4d4d8", marginTop: 2 }}>
                  Published on {releaseInfo.date} • Currently on v{currentVersion}
                </div>
              </div>
            </div>

            {/* Release Changelog */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#e4e4e7", marginBottom: 6 }}>
                What's New in {releaseInfo.name}:
              </div>
              <div
                style={{
                  maxHeight: 140,
                  overflowY: "auto",
                  padding: "8px 12px",
                  background: "rgba(0, 0, 0, 0.25)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: 8,
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: "#d4d4d8",
                  whiteSpace: "pre-wrap",
                }}
              >
                {releaseInfo.notes}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
              <button
                type="button"
                onClick={() => openExternalBrowser(releaseInfo.htmlUrl)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--accent-primary, #d4a359)",
                  fontSize: 12,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: 0,
                  textDecoration: "underline",
                }}
              >
                <span>Release Page</span>
                <ExternalLink size={12} />
              </button>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: "9px 16px",
                    borderRadius: 8,
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    background: "transparent",
                    color: "#d4d4d8",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  Later
                </button>
                <button
                  type="button"
                  onClick={() => {
                    openExternalBrowser(releaseInfo.downloadUrl);
                    onClose();
                  }}
                  style={{
                    padding: "9px 18px",
                    borderRadius: 8,
                    background: "linear-gradient(135deg, #d4a359 0%, #b47b18 100%)",
                    border: "none",
                    color: "#09090b",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    boxShadow: "0 4px 14px rgba(212, 163, 89, 0.35)",
                  }}
                >
                  <Download size={14} />
                  <span>Download Update (x64)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {status === "error" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div
              style={{
                background: "rgba(239, 68, 68, 0.12)",
                border: "1px solid rgba(239, 68, 68, 0.25)",
                borderRadius: 10,
                padding: "14px 16px",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <AlertCircle size={24} style={{ color: "#ef4444", flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#f4f4f5" }}>
                  Unable to Check for Updates
                </div>
                <div style={{ fontSize: 12, color: "#a1a1aa", marginTop: 2 }}>
                  {errorDetails || "Could not reach GitHub Releases API."}
                </div>
              </div>
            </div>

            <p style={{ fontSize: 12, color: "#a1a1aa", margin: 0, lineHeight: 1.5 }}>
              You can manually check for the latest releases, install packages, and changelog notes directly on the GitHub repository.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
              <button
                type="button"
                onClick={() => openExternalBrowser("https://github.com/AnkitArsh19/graffiti/releases/latest")}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  background: "transparent",
                  color: "#e4e4e7",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 500,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <ExternalLink size={13} />
                <span>Open Releases in Browser</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  background: "var(--accent-primary, #d4a359)",
                  border: "none",
                  color: "#09090b",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

