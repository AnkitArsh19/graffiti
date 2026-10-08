import React, { useState, useMemo, useRef, useEffect } from "react";
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
  Cloud,
  Check,
  X,
  Plus,
  GripVertical,
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
  onMoveFolder?: (folderId: string, targetParentFolderId: string | null) => void;
  whiteboards: WhiteboardSummary[];
  activeWhiteboardId: string;
  onSelectWhiteboard: (id: string) => void;
  onCreateWhiteboard: (folderId?: string | null) => void;
  onRenameWhiteboard: (id: string, name: string) => void;
  onDeleteWhiteboard: (id: string) => void;
  onMoveWhiteboard?: (whiteboardId: string, targetFolderId: string | null) => void;
  onOpenMoveModal: (whiteboardId: string) => void;
  isAuthenticated?: boolean;
  userEmail?: string | null;
}

/**
 * Normalizes folder color to ensure it matches Graffiti's gold/dark palette,
 * strictly replacing old cyan/blue (#4dabf7) and red (#fa5252) with gold (#d4a359).
 */
export function getFolderColor(color?: string): string {
  if (
    !color ||
    color === "#4dabf7" ||
    color === "#fa5252" ||
    color === "#3b82f6" ||
    color === "#ef4444" ||
    color.toLowerCase() === "#4dabf7" ||
    color.toLowerCase() === "#fa5252" ||
    color.toLowerCase() === "#3b82f6" ||
    color.toLowerCase() === "#ef4444"
  ) {
    return "var(--accent-primary, #d4a359)";
  }
  return color;
}

