import JSZip from "jszip";
import { slugFileBase } from "@/lib/utils";
import { makeId } from "./markdown";
import type { ConvertResult, ConvertSettings } from "./types";
import { attr, children, collectText, descendants, parseXml } from "./xml";

export async function convertCsv(file: File): Promise<ConvertResult> {
  const text = await file.text();
  const rows = parseCsv(text);
  const markdown = tableMarkdown(rows);
  return wrap(file, "csv", markdown);
}

export async function convertXlsx(
  file: File,
  _settings: ConvertSettings,
): Promise<ConvertResult> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const sharedXml = await zip.file("xl/sharedStrings.xml")?.async("string");
  const strings = sharedXml ? parseSharedStrings(sharedXml) : [];
  const workbookXml = await zip.file("xl/workbook.xml")?.async("string");
  const relsXml = await zip.file("xl/_rels/workbook.xml.rels")?.async("string");
  if (!workbookXml || !relsXml) throw new Error("This workbook is missing sheet data.");

  const workbook = parseXml(workbookXml);
  const relsDoc = parseXml(relsXml);
  const rels = children(children(relsDoc, "Relationships")[0] ?? relsDoc, "Relationship");
  const sheets = descendants(workbook, "sheet");
  const parts: string[] = [];

  for (const sheet of sheets) {
    const name = attr(sheet, "name") ?? "Sheet";
    const rId =
      attr(sheet, "id") && Object.keys(sheet).some((key) => key.includes(":id") && key !== "@_id")
        ? String(
            sheet["@_r:id"] ??
              Object.entries(sheet).find(([key]) => key.startsWith("@_r") && key.endsWith("id"))?.[1] ??
              "",
          )
        : attr(sheet, "id");
    const rel = rels.find((node) => attr(node, "Id") === rId);
    const target = attr(rel, "Target");
    if (!target) continue;
    const path = target.startsWith("/") ? target.replace(/^\/+/, "") : `xl/${target.replace(/^\.\//, "")}`;
    const sheetXml = await zip.file(path)?.async("string");
    if (!sheetXml) continue;
    const rows = parseSheet(sheetXml, strings);
    parts.push(`# ${name}\n\n${tableMarkdown(rows)}\n`);
  }

  if (!parts.length) throw new Error("No readable sheets found.");
  return wrap(file, "xlsx", parts.join("\n"));
}

function parseSharedStrings(xml: string): string[] {
  const doc = parseXml(xml);
  return descendants(doc, "si").map((si) => collectText(si).trim());
}

function parseSheet(xml: string, strings: string[]): string[][] {
  const doc = parseXml(xml);
  const rows = descendants(doc, "sheetData")[0]
    ? children(descendants(doc, "sheetData")[0], "row")
    : descendants(doc, "row");
  const grid: string[][] = [];
  for (const row of rows) {
    const cells = children(row, "c");
    const out: string[] = [];
    let maxCol = 0;
    const values = new Map<number, string>();
    for (const cell of cells) {
      const ref = attr(cell, "r") ?? "";
      const col = colIndex(ref);
      maxCol = Math.max(maxCol, col);
      const type = attr(cell, "t");
      const raw = collectText(children(cell, "v")[0] ?? children(cell, "is")[0] ?? "");
      let value = raw;
      if (type === "s") {
        const index = Number(raw);
        value = Number.isFinite(index) ? (strings[index] ?? raw) : raw;
      } else if (type === "inlineStr") {
        value = collectText(cell);
      }
      values.set(col, value);
    }
    for (let i = 0; i <= maxCol; i += 1) out.push(values.get(i) ?? "");
    if (out.some((cell) => cell.trim())) grid.push(out);
  }
  return grid;
}

function colIndex(ref: string): number {
  const letters = /^[A-Z]+/i.exec(ref)?.[0] ?? "A";
  let n = 0;
  for (const ch of letters.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return Math.max(0, n - 1);
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(cell.trim());
      cell = "";
    } else if (ch === "\n") {
      row.push(cell.trim());
      if (row.some((value) => value)) rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") {
      cell += ch;
    }
  }
  row.push(cell.trim());
  if (row.some((value) => value)) rows.push(row);
  return rows;
}

function tableMarkdown(rows: string[][]): string {
  if (!rows.length) return "_Empty table._\n";
  const width = Math.max(...rows.map((row) => row.length));
  const padded = rows.map((row) => {
    const next = row.map((cell) => cell.replace(/\s+/g, " ").trim());
    while (next.length < width) next.push("");
    return next;
  });
  const header = padded[0].map((cell) => cell || " ");
  const body = padded.slice(1);
  const lines = [
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...body.map((row) => `| ${row.map((cell) => cell || " ").join(" | ")} |`),
  ];
  return `${lines.join("\n")}\n`;
}

function wrap(
  file: File,
  format: ConvertResult["format"],
  markdown: string,
): ConvertResult {
  return {
    id: makeId(),
    fileName: file.name,
    baseName: slugFileBase(file.name),
    format,
    mode: "document",
    markdown,
    images: [],
    slides: [
      {
        number: 1,
        title: slugFileBase(file.name),
        bullets: markdown.split("\n").filter(Boolean).slice(0, 12),
        notes: "",
        images: [],
      },
    ],
    warnings: [],
  };
}
