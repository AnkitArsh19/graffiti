import React, { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Sparkles, X } from "lucide-react";
import type { ToolId } from "../types";

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
}: VoiceCommanderProps) {
  const [transcript, setTranscript] = useState("");
  const [lastAction, setLastAction] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

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
        processCommand(text);
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
  }, []);

  useEffect(() => {
    if (!recognitionRef.current) return;
    try {
      if (isListening) {
        recognitionRef.current.start();
        setTranscript("");
        setLastAction("Listening...");
      } else {
        recognitionRef.current.stop();
        setLastAction(null);
      }
    } catch {}
  }, [isListening]);

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
        background: "rgba(24, 24, 27, 0.9)",
        backdropFilter: "blur(8px)",
        border: "1px solid rgba(239, 68, 68, 0.35)",
        boxShadow: "0 10px 30px rgba(239, 68, 68, 0.2)",
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
          background: "#ef4444",
          boxShadow: "0 0 10px #ef4444",
        }}
      />
      <Mic size={16} color="#ef4444" />
      <div style={{ fontSize: 13, fontWeight: 500 }}>
        {transcript ? (
          <span style={{ color: "#fca5a5" }}>"{transcript}"</span>
        ) : lastAction ? (
          <span style={{ color: "#86efac" }}>{lastAction}</span>
        ) : (
          <span>Listening for voice commands (Alt+V)...</span>
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