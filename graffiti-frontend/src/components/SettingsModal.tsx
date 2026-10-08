import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Settings,
  Keyboard,
  Mouse,
  RotateCcw,
  Sparkles,
  Layers,
  FileText,
  Palette,
  Compass,
  Check,
} from "lucide-react";
import { useShortcuts, type ShortcutCategory } from "../contexts/ShortcutsContext";

const CATEGORY_TABS: Array<{ id: ShortcutCategory; label: string; icon: React.ReactNode }> = [
  { id: "whiteboard", label: "Whiteboard", icon: <Palette size={16} /> },
  { id: "overlay", label: "Desktop Overlay", icon: <Layers size={16} /> },
  { id: "document", label: "Document Annotation", icon: <FileText size={16} /> },
  { id: "general", label: "General & Navigation", icon: <Compass size={16} /> },
];

export function SettingsModal() {
  const {
    shortcuts,
    updateShortcut,
    resetCategory,
    resetAll,
    isSettingsOpen,
    activeSettingsCategory,
    setActiveSettingsCategory,
    closeSettings,
  } = useShortcuts();

  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [justSavedId, setJustSavedId] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);

  // Filter shortcuts for the active category
  const categoryShortcuts = Object.values(shortcuts).filter(
    (s) => s.category === activeSettingsCategory
  );

  // Handle keyboard recording
  useEffect(() => {
    if (!recordingId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Escape cancels recording
      if (e.key === "Escape") {
        setRecordingId(null);
        return;
      }

      // Build modifier string
      const parts: string[] = [];
      if (e.ctrlKey) parts.push("Ctrl");
      if (e.metaKey) parts.push("Meta");
      if (e.altKey) parts.push("Alt");
      if (e.shiftKey && e.key !== "Shift") parts.push("Shift");

      let keyName = e.key;
      if (keyName === " ") keyName = "Space";
      if (keyName.length === 1) keyName = keyName.toUpperCase();

      if (!["Control", "Alt", "Shift", "Meta"].includes(e.key)) {
        if (!parts.includes(keyName)) {
          parts.push(keyName);
        }
      }

      const finalKey = parts.join("+");
      if (finalKey) {
        updateShortcut(recordingId, finalKey, false);
        setJustSavedId(recordingId);
        setTimeout(() => setJustSavedId(null), 1200);
        setRecordingId(null);
      }
    };

    // Handle mouse button recording (including extra buttons for multi-button mice)
    const handleMouseDown = (e: MouseEvent) => {
      // Prevent left-click on the button itself from immediately assigning Left Click
      // unless user clicks again or it's a non-primary mouse button
      e.preventDefault();
      e.stopPropagation();

      let mouseLabel = `Mouse ${e.button + 1}`;
      if (e.button === 0) mouseLabel = "Mouse Left";
      else if (e.button === 1) mouseLabel = "Mouse Middle";
      else if (e.button === 2) mouseLabel = "Mouse Right";
      else if (e.button === 3) mouseLabel = "Mouse 4 (Back)";
      else if (e.button === 4) mouseLabel = "Mouse 5 (Forward)";

      updateShortcut(recordingId, mouseLabel, true, e.button);
      setJustSavedId(recordingId);
      setTimeout(() => setJustSavedId(null), 1200);
      setRecordingId(null);
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    window.addEventListener("mousedown", handleMouseDown, { capture: true });

    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      window.removeEventListener("mousedown", handleMouseDown, { capture: true });
    };
  }, [recordingId, updateShortcut]);

  if (!isSettingsOpen) return null;

  return (
    <div className="modal-backdrop" onClick={closeSettings}>
      <div
        className="modal-card settings-modal-card"
        role="dialog"
        aria-label="Settings and Controls"
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
      >
        {/* Modal Header */}
        <div className="settings-modal-header">
          <div className="settings-header-title">
            <Settings size={20} className="settings-header-icon" />
            <div>
              <h3>Settings & Shortcuts</h3>
              <p>Customize keyboard and multi-button mouse controls</p>
            </div>
          </div>
          <button
            type="button"
            className="settings-close-btn"
            onClick={closeSettings}
            aria-label="Close settings"
          >
            <X size={18} />
          </button>
        </div>

        {/* Category Navigation Tabs */}
        <div className="settings-tabs-bar">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`settings-tab-btn ${activeSettingsCategory === tab.id ? "active" : ""}`}
              onClick={() => {
                setActiveSettingsCategory(tab.id);
                setRecordingId(null);
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Shortcut Controls List */}
        <div className="settings-modal-body">
          <div className="settings-list">
            {categoryShortcuts.map((item) => {
              const isRecording = recordingId === item.id;
              const isSaved = justSavedId === item.id;

              return (
                <div key={item.id} className="settings-row">
                  <div className="settings-info">
                    <span className="settings-label">{item.label}</span>
                    <span className="settings-desc">{item.description}</span>
                  </div>

                  <div className="settings-actions">
                    <button
                      type="button"
                      className={`settings-key-btn ${isRecording ? "recording" : ""} ${isSaved ? "saved" : ""}`}
                      onClick={() => setRecordingId(isRecording ? null : item.id)}
                      title="Click to rebind with any key or mouse button"
                    >
                      {isRecording ? (
                        <span className="recording-text">Press key or mouse...</span>
                      ) : isSaved ? (
                        <span className="saved-text">
                          <Check size={12} /> Saved
                        </span>
                      ) : (
                        <span className="key-badge">
                          {item.isMouse ? <Mouse size={12} /> : <Keyboard size={12} />}
                          {item.key}
                        </span>
                      )}
                    </button>

                    {item.key !== item.defaultKey && (
                      <button
                        type="button"
                        className="settings-reset-single-btn"
                        onClick={() => updateShortcut(item.id, item.defaultKey, false)}
                        title={`Reset to default (${item.defaultKey})`}
                      >
                        <RotateCcw size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="settings-modal-footer">
          <div className="settings-footer-hint">
            <Mouse size={13} style={{ color: "var(--accent-primary)", flexShrink: 0 }} />
            <span>Supports gaming mouse buttons (Mouse 4, 5+), letters, and combinations.</span>
          </div>

          <div className="settings-footer-btns">
            <button
              type="button"
              className="settings-btn-secondary"
              onClick={() => resetCategory(activeSettingsCategory)}
            >
              <RotateCcw size={13} />
              <span>Reset {CATEGORY_TABS.find((t) => t.id === activeSettingsCategory)?.label}</span>
            </button>
            <button
              type="button"
              className="settings-btn-primary"
              onClick={closeSettings}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
