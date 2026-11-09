import json
from typing import Dict, Any, List, Optional
import httpx

from app.config import settings
from app.schemas.theme_schema import (
    ThemeMorphRequest,
    ThemeMorphResponse,
    ThemePalette,
    ThemeElementMeta,
)

PRESET_THEMES: Dict[str, Dict[str, Any]] = {
    "cyberpunk blueprint": {
        "themeName": "Cyberpunk Blueprint",
        "canvasBackground": "#070b14",
        "palette": {
            "primaryStroke": "#00f0ff",      # Neon Cyan
            "secondaryStroke": "#ff007f",    # Hot Neon Pink
            "primaryBackground": "rgba(0, 240, 255, 0.12)",
            "secondaryBackground": "rgba(11, 16, 33, 0.85)",
            "accentColor": "#ffe600",        # Electric Cyber Yellow
            "canvasBackground": "#070b14",
            "fontFamily": "mono",
            "roughness": 0.4,
            "strokeWidth": 2.0,
            "fillStyle": "semi"
        }
    },
    "retro paper": {
        "themeName": "Retro Paper",
        "canvasBackground": "#f8f3e6",      # Vintage Parchment
        "palette": {
            "primaryStroke": "#3d271d",      # Deep Espresso Ink
            "secondaryStroke": "#8b5a2b",    # Vintage Ochre
            "primaryBackground": "rgba(238, 224, 203, 0.65)",
            "secondaryBackground": "#efe4d0",
            "accentColor": "#b84a39",        # Terracotta Red
            "canvasBackground": "#f8f3e6",
            "fontFamily": "rough",
            "roughness": 2.2,
            "strokeWidth": 2.5,
            "fillStyle": "hachure"
        }
    },
    "executive pitch": {
        "themeName": "Executive Pitch",
        "canvasBackground": "#f8fafc",      # Clean Executive Slate White
        "palette": {
            "primaryStroke": "#0f172a",      # Midnight Slate
            "secondaryStroke": "#2563eb",    # Royal Sapphire
            "primaryBackground": "#ffffff",
            "secondaryBackground": "#f1f5f9",
            "accentColor": "#0ea5e9",        # Sky Blue
            "canvasBackground": "#f8fafc",
            "fontFamily": "clean",
            "roughness": 0.0,
            "strokeWidth": 2.0,
            "fillStyle": "solid"
        }
    },
    "neon synthwave": {
        "themeName": "Neon Synthwave",
        "canvasBackground": "#12072b",
        "palette": {
            "primaryStroke": "#ff007f",
            "secondaryStroke": "#00dfd8",
            "primaryBackground": "rgba(121, 40, 202, 0.25)",
            "secondaryBackground": "#1e0b4a",
            "accentColor": "#ffd600",
            "canvasBackground": "#12072b",
            "fontFamily": "mono",
            "roughness": 0.6,
            "strokeWidth": 2.2,
            "fillStyle": "semi"
        }
    },
    "minimalist monochrome": {
        "themeName": "Minimalist Monochrome",
        "canvasBackground": "#ffffff",
        "palette": {
            "primaryStroke": "#18181b",
            "secondaryStroke": "#52525b",
            "primaryBackground": "#f4f4f5",
            "secondaryBackground": "#e4e4e7",
            "accentColor": "#09090b",
            "canvasBackground": "#ffffff",
            "fontFamily": "clean",
            "roughness": 0.0,
            "strokeWidth": 1.5,
            "fillStyle": "solid"
        }
    },
    "pastel creative": {
        "themeName": "Pastel Creative",
        "canvasBackground": "#faf5ff",
        "palette": {
            "primaryStroke": "#7c3aed",
            "secondaryStroke": "#059669",
            "primaryBackground": "#f3e8ff",
            "secondaryBackground": "#d1fae5",
            "accentColor": "#f59e0b",
            "canvasBackground": "#faf5ff",
            "fontFamily": "clean",
            "roughness": 0.8,
            "strokeWidth": 2.0,
            "fillStyle": "semi"
        }
    }
}


def _match_preset(prompt: str) -> Optional[Dict[str, Any]]:
    p = prompt.lower().strip()
    for key, val in PRESET_THEMES.items():
        if key in p or any(w in p for w in key.split()):
            return val
    return None


