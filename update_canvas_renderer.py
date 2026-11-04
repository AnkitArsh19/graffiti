"""
Patch canvasRenderer.ts to add:
1. wrapTextToLines() helper function (word-wrap against maxWidth)
2. Proper word-wrapped, clipped, vertically-centred text rendering inside shapes
3. Fallback for free-floating `text` elements (no clipping, existing behaviour)
"""

import re

FILE = r"c:\Users\KIIT0001\graffiti\graffiti-frontend\src\lib\canvasRenderer.ts"

with open(FILE, "rb") as f:
    raw = f.read()

# Detect line-ending style (CRLF vs LF)
crlf = b"\r\n" in raw
NL = "\r\n" if crlf else "\n"

text = raw.decode("utf-8")

# ------------------------------------------------------------------
# 1. Insert wrapTextToLines helper BEFORE the drawShapeOnCanvas function.
#    We locate the function declaration and prepend the helper above it.
# ------------------------------------------------------------------
HELPER = NL.join([
    "/**",
    " * Word-wraps a string to fit within maxWidth pixels on the given canvas context.",
    " * Splits on existing \\n newlines first, then wraps by word within each paragraph.",
    " */",
    "function wrapTextToLines(",
    "  ctx: CanvasRenderingContext2D,",
    "  rawText: string,",
    "  maxWidth: number,",
    "): string[] {",
    "  const result: string[] = [];",
    "  for (const paragraph of rawText.split(\"\\n\")) {",
    "    const words = paragraph.split(\" \");",
    "    let line = \"\";",
    "    for (const word of words) {",
    "      const test = line ? `${line} ${word}` : word;",
    "      if (!line || ctx.measureText(test).width <= maxWidth) {",
    "        line = test;",
    "      } else {",
    "        result.push(line);",
    "        line = word;",
    "      }",
    "    }",
    "    if (line !== undefined) result.push(line);",
    "  }",
    "  return result.length > 0 ? result : [\"\"];",
    "}",
    "",
])

# Insert before `function drawShapeOnCanvas(`
ANCHOR_DRAW = "function drawShapeOnCanvas("
if HELPER.rstrip() not in text:
    text = text.replace(ANCHOR_DRAW, HELPER + ANCHOR_DRAW)
    print("OK: Inserted wrapTextToLines helper.")
else:
    print("INFO: wrapTextToLines already present, skipping insertion.")

# ------------------------------------------------------------------
# 2. Replace the text-rendering block inside drawShapeOnCanvas.
#    Original block (lines 549-589):
#      if (element.text) { ... fontSize ... font ... lines = text.split("\n") ... fillText ... }
#      context.restore();
# ------------------------------------------------------------------

OLD_TEXT_BLOCK = NL.join([
    "  // Draw element text using selected font family and size",
    "  if (element.text) {",
    "    const fontSize =",
    "      element.customFontSize ||",
    "      (element.fontSize === \"small\"",
    "        ? 14",
    "        : element.fontSize === \"large\"",
    "        ? 24",
    "        : element.fontSize === \"xlarge\"",
    "        ? 32",
    "        : 18);",
    "",
    "    const fontFamilyName =",
    "      element.fontFamily === \"clean\"",
    "        ? '\"Inter\", -apple-system, sans-serif'",
    "        : element.fontFamily === \"mono\"",
    "        ? '\"JetBrains Mono\", \"Courier New\", monospace'",
    "        : '\"Montserrat\", sans-serif';",
    "",
    "    context.fillStyle = strokeColor;",
    "    context.font = `normal ${fontSize}px ${fontFamilyName}`;",
    "    context.textBaseline = \"top\";",
    "    context.textAlign = element.textAlign || \"left\";",
    "",
    "    const padding = element.type === \"sticky\" ? 14 : 2;",
    "    const lines = element.text.split(\"\\n\");",
    "    const lineHeight = fontSize * 1.35;",
    "",
    "    let startX = padding;",
    "    if (element.textAlign === \"center\") {",
    "      startX = element.width / 2;",
    "    } else if (element.textAlign === \"right\") {",
    "      startX = element.width - padding;",
    "    }",
    "",
    "    lines.forEach((line, i) => {",
    "      context.fillText(line, startX, padding + i * lineHeight);",
    "    });",
    "  }",
    "",
    "  context.restore();",
])

