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
        if isinstance(val, sp.Rational):
            return f"{val.p}/{val.q}"
        if isinstance(val, (float, sp.Float)):
            if float(val).is_integer():
                return str(int(val))
            return f"{float(val):.4f}".rstrip("0").rstrip(".")
        if hasattr(val, "evalf") and getattr(val, "is_number", False):
            if isinstance(val, sp.Rational):
                return f"{val.p}/{val.q}"
            num = float(val.evalf())
            if num.is_integer():
                return str(int(num))
            return f"{num:.4f}".rstrip("0").rstrip(".")
        return str(val).replace("**", "^")
    except Exception:
        return str(val).replace("**", "^")


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

        # 2. Check for calculus expressions
        # Definite integral: \int_{a}^{b} f(x) dx or int_{a}^{b}
        int_def_match = re.match(
            r"^\\?int(?:egrate)?_(?:\{([^}]+)\}|([^\s\^]+))\^(?:\{([^}]+)\}|([^\s]+))\s+(.+?)\s*d([a-zA-Z])$",
            clean_expr,
            re.IGNORECASE,
        )
        # Indefinite integral: \int f(x) dx or int f(x) dx or int(f(x), x) or integrate(f(x), x)
        int_indef_match = re.match(
            r"^\\?int(?:egrate)?(?:\s+(.+?)\s*d([a-zA-Z])|\s*\((.+?)\)(?:\s*d([a-zA-Z]))?)$",
            clean_expr,
            re.IGNORECASE,
        )
        # Derivative: d/dx(expr), \frac{d}{dx}(expr), diff(expr, x)
        diff_match = re.match(
            r"^(?:\\?frac\{d\}\{d([a-zA-Z])\}|d/d([a-zA-Z])|diff)\s*(?:\((.+)\)|(.+))$",
            clean_expr,
            re.IGNORECASE,
        )
        # Limit: \lim_{x \to 0} expr or lim(expr, x, 0)
        lim_match = re.match(
            r"^\\?lim(?:it)?(?:_\{?([a-zA-Z])\s*(?:\\to|->)\s*([^}]+)\}?|\s*\((.+?),([a-zA-Z]),(.+?)\))\s*(.+)$",
            clean_expr,
            re.IGNORECASE,
        )

        if int_def_match:
            lower = int_def_match.group(1) or int_def_match.group(2)
            upper = int_def_match.group(3) or int_def_match.group(4)
            integrand_str = int_def_match.group(5).strip()
            var_str = int_def_match.group(6).strip()
            f_expr = parse_expr(integrand_str, transformations=transformations)
            sym = sp.Symbol(var_str)
            lower_expr = parse_expr(lower, transformations=transformations)
            upper_expr = parse_expr(upper, transformations=transformations)
            if subs_dict:
                f_expr = f_expr.subs(subs_dict)
                lower_expr = lower_expr.subs(subs_dict)
                upper_expr = upper_expr.subs(subs_dict)
            val = sp.integrate(f_expr, (sym, lower_expr, upper_expr))
            result_str = _format_solution_value(val)

        elif int_indef_match:
            integrand_str = (int_indef_match.group(1) or int_indef_match.group(3) or "").strip()
            var_str = (int_indef_match.group(2) or int_indef_match.group(4) or "").strip()
            if not var_str:
                if "," in integrand_str:
                    parts = [p.strip() for p in integrand_str.split(",", 1)]
                    integrand_str = parts[0]
                    var_str = parts[1]
                else:
                    var_str = "x"
            # Strip surrounding parentheses if matched (e.g. \int (3x^2 + 2x + 1) dx)
            if integrand_str.startswith("(") and integrand_str.endswith(")"):
                inner = integrand_str[1:-1].strip()
                if inner.count("(") == inner.count(")"):
                    integrand_str = inner
            f_expr = parse_expr(integrand_str, transformations=transformations)
            sym = sp.Symbol(var_str)
            if subs_dict:
                f_expr = f_expr.subs(subs_dict)
            integral = sp.integrate(f_expr, sym)
            result_str = f"{str(integral).replace('**', '^')} + C"

        elif diff_match:
            var_str = diff_match.group(1) or diff_match.group(2) or "x"
            inner = (diff_match.group(3) or diff_match.group(4) or "").strip()
            if "," in inner:
                parts = [p.strip() for p in inner.split(",", 1)]
                f_expr = parse_expr(parts[0], transformations=transformations)
                sym = sp.Symbol(parts[1])
            else:
                f_expr = parse_expr(inner, transformations=transformations)
                sym = sp.Symbol(var_str)
            if subs_dict:
                f_expr = f_expr.subs(subs_dict)
            derivative = sp.diff(f_expr, sym)
            result_str = str(derivative).replace("**", "^")

        elif lim_match:
            if lim_match.group(1):
                sym = sp.Symbol(lim_match.group(1))
                point = parse_expr(lim_match.group(2).strip(), transformations=transformations)
                f_expr = parse_expr(lim_match.group(6).strip(), transformations=transformations)
            else:
                f_expr = parse_expr(lim_match.group(3).strip(), transformations=transformations)
                sym = sp.Symbol(lim_match.group(4))
                point = parse_expr(lim_match.group(5).strip(), transformations=transformations)
            if subs_dict:
                f_expr = f_expr.subs(subs_dict)
            lim_val = sp.limit(f_expr, sym, point)
            result_str = _format_solution_value(lim_val)

        # 3. Check for algebraic equation with '=': e.g. 6x^2 + 11x - 35 = 0, u^2 - 5u - 14 = 0
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
                free_symbols.sort(key=lambda s: s.name)
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
                result_str = "True" if bool(eq) else "False"

        # 4. Standard arithmetic / algebraic evaluation
        else:
            parsed = parse_expr(clean_expr, transformations=transformations)
            if subs_dict:
                parsed = parsed.subs(subs_dict)

            if hasattr(parsed, "is_number") and parsed.is_number:
                result_str = _format_solution_value(parsed)
            else:
                result_str = str(parsed).replace("**", "^")

    except Exception as err:
        print(f"[SymPySolver] Error solving '{equation_raw}' (cleaned: '{clean_expr}'): {err}")
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
        "fontFamily": "handwriting",
        "textAlign": "left",
        "verticalAlign": "middle",
        "angle": 0,
        "strokeColor": "#22c55e",
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
            "cleanedEquation": clean_expr,
            "solution": result_str,
        },
    }

    return result_str, proposed_element
