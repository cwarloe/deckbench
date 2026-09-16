import { XMLParser } from "fast-xml-parser";

export type XmlNode = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  trimValues: false,
  parseTagValue: false,
  parseAttributeValue: false,
});

export function parseXml(xml: string): XmlNode {
  return parser.parse(xml) as XmlNode;
}

export function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

export function localName(key: string): string {
  const i = key.lastIndexOf(":");
  return i >= 0 ? key.slice(i + 1) : key;
}

export function attr(node: unknown, name: string): string | undefined {
  if (!node || typeof node !== "object") return undefined;
  const obj = node as XmlNode;
  const direct = obj[`@_${name}`];
  if (direct != null) return String(direct);
  for (const [key, value] of Object.entries(obj)) {
    if (!key.startsWith("@_")) continue;
    const raw = key.slice(2);
    if (raw === name || localName(raw) === name) return String(value);
  }
  return undefined;
}

export function children(node: unknown, name: string): XmlNode[] {
  if (!node || typeof node !== "object") return [];
  const out: XmlNode[] = [];
  for (const [key, value] of Object.entries(node as XmlNode)) {
    if (key.startsWith("@_") || key === "#text") continue;
    if (localName(key) !== name) continue;
    for (const child of asArray(value)) {
      if (child && typeof child === "object") out.push(child as XmlNode);
    }
  }
  return out;
}

export function descendants(node: unknown, name: string): XmlNode[] {
  const out: XmlNode[] = [];
  walk(node, (key, child) => {
    if (localName(key) === name && child && typeof child === "object") {
      out.push(child as XmlNode);
    }
  });
  return out;
}

function walk(
  node: unknown,
  visit: (key: string, child: unknown) => void,
): void {
  if (!node || typeof node !== "object") return;
  for (const [key, value] of Object.entries(node as XmlNode)) {
    if (key.startsWith("@_") || key === "#text") continue;
    for (const child of asArray(value)) {
      visit(key, child);
      walk(child, visit);
    }
  }
}

export function textOf(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (typeof node !== "object") return "";
  const obj = node as XmlNode;
  if (typeof obj["#text"] === "string" || typeof obj["#text"] === "number") {
    return String(obj["#text"]);
  }
  let out = "";
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith("@_")) continue;
    for (const child of asArray(value)) out += textOf(child);
  }
  return out;
}

export function collectText(node: unknown): string {
  const parts: string[] = [];
  function visit(n: unknown) {
    if (n == null) return;
    if (typeof n === "string" || typeof n === "number") {
      parts.push(String(n));
      return;
    }
    if (typeof n !== "object") return;
    const obj = n as XmlNode;
    if (obj["#text"] != null) parts.push(String(obj["#text"]));
    for (const [key, value] of Object.entries(obj)) {
      if (key.startsWith("@_") || key === "#text") continue;
      for (const child of asArray(value)) visit(child);
    }
  }
  visit(node);
  return parts.join("");
}

export function paragraphTexts(txBody: unknown): string[] {
  const paragraphs = descendants(txBody, "p");
  const lines: string[] = [];
  for (const p of paragraphs) {
    const runs: string[] = [];
    walk(p, (key, child) => {
      if (localName(key) === "t") runs.push(textOf(child));
    });
    const line = runs.join("").replace(/\s+\n/g, "\n").trim();
    if (line) lines.push(line);
  }
  return lines;
}

export function joinZipPath(...parts: string[]): string {
  const stack: string[] = [];
  for (const part of parts.join("/").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      stack.pop();
      continue;
    }
    stack.push(part);
  }
  return stack.join("/");
}

export function dirname(path: string): string {
  const i = path.lastIndexOf("/");
  return i >= 0 ? path.slice(0, i) : "";
}

export function extOf(path: string): string {
  const base = path.split("/").pop() ?? path;
  const i = base.lastIndexOf(".");
  return i >= 0 ? base.slice(i + 1).toLowerCase() : "";
}

export function encodeRelPath(parts: string[]): string {
  return parts.map((part) => encodeURIComponent(part)).join("/");
}
