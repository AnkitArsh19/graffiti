import { describe, expect, it } from "vitest";
import { evaluateMathExpression } from "../lib/mathEvaluator";

describe("mathEvaluator", () => {
  it("evaluates basic arithmetic", () => {
    expect(evaluateMathExpression("2 + 2 =")).toEqual({ success: true, result: 4, formatted: "4" });
    expect(evaluateMathExpression("10 * 5 =")).toEqual({ success: true, result: 50, formatted: "50" });
    expect(evaluateMathExpression("100 / 4")).toEqual({ success: true, result: 25, formatted: "25" });
    expect(evaluateMathExpression("50 - 18 = ?")).toEqual({ success: true, result: 32, formatted: "32" });
  });

  it("handles operator precedence and parentheses", () => {
    expect(evaluateMathExpression("2 + 3 * 4 =")).toEqual({ success: true, result: 14, formatted: "14" });
    expect(evaluateMathExpression("(2 + 3) * 4 =")).toEqual({ success: true, result: 20, formatted: "20" });
    expect(evaluateMathExpression("2^3 + 1 =")).toEqual({ success: true, result: 9, formatted: "9" });
  });

  it("evaluates functions and constants", () => {
    expect(evaluateMathExpression("sqrt(144) =")).toEqual({ success: true, result: 12, formatted: "12" });
    expect(evaluateMathExpression("abs(-42) =")).toEqual({ success: true, result: 42, formatted: "42" });
    expect(evaluateMathExpression("pi")).toEqual({ success: true, result: Math.PI, formatted: "3.141593" });
  });

  it("handles invalid or non-math expressions safely without throwing", () => {
    expect(evaluateMathExpression("hello world =").success).toBe(false);
    expect(evaluateMathExpression("1 / 0 =").success).toBe(false);
    expect(evaluateMathExpression("").success).toBe(false);
  });
});