NEW_TEXT_BLOCK = NL.join([
    "  // ── Text rendering: word-wrap + clip for shapes; free-flow for text elements ──",
    "  if (element.text) {",
    "    const fontSize =",
    "      element.customFontSize ||",
    "      (element.fontSize === \"small\"",
    "        ? 14",
    "        : element.fontSize === \"large\"",
    "        ? 24",
    "        : element.fontSize === \"xlarge\"",
    "        ? 32",
    "        : 18);",
    "",
    "    const fontFamilyName =",
    "      element.fontFamily === \"clean\"",
    "        ? '\"Inter\", -apple-system, sans-serif'",
    "        : element.fontFamily === \"mono\"",
    "        ? '\"JetBrains Mono\", \"Courier New\", monospace'",
    "        : '\"Montserrat\", sans-serif';",
    "",
    "    context.fillStyle = strokeColor;",
    "    context.font = `normal ${fontSize}px ${fontFamilyName}`;",
    "    context.textBaseline = \"top\";",
    "",
    "    const isShapeContainer = [\"rectangle\", \"ellipse\", \"diamond\", \"sticky\", \"card\"].includes(element.type);",
    "",
    "    if (isShapeContainer) {",
    "      // ── Shape / sticky: word-wrap, clip, centre-align non-stickies ──",
    "      const padding = element.type === \"sticky\" ? 14 : 12;",
    "      const maxTextWidth = Math.max(element.width - padding * 2, 10);",
    "      const lineHeight = fontSize * 1.4;",
    "",
    "      // Build wrapped lines list",
    "      context.font = `normal ${fontSize}px ${fontFamilyName}`;",
    "      const wrappedLines = wrapTextToLines(context, element.text, maxTextWidth);",
    "      const totalTextHeight = wrappedLines.length * lineHeight;",
    "",
    "      // Clip to shape bounding box so text cannot overflow",
    "      context.save();",
    "      context.beginPath();",
    "      context.rect(padding, padding, element.width - padding * 2, element.height - padding * 2);",
    "      context.clip();",
    "",
    "      // Determine horizontal alignment",
    "      const align = element.textAlign || (element.type === \"sticky\" ? \"left\" : \"center\");",
    "      context.textAlign = align as CanvasTextAlign;",
    "      let startX = padding;",
    "      if (align === \"center\") {",
    "        startX = element.width / 2;",
    "      } else if (align === \"right\") {",
    "        startX = element.width - padding;",
    "      }",
    "",
    "      // Vertical centring for non-sticky shapes; sticky starts from top",
    "      let startY: number;",
    "      if (element.type === \"sticky\") {",
    "        startY = padding;",
    "      } else {",
    "        startY = Math.max(padding, (element.height - totalTextHeight) / 2);",
    "      }",
    "",
    "      wrappedLines.forEach((line, i) => {",
    "        context.fillText(line, startX, startY + i * lineHeight);",
    "      });",
    "      context.restore();",
    "",
    "    } else {",
    "      // ── Free-floating text element: no clipping, no forced wrap ──",
    "      context.textAlign = (element.textAlign || \"left\") as CanvasTextAlign;",
    "      const padding = 2;",
    "      const lineHeight = fontSize * 1.35;",
    "      let startX = padding;",
    "      if (element.textAlign === \"center\") startX = element.width / 2;",
    "      else if (element.textAlign === \"right\") startX = element.width - padding;",
    "      const freeLines = element.text.split(\"\\n\");",
    "      freeLines.forEach((line, i) => {",
    "        context.fillText(line, startX, padding + i * lineHeight);",
    "      });",
    "    }",
    "  }",
    "",
    "  context.restore();",
])

if OLD_TEXT_BLOCK in text:
    text = text.replace(OLD_TEXT_BLOCK, NEW_TEXT_BLOCK)
    print("OK: Replaced text rendering block with word-wrap + clip version.")
else:
    print("FAIL: OLD_TEXT_BLOCK not found -- checking for CRLF/LF mismatch...")
    # Try the other line ending
    alt_NL = "\n" if crlf else "\r\n"
    alt_old = OLD_TEXT_BLOCK.replace(NL, alt_NL)
    if alt_old in text:
        text = text.replace(alt_old, NEW_TEXT_BLOCK)
        print("OK: Replaced text rendering block (alt line ending).")
    else:
        print("FAIL: Could not locate OLD_TEXT_BLOCK in file. Manual inspection needed.")
        # Print the actual text in that region for debugging
        idx = text.find("// Draw element text using selected font family and size")
        if idx != -1:
            print("Found heading at char", idx)
            print(repr(text[idx:idx+200]))

with open(FILE, "wb") as f:
    f.write(text.encode("utf-8"))

print("DONE -- canvasRenderer.ts patched.")
