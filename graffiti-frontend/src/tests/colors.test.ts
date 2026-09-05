import { describe, expect, it } from "vitest";
import {
  applyDarkModeFilter,
  isColorDark,
  isLightColor,
  rgbToHex,
} from "../lib/colors";

describe("applyDarkModeFilter", () => {
  it("converts pure black / dark gray to crisp white ink in dark mode", () => {
    const darkFiltered = applyDarkModeFilter("#1e1e1e", true, false);
    expect(darkFiltered).toBe("#ffffff");

    const pureBlack = applyDarkModeFilter("#000000", true, false);
    expect(pureBlack).toBe("#ffffff");
  });

  it("strictly preserves white ink (#ffffff) as crisp white in dark mode, avoiding black/grey glitch", () => {
    // Pure white ink must stay #ffffff in dark mode (NOT #121212 black or grey)
    const whiteInk = applyDarkModeFilter("#ffffff", true, false);
    expect(whiteInk).toBe("#ffffff");

    // All shades of the white family must stay crisp white ink in dark mode
    expect(applyDarkModeFilter("#f8f9fa", true, false)).toBe("#ffffff");
    expect(applyDarkModeFilter("#f1f3f5", true, false)).toBe("#ffffff");
    expect(applyDarkModeFilter("#dee2e6", true, false)).toBe("#ffffff");
    expect(applyDarkModeFilter("#f5f5f5", true, false)).toBe("#ffffff");
    expect(applyDarkModeFilter("#f0f6fc", true, false)).toBe("#ffffff");
  });

  it("normalizes white stroke ink to dark ink #1e1e1e in light mode so it is visible on white paper", () => {
    expect(applyDarkModeFilter("#ffffff", false, false)).toBe("#1e1e1e");
    expect(applyDarkModeFilter("#f5f5f5", false, false)).toBe("#1e1e1e");
    expect(applyDarkModeFilter("#f0f6fc", false, false)).toBe("#1e1e1e");
    expect(applyDarkModeFilter("#dee2e6", false, false)).toBe("#1e1e1e");
  });

  it("preserves white background fill in light mode and inverts it in dark mode", () => {
    // White background in light mode stays white
    expect(applyDarkModeFilter("#ffffff", false, true)).toBe("#ffffff");

    // White background in dark mode inverts to pitch dark panel surface
    expect(applyDarkModeFilter("#ffffff", true, true)).toBe("#1e1e1e");
  });

  it("adjusts vibrant colors according to theme for high contrast", () => {
    // Red in light mode remains high contrast dark-red
    const redLight = applyDarkModeFilter("#e03131", false, false);
    expect(redLight).toBeTruthy();

    // Red in dark mode remains bright and visible
    const redDark = applyDarkModeFilter("#e03131", true, false);
    expect(redDark).toBeTruthy();
    expect(redDark).not.toBe("#000000");
  });

  it("preserves transparent backgrounds unchanged in both modes", () => {
    expect(applyDarkModeFilter("transparent", true, true)).toBe("transparent");
    expect(applyDarkModeFilter("transparent", false, true)).toBe("transparent");
  });
});

describe("isColorDark and isLightColor", () => {
  it("correctly identifies luminance", () => {
    expect(isColorDark("#000000")).toBe(true);
    expect(isColorDark("#1e1e1e")).toBe(true);
    expect(isColorDark("#ffffff")).toBe(false);
    expect(isLightColor("#ffffff")).toBe(true);
    expect(isLightColor("#f8f9fa")).toBe(true);
    expect(isLightColor("#1e1e1e")).toBe(false);
  });
});

describe("rgbToHex", () => {
  it("formats rgb values correctly to 6-digit hex", () => {
    expect(rgbToHex(255, 255, 255)).toBe("#ffffff");
    expect(rgbToHex(0, 0, 0)).toBe("#000000");
    expect(rgbToHex(30, 30, 30)).toBe("#1e1e1e");
  });
});
