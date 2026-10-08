import React, { useEffect, useState } from "react";
import {
  X,
  Copy,
  Check,
  UserPlus,
  Users,
  Shield,
  Trash2,
  Share2,
  Crown,
  Mail,
  Send,
  ExternalLink,
} from "lucide-react";
import {
  apiAddRoomMember,
  apiClaimRoom,
  apiGetRoomMembers,
  apiRemoveRoomMember,
} from "../lib/api";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  slug: string;
  roomName: string;
  isOwner: boolean;
  isLoggedIn: boolean;
  onRoomClaimed?: () => void;
}

interface MemberItem {
  userId: string;
  email: string;
  role: string;
  name?: string;
}

export function ShareModal({
  isOpen,
  onClose,
  slug,
  roomName,
  isOwner,
  isLoggedIn,
  onRoomClaimed,
}: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"EDITOR" | "VIEWER">("EDITOR");
  const [inviting, setInviting] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  const primaryOrigin =
    import.meta.env.VITE_PUBLIC_URL ||
    (typeof window !== "undefined" && window.location.hostname.includes("ankitarsh.me")
      ? window.location.origin
      : "https://graffiti.ankitarsh.me");
  const shareUrl = `${primaryOrigin}/room/${slug}`;

  useEffect(() => {
    if (isOpen && slug) {
      loadMembers();
      setError(null);
      setInviteSuccess(null);
    }
  }, [isOpen, slug]);

  async function loadMembers() {
    setLoadingMembers(true);
    try {
      const data = await apiGetRoomMembers(slug);
      setMembers(data);
    } catch (err) {
      console.error("Failed to load members:", err);
    } finally {
      setLoadingMembers(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleNativeShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `Graffiti: ${roomName}`,
          text: `Collaborate with me on this Graffiti whiteboard: "${roomName}"`,
          url: shareUrl,
        });
      } catch {
        // User cancelled share dialog
      }
    } else {
      handleCopy();
    }
  }

  function handleSendMailApp(targetEmail?: string) {
    const to = targetEmail !== undefined ? targetEmail : inviteEmail.trim();
    const subject = encodeURIComponent(`Collaborate on Graffiti Whiteboard: ${roomName}`);
    const body = encodeURIComponent(
      `Hi,\n\nI'd like to invite you to collaborate with me on this Graffiti whiteboard: "${roomName}".\n\nClick the link below to join directly:\n${shareUrl}\n\nLooking forward to working together!\n`
    );
    window.open(`mailto:${to}?subject=${subject}&body=${body}`, "_blank");
  }

  async function handleInvite(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setError(null);
    setInviteSuccess(null);
    try {
      if (isLoggedIn) {
        await apiAddRoomMember(slug, inviteEmail.trim(), inviteRole);
        setInviteSuccess(`Invitation email sent to ${inviteEmail.trim()}!`);
        setInviteEmail("");
        loadMembers();
      } else {
        handleSendMailApp(inviteEmail.trim());
        setInviteSuccess(`Opening your email client to send invitation to ${inviteEmail.trim()}!`);
      }
    } catch (err: any) {
      setError(err.message || "Failed to invite member. You can use 'Open Mail App' to send directly.");
    } finally {
      setInviting(false);
    }
  }

  async function handleRemoveMember(userId: string) {
    try {
      await apiRemoveRoomMember(slug, userId);
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
    } catch (err: any) {
      setError(err.message || "Failed to remove member");
    }
  }

  async function handleClaim() {
    setClaiming(true);
    setError(null);
    try {
      await apiClaimRoom(slug);
      onRoomClaimed?.();
      loadMembers();
    } catch (err: any) {
      setError(err.message || "Failed to claim room");
    } finally {
      setClaiming(false);
    }
  }

  if (!isOpen) return null;

  const canNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        className="modal-card share-modal"
        role="dialog"
        aria-label="Share Room"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 500,
          maxWidth: "94vw",
          background: "var(--bg-panel, #18181b)",
          borderRadius: 14,
          border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))",
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.6)",
          color: "var(--text-primary, #f4f4f5)",
          overflow: "hidden",
        }}
      >
        <div
          className="modal-header"
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
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--accent-primary)",
              }}
            >
              <Share2 size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Share Whiteboard</h3>
              <p style={{ margin: 0, fontSize: 12, opacity: 0.6 }}>{roomName}</p>
            </div>
          </div>
          <button
            type="button"
            className="icon-action-btn"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent",
              border: "none",
              color: "inherit",
              cursor: "pointer",
              padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: "20px" }}>
          {error && (
            <div
              style={{
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "var(--color-danger)",
                padding: "8px 12px",
                borderRadius: 8,
                marginBottom: 16,
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          {inviteSuccess && (
            <div
              style={{
                background: "rgba(34, 197, 94, 0.15)",
                border: "1px solid rgba(34, 197, 94, 0.3)",
                color: "var(--color-success)",
                padding: "8px 12px",
                borderRadius: 8,
                marginBottom: 16,
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Check size={16} />
              <span>{inviteSuccess}</span>
            </div>
          )}

          {/* Section 1: Direct Share Link */}
          <div
            style={{
              marginBottom: 18,
              padding: "14px",
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))",
              borderRadius: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Option 1: Share Link
              </label>
              <span style={{ fontSize: 11, color: "var(--color-success)", fontWeight: 500 }}>
                Anyone with link can join
              </span>
            </div>
            <div
              style={{
                display: "flex",
                gap: 8,
                background: "var(--bg-input, rgba(0,0,0,0.3))",
                padding: "6px 8px 6px 12px",
                borderRadius: 8,
                border: "1px solid var(--border-subtle, rgba(255,255,255,0.1))",
                alignItems: "center",
              }}
            >
              <input
                readOnly
                value={shareUrl}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "inherit",
                  flex: 1,
                  fontSize: 13,
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={handleCopy}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 6,
                  background: copied ? "var(--color-success)" : "var(--accent-primary)",
                  color: copied ? "#ffffff" : "var(--accent-text)",
                  border: "none",
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: "pointer",
                  transition: "background 0.2s",
                  flexShrink: 0,
                }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied ? "Copied!" : "Copy Link"}</span>
              </button>
              {canNativeShare && (
                <button
                  type="button"
                  onClick={handleNativeShare}
                  title="Share via installed apps"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "6px 10px",
                    borderRadius: 6,
                    background: "rgba(255, 255, 255, 0.08)",
                    color: "inherit",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    fontWeight: 500,
                    fontSize: 12,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  <Share2 size={13} />
                  <span>Share</span>
                </button>
              )}
            </div>
          </div>

          {/* Section 2: Send Mail Directly */}
          <div
            style={{
              marginBottom: 18,
              padding: "14px",
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))",
              borderRadius: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Option 2: Send by Mail
              </label>
              <button
                type="button"
                onClick={() => handleSendMailApp()}
                title="Open your email client with link pre-filled"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  background: "transparent",
                  border: "none",
                  color: "var(--accent-primary)",
                  fontSize: 12,
                  cursor: "pointer",
                  fontWeight: 500,
                  padding: 0,
                }}
              >
                <Mail size={12} />
                <span>Open in Mail App</span>
              </button>
            </div>

            <form onSubmit={handleInvite} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="email"
                  placeholder="collaborator@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  style={{
                    flex: 1,
                    background: "var(--bg-input, rgba(0,0,0,0.3))",
                    border: "1px solid var(--border-subtle, rgba(255,255,255,0.1))",
                    borderRadius: 8,
                    padding: "8px 12px",
                    color: "inherit",
                    fontSize: 13,
                    outline: "none",
                  }}
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  style={{
                    background: "var(--bg-input, rgba(0,0,0,0.3))",
                    border: "1px solid var(--border-subtle, rgba(255,255,255,0.1))",
                    borderRadius: 8,
                    padding: "8px 10px",
                    color: "inherit",
                    fontSize: 13,
                    outline: "none",
                  }}
                >
                  <option value="EDITOR">Editor</option>
                  <option value="VIEWER">Viewer</option>
                </select>
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 2 }}>
                <button
                  type="button"
                  onClick={() => handleSendMailApp(inviteEmail.trim())}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 12px",
                    borderRadius: 7,
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    color: "inherit",
                    fontWeight: 500,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  <Mail size={13} />
                  <span>Draft in Email App</span>
                </button>
                <button
                  type="submit"
                  disabled={inviting || !inviteEmail.trim()}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 14px",
                    borderRadius: 7,
                    background: "var(--accent-primary)",
                    color: "var(--accent-text)",
                    border: "none",
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: "pointer",
                    opacity: !inviteEmail.trim() ? 0.6 : 1,
                  }}
                >
                  <Send size={13} />
                  <span>{inviting ? "Sending..." : "Send Invite"}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Claim Ownership if unowned and logged in */}
          {isLoggedIn && !isOwner && (
            <div
              style={{
                marginBottom: 18,
                padding: 12,
                borderRadius: 8,
                background: "rgba(245, 158, 11, 0.1)",
                border: "1px solid rgba(245, 158, 11, 0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Crown size={18} color="var(--accent-primary)" />
                <span style={{ fontSize: 13, color: "var(--accent-primary)", fontWeight: 500 }}>Claim ownership of this room</span>
              </div>
              <button
                type="button"
                onClick={handleClaim}
                disabled={claiming}
                style={{
                  padding: "5px 12px",
                  borderRadius: 6,
                  background: "var(--accent-primary)",
                  color: "var(--accent-text)",
                  fontWeight: 600,
                  fontSize: 12,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {claiming ? "Claiming..." : "Claim"}
              </button>
            </div>
          )}

          {/* Members List */}
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 500, opacity: 0.8 }}>
                Room Collaborators ({members.length})
              </span>
            </div>

            <div
              style={{
                maxHeight: 180,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {loadingMembers ? (
                <div style={{ textAlign: "center", padding: 12, opacity: 0.5, fontSize: 13 }}>
                  Loading members...
                </div>
              ) : members.length === 0 ? (
                <div style={{ textAlign: "center", padding: 12, opacity: 0.5, fontSize: 13 }}>
                  No extra members yet. Anyone with the link can join!
                </div>
              ) : (
                members.map((m) => (
                  <div
                    key={m.userId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      borderRadius: 8,
                      background: "rgba(255, 255, 255, 0.03)",
                      fontSize: 13,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: "50%",
                          background: "var(--accent-primary)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 11,
                          fontWeight: 600,
                          color: "var(--accent-text)",
                        }}
                      >
                        {m.email ? m.email.slice(0, 2).toUpperCase() : "U"}
                      </div>
                      <span>{m.email}</span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          background:
                            m.role === "OWNER"
                              ? "var(--accent-subtle)"
                              : m.role === "EDITOR"
                              ? "var(--accent-subtle)"
                              : "rgba(107, 114, 128, 0.15)",
                          color:
                            m.role === "OWNER"
                              ? "var(--accent-primary)"
                              : m.role === "EDITOR"
                              ? "var(--accent-primary)"
                              : "var(--text-muted)",
                        }}
                      >
                        {m.role}
                      </span>
                      {isOwner && m.role !== "OWNER" && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(m.userId)}
                          title="Remove member"
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#ef4444",
                            cursor: "pointer",
                            padding: 2,
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}