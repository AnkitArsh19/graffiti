/**
 * Safe, zero-dependency mathematical expression evaluator for whiteboard math solver.
 * Evaluates arithmetic and formulas without using unsafe eval() or Function().
 */

function tokenize(expr: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  const s = expr.replace(/\s+/g, "").replace(/=/g, "");

  while (i < s.length) {
    const ch = s[i];

    if ("+-*/^(),".includes(ch)) {
      tokens.push(ch);
      i++;
    } else if (/[0-9.]/.test(ch)) {
      let num = "";
      while (i < s.length && /[0-9.]/.test(s[i])) {
        num += s[i];
        i++;
      }
      tokens.push(num);
    } else if (/[a-zA-Z_]/.test(ch)) {
      let ident = "";
      while (i < s.length && /[a-zA-Z0-9_]/.test(s[i])) {
        ident += s[i];
        i++;
      }
      tokens.push(ident.toLowerCase());
    } else {
      i++;
    }
  }

  return tokens;
}

export function evaluateMathExpression(
  rawExpr: string,
  variables?: Record<string, number>
): { success: boolean; result?: number; formatted?: string } {
  try {
    let expr = rawExpr.trim();
    if (expr.endsWith("=")) {
      expr = expr.slice(0, -1).trim();
    }
    // Also support expressions with "= ?" or "=?"
    expr = expr.replace(/=\s*\??$/, "").trim();

    if (!expr) return { success: false };

    // Replace "X% of Y" with "(X/100)*Y"
    expr = expr.replace(/(\d+(?:\.\d+)?)\s*%\s*(?:of|\*)\s*(\d+(?:\.\d+)?)/gi, "($1/100)*$2");
    // Replace standalone "X%" with "(X/100)"
    expr = expr.replace(/(\d+(?:\.\d+)?)\s*%/g, "($1/100)");

    // Substitute page variables if provided (e.g. { r: 5, cost: 100 })
    if (variables && Object.keys(variables).length > 0) {
      for (const [varName, varVal] of Object.entries(variables)) {
        if (typeof varVal === "number" && !Number.isNaN(varVal)) {
          const varRegex = new RegExp(`\\b${varName}\\b`, "gi");
          expr = expr.replace(varRegex, `(${varVal})`);
        }
      }
    }

    const tokens = tokenize(expr);
    if (tokens.length === 0) return { success: false };

    let pos = 0;

    function peek(): string | undefined {
      return tokens[pos];
    }

    function consume(expected?: string): string {
      const t = tokens[pos];
      if (expected && t !== expected) {
        throw new Error(`Expected token ${expected} but got ${t}`);
      }
      pos++;
      return t;
    }

    // Grammar:
    // Expression = Term (('+' | '-') Term)*
    // Term = Factor (('*' | '/') Factor)*
    // Factor = Power ('^' Power)*
    // Power = ('+' | '-')? Primary
    // Primary = NUMBER | IDENT '(' ArgList ')' | '(' Expression ')' | CONSTANT

    function parseExpression(): number {
      let val = parseTerm();
      while (peek() === "+" || peek() === "-") {
        const op = consume();
        const rhs = parseTerm();
        val = op === "+" ? val + rhs : val - rhs;
      }
      return val;
    }

    function parseTerm(): number {
      let val = parseFactor();
      while (peek() === "*" || peek() === "/") {
        const op = consume();
        const rhs = parseFactor();
        if (op === "/" && rhs === 0) throw new Error("Division by zero");
        val = op === "*" ? val * rhs : val / rhs;
      }
      return val;
    }

    function parseFactor(): number {
      let val = parseUnary();
      if (peek() === "^") {
        consume("^");
        const rhs = parseFactor();
        val = Math.pow(val, rhs);
      }
      return val;
    }

    function parseUnary(): number {
      if (peek() === "+") {
        consume("+");
        return parseUnary();
      }
      if (peek() === "-") {
        consume("-");
        return -parseUnary();
      }
      return parsePrimary();
    }

    function parsePrimary(): number {
      const t = peek();
      if (!t) throw new Error("Unexpected end of expression");

      // Parentheses
      if (t === "(") {
        consume("(");
        const val = parseExpression();
        consume(")");
        return val;
      }

      // Functions or Constants
      if (/^[a-z_][a-z0-9_]*$/.test(t)) {
        const name = consume();
        if (name === "pi") return Math.PI;
        if (name === "e") return Math.E;

        // Function call: name(arg1, arg2...)
        if (peek() === "(") {
          consume("(");
          const args: number[] = [];
          if (peek() !== ")") {
            args.push(parseExpression());
            while (peek() === ",") {
              consume(",");
              args.push(parseExpression());
            }
          }
          consume(")");

          const arg0 = args[0] ?? 0;
          const arg1 = args[1];

          switch (name) {
            case "sqrt":
              return Math.sqrt(arg0);
            case "cbrt":
              return Math.cbrt(arg0);
            case "abs":
              return Math.abs(arg0);
            case "sin":
              return Math.sin(arg0);
            case "cos":
              return Math.cos(arg0);
            case "tan":
              return Math.tan(arg0);
            case "log":
            case "ln":
              // If two args: log(x, base)
              return arg1 !== undefined ? Math.log(arg0) / Math.log(arg1) : Math.log(arg0);
            case "log10":
              return Math.log10(arg0);
            case "exp":
              return Math.exp(arg0);
            case "round":
              return Math.round(arg0);
            case "floor":
              return Math.floor(arg0);
            case "ceil":
              return Math.ceil(arg0);
            default:
              throw new Error(`Unknown function: ${name}`);
          }
        }
        throw new Error(`Unknown identifier: ${name}`);
      }

      // Number
      const num = Number(consume());
      if (Number.isNaN(num)) throw new Error(`Invalid number: ${t}`);
      return num;
    }

    const value = parseExpression();
    if (pos < tokens.length) {
      return { success: false };
    }

    // Format neatly (rounded to up to 6 decimal places if fractional)
    const formatted = Number.isInteger(value) ? `${value}` : `${parseFloat(value.toFixed(6))}`;
    return { success: true, result: value, formatted };
  } catch {
    return { success: false };
  }
}
