import React, { useState } from "react";
import {
  PanelLeft,
  ChevronRight,
  HardDrive,
  Cloud,
  Bot,
  Edit3,
  Check,
  X,
  Layers,
  Folder as FolderIcon,
  FileText,
  LogOut,
  Radio,
  User,
  Share2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Folder, Workspace } from "../storage/types";
import { getFolderColor } from "./WorkspaceSidebar";

interface CollaboratorCursor {
  authorId: string;
  name: string;
  color: string;
}

interface TopHeaderProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  activeWorkspace?: Workspace;
  activeFolder?: Folder | null;
  whiteboardName: string;
  onRenameWhiteboard: (name: string) => void;
  isOnline: boolean;
  onOpenOverlay?: () => void;
  onAnnotateDocument?: () => void;
  // Auth and collab props
  user?: { name: string | null; email: string; avatarUrl: string | null } | null;
  onLogout?: () => void;
  isCollabConnected?: boolean;
  collaborators?: CollaboratorCursor[];
  onShareRoom?: () => void;
  roomSlug?: string | null;
  isPresenterMode?: boolean;
  onTogglePresenterMode?: () => void;
  enableCircleQuery?: boolean;
  onToggleCircleQuery?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  isSidebarOpen,
  onToggleSidebar,
  activeWorkspace,
  activeFolder,
  whiteboardName,
  onRenameWhiteboard,
  isOnline,
  onOpenOverlay,
  onAnnotateDocument,
  user,
  onLogout,
  isCollabConnected,
  collaborators = [],
  onShareRoom,
  roomSlug,
  isPresenterMode = false,
  onTogglePresenterMode,
  enableCircleQuery = false,
  onToggleCircleQuery,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(whiteboardName);
  const [showAiPopover, setShowAiPopover] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleSaveTitle = () => {
    if (tempTitle.trim()) {
      onRenameWhiteboard(tempTitle.trim());
    } else {
      setTempTitle(whiteboardName);
    }
    setIsEditingTitle(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveTitle();
    } else if (e.key === "Escape") {
      setTempTitle(whiteboardName);
      setIsEditingTitle(false);
    }
  };

  const initials = user?.name
    ? user.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() || "";

  return (
    <header className="top-header-bar">
      {/* Left: Sidebar Toggle & Breadcrumbs */}
      <div className="header-left">
        <button
          type="button"
          className={`sidebar-toggle-btn ${isSidebarOpen ? "active" : ""}`}
          onClick={onToggleSidebar}
          title={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar (Ctrl+B)"}
        >
          <PanelLeft size={18} />
        </button>

        <div className="header-breadcrumbs">
          {activeWorkspace && (
            <div className="breadcrumb-item workspace">
              <Layers size={14} className="breadcrumb-icon" />
              <span className="breadcrumb-text">{activeWorkspace.name}</span>
            </div>
          )}

          {activeFolder && (
            <>
              <ChevronRight size={13} className="breadcrumb-separator" />
              <div className="breadcrumb-item folder">
                <FolderIcon
                  size={14}
                  className="breadcrumb-icon"
                  color={getFolderColor(activeFolder.color)}
                />
                <span className="breadcrumb-text">{activeFolder.name}</span>
              </div>
            </>
          )}

          <ChevronRight size={13} className="breadcrumb-separator" />

          {/* Whiteboard Title */}
          <div className="breadcrumb-item whiteboard">
            {isEditingTitle ? (
              <div className="header-title-edit-wrap">
                <input
                  type="text"
                  autoFocus
                  value={tempTitle}
                  onChange={(e) => setTempTitle(e.target.value)}
                  onBlur={handleSaveTitle}
                  onKeyDown={handleKeyDown}
                  className="header-title-input"
                />
                <button
                  type="button"
                  className="header-title-confirm-btn"
                  onClick={handleSaveTitle}
                >
                  <Check size={13} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="header-title-btn"
                onClick={() => {
                  setTempTitle(whiteboardName);
                  setIsEditingTitle(true);
                }}
                title="Click to rename whiteboard"
              >
                <span className="header-title-text">{whiteboardName}</span>
                <Edit3 size={12} className="header-title-edit-icon" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Right: Actions & Status */}
      <div className="header-right">
        {/* Collaborator Presence Strip */}
        {collaborators.length > 0 && (
          <div className="header-collab-strip">
            {collaborators.slice(0, 5).map((c) => (
              <div
                key={c.authorId}
                className="collab-avatar"
                style={{ backgroundColor: c.color }}
                title={c.name}
              >
                {c.name.charAt(0).toUpperCase()}
              </div>
            ))}
            {collaborators.length > 5 && (
              <div className="collab-avatar overflow">+{collaborators.length - 5}</div>
            )}
          </div>
        )}

        {/* Share Button (for collab rooms) */}
        {roomSlug && onShareRoom && (
          <button type="button" className="header-status-btn share-btn" onClick={onShareRoom} title="Share this board">
            <Share2 size={13} />
            <span>Share</span>
          </button>
        )}

        {/* Teacher Follow-Me Mode */}
        {roomSlug && onTogglePresenterMode && (
          <button
            type="button"
            className={`header-status-btn presenter-btn ${isPresenterMode ? "active" : ""}`}
            onClick={onTogglePresenterMode}
            title={isPresenterMode ? "Broadcasting page navigation to all students" : "Turn on Follow-Me Mode (sync student screens)"}
            style={isPresenterMode ? { background: "rgba(239, 68, 68, 0.2)", borderColor: "#ef4444", color: "#fca5a5" } : undefined}
          >
            <Radio size={13} className={isPresenterMode ? "pulse-icon" : ""} />
            <span>{isPresenterMode ? "Broadcasting (Live)" : "Follow Me"}</span>
          </button>
        )}

        {onAnnotateDocument && (
          <button type="button" className="header-status-btn" onClick={onAnnotateDocument} title="Annotate PDF, DOCX, or PPTX file">
            <FileText size={13} />
            <span>Annotate Doc</span>
          </button>
        )}

        {onOpenOverlay && (
          <button type="button" className="header-status-btn overlay-btn" onClick={onOpenOverlay} title="Toggle Transparent Screen Overlay (Ctrl+Shift+D)">
            <Layers size={13} />
            <span>Screen Overlay</span>
          </button>
        )}

        {/* Connection Status */}
        {roomSlug && (
          <div className={`header-status-pill cloud ${isCollabConnected ? "online" : "offline"}`} title={isCollabConnected ? "Connected to collaboration server" : "Disconnected from server"}>
            {isCollabConnected ? <Wifi size={13} /> : <WifiOff size={13} />}
            <span>{isCollabConnected ? "Live" : "Offline"}</span>
          </div>
        )}

        {!roomSlug && (
          user ? (
            <div className="header-status-pill cloud online" title={`Saved to Graffiti cloud servers (${user.email})`}>
              <Cloud size={13} style={{ color: "#22c55e" }} />
              <span>Saved to Server</span>
            </div>
          ) : (
            <div className="header-status-pill storage" title="All changes are saved locally">
              <HardDrive size={13} />
              <span>Local AppData</span>
            </div>
          )
        )}

        {/* AI Assist */}
        <div className="ai-status-container">
          <button type="button" className="header-status-pill ai-assist" onClick={() => setShowAiPopover((prev) => !prev)} title="AI Features">
            <Bot size={13} />
            <span>AI Assist</span>
          </button>
          {showAiPopover && (
            <div className="ai-info-popover">
              <div className="ai-info-header">
                <Bot size={15} />
                <span>AI & Offline Features</span>
                <button type="button" className="ai-info-close" onClick={() => setShowAiPopover(false)}><X size={14} /></button>
              </div>
              <div className="ai-info-body">
                <p><strong>100% Offline:</strong> Canvas drawing, notebooks, templates, and local exports require no internet.</p>
                <div className="ai-info-divider" />
                <p><strong>AI Features (Groq Llama 3.3 70B & Local Engines):</strong> Mind-Map Auto-Layout, Flowchart-to-Code, Live Executive Briefing, AI Theme Morphing, Flow Simulator, and Voice-to-Canvas Storyboarding.</p>
                {onToggleCircleQuery && (
                  <>
                    <div className="ai-info-divider" />
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                      <div>
                        <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-primary)" }}>Circle to Ask AI</div>
                        <div style={{ fontSize: 9.5, color: "var(--text-muted)" }}>Circle elements with pen to query AI</div>
                      </div>
                      <button
                        type="button"
                        onClick={onToggleCircleQuery}
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: 10,
                          border: "1px solid var(--border-default)",
                          cursor: "pointer",
                          backgroundColor: enableCircleQuery ? "var(--accent-primary)" : "rgba(255, 255, 255, 0.08)",
                          color: enableCircleQuery ? "#ffffff" : "var(--text-muted)",
                          transition: "all 120ms ease",
                        }}
                      >
                        {enableCircleQuery ? "ON" : "OFF"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Avatar */}
        {user && (
          <div className="dashboard-user-menu-wrap">
            <button type="button" className="dashboard-avatar-btn" onClick={() => setShowUserMenu((p) => !p)}>
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="dashboard-avatar-img" />
              ) : (
                <span className="dashboard-avatar-initials">{initials}</span>
              )}
            </button>
            {showUserMenu && (
              <div className="dashboard-user-dropdown">
                <div className="dropdown-user-info">
                  <span className="dropdown-user-name">{user.name || "User"}</span>
                  <span className="dropdown-user-email">{user.email}</span>
                </div>
                <div className="dropdown-divider" />
                {onLogout && (
                  <button type="button" className="dropdown-item" onClick={onLogout}>
                    <LogOut size={14} />
                    <span>Sign Out</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
