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
    AnchorPosition,
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
@router.post("/v1/ai/diagram/synthesize", response_model=DiagramSynthesizeResponse)
async def synthesize_diagram(req: DiagramSynthesizeRequest):
    """Generates structured diagram elements and Mermaid syntax from prompt using Groq / Fallbacks."""
    direction = (req.direction or "TD").upper()
    if direction not in ["TD", "LR", "TB", "RL"]:
        direction = "TD"

    mermaid_code = None

    # 1. Direct Mermaid input from user
    if req.mermaid and ("flowchart" in req.mermaid or "graph" in req.mermaid):
        mermaid_code = req.mermaid.strip()

    # 2. Groq Generation (openai/gpt-oss-120b / openai/gpt-oss-20b / qwen3.8-27b)
    groq_key = settings.get_groq_key()
    if not mermaid_code and groq_key:
        try:
            from groq import AsyncGroq
            client = AsyncGroq(api_key=groq_key)
            models_to_try = settings.get_groq_models()
            seen = set()
            completion = None
            for m in models_to_try:
                if not m or m in seen:
                    continue
                seen.add(m)
                try:
                    completion = await client.chat.completions.create(
                        model=m,
                        messages=[
                            {
                                "role": "system",
                                "content": (
                                    "You are an expert flowchart and software architecture diagram generator.\n"
                                    f"Generate a clean, professional flowchart strictly starting with 'flowchart {direction}'.\n"
                                    "Use standard flowchart shapes:\n"
                                    "- Process steps: NodeID[Process Name]\n"
                                    "- Decision branches: NodeID{Condition?}\n"
                                    "- Start/End terminals: NodeID([Start / End])\n"
                                    "- Input/Output: NodeID[/Input Data/]\n"
                                    "- Databases: NodeID[(Database Name)]\n"
                                    "Connect nodes with labeled transitions where appropriate: NodeA -->|Yes| NodeB or NodeA --> NodeB.\n"
                                    "CRITICAL: Do NOT put emojis, icons, or pictorial symbols anywhere in node labels or descriptions.\n"
                                    "Return ONLY valid Mermaid.js code. Do not output markdown code blocks, backticks, conversational preamble, or explanations."
                                )
                            },
                            {"role": "user", "content": f"Create a structured flowchart for: {req.prompt}"}
                        ],
                        temperature=0.2,
                    )
                    break
                except Exception as model_err:
                    print(f"[DiagramRouter] Model {m} failed: {model_err}", flush=True)

            if completion:
                raw = completion.choices[0].message.content.strip()
                if "```" in raw:
                    parts = raw.split("```")
                    raw = parts[1] if len(parts) > 1 else raw
                    if raw.startswith("mermaid"):
                        raw = raw[7:]
                    raw = raw.strip()
                if "flowchart" in raw or "graph" in raw:
                    mermaid_code = raw
        except Exception:
            pass

    # 3. Deterministic template fallback
    if not mermaid_code:
        template = pick_mermaid_template(req.prompt)
        # Adapt direction to requested direction
        if direction == "LR" and "flowchart TD" in template:
            template = template.replace("flowchart TD", "flowchart LR", 1)
        elif direction == "TD" and "flowchart LR" in template:
            template = template.replace("flowchart LR", "flowchart TD", 1)
        mermaid_code = template

    try:
        parsed = parse_mermaid(mermaid_code)
    except Exception:
        fallback = pick_mermaid_template(req.prompt)
        if direction == "LR" and "flowchart TD" in fallback:
            fallback = fallback.replace("flowchart TD", "flowchart LR", 1)
        mermaid_code = fallback
        parsed = parse_mermaid(mermaid_code)

    pos = req.anchorPosition or req.anchor or AnchorPosition(x=200.0, y=150.0)
    layouts = layout_diagram(
        parsed,
        start_x=pos.x or 200.0,
        start_y=pos.y or 150.0
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

    groq_key = settings.get_groq_key()
    gemini_key = settings.get_gemini_key()
    openai_key = settings.get_openai_key()

    # 1. Primary: Groq Cloud API (openai/gpt-oss-120b) high-speed streaming
    if groq_key:
        try:
            from groq import AsyncGroq
            client = AsyncGroq(api_key=groq_key)
            messages = [{"role": "system", "content": sys_msg}] + [
                {"role": m.role, "content": m.content} for m in chat_request.messages
            ]
            stream = await client.chat.completions.create(
                model=settings.groq_model,
                messages=messages,
                stream=True,
                temperature=0.2,
            )
            async for chunk_data in stream:
                delta = chunk_data.choices[0].delta.content or ""
                if delta:
                    chunk = StreamChunk(type="content", delta=delta)
                    yield f"data: {chunk.model_dump_json()}\n\n"
            yield "data: {\"type\":\"done\",\"finishReason\":\"stop\"}\n\n"
            yield "data: [DONE]\n\n"
            return
        except Exception:
            pass

    # 2. Secondary: If Gemini API key is available and not in mock mode, stream from Gemini
    if gemini_key and not settings.enable_mock_llm:
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
                f":streamGenerateContent?alt=sse&key={gemini_key}"
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
    if openai_key and not settings.enable_mock_llm:
        try:
            openai_msgs = [{"role": "system", "content": sys_msg}] + [
                {"role": m.role, "content": m.content} for m in chat_request.messages
            ]

            async with httpx.AsyncClient(timeout=30.0) as client:
                async with client.stream(
                    "POST",
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {openai_key}"},
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
@router.post("/text-to-diagram/chat-streaming")
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
