import JSZip from "jszip";
import { mimeFromExt, slugFileBase } from "@/lib/utils";
import { makeId, renderSlideMarkdown } from "./markdown";
import type { ConvertResult, ConvertSettings, ConvertedImage, SlideDraft } from "./types";
import { attr, children, collectText, descendants, extOf, parseXml } from "./xml";

export async function convertOdp(
  file: File,
  settings: ConvertSettings,
): Promise<ConvertResult> {
  const warnings: string[] = [];
  const baseName = slugFileBase(file.name);
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const xml = await zip.file("content.xml")?.async("string");
  if (!xml) throw new Error("This ODP is missing content.xml.");

  const doc = parseXml(xml);
  const pages = descendants(doc, "page");
  if (!pages.length) throw new Error("No slides found in this ODP.");

  const slides: SlideDraft[] = [];

  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    const frames = descendants(page, "frame");
    let title = "";
    const bullets: string[] = [];
    const images: ConvertedImage[] = [];
    let imageIndex = 0;

    for (const frame of frames) {
      const boxes = descendants(frame, "text-box");
      for (const box of boxes) {
        const paragraphs = descendants(box, "p")
          .map((p) => collectText(p).replace(/\s+/g, " ").trim())
          .filter(Boolean);
        if (!paragraphs.length) continue;
        if (!title) {
          title = paragraphs[0];
          bullets.push(...paragraphs.slice(1));
        } else {
          bullets.push(...paragraphs.filter((line) => line !== title));
        }
      }

      const imageNodes = [
        ...children(frame, "image"),
        ...descendants(frame, "image"),
      ];
      for (const image of imageNodes) {
        const href =
          attr(image, "href") ??
          Object.entries(image)
            .find(([key]) => key.toLowerCase().includes("href"))
            ?.[1];
        if (!href) continue;
        const path = String(href).replace(/^\.\//, "");
        const bytes = await zip.file(path)?.async("uint8array");
        if (!bytes) {
          warnings.push(`Could not extract ${path} from slide ${index + 1}.`);
          continue;
        }
        const ext = extOf(path) || "png";
        const fileName = `slide_${index + 1}_img_${imageIndex}.${ext}`;
        imageIndex += 1;
        images.push({
          relPath: `images/${baseName}/${fileName}`,
          fileName,
          bytes,
          mime: mimeFromExt(ext),
        });
      }
    }

    slides.push({
      number: index + 1,
      title,
      bullets: [...new Set(bullets)],
      notes: "",
      images,
    });
  }

  return {
    id: makeId(),
    fileName: file.name,
    baseName,
    format: "odp",
    mode: "slides",
    markdown: renderSlideMarkdown(slides, settings),
    images: slides.flatMap((slide) => slide.images),
    slides,
    warnings,
  };
}
