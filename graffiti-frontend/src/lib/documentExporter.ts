import { PDFDocument } from "pdf-lib";
import pptxgen from "pptxgenjs";
import JSZip from "jszip";

export interface AnnotatedExportPage {
  index: number;
  baseCanvas: HTMLCanvasElement;
  drawingCanvas: HTMLCanvasElement;
  width: number;
  height: number;
  originalWidth?: number;
  originalHeight?: number;
}

/**
 * Merges the document base layer and user annotation layer into a single canvas.
 */
export function getMergedCanvas(page: AnnotatedExportPage): HTMLCanvasElement {
  const merged = document.createElement("canvas");
  merged.width = page.width;
  merged.height = page.height;
  const ctx = merged.getContext("2d");
  if (!ctx) return merged;

  // Draw base document
  ctx.drawImage(page.baseCanvas, 0, 0, page.width, page.height);

  // Draw annotations on top
  ctx.drawImage(page.drawingCanvas, 0, 0, page.width, page.height);

  return merged;
}

/**
 * Downloads a Blob as a file in the browser.
 */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export all annotated pages to a single PDF document.
 * Preserves original page points/dimensions when available.
 */
export async function exportToAnnotatedPdf(
  pages: AnnotatedExportPage[],
  filename: string = "annotated-document.pdf"
): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();

  for (const page of pages) {
    const merged = getMergedCanvas(page);
    const dataUrl = merged.toDataURL("image/png");
    const base64Data = dataUrl.split(",")[1];
    const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

    const pngImage = await pdfDoc.embedPng(imageBytes);

    // Target dimensions in points: use original dimensions if present, otherwise pixel dimensions
    const ptWidth = page.originalWidth || page.width;
    const ptHeight = page.originalHeight || page.height;

    const pdfPage = pdfDoc.addPage([ptWidth, ptHeight]);
    pdfPage.drawImage(pngImage, {
      x: 0,
      y: 0,
      width: ptWidth,
      height: ptHeight,
    });
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
  if (filename) {
    triggerDownload(blob, filename);
  }
  return blob;
}

/**
 * Export annotated pages as PNG images.
 * If 1 page, downloads image directly; if multiple, bundles into a ZIP archive.
 */
export async function exportToImages(
  pages: AnnotatedExportPage[],
  baseFilename: string = "annotated-page"
): Promise<void> {
  if (pages.length === 1) {
    const merged = getMergedCanvas(pages[0]);
    merged.toBlob((blob) => {
      if (blob) {
        triggerDownload(blob, `${baseFilename}-1.png`);
      }
    }, "image/png");
    return;
  }

  const zip = new JSZip();

  for (const page of pages) {
    const merged = getMergedCanvas(page);
    const dataUrl = merged.toDataURL("image/png");
    const base64Data = dataUrl.split(",")[1];
    zip.file(`${baseFilename}-${page.index + 1}.png`, base64Data, { base64: true });
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  triggerDownload(zipBlob, `${baseFilename}s.zip`);
}

/**
 * Export annotated slides to a new PowerPoint (.pptx) file.
 * Preserves exact aspect ratio and dimensions: portrait documents export as portrait slides,
 * landscape documents export as landscape slides without squishing.
 */
export async function exportToAnnotatedPptx(
  pages: AnnotatedExportPage[],
  filename: string = "annotated-presentation.pptx"
): Promise<void> {
  if (pages.length === 0) return;
  const pptx = new pptxgen();

  const firstPage = pages[0];
  const isPortrait = firstPage.height > firstPage.width;

  if (isPortrait) {
    // Proportional Portrait slide: base width 8.27 inches (A4 portrait width)
    const slideWidth = 8.27;
    const slideHeight = Number(((slideWidth * firstPage.height) / firstPage.width).toFixed(2));
    pptx.defineLayout({
      name: "DOC_PORTRAIT_LAYOUT",
      width: slideWidth,
      height: slideHeight,
    });
    pptx.layout = "DOC_PORTRAIT_LAYOUT";
  } else {
    // Proportional Landscape slide: base width 10 inches
    const slideWidth = 10;
    const slideHeight = Number(((slideWidth * firstPage.height) / firstPage.width).toFixed(2));
    pptx.defineLayout({
      name: "DOC_LANDSCAPE_LAYOUT",
      width: slideWidth,
      height: slideHeight,
    });
    pptx.layout = "DOC_LANDSCAPE_LAYOUT";
  }

  for (const page of pages) {
    const slide = pptx.addSlide();
    const merged = getMergedCanvas(page);
    const dataUrl = merged.toDataURL("image/png");

    slide.addImage({
      data: dataUrl,
      x: 0,
      y: 0,
      w: "100%",
      h: "100%",
    });
  }

  await pptx.writeFile({ fileName: filename });
}

