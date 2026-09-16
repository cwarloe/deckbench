import { mimeFromExt, slugFileBase } from "@/lib/utils";
import { makeId, renderSlideMarkdown } from "./markdown";
import type { ConvertResult, ConvertSettings, ConvertedImage, SlideDraft } from "./types";

export async function convertImages(
  files: File[],
  settings: ConvertSettings,
): Promise<ConvertResult> {
  const first = files[0];
  const baseName =
    files.length === 1 ? slugFileBase(first.name) : "images";
  const slides: SlideDraft[] = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const ext = (file.name.split(".").pop() ?? "png").toLowerCase();
    const fileName = `slide_${index + 1}_img_0.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const image: ConvertedImage = {
      relPath: `images/${baseName}/${fileName}`,
      fileName,
      bytes,
      mime: file.type || mimeFromExt(ext),
    };
    slides.push({
      number: index + 1,
      title: slugFileBase(file.name),
      bullets: [],
      notes: "",
      images: [image],
    });
  }

  return {
    id: makeId(),
    fileName: files.length === 1 ? first.name : `${files.length} images`,
    baseName,
    format: "image",
    mode: "slides",
    markdown: renderSlideMarkdown(slides, settings),
    images: slides.flatMap((slide) => slide.images),
    slides,
    warnings: [],
  };
}

export async function convertImage(
  file: File,
  settings: ConvertSettings,
): Promise<ConvertResult> {
  return convertImages([file], settings);
}
