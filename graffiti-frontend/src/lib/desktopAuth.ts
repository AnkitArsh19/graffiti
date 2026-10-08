/**
 * Desktop Authentication Handoff Utilities (RFC 8252 pattern).
 * Manages external browser login launch, one-time handoff code issuance and exchange.
 */
import { isTauri, invoke } from "@tauri-apps/api/core";
import { apiIssueDesktopHandoff, apiExchangeDesktopHandoff } from "./api";

export function isDesktopApp(): boolean {
  if (typeof window === "undefined") return false;
  return (
    isTauri() ||
    Boolean(
      (window as any).__TAURI_INTERNALS__ ||
      (window as any).__TAURI__ ||
      window.location.search.includes("platform=desktop")
    )
  );
}

export function getBrowserBaseUrl(): string {
  if (typeof window !== "undefined" && (import.meta as any).env?.VITE_BROWSER_URL) {
    return (import.meta as any).env.VITE_BROWSER_URL;
  }
  // Default to domain in development and production
  return "https://graffiti.ankitarsh.me";
}

export async function openExternalBrowser(url: string): Promise<void> {
  if (isDesktopApp()) {
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(url);
      return;
    } catch (err) {
      console.warn("Tauri openUrl plugin failed, trying invoke fallback:", err);
      try {
        await invoke("open_browser_url", { url });
        return;
      } catch (err2) {
        console.warn("Tauri invoke open_browser_url failed, falling back:", err2);
      }
    }
  }
  if (typeof window !== "undefined") {
    window.open(url, "_blank");
  }
}

export async function focusDesktopWindow(): Promise<void> {
  if (isDesktopApp()) {
    try {
      await invoke("focus_main_window");
    } catch {}
  }
}

export async function getLaunchDeepLink(): Promise<string | null> {
  if (isDesktopApp()) {
    try {
      const link = await invoke<string | null>("get_deep_link_url");
      return link;
    } catch {}
  }
  return null;
}

export async function startBrowserLogin(
  mode: "login" | "register" = "login",
  session?: string
): Promise<void> {
  const baseUrl = getBrowserBaseUrl();
  let url = `${baseUrl}/desktop-auth?mode=${mode}`;
  if (session) {
    url += `&session=${encodeURIComponent(session)}`;
  }
  await openExternalBrowser(url);
}

export async function issueDesktopHandoffCode(deviceLabel?: string): Promise<string> {
  const res = await apiIssueDesktopHandoff(undefined, deviceLabel || "Graffiti Desktop");
  return res.code;
}

export async function exchangeDesktopHandoffCode(rawCode: string) {
  if (!rawCode || !rawCode.trim()) {
    throw new Error("Sign-in code is required");
  }

  let cleanCode = rawCode.trim();
  // Extract code if user pasted a full URL (e.g. graffiti://auth/callback?code=... or https://.../open-app?code=...)
  if (cleanCode.includes("code=")) {
    try {
      const parsed = new URL(cleanCode.replace("graffiti://", "https://graffiti.desktop/"));
      cleanCode = parsed.searchParams.get("code") || cleanCode;
    } catch {
      const match = cleanCode.match(/code=([^&]+)/);
      if (match) cleanCode = match[1];
    }
  }

  const authData = await apiExchangeDesktopHandoff(cleanCode);
  if (authData.token) {
    localStorage.setItem("graffiti:auth:token", authData.token);
    const u = {
      userId: authData.userId,
      email: authData.email,
      name: authData.name,
      avatarUrl: authData.avatarUrl,
      provider: "LOCAL",
    };
    localStorage.setItem("graffiti:auth:user", JSON.stringify(u));
    window.dispatchEvent(new CustomEvent("graffiti:auth:login", { detail: authData }));
    await focusDesktopWindow();
  }
  return authData;
}
