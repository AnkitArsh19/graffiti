import {
  Folder,
  StorageAdapter,
  WhiteboardDetail,
  WhiteboardSummary,
  Workspace,
} from "./types";

const DB_NAME = "graffiti_offline_db";
const DB_VERSION = 1;

const STORES = {
  WORKSPACES: "workspaces",
  FOLDERS: "folders",
  WHITEBOARDS: "whiteboards",
} as const;

export class IndexedDbStorageAdapter implements StorageAdapter {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORES.WORKSPACES)) {
          db.createObjectStore(STORES.WORKSPACES, { keyPath: "id" });
        }

        if (!db.objectStoreNames.contains(STORES.FOLDERS)) {
          const folderStore = db.createObjectStore(STORES.FOLDERS, {
            keyPath: "id",
          });
          folderStore.createIndex("workspaceId", "workspaceId", {
            unique: false,
          });
          folderStore.createIndex("parentFolderId", "parentFolderId", {
            unique: false,
          });
        }

        if (!db.objectStoreNames.contains(STORES.WHITEBOARDS)) {
          const boardStore = db.createObjectStore(STORES.WHITEBOARDS, {
            keyPath: "id",
          });
          boardStore.createIndex("workspaceId", "workspaceId", {
            unique: false,
          });
          boardStore.createIndex("folderId", "folderId", { unique: false });
        }
      };

      request.onsuccess = async (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        await this.ensureInitialSeed();
        resolve();
      };

      request.onerror = () => {
        reject(new Error("Failed to open local IndexedDB storage."));
      };
    });
  }

  private async ensureInitialSeed(): Promise<void> {
    const workspaces = await this.listWorkspaces();
    if (workspaces.length === 0) {
      const defaultWorkspace: Workspace = {
        id: crypto.randomUUID(),
        name: "Personal Workspace",
        description: "Default workspace for local drawings and notes",
        color: "#4dabf7",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await this.putRecord(STORES.WORKSPACES, defaultWorkspace);

      const defaultFolder: Folder = {
        id: crypto.randomUUID(),
        workspaceId: defaultWorkspace.id,
        parentFolderId: null,
        name: "Quick Sketches",
        color: "#fa5252",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await this.putRecord(STORES.FOLDERS, defaultFolder);

      const initialBoard: WhiteboardDetail = {
        id: crypto.randomUUID(),
        slug: "first-board",
        name: "Welcome to Graffiti",
        workspaceId: defaultWorkspace.id,
        folderId: defaultFolder.id,
        activePageId: "page_01",
        pages: [
          {
            id: "page_01",
            whiteboardId: "",
            title: "Page 1",
            template: "blank",
            pageOrder: 0,
            elements: [],
            createdAt: Date.now(),
          },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      initialBoard.pages[0].whiteboardId = initialBoard.id;
      await this.putRecord(STORES.WHITEBOARDS, initialBoard);
    }
  }

  private getStore(
    storeName: string,
    mode: IDBTransactionMode,
  ): IDBObjectStore {
    if (!this.db) {
      throw new Error("Database not initialized.");
    }
    const tx = this.db.transaction(storeName, mode);
    return tx.objectStore(storeName);
  }

  private async putRecord<T>(storeName: string, record: T): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore(storeName, "readwrite");
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  private async getAllRecords<T>(storeName: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const store = this.getStore(storeName, "readonly");
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  private async getRecord<T>(
    storeName: string,
    key: string,
  ): Promise<T | null> {
    return new Promise((resolve, reject) => {
      const store = this.getStore(storeName, "readonly");
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  private async deleteRecord(storeName: string, key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore(storeName, "readwrite");
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // Workspaces
  async listWorkspaces(): Promise<Workspace[]> {
    const all = await this.getAllRecords<Workspace>(STORES.WORKSPACES);
    return all.sort((a, b) => a.createdAt - b.createdAt);
  }

  async createWorkspace(
    name: string,
    description?: string,
    color?: string,
  ): Promise<Workspace> {
    const ws: Workspace = {
      id: crypto.randomUUID(),
      name: name.trim() || "Untitled Workspace",
      description,
      color: color || "#4dabf7",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await this.putRecord(STORES.WORKSPACES, ws);
    return ws;
  }

  async updateWorkspace(
    id: string,
    updates: Partial<Pick<Workspace, "name" | "description" | "color">>,
  ): Promise<void> {
    const existing = await this.getRecord<Workspace>(STORES.WORKSPACES, id);
    if (!existing) return;
    const updated: Workspace = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    };
    await this.putRecord(STORES.WORKSPACES, updated);
  }

  async deleteWorkspace(id: string): Promise<void> {
    await this.deleteRecord(STORES.WORKSPACES, id);

    // Cascade delete folders in this workspace
    const folders = await this.listFolders(id);
    for (const f of folders) {
      await this.deleteFolder(f.id);
    }

    // Cascade delete whiteboards
    const boards = await this.listWhiteboards(id);
    for (const b of boards) {
      await this.deleteWhiteboard(b.id);
    }
  }

  // Folders
  async listFolders(workspaceId: string): Promise<Folder[]> {
    const all = await this.getAllRecords<Folder>(STORES.FOLDERS);
    return all.filter((f) => f.workspaceId === workspaceId);
  }

  async createFolder(
    workspaceId: string,
    name: string,
    parentFolderId: string | null = null,
    color = "#4dabf7",
  ): Promise<Folder> {
    const folder: Folder = {
      id: crypto.randomUUID(),
      workspaceId,
      parentFolderId,
      name: name.trim() || "New Folder",
      color,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await this.putRecord(STORES.FOLDERS, folder);
    return folder;
  }

  async updateFolder(
    id: string,
    updates: Partial<Pick<Folder, "name" | "color" | "parentFolderId">>,
  ): Promise<void> {
    const existing = await this.getRecord<Folder>(STORES.FOLDERS, id);
    if (!existing) return;
    const updated: Folder = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    };
    await this.putRecord(STORES.FOLDERS, updated);
  }

  async deleteFolder(id: string): Promise<void> {
    await this.deleteRecord(STORES.FOLDERS, id);

    // Delete subfolders recursively
    const allFolders = await this.getAllRecords<Folder>(STORES.FOLDERS);
    const children = allFolders.filter((f) => f.parentFolderId === id);
    for (const child of children) {
      await this.deleteFolder(child.id);
    }

    // Move or delete whiteboards inside this folder
    const allBoards = await this.getAllRecords<WhiteboardDetail>(
      STORES.WHITEBOARDS,
    );
    for (const board of allBoards) {
      if (board.folderId === id) {
        board.folderId = null; // Unlink to root of workspace
        await this.putRecord(STORES.WHITEBOARDS, board);
      }
    }
  }

  // Whiteboards
  async listWhiteboards(
    workspaceId: string,
    folderId?: string | null,
  ): Promise<WhiteboardSummary[]> {
    const all = await this.getAllRecords<WhiteboardDetail>(STORES.WHITEBOARDS);
    const filtered = all.filter((b) => {
      if (b.workspaceId !== workspaceId) return false;
      if (folderId !== undefined) {
        return b.folderId === folderId;
      }
      return true;
    });

    return filtered.map((b) => ({
      id: b.id,
      slug: b.slug,
      name: b.name,
      workspaceId: b.workspaceId,
      folderId: b.folderId,
      pageCount: b.pages.length,
      updatedAt: b.updatedAt,
      createdAt: b.createdAt,
    }));
  }

  async getWhiteboard(id: string): Promise<WhiteboardDetail | null> {
    return this.getRecord<WhiteboardDetail>(STORES.WHITEBOARDS, id);
  }

  async saveWhiteboard(whiteboard: WhiteboardDetail): Promise<void> {
    const updated: WhiteboardDetail = {
      ...whiteboard,
      updatedAt: Date.now(),
    };
    await this.putRecord(STORES.WHITEBOARDS, updated);
  }

  async createWhiteboard(
    workspaceId: string,
    folderId: string | null = null,
    name = "Untitled Board",
  ): Promise<WhiteboardDetail> {
    const id = crypto.randomUUID();
    const pageId = crypto.randomUUID();
    const newBoard: WhiteboardDetail = {
      id,
      slug: `board-${Date.now().toString(36)}`,
      name: name.trim() || "Untitled Board",
      workspaceId,
      folderId,
      activePageId: pageId,
      pages: [
        {
          id: pageId,
          whiteboardId: id,
          title: "Page 1",
          template: "blank",
          pageOrder: 0,
          elements: [],
          createdAt: Date.now(),
        },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await this.putRecord(STORES.WHITEBOARDS, newBoard);
    return newBoard;
  }

  async renameWhiteboard(id: string, name: string): Promise<void> {
    const board = await this.getWhiteboard(id);
    if (!board) return;
    board.name = name.trim() || "Untitled Board";
    board.updatedAt = Date.now();
    await this.putRecord(STORES.WHITEBOARDS, board);
  }

  async moveWhiteboard(
    id: string,
    targetWorkspaceId: string,
    targetFolderId: string | null,
  ): Promise<void> {
    const board = await this.getWhiteboard(id);
    if (!board) return;
    board.workspaceId = targetWorkspaceId;
    board.folderId = targetFolderId;
    board.updatedAt = Date.now();
    await this.putRecord(STORES.WHITEBOARDS, board);
  }

  async deleteWhiteboard(id: string): Promise<void> {
    await this.deleteRecord(STORES.WHITEBOARDS, id);
  }
}
