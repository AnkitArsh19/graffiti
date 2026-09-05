import { CanvasElement, PaperTemplate } from "../types";

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  ownerId?: string | null;
  color?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Folder {
  id: string;
  workspaceId: string;
  parentFolderId: string | null;
  name: string;
  color: string;
  icon?: string;
  createdAt: number;
  updatedAt: number;
}

export interface WhiteboardSummary {
  id: string;
  slug: string;
  name: string;
  workspaceId: string;
  folderId: string | null;
  pageCount: number;
  updatedAt: number;
  createdAt: number;
}

export interface WhiteboardPageData {
  id: string;
  whiteboardId: string;
  title: string;
  template: PaperTemplate;
  pageOrder: number;
  elements: CanvasElement[];
  createdAt: number;
}

export interface WhiteboardDetail {
  id: string;
  slug: string;
  name: string;
  workspaceId: string;
  folderId: string | null;
  activePageId: string;
  pages: WhiteboardPageData[];
  createdAt: number;
  updatedAt: number;
}

export interface StorageAdapter {
  init(): Promise<void>;

  // Workspaces
  listWorkspaces(): Promise<Workspace[]>;
  createWorkspace(name: string, description?: string, color?: string): Promise<Workspace>;
  updateWorkspace(id: string, updates: Partial<Pick<Workspace, "name" | "description" | "color">>): Promise<void>;
  deleteWorkspace(id: string): Promise<void>;

  // Folders
  listFolders(workspaceId: string): Promise<Folder[]>;
  createFolder(workspaceId: string, name: string, parentFolderId?: string | null, color?: string): Promise<Folder>;
  updateFolder(id: string, updates: Partial<Pick<Folder, "name" | "color" | "parentFolderId">>): Promise<void>;
  deleteFolder(id: string): Promise<void>;

  // Whiteboards
  listWhiteboards(workspaceId: string, folderId?: string | null): Promise<WhiteboardSummary[]>;
  getWhiteboard(id: string): Promise<WhiteboardDetail | null>;
  saveWhiteboard(whiteboard: WhiteboardDetail): Promise<void>;
  createWhiteboard(workspaceId: string, folderId?: string | null, name?: string): Promise<WhiteboardDetail>;
  renameWhiteboard(id: string, name: string): Promise<void>;
  moveWhiteboard(id: string, targetWorkspaceId: string, targetFolderId: string | null): Promise<void>;
  deleteWhiteboard(id: string): Promise<void>;
}
