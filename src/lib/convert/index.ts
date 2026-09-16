import { detectFormat } from "./detect";
import { convertDocx, convertHtml, convertMarkdownFile, convertRtf, convertTxt } from "./documents";
import { convertImage } from "./image";
import { convertOdp } from "./odp";
import { convertPdf } from "./pdf";
import { convertPptx } from "./pptx";
import { convertCsv, convertXlsx } from "./spreadsheet";
import type { ConvertResult, ConvertSettings, SourceFormat } from "./types";

export { FORMAT_ACCEPT, FORMAT_GUIDE, detectFormat, formatLabel } from "./detect";
export { DEFAULT_SETTINGS } from "./types";
export type { ConvertJob, ConvertResult, ConvertSettings, SourceFormat } from "./types";
export { packResults, markdownBlob } from "./pack";
export { buildSampleCsv, buildSampleHtml, buildSamplePptx } from "./sample";

export async function convertFile(
  file: File,
  settings: ConvertSettings,
): Promise<ConvertResult> {
  const detected = detectFormat(file);
  if (detected.kind === "unsupported") {
    throw new Error(detected.reason);
  }
  return convertKnown(file, detected.format, settings);
}

async function convertKnown(
  file: File,
  format: SourceFormat,
  settings: ConvertSettings,
): Promise<ConvertResult> {
  switch (format) {
    case "pptx":
      return convertPptx(file, settings);
    case "odp":
      return convertOdp(file, settings);
    case "pdf":
      return convertPdf(file, settings);
    case "docx":
      return convertDocx(file, settings);
    case "html":
      return convertHtml(file, settings);
    case "md":
      return convertMarkdownFile(file);
    case "txt":
      return convertTxt(file);
    case "rtf":
      return convertRtf(file);
    case "csv":
      return convertCsv(file);
    case "xlsx":
      return convertXlsx(file, settings);
    case "image":
      return convertImage(file, settings);
  }
}
