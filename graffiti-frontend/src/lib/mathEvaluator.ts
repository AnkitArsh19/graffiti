/**
 * Safe, zero-dependency mathematical expression evaluator for whiteboard math solver.
 * Evaluates arithmetic without using unsafe eval() or Function().
 */

function tokenize(expr: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  const s = expr.replace(/\s+/g, "").replace(/=/g, "");

  while (i < s.length) {
    const ch = s[i];

    if ("+-*/^()".includes(ch)) {
      tokens.push(ch);
      i++;
    } else if (/[0-9.]/.test(ch)) {
      let num = "";
      while (i < s.length && /[0-9.]/.test(s[i])) {
        num += s[i];
        i++;
      }
      tokens.push(num);
    } else if (/[a-zA-Z]/.test(ch)) {
      let ident = "";
      while (i < s.length && /[a-zA-Z]/.test(s[i])) {
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

export function evaluateMathExpression(rawExpr: string): { success: boolean; result?: number; formatted?: string } {
  try {
    let expr = rawExpr.trim();
    if (expr.endsWith("=")) {
      expr = expr.slice(0, -1).trim();
    }
    // Also support expressions with "= ?" or "=?"
    expr = expr.replace(/=\s*\??$/, "").trim();

    if (!expr) return { success: false };

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
    // Primary = NUMBER | IDENT '(' Expression ')' | '(' Expression ')' | CONSTANT

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
      if (/^[a-z]+$/.test(t)) {
        const name = consume();
        if (name === "pi") return Math.PI;
        if (name === "e") return Math.E;

        // Function call: name(expr)
        if (peek() === "(") {
          consume("(");
          const arg = parseExpression();
          consume(")");
          switch (name) {
            case "sqrt":
              return Math.sqrt(arg);
            case "abs":
              return Math.abs(arg);
            case "sin":
              return Math.sin(arg);
            case "cos":
              return Math.cos(arg);
            case "tan":
              return Math.tan(arg);
            case "log":
            case "ln":
              return Math.log(arg);
            case "log10":
              return Math.log10(arg);
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