export const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({
  isOpen,
  onClose,
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onCreateWorkspace,
  onDeleteWorkspace,
  folders,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveFolder,
  whiteboards,
  activeWhiteboardId,
  onSelectWhiteboard,
  onCreateWhiteboard,
  onRenameWhiteboard,
  onDeleteWhiteboard,
  onMoveWhiteboard,
  onOpenMoveModal,
  isAuthenticated,
  userEmail,
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

  // Drag and drop state
  const [dragOverTargetId, setDragOverTargetId] = useState<string | null>(null);
  const [draggedItem, setDraggedItem] = useState<{ type: "whiteboard" | "folder"; id: string } | null>(null);

  // Close menus on click outside or Escape
  useEffect(() => {
    if (!isWorkspaceDropdownOpen && !activeMenuId) return;

    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Close workspace dropdown if clicking outside
      if (isWorkspaceDropdownOpen) {
        const isInsideDropdown = target.closest(".workspace-dropdown-menu");
        const isSelectorBtn = target.closest(".workspace-selector-btn");
        if (!isInsideDropdown && !isSelectorBtn) {
          setIsWorkspaceDropdownOpen(false);
          setIsCreatingWorkspace(false);
        }
      }

      // Close active popover menu if clicking outside
      if (activeMenuId) {
        const isInsideMenu = target.closest(".item-popover-menu");
        const isTrigger = target.closest(".item-menu-trigger");
        if (!isInsideMenu && !isTrigger) {
          setActiveMenuId(null);
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsWorkspaceDropdownOpen(false);
        setIsCreatingWorkspace(false);
        setActiveMenuId(null);
      }
    };

    document.addEventListener("mousedown", handleDocumentClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isWorkspaceDropdownOpen, activeMenuId]);

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

  // Drag and drop drop handler
  const handleItemDrop = (targetFolderId: string | null, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTargetId(null);

    let item = draggedItem;
    try {
      const raw = e.dataTransfer.getData("application/graffiti-item") || e.dataTransfer.getData("text/plain");
      if (raw) {
        item = JSON.parse(raw);
      }
    } catch {}

    if (!item) return;

    if (item.type === "whiteboard" && onMoveWhiteboard) {
      onMoveWhiteboard(item.id, targetFolderId);
    } else if (item.type === "folder" && onMoveFolder) {
      if (item.id !== targetFolderId) {
        onMoveFolder(item.id, targetFolderId);
      }
    }
    setDraggedItem(null);
  };

  if (!isOpen) return null;

  return (
    <aside className="workspace-sidebar" aria-label="Workspace and Folder Navigator">
      {/* Sidebar Top: Workspace Switcher */}
      <div className="sidebar-header">
        <div className="workspace-selector-container">
          <button
            type="button"
            className="workspace-selector-btn"
            onClick={() => {
              setActiveMenuId(null);
              setIsWorkspaceDropdownOpen((prev) => !prev);
            }}
            title="Switch Workspace"
          >
            <div className="workspace-avatar" style={{ backgroundColor: "var(--accent-primary, #d4a359)" }}>
              <Layers size={13} color="#09090b" />
            </div>
            <span className="workspace-title">{activeWorkspace?.name || "Workspace"}</span>
            <ChevronDown size={13} className="workspace-dropdown-icon" />
          </button>

          <button
            type="button"
            className="sidebar-close-btn"
            onClick={onClose}
            title="Close sidebar (Ctrl+B)"
            aria-label="Close sidebar"
          >
            <X size={15} />
          </button>
        </div>

        {/* Workspace Dropdown */}
        {isWorkspaceDropdownOpen && (
          <div className="workspace-dropdown-menu">
            <div className="dropdown-section-title">WORKSPACES</div>
            {workspaces.map((ws) => (
              <div
                key={ws.id}
                className={`workspace-dropdown-item-row ${ws.id === activeWorkspaceId ? "active" : ""}`}
              >
                <button
                  type="button"
                  className="workspace-dropdown-item-select"
                  onClick={() => {
                    onSelectWorkspace(ws.id);
                    setIsWorkspaceDropdownOpen(false);
                  }}
                  title={`Switch to ${ws.name}`}
                >
                  <div className="workspace-avatar-small" style={{ backgroundColor: "var(--accent-primary, #d4a359)" }}>
                    <Layers size={11} color="#09090b" />
                  </div>
                  <span className="dropdown-item-name">{ws.name}</span>
                </button>
                <div className="workspace-row-actions">
                  {ws.id === activeWorkspaceId && (
                    <span title="Active workspace">
                      <Check size={13} className="check-icon" />
                    </span>
                  )}
                  {workspaces.length > 1 && (
                    <button
                      type="button"
                      className="workspace-delete-action-btn"
                      title={`Delete workspace "${ws.name}"`}
                      aria-label={`Delete workspace ${ws.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Delete workspace "${ws.name}"?\n\nThis will permanently delete all whiteboards and folders within this workspace.`)) {
                          onDeleteWorkspace(ws.id);
                        }
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
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
                  <button type="submit" className="form-btn submit" title="Create">
                    <Check size={13} />
                  </button>
                  <button
                    type="button"
                    className="form-btn cancel"
                    onClick={() => setIsCreatingWorkspace(false)}
                    title="Cancel"
                  >
                    <X size={13} />
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                className="add-workspace-btn"
                onClick={() => setIsCreatingWorkspace(true)}
              >
                <Plus size={13} />
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
          onClick={() => {
            setIsWorkspaceDropdownOpen(false);
            setActiveMenuId(null);
            onCreateWhiteboard(null);
          }}
          title="New Whiteboard"
        >
          <FilePlus size={13} />
          <span>New Board</span>
        </button>
        <button
          type="button"
          className="sidebar-action-btn secondary"
          onClick={() => {
            setIsWorkspaceDropdownOpen(false);
            setActiveMenuId(null);
            onCreateFolder("New Folder", null);
          }}
          title="New Folder"
        >
          <FolderPlus size={13} />
          <span>New Folder</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="sidebar-search">
        <Search size={13} className="search-icon" />
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
            title="Clear search"
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
          const isDragTarget = dragOverTargetId === folder.id;
          const folderColor = getFolderColor(folder.color);

          return (
            <div
              key={folder.id}
              className={`folder-tree-node ${isDragTarget ? "drag-target" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = "move";
                if (dragOverTargetId !== folder.id) setDragOverTargetId(folder.id);
              }}
              onDragLeave={(e) => {
                e.stopPropagation();
                if (dragOverTargetId === folder.id) setDragOverTargetId(null);
              }}
              onDrop={(e) => handleItemDrop(folder.id, e)}
            >
              <div
                className={`folder-item-header ${isDragTarget ? "drag-over" : ""}`}
                draggable={editingItemId !== folder.id}
                onDragStart={(e) => {
                  setDraggedItem({ type: "folder", id: folder.id });
                  e.dataTransfer.setData("application/graffiti-item", JSON.stringify({ type: "folder", id: folder.id }));
                  e.dataTransfer.setData("text/plain", JSON.stringify({ type: "folder", id: folder.id }));
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => {
                  setDraggedItem(null);
                  setDragOverTargetId(null);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  handleStartRename(folder.id, "folder", folder.name);
                }}
              >
                <button
                  type="button"
                  className="folder-toggle-btn"
                  onClick={() => toggleFolderCollapse(folder.id)}
                  title={isCollapsed ? "Expand folder" : "Collapse folder"}
                >
                  {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                </button>

                <div
                  className="folder-icon-wrapper"
                  onClick={() => toggleFolderCollapse(folder.id)}
                  style={{ color: folderColor }}
                >
                  {isCollapsed ? (
                    <FolderIcon size={15} color={folderColor} />
                  ) : (
                    <FolderOpen size={15} color={folderColor} />
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
                    onFocus={(e) => e.currentTarget.select()}
                    className="inline-rename-input"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span
                    className="folder-name"
                    title={`${folder.name} (Double-click to rename)`}
                    onClick={() => toggleFolderCollapse(folder.id)}
                  >
                    {folder.name}
                  </span>
                )}

                <span className="folder-count-badge">{folderBoards.length}</span>

                <div className="item-actions-group">
                  {/* Quick Inline Rename Button */}
                  <button
                    type="button"
                    className="item-quick-btn"
                    title="Rename folder"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartRename(folder.id, "folder", folder.name);
                    }}
                  >
                    <Edit3 size={12} />
                  </button>

                  {/* Quick Add Board Button */}
                  <button
                    type="button"
                    className="item-quick-btn"
                    title="Add board in folder"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCreateWhiteboard(folder.id);
                    }}
                  >
                    <Plus size={12} />
                  </button>

                  {/* Context Menu Button */}
                  <div className="item-menu-container">
                    <button
                      type="button"
                      className="item-menu-trigger"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsWorkspaceDropdownOpen(false);
                        setActiveMenuId(isMenuOpen ? null : `folder-${folder.id}`);
                      }}
                      title="Folder options"
                    >
                      <MoreHorizontal size={13} />
                    </button>

                    {isMenuOpen && (
                      <div className="item-popover-menu">
                        <button
                          type="button"
                          onClick={() => {
                            setCollapsedFolders((prev) => ({ ...prev, [folder.id]: false }));
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
                        draggable={editingItemId !== board.id}
                        onDragStart={(e) => {
                          setDraggedItem({ type: "whiteboard", id: board.id });
                          e.dataTransfer.setData("application/graffiti-item", JSON.stringify({ type: "whiteboard", id: board.id }));
                          e.dataTransfer.setData("text/plain", JSON.stringify({ type: "whiteboard", id: board.id }));
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => {
                          setDraggedItem(null);
                          setDragOverTargetId(null);
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          handleStartRename(board.id, "whiteboard", board.name);
                        }}
                      >
                        <button
                          type="button"
                          className="whiteboard-click-area"
                          onClick={() => onSelectWhiteboard(board.id)}
                          title={`${board.name} (Double-click to rename)`}
                        >
                          <FileText size={13} className="whiteboard-icon" />
                          {editingItemId === board.id && editingItemType === "whiteboard" ? (
                            <input
                              type="text"
                              autoFocus
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onBlur={handleSaveRename}
                              onKeyDown={handleKeyDownRename}
                              onFocus={(e) => e.currentTarget.select()}
                              className="inline-rename-input"
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <span className="whiteboard-name">{board.name}</span>
                          )}
                        </button>

                        <div className="item-actions-group">
                          {/* Quick Inline Rename Button */}
                          <button
                            type="button"
                            className="item-quick-btn"
                            title="Rename board"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartRename(board.id, "whiteboard", board.name);
                            }}
                          >
                            <Edit3 size={11} />
                          </button>

                          <div className="item-menu-container">
                            <button
                              type="button"
                              className="item-menu-trigger"
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsWorkspaceDropdownOpen(false);
                                setActiveMenuId(isBoardMenuOpen ? null : `board-${board.id}`);
                              }}
                              title="Board options"
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
                      </div>
                    );
                  })}
                  {folderBoards.length === 0 && (
                    <div className="empty-folder-hint">Empty folder (drag boards here)</div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Root Whiteboards (not in any folder) / Drop Target for Root */}
        <div
          className={`root-whiteboards-section ${dragOverTargetId === "root" ? "drag-over" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = "move";
            if (dragOverTargetId !== "root") setDragOverTargetId("root");
          }}
          onDragLeave={(e) => {
            e.stopPropagation();
            if (dragOverTargetId === "root") setDragOverTargetId(null);
          }}
          onDrop={(e) => handleItemDrop(null, e)}
        >
          <div className="section-label">BOARDS</div>
          {rootWhiteboards.map((board) => {
            const isSelected = board.id === activeWhiteboardId;
            const isBoardMenuOpen = activeMenuId === `board-${board.id}`;

            return (
              <div
                key={board.id}
                className={`whiteboard-tree-item ${isSelected ? "active" : ""}`}
                draggable={editingItemId !== board.id}
                onDragStart={(e) => {
                  setDraggedItem({ type: "whiteboard", id: board.id });
                  e.dataTransfer.setData("application/graffiti-item", JSON.stringify({ type: "whiteboard", id: board.id }));
                  e.dataTransfer.setData("text/plain", JSON.stringify({ type: "whiteboard", id: board.id }));
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => {
                  setDraggedItem(null);
                  setDragOverTargetId(null);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  handleStartRename(board.id, "whiteboard", board.name);
                }}
              >
                <button
                  type="button"
                  className="whiteboard-click-area"
                  onClick={() => onSelectWhiteboard(board.id)}
                  title={`${board.name} (Double-click to rename)`}
                >
                  <FileText size={13} className="whiteboard-icon" />
                  {editingItemId === board.id && editingItemType === "whiteboard" ? (
                    <input
                      type="text"
                      autoFocus
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={handleSaveRename}
                      onKeyDown={handleKeyDownRename}
                      onFocus={(e) => e.currentTarget.select()}
                      className="inline-rename-input"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="whiteboard-name">{board.name}</span>
                  )}
                </button>

                <div className="item-actions-group">
                  <button
                    type="button"
                    className="item-quick-btn"
                    title="Rename board"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartRename(board.id, "whiteboard", board.name);
                    }}
                  >
                    <Edit3 size={11} />
                  </button>

                  <div className="item-menu-container">
                    <button
                      type="button"
                      className="item-menu-trigger"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsWorkspaceDropdownOpen(false);
                        setActiveMenuId(isBoardMenuOpen ? null : `board-${board.id}`);
                      }}
                      title="Board options"
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
              </div>
            );
          })}
          {rootWhiteboards.length === 0 && (
            <div className="empty-folder-hint" style={{ paddingLeft: 12 }}>
              Drag boards here to move to root
            </div>
          )}
        </div>
      </div>

      {/* Sidebar Footer: Cloud Synced or Offline Local Storage indicator */}
      <div className="sidebar-footer">
        {isAuthenticated ? (
          <div className="storage-status-pill cloud-connected" title={`Synced to Graffiti servers (${userEmail || "online"})`}>
            <Cloud size={13} className="storage-icon" style={{ color: "#22c55e" }} />
            <span style={{ color: "var(--text-primary, #ffffff)", fontWeight: 500 }}>Synced to Server</span>
          </div>
        ) : (
          <div className="storage-status-pill" title="All boards and folders are stored locally on your device in AppData">
            <HardDrive size={13} className="storage-icon" />
            <span>Local AppData (Offline)</span>
          </div>
        )}
      </div>
    </aside>
  );
};
