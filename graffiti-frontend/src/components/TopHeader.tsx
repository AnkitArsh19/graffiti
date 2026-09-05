import React, { useState } from "react";
import {
  PanelLeft,
  ChevronRight,
  HardDrive,
  Cloud,
  Sparkles,
  Edit3,
  Check,
  X,
  Layers,
  Folder as FolderIcon,
  Info,
} from "lucide-react";
import { Folder, Workspace } from "../storage/types";

interface TopHeaderProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  activeWorkspace?: Workspace;
  activeFolder?: Folder | null;
  whiteboardName: string;
  onRenameWhiteboard: (name: string) => void;
  isOnline: boolean;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  isSidebarOpen,
  onToggleSidebar,
  activeWorkspace,
  activeFolder,
  whiteboardName,
  onRenameWhiteboard,
  isOnline,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(whiteboardName);
  const [showAiPopover, setShowAiPopover] = useState(false);

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
                  color={activeFolder.color || "#4dabf7"}
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

      {/* Right: Storage & Connectivity Status */}
      <div className="header-right">
        {/* Local Storage Indicator */}
        <div
          className="header-status-pill storage"
          title="All changes are saved automatically to your device's local AppData"
        >
          <HardDrive size={13} />
          <span>Local AppData</span>
        </div>

        {/* Cloud Status */}
        <div
          className={`header-status-pill cloud ${isOnline ? "online" : "offline"}`}
          title={
            isOnline
              ? "Online: Collaborative sync ready"
              : "Offline: Zero cloud dependency, drawings remain private on your computer"
          }
        >
          <Cloud size={13} />
          <span>{isOnline ? "Cloud Sync Ready" : "Offline Mode"}</span>
        </div>

        {/* AI Assist Gating Info */}
        <div className="ai-status-container">
          <button
            type="button"
            className="header-status-pill ai-assist"
            onClick={() => setShowAiPopover((prev) => !prev)}
            title="AI Features & Offline Availability"
          >
            <Sparkles size={13} />
            <span>AI Assist</span>
          </button>

          {showAiPopover && (
            <div className="ai-info-popover">
              <div className="ai-info-header">
                <Sparkles size={15} />
                <span>AI & Offline Features</span>
                <button
                  type="button"
                  className="ai-info-close"
                  onClick={() => setShowAiPopover(false)}
                >
                  <X size={14} />
                </button>
              </div>
              <div className="ai-info-body">
                <p>
                  <strong>100% Offline:</strong> Infinite canvas, rough shapes, freehand drawing,
                  sticky notes, multi-page notebooks, templates, and local exports require no
                  internet.
                </p>
                <div className="ai-info-divider" />
                <p>
                  <strong>Internet Required:</strong> Handwritten Math Solver (<code>=</code>),
                  Canvas OCR Search (<code>Ctrl+F</code>), Circle-to-Edit, and Diagram Synthesis
                  connect to the AI microservice when online.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
