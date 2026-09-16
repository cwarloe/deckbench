import { encodeRelPath } from "./xml";
import { escapeXml } from "./entities";
import type { ConvertSettings, ConvertedImage, SlideDraft } from "./types";

export function imageRelPath(
  baseName: string,
  fileName: string,
): { relPath: string; encoded: string } {
  const encoded = encodeRelPath(["images", baseName, fileName]);
  return { relPath: `images/${baseName}/${fileName}`, encoded };
}

export function renderImageTag(
  image: ConvertedImage,
  alt: string,
  settings: ConvertSettings,
): string {
  const encoded = image.relPath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  if (settings.imageMarkup === "markdown") {
    return `![${alt}](${encoded})`;
  }
  return `<img src="${encoded}" alt="${escapeAttr(alt)}" width="${settings.imageWidthPx}" />`;
}

export function renderSlideMarkdown(
  slides: SlideDraft[],
  settings: ConvertSettings,
): string {
  const parts: string[] = [];
  for (const slide of slides) {
    if (slide.title) {
      parts.push(`# Slide ${slide.number} - ${slide.title}\n\n`);
    } else {
      parts.push(`# Slide ${slide.number}\n\n`);
    }
    for (const bullet of slide.bullets) {
      const lines = bullet.split("\n");
      parts.push(`- ${lines[0]}\n`);
      for (const extra of lines.slice(1)) {
        parts.push(`  ${extra}\n`);
      }
    }
    if (settings.includeNotes && slide.notes) {
      parts.push("\n**Notes:**\n");
      parts.push(`${slide.notes}\n`);
    }
    slide.images.forEach((image, index) => {
      const alt = `Slide ${slide.number} Image ${index}`;
      parts.push(`\n${renderImageTag(image, alt, settings)}\n`);
    });
    parts.push("\n");
  }
  return parts.join("");
}

export function escapeAttr(value: string): string {
  return escapeXml(value);
}

export function makeId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `job_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
