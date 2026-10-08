/**
 * API client for communicating with graffiti-backend.
 * All REST calls go through this module for consistent error handling and auth headers.
 */

export function getApiBaseUrl(): string {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // All development and production code defaults to domain
  return "https://api-graffiti.ankitarsh.me";
}

const API_BASE = getApiBaseUrl();

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("graffiti:auth:token");
  if (token) {
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  }
  return { "Content-Type": "application/json" };
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem("graffiti:auth:token");
      window.dispatchEvent(new CustomEvent("graffiti:auth:expired"));
    }
    const errorBody = await response.text().catch(() => "");
    let errMsg = `API Error ${response.status}`;
    try {
      const parsed = JSON.parse(errorBody);
      if (parsed && typeof parsed.message === "string") {
        errMsg = parsed.message;
      } else if (errorBody) {
        errMsg = errorBody;
      }
    } catch {
      if (errorBody) errMsg = `${errMsg}: ${errorBody}`;
    }
    throw new Error(errMsg);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

// Auth endpoints
export async function apiRegister(email: string, password: string, name: string) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });
  return handleResponse<{
    token: string;
    userId: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
  }>(res);
}

export async function apiLogin(email: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return handleResponse<{
    token: string;
    userId: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
  }>(res);
}

export async function apiGetProfile() {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<{
    userId: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
    provider: string;
  }>(res);
}

