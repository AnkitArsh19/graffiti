from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class ActionItem(BaseModel):
    id: str
    task: str
    assignee: Optional[str] = "Unassigned"
    priority: str = "medium"  # high, medium, low
    completed: bool = False


class KeyDecision(BaseModel):
    id: str
    decision: str
    context: Optional[str] = ""


class OpenQuestion(BaseModel):
    id: str
    question: str
    status: str = "unresolved"


class NotebookSummarizeRequest(BaseModel):
    text: str = Field(..., description="Aggregated markdown or plain text from notebook blocks")
    pageTitle: Optional[str] = "Whiteboard Notes"
    blocks: Optional[List[Dict[str, Any]]] = None


class NotebookSummarizeResponse(BaseModel):
    success: bool = True
    executiveSummary: str = ""
    actionItems: List[ActionItem] = Field(default_factory=list)
    keyDecisions: List[KeyDecision] = Field(default_factory=list)
    openQuestions: List[OpenQuestion] = Field(default_factory=list)
    aiProvider: str = "groq-openai/gpt-oss-120b"
    latencyMs: Optional[float] = None
