// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as api from "../lib/api";

describe("Google Drive API Client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("apiGetDriveFolders requests folders with query parameters", async () => {
    const mockFolders = [
      { id: "folder-1", name: "Designs", mimeType: "application/vnd.google-apps.folder" },
      { id: "folder-2", name: "Notes", mimeType: "application/vnd.google-apps.folder" },
    ];

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockFolders,
    } as any);

    const result = await api.apiGetDriveFolders({
      accountId: "acc-123",
      parentFolderId: "root",
    });

    expect(result).toEqual(mockFolders);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/export/drive/folders?accountId=acc-123&parentFolderId=root"),
      expect.any(Object)
    );
  });

  it("apiGetDriveFolders supports search query parameter", async () => {
    const mockFolders = [
      { id: "folder-search-1", name: "Architecture Docs", mimeType: "application/vnd.google-apps.folder" },
    ];

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockFolders,
    } as any);

    const result = await api.apiGetDriveFolders({
      search: "Architecture",
    });

    expect(result).toEqual(mockFolders);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/export/drive/folders?search=Architecture"),
      expect.any(Object)
    );
  });

  it("apiGetDriveFiles requests files with folder and search parameters", async () => {
    const mockFiles = [
      { id: "file-1", name: "roadmap.pdf", mimeType: "application/pdf", size: "1024" },
    ];

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockFiles,
    } as any);

    const result = await api.apiGetDriveFiles({
      folderId: "folder-123",
      search: "roadmap",
    });

    expect(result).toEqual(mockFiles);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/export/drive/files?folderId=folder-123&search=roadmap"),
      expect.any(Object)
    );
  });

  it("apiExportDrive includes folderId in query parameters when specified", async () => {
    const mockResponse = { webViewLink: "https://drive.google.com/file/123", fileId: "123" };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as any);

    const testBlob = new Blob(["test-pdf-content"], { type: "application/pdf" });
    const result = await api.apiExportDrive(testBlob, {
      folderId: "target-folder-999",
      roomSlug: "test-room",
    });

    expect(result).toEqual(mockResponse);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/export/drive?folderId=target-folder-999"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("apiDownloadDriveFile extracts filename from header and returns blob", async () => {
    const mockBlob = new Blob(["mock-bytes"], { type: "application/pdf" });
    const headers = new Headers();
    headers.set("Content-Type", "application/pdf");
    headers.set("Content-Disposition", 'attachment; filename="whiteboard-archive.pdf"');

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers,
      blob: async () => mockBlob,
    } as any);

    const result = await api.apiDownloadDriveFile("file-xyz-123");
    expect(result.filename).toBe("whiteboard-archive.pdf");
    expect(result.mimeType).toBe("application/pdf");
    expect(result.blob).toBe(mockBlob);
  });
});
