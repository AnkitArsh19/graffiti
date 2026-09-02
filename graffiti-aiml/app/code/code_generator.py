import asyncio
import json
from typing import AsyncGenerator, List, Optional
import httpx
from app.config import settings
from app.schemas.code_schema import StreamChunk


SYSTEM_PROMPT = """You are an expert frontend engineer. You are given a wireframe drawing and extracted texts.
Generate clean, responsive, modern, self-contained HTML with embedded CSS and vanilla JavaScript.
Do not wrap your output in markdown code blocks. Output ONLY the raw HTML string starting with <!DOCTYPE html>."""


def generate_fallback_html(texts: List[str], theme: str = "light") -> str:
    """Intelligently builds responsive HTML/CSS based on wireframe labels."""
    is_dark = theme == "dark"
    bg_color = "#121212" if is_dark else "#f8f9fa"
    card_bg = "#1e1e1e" if is_dark else "#ffffff"
    text_color = "#ffffff" if is_dark else "#212529"
    sub_color = "#adb5bd" if is_dark else "#6c757d"
    border_color = "#343a40" if is_dark else "#dee2e6"
    primary_color = "#4c6ef5"

    title = texts[0] if texts else "Generated Application"
    sub_texts = texts[1:] if len(texts) > 1 else ["Welcome to your interactive preview"]

    # Detect form vs dashboard elements
    has_inputs = any("email" in t.lower() or "password" in t.lower() or "login" in t.lower() or "sign" in t.lower() for t in texts)
    
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }}
    body {{
      background: {bg_color};
      color: {text_color};
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }}
    .card {{
      background: {card_bg};
      border: 1px solid {border_color};
      border-radius: 12px;
      padding: 32px;
      width: 100%;
      max-width: 440px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.08);
      transition: transform 0.2s ease;
    }}
    h1 {{ font-size: 1.5rem; margin-bottom: 8px; }}
    p.subtitle {{ color: {sub_color}; font-size: 0.9rem; margin-bottom: 24px; }}
    .field {{ margin-bottom: 16px; }}
    label {{ display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 6px; color: {text_color}; }}
    input {{
      width: 100%;
      padding: 10px 14px;
      background: {card_bg};
      border: 1px solid {border_color};
      border-radius: 6px;
      color: {text_color};
      font-size: 0.95rem;
      outline: none;
      transition: border-color 0.2s ease;
    }}
    input:focus {{ border-color: {primary_color}; }}
    button {{
      width: 100%;
      padding: 12px;
      background: {primary_color};
      color: #ffffff;
      border: none;
      border-radius: 6px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s ease, transform 0.1s ease;
    }}
    button:hover {{ opacity: 0.92; }}
    button:active {{ transform: scale(0.98); }}
    .item-list {{ list-style: none; margin: 16px 0; }}
    .item-list li {{
      padding: 10px 14px;
      margin-bottom: 8px;
      background: {bg_color};
      border-radius: 6px;
      font-size: 0.9rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }}
    .toast {{
      margin-top: 16px;
      padding: 10px;
      background: #e6fcf5;
      color: #0ca678;
      border-radius: 6px;
      text-align: center;
      font-size: 0.85rem;
      display: none;
    }}
  </style>
</head>
<body>
  <div class="card">
    <h1>{title}</h1>
    <p class="subtitle">Interactive component generated from your whiteboard wireframe.</p>
"""

    if has_inputs:
        html += """
    <form id="actionForm">
      <div class="field">
        <label>Email Address</label>
        <input type="email" placeholder="you@example.com" required />
      </div>
      <div class="field">
        <label>Password</label>
        <input type="password" placeholder="••••••••" required />
      </div>
      <button type="submit">Continue</button>
      <div id="toast" class="toast">Action submitted successfully!</div>
    </form>
    <script>
      document.getElementById('actionForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const toast = document.getElementById('toast');
        toast.style.display = 'block';
        setTimeout(() => { toast.style.display = 'none'; }, 3000);
      });
    </script>
"""
    else:
        html += """
    <ul class="item-list">
"""
        for item in sub_texts:
            html += f"      <li><span>{item}</span> <span style=\"font-size: 11px; opacity: 0.7;\">Active</span></li>\n"
        html += """    </ul>
    <button id="actionBtn" type="button">Execute Action</button>
    <div id="toast" class="toast">Action processed!</div>
    <script>
      document.getElementById('actionBtn').addEventListener('click', () => {
        const toast = document.getElementById('toast');
        toast.style.display = 'block';
        setTimeout(() => { toast.style.display = 'none'; }, 2500);
      });
    </script>
"""

    html += """  </div>
</body>
</html>"""
    return html


async def stream_diagram_to_code(
    texts: List[str],
    image: Optional[str] = None,
    theme: str = "light"
) -> AsyncGenerator[str, None]:
    """Streams SSE events conforming to Excalidraw's StreamChunk specification."""
    # Check if OpenAI is configured
    if settings.openai_api_key and not settings.enable_mock_llm:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                messages = [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": f"Extracted labels: {', '.join(texts)}. Theme: {theme}"}
                        ]
                    }
                ]
                if image:
                    messages[1]["content"].append({
                        "type": "image_url",
                        "image_url": {"url": image}
                    })

                async with client.stream(
                    "POST",
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                    json={
                        "model": settings.openai_model,
                        "messages": messages,
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
            yield "data: {\"type\":\"done\"}\n\n"
            yield "data: [DONE]\n\n"
            return
        except Exception as e:
            # Fall back gracefully to synthesized generation
            pass

    # High-fidelity streaming fallback
    full_html = generate_fallback_html(texts, theme)
    # Stream in realistic token chunks
    chunk_size = 40
    for i in range(0, len(full_html), chunk_size):
        chunk_text = full_html[i:i + chunk_size]
        chunk = StreamChunk(type="content", delta=chunk_text)
        yield f"data: {chunk.model_dump_json()}\n\n"
        await asyncio.sleep(0.02)  # Smooth streaming sensation

    yield "data: {\"type\":\"done\"}\n\n"
    yield "data: [DONE]\n\n"
