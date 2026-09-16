import JSZip from "jszip";
import { mimeFromExt, slugFileBase } from "@/lib/utils";
import { makeId, renderSlideMarkdown } from "./markdown";
import type { ConvertResult, ConvertSettings, ConvertedImage, SlideDraft } from "./types";
import {
  attr,
  children,
  descendants,
  dirname,
  extOf,
  joinZipPath,
  paragraphTexts,
  parseXml,
  type XmlNode,
} from "./xml";

type Rel = { id: string; type: string; target: string };

async function readZipText(zip: JSZip, path: string): Promise<string | null> {
  const file = zip.file(path) ?? zip.file(decodeURIComponent(path));
  if (!file) return null;
  return file.async("string");
}

async function readZipBytes(zip: JSZip, path: string): Promise<Uint8Array | null> {
  const file = zip.file(path) ?? zip.file(decodeURIComponent(path));
  if (!file) return null;
  return file.async("uint8array");
}

function parseRels(xml: string, relsPath: string): Rel[] {
  const doc = parseXml(xml);
  const root = children(doc, "Relationships")[0] ?? doc;
  // Relationships are relative to the source part, not the _rels folder.
  const sourcePart = relsPath.replace(/\/_rels\//, "/").replace(/\.rels$/, "");
  const dir = dirname(sourcePart);
  return children(root, "Relationship").map((node) => {
    const target = attr(node, "Target") ?? "";
    const absolute = target.startsWith("/")
      ? target.replace(/^\/+/, "")
      : joinZipPath(dir, target);
    return {
      id: attr(node, "Id") ?? "",
      type: attr(node, "Type") ?? "",
      target: absolute,
    };
  });
}

function relId(node: XmlNode): string | undefined {
  const namespaced = Object.entries(node).find(
    ([key]) =>
      key.startsWith("@_") &&
      /:id$/i.test(key.slice(2)) &&
      key !== "@_id",
  );
  if (namespaced?.[1] != null) return String(namespaced[1]);
  return attr(node, "r:id") ?? attr(node, "rid");
}

function isTitleShape(shape: XmlNode): boolean {
  const name = (attr(descendants(shape, "cNvPr")[0], "name") ?? "").toLowerCase();
  if (name.startsWith("title")) return true;
  const ph = descendants(shape, "ph")[0];
  const type = (attr(ph, "type") ?? "").toLowerCase();
  return type === "title" || type === "ctrtitle";
}

function shapeParagraphs(shape: XmlNode): string[] {
  const bodies = descendants(shape, "txBody");
  const lines: string[] = [];
  for (const body of bodies) lines.push(...paragraphTexts(body));
  return uniqueLines(lines);
}

function uniqueLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const key = line.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

function collectBlipEmbeds(node: XmlNode): string[] {
  const ids: string[] = [];
  for (const blip of descendants(node, "blip")) {
    const embed = attr(blip, "embed") ?? attr(blip, "link");
    if (embed) ids.push(embed);
  }
  return ids;
}

function topLevelShapes(slideDoc: XmlNode): XmlNode[] {
  const spTree = descendants(slideDoc, "spTree")[0] ?? slideDoc;
  return [
    ...children(spTree, "sp"),
    ...children(spTree, "pic"),
    ...children(spTree, "grpSp"),
    ...children(spTree, "graphicFrame"),
    ...children(spTree, "cxnSp"),
  ];
}

function flattenShapes(nodes: XmlNode[]): XmlNode[] {
  const out: XmlNode[] = [];
  function visit(node: XmlNode) {
    out.push(node);
    for (const child of [
      ...children(node, "sp"),
      ...children(node, "pic"),
      ...children(node, "grpSp"),
      ...children(node, "graphicFrame"),
    ]) {
      visit(child);
    }
  }
  for (const node of nodes) visit(node);
  return out;
}

function tableAsBullets(frame: XmlNode): string[] {
  const rows = descendants(frame, "tr");
  if (!rows.length) return [];
  const bullets: string[] = [];
  for (const row of rows) {
    const cells = descendants(row, "tc").map((cell) =>
      paragraphTexts(cell).join(" ").trim(),
    );
    const line = cells.filter(Boolean).join(" | ");
    if (line) bullets.push(line);
  }
  return bullets;
}

async function notesForSlide(zip: JSZip, rels: Rel[]): Promise<string> {
  const notesRel = rels.find((rel) => rel.type.toLowerCase().includes("notesslide"));
  if (!notesRel) return "";
  const xml = await readZipText(zip, notesRel.target);
  if (!xml) return "";
  const doc = parseXml(xml);
  const chunks: string[] = [];
  for (const shape of descendants(doc, "sp")) {
    const ph = descendants(shape, "ph")[0];
    const type = (attr(ph, "type") ?? "").toLowerCase();
    if (type === "sldimg" || type === "sldnum") continue;
    chunks.push(...shapeParagraphs(shape));
  }
  return uniqueLines(chunks).join("\n").trim();
}

export async function convertPptx(
  file: File,
  settings: ConvertSettings,
): Promise<ConvertResult> {
  const warnings: string[] = [];
  const baseName = slugFileBase(file.name);
  const zip = await JSZip.loadAsync(await file.arrayBuffer());

  const presentationXml = await readZipText(zip, "ppt/presentation.xml");
  if (!presentationXml) {
    throw new Error("This PPTX is missing ppt/presentation.xml.");
  }
  const presRelsXml = await readZipText(zip, "ppt/_rels/presentation.xml.rels");
  const presRels = presRelsXml
    ? parseRels(presRelsXml, "ppt/_rels/presentation.xml.rels")
    : [];

  const presentation = parseXml(presentationXml);
  const sldIdLst = descendants(presentation, "sldIdLst")[0];
  const slideIds = sldIdLst
    ? children(sldIdLst, "sldId")
    : descendants(presentation, "sldId");

  const slidePaths: string[] = [];
  for (const sldId of slideIds) {
    const id = relId(sldId);
    const matched = presRels.find(
      (item) =>
        item.id === id &&
        item.type.toLowerCase().includes("slide") &&
        !item.type.toLowerCase().includes("notes"),
    );
    if (matched) slidePaths.push(matched.target);
  }

  if (!slidePaths.length) {
    const guessed = Object.keys(zip.files)
      .filter((path) => /^ppt\/slides\/slide\d+\.xml$/i.test(path))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    slidePaths.push(...guessed);
  }

  if (!slidePaths.length) {
    throw new Error("No slides found in this deck.");
  }

  const slides: SlideDraft[] = [];

  for (let index = 0; index < slidePaths.length; index += 1) {
    const slidePath = slidePaths[index];
    const xml = await readZipText(zip, slidePath);
    if (!xml) {
      warnings.push(`Could not read ${slidePath}.`);
      continue;
    }
    const slideDoc = parseXml(xml);
    const relsPath = `${dirname(slidePath)}/_rels/${slidePath.split("/").pop()}.rels`;
    const relsXml = await readZipText(zip, relsPath);
    const rels = relsXml ? parseRels(relsXml, relsPath) : [];

    const shapes = flattenShapes(topLevelShapes(slideDoc));
    let title = "";
    let titleShape: XmlNode | null = null;
    for (const shape of shapes) {
      if (!isTitleShape(shape)) continue;
      const lines = shapeParagraphs(shape);
      if (lines[0]) {
        title = lines[0];
        titleShape = shape;
        break;
      }
    }

    const bullets: string[] = [];
    for (const shape of shapes) {
      if (shape === titleShape) continue;
      const tableLines = tableAsBullets(shape);
      if (tableLines.length) {
        bullets.push(...tableLines);
        continue;
      }
      const lines = shapeParagraphs(shape).filter((line) => line !== title);
      bullets.push(...lines);
    }

    const images: ConvertedImage[] = [];
    const seenEmbeds = new Set<string>();
    let imageIndex = 0;
    for (const shape of shapes) {
      for (const embed of collectBlipEmbeds(shape)) {
        if (seenEmbeds.has(embed)) continue;
        seenEmbeds.add(embed);
        const rel = rels.find((item) => item.id === embed);
        if (!rel) {
          warnings.push(`Missing image relationship ${embed} on slide ${index + 1}.`);
          continue;
        }
        const bytes = await readZipBytes(zip, rel.target);
        if (!bytes) {
          warnings.push(`Could not extract ${rel.target} from slide ${index + 1}.`);
          continue;
        }
        const ext = extOf(rel.target) || "png";
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

    const notes = settings.includeNotes ? await notesForSlide(zip, rels) : "";

    slides.push({
      number: index + 1,
      title,
      bullets: uniqueLines(bullets),
      notes,
      images,
    });
  }

  if (!slides.length) {
    throw new Error("No readable slides found in this deck.");
  }

  return {
    id: makeId(),
    fileName: file.name,
    baseName,
    format: "pptx",
    mode: "slides",
    markdown: renderSlideMarkdown(slides, settings),
    images: slides.flatMap((slide) => slide.images),
    slides,
    warnings,
  };
}
