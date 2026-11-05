import random
import re
import time
from typing import Any, Dict, Optional, Tuple
import sympy as sp
from sympy.parsing.sympy_parser import (
    parse_expr,
    standard_transformations,
    implicit_multiplication_application,
    convert_xor,
)
from app.math.equation_parser import clean_equation_string

transformations = standard_transformations + (implicit_multiplication_application, convert_xor)


def _format_solution_value(val: Any) -> str:
    """Formats numeric or symbolic sympy result into concise, readable string."""
    try:
        if isinstance(val, (int, sp.Integer)):
            return str(val)
        if isinstance(val, (float, sp.Float)):
            if float(val).is_integer():
                return str(int(val))
            return f"{float(val):.4f}".rstrip("0").rstrip(".")
        if hasattr(val, "evalf") and val.is_number:
            num = float(val.evalf())
            if num.is_integer():
                return str(int(num))
            return f"{num:.4f}".rstrip("0").rstrip(".")
        return str(val)
    except Exception:
        return str(val)


def solve_math_expression(
    equation_raw: str,
    anchor_x: float,
    anchor_y: float,
    variables: Optional[Dict[str, Any]] = None,
) -> Tuple[str, Dict[str, Any]]:
    clean_expr = clean_equation_string(equation_raw)
    result_str = ""

    try:
        # 1. Prepare variable substitutions
        subs_dict: Dict[sp.Symbol, Any] = {}
        if variables:
            for k, v in variables.items():
                if isinstance(k, str) and k.isidentifier():
                    try:
                        subs_dict[sp.Symbol(k)] = sp.sympify(v)
                    except Exception:
                        pass

        # 2. Check for calculus expressions: diff(expr, x), d/dx(expr), integrate(expr, x), int(expr, x)
        diff_match = re.match(r"^(?:d/d([a-zA-Z])|diff)\s*\((.+)\)$", clean_expr, re.IGNORECASE)
        int_match = re.match(r"^(?:int|integrate)\s*\((.+)\)$", clean_expr, re.IGNORECASE)

        if diff_match:
            var_name = diff_match.group(1) or "x"
            inner = diff_match.group(2).strip()
            # If comma-separated args: diff(x^3, x)
            if "," in inner:
                parts = [p.strip() for p in inner.split(",", 1)]
                f_expr = parse_expr(parts[0], transformations=transformations)
                sym = sp.Symbol(parts[1])
            else:
                f_expr = parse_expr(inner, transformations=transformations)
                sym = sp.Symbol(var_name)
            if subs_dict:
                f_expr = f_expr.subs(subs_dict)
            derivative = sp.diff(f_expr, sym)
            result_str = str(derivative)

        elif int_match:
            inner = int_match.group(1).strip()
            if "," in inner:
                parts = [p.strip() for p in inner.split(",", 1)]
                f_expr = parse_expr(parts[0], transformations=transformations)
                sym = sp.Symbol(parts[1])
            else:
                f_expr = parse_expr(inner, transformations=transformations)
                sym = sp.Symbol("x")
            if subs_dict:
                f_expr = f_expr.subs(subs_dict)
            integral = sp.integrate(f_expr, sym)
            result_str = f"{integral} + C"

        # 3. Check for algebraic equation with '=': e.g. x^2 - 5x + 6 = 0, 3x + 12 = 27
        elif "=" in clean_expr:
            left_side, right_side = clean_expr.split("=", 1)
            left_parsed = parse_expr(left_side.strip(), transformations=transformations)
            right_parsed = parse_expr(right_side.strip(), transformations=transformations)

            if subs_dict:
                left_parsed = left_parsed.subs(subs_dict)
                right_parsed = right_parsed.subs(subs_dict)

            eq = sp.Eq(left_parsed, right_parsed)
            free_symbols = list(eq.free_symbols)

            if free_symbols:
                target_sym = free_symbols[0]
                solutions = sp.solve(eq, target_sym)
                if isinstance(solutions, list):
                    if len(solutions) > 1:
                        formatted_roots = ", ".join(_format_solution_value(s) for s in solutions)
                        result_str = f"{target_sym} = {formatted_roots}"
                    elif len(solutions) == 1:
                        result_str = f"{target_sym} = {_format_solution_value(solutions[0])}"
                    else:
                        result_str = "No real solution"
                else:
                    result_str = f"{target_sym} = {_format_solution_value(solutions)}"
            else:
                # Numeric equality check: e.g. 5 + 5 = 10 -> True
                result_str = "True" if eq else "False"

        # 4. Standard arithmetic / algebraic evaluation
        else:
            parsed = parse_expr(clean_expr, transformations=transformations)
            if subs_dict:
                parsed = parsed.subs(subs_dict)

            if parsed.is_number:
                result_str = _format_solution_value(parsed.evalf())
            else:
                result_str = str(parsed)

    except Exception as err:
        print(f"[SymPySolver] Error solving '{equation_raw}': {err}")
        result_str = "Error"

    now = int(time.time() * 1000)
    proposed_element = {
        "id": f"el_math_{random.randint(10000, 99999)}",
        "type": "text",
        "x": anchor_x + 20.0,
        "y": anchor_y,
        "width": max(len(result_str) * 12.0, 40.0),
        "height": 30.0,
        "text": f" {result_str}",
        "fontSize": "medium",
        "fontFamily": "handwriting",  # Authentic Apple Math Notes script font
        "textAlign": "left",
        "verticalAlign": "middle",
        "angle": 0,
        "strokeColor": "#22c55e",  # Distinctive Apple Math Notes green
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
            "solution": result_str,
        },
    }

    return result_str, proposed_element
