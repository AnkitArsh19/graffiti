import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { apiCreateRoom, apiGetMyRooms, apiDeleteRoom } from "../lib/api";
import {
  Plus,
  Pen,
  LogOut,
  User,
  Trash2,
  ExternalLink,
  Users,
  Globe,
  Lock,
  Clock,
} from "lucide-react";

interface RoomItem {
  id: string;
  slug: string;
  name: string;
  isPublic: boolean;
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
  role: string;
  memberCount: number;
}

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const fetchRooms = useCallback(async () => {
    try {
      const data = await apiGetMyRooms();
      setRooms(data);
    } catch (err) {
      console.error("Failed to fetch rooms:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  async function handleCreateRoom() {
    setCreating(true);
    try {
      const room = await apiCreateRoom();
      navigate(`/room/${room.slug}`);
    } catch (err) {
      console.error("Failed to create room:", err);
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteRoom(slug: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm("Delete this room? This cannot be undone.")) return;
    try {
      await apiDeleteRoom(slug);
      setRooms((prev) => prev.filter((r) => r.slug !== slug));
    } catch (err) {
      console.error("Failed to delete room:", err);
    }
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  }

  const initials = user?.name
    ? user.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() || "??";

  return (
    <div className="dashboard-page">
      {/* Top Navigation */}
      <header className="dashboard-header">
        <div className="dashboard-header-left" onClick={() => navigate("/")} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/graffiti-logo-dark.png" alt="Graffiti" style={{ height: 30, width: "auto" }} />
          <span className="dashboard-brand">Graffiti</span>
        </div>
        <div className="dashboard-header-right">
          <button
            type="button"
            className="dashboard-create-btn"
            style={{ background: "rgba(255,255,255,0.08)", color: "inherit" }}
            onClick={() => navigate("/")}
            title="Open offline/local canvas"
          >
            <span>Canvas</span>
          </button>
          <button
            type="button"
            className="dashboard-create-btn"
            onClick={handleCreateRoom}
            disabled={creating}
          >
            <Plus size={16} />
            <span>{creating ? "Creating..." : "New Board"}</span>
          </button>

          <div className="dashboard-user-menu-wrap">
            <button
              type="button"
              className="dashboard-avatar-btn"
              onClick={() => setShowUserMenu((p) => !p)}
            >
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="dashboard-avatar-img" />
              ) : (
                <span className="dashboard-avatar-initials">{initials}</span>
              )}
            </button>
            {showUserMenu && (
              <div className="dashboard-user-dropdown">
                <div className="dropdown-user-info">
                  <span className="dropdown-user-name">{user?.name || "User"}</span>
                  <span className="dropdown-user-email">{user?.email}</span>
                </div>
                <div className="dropdown-divider" />
                <button type="button" className="dropdown-item" onClick={() => { logout(); navigate("/login"); }}>
                  <LogOut size={14} />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-main">
        <div className="dashboard-content">
          <h1 className="dashboard-title">My Boards</h1>

          {loading ? (
            <div className="dashboard-loading">
              <div className="auth-loading-spinner" />
              <p>Loading your boards...</p>
            </div>
          ) : rooms.length === 0 ? (
            <div className="dashboard-empty">
              <Pen size={48} strokeWidth={1} />
              <h2>No boards yet</h2>
              <p>Create your first collaborative whiteboard to get started.</p>
              <button type="button" className="dashboard-create-btn large" onClick={handleCreateRoom}>
                <Plus size={18} />
                <span>Create Your First Board</span>
              </button>
            </div>
          ) : (
            <div className="dashboard-grid">
              {rooms.map((room) => (
                <div
                  key={room.id}
                  className="dashboard-room-card"
                  onClick={() => navigate(`/room/${room.slug}`)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="room-card-preview">
                    <Pen size={24} strokeWidth={1.2} />
                  </div>
                  <div className="room-card-info">
                    <h3 className="room-card-name">{room.name}</h3>
                    <div className="room-card-meta">
                      <span className="room-card-meta-item">
                        <Clock size={12} />
                        {formatDate(room.updatedAt)}
                      </span>
                      <span className="room-card-meta-item">
                        <Users size={12} />
                        {room.memberCount}
                      </span>
                      <span className="room-card-meta-item">
                        {room.isPublic ? <Globe size={12} /> : <Lock size={12} />}
                        {room.isPublic ? "Public" : "Private"}
                      </span>
                    </div>
                  </div>
                  <div className="room-card-actions">
                    <span className={`room-card-role ${room.role.toLowerCase()}`}>{room.role}</span>
                    {room.role === "OWNER" && (
                      <button
                        type="button"
                        className="room-card-delete"
                        onClick={(e) => handleDeleteRoom(room.slug, e)}
                        title="Delete board"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Quick Access: Open local whiteboard */}
      <button
        type="button"
        className="dashboard-local-btn"
        onClick={() => navigate("/local")}
        title="Open offline local whiteboard"
      >
        <Pen size={16} />
        <span>Open Local Board</span>
      </button>
    </div>
  );
}
