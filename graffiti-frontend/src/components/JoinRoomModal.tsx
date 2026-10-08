import React, { useState, useEffect, useRef } from "react";
import { LogIn, X, Clipboard, ArrowRight, Sparkles } from "lucide-react";

interface JoinRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoin: (roomCode: string) => void;
}

export const JoinRoomModal: React.FC<JoinRoomModalProps> = ({ isOpen, onClose, onJoin }) => {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setCode("");
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const extractCode = (input: string): string => {
    let clean = input.trim();
    // Handle full URL pasted e.g. https://.../room/29acabd8 or /room/29acabd8
    if (clean.includes("/room/")) {
      clean = clean.split("/room/")[1].split("/")[0].split("?")[0].split("#")[0];
    }
    // Remove any trailing or leading slashes or query params
    return clean.replace(/[^a-zA-Z0-9_-]/g, "");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = extractCode(code);
    if (!clean || clean.length < 3) {
      setError("Please enter a valid room code or room URL.");
      return;
    }
    setError(null);
    onJoin(clean);
    onClose();
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const clean = extractCode(text);
        setCode(clean);
        setError(null);
      }
    } catch {
      // Fallback if clipboard permission denied
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        animation: "fadeIn 0.15s ease-out",
      }}
    >
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="join-room-title"
        style={{
          background: "var(--bg-panel, #18181b)",
          border: "1px solid var(--border-default, rgba(255, 255, 255, 0.12))",
          borderRadius: 16,
          width: "100%",
          maxWidth: 440,
          padding: 24,
          boxShadow: "0 20px 40px -10px rgba(0, 0, 0, 0.5), 0 0 15px rgba(212, 163, 89, 0.1)",
          color: "var(--text-primary, #ffffff)",
          position: "relative",
        }}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 18,
            right: 18,
            background: "transparent",
            border: "none",
            color: "var(--text-secondary, #a1a1aa)",
            cursor: "pointer",
            padding: 4,
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "rgba(212, 163, 89, 0.15)",
              border: "1px solid rgba(212, 163, 89, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--accent-primary, #d4a359)",
            }}
          >
            <LogIn size={20} />
          </div>
          <div>
            <h2 id="join-room-title" style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>
              Join Collaborative Room
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-secondary, #a1a1aa)" }}>
              Enter a room code or paste an invite link to collaborate live.
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label
              htmlFor="room-code-input"
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 6,
                color: "var(--text-muted, #a1a1aa)",
              }}
            >
              Room Code or Link
            </label>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <input
                id="room-code-input"
                ref={inputRef}
                type="text"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="e.g. 29acabd8 or https://.../room/29acabd8"
                style={{
                  width: "100%",
                  padding: "10px 42px 10px 12px",
                  fontSize: 14,
                  fontFamily: "monospace",
                  background: "var(--bg-input, rgba(0, 0, 0, 0.3))",
                  border: error
                    ? "1px solid #ef4444"
                    : "1px solid var(--border-default, rgba(255, 255, 255, 0.15))",
                  borderRadius: 8,
                  color: "inherit",
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={handlePaste}
                title="Paste from clipboard"
                style={{
                  position: "absolute",
                  right: 8,
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "none",
                  borderRadius: 6,
                  padding: "5px 7px",
                  color: "var(--text-secondary, #a1a1aa)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Clipboard size={14} />
              </button>
            </div>
            {error && (
              <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>{error}</div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              borderRadius: 8,
              background: "rgba(212, 163, 89, 0.06)",
              border: "1px solid rgba(212, 163, 89, 0.15)",
              fontSize: 12,
              color: "var(--text-secondary, #d4a359)",
            }}
          >
            <Sparkles size={14} style={{ flexShrink: 0 }} />
            <span>Real-time drawing, pen strokes, and cursors sync automatically.</span>
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                background: "transparent",
                border: "1px solid var(--border-default, rgba(255, 255, 255, 0.12))",
                color: "inherit",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!code.trim()}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                borderRadius: 8,
                background: "var(--accent-primary, #d4a359)",
                border: "none",
                color: "var(--accent-text, #18181b)",
                fontSize: 13,
                fontWeight: 600,
                cursor: code.trim() ? "pointer" : "not-allowed",
                opacity: code.trim() ? 1 : 0.5,
                transition: "all 0.15s ease",
              }}
            >
              <span>Join Room</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
