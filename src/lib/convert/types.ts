export const SOURCE_FORMATS = [
  "pptx",
  "odp",
  "pdf",
  "docx",
  "html",
  "md",
  "txt",
  "rtf",
  "csv",
  "xlsx",
  "image",
] as const;

export type SourceFormat = (typeof SOURCE_FORMATS)[number];

export type DetectedFormat =
  | { kind: "ok"; format: SourceFormat }
  | { kind: "unsupported"; format: string; reason: string };

export type ConvertSettings = {
  imageWidthPx: number;
  includeNotes: boolean;
  imageMarkup: "html" | "markdown";
  pdfRenderPages: boolean;
  headingAsSlide: boolean;
};

export const DEFAULT_SETTINGS: ConvertSettings = {
  imageWidthPx: 500,
  includeNotes: true,
  imageMarkup: "html",
  pdfRenderPages: true,
  headingAsSlide: true,
};

export type ConvertedImage = {
  relPath: string;
  fileName: string;
  bytes: Uint8Array;
  mime: string;
};

export type SlideDraft = {
  number: number;
  title: string;
  bullets: string[];
  notes: string;
  images: ConvertedImage[];
};

export type ConvertResult = {
  id: string;
  fileName: string;
  baseName: string;
  format: SourceFormat;
  mode: "slides" | "document";
  markdown: string;
  images: ConvertedImage[];
  slides: SlideDraft[];
  warnings: string[];
};

export type JobStatus = "queued" | "working" | "done" | "error";

export type ConvertJob = {
  id: string;
  fileName: string;
  size: number;
  status: JobStatus;
  error?: string;
  result?: ConvertResult;
};
