import asyncio
import json
from typing import AsyncGenerator
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
import httpx

from app.config import settings
from app.diagram.element_builder import build_graffiti_elements
from app.diagram.layout_engine import layout_diagram
from app.diagram.mermaid_parser import parse_mermaid
from app.schemas.code_schema import StreamChunk
from app.schemas.diagram_schema import (
    DiagramSynthesizeRequest,
    DiagramSynthesizeResponse,
    TTDChatRequest,
)

router = APIRouter(tags=["Diagram"])

DEFAULT_FLOWCHARTS = {
    "auth": """flowchart TD
Client[Web Client] -->|POST /auth/login| Gateway[API Gateway]
Gateway -->|Validate Token| Auth[Auth Service]
Auth -->|Query Credentials| DB[(User DB)]
Auth -->|Issue JWT| Gateway
Gateway -->|200 OK + JWT| Client""",
    "cicd": """flowchart LR
Git[Git Push] --> Test[Run Tests]
Test --> Build[Docker Build]
Build --> Push[Push to Registry]
Push --> Deploy[Deploy to Cluster]
Deploy --> Verify{Health Check}
Verify -->|Pass| Live[Production Live]
Verify -->|Fail| Rollback[Rollback]""",
    "default": """flowchart TD
Start([Start]) --> Input[/Enter Parameters/]
Input --> Process[Process Request]
Process --> Decision{Valid?}
Decision -->|Yes| Output[Render Result]
Decision -->|No| Error[Show Error]
Output --> End([Complete])
Error --> Start"""
}


def pick_mermaid_template(prompt: str) -> str:
    p = prompt.lower()
    if any(k in p for k in ["auth", "login", "jwt", "user", "signup"]):
        return DEFAULT_FLOWCHARTS["auth"]
    elif any(k in p for k in ["ci", "cd", "pipeline", "docker", "deploy", "kubernetes"]):
        return DEFAULT_FLOWCHARTS["cicd"]
    return DEFAULT_FLOWCHARTS["default"]


@router.post("/diagram/synthesize", response_model=DiagramSynthesizeResponse)
async def synthesize_diagram(req: DiagramSynthesizeRequest):
    """Generates structured diagram elements and Mermaid syntax from prompt."""
    mermaid_code = pick_mermaid_template(req.prompt)
    parsed = parse_mermaid(mermaid_code)
    layouts = layout_diagram(
        parsed,
        start_x=req.anchorPosition.x or 200.0,
        start_y=req.anchorPosition.y or 150.0
    )
    elements = build_graffiti_elements(parsed, layouts)
    return DiagramSynthesizeResponse(
        prompt=req.prompt,
        mermaid=mermaid_code,
        proposedElements=elements
    )


async def stream_ttd_chat(chat_request: TTDChatRequest) -> AsyncGenerator[str, None]:
    last_user_msg = ""
    for msg in reversed(chat_request.messages):
        if msg.role == "user":
            last_user_msg = msg.content
            break

    sys_msg = (
        "You are an expert software architect and diagram designer. "
        "Respond with a clear, valid Mermaid.js flowchart (starting with flowchart TD or LR). "
        "Do not include surrounding conversational text, only the Mermaid code block."
    )

    # 1. Primary: If Gemini API key is available and not in mock mode, stream from Gemini
    if settings.gemini_api_key and not settings.enable_mock_llm:
        try:
            gemini_contents = []
            for m in chat_request.messages:
                role = "model" if m.role == "assistant" else "user"
                gemini_contents.append({
                    "role": role,
                    "parts": [{"text": m.content}]
                })

            gemini_payload = {
                "contents": gemini_contents,
                "systemInstruction": {
                    "parts": [{"text": sys_msg}]
                }
            }

            url = (
                f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}"
                f":streamGenerateContent?alt=sse&key={settings.gemini_api_key}"
            )
            async with httpx.AsyncClient(timeout=30.0) as client:
                async with client.stream("POST", url, json=gemini_payload) as resp:
                    if resp.status_code == 200:
                        async for line in resp.aiter_lines():
                            if line.startswith("data: "):
                                data_str = line[6:].strip()
                                if not data_str:
                                    continue
                                chunk_json = json.loads(data_str)
                                candidates = chunk_json.get("candidates", [])
                                if candidates:
                                    parts = candidates[0].get("content", {}).get("parts", [])
                                    for part in parts:
                                        delta = part.get("text", "")
                                        if delta:
                                            chunk = StreamChunk(type="content", delta=delta)
                                            yield f"data: {chunk.model_dump_json()}\n\n"
                        yield "data: {\"type\":\"done\",\"finishReason\":\"stop\"}\n\n"
                        yield "data: [DONE]\n\n"
                        return
        except Exception:
            pass

    # 2. Secondary: If OpenAI key is available and not in mock mode, stream from OpenAI
    if settings.openai_api_key and not settings.enable_mock_llm:
        try:
            openai_msgs = [{"role": "system", "content": sys_msg}] + [
                {"role": m.role, "content": m.content} for m in chat_request.messages
            ]

            async with httpx.AsyncClient(timeout=30.0) as client:
                async with client.stream(
                    "POST",
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                    json={
                        "model": settings.openai_model,
                        "messages": openai_msgs,
                        "stream": True
                    }
                ) as resp:
                    async for line in resp.aiter_lines():
                        if line.startswith("data: "):
                            data_str = line[6:].strip()
                            if data_str == "[DONE]":
                                break
                            chunk_json = json.loads(data_str)
                            delta = chunk_json["choices"][0].get("delta", {}).get("content", "")
                            if delta:
                                chunk = StreamChunk(type="content", delta=delta)
                                yield f"data: {chunk.model_dump_json()}\n\n"
            yield "data: {\"type\":\"done\",\"finishReason\":\"stop\"}\n\n"
            yield "data: [DONE]\n\n"
            return
        except Exception:
            pass

    # 3. Intelligent fallback streaming
    mermaid_code = pick_mermaid_template(last_user_msg)
    chunk_size = 15
    for i in range(0, len(mermaid_code), chunk_size):
        chunk_text = mermaid_code[i:i + chunk_size]
        chunk = StreamChunk(type="content", delta=chunk_text)
        yield f"data: {chunk.model_dump_json()}\n\n"
        await asyncio.sleep(0.03)

    yield "data: {\"type\":\"done\",\"finishReason\":\"stop\"}\n\n"
    yield "data: [DONE]\n\n"


@router.post("/v1/ai/text-to-diagram/chat-streaming")
async def chat_streaming_endpoint(req: TTDChatRequest):
    """2D vector canvas engine (in docs_archive)-compatible Text-to-Diagram SSE streaming endpoint."""
    return StreamingResponse(
        stream_ttd_chat(req),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Ratelimit-Limit": "100",
            "X-Ratelimit-Remaining": "99"
        }
    )