def apply_palette_to_elements(elements: List[ThemeElementMeta], theme_info: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Updates only aesthetic metadata attributes while strictly preserving element geometry."""
    pal = theme_info["palette"]
    updated = []

    for elem in elements:
        d = elem.model_dump()
        t = (elem.type or "").lower()

        # Strict coordinate preservation: original x, y, width, height, points are NEVER modified!
        d["x"] = elem.x
        d["y"] = elem.y
        d["width"] = elem.width
        d["height"] = elem.height
        d["points"] = elem.points

        # Morph aesthetic styles
        d["fontFamily"] = pal.get("fontFamily", "clean")
        d["roughness"] = pal.get("roughness", 1.0)
        d["strokeWidth"] = pal.get("strokeWidth", 2.0)
        d["fillStyle"] = pal.get("fillStyle", "solid")

        if t in ["arrow", "line"]:
            d["strokeColor"] = pal.get("secondaryStroke")
            d["backgroundColor"] = "transparent"
        elif t == "sticky":
            d["strokeColor"] = pal.get("secondaryStroke")
            d["backgroundColor"] = pal.get("primaryBackground")
        elif t == "text":
            d["strokeColor"] = pal.get("primaryStroke")
            d["backgroundColor"] = "transparent"
        else:
            d["strokeColor"] = pal.get("primaryStroke")
            d["backgroundColor"] = pal.get("primaryBackground")

        updated.append(d)

    return updated


async def morph_theme(req: ThemeMorphRequest) -> ThemeMorphResponse:
    """Generates cohesive aesthetic styling matching the prompt using Groq Llama 3.3 / Gemini."""
    matched = _match_preset(req.themePrompt)
    if matched:
        updated_elems = apply_palette_to_elements(req.elements, matched)
        return ThemeMorphResponse(
            success=True,
            themeName=matched["themeName"],
            canvasBackground=matched["canvasBackground"],
            palette=ThemePalette(**matched["palette"]),
            elementsMorphed=len(updated_elems),
            updatedElements=updated_elems,
            aiProvider="preset-instant"
        )

    groq_key = settings.get_groq_key()
    gemini_key = settings.get_gemini_key()

    prompt = (
        "You are an expert generative design technologist and visual UI artist.\n"
        f"Design an aesthetic theme for whiteboard canvas elements based on this prompt: '{req.themePrompt}'.\n"
        "Return strictly valid JSON with this palette schema:\n"
        "{\n"
        f'  "themeName": "{req.themePrompt}",\n'
        '  "canvasBackground": "<hex color for canvas bg>",\n'
        '  "primaryStroke": "<hex color for dominant shape borders/text>",\n'
        '  "secondaryStroke": "<hex color for connectors/accents>",\n'
        '  "primaryBackground": "<hex or rgba color for shape fills>",\n'
        '  "secondaryBackground": "<hex or rgba color for secondary fills>",\n'
        '  "accentColor": "<hex color>",\n'
        '  "fontFamily": "<clean|rough|mono>",\n'
        '  "roughness": <float between 0.0 (sleek) and 2.5 (sketchy)>,\n'
        '  "strokeWidth": <float between 1.0 and 3.5>,\n'
        '  "fillStyle": "<solid|semi|hachure|cross-hatch|transparent>"\n'
        "}"
    )

    # 1. Primary for fast JSON synthesis: Groq
    if groq_key:
        try:
            from groq import AsyncGroq
            client = AsyncGroq(api_key=groq_key)
            models_to_try = settings.get_groq_models()
            for m in models_to_try:
                try:
                    completion = await client.chat.completions.create(
                        model=m,
                        messages=[
                            {"role": "system", "content": "You output strictly valid JSON with no markdown formatting."},
                            {"role": "user", "content": prompt}
                        ],
                        temperature=0.3,
                        response_format={"type": "json_object"}
                    )
                    raw = completion.choices[0].message.content
                    pal_data = json.loads(raw)
                    theme_dict = {
                        "themeName": pal_data.get("themeName", req.themePrompt),
                        "canvasBackground": pal_data.get("canvasBackground", "#0d1117"),
                        "palette": pal_data
                    }
                    updated_elems = apply_palette_to_elements(req.elements, theme_dict)
                    return ThemeMorphResponse(
                        success=True,
                        themeName=theme_dict["themeName"],
                        canvasBackground=theme_dict["canvasBackground"],
                        palette=ThemePalette(**pal_data),
                        elementsMorphed=len(updated_elems),
                        updatedElements=updated_elems,
                        aiProvider=f"groq-{m}"
                    )
                except Exception:
                    continue
        except Exception:
            pass

    # 2. Secondary: Gemini Flash
    if gemini_key:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent?key={gemini_key}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"responseMimeType": "application/json", "temperature": 0.4}
            }

            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    resp_json = res.json()
                    parts = resp_json.get("candidates", [])[0].get("content", {}).get("parts", [])
                    raw_text = parts[0].get("text", "{}")
                    pal_data = json.loads(raw_text)

                    theme_dict = {
                        "themeName": pal_data.get("themeName", req.themePrompt),
                        "canvasBackground": pal_data.get("canvasBackground", "#0d1117"),
                        "palette": pal_data
                    }
                    updated_elems = apply_palette_to_elements(req.elements, theme_dict)
                    return ThemeMorphResponse(
                        success=True,
                        themeName=theme_dict["themeName"],
                        canvasBackground=theme_dict["canvasBackground"],
                        palette=ThemePalette(**pal_data),
                        elementsMorphed=len(updated_elems),
                        updatedElements=updated_elems,
                        aiProvider=f"gemini-{settings.gemini_model}"
                    )
        except Exception:
            pass

    # 3. Preset match or default fallback
    fallback_theme = matched or PRESET_THEMES["cyberpunk blueprint"]
    updated_elems = apply_palette_to_elements(req.elements, fallback_theme)
    return ThemeMorphResponse(
        success=True,
        themeName=fallback_theme["themeName"],
        canvasBackground=fallback_theme["canvasBackground"],
        palette=ThemePalette(**fallback_theme["palette"]),
        elementsMorphed=len(updated_elems),
        updatedElements=updated_elems,
        aiProvider="preset-rule-engine"
    )
