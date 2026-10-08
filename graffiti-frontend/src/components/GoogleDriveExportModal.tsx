import React, { useState, useEffect, useCallback } from "react";
import {
  Cloud,
  X,
  Plus,
  Trash2,
  Check,
  ExternalLink,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Folder,
  FolderOpen,
  ChevronRight,
  Download,
  Upload,
  Search,
  RefreshCw,
  FileText,
  Image as ImageIcon,
  FileCode,
  FileSpreadsheet,
  File as GenericFileIcon,
} from "lucide-react";
import {
  apiGetDriveAccounts,
  apiDisconnectDriveAccount,
  apiExportDrive,
  apiGetDriveFolders,
  apiGetDriveFiles,
  apiDownloadDriveFile,
  getGoogleDriveAuthorizeUrl,
  getGoogleOAuthUrl,
  ConnectedDriveAccount,
  DriveFolderItem,
  DriveFileItem,
} from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { isDesktopApp, openExternalBrowser } from "../lib/desktopAuth";

interface GoogleDriveExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  getPdfBlob?: () => Promise<Blob | null>;
  roomSlug?: string;
  initialMode?: "export" | "import";
  onImportFile?: (file: File) => void;
}

const LOCAL_DRIVE_STORAGE_KEY = "graffiti:local_drive_accounts:v1";

interface LocalDriveAccount {
  id: string;
  accountEmail: string;
  accountLabel: string;
  accessToken: string;
  isDefault: boolean;
}

interface FolderCrumb {
  id: string | null;
  name: string;
}

