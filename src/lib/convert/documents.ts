import { mimeFromExt, slugFileBase } from "@/lib/utils";
import { makeId, renderImageTag, renderSlideMarkdown } from "./markdown";
import { decodeBasicEntities } from "./entities";
import type { ConvertResult, ConvertSettings, ConvertedImage, SlideDraft } from "./types";

function splitHeadingsToSlides(
  markdown: string,
  images: ConvertedImage[],
  settings: ConvertSettings,
): { slides: SlideDraft[]; markdown: string } {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const slides: SlideDraft[] = [];
  let current: SlideDraft = {
    number: 1,
    title: "",
    bullets: [],
    notes: "",
    images: [],
  };

  const flush = () => {
    if (!current.title && !current.bullets.length && !current.images.length) return;
    slides.push(current);
    current = {
      number: slides.length + 1,
      title: "",
      bullets: [],
      notes: "",
      images: [],
    };
  };

  for (const line of lines) {
    const heading = /^(#{1,2})\s+(.*)$/.exec(line);
    if (heading) {
      if (current.title || current.bullets.length) flush();
      current.title = heading[2].trim();
      continue;
    }
    const imageMatch = /images\/[^)\s"]+/.exec(line);
    if (imageMatch) {
      const rel = imageMatch[0];
      const image = images.find((item) => item.relPath === rel || line.includes(item.relPath));
      if (image) current.images.push(image);
      continue;
    }
    const bullet = line.replace(/^\s*[-*+]\s+/, "").replace(/^\s*\d+\.\s+/, "").trim();
    if (bullet && line.trim()) current.bullets.push(bullet);
  }
  flush();
  if (!slides.length) {
    slides.push({
      number: 1,
      title: "",
      bullets: lines.map((line) => line.trim()).filter(Boolean),
      notes: "",
      images,
    });
  }
  return { slides, markdown: renderSlideMarkdown(slides, settings) };
}

function htmlTablesToMarkdown(html: string): string {
  return html.replace(/<table[\s\S]*?<\/table>/gi, (table) => {
    const rows = [...table.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((match) => {
      const cells = [...match[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) =>
        stripTags(cell[1]).replace(/\s+/g, " ").trim(),
      );
      return cells;
    });
    if (!rows.length) return "";
    const width = Math.max(...rows.map((row) => row.length));
    const padded = rows.map((row) => {
      const next = [...row];
      while (next.length < width) next.push("");
      return next;
    });
    const header = padded[0];
    const body = padded.slice(1);
    const md = [
      `| ${header.join(" | ")} |`,
      `| ${header.map(() => "---").join(" | ")} |`,
      ...body.map((row) => `| ${row.join(" | ")} |`),
    ];
    return `\n\n${md.join("\n")}\n\n`;
  });
}

function stripTags(html: string): string {
  return decodeBasicEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  );
}

async function htmlToMarkdown(
  html: string,
  images: ConvertedImage[],
  settings: ConvertSettings,
): Promise<string> {
  const { default: TurndownService } = await import("turndown");
  const turndown = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
  });
  turndown.addRule("images", {
    filter: "img",
    replacement: (_content, node) => {
      const el = node as HTMLImageElement;
      const src = el.getAttribute("src") ?? "";
      const alt = el.getAttribute("alt") ?? "Image";
      const image = images.find((item) => src.includes(item.fileName) || src === item.relPath);
      if (image) return `\n${renderImageTag(image, alt, settings)}\n`;
      if (!src) return "";
      if (settings.imageMarkup === "html") {
        return `\n<img src="${src}" alt="${alt}" width="${settings.imageWidthPx}" />\n`;
      }
      return `\n![${alt}](${src})\n`;
    },
  });
  const withTables = htmlTablesToMarkdown(html);
  return turndown.turndown(withTables).trim() + "\n";
}

