import React, { useState, useMemo } from "react";
import {
  Folder as FolderIcon,
  FolderOpen,
  FolderPlus,
  FileText,
  FilePlus,
  ChevronRight,
  ChevronDown,
  Search,
  MoreHorizontal,
  Edit3,
  Trash2,
  FolderInput,
  Layers,
  HardDrive,
  Check,
  X,
  Plus,
} from "lucide-react";
import { Folder, WhiteboardSummary, Workspace } from "../storage/types";

interface WorkspaceSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  workspaces: Workspace[];
  activeWorkspaceId: string;
  onSelectWorkspace: (id: string) => void;
  onCreateWorkspace: (name: string) => void;
  onDeleteWorkspace: (id: string) => void;
  folders: Folder[];
  onCreateFolder: (name: string, parentFolderId?: string | null) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  whiteboards: WhiteboardSummary[];
  activeWhiteboardId: string;
  onSelectWhiteboard: (id: string) => void;
  onCreateWhiteboard: (folderId?: string | null) => void;
  onRenameWhiteboard: (id: string, name: string) => void;
  onDeleteWhiteboard: (id: string) => void;
  onOpenMoveModal: (whiteboardId: string) => void;
}

const FOLDER_COLORS = [
  "#4dabf7", // blue
  "#51cf66", // green
  "#fcc419", // yellow
  "#ff922b", // orange
  "#ff6b6b", // red
  "#cc5de8", // grape
  "#845ef7", // violet
  "#20c997", // teal
];