export function GoogleDriveExportModal({
  isOpen,
  onClose,
  getPdfBlob,
  roomSlug,
  initialMode = "export",
  onImportFile,
}: GoogleDriveExportModalProps) {
  const { isAuthenticated } = useAuth();
  const [mode, setMode] = useState<"export" | "import">(initialMode);
  const [accounts, setAccounts] = useState<ConnectedDriveAccount[]>([]);
  const [localAccounts, setLocalAccounts] = useState<LocalDriveAccount[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_DRIVE_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [isAdding, setIsAdding] = useState(false);

  // Folder navigation state
  const [folderCrumbs, setFolderCrumbs] = useState<FolderCrumb[]>([{ id: null, name: "My Drive" }]);
  const currentFolderId = folderCrumbs[folderCrumbs.length - 1]?.id ?? null;
  const currentFolderName = folderCrumbs[folderCrumbs.length - 1]?.name ?? "My Drive";

  const [folders, setFolders] = useState<DriveFolderItem[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [folderSearchQuery, setFolderSearchQuery] = useState("");

  // File browsing / Import state
  const [files, setFiles] = useState<DriveFileItem[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isImportingFileId, setIsImportingFileId] = useState<string | null>(null);

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{ webViewLink: string; fileId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isGcpDriveDisabled = Boolean(
    error &&
      (error.includes("468366490568") ||
        error.includes("Google Drive API") ||
        error.includes("console.developers.google.com") ||
        error.includes("accessNotConfigured"))
  );

  // Sync mode with prop
  useEffect(() => {
    if (initialMode) {
      setMode(initialMode);
    }
  }, [initialMode]);

  // Account refresh function
  const refreshAccounts = useCallback(() => {
    if (isAuthenticated) {
      apiGetDriveAccounts()
        .then((accs) => {
          setAccounts(accs);
          if (accs.length > 0) {
            setSelectedAccountId((curr) => {
              if (curr && accs.some((a) => a.id === curr)) return curr;
              const def = accs.find((a) => a.isDefault) || accs[accs.length - 1];
              return def.id;
            });
          }
        })
        .catch((err) => {
          console.warn("Could not fetch cloud drive accounts:", err);
        });
    } else {
      try {
        const saved = localStorage.getItem(LOCAL_DRIVE_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          setLocalAccounts(parsed);
          if (parsed.length > 0) {
            setSelectedAccountId((curr) => {
              if (curr && parsed.some((a: any) => a.id === curr)) return curr;
              return parsed[0].id;
            });
          }
        }
      } catch {}
    }
    setIsAdding(false);
    setError(null);
  }, [isAuthenticated]);

  // Listen for OAuth completion
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "GRAFFITI_DRIVE_CONNECTED") {
        refreshAccounts();
      }
    }

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("graffiti_drive_channel");
      bc.onmessage = (ev) => {
        if (ev.data?.type === "GRAFFITI_DRIVE_CONNECTED") {
          refreshAccounts();
        }
      };
    } catch {}

    function handleStorage(ev: StorageEvent) {
      if (ev.key === "graffiti:drive_connected") {
        refreshAccounts();
      }
    }

    function handleFocus() {
      if (isOpen) {
        refreshAccounts();
      }
    }

    window.addEventListener("message", handleMessage);
    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", handleFocus);
      if (bc) bc.close();
    };
  }, [isOpen, refreshAccounts]);

  // Initial load when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setExportResult(null);
    setError(null);
    setSearchQuery("");
    setFolderSearchQuery("");
    setFolderCrumbs([{ id: null, name: "My Drive" }]);
    refreshAccounts();
  }, [isOpen, refreshAccounts]);

  const allAccounts = isAuthenticated
    ? accounts.map((a) => ({ id: a.id, email: a.accountEmail, label: a.accountLabel, isDefault: a.isDefault, isCloud: true }))
    : localAccounts.map((a) => ({ id: a.id, email: a.accountEmail, label: a.accountLabel, isDefault: a.isDefault, isCloud: false }));

  const activeLocal = !isAuthenticated ? localAccounts.find((a) => a.id === selectedAccountId) : null;
  const activeToken = activeLocal?.accessToken;

  // Load folders
  const loadFolders = useCallback(async () => {
    if (!isOpen || (!selectedAccountId && allAccounts.length === 0)) return;
    setIsLoadingFolders(true);
    try {
      const isSearching = Boolean(folderSearchQuery.trim());
      const data = await apiGetDriveFolders({
        accountId: isAuthenticated ? (selectedAccountId || undefined) : undefined,
        parentFolderId: isSearching ? undefined : (currentFolderId || undefined),
        search: isSearching ? folderSearchQuery.trim() : undefined,
        directToken: activeToken,
      });
      setFolders(data);
    } catch (err: any) {
      console.warn("Failed to load drive folders:", err);
      setError(err.message || "Failed to load folders");
    } finally {
      setIsLoadingFolders(false);
    }
  }, [isOpen, selectedAccountId, allAccounts.length, isAuthenticated, currentFolderId, folderSearchQuery, activeToken]);

  // Load files for import
  const loadFiles = useCallback(async () => {
    if (!isOpen || mode !== "import" || (!selectedAccountId && allAccounts.length === 0)) return;
    setIsLoadingFiles(true);
    try {
      const isSearching = Boolean(searchQuery.trim());
      const data = await apiGetDriveFiles({
        accountId: isAuthenticated ? (selectedAccountId || undefined) : undefined,
        folderId: isSearching ? undefined : (currentFolderId || undefined),
        search: isSearching ? searchQuery.trim() : undefined,
        directToken: activeToken,
      });
      setFiles(data);
    } catch (err: any) {
      console.warn("Failed to load drive files:", err);
      setError(err.message || "Failed to load files");
    } finally {
      setIsLoadingFiles(false);
    }
  }, [isOpen, mode, selectedAccountId, allAccounts.length, isAuthenticated, currentFolderId, searchQuery, activeToken]);

  // Trigger loads when account or folder or search changes
  useEffect(() => {
    if (!isOpen || allAccounts.length === 0) return;
    const timer = setTimeout(() => {
      loadFolders();
    }, 200);
    return () => clearTimeout(timer);
  }, [isOpen, selectedAccountId, currentFolderId, folderSearchQuery, allAccounts.length, loadFolders]);

  useEffect(() => {
    if (!isOpen || mode !== "import" || allAccounts.length === 0) return;
    const timer = setTimeout(() => {
      loadFiles();
    }, 250);
    return () => clearTimeout(timer);
  }, [isOpen, mode, selectedAccountId, currentFolderId, searchQuery, allAccounts.length, loadFiles]);

  if (!isOpen) return null;

  async function handleGoogleConnect() {
    setError(null);
    const desktop = isDesktopApp();

    if (isAuthenticated) {
      const url = getGoogleDriveAuthorizeUrl(desktop ? "desktop" : "web");
      if (desktop) {
        await openExternalBrowser(url);
      } else {
        const popup = window.open(
          url,
          "graffiti_drive_oauth",
          "width=560,height=680,menubar=no,toolbar=no,location=no,status=no"
        );
        if (!popup || popup.closed) {
          window.location.href = url;
        }
      }
      return;
    }

    // Guest / local GIS
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (typeof window !== "undefined" && (window as any).google?.accounts?.oauth2 && googleClientId) {
      try {
        const client = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: googleClientId,
          scope: "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.file",
          callback: async (tokenResponse: any) => {
            if (tokenResponse.error) {
              setError(`Google Auth error: ${tokenResponse.error}`);
              return;
            }
            if (tokenResponse.access_token) {
              let email = "drive-user@gmail.com";
              try {
                const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
                  headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
                });
                if (userRes.ok) {
                  const data = await userRes.json();
                  if (data.email) email = data.email;
                }
              } catch (e) {
                console.warn("Could not fetch userinfo:", e);
              }

              const newLocal: LocalDriveAccount = {
                id: "local_" + Date.now(),
                accountEmail: email,
                accountLabel: email.split("@")[0] + " (Drive)",
                accessToken: tokenResponse.access_token,
                isDefault: localAccounts.length === 0,
              };
              const updated = [...localAccounts, newLocal];
              setLocalAccounts(updated);
              localStorage.setItem(LOCAL_DRIVE_STORAGE_KEY, JSON.stringify(updated));
              setSelectedAccountId(newLocal.id);
              setIsAdding(false);
            }
          },
        });
        client.requestAccessToken({ prompt: "consent" });
        return;
      } catch (err: any) {
        console.warn("GIS init failed, falling back to login URL:", err);
      }
    }

    const loginUrl = getGoogleOAuthUrl(desktop ? "desktop" : "web");
    if (desktop) {
      await openExternalBrowser(loginUrl);
    } else {
      window.location.href = loginUrl;
    }
  }

  async function handleDisconnect(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      if (isAuthenticated) {
        await apiDisconnectDriveAccount(id);
        setAccounts((prev) => prev.filter((a) => a.id !== id));
      } else {
        const updated = localAccounts.filter((a) => a.id !== id);
        setLocalAccounts(updated);
        localStorage.setItem(LOCAL_DRIVE_STORAGE_KEY, JSON.stringify(updated));
      }
      if (selectedAccountId === id) {
        setSelectedAccountId("");
      }
    } catch (err: any) {
      setError(err.message || "Failed to disconnect account");
    }
  }

  function handleNavigateFolder(folder: DriveFolderItem) {
    setFolderSearchQuery("");
    setFolderCrumbs((prev) => [...prev, { id: folder.id, name: folder.name }]);
  }

  function handleCrumbClick(index: number) {
    setFolderSearchQuery("");
    setFolderCrumbs((prev) => prev.slice(0, index + 1));
  }

  async function handleExport() {
    if (!getPdfBlob) return;
    setError(null);
    setIsExporting(true);
    setExportResult(null);

    try {
      const blob = await getPdfBlob();
      if (!blob) {
        throw new Error("Failed to generate PDF snapshot for export.");
      }

      let res;
      if (isAuthenticated) {
        res = await apiExportDrive(blob, {
          roomSlug,
          accountId: selectedAccountId || undefined,
          folderId: currentFolderId || undefined,
        });
      } else {
        const active = localAccounts.find((a) => a.id === selectedAccountId);
        if (!active) {
          throw new Error("Please select or add a Google Drive account first.");
        }
        res = await apiExportDrive(blob, {
          roomSlug,
          directToken: active.accessToken,
          folderId: currentFolderId || undefined,
        });
      }

      setExportResult(res);
    } catch (err: any) {
      setError(err.message || "Export to Google Drive failed");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleImport(fileItem: DriveFileItem) {
    setIsImportingFileId(fileItem.id);
    setError(null);
    try {
      const active = !isAuthenticated ? localAccounts.find((a) => a.id === selectedAccountId) : null;
      const downloaded = await apiDownloadDriveFile(fileItem.id, {
        accountId: isAuthenticated ? (selectedAccountId || undefined) : undefined,
        directToken: active ? active.accessToken : undefined,
      });

      const fileName = downloaded.filename || fileItem.name;
      const file = new File([downloaded.blob], fileName, {
        type: downloaded.mimeType || fileItem.mimeType,
      });

      if (onImportFile) {
        onImportFile(file);
        onClose();
      } else {
        // Fallback browser download
        const url = URL.createObjectURL(downloaded.blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || "Failed to import file from Google Drive");
    } finally {
      setIsImportingFileId(null);
    }
  }

  function renderFileIcon(mimeType: string, filename: string) {
    const lower = filename.toLowerCase();
    if (mimeType.includes("pdf") || lower.endsWith(".pdf")) {
      return <FileText size={16} style={{ color: "#ef4444", flexShrink: 0 }} />;
    }
    if (mimeType.startsWith("image/") || /\.(png|jpe?g|webp|svg|gif|bmp)$/i.test(lower)) {
      return <ImageIcon size={16} style={{ color: "#a855f7", flexShrink: 0 }} />;
    }
    if (lower.endsWith(".graffiti") || lower.endsWith(".json")) {
      return <FileCode size={16} style={{ color: "#d4a359", flexShrink: 0 }} />;
    }
    if (mimeType.includes("word") || mimeType.includes("document") || lower.endsWith(".docx")) {
      return <FileText size={16} style={{ color: "#3b82f6", flexShrink: 0 }} />;
    }
    if (mimeType.includes("presentation") || lower.endsWith(".pptx")) {
      return <FileSpreadsheet size={16} style={{ color: "#f97316", flexShrink: 0 }} />;
    }
    return <GenericFileIcon size={16} style={{ color: "#9ca3af", flexShrink: 0 }} />;
  }

  function formatFileSize(bytes?: string) {
    if (!bytes) return "";
    const b = parseInt(bytes, 10);
    if (isNaN(b) || b <= 0) return "";
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatDate(isoStr?: string) {
    if (!isoStr) return "";
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  }

  return (
    <div
      className="modal-overlay"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "rgba(0, 0, 0, 0.72)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
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
          maxWidth: 540,
          background: "var(--bg-panel, #121214)",
          border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))",
          borderRadius: 14,
          boxShadow: "0 28px 65px rgba(0, 0, 0, 0.75)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "90vh",
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
                width: 34,
                height: 34,
                borderRadius: 8,
                background: "rgba(212, 163, 89, 0.15)",
                display: "grid",
                placeItems: "center",
                color: "var(--accent-primary, #d4a359)",
              }}
            >
              <Cloud size={19} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--text-primary, #f4f4f5)" }}>
                Google Drive
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted, #71717a)" }}>
                Export canvas boards & import files seamlessly
              </p>
            </div>
          </div>
          <button
            type="button"
            className="icon-action-btn"
            onClick={onClose}
            aria-label="Close"
            style={{
              cursor: "pointer",
              background: "transparent",
              border: "none",
              color: "var(--text-muted, #a1a1aa)",
              padding: 6,
              borderRadius: 6,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Mode Tabs */}
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: "10px 20px 0",
            borderBottom: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))",
            background: "rgba(255, 255, 255, 0.02)",
          }}
        >
          <button
            type="button"
            onClick={() => {
              setMode("export");
              setExportResult(null);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              background: "transparent",
              border: "none",
              borderBottom: mode === "export" ? "2px solid var(--accent-primary, #d4a359)" : "2px solid transparent",
              color: mode === "export" ? "var(--accent-primary, #d4a359)" : "var(--text-muted, #71717a)",
              fontWeight: mode === "export" ? 600 : 500,
              fontSize: 13,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <Upload size={14} />
            <span>Export to Drive</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("import");
              setExportResult(null);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              background: "transparent",
              border: "none",
              borderBottom: mode === "import" ? "2px solid var(--accent-primary, #d4a359)" : "2px solid transparent",
              color: mode === "import" ? "var(--accent-primary, #d4a359)" : "var(--text-muted, #71717a)",
              fontWeight: mode === "import" ? 600 : 500,
              fontSize: 13,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <Download size={14} />
            <span>Import from Drive</span>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "18px 20px", overflowY: "auto", flex: 1 }}>
          {/* GCP API Disabled Alert Banner */}
          {isGcpDriveDisabled && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                padding: "14px 16px",
                background: "rgba(234, 179, 8, 0.12)",
                border: "1px solid rgba(234, 179, 8, 0.35)",
                borderRadius: 10,
                color: "#fef08a",
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#facc15", fontWeight: 600 }}>
                <AlertTriangle size={18} />
                <span>Google Drive API Must Be Enabled</span>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: "#e4e4e7", lineHeight: 1.5 }}>
                The Google Drive API is not yet activated in your Google Cloud Project (<strong>468366490568</strong>).
                Enable it with one click in the Google Cloud Console, wait a moment, and retry.
              </p>
              <a
                href="https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=468366490568"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 14px",
                  background: "#eab308",
                  color: "#09090b",
                  fontWeight: 600,
                  fontSize: 12,
                  borderRadius: 6,
                  textDecoration: "none",
                  alignSelf: "flex-start",
                  transition: "opacity 0.15s",
                }}
              >
                <span>Enable Google Drive API in GCP Console</span>
                <ExternalLink size={13} />
              </a>
            </div>
          )}

          {/* Standard error banner */}
          {error && !isGcpDriveDisabled && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 14px",
                background: "rgba(239, 68, 68, 0.12)",
                border: "1px solid rgba(239, 68, 68, 0.25)",
                borderRadius: 8,
                color: "var(--color-danger, #ef4444)",
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span style={{ wordBreak: "break-word" }}>{error}</span>
            </div>
          )}

          {/* Export Success Screen */}
          {mode === "export" && exportResult ? (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background: "rgba(34, 197, 94, 0.15)",
                  color: "var(--color-success, #22c55e)",
                  display: "grid",
                  placeItems: "center",
                  margin: "0 auto 14px",
                }}
              >
                <Check size={24} />
              </div>
              <h4 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
                Exported Successfully!
              </h4>
              <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--text-muted, #71717a)" }}>
                Your notebook PDF has been saved to{" "}
                <strong style={{ color: "var(--text-primary)" }}>{currentFolderName}</strong> in Google Drive.
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <a
                  href={exportResult.webViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "9px 16px",
                    background: "var(--accent-primary, #d4a359)",
                    borderRadius: 8,
                    color: "var(--accent-text, #09090b)",
                    textDecoration: "none",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  <span>Open in Google Drive</span>
                  <ExternalLink size={14} />
                </a>
                <button
                  type="button"
                  onClick={() => setExportResult(null)}
                  style={{
                    padding: "9px 16px",
                    background: "var(--bg-subtle, rgba(255, 255, 255, 0.06))",
                    border: "1px solid var(--border-default, rgba(255, 255, 255, 0.12))",
                    borderRadius: 8,
                    color: "inherit",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Export Again
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Account Selection Banner */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <label
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--text-muted, #71717a)",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    Google Drive Account
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsAdding((p) => !p)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      background: "transparent",
                      border: "none",
                      color: "var(--accent-primary, #d4a359)",
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    <Plus size={13} />
                    <span>{isAdding ? "Cancel" : "Add Account"}</span>
                  </button>
                </div>

                {allAccounts.length === 0 && !isAdding ? (
                  <div
                    style={{
                      padding: "20px 16px",
                      textAlign: "center",
                      border: "1px dashed rgba(255, 255, 255, 0.15)",
                      borderRadius: 10,
                      background: "rgba(255, 255, 255, 0.02)",
                    }}
                  >
                    <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--text-muted, #71717a)" }}>
                      No Google Drive accounts connected yet.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsAdding(true)}
                      style={{
                        padding: "8px 16px",
                        background: "var(--accent-primary, #d4a359)",
                        border: "none",
                        borderRadius: 6,
                        color: "var(--accent-text, #09090b)",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Connect Google Drive
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {allAccounts.map((acc) => {
                      const isSelected = selectedAccountId === acc.id;
                      return (
                        <div
                          key={acc.id}
                          onClick={() => setSelectedAccountId(acc.id)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "8px 12px",
                            borderRadius: 8,
                            border: `1px solid ${isSelected ? "var(--accent-primary, #d4a359)" : "rgba(255, 255, 255, 0.08)"}`,
                            background: isSelected ? "rgba(212, 163, 89, 0.08)" : "rgba(255, 255, 255, 0.03)",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10, overflow: "hidden" }}>
                            <div
                              style={{
                                width: 16,
                                height: 16,
                                borderRadius: "50%",
                                border: `2px solid ${isSelected ? "var(--accent-primary, #d4a359)" : "rgba(255, 255, 255, 0.3)"}`,
                                display: "grid",
                                placeItems: "center",
                                flexShrink: 0,
                              }}
                            >
                              {isSelected && (
                                <div
                                  style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: "50%",
                                    background: "var(--accent-primary, #d4a359)",
                                  }}
                                />
                              )}
                            </div>
                            <div style={{ overflow: "hidden" }}>
                              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary, #f4f4f5)" }}>
                                {acc.label}
                              </div>
                              <div
                                style={{
                                  fontSize: 11,
                                  color: "var(--text-muted, #71717a)",
                                  textOverflow: "ellipsis",
                                  overflow: "hidden",
                                }}
                              >
                                {acc.email}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => handleDisconnect(acc.id, e)}
                            title="Disconnect account"
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "var(--color-danger, #ef4444)",
                              opacity: 0.7,
                              cursor: "pointer",
                              padding: 4,
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Add Account Inline Form */}
              {isAdding && (
                <div
                  style={{
                    padding: "16px",
                    background: "rgba(255, 255, 255, 0.04)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: 10,
                    marginBottom: 16,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary, #f4f4f5)" }}>
                      Connect Google Drive Account
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAdding(false)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "rgba(255, 255, 255, 0.5)",
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                    >
                      Cancel
                    </button>
                  </div>

                  <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted, #71717a)", lineHeight: 1.5 }}>
                    Authenticate with Google to link your Google Drive. Once approved, the tab closes automatically.
                  </p>

                  <button
                    type="button"
                    onClick={handleGoogleConnect}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      padding: "10px 16px",
                      background: "var(--accent-primary, #d4a359)",
                      border: "none",
                      borderRadius: 8,
                      color: "var(--accent-text, #09090b)",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <Cloud size={16} />
                    <span>Sign in with Google to Connect Drive</span>
                  </button>
                </div>
              )}

              {/* Folder Navigation & Breadcrumbs */}
              {allAccounts.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 8,
                    }}
                  >
                    <label
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--text-muted, #71717a)",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      {mode === "export" ? "Destination Folder" : "Drive Explorer"}
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        loadFolders();
                        if (mode === "import") loadFiles();
                      }}
                      title="Refresh folders & files"
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--text-muted, #71717a)",
                        cursor: "pointer",
                        padding: 4,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 11,
                      }}
                    >
                      <RefreshCw size={12} className={isLoadingFolders || isLoadingFiles ? "spinning" : ""} />
                      <span>Refresh</span>
                    </button>
                  </div>

                  {/* Folder Search Input */}
                  <div
                    style={{
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      marginBottom: 8,
                    }}
                  >
                    <Search
                      size={13}
                      style={{
                        position: "absolute",
                        left: 10,
                        color: "var(--text-muted, #71717a)",
                        pointerEvents: "none",
                      }}
                    />
                    <input
                      type="text"
                      placeholder={mode === "export" ? "Search destination folders in Drive..." : "Search folders..."}
                      value={folderSearchQuery}
                      onChange={(e) => setFolderSearchQuery(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "6px 28px 6px 30px",
                        background: "rgba(255, 255, 255, 0.04)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        borderRadius: 7,
                        color: "var(--text-primary, #f4f4f5)",
                        fontSize: 12,
                        outline: "none",
                      }}
                    />
                    {folderSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setFolderSearchQuery("")}
                        style={{
                          position: "absolute",
                          right: 8,
                          background: "transparent",
                          border: "none",
                          color: "var(--text-muted, #71717a)",
                          cursor: "pointer",
                          padding: 2,
                        }}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {/* Breadcrumb Path (when not searching) */}
                  {!folderSearchQuery ? (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "7px 10px",
                        background: "rgba(255, 255, 255, 0.04)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        borderRadius: 8,
                        overflowX: "auto",
                        whiteSpace: "nowrap",
                        fontSize: 12,
                        marginBottom: 8,
                      }}
                    >
                      {folderCrumbs.map((crumb, idx) => (
                        <React.Fragment key={crumb.id || "root"}>
                          {idx > 0 && <ChevronRight size={13} style={{ color: "rgba(255, 255, 255, 0.3)" }} />}
                          <button
                            type="button"
                            onClick={() => handleCrumbClick(idx)}
                            style={{
                              background: "transparent",
                              border: "none",
                              color:
                                idx === folderCrumbs.length - 1
                                  ? "var(--accent-primary, #d4a359)"
                                  : "var(--text-muted, #a1a1aa)",
                              fontWeight: idx === folderCrumbs.length - 1 ? 600 : 400,
                              cursor: "pointer",
                              padding: "2px 4px",
                              borderRadius: 4,
                            }}
                          >
                            {crumb.name}
                          </button>
                        </React.Fragment>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: "var(--accent-primary, #d4a359)", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
                      <span>Matching folders:</span>
                    </div>
                  )}

                  {/* Subfolders row/chips */}
                  {isLoadingFolders ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 0", color: "var(--text-muted)" }}>
                      <Loader2 size={13} className="spinning" />
                      <span style={{ fontSize: 12 }}>Loading folders...</span>
                    </div>
                  ) : folders.length > 0 ? (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 6,
                        maxHeight: 110,
                        overflowY: "auto",
                        padding: "2px 0 6px",
                      }}
                    >
                      {folders.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => handleNavigateFolder(f)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "6px 10px",
                            background: "rgba(255, 255, 255, 0.05)",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            borderRadius: 6,
                            color: "var(--text-primary, #f4f4f5)",
                            fontSize: 12,
                            cursor: "pointer",
                            transition: "background 0.15s ease",
                          }}
                        >
                          <Folder size={14} style={{ color: "var(--accent-primary, #d4a359)" }} />
                          <span style={{ maxWidth: 140, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                            {f.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: "var(--text-muted, #71717a)", padding: "4px 0" }}>
                      {folderSearchQuery ? `No folders found matching "${folderSearchQuery}".` : `No subfolders in ${currentFolderName}.`}
                    </div>
                  )}
                </div>
              )}

              {/* Mode 1: Export View */}
              {mode === "export" && allAccounts.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div
                    style={{
                      padding: "10px 14px",
                      background: "rgba(255, 255, 255, 0.02)",
                      border: "1px solid rgba(255, 255, 255, 0.06)",
                      borderRadius: 8,
                      marginBottom: 16,
                      fontSize: 12,
                      color: "var(--text-secondary, #d4d4d8)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>Saving to:</span>
                    <strong style={{ color: "var(--accent-primary, #d4a359)" }}>{currentFolderName}</strong>
                  </div>

                  <button
                    type="button"
                    onClick={handleExport}
                    disabled={isExporting}
                    style={{
                      width: "100%",
                      padding: "11px",
                      background: "var(--accent-primary, #d4a359)",
                      border: "none",
                      borderRadius: 8,
                      color: "var(--accent-text, #09090b)",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: isExporting ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      transition: "all 0.15s ease",
                    }}
                  >
                    {isExporting ? (
                      <>
                        <Loader2 size={16} className="spinning" />
                        <span>Exporting to Drive...</span>
                      </>
                    ) : (
                      <>
                        <Upload size={16} />
                        <span>Upload Canvas PDF to Drive</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Mode 2: Import View */}
              {mode === "import" && allAccounts.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  {/* Search bar */}
                  <div
                    style={{
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      marginBottom: 12,
                    }}
                  >
                    <Search
                      size={14}
                      style={{
                        position: "absolute",
                        left: 10,
                        color: "var(--text-muted, #71717a)",
                        pointerEvents: "none",
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Search files in Drive..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 30px 8px 32px",
                        background: "rgba(255, 255, 255, 0.04)",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        borderRadius: 8,
                        color: "var(--text-primary, #f4f4f5)",
                        fontSize: 12,
                        outline: "none",
                      }}
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        style={{
                          position: "absolute",
                          right: 8,
                          background: "transparent",
                          border: "none",
                          color: "var(--text-muted, #71717a)",
                          cursor: "pointer",
                          padding: 2,
                        }}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  {/* Files List */}
                  <div
                    style={{
                      maxHeight: 220,
                      overflowY: "auto",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      border: "1px solid rgba(255, 255, 255, 0.06)",
                      borderRadius: 8,
                      padding: 6,
                      background: "rgba(0, 0, 0, 0.2)",
                    }}
                  >
                    {isLoadingFiles ? (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                          padding: "24px 0",
                          color: "var(--text-muted, #71717a)",
                          fontSize: 13,
                        }}
                      >
                        <Loader2 size={16} className="spinning" />
                        <span>Searching Drive files...</span>
                      </div>
                    ) : files.length === 0 ? (
                      <div
                        style={{
                          textAlign: "center",
                          padding: "24px 16px",
                          color: "var(--text-muted, #71717a)",
                          fontSize: 13,
                        }}
                      >
                        {searchQuery ? "No files matched your search." : `No files found in ${currentFolderName}.`}
                      </div>
                    ) : (
                      files.map((file) => {
                        const isImporting = isImportingFileId === file.id;
                        return (
                          <div
                            key={file.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "8px 10px",
                              borderRadius: 6,
                              background: "rgba(255, 255, 255, 0.02)",
                              border: "1px solid rgba(255, 255, 255, 0.04)",
                              gap: 10,
                              transition: "background 0.15s ease",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 10, overflow: "hidden", flex: 1 }}>
                              {renderFileIcon(file.mimeType, file.name)}
                              <div style={{ overflow: "hidden", flex: 1 }}>
                                <div
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 500,
                                    color: "var(--text-primary, #f4f4f5)",
                                    textOverflow: "ellipsis",
                                    overflow: "hidden",
                                    whiteSpace: "nowrap",
                                  }}
                                  title={file.name}
                                >
                                  {file.name}
                                </div>
                                <div style={{ fontSize: 11, color: "var(--text-muted, #71717a)", display: "flex", gap: 8 }}>
                                  {file.size && <span>{formatFileSize(file.size)}</span>}
                                  {file.modifiedTime && <span>• {formatDate(file.modifiedTime)}</span>}
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleImport(file)}
                              disabled={isImporting || isImportingFileId !== null}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 5,
                                padding: "6px 12px",
                                background: "var(--accent-primary, #d4a359)",
                                border: "none",
                                borderRadius: 6,
                                color: "var(--accent-text, #09090b)",
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: isImporting ? "not-allowed" : "pointer",
                                flexShrink: 0,
                                transition: "opacity 0.15s",
                              }}
                            >
                              {isImporting ? (
                                <>
                                  <Loader2 size={13} className="spinning" />
                                  <span>Importing...</span>
                                </>
                              ) : (
                                <>
                                  <Download size={13} />
                                  <span>Import</span>
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
