// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getBrowserBaseUrl, exchangeDesktopHandoffCode } from "../lib/desktopAuth";
import * as api from "../lib/api";

describe("desktopAuth utilities", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("getBrowserBaseUrl defaults to domain in development and production", () => {
    const url = getBrowserBaseUrl();
    expect(url).toBe("https://graffiti.ankitarsh.me");
  });

  it("exchangeDesktopHandoffCode extracts code from deep link URLs and stores token", async () => {
    const mockAuthResponse = {
      token: "mock-jwt-token-xyz",
      userId: "user-123",
      email: "test@example.com",
      name: "Test User",
      avatarUrl: null,
    };

    const spyExchange = vi.spyOn(api, "apiExchangeDesktopHandoff").mockResolvedValue(mockAuthResponse);

    // Test with deep-link format
    const res = await exchangeDesktopHandoffCode("graffiti://auth/callback?code=single_use_code_999");
    expect(spyExchange).toHaveBeenCalledWith("single_use_code_999");
    expect(res.token).toBe("mock-jwt-token-xyz");
    expect(localStorage.getItem("graffiti:auth:token")).toBe("mock-jwt-token-xyz");
  });

  it("exchangeDesktopHandoffCode throws when code is missing", async () => {
    await expect(exchangeDesktopHandoffCode("")).rejects.toThrow("Sign-in code is required");
  });

  it("getGoogleDriveAuthorizeUrl attaches platform and stored auth token", () => {
    localStorage.setItem("graffiti:auth:token", "jwt-test-abc-123");
    const url = api.getGoogleDriveAuthorizeUrl("web");
    expect(url).toContain("https://api-graffiti.ankitarsh.me/export/drive/oauth/authorize");
    expect(url).toContain("from=web");
    expect(url).toContain("token=jwt-test-abc-123");
  });

  it("getGoogleDriveAuthorizeUrl respects explicit token argument", () => {
    const url = api.getGoogleDriveAuthorizeUrl("desktop", "custom-jwt-456");
    expect(url).toContain("from=desktop");
    expect(url).toContain("token=custom-jwt-456");
  });
});
