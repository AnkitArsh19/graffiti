import React, { useState } from "react";
import { Palette, Sparkles, X, Check, RefreshCw, Wand2 } from "lucide-react";
import type { CanvasElement } from "../types";
import { apiMorphTheme } from "../lib/api";

interface ThemeMorphPanelProps {
  isOpen: boolean;
  onClose: () => void;
  elements: CanvasElement[];
  onApplyTheme: (updatedElements: CanvasElement[], background?: string) => void;
}

const THEME_PRESETS = [
  { name: "Cyberpunk Blueprint", description: "Neon cyan/magenta on dark grid, sharp lines", preview: "#06b6d4" },
  { name: "Retro Paper", description: "Warm sepia, charcoal rough ink, cream tint", preview: "#d97706" },
  { name: "Executive Pitch", description: "Deep navy, slate grey, polished architect lines", preview: "#3b82f6" },
  { name: "Neon Synthwave", description: "Electric violet, hot pink, vivid accents", preview: "#ec4899" },
  { name: "Minimalist Monochrome", description: "High contrast pure black & white, modern minimalist", preview: "#e4e4e7" },
  { name: "Pastel Creative", description: "Soft lavender, mint green, and buttercup yellow", preview: "#a78bfa" },
];

export function ThemeMorphPanel({
  isOpen,
  onClose,
  elements,
  onApplyTheme,
}: ThemeMorphPanelProps) {
  const [selectedPreset, setSelectedPreset] = useState<string>("Cyberpunk Blueprint");
  const [customPrompt, setCustomPrompt] = useState<string>("");
  const [applyToBackground, setApplyToBackground] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  if (!isOpen) return null;

  const activeThemePrompt = customPrompt.trim() ? customPrompt.trim() : selectedPreset;

  async function handleMorph() {
    if (elements.length === 0) {
      setErrorMsg("Canvas is empty. Add elements before applying a theme.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessInfo(null);

    try {
      const resp = await apiMorphTheme({
        themePrompt: activeThemePrompt,
        elements,
        applyToBackground,
      });

      if (resp && resp.success) {
        onApplyTheme(resp.updatedElements || [], resp.canvasBackground);
        setSuccessInfo(`Applied "${resp.themeName}" aesthetic across ${resp.elementsMorphed ?? resp.updatedElements?.length ?? elements.length} elements! Spatial coordinates strictly preserved.`);
      } else {
        setErrorMsg(resp?.detail || "Theme morphing failed.");
      }
    } catch (err: any) {
      console.error("Theme morph error:", err);
      setErrorMsg(err.message || "Failed to morph theme.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-labelledby="theme-morph-modal-title"
      style={{
        position: "fixed",
        top: 80,
        right: 24,
        width: 390,
        zIndex: 100,
        background: "var(--bg-surface, #18181b)",
        border: "1px solid var(--border-color, rgba(255, 255, 255, 0.12))",
        borderRadius: 16,
        boxShadow: "0 20px 40px rgba(0, 0, 0, 0.45)",
        backdropFilter: "blur(20px)",
        color: "var(--text-primary, #f4f4f5)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: "1px solid var(--border-color, rgba(255, 255, 255, 0.08))",
          background: "rgba(255, 255, 255, 0.02)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "rgba(236, 72, 153, 0.15)",
              color: "#f472b6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Palette size={18} />
          </div>
          <div>
            <div id="theme-morph-modal-title" style={{ fontWeight: 600, fontSize: 15 }}>
              AI Theme & Aesthetic Engine
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted, #a1a1aa)" }}>
              Groq Llama 3.3 70B & Rule Engine • Coordinate-Preserving
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-muted, #a1a1aa)",
            cursor: "pointer",
            padding: 4,
            borderRadius: 6,
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 12, color: "var(--text-secondary, #d4d4d8)", lineHeight: 1.5 }}>
          Generatively re-styles all canvas shapes, strokes, fills, and typography without moving a single node.
        </div>

        {/* Presets List */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted, #a1a1aa)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8, display: "block" }}>
            Curated Aesthetic Palettes
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {THEME_PRESETS.map((p) => {
              const isSelected = selectedPreset === p.name && !customPrompt;
              return (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => {
                    setSelectedPreset(p.name);
                    setCustomPrompt("");
                  }}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    textAlign: "left",
                    border: isSelected ? "1px solid #ec4899" : "1px solid var(--border-color, rgba(255, 255, 255, 0.08))",
                    background: isSelected ? "rgba(236, 72, 153, 0.15)" : "rgba(255, 255, 255, 0.03)",
                    color: "var(--text-primary, #f4f4f5)",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.preview }} />
                    <span style={{ color: isSelected ? "#f472b6" : "inherit" }}>{p.name}</span>
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-muted, #a1a1aa)", lineHeight: 1.3 }}>
                    {p.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Prompt */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted, #a1a1aa)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6, display: "block" }}>
            Or Enter Custom Aesthetic Mood:
          </label>
          <input
            type="text"
            placeholder="e.g. Vintage Blueprint, Solarized Dark, 1980s Arcade..."
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              background: "rgba(0, 0, 0, 0.25)",
              border: "1px solid var(--border-color, rgba(255, 255, 255, 0.12))",
              color: "#ffffff",
              fontSize: 12,
              outline: "none",
            }}
          />
        </div>

        {/* Apply Background Toggle */}
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer", color: "var(--text-secondary, #d4d4d8)" }}>
          <input
            type="checkbox"
            checked={applyToBackground}
            onChange={(e) => setApplyToBackground(e.target.checked)}
            style={{ accentColor: "#ec4899" }}
          />
          <span>Also adapt canvas background tint</span>
        </label>

        {errorMsg && (
          <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#fca5a5", fontSize: 12 }}>
            {errorMsg}
          </div>
        )}

        {successInfo && (
          <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.3)", color: "#6ee7b7", fontSize: 12 }}>
            {successInfo}
          </div>
        )}

        {/* Action Button */}
        <button
          type="button"
          onClick={handleMorph}
          disabled={isLoading || elements.length === 0}
          style={{
            marginTop: 4,
            padding: "12px 16px",
            borderRadius: 10,
            border: "none",
            background: "linear-gradient(135deg, #ec4899 0%, #db2777 100%)",
            color: "#ffffff",
            fontWeight: 600,
            fontSize: 13,
            cursor: isLoading || elements.length === 0 ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            boxShadow: "0 4px 14px rgba(236, 72, 153, 0.35)",
          }}
        >
          {isLoading ? (
            <>
              <RefreshCw size={15} className="animate-spin" />
              <span>Morphing Design Palettes...</span>
            </>
          ) : (
            <>
              <Wand2 size={15} />
              <span>Morph All Canvas Elements</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
