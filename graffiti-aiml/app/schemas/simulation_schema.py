from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class SimulationStep(BaseModel):
    stepIndex: int
    activeNodeId: str
    activeEdgeId: Optional[str] = None
    stepDescription: str
    stateVariables: Dict[str, Any] = Field(default_factory=dict)
    log: str
    isTerminal: bool = False


class StateGraphNode(BaseModel):
    id: str
    label: str
    nodeType: str  # start, process, decision, end, io


class StateGraphEdge(BaseModel):
    id: str
    sourceId: str
    targetId: str
    label: Optional[str] = ""
    condition: Optional[str] = None


class FlowSimulateRequest(BaseModel):
    elements: List[Dict[str, Any]] = Field(..., description="Canvas elements containing flowchart shapes, labels and arrows")
    initialInputs: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Test input variables for execution")


class FlowSimulateResponse(BaseModel):
    success: bool = True
    graphNodes: List[StateGraphNode] = Field(default_factory=list)
    graphEdges: List[StateGraphEdge] = Field(default_factory=list)
    executionSteps: List[SimulationStep] = Field(default_factory=list)
    totalSteps: int = 0
    flowSummary: str = ""
    aiProvider: str = "groq-llama-3.3-70b-versatile"