export async function apiUpdateProfile(data: { name?: string; avatarUrl?: string }) {
  const res = await fetch(`${API_BASE}/auth/me`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse<{
    userId: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
    provider: string;
  }>(res);
}

// Workspace endpoints
export async function apiListWorkspaces() {
  const res = await fetch(`${API_BASE}/workspaces`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<
    Array<{
      id: string;
      name: string;
      description?: string;
      color?: string;
      ownerId?: string | null;
      createdAt: string;
      updatedAt: string;
    }>
  >(res);
}

export async function apiCreateWorkspace(data: { name: string; description?: string; color?: string }) {
  const res = await fetch(`${API_BASE}/workspaces`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse<{
    id: string;
    name: string;
    description?: string;
    color?: string;
    ownerId?: string | null;
    createdAt: string;
    updatedAt: string;
  }>(res);
}

export async function apiUpdateWorkspace(id: string, data: { name?: string; description?: string; color?: string }) {
  const res = await fetch(`${API_BASE}/workspaces/${id}`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse<any>(res);
}

export async function apiDeleteWorkspace(id: string) {
  const res = await fetch(`${API_BASE}/workspaces/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return handleResponse<void>(res);
}

// Folder endpoints
export async function apiListFolders(workspaceId: string) {
  const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/folders`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<
    Array<{
      id: string;
      workspaceId: string;
      parentFolderId: string | null;
      name: string;
      color: string;
      createdAt: string;
      updatedAt: string;
    }>
  >(res);
}

export async function apiCreateFolder(data: {
  workspaceId: string;
  name: string;
  parentFolderId?: string | null;
  color?: string;
}) {
  const res = await fetch(`${API_BASE}/workspaces/${data.workspaceId}/folders`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      name: data.name,
      color: data.color || "#d4a359",
      parentFolderId: data.parentFolderId || null,
    }),
  });
  return handleResponse<{
    id: string;
    workspaceId: string;
    parentFolderId: string | null;
    name: string;
    color: string;
    createdAt: string;
    updatedAt: string;
  }>(res);
}

export async function apiUpdateFolder(
  id: string,
  data: { name?: string; color?: string; parentFolderId?: string | null }
) {
  const res = await fetch(`${API_BASE}/folders/${id}`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse<any>(res);
}

export async function apiDeleteFolder(id: string) {
  const res = await fetch(`${API_BASE}/folders/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return handleResponse<void>(res);
}

// Room endpoints
export async function apiCreateRoom(data?: {
  name?: string;
  workspaceId?: string;
  folderId?: string | null;
  snapshotState?: any;
}) {
  const res = await fetch(`${API_BASE}/rooms`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: data ? JSON.stringify(data) : undefined,
  });
  return handleResponse<{
    id: string;
    slug: string;
    ownerId: string | null;
    createdAt: string;
  }>(res);
}

export async function apiSaveRoomContent(
  slug: string,
  data: {
    name?: string;
    workspaceId?: string;
    folderId?: string | null;
    snapshotState?: any;
  }
) {
  const res = await fetch(`${API_BASE}/rooms/${slug}/content`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse<{ status: string; slug: string }>(res);
}

export async function apiGetRoom(slug: string) {
  const res = await fetch(`${API_BASE}/rooms/${slug}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<{
    id: string;
    slug: string;
    name?: string;
    ownerId: string | null;
    createdAt: string;
    snapshotState?: any;
    state?: any;
    upToLamportTs: number;
    opsSinceSnapshot?: any[];
    ops?: any[];
  }>(res);
}

export async function apiGetMyRooms() {
  const res = await fetch(`${API_BASE}/rooms/mine`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<
    Array<{
      id: string;
      slug: string;
      name: string;
      isPublic: boolean;
      ownerId: string | null;
      createdAt: string;
      updatedAt: string;
      role: string;
      memberCount: number;
    }>
  >(res);
}

export async function apiUpdateRoom(
  slug: string,
  data: {
    name?: string;
    isPublic?: boolean;
    workspaceId?: string | null;
    folderId?: string | null;
  }
) {
  const res = await fetch(`${API_BASE}/rooms/${slug}`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return handleResponse<any>(res);
}


export async function apiClaimRoom(slug: string) {
  const res = await fetch(`${API_BASE}/rooms/${slug}/claim`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  return handleResponse<{ id: string; slug: string }>(res);
}

export async function apiDeleteRoom(slug: string) {
  const res = await fetch(`${API_BASE}/rooms/${slug}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return handleResponse<void>(res);
}

export async function apiLeaveRoom(slug: string, candidateNewOwnerId?: string) {
  const res = await fetch(`${API_BASE}/rooms/${slug}/leave`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: candidateNewOwnerId ? JSON.stringify({ candidateNewOwnerId }) : undefined,
  });
  return handleResponse<{ status: string; slug: string; wasOwner: boolean; newOwnerId?: string }>(res);
}

export async function apiGetRoomMembers(slug: string) {
  const res = await fetch(`${API_BASE}/rooms/${slug}/members`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<Array<{ userId: string; role: string; email: string; name: string }>>(res);
}

export async function apiAddRoomMember(slug: string, email: string, role: string = "EDITOR") {
  const res = await fetch(`${API_BASE}/rooms/${slug}/members`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ email, role }),
  });
  return handleResponse<{ userId: string; role: string; email: string }>(res);
}

export async function apiRemoveRoomMember(slug: string, userId: string) {
  const res = await fetch(`${API_BASE}/rooms/${slug}/members/${userId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return handleResponse<void>(res);
}

export async function apiSyncDelta(slug: string, since: number) {
  const res = await fetch(`${API_BASE}/rooms/${slug}/sync?since=${since}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse<any[]>(res);
}

export interface RemotePage { id: string; title: string; template: "blank" | "ruled" | "grid" | "dotted" | "cornell"; pageOrder: number; }
export async function apiGetRoomPages(slug: string) { return handleResponse<RemotePage[]>(await fetch(`${API_BASE}/rooms/${slug}/pages`, { headers: getAuthHeaders() })); }
export async function apiCreateRoomPage(slug: string, data: Partial<Pick<RemotePage, "title" | "template" | "pageOrder">>) { return handleResponse<RemotePage>(await fetch(`${API_BASE}/rooms/${slug}/pages`, { method: "POST", headers: getAuthHeaders(), body: JSON.stringify(data) })); }
export async function apiUpdateRoomPage(slug: string, pageId: string, data: Partial<Pick<RemotePage, "title" | "template" | "pageOrder">>) { return handleResponse<RemotePage>(await fetch(`${API_BASE}/rooms/${slug}/pages/${pageId}`, { method: "PATCH", headers: getAuthHeaders(), body: JSON.stringify(data) })); }
export async function apiDeleteRoomPage(slug: string, pageId: string) { return handleResponse<void>(await fetch(`${API_BASE}/rooms/${slug}/pages/${pageId}`, { method: "DELETE", headers: getAuthHeaders() })); }

export async function apiUploadImage(file: File) {
  const token = localStorage.getItem("graffiti:auth:token"); const form = new FormData(); form.append("file", file);
  return handleResponse<{ fileId: string; url: string }>(await fetch(`${API_BASE}/upload/image`, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: form }));
}

export interface ConnectedDriveAccount {
  id: string;
  accountEmail: string;
  accountLabel: string;
  isDefault: boolean;
  createdAt: string;
}

export async function apiGetDriveAccounts(): Promise<ConnectedDriveAccount[]> {
  return handleResponse<ConnectedDriveAccount[]>(await fetch(`${API_BASE}/export/drive/accounts`, { headers: getAuthHeaders() }));
}

export async function apiConnectDriveAccount(data: {
  accountEmail: string;
  accountLabel?: string;
  accessToken: string;
  refreshToken?: string;
  isDefault?: boolean;
}): Promise<ConnectedDriveAccount> {
  return handleResponse<ConnectedDriveAccount>(
    await fetch(`${API_BASE}/export/drive/accounts`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    })
  );
}

export async function apiDisconnectDriveAccount(id: string): Promise<void> {
  await fetch(`${API_BASE}/export/drive/accounts/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
}

export interface DriveFolderItem {
  id: string;
  name: string;
  mimeType: string;
}

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  thumbnailLink?: string;
}

export async function apiGetDriveFolders(options?: {
  accountId?: string;
  parentFolderId?: string;
  search?: string;
  directToken?: string;
}): Promise<DriveFolderItem[]> {
  const params = new URLSearchParams();
  if (options?.accountId) params.set("accountId", options.accountId);
  if (options?.parentFolderId) params.set("parentFolderId", options.parentFolderId);
  if (options?.search) params.set("search", options.search);
  const query = params.toString() ? `?${params.toString()}` : "";
  const headers = getAuthHeaders();
  if (options?.directToken) headers["X-Google-Drive-Token"] = options.directToken;

  return handleResponse<DriveFolderItem[]>(
    await fetch(`${API_BASE}/export/drive/folders${query}`, { headers })
  );
}

export async function apiGetDriveFiles(options?: {
  accountId?: string;
  folderId?: string;
  search?: string;
  directToken?: string;
}): Promise<DriveFileItem[]> {
  const params = new URLSearchParams();
  if (options?.accountId) params.set("accountId", options.accountId);
  if (options?.folderId) params.set("folderId", options.folderId);
  if (options?.search) params.set("search", options.search);
  const query = params.toString() ? `?${params.toString()}` : "";
  const headers = getAuthHeaders();
  if (options?.directToken) headers["X-Google-Drive-Token"] = options.directToken;

  return handleResponse<DriveFileItem[]>(
    await fetch(`${API_BASE}/export/drive/files${query}`, { headers })
  );
}

export async function apiDownloadDriveFile(
  fileId: string,
  options?: { accountId?: string; directToken?: string }
): Promise<{ blob: Blob; filename: string; mimeType: string }> {
  const params = new URLSearchParams();
  if (options?.accountId) params.set("accountId", options.accountId);
  const query = params.toString() ? `?${params.toString()}` : "";
  const headers = getAuthHeaders();
  if (options?.directToken) headers["X-Google-Drive-Token"] = options.directToken;

  const res = await fetch(`${API_BASE}/export/drive/files/${encodeURIComponent(fileId)}/download${query}`, {
    headers,
  });

  if (!res.ok) {
    let errMsg = `Failed to download file (${res.status})`;
    try {
      const errJson = await res.json();
      if (errJson.message) errMsg = errJson.message;
    } catch {}
    throw new Error(errMsg);
  }

  const mimeType = res.headers.get("Content-Type") || "application/octet-stream";
  const disposition = res.headers.get("Content-Disposition");
  let filename = "downloaded-file";
  if (disposition) {
    const match = disposition.match(/filename="?([^";]+)"?/);
    if (match && match[1]) filename = match[1];
  }
  const blob = await res.blob();
  return { blob, filename, mimeType };
}

export async function apiExportDrive(
  file: Blob,
  options?: { roomSlug?: string; accountId?: string; directToken?: string; folderId?: string }
) {
  const token = localStorage.getItem("graffiti:auth:token");
  const form = new FormData();
  form.append("file", file, "graffiti-board.pdf");
  if (options?.roomSlug) form.append("roomSlug", options.roomSlug);

  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (options?.directToken) headers["X-Google-Drive-Token"] = options.directToken;

  const params = new URLSearchParams();
  if (options?.accountId) params.set("accountId", options.accountId);
  if (options?.folderId) params.set("folderId", options.folderId);
  const query = params.toString() ? `?${params.toString()}` : "";

  const url = `${API_BASE}/export/drive${query}`;

  return handleResponse<{ webViewLink: string; fileId: string }>(
    await fetch(url, {
      method: "POST",
      headers,
      body: form,
    })
  );
}

export function getGoogleOAuthUrl(from?: string) {
  const query = from ? `?from=${encodeURIComponent(from)}` : "";
  return `${API_BASE}/oauth2/authorization/google${query}`;
}

export function getGoogleDriveAuthorizeUrl(from?: string, token?: string) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  const jwt = token || (typeof window !== "undefined" ? localStorage.getItem("graffiti:auth:token") : null);
  if (jwt) params.set("token", jwt);
  const query = params.toString() ? `?${params.toString()}` : "";
  return `${API_BASE}/export/drive/oauth/authorize${query}`;
}

export async function apiIssueDesktopHandoff(deviceId?: string, deviceLabel?: string) {
  const res = await fetch(`${API_BASE}/auth/desktop-handoff/issue`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ deviceId, deviceLabel }),
  });
  return handleResponse<{ code: string }>(res);
}

export async function apiExchangeDesktopHandoff(code: string) {
  const res = await fetch(`${API_BASE}/auth/desktop-handoff/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  return handleResponse<{
    token: string;
    userId: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
  }>(res);
}

export async function apiPollDesktopSession(session: string) {
  const res = await fetch(`${API_BASE}/auth/desktop-handoff/poll?session=${encodeURIComponent(session)}`);
  return handleResponse<{ status: "PENDING" | "READY"; code?: string }>(res);
}

export async function apiCompleteDesktopHandoff(session: string, code: string) {
  const res = await fetch(`${API_BASE}/auth/desktop-handoff/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session, code }),
  });
  return handleResponse<{ success: boolean }>(res);
}

export function getWebSocketUrl(): string {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  const apiBase = getApiBaseUrl();
  const wsBase = apiBase ? apiBase.replace(/^http(s?):/, "ws$1:") : "wss://api-graffiti.ankitarsh.me";
  return `${wsBase}/ws`;
}

export { API_BASE };
