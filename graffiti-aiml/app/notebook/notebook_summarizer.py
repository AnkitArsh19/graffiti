import json
import re
import time
import uuid
from typing import Dict, Any, List
import httpx

from app.config import settings
from app.schemas.notebook_schema import (
    NotebookSummarizeRequest,
    NotebookSummarizeResponse,
    ActionItem,
    KeyDecision,
    OpenQuestion,
)


def _heuristic_summary(text: str) -> NotebookSummarizeResponse:
    """Fast regex/heuristic fallback for notebook summaries when API keys are absent."""
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    action_items: List[ActionItem] = []
    key_decisions: List[KeyDecision] = []
    open_questions: List[OpenQuestion] = []

    for idx, line in enumerate(lines):
        clean = line.lstrip("-*•#0123456789. ")
        lower = clean.lower()
        uid = f"item_{idx}_{uuid.uuid4().hex[:4]}"

        # Action items
        if any(marker in lower for marker in ["todo", "[ ]", "action:", "assign:", "task:", "need to", "must "]):
            priority = "high" if any(p in lower for p in ["urgent", "asap", "critical", "blocker"]) else "medium"
            assignee = "Unassigned"
            match = re.search(r"@(\w+)", line)
            if match:
                assignee = f"@{match.group(1)}"
            action_items.append(ActionItem(
                id=uid,
                task=clean,
                assignee=assignee,
                priority=priority,
                completed=False
            ))
        # Questions
        elif "?" in clean:
            open_questions.append(OpenQuestion(
                id=uid,
                question=clean,
                status="unresolved"
            ))
        # Decisions
        elif any(marker in lower for marker in ["decided", "decision:", "agreed", "chosen", "resolved", "conclusion:"]):
            key_decisions.append(KeyDecision(
                id=uid,
                decision=clean,
                context="Identified from whiteboard notes."
            ))

    # If nothing specifically parsed, create a default summary & items
    if not action_items and not key_decisions and not open_questions:
        if lines:
            action_items.append(ActionItem(
                id=f"act_{uuid.uuid4().hex[:4]}",
                task=f"Review and follow up on notes: {lines[0][:60]}...",
                assignee="Team",
                priority="medium"
            ))
            key_decisions.append(KeyDecision(
                id=f"dec_{uuid.uuid4().hex[:4]}",
                decision="Adopted whiteboard draft as current baseline.",
                context="Notes capture session"
            ))

    briefing = (
        f"Active review session covers {len(lines)} content blocks. "
        f"Detected {len(action_items)} action item(s), {len(key_decisions)} key decision(s), "
        f"and {len(open_questions)} open question(s)."
    )

    return NotebookSummarizeResponse(
        success=True,
        executiveSummary=briefing,
        actionItems=action_items,
        keyDecisions=key_decisions,
        openQuestions=open_questions,
        aiProvider="heuristic-instant",
        latencyMs=5.0
    )


async def summarize_notebook(req: NotebookSummarizeRequest) -> NotebookSummarizeResponse:
    """Uses Groq API (llama-3.1-8b-instant) for lightning-fast semantic briefing extraction."""
    t0 = time.time()
    text = (req.text or "").strip()
    if not text:
        return NotebookSummarizeResponse(
            success=True,
            executiveSummary="No notebook text content available for analysis.",
            actionItems=[],
            keyDecisions=[],
            openQuestions=[],
            aiProvider=f"groq-{settings.groq_fast_model}",
            latencyMs=1.0
        )

    groq_key = settings.get_groq_key()
    gemini_key = settings.get_gemini_key()

    prompt = (
        "You are an executive chief of staff and technical note summarizer.\n"
        "Analyze the following meeting notes/whiteboard text and extract:\n"
        "1. executiveSummary: A crisp, 2-3 sentence strategic executive briefing.\n"
        "2. actionItems: Array of specific actionable tasks with task description, assignee (e.g. '@Alice' or 'Unassigned'), priority ('high'|'medium'|'low'), completed (boolean).\n"
        "3. keyDecisions: Array of firm architectural, product, or organizational choices made, with decision and context.\n"
        "4. openQuestions: Array of unresolved questions, ambiguities, or risks with question string.\n\n"
        "Return strictly valid JSON with no markdown wrapping:\n"
        "{\n"
        '  "executiveSummary": "...",\n'
        '  "actionItems": [\n'
        '    {"id": "act_1", "task": "...", "assignee": "...", "priority": "high", "completed": false}\n'
        "  ],\n"
        '  "keyDecisions": [\n'
        '    {"id": "dec_1", "decision": "...", "context": "..."}\n'
        "  ],\n"
        '  "openQuestions": [\n'
        '    {"id": "q_1", "question": "...", "status": "unresolved"}\n'
        "  ]\n"
        "}\n\n"
        f"Notebook Title: {req.pageTitle}\n"
        f"Content:\n{text}"
    )

    # 1. Primary: Groq API (llama-3.1-8b-instant)
    if groq_key:
        try:
            from groq import AsyncGroq
            client = AsyncGroq(api_key=groq_key)
            completion = await client.chat.completions.create(
                model=settings.groq_fast_model,  # llama-3.1-8b-instant
                messages=[
                    {"role": "system", "content": "You return strictly valid JSON matching the requested schema with no extra commentary."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,
                response_format={"type": "json_object"}
            )
            raw = completion.choices[0].message.content
            parsed = json.loads(raw)
            dt = round((time.time() - t0) * 1000, 1)

            action_items = [ActionItem(**item) for item in parsed.get("actionItems", [])]
            key_decisions = [KeyDecision(**item) for item in parsed.get("keyDecisions", [])]
            open_questions = [OpenQuestion(**item) for item in parsed.get("openQuestions", [])]

            return NotebookSummarizeResponse(
                success=True,
                executiveSummary=parsed.get("executiveSummary", "Executive briefing extracted."),
                actionItems=action_items,
                keyDecisions=key_decisions,
                openQuestions=open_questions,
                aiProvider="groq-llama-3.1-8b-instant",
                latencyMs=dt
            )
        except Exception:
            pass

    # 2. Secondary: Gemini 1.5 Flash
    if gemini_key:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent?key={gemini_key}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"responseMimeType": "application/json"}
            }
            async with httpx.AsyncClient(timeout=15.0) as http_client:
                res = await http_client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    text_out = data["candidates"][0]["content"]["parts"][0]["text"]
                    parsed = json.loads(text_out)
                    dt = round((time.time() - t0) * 1000, 1)

                    action_items = [ActionItem(**item) for item in parsed.get("actionItems", [])]
                    key_decisions = [KeyDecision(**item) for item in parsed.get("keyDecisions", [])]
                    open_questions = [OpenQuestion(**item) for item in parsed.get("openQuestions", [])]

                    return NotebookSummarizeResponse(
                        success=True,
                        executiveSummary=parsed.get("executiveSummary", "Executive briefing extracted."),
                        actionItems=action_items,
                        keyDecisions=key_decisions,
                        openQuestions=open_questions,
                        aiProvider=f"gemini-{settings.gemini_model}",
                        latencyMs=dt
                    )
        except Exception:
            pass

    # Fallback heuristic
    fallback = _heuristic_summary(text)
    fallback.latencyMs = round((time.time() - t0) * 1000, 1)
    return fallback
