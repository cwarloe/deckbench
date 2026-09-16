import JSZip from "jszip";
import type { ConvertResult } from "./types";

export async function packResults(results: ConvertResult[]): Promise<Blob> {
  const zip = new JSZip();
  for (const result of results) {
    zip.file(`${result.baseName}.md`, result.markdown);
    for (const image of result.images) {
      zip.file(image.relPath, image.bytes);
    }
  }
  return zip.generateAsync({ type: "blob" });
}

export function markdownBlob(result: ConvertResult): Blob {
  return new Blob([result.markdown], { type: "text/markdown;charset=utf-8" });
}
