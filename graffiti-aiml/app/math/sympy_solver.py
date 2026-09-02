import random
import time
from typing import Any, Dict, Tuple
import sympy as sp
from sympy.parsing.sympy_parser import (
    parse_expr,
    standard_transformations,
    implicit_multiplication_application,
    convert_xor
)
from app.math.equation_parser import clean_equation_string

transformations = standard_transformations + (implicit_multiplication_application, convert_xor)


def solve_math_expression(
    equation_raw: str,
    anchor_x: float,
    anchor_y: float
) -> Tuple[str, Dict[str, Any]]:
    clean_expr = clean_equation_string(equation_raw)
    result_str = ""

    try:
        # Check if it contains an algebraic equals sign: e.g. 2*x + 10 = 30, 3x + 5 = 20
        if "=" in clean_expr:
            left_side, right_side = clean_expr.split("=", 1)
            left_parsed = parse_expr(left_side.strip(), transformations=transformations)
            right_parsed = parse_expr(right_side.strip(), transformations=transformations)
            eq = sp.Eq(left_parsed, right_parsed)
            free_symbols = list(eq.free_symbols)
            if free_symbols:
                sol = sp.solve(eq, free_symbols[0])
                result_str = f"{free_symbols[0]} = {sol[0] if isinstance(sol, list) and sol else sol}"
            else:
                result_str = "True" if eq else "False"
        else:
            # Standard arithmetic / algebraic simplification
            parsed = parse_expr(clean_expr, transformations=transformations)
            if parsed.is_number:
                try:
                    val = float(parsed.evalf())
                    if val.is_integer():
                        result_str = str(int(val))
                    else:
                        result_str = f"{val:.4f}".rstrip("0").rstrip(".")
                except Exception:
                    result_str = str(parsed)
            else:
                result_str = str(parsed)
    except Exception:
        result_str = "Error"

    now = int(time.time() * 1000)
    proposed_element = {
        "id": f"el_math_{random.randint(10000, 99999)}",
        "type": "text",
        "x": anchor_x + 30.0,
        "y": anchor_y,
        "width": max(len(result_str) * 12.0, 40.0),
        "height": 28.0,
        "text": f" {result_str}",
        "fontSize": 20,
        "fontFamily": 1,
        "textAlign": "left",
        "verticalAlign": "top",
        "angle": 0,
        "strokeColor": "#2b8a3e",  # Clean math green
        "backgroundColor": "transparent",
        "strokeWidth": 2,
        "strokeStyle": "solid",
        "roughness": 0,
        "opacity": 100,
        "seed": random.randint(100000, 999999),
        "version": 1,
        "versionNonce": random.randint(100000, 999999),
        "index": "a_math",
        "isDeleted": False,
        "groupIds": [],
        "frameId": None,
        "boundElements": [],
        "updated": now,
        "customData": {
            "aiGenerated": True,
            "mathSolved": True,
            "originalEquation": equation_raw,
            "solution": result_str
        }
    }

    return result_str, proposed_element
