import React, { useState } from "react";
import {
  Folder as FolderIcon,
  FolderInput,
  Layers,
  X,
  Check,
} from "lucide-react";
import { Folder, Workspace } from "../storage/types";

interface MoveModalProps {
  isOpen: boolean;
  whiteboardId: string | null;
  whiteboardName: string;
  currentWorkspaceId: string;
  currentFolderId: string | null;
  workspaces: Workspace[];
  folders: Folder[];
  onClose: () => void;
  onMove: (targetWorkspaceId: string, targetFolderId: string | null) => void;
}

export const MoveModal: React.FC<MoveModalProps> = ({
  isOpen,
  whiteboardId,
  whiteboardName,
  currentWorkspaceId,
  currentFolderId,
  workspaces,
  folders,
  onClose,
  onMove,
}) => {
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(currentWorkspaceId);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(currentFolderId);

  if (!isOpen || !whiteboardId) return null;

  const currentWorkspaceFolders = folders.filter(
    (f) => f.workspaceId === selectedWorkspaceId
  );

  const handleConfirm = () => {
    onMove(selectedWorkspaceId, selectedFolderId);
    onClose();
  };

  return (
    <div className="move-modal-backdrop" onClick={onClose}>
      <div className="move-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="move-modal-header">
          <div className="move-modal-title">
            <FolderInput size={18} />
            <span>Move "{whiteboardName}"</span>
          </div>
          <button type="button" className="move-modal-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="move-modal-body">
          {/* Workspace select */}
          <div className="move-section">
            <label className="move-label">Target Workspace</label>
            <div className="move-workspace-options">
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  type="button"
                  className={`move-option-btn ${ws.id === selectedWorkspaceId ? "active" : ""}`}
                  onClick={() => {
                    setSelectedWorkspaceId(ws.id);
                    setSelectedFolderId(null);
                  }}
                >
                  <Layers size={14} color={ws.color || "#4dabf7"} />
                  <span>{ws.name}</span>
                  {ws.id === selectedWorkspaceId && <Check size={14} className="check" />}
                </button>
              ))}
            </div>
          </div>

          {/* Folder select */}
          <div className="move-section">
            <label className="move-label">Target Folder</label>
            <div className="move-folder-options">
              <button
                type="button"
                className={`move-option-btn ${selectedFolderId === null ? "active" : ""}`}
                onClick={() => setSelectedFolderId(null)}
              >
                <Layers size={14} />
                <span>Workspace Root (No folder)</span>
                {selectedFolderId === null && <Check size={14} className="check" />}
              </button>

              {currentWorkspaceFolders.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  className={`move-option-btn ${folder.id === selectedFolderId ? "active" : ""}`}
                  onClick={() => setSelectedFolderId(folder.id)}
                >
                  <FolderIcon size={14} color={folder.color || "#4dabf7"} />
                  <span>{folder.name}</span>
                  {folder.id === selectedFolderId && <Check size={14} className="check" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="move-modal-footer">
          <button type="button" className="move-btn cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="move-btn confirm" onClick={handleConfirm}>
            Move Whiteboard
          </button>
        </div>
      </div>
    </div>
  );
};
