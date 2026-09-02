import re
from typing import Optional, Tuple


def clean_equation_string(raw: str) -> str:
    """Removes trailing equals sign, whitespace, and normalizes common symbols."""
    text = raw.strip()
    # Normalize multiplication symbols
    text = text.replace("×", "*").replace("÷", "/")
    # Remove trailing =
    if text.endswith("="):
        text = text[:-1].strip()
    return text


def is_math_expression(text: str) -> bool:
    """Checks if text looks like an evaluatable mathematical expression."""
    text = text.strip()
    if not text:
        return False
    # Allowed math characters
    allowed = re.compile(r"^[0-9a-zA-Z\s\+\-\*\/\^\(\)\.\,\=\_]+$")
    has_operator = any(op in text for op in ["+", "-", "*", "/", "^", "=", "sqrt", "sin", "cos"])
    return bool(allowed.match(text)) and has_operator
