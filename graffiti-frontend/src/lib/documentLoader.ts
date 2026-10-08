// Document type detection and loading utilities

export type DocumentFileType = "pdf" | "docx" | "pptx" | "image" | "unsupported";

export interface DocumentPage {
  index: number;
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  originalWidth?: number;
  originalHeight?: number;
}

export function detectFileType(file: File): DocumentFileType {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".docx")) return "docx";
  if (name.endsWith(".pptx")) return "pptx";
  if (file.type.startsWith("image/") || /\.(png|jpe?g|webp|svg|bmp|gif)$/i.test(name)) return "image";
  return "unsupported";
}

// ---- PDF via pdfjs-dist ----
export async function loadPdf(file: File): Promise<DocumentPage[]> {
  const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
  // Use the bundled worker
  GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: arrayBuffer }).promise;
  const pages: DocumentPage[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const unscaledViewport = page.getViewport({ scale: 1.0 });
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
    pages.push({
      index: i - 1,
      canvas,
      width: viewport.width,
      height: viewport.height,
      originalWidth: unscaledViewport.width,
      originalHeight: unscaledViewport.height,
    });
  }

  return pages;
}

// ---- DOCX via docx-preview + html2canvas ----
export async function loadDocx(file: File): Promise<DocumentPage[]> {
  const { renderAsync } = await import("docx-preview");
  const html2canvas = (await import("html2canvas")).default;

  const arrayBuffer = await file.arrayBuffer();
  const container = document.createElement("div");
  container.style.cssText = `
    position: fixed; left: -9999px; top: 0;
    width: 816px; background: #ffffff;
    font-family: "Times New Roman", serif;
  `;
  document.body.appendChild(container);

  await renderAsync(arrayBuffer, container, undefined, {
    className: "docx-preview-page",
    inWrapper: true,
    ignoreWidth: false,
    ignoreHeight: false,
    ignoreFonts: false,
    breakPages: true,
    renderHeaders: true,
    renderFooters: true,
    renderFootnotes: true,
    useBase64URL: true,
  });

  const pageEls = container.querySelectorAll(".docx-wrapper > section");
  const pages: DocumentPage[] = [];

  if (pageEls.length === 0) {
    // Fallback: capture entire container as one page
    const canvas = await html2canvas(container, { scale: 1.5, useCORS: true, backgroundColor: "#ffffff" });
    pages.push({ index: 0, canvas, width: canvas.width, height: canvas.height });
  } else {
    for (let i = 0; i < pageEls.length; i++) {
      const el = pageEls[i] as HTMLElement;
      const canvas = await html2canvas(el, { scale: 1.5, useCORS: true, backgroundColor: "#ffffff" });
      pages.push({ index: i, canvas, width: canvas.width, height: canvas.height });
    }
  }

  document.body.removeChild(container);
  return pages;
}

// ---- PPTX via basic slide extraction ----
export async function loadPptx(file: File): Promise<DocumentPage[]> {
  // Use JSZip to extract slide images/content from pptx (it is a zip file)
  const JSZip = (await import("jszip")).default;
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  const pages: DocumentPage[] = [];

  // Try to get slide thumbnail images (some PPTX files include them)
  const thumbnailFolder = zip.folder("ppt/media");
  const slideFiles = Object.keys(zip.files)
    .filter((name) => name.match(/ppt\/slides\/slide\d+\.xml/))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)/)?.[1] ?? "0");
      const numB = parseInt(b.match(/slide(\d+)/)?.[1] ?? "0");
      return numA - numB;
    });

  if (slideFiles.length === 0) {
    // Fallback: show a single placeholder
    const canvas = createPlaceholderCanvas("Could not read PPTX slides", 1280, 720);
    pages.push({ index: 0, canvas, width: 1280, height: 720 });
    return pages;
  }

  for (let i = 0; i < slideFiles.length; i++) {
    // Create a placeholder canvas per slide indicating slide number
    // A full PPTX renderer is out of scope for offline use
    const canvas = createPlaceholderCanvas(`Slide ${i + 1} of ${slideFiles.length}`, 1280, 720);
    pages.push({ index: i, canvas, width: 1280, height: 720 });
  }

  return pages;
}

function createPlaceholderCanvas(label: string, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#f8f9fa";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#dee2e6";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, width - 2, height - 2);
  ctx.fillStyle = "#868e96";
  ctx.font = "bold 28px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, width / 2, height / 2);
  ctx.font = "16px Inter, system-ui, sans-serif";
  ctx.fillStyle = "#adb5bd";
  ctx.fillText("Draw your annotations above", width / 2, height / 2 + 48);
  return canvas;
}

export async function loadImageFile(file: File): Promise<DocumentPage[]> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || 1200;
      canvas.height = img.naturalHeight || 800;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to get 2d context for image canvas"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve([
        {
          index: 0,
          canvas,
          width: canvas.width,
          height: canvas.height,
          originalWidth: canvas.width,
          originalHeight: canvas.height,
        },
      ]);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to load image: ${file.name}`));
    };
    img.src = url;
  });
}

export async function loadDocument(file: File): Promise<{ type: DocumentFileType; pages: DocumentPage[] }> {
  const type = detectFileType(file);
  switch (type) {
    case "pdf":
      return { type, pages: await loadPdf(file) };
    case "docx":
      return { type, pages: await loadDocx(file) };
    case "pptx":
      return { type, pages: await loadPptx(file) };
    case "image":
      return { type, pages: await loadImageFile(file) };
    default:
      throw new Error(`Unsupported file type: ${file.name}`);
  }
}

