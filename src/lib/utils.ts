import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugFileBase(name: string): string {
  const base = name.replace(/\.[^.]+$/, "").trim() || "untitled";
  return base;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function mimeFromExt(ext: string): string {
  const e = ext.replace(/^\./, "").toLowerCase();
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
    svg: "image/svg+xml",
    emf: "image/x-emf",
    wmf: "image/x-wmf",
    tif: "image/tiff",
    tiff: "image/tiff",
  };
  return map[e] ?? "application/octet-stream";
}
