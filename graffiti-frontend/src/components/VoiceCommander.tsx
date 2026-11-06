import React, { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Sparkles, X, Layers, Activity } from "lucide-react";
import type { ToolId, CanvasElement } from "../types";
import { apiVoiceStoryboard } from "../lib/api";
import { parseVoiceCommand } from "../lib/voiceCommands";

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
  onClearCanvas?: () => void;
  onBeautify: () => void;
  onInsertStoryboardElements?: (elements: CanvasElement[]) => void;
  existingElements?: CanvasElement[];
  onSolveMath?: () => void;
  onTidyUp?: () => void;
}

export function VoiceCommander(props: VoiceCommanderProps) {
  const {
    isListening,
    onToggle,
    onSelectTool,
    onUndo,
    onRedo,
    onZoomIn,
    onZoomOut,
    onResetView,
    onNewPage,
    onClearCanvas,
    onBeautify,
    onInsertStoryboardElements,
    existingElements,
    onSolveMath,
  } = props;

  const propsRef = useRef(props);
  propsRef.current = props;

  const [transcript, setTranscript] = useState("");
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [isStoryboardMode, setIsStoryboardMode] = useState(false);
  const [isProcessingAi, setIsProcessingAi] = useState(false);
  const recognitionRef = useRef<any>(null);
  const lastExecutedTextRef = useRef<string>("");
  const autoCloseTimerRef = useRef<any>(null);
  const hasExecutedRef = useRef<boolean>(false);

  useEffect(() => {
    return () => {
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      if (hasExecutedRef.current) return;

      const current = event.resultIndex;
      const text = event.results[current][0].transcript.toLowerCase().trim();
      setTranscript(text);

      if (isStoryboardMode) {
        if (event.results[current].isFinal) {
          triggerStoryboardExtraction(text);
        }
      } else {
        // Immediate command execution: don't stall waiting for isFinal
        if (text && text !== lastExecutedTextRef.current) {
          const executed = processCommand(text);
          if (executed) {
            hasExecutedRef.current = true;
            lastExecutedTextRef.current = text;
            try {
              recognition.stop();
            } catch { }

            // Auto-close HUD after short confirmation window (950ms)
            if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
            autoCloseTimerRef.current = setTimeout(() => {
              propsRef.current.onToggle();
            }, 950);
          }
        }

        if (event.results[current].isFinal) {
          lastExecutedTextRef.current = "";
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
      } catch { }
    };
  }, [isStoryboardMode, onInsertStoryboardElements, existingElements]);

  useEffect(() => {
    if (!recognitionRef.current) return;
    try {
      if (isListening) {
        hasExecutedRef.current = false;
        lastExecutedTextRef.current = "";
        if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
        recognitionRef.current.start();
        setTranscript("");
        setLastAction(isStoryboardMode ? "Listening for architecture storytelling..." : "Listening...");
      } else {
        hasExecutedRef.current = false;
        if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
        recognitionRef.current.stop();
        setLastAction(null);
        setTranscript("");
      }
    } catch { }
  }, [isListening, isStoryboardMode]);

  async function triggerStoryboardExtraction(spokenText: string) {
    if (!spokenText || spokenText.length < 5 || !onInsertStoryboardElements) return;

    setIsProcessingAi(true);
    setLastAction("Synthesizing system blocks with Groq Llama 3.3...");

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
        hasExecutedRef.current = true;

        try {
          recognitionRef.current?.stop();
        } catch { }

        const closeHud = () => {
          if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
          propsRef.current.onToggle();
        };

        // Audio confirmation: speak the summary back to the user
        if (typeof window !== "undefined" && window.speechSynthesis) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(summary);
          utterance.rate = 1.0;
          utterance.pitch = 1.0;
          utterance.volume = 0.9;
          utterance.onend = () => {
            autoCloseTimerRef.current = setTimeout(closeHud, 600);
          };
          utterance.onerror = () => {
            closeHud();
          };
          window.speechSynthesis.speak(utterance);
          // Fallback timer if speech synthesis stalls
          autoCloseTimerRef.current = setTimeout(closeHud, 4000);
        } else {
          autoCloseTimerRef.current = setTimeout(closeHud, 1800);
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

  function processCommand(phrase: string): boolean {
    const p = propsRef.current;
    const cmd = parseVoiceCommand(phrase);
    if (!cmd) return false;

    setLastAction(cmd.label);

    switch (cmd.type) {
      case "selectTool":
        p.onSelectTool(cmd.tool);
        return true;
      case "undo":
        p.onUndo();
        return true;
      case "redo":
        p.onRedo();
        return true;
      case "zoomIn":
        p.onZoomIn();
        return true;
      case "zoomOut":
        p.onZoomOut();
        return true;
      case "resetView":
        p.onResetView();
        return true;
      case "newPage":
        p.onNewPage();
        return true;
      case "clearCanvas":
        p.onClearCanvas?.();
        return true;
      case "beautify":
        p.onBeautify();
        return true;
      case "tidyUp":
        p.onTidyUp?.();
        return true;
      case "solveMath":
        p.onSolveMath?.();
        return true;
      case "storyboard":
        setIsStoryboardMode(true);
        return true;
      default:
        return false;
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
