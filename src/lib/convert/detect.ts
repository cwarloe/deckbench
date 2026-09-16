import type { DetectedFormat, SourceFormat } from "./types";

const BY_EXT: Record<string, SourceFormat> = {
  pptx: "pptx",
  pptm: "pptx",
  potx: "pptx",
  ppsx: "pptx",
  odp: "odp",
  pdf: "pdf",
  docx: "docx",
  docm: "docx",
  html: "html",
  htm: "html",
  md: "md",
  markdown: "md",
  txt: "txt",
  rtf: "rtf",
  csv: "csv",
  xlsx: "xlsx",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  bmp: "image",
  svg: "image",
};

export const FORMAT_ACCEPT = [
  ".pptx",
  ".pptm",
  ".potx",
  ".ppsx",
  ".odp",
  ".pdf",
  ".docx",
  ".docm",
  ".html",
  ".htm",
  ".md",
  ".markdown",
  ".txt",
  ".rtf",
  ".csv",
  ".xlsx",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp",
  ".svg",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/html",
  "text/csv",
  "text/markdown",
  "image/*",
].join(",");

export const FORMAT_GUIDE: {
  format: SourceFormat | "legacy";
  label: string;
  hint: string;
}[] = [
  { format: "pptx", label: "PPTX", hint: "Slide text, notes, and images" },
  { format: "pdf", label: "PDF", hint: "Each page becomes a slide" },
  { format: "docx", label: "Word", hint: "Headings become sections" },
  { format: "html", label: "HTML", hint: "Clean Git-ready Markdown" },
  { format: "xlsx", label: "Excel", hint: "Sheets as Markdown tables" },
  { format: "csv", label: "CSV", hint: "One Markdown table" },
  { format: "odp", label: "ODP", hint: "LibreOffice decks" },
  { format: "md", label: "Markdown", hint: "Normalize and pack" },
  { format: "image", label: "Images", hint: "PNG, JPG, WebP, GIF" },
  { format: "txt", label: "Text", hint: "TXT and RTF" },
];

export function detectFormat(file: File): DetectedFormat {
  const name = file.name;
  const ext = (name.split(".").pop() ?? "").toLowerCase();

  if (ext === "ppt") {
    return {
      kind: "unsupported",
      format: "ppt",
      reason: "Old .ppt files need a Save As .pptx first.",
    };
  }
  if (ext === "doc") {
    return {
      kind: "unsupported",
      format: "doc",
      reason: "Old .doc files need a Save As .docx first.",
    };
  }
  if (ext === "xls") {
    return {
      kind: "unsupported",
      format: "xls",
      reason: "Old .xls files need a Save As .xlsx or CSV first.",
    };
  }

  const format = BY_EXT[ext];
  if (!format) {
    return {
      kind: "unsupported",
      format: ext || "unknown",
      reason: `No converter yet for .${ext || "unknown"} files.`,
    };
  }
  return { kind: "ok", format };
}

export function formatLabel(format: SourceFormat): string {
  const labels: Record<SourceFormat, string> = {
    pptx: "PowerPoint",
    odp: "OpenDocument",
    pdf: "PDF",
    docx: "Word",
    html: "HTML",
    md: "Markdown",
    txt: "Text",
    rtf: "RTF",
    csv: "CSV",
    xlsx: "Excel",
    image: "Image",
  };
  return labels[format];
}
