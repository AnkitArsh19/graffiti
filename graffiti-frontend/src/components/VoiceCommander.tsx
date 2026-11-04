import React, { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Sparkles, X, Layers, Activity } from "lucide-react";
import type { ToolId, CanvasElement } from "../types";
import { apiVoiceStoryboard } from "../lib/api";

interface VoiceCommanderProps {
  isListening: boolean;
  onToggle: () => void;
  onSelectTool: (tool: ToolId) => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onNewPage: () => void;
  onBeautify: () => void;
  onInsertStoryboardElements?: (elements: CanvasElement[]) => void;
  existingElements?: CanvasElement[];
}

export function VoiceCommander({
  isListening,
  onToggle,
  onSelectTool,
  onUndo,
  onRedo,
  onZoomIn,
  onZoomOut,
  onResetView,
  onNewPage,
  onBeautify,
  onInsertStoryboardElements,
  existingElements,
}: VoiceCommanderProps) {
  const [transcript, setTranscript] = useState("");
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [isStoryboardMode, setIsStoryboardMode] = useState(false);
  const [isProcessingAi, setIsProcessingAi] = useState(false);
  const recognitionRef = useRef<any>(null);
  const debounceTimerRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      const current = event.resultIndex;
      const text = event.results[current][0].transcript.toLowerCase().trim();
      setTranscript(text);

      if (event.results[current].isFinal) {
        if (isStoryboardMode) {
          triggerStoryboardExtraction(text);
        } else {
          processCommand(text);
        }
      }
    };

    recognition.onerror = (err: any) => {
      console.warn("Speech recognition error:", err);
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch {}
    };
  }, [isStoryboardMode, onInsertStoryboardElements, existingElements]);

  useEffect(() => {
    if (!recognitionRef.current) return;
    try {
      if (isListening) {
        recognitionRef.current.start();
        setTranscript("");
        setLastAction(isStoryboardMode ? "Listening for architecture storytelling..." : "Listening...");
      } else {
        recognitionRef.current.stop();
        setLastAction(null);
      }
    } catch {}
  }, [isListening, isStoryboardMode]);

  async function triggerStoryboardExtraction(spokenText: string) {
    if (!spokenText || spokenText.length < 5 || !onInsertStoryboardElements) return;

    setIsProcessingAi(true);
    setLastAction("Synthesizing system blocks with Gemini Flash...");

    try {
      const resp = await apiVoiceStoryboard({
        transcript: spokenText,
        existingElements: existingElements || [],
        anchorPosition: { x: 300, y: 250 },
      });

      if (resp && resp.success && resp.newElements && resp.newElements.length > 0) {
        onInsertStoryboardElements(resp.newElements);
        const entityCount = resp.entitiesDetected?.length || 0;
        const summary = resp.summary
          ? resp.summary
          : `Placed ${entityCount} architecture block${entityCount !== 1 ? "s" : ""} on the canvas.`;
        setLastAction(`Placed ${entityCount} architecture block(s) & arrows!`);

        // Audio confirmation: speak the summary back to the user
        if (typeof window !== "undefined" && window.speechSynthesis) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(summary);
          utterance.rate = 1.0;
          utterance.pitch = 1.0;
          utterance.volume = 0.9;
          window.speechSynthesis.speak(utterance);
        }
      } else {
        setLastAction("Heard: " + spokenText.slice(0, 30));
      }
    } catch (err) {
      console.warn("Voice storyboard error:", err);
      setLastAction("Storyboard extraction unavailable.");
    } finally {
      setIsProcessingAi(false);
    }
  }

  function processCommand(phrase: string) {
    if (phrase.includes("rectangle") || phrase.includes("box")) {
      onSelectTool("rectangle");
      setLastAction("Selected Rectangle Tool");
    } else if (phrase.includes("circle") || phrase.includes("ellipse") || phrase.includes("oval")) {
      onSelectTool("ellipse");
      setLastAction("Selected Ellipse Tool");
    } else if (phrase.includes("diamond")) {
      onSelectTool("diamond");
      setLastAction("Selected Diamond Tool");
    } else if (phrase.includes("arrow")) {
      onSelectTool("arrow");
      setLastAction("Selected Arrow Tool");
    } else if (phrase.includes("line")) {
      onSelectTool("line");
      setLastAction("Selected Line Tool");
    } else if (phrase.includes("pen") || phrase.includes("pencil") || phrase.includes("draw")) {
      onSelectTool("pen");
      setLastAction("Selected Pen Tool");
    } else if (phrase.includes("text") || phrase.includes("type")) {
      onSelectTool("text");
      setLastAction("Selected Text Tool");
    } else if (phrase.includes("sticky") || phrase.includes("note")) {
      onSelectTool("sticky");
      setLastAction("Selected Sticky Note Tool");
    } else if (phrase.includes("eraser") || phrase.includes("erase")) {
      onSelectTool("eraser");
      setLastAction("Selected Eraser Tool");
    } else if (phrase.includes("select") || phrase.includes("pointer")) {
      onSelectTool("select");
      setLastAction("Selected Select Tool");
    } else if (phrase.includes("hand") || phrase.includes("pan")) {
      onSelectTool("hand");
      setLastAction("Selected Hand Tool");
    } else if (phrase.includes("undo")) {
      onUndo();
      setLastAction("Triggered Undo");
    } else if (phrase.includes("redo")) {
      onRedo();
      setLastAction("Triggered Redo");
    } else if (phrase.includes("zoom in")) {
      onZoomIn();
      setLastAction("Zoomed In");
    } else if (phrase.includes("zoom out")) {
      onZoomOut();
      setLastAction("Zoomed Out");
    } else if (phrase.includes("reset view") || phrase.includes("center")) {
      onResetView();
      setLastAction("Reset View");
    } else if (phrase.includes("new page") || phrase.includes("add page")) {
      onNewPage();
      setLastAction("Created New Page");
    } else if (phrase.includes("beautify") || phrase.includes("smooth")) {
      onBeautify();
      setLastAction("AI Shape Beautify Triggered");
    } else if (phrase.includes("storyboard")) {
      setIsStoryboardMode(true);
      setLastAction("Switched to Live Storyboard Mode!");
    }
  }

  if (!isListening) return null;

  return (
    <div
      className="voice-commander-hud"
      style={{
        position: "fixed",
        top: 60,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 90,
        background: "rgba(24, 24, 27, 0.92)",
        backdropFilter: "blur(12px)",
        border: isStoryboardMode
          ? "1px solid rgba(139, 92, 246, 0.5)"
          : "1px solid rgba(239, 68, 68, 0.35)",
        boxShadow: isStoryboardMode
          ? "0 10px 30px rgba(139, 92, 246, 0.25)"
          : "0 10px 30px rgba(239, 68, 68, 0.2)",
        borderRadius: 24,
        padding: "8px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        color: "#ffffff",
        animation: "pulse 2s infinite ease-in-out",
      }}
    >
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: isStoryboardMode ? "#a855f7" : "#ef4444",
          boxShadow: isStoryboardMode ? "0 0 10px #a855f7" : "0 0 10px #ef4444",
        }}
      />
      <Mic size={16} color={isStoryboardMode ? "#a855f7" : "#ef4444"} />

      {/* Mode Switcher Pill */}
      <button
        type="button"
        onClick={() => setIsStoryboardMode((prev) => !prev)}
        style={{
          background: isStoryboardMode ? "rgba(168, 85, 247, 0.25)" : "rgba(255, 255, 255, 0.08)",
          border: isStoryboardMode ? "1px solid #a855f7" : "1px solid rgba(255, 255, 255, 0.15)",
          color: isStoryboardMode ? "#d8b4fe" : "#d4d4d8",
          padding: "2px 8px",
          borderRadius: 12,
          fontSize: 10,
          fontWeight: 600,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <Sparkles size={10} />
        <span>{isStoryboardMode ? "Live Storyboard" : "Commands"}</span>
      </button>

      <div style={{ fontSize: 13, fontWeight: 500, minWidth: 200, maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {isProcessingAi ? (
          <span style={{ color: "#d8b4fe" }}>Extracting entities & layout...</span>
        ) : transcript ? (
          <span style={{ color: isStoryboardMode ? "#e9d5ff" : "#fca5a5" }}>"{transcript}"</span>
        ) : lastAction ? (
          <span style={{ color: "#86efac" }}>{lastAction}</span>
        ) : (
          <span>{isStoryboardMode ? "Describe your system architecture out loud..." : "Listening for voice commands (Alt+V)..."}</span>
        )}
      </div>

      <button
        type="button"
        onClick={onToggle}
        aria-label="Stop Voice Commander"
        style={{
          background: "transparent",
          border: "none",
          color: "rgba(255,255,255,0.6)",
          cursor: "pointer",
          padding: 2,
          display: "flex",
        }}
      >
        <X size={15} />
      </button>
    </div>
  );
}