export async function convertDocx(
  file: File,
  settings: ConvertSettings,
): Promise<ConvertResult> {
  const mammoth = await import("mammoth");
  const api = mammoth as unknown as {
    convertToHtml: typeof import("mammoth")["convertToHtml"];
    images: typeof import("mammoth")["images"];
  };
  const baseName = slugFileBase(file.name);
  const images: ConvertedImage[] = [];
  let imageIndex = 0;
  const result = await api.convertToHtml(
    { arrayBuffer: await file.arrayBuffer() },
    {
      convertImage: api.images.imgElement(async (element) => {
        const buffer = (await element.readAsArrayBuffer()) as ArrayBuffer;
        const bytes = new Uint8Array(buffer);
        const ext = (element.contentType.split("/")[1] ?? "png").replace("+xml", "");
        const fileName = `slide_1_img_${imageIndex}.${ext}`;
        imageIndex += 1;
        const image: ConvertedImage = {
          relPath: `images/${baseName}/${fileName}`,
          fileName,
          bytes,
          mime: element.contentType || mimeFromExt(ext),
        };
        images.push(image);
        return { src: image.relPath };
      }),
    },
  );
  const warnings = result.messages
    .map((message) => message.message)
    .filter(Boolean);
  const markdown = await htmlToMarkdown(result.value, images, settings);
  if (settings.headingAsSlide) {
    const split = splitHeadingsToSlides(markdown, images, settings);
    return {
      id: makeId(),
      fileName: file.name,
      baseName,
      format: "docx",
      mode: "slides",
      markdown: split.markdown,
      images,
      slides: split.slides,
      warnings,
    };
  }
  return documentResult(file, "docx", markdown, images, warnings);
}

export async function convertHtml(
  file: File,
  settings: ConvertSettings,
): Promise<ConvertResult> {
  const html = await file.text();
  const markdown = await htmlToMarkdown(html, [], settings);
  if (settings.headingAsSlide) {
    const split = splitHeadingsToSlides(markdown, [], settings);
    return {
      id: makeId(),
      fileName: file.name,
      baseName: slugFileBase(file.name),
      format: "html",
      mode: "slides",
      markdown: split.markdown,
      images: [],
      slides: split.slides,
      warnings: [],
    };
  }
  return documentResult(file, "html", markdown, [], []);
}

export async function convertMarkdownFile(file: File): Promise<ConvertResult> {
  const markdown = await file.text();
  return documentResult(file, "md", markdown.endsWith("\n") ? markdown : `${markdown}\n`, [], []);
}

export async function convertTxt(file: File): Promise<ConvertResult> {
  const text = (await file.text()).replace(/\r\n/g, "\n").trim();
  const paragraphs = text.split(/\n{2,}/).map((block) => block.replace(/\n/g, " ").trim());
  const markdown = paragraphs.map((p) => p).join("\n\n") + "\n";
  return documentResult(file, "txt", markdown, [], []);
}

export async function convertRtf(file: File): Promise<ConvertResult> {
  const raw = await file.text();
  const text = stripRtf(raw);
  const markdown = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .join("\n\n") + "\n";
  return documentResult(file, "rtf", markdown, [], []);
}

function stripRtf(input: string): string {
  let text = input.replace(/\\'[0-9a-fA-F]{2}/g, (match) => {
    return String.fromCharCode(parseInt(match.slice(2), 16));
  });
  text = text.replace(/\\par[d]?/g, "\n");
  text = text.replace(/\\tab/g, "\t");
  text = text.replace(/\\[a-zA-Z]+-?\d* ?/g, "");
  text = text.replace(/[{}]/g, "");
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

function documentResult(
  file: File,
  format: ConvertResult["format"],
  markdown: string,
  images: ConvertedImage[],
  warnings: string[],
): ConvertResult {
  const bullets = markdown
    .split("\n")
    .map((line) => line.replace(/^#+\s+/, "").replace(/^[-*]\s+/, "").trim())
    .filter(Boolean)
    .slice(0, 24);
  return {
    id: makeId(),
    fileName: file.name,
    baseName: slugFileBase(file.name),
    format,
    mode: "document",
    markdown,
    images,
    slides: [
      {
        number: 1,
        title: slugFileBase(file.name),
        bullets,
        notes: "",
        images,
      },
    ],
    warnings,
  };
}
