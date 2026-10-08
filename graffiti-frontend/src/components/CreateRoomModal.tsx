import React, { useState } from "react";
import { X, Layers, PlusCircle, Check, Share2, Sparkles } from "lucide-react";

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBoardName: string;
  pageCount: number;
  elementCount: number;
  onConfirm: (option: "current" | "new") => Promise<void> | void;
}

export function CreateRoomModal({
  isOpen,
  onClose,
  currentBoardName,
  pageCount,
  elementCount,
  onConfirm,
}: CreateRoomModalProps) {
  const [selectedOption, setSelectedOption] = useState<"current" | "new">("current");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleStart = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(selectedOption);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        style={{ width: "460px", maxWidth: "94vw" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="move-modal-header" style={{ padding: "16px 20px" }}>
          <div className="move-modal-title" style={{ gap: "10px" }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                background: "rgba(212, 163, 89, 0.15)",
                color: "var(--accent-primary, #d4a359)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Share2 size={16} />
            </div>
            <span>Start Collaborative Session</span>
          </div>
          <button
            type="button"
            className="move-modal-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: "14px" }}>
          <p style={{ margin: 0, fontSize: "12.5px", color: "var(--text-muted)", lineHeight: 1.5 }}>
            Invite members to draw and edit together in real-time. Choose how you would like to begin:
          </p>

          {/* Option: Current Whiteboard */}
          <div
            onClick={() => setSelectedOption("current")}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "14px",
              padding: "14px 16px",
              borderRadius: "10px",
              border: `1.5px solid ${
                selectedOption === "current"
                  ? "var(--accent-primary, #d4a359)"
                  : "var(--border-default, rgba(255, 255, 255, 0.1))"
              }`,
              background:
                selectedOption === "current"
                  ? "rgba(212, 163, 89, 0.08)"
                  : "var(--bg-subtle, rgba(255, 255, 255, 0.02))",
              cursor: "pointer",
              transition: "all 120ms ease",
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "8px",
                background:
                  selectedOption === "current"
                    ? "var(--accent-primary, #d4a359)"
                    : "rgba(255, 255, 255, 0.06)",
                color: selectedOption === "current" ? "#121214" : "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                marginTop: 2,
              }}
            >
              <Layers size={18} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span
                  style={{
                    fontSize: "13.5px",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                  }}
                >
                  Current Whiteboard
                </span>
                {selectedOption === "current" && (
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "var(--accent-primary, #d4a359)",
                    }}
                  >
                    <Check size={13} /> Selected
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--accent-primary, #d4a359)",
                  fontWeight: 500,
                  marginTop: 2,
                }}
              >
                &ldquo;{currentBoardName || "Untitled Board"}&rdquo;
              </div>
              <div style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: 4, lineHeight: 1.4 }}>
                All current drawings, notes, and <strong>{pageCount} page(s)</strong> ({elementCount} element{elementCount === 1 ? "" : "s"}) will carry into the room for any member who joins.
              </div>
            </div>
          </div>

          {/* Option: New Blank Board */}
          <div
            onClick={() => setSelectedOption("new")}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "14px",
              padding: "14px 16px",
              borderRadius: "10px",
              border: `1.5px solid ${
                selectedOption === "new"
                  ? "var(--accent-primary, #d4a359)"
                  : "var(--border-default, rgba(255, 255, 255, 0.1))"
              }`,
              background:
                selectedOption === "new"
                  ? "rgba(212, 163, 89, 0.08)"
                  : "var(--bg-subtle, rgba(255, 255, 255, 0.02))",
              cursor: "pointer",
              transition: "all 120ms ease",
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "8px",
                background:
                  selectedOption === "new"
                    ? "var(--accent-primary, #d4a359)"
                    : "rgba(255, 255, 255, 0.06)",
                color: selectedOption === "new" ? "#121214" : "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                marginTop: 2,
              }}
            >
              <PlusCircle size={18} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span
                  style={{
                    fontSize: "13.5px",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                  }}
                >
                  New Blank Board
                </span>
                {selectedOption === "new" && (
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "var(--accent-primary, #d4a359)",
                    }}
                  >
                    <Check size={13} /> Selected
                  </span>
                )}
              </div>
              <div style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: 4, lineHeight: 1.4 }}>
                Start a fresh canvas. Your existing whiteboard and drawings remain safe and unchanged in your workspace.
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "10px",
            padding: "14px 20px",
            borderTop: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))",
            background: "rgba(0, 0, 0, 0.15)",
          }}
        >
          <button
            type="button"
            className="dropdown-item-btn"
            style={{
              padding: "7px 14px",
              borderRadius: "7px",
              fontSize: "12.5px",
              fontWeight: 500,
              width: "auto",
              cursor: "pointer",
            }}
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "7px",
              padding: "8px 16px",
              borderRadius: "7px",
              fontSize: "12.5px",
              fontWeight: 600,
              color: "#121214",
              background: "var(--accent-primary, #d4a359)",
              border: "none",
              cursor: isSubmitting ? "not-allowed" : "pointer",
              opacity: isSubmitting ? 0.7 : 1,
              transition: "transform 80ms ease, filter 80ms ease",
            }}
            onClick={handleStart}
            disabled={isSubmitting}
          >
            <Sparkles size={14} />
            <span>{isSubmitting ? "Creating Room..." : "Create & Start Session"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
