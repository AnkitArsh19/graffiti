import { describe, expect, it } from "vitest";
import { compareVersions } from "../components/DesktopUpdateModal";

describe("Desktop Update compareVersions", () => {
  it("correctly identifies when a newer version is available", () => {
    expect(compareVersions("0.3.1", "0.3.0")).toBe(1);
    expect(compareVersions("0.4.0", "0.3.0")).toBe(1);
    expect(compareVersions("1.0.0", "0.3.0")).toBe(1);
    expect(compareVersions("0.3.10", "0.3.9")).toBe(1);
  });

  it("handles leading 'v' prefix seamlessly", () => {
    expect(compareVersions("v0.3.1", "0.3.0")).toBe(1);
    expect(compareVersions("0.3.1", "v0.3.0")).toBe(1);
    expect(compareVersions("v0.3.0", "v0.3.0")).toBe(0);
  });

  it("identifies identical versions as up-to-date", () => {
    expect(compareVersions("0.3.0", "0.3.0")).toBe(0);
    expect(compareVersions("v0.3.0", "0.3.0")).toBe(0);
  });

  it("identifies when the installed version is ahead (development / pre-release)", () => {
    expect(compareVersions("0.2.9", "0.3.0")).toBe(-1);
    expect(compareVersions("0.2.0", "0.3.0")).toBe(-1);
  });

  it("handles differing semantic version depth (e.g. 0.3 vs 0.3.0)", () => {
    expect(compareVersions("0.3", "0.3.0")).toBe(0);
    expect(compareVersions("0.3.0.1", "0.3.0")).toBe(1);
  });
});

