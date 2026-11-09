import re
import unicodedata
from typing import Optional, Tuple


def clean_equation_string(raw: str) -> str:
    """Removes trailing equals sign, whitespace, normalizes symbols, extracts LaTeX,
    and formats copied MathJax / KaTeX expressions for SymPy parsing."""
    text = (raw or "").strip()
    if not text:
        return ""

    # 1. Strip raw string quotes or wrappers if present: r"...", '...'
    if (text.startswith('r"') and text.endswith('"')) or (text.startswith("r'") and text.endswith("'")):
        text = text[2:-1].strip()
    elif (text.startswith('"') and text.endswith('"')) or (text.startswith("'") and text.endswith("'")):
        text = text[1:-1].strip()
    text = re.sub(r'^r?["\'](.*)["\'](=?)$', r'\1\2', text).strip()

    # 2. Check for LaTeX math delimiters \( ... \), \[ ... \], $$ ... $$, $ ... $
    # Often copied from MathJax / KaTeX where visual DOM text duplicates the TeX
    delim_matches = re.findall(r'\\(?:\[|\()(.+?)\\(?:\]|\))|\$\$(.+?)\$\$|\$([^\$]+)\$', text)
    if delim_matches:
        parts = []
        for g in delim_matches:
            val = g[0] or g[1] or g[2]
            if val:
                parts.append(val.strip())
        combined = " ".join(parts)
        combined = re.sub(r'\\h?phantom\{[^}]*\}', '', combined)
        combined = re.sub(r'\\text\{([^}]*)\}', r'\1', combined)
        # If the extracted TeX was non-empty and has math tokens, use it
        if any(c in combined for c in '+-*/=^0123456789') or r'\int' in combined:
            text = combined

    # 3. Unicode normalization and character mappings
    # Map invisible operators, dashes, multiplication, division
    text = text.replace('\u2062', '*').replace('\u2060', '')  # invisible times, word joiner
    text = text.replace('−', '-').replace('–', '-').replace('—', '-')  # dashes to minus
    text = text.replace('×', '*').replace('·', '*').replace('⋅', '*').replace('\u00d7', '*').replace('\u00b7', '*').replace('\u22c5', '*')
    text = text.replace('÷', '/').replace('∕', '/').replace('\u00f7', '/').replace('\u2215', '/')

    # Replace unicode superscripts before NFKC (NFKC flattens ² into 2)
    superscripts = {
        '⁰': '^0', '¹': '^1', '²': '^2', '³': '^3', '⁴': '^4',
        '⁵': '^5', '⁶': '^6', '⁷': '^7', '⁸': '^8', '⁹': '^9',
        '⁺': '^+', '⁻': '^-'
    }
    for sup, rep in superscripts.items():
        text = text.replace(sup, rep)

    # Subscripts
    subscripts = {
        '₀': '_0', '₁': '_1', '₂': '_2', '₃': '_3', '₄': '_4',
        '₅': '_5', '₆': '_6', '₇': '_7', '₈': '_8', '₉': '_9'
    }
    for sub, rep in subscripts.items():
        text = text.replace(sub, rep)

    # NFKC normalizes mathematical alphanumeric symbols (e.g. 𝑢 -> u, 𝑥 -> x)
    text = unicodedata.normalize('NFKC', text)

    # 4. LaTeX macro cleanups
    text = re.sub(r'\\[,;:!\s]', ' ', text)  # spacing: \, \: \; \! \ 
    text = text.replace(r'\left', '').replace(r'\right', '')
    text = text.replace(r'\cdot', '*').replace(r'\times', '*')
    text = text.replace(r'\div', '/')
    text = text.replace(r'\pm', '+-')

    # Convert \frac{a}{b} and \dfrac{a}{b} to ((a)/(b))
    while r'\frac' in text or r'\dfrac' in text:
        new_text = re.sub(r'\\d?frac\{([^{}]+)\}\{([^{}]+)\}', r'((\1)/(\2))', text)
        if new_text == text:
            break
        text = new_text

    # Convert \sqrt{x} to sqrt(x)
    while r'\sqrt' in text:
        new_text = re.sub(r'\\sqrt\{([^{}]+)\}', r'sqrt(\1)', text)
        if new_text == text:
            break
        text = new_text

    # 5. Fix implicit exponents like u2 -> u^2, 6x2 -> 6x^2 (when not preceded by ^ or _)
    text = re.sub(r'(?<=[a-zA-Z])([2-9])(?![a-zA-Z0-9_])', r'^\1', text)

    # 6. Trailing = cleanup if needed: e.g. '2+2=' -> '2+2'
    text = text.strip()
    if text.endswith('='):
        # If there is another '=' inside (like '6x^2 + 11x - 35 = 0='), strip the trailing one
        text = text[:-1].strip()
    elif text.endswith('= ?') or text.endswith('=?'):
        text = re.sub(r'=\s*\?$', '', text).strip()

    return text.strip()


def is_math_expression(text: str) -> bool:
    """Checks if text looks like an evaluatable mathematical expression."""
    text = (text or "").strip()
    if not text:
        return False
    # If text contains calculus macros or delimiters, it is math
    if any(marker in text for marker in ["\\int", "int(", "integrate", "\\frac", "d/d", "diff", "\\lim"]):
        return True
    # Clean up string first to see if operators or equations exist
    cleaned = clean_equation_string(text)
    has_operator = any(op in cleaned for op in ["+", "-", "*", "/", "^", "=", "sqrt", "sin", "cos", "tan"])
    return has_operator
