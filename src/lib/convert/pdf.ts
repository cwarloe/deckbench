import { slugFileBase } from "@/lib/utils";
import { makeId, renderSlideMarkdown } from "./markdown";
import type { ConvertResult, ConvertSettings, ConvertedImage, SlideDraft } from "./types";

type Pdfjs = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<Pdfjs> | null = null;

async function loadPdfjs(): Promise<Pdfjs> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import("pdfjs-dist");
      const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}

function linesFromItems(
  items: Array<{ str?: string; transform?: number[]; hasEOL?: boolean }>,
): string[] {
  const rows: { y: number; x: number; text: string }[] = [];
  for (const item of items) {
    const text = (item.str ?? "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    const transform = item.transform ?? [];
    rows.push({
      y: Math.round((transform[5] ?? 0) * 2) / 2,
      x: transform[4] ?? 0,
      text,
    });
  }
  rows.sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: { y: number; parts: { x: number; text: string }[] }[] = [];
  for (const row of rows) {
    const current = lines[lines.length - 1];
    if (!current || Math.abs(current.y - row.y) > 6) {
      lines.push({ y: row.y, parts: [{ x: row.x, text: row.text }] });
    } else {
      current.parts.push({ x: row.x, text: row.text });
    }
  }
  return lines
    .map((line) =>
      line.parts
        .sort((a, b) => a.x - b.x)
        .map((part) => part.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
}

type RenderablePage = {
  getViewport: (opts: { scale: number }) => { width: number; height: number };
  render: (opts: {
    canvasContext: CanvasRenderingContext2D;
    viewport: unknown;
  }) => { promise: Promise<void> };
};

async function renderPagePng(
  page: RenderablePage,
  scale: number,
): Promise<Uint8Array | null> {
  if (typeof document === "undefined") return null;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  await page.render({ canvasContext: ctx, viewport }).promise;
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((value) => resolve(value), "image/png"),
  );
  if (!blob) return null;
  return new Uint8Array(await blob.arrayBuffer());
}

export async function convertPdf(
  file: File,
  settings: ConvertSettings,
): Promise<ConvertResult> {
  const pdfjs = await loadPdfjs();
  const baseName = slugFileBase(file.name);
  const warnings: string[] = [];
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data: data.slice() }).promise;
  const slides: SlideDraft[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const lines = linesFromItems(
      content.items as Array<{ str?: string; transform?: number[]; hasEOL?: boolean }>,
    );
    const title = lines[0] ?? "";
    const bullets = lines.slice(1);
    const images: ConvertedImage[] = [];

    if (settings.pdfRenderPages) {
      try {
        const bytes = await renderPagePng(page as unknown as RenderablePage, 1.4);
        if (bytes) {
          const fileName = `slide_${pageNum}_img_0.png`;
          images.push({
            relPath: `images/${baseName}/${fileName}`,
            fileName,
            bytes,
            mime: "image/png",
          });
        }
      } catch (error) {
        warnings.push(
          `Could not render page ${pageNum}: ${error instanceof Error ? error.message : "unknown error"}`,
        );
      }
    }

    slides.push({
      number: pageNum,
      title,
      bullets,
      notes: "",
      images,
    });
  }

  return {
    id: makeId(),
    fileName: file.name,
    baseName,
    format: "pdf",
    mode: "slides",
    markdown: renderSlideMarkdown(slides, settings),
    images: slides.flatMap((slide) => slide.images),
    slides,
    warnings,
  };
}