export const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({
  isOpen,
  onClose,
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onCreateWorkspace,
  folders,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  whiteboards,
  activeWhiteboardId,
  onSelectWhiteboard,
  onCreateWhiteboard,
  onRenameWhiteboard,
  onDeleteWhiteboard,
  onOpenMoveModal,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isWorkspaceDropdownOpen, setIsWorkspaceDropdownOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);

  // Folder collapse states
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});

  // Inline editing state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemType, setEditingItemType] = useState<"folder" | "whiteboard" | null>(null);
  const [editingName, setEditingName] = useState("");

  // Context menu popovers
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const activeWorkspace = useMemo(
    () => workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0],
    [workspaces, activeWorkspaceId]
  );

  const toggleFolderCollapse = (folderId: string) => {
    setCollapsedFolders((prev) => ({
      ...prev,
      [folderId]: !prev[folderId],
    }));
  };

  const filteredWhiteboards = useMemo(() => {
    if (!searchQuery.trim()) return whiteboards;
    const q = searchQuery.toLowerCase();
    return whiteboards.filter((b) => b.name.toLowerCase().includes(q));
  }, [whiteboards, searchQuery]);

  const filteredFolders = useMemo(() => {
    if (!searchQuery.trim()) return folders;
    const q = searchQuery.toLowerCase();
    return folders.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        filteredWhiteboards.some((b) => b.folderId === f.id)
    );
  }, [folders, searchQuery, filteredWhiteboards]);

  // Root whiteboards (not in any folder)
  const rootWhiteboards = useMemo(
    () => filteredWhiteboards.filter((b) => !b.folderId),
    [filteredWhiteboards]
  );

  // Folder children mapping
  const getWhiteboardsForFolder = (folderId: string) => {
    return filteredWhiteboards.filter((b) => b.folderId === folderId);
  };

  const handleStartRename = (
    id: string,
    type: "folder" | "whiteboard",
    currentName: string
  ) => {
    setEditingItemId(id);
    setEditingItemType(type);
    setEditingName(currentName);
    setActiveMenuId(null);
  };

  const handleSaveRename = () => {
    if (!editingItemId || !editingName.trim()) {
      setEditingItemId(null);
      setEditingItemType(null);
      return;
    }
    if (editingItemType === "folder") {
      onRenameFolder(editingItemId, editingName.trim());
    } else if (editingItemType === "whiteboard") {
      onRenameWhiteboard(editingItemId, editingName.trim());
    }
    setEditingItemId(null);
    setEditingItemType(null);
  };

  const handleKeyDownRename = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveRename();
    } else if (e.key === "Escape") {
      setEditingItemId(null);
      setEditingItemType(null);
    }
  };

  const handleCreateWorkspaceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newWorkspaceName.trim()) {
      onCreateWorkspace(newWorkspaceName.trim());
      setNewWorkspaceName("");
      setIsCreatingWorkspace(false);
      setIsWorkspaceDropdownOpen(false);
    }
  };

  if (!isOpen) return null;

  return (
    <aside className="workspace-sidebar">
      {/* Sidebar Top: Workspace Switcher */}
      <div className="sidebar-header">
        <div className="workspace-selector-container">
          <button
            type="button"
            className="workspace-selector-btn"
            onClick={() => setIsWorkspaceDropdownOpen((prev) => !prev)}
            title="Switch Workspace"
          >
            <div className="workspace-avatar" style={{ backgroundColor: activeWorkspace?.color || "#4dabf7" }}>
              <Layers size={14} color="#ffffff" />
            </div>
            <span className="workspace-title">{activeWorkspace?.name || "Workspace"}</span>
            <ChevronDown size={14} className="workspace-dropdown-icon" />
          </button>

          <button
            type="button"
            className="sidebar-close-btn"
            onClick={onClose}
            title="Close sidebar (Ctrl+B)"
          >
            <X size={16} />
          </button>
        </div>

        {/* Workspace Dropdown */}
        {isWorkspaceDropdownOpen && (
          <div className="workspace-dropdown-menu">
            <div className="dropdown-section-title">WORKSPACES</div>
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                type="button"
                className={`workspace-dropdown-item ${ws.id === activeWorkspaceId ? "active" : ""}`}
                onClick={() => {
                  onSelectWorkspace(ws.id);
                  setIsWorkspaceDropdownOpen(false);
                }}
              >
                <div className="workspace-avatar-small" style={{ backgroundColor: ws.color || "#4dabf7" }}>
                  <Layers size={12} color="#ffffff" />
                </div>
                <span className="dropdown-item-name">{ws.name}</span>
                {ws.id === activeWorkspaceId && <Check size={14} className="check-icon" />}
              </button>
            ))}

            <div className="dropdown-divider" />

            {isCreatingWorkspace ? (
              <form onSubmit={handleCreateWorkspaceSubmit} className="create-workspace-form">
                <input
                  type="text"
                  autoFocus
                  placeholder="Workspace name"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  className="create-workspace-input"
                />
                <div className="form-actions">
                  <button type="submit" className="form-btn submit">
                    <Check size={14} />
                  </button>
                  <button
                    type="button"
                    className="form-btn cancel"
                    onClick={() => setIsCreatingWorkspace(false)}
                  >
                    <X size={14} />
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                className="add-workspace-btn"
                onClick={() => setIsCreatingWorkspace(true)}
              >
                <Plus size={14} />
                <span>New Workspace</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Quick Action Buttons */}
      <div className="sidebar-actions">
        <button
          type="button"
          className="sidebar-action-btn primary"
          onClick={() => onCreateWhiteboard(null)}
          title="New Whiteboard"
        >
          <FilePlus size={14} />
          <span>New Board</span>
        </button>
        <button
          type="button"
          className="sidebar-action-btn secondary"
          onClick={() => onCreateFolder("New Folder", null)}
          title="New Folder"
        >
          <FolderPlus size={14} />
          <span>New Folder</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="sidebar-search">
        <Search size={14} className="search-icon" />
        <input
          type="text"
          placeholder="Filter boards & folders..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="sidebar-search-input"
        />
        {searchQuery && (
          <button
            type="button"
            className="clear-search-btn"
            onClick={() => setSearchQuery("")}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Folder Tree & Whiteboard List */}
      <div className="sidebar-tree">
        {/* Folders */}
        {filteredFolders.map((folder) => {
          const isCollapsed = collapsedFolders[folder.id];
          const folderBoards = getWhiteboardsForFolder(folder.id);
          const isMenuOpen = activeMenuId === `folder-${folder.id}`;

          return (
            <div key={folder.id} className="folder-tree-node">
              <div className="folder-item-header">
                <button
                  type="button"
                  className="folder-toggle-btn"
                  onClick={() => toggleFolderCollapse(folder.id)}
                  title={isCollapsed ? "Expand folder" : "Collapse folder"}
                >
                  {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </button>

                <div
                  className="folder-icon-wrapper"
                  onClick={() => toggleFolderCollapse(folder.id)}
                >
                  {isCollapsed ? (
                    <FolderIcon size={16} color={folder.color || "#4dabf7"} />
                  ) : (
                    <FolderOpen size={16} color={folder.color || "#4dabf7"} />
                  )}
                </div>

                {editingItemId === folder.id && editingItemType === "folder" ? (
                  <input
                    type="text"
                    autoFocus
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={handleSaveRename}
                    onKeyDown={handleKeyDownRename}
                    className="inline-rename-input"
                  />
                ) : (
                  <span
                    className="folder-name"
                    onClick={() => toggleFolderCollapse(folder.id)}
                  >
                    {folder.name}
                  </span>
                )}

                <span className="folder-count-badge">{folderBoards.length}</span>

                <div className="item-menu-container">
                  <button
                    type="button"
                    className="item-menu-trigger"
                    onClick={() => setActiveMenuId(isMenuOpen ? null : `folder-${folder.id}`)}
                  >
                    <MoreHorizontal size={14} />
                  </button>

                  {isMenuOpen && (
                    <div className="item-popover-menu">
                      <button
                        type="button"
                        onClick={() => {
                          onCreateWhiteboard(folder.id);
                          setActiveMenuId(null);
                        }}
                      >
                        <FilePlus size={13} />
                        <span>Add Board</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStartRename(folder.id, "folder", folder.name)}
                      >
                        <Edit3 size={13} />
                        <span>Rename</span>
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => {
                          onDeleteFolder(folder.id);
                          setActiveMenuId(null);
                        }}
                      >
                        <Trash2 size={13} />
                        <span>Delete</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Whiteboards inside folder */}
              {!isCollapsed && (
                <div className="folder-children">
                  {folderBoards.map((board) => {
                    const isSelected = board.id === activeWhiteboardId;
                    const isBoardMenuOpen = activeMenuId === `board-${board.id}`;

                    return (
                      <div
                        key={board.id}
                        className={`whiteboard-tree-item ${isSelected ? "active" : ""}`}
                      >
                        <button
                          type="button"
                          className="whiteboard-click-area"
                          onClick={() => onSelectWhiteboard(board.id)}
                        >
                          <FileText size={14} className="whiteboard-icon" />
                          {editingItemId === board.id && editingItemType === "whiteboard" ? (
                            <input
                              type="text"
                              autoFocus
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onBlur={handleSaveRename}
                              onKeyDown={handleKeyDownRename}
                              className="inline-rename-input"
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <span className="whiteboard-name">{board.name}</span>
                          )}
                        </button>

                        <div className="item-menu-container">
                          <button
                            type="button"
                            className="item-menu-trigger"
                            onClick={() =>
                              setActiveMenuId(isBoardMenuOpen ? null : `board-${board.id}`)
                            }
                          >
                            <MoreHorizontal size={13} />
                          </button>

                          {isBoardMenuOpen && (
                            <div className="item-popover-menu">
                              <button
                                type="button"
                                onClick={() => handleStartRename(board.id, "whiteboard", board.name)}
                              >
                                <Edit3 size={13} />
                                <span>Rename</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  onOpenMoveModal(board.id);
                                  setActiveMenuId(null);
                                }}
                              >
                                <FolderInput size={13} />
                                <span>Move to...</span>
                              </button>
                              <button
                                type="button"
                                className="danger"
                                onClick={() => {
                                  onDeleteWhiteboard(board.id);
                                  setActiveMenuId(null);
                                }}
                              >
                                <Trash2 size={13} />
                                <span>Delete</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {folderBoards.length === 0 && (
                    <div className="empty-folder-hint">Empty folder</div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Root Whiteboards (not in any folder) */}
        {rootWhiteboards.length > 0 && (
          <div className="root-whiteboards-section">
            <div className="section-label">BOARDS</div>
            {rootWhiteboards.map((board) => {
              const isSelected = board.id === activeWhiteboardId;
              const isBoardMenuOpen = activeMenuId === `board-${board.id}`;

              return (
                <div
                  key={board.id}
                  className={`whiteboard-tree-item ${isSelected ? "active" : ""}`}
                >
                  <button
                    type="button"
                    className="whiteboard-click-area"
                    onClick={() => onSelectWhiteboard(board.id)}
                  >
                    <FileText size={14} className="whiteboard-icon" />
                    {editingItemId === board.id && editingItemType === "whiteboard" ? (
                      <input
                        type="text"
                        autoFocus
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={handleSaveRename}
                        onKeyDown={handleKeyDownRename}
                        className="inline-rename-input"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="whiteboard-name">{board.name}</span>
                    )}
                  </button>

                  <div className="item-menu-container">
                    <button
                      type="button"
                      className="item-menu-trigger"
                      onClick={() =>
                        setActiveMenuId(isBoardMenuOpen ? null : `board-${board.id}`)
                      }
                    >
                      <MoreHorizontal size={13} />
                    </button>

                    {isBoardMenuOpen && (
                      <div className="item-popover-menu">
                        <button
                          type="button"
                          onClick={() => handleStartRename(board.id, "whiteboard", board.name)}
                        >
                          <Edit3 size={13} />
                          <span>Rename</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onOpenMoveModal(board.id);
                            setActiveMenuId(null);
                          }}
                        >
                          <FolderInput size={13} />
                          <span>Move to...</span>
                        </button>
                        <button
                          type="button"
                          className="danger"
                          onClick={() => {
                            onDeleteWhiteboard(board.id);
                            setActiveMenuId(null);
                          }}
                        >
                          <Trash2 size={13} />
                          <span>Delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sidebar Footer: Offline Local Storage indicator */}
      <div className="sidebar-footer">
        <div className="storage-status-pill" title="All boards and folders are stored locally on your device in AppData">
          <HardDrive size={13} className="storage-icon" />
          <span>Local AppData (Offline)</span>
        </div>
      </div>
    </aside>
  );
};
