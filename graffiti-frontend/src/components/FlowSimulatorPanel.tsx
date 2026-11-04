import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Sparkles,
  X,
  Activity,
  Terminal,
  Layers,
  CheckCircle,
} from "lucide-react";
import type { CanvasElement } from "../types";
import { apiSimulateFlow } from "../lib/api";

export interface SimulationStep {
  stepIndex: number;
  activeNodeId: string;
  activeEdgeId?: string | null;
  stepDescription: string;
  stateVariables: Record<string, any>;
  log: string;
  isTerminal: boolean;
}

interface FlowSimulatorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  elements: CanvasElement[];
  onHighlightElement?: (elementId: string | null) => void;
}

export function FlowSimulatorPanel({
  isOpen,
  onClose,
  elements,
  onHighlightElement,
}: FlowSimulatorPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [flowSummary, setFlowSummary] = useState<string | null>(null);
  const [executionSteps, setExecutionSteps] = useState<SimulationStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [aiProvider, setAiProvider] = useState<string | null>(null);

  const autoPlayTimerRef = useRef<any>(null);

  if (!isOpen) return null;

  async function handleStartSimulation() {
    setIsLoading(true);
    setErrorMsg(null);
    setIsPlaying(false);

    try {
      const resp = await apiSimulateFlow({
        elements,
        initialInputs: {
          requestId: `req_${Math.floor(Math.random() * 9000 + 1000)}`,
          status: "INIT",
          payloadSizeKb: 12.4,
          timestamp: new Date().toISOString(),
        },
      });

      if (resp && resp.success) {
        setFlowSummary(resp.flowSummary || "Simulation compiled.");
        setExecutionSteps(resp.executionSteps || []);
        setCurrentStepIndex(0);
        setAiProvider(resp.aiProvider || "groq-llama-3.1-70b-versatile");

        if (resp.executionSteps && resp.executionSteps.length > 0 && onHighlightElement) {
          onHighlightElement(resp.executionSteps[0].activeNodeId);
        }
      } else {
        setErrorMsg(resp?.flowSummary || "Could not simulate flow. Ensure your diagram has shapes and connecting arrows.");
      }
    } catch (err: any) {
      console.error("Simulation error:", err);
      setErrorMsg(err.message || "Failed to simulate flow.");
    } finally {
      setIsLoading(false);
    }
  }

  // Auto-play stepper loop
  useEffect(() => {
    if (isPlaying && executionSteps.length > 0) {
      autoPlayTimerRef.current = setInterval(() => {
        setCurrentStepIndex((prev) => {
          if (prev >= executionSteps.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          const next = prev + 1;
          if (onHighlightElement) {
            onHighlightElement(executionSteps[next]?.activeNodeId || null);
          }
          return next;
        });
      }, 1500);
    } else {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
    }

    return () => {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
    };
  }, [isPlaying, executionSteps]);

  function handleStep(index: number) {
    if (index >= 0 && index < executionSteps.length) {
      setCurrentStepIndex(index);
      if (onHighlightElement) {
        onHighlightElement(executionSteps[index]?.activeNodeId || null);
      }
    }
  }

  function handleClose() {
    setIsPlaying(false);
    if (onHighlightElement) onHighlightElement(null);
    onClose();
  }

  const currentStep = executionSteps[currentStepIndex] || null;

  return (
    <div
      role="dialog"
      aria-labelledby="flow-sim-modal-title"
      style={{
        position: "fixed",
        top: 80,
        right: 24,
        width: 440,
        maxHeight: "calc(100vh - 120px)",
        zIndex: 100,
        background: "var(--bg-surface, #18181b)",
        border: "1px solid var(--border-color, rgba(255, 255, 255, 0.12))",
        borderRadius: 16,
        boxShadow: "0 20px 40px rgba(0, 0, 0, 0.5)",
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
              background: "rgba(14, 165, 233, 0.15)",
              color: "#38bdf8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Activity size={18} />
          </div>
          <div>
            <div id="flow-sim-modal-title" style={{ fontWeight: 600, fontSize: 15 }}>
              Spatial Logic & Flow Simulator
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted, #a1a1aa)" }}>
              Behavioral Execution Engine • Groq / Gemini
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={handleClose}
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

      {/* Main Container */}
      <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }}>
        <div style={{ fontSize: 12, color: "var(--text-secondary, #d4d4d8)", lineHeight: 1.5 }}>
          Converts flowchart shapes and directional arrows into an interactive live state machine simulation.
        </div>

        {/* Compile / Run Button */}
        <button
          type="button"
          onClick={handleStartSimulation}
          disabled={isLoading || elements.length === 0}
          style={{
            padding: "10px 16px",
            borderRadius: 10,
            border: "none",
            background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
            color: "#ffffff",
            fontWeight: 600,
            fontSize: 13,
            cursor: isLoading || elements.length === 0 ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            boxShadow: "0 4px 14px rgba(2, 132, 199, 0.35)",
          }}
        >
          <Sparkles size={15} />
          <span>{isLoading ? "Compiling State Graph..." : "Simulate Flowchart Execution"}</span>
        </button>

        {errorMsg && (
          <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#fca5a5", fontSize: 12 }}>
            {errorMsg}
          </div>
        )}

        {flowSummary && (
          <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(14, 165, 233, 0.12)", border: "1px solid rgba(14, 165, 233, 0.25)", fontSize: 12, color: "#7dd3fc" }}>
            <span style={{ fontWeight: 600 }}>Status:</span> {flowSummary}
          </div>
        )}

        {/* Step-by-Step Player Controls */}
        {executionSteps.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
            {/* Player Bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                borderRadius: 10,
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setIsPlaying((p) => !p)}
                  aria-label={isPlaying ? "Pause" : "Play"}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: isPlaying ? "rgba(239, 68, 68, 0.2)" : "rgba(16, 185, 129, 0.2)",
                    border: "none",
                    color: isPlaying ? "#f87171" : "#34d399",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {isPlaying ? <Pause size={15} /> : <Play size={15} />}
                </button>

                <button
                  type="button"
                  onClick={() => handleStep(currentStepIndex + 1)}
                  disabled={currentStepIndex >= executionSteps.length - 1}
                  aria-label="Next Step"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "none",
                    color: "var(--text-secondary, #d4d4d8)",
                    cursor: currentStepIndex >= executionSteps.length - 1 ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <SkipForward size={15} />
                </button>

                <button
                  type="button"
                  onClick={() => handleStep(0)}
                  aria-label="Restart"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "none",
                    color: "var(--text-secondary, #d4d4d8)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <RotateCcw size={14} />
                </button>
              </div>

              <div style={{ fontSize: 12, fontWeight: 600, color: "#38bdf8" }}>
                Step {currentStepIndex + 1} of {executionSteps.length}
              </div>
            </div>

            {/* Stepper Timeline Pills */}
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
              {executionSteps.map((step, idx) => (
                <button
                  key={step.stepIndex}
                  type="button"
                  onClick={() => handleStep(idx)}
                  style={{
                    minWidth: 26,
                    height: 26,
                    borderRadius: 6,
                    border: idx === currentStepIndex ? "1px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.08)",
                    background: idx === currentStepIndex ? "rgba(14, 165, 233, 0.3)" : "rgba(255, 255, 255, 0.03)",
                    color: idx === currentStepIndex ? "#bae6fd" : "var(--text-muted, #71717a)",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {idx + 1}
                </button>
              ))}
            </div>

            {/* Current Step Inspector */}
            {currentStep && (
              <div
                style={{
                  padding: 12,
                  borderRadius: 10,
                  background: "#09090b",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: "#ffffff" }}>
                  {currentStep.stepDescription}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#34d399", fontFamily: "var(--font-code, monospace)" }}>
                  <Terminal size={12} />
                  <span>{currentStep.log}</span>
                </div>

                {/* State Variables Inspector */}
                <div style={{ marginTop: 4 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted, #a1a1aa)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>
                    Live State Variables
                  </div>
                  <pre
                    style={{
                      padding: 8,
                      borderRadius: 6,
                      background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid rgba(255, 255, 255, 0.05)",
                      fontSize: 11,
                      fontFamily: "var(--font-code, monospace)",
                      color: "#93c5fd",
                      margin: 0,
                      overflowX: "auto",
                    }}
                  >
                    {JSON.stringify(currentStep.stateVariables, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
