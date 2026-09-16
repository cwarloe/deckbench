import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Copy,
  Download,
  FileArchive,
  FileText,
  LoaderCircle,
  Trash2,
  Upload,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  FORMAT_ACCEPT,
  FORMAT_GUIDE,
  buildSampleCsv,
  buildSampleHtml,
  buildSamplePptx,
  convertFile,
  detectFormat,
  formatLabel,
  markdownBlob,
  packResults,
  type ConvertJob,
  type ConvertResult,
} from "@/lib/convert";
import { useSettings } from "@/lib/settings";
import { cn, downloadBlob } from "@/lib/utils";
import { makeId } from "@/lib/convert/markdown";

type Pane = "markdown" | "preview";

export function ConverterApp() {
  const { settings } = useSettings();
  const [jobs, setJobs] = useState<ConvertJob[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pane, setPane] = useState<Pane>("preview");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  const doneJobs = jobs.filter((job) => job.result);
  const active = jobs.find((job) => job.id === activeId) ?? doneJobs[0];
  const result = active?.result;

  const enqueue = useCallback(
    (files: File[]) => {
      if (!files.length) return;
      const incoming: ConvertJob[] = files.map((file) => ({
        id: makeId(),
        fileName: file.name,
        size: file.size,
        status: "queued",
      }));
      setJobs((prev) => [...incoming, ...prev]);
      setActiveId(incoming[0]?.id ?? null);

      queueRef.current = queueRef.current.then(async () => {
        for (let i = 0; i < files.length; i += 1) {
          const file = files[i];
          const job = incoming[i];
          setJobs((prev) =>
            prev.map((item) =>
              item.id === job.id ? { ...item, status: "working" } : item,
            ),
          );
          try {
            const detected = detectFormat(file);
            if (detected.kind === "unsupported") {
              throw new Error(detected.reason);
            }
            const converted = await convertFile(file, settings);
            setJobs((prev) =>
              prev.map((item) =>
                item.id === job.id
                  ? { ...item, status: "done", result: converted }
                  : item,
              ),
            );
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Conversion failed.";
            setJobs((prev) =>
              prev.map((item) =>
                item.id === job.id
                  ? { ...item, status: "error", error: message }
                  : item,
              ),
            );
            toast.error(file.name, { description: message });
          }
        }
      });
    },
    [settings],
  );

  const onFiles = useCallback(
    (list: FileList | File[] | null) => {
      if (!list) return;
      enqueue(Array.from(list));
    },
    [enqueue],
  );

  useEffect(() => {
    const hasFiles = (transfer: DataTransfer | null) => {
      if (!transfer) return false;
      const types = Array.from(transfer.types ?? []);
      return types.includes("Files") || (transfer.files && transfer.files.length > 0);
    };
    const onDrag = (event: DragEvent) => {
      if (!hasFiles(event.dataTransfer)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
      setDragOver(true);
    };
    const onLeave = (event: DragEvent) => {
      if (event.relatedTarget) return;
      setDragOver(false);
    };
    const onDrop = (event: DragEvent) => {
      event.preventDefault();
      setDragOver(false);
      if (event.dataTransfer?.files?.length) onFiles(event.dataTransfer.files);
    };
    const onPaste = (event: ClipboardEvent) => {
      const files = event.clipboardData?.files;
      if (!files?.length) return;
      event.preventDefault();
      onFiles(files);
    };
    window.addEventListener("dragover", onDrag);
    window.addEventListener("dragenter", onDrag);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("dragover", onDrag);
      window.removeEventListener("dragenter", onDrag);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("paste", onPaste);
    };
  }, [onFiles]);

  async function loadSample(kind: "pptx" | "html" | "csv") {
    setBusy(true);
    try {
      if (kind === "pptx") enqueue([await buildSamplePptx()]);
      if (kind === "html") enqueue([buildSampleHtml()]);
      if (kind === "csv") enqueue([buildSampleCsv()]);
    } finally {
      setBusy(false);
    }
  }

  async function copyMarkdown() {
    if (!result) return;
    await navigator.clipboard.writeText(result.markdown);
    setCopied(true);
    toast.success("Markdown copied");
    window.setTimeout(() => setCopied(false), 1400);
  }

  function downloadMd() {
    if (!result) return;
    downloadBlob(markdownBlob(result), `${result.baseName}.md`);
  }

  async function downloadZip(all: boolean) {
    const results = (all ? doneJobs : active ? [active] : [])
      .map((job) => job.result)
      .filter((item): item is ConvertResult => Boolean(item));
    if (!results.length) return;
    const blob = await packResults(results);
    const name =
      results.length === 1
        ? `${results[0].baseName}.zip`
        : `deckbench-${results.length}-files.zip`;
    downloadBlob(blob, name);
  }

  function removeJob(id: string) {
    setJobs((prev) => prev.filter((job) => job.id !== id));
    setActiveId((current) => (current === id ? null : current));
  }

  return (
    <div className="paper-grid min-h-dvh">
      <Toaster
        position="bottom-center"
        toastOptions={{
          className: "font-sans bg-card text-foreground border-border shadow-border",
        }}
      />
      {dragOver ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-foreground/40 p-6"
          onDragOver={(event) => {
            event.preventDefault();
            if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragOver(false);
            if (event.dataTransfer?.files?.length) onFiles(event.dataTransfer.files);
          }}
        >
          <div className="rounded-2xl bg-card px-10 py-12 text-center shadow-border">
            <Upload className="mx-auto size-8 text-accent" />
            <p className="mt-3 font-display text-2xl">Drop to convert</p>
            <p className="mt-1 text-sm text-muted-foreground">
              PPTX, PDF, Word, HTML, Excel, CSV, images
            </p>
          </div>
        </div>
      ) : null}

      <header className="border-b border-border/80 bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="stagger-in">
            <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
              Training content workbench
            </p>
            <h1 className="font-display mt-1 text-4xl font-medium tracking-tight text-ink sm:text-5xl">
              Deckbench
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Your custom slide-to-Markdown format, plus every other file that
              should live in Git — one drop zone, images packed beside the
              notes.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => loadSample("pptx")}
              disabled={busy}
            >
              Try sample deck
            </Button>
            <label
              className={cn(buttonVariants({ variant: "outline" }), "cursor-pointer")}
            >
              <FileInput onFiles={onFiles} />
              <Upload />
              Add files
            </label>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] lg:gap-6 lg:py-6">
        <aside className="flex flex-col gap-4">
          <DropCard
            onFiles={onFiles}
            onSample={(kind) => loadSample(kind)}
          />
          <SettingsCard />
          <JobList
            jobs={jobs}
            activeId={active?.id ?? null}
            onSelect={setActiveId}
            onRemove={removeJob}
            onClear={() => {
              setJobs([]);
              setActiveId(null);
            }}
          />
        </aside>

        <section className="min-w-0">
          {result ? (
            <ResultPane
              result={result}
              pane={pane}
              onPane={setPane}
              copied={copied}
              onCopy={copyMarkdown}
              onMd={downloadMd}
              onZip={() => downloadZip(false)}
              onZipAll={() => downloadZip(true)}
              zipAllCount={doneJobs.length}
              imageWidth={settings.imageWidthPx}
            />
          ) : (
            <EmptyBench
              onSample={(kind) => loadSample(kind)}
              onFiles={onFiles}
            />
          )}
        </section>
      </main>
    </div>
  );
}

function FileInput({ onFiles }: { onFiles: (files: FileList | File[] | null) => void }) {
  return (
    <input
      type="file"
      multiple
      accept={FORMAT_ACCEPT}
      className="sr-only"
      onChange={(event) => {
        onFiles(event.target.files);
        event.target.value = "";
      }}
    />
  );
}

function DropCard({
  onFiles,
  onSample,
}: {
  onFiles: (files: FileList | File[] | null) => void;
  onSample: (kind: "pptx" | "html" | "csv") => void;
}) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-border">
      <label className="relative flex w-full cursor-pointer flex-col items-center rounded-xl border border-dashed border-rule bg-muted/40 px-4 py-8 text-center transition-colors duration-150 hover:bg-muted">
        <input
          type="file"
          multiple
          accept={FORMAT_ACCEPT}
          className="absolute inset-0 z-10 cursor-pointer opacity-0"
          aria-label="Choose files to convert"
          onChange={(event) => {
            onFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <Upload className="size-6 text-accent" />
        <span className="mt-3 text-sm font-medium">Click or drop files here</span>
        <span className="mt-1 text-xs text-muted-foreground">
          PPTX, PDF, Word, and more. Nothing leaves this browser.
        </span>
      </label>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        You can also paste a copied file, or drop it onto this page.
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {FORMAT_GUIDE.slice(0, 8).map((item) => (
          <Badge key={item.label}>{item.label}</Badge>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => onSample("pptx")}>
          Sample PPTX
        </Button>
        <Button variant="outline" size="sm" onClick={() => onSample("html")}>
          Sample HTML
        </Button>
        <Button variant="outline" size="sm" onClick={() => onSample("csv")}>
          Sample CSV
        </Button>
      </div>
    </div>
  );
}

function SettingsCard() {
  const { settings, setSettings } = useSettings();
  return (
    <div className="rounded-2xl bg-card p-4 shadow-border">
      <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
        Output profile
      </p>
      <p className="mt-1 font-display text-lg">Training Git v3</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Matches your PPTX converter: slide headings, notes, HTML images,
        URL-encoded paths, UTF-8.
      </p>
      <label className="mt-4 flex items-center justify-between gap-3 text-sm">
        <span>Image width</span>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {settings.imageWidthPx}px
        </span>
      </label>
      <input
        type="range"
        min={240}
        max={960}
        step={20}
        value={settings.imageWidthPx}
        onChange={(event) =>
          setSettings({ imageWidthPx: Number(event.target.value) })
        }
        className="mt-2 w-full accent-accent"
        aria-label="Image width in pixels"
      />
      <Toggle
        label="Speaker notes"
        checked={settings.includeNotes}
        onChange={(includeNotes) => setSettings({ includeNotes })}
      />
      <Toggle
        label="HTML image tags"
        hint="Off uses Markdown images"
        checked={settings.imageMarkup === "html"}
        onChange={(on) => setSettings({ imageMarkup: on ? "html" : "markdown" })}
      />
      <Toggle
        label="Render PDF pages"
        hint="Keeps a picture of each page"
        checked={settings.pdfRenderPages}
        onChange={(pdfRenderPages) => setSettings({ pdfRenderPages })}
      />
      <Toggle
        label="Headings as slides"
        hint="Word and HTML split on H1/H2"
        checked={settings.headingAsSlide}
        onChange={(headingAsSlide) => setSettings({ headingAsSlide })}
      />
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="mt-3 flex min-h-11 w-full items-center justify-between gap-3 text-left"
    >
      <span>
        <span className="block text-sm">{label}</span>
        {hint ? (
          <span className="block text-xs text-muted-foreground">{hint}</span>
        ) : null}
      </span>
      <span
        className={cn(
          "relative h-6 w-10 shrink-0 rounded-full transition-colors duration-150",
          checked ? "bg-accent" : "bg-border",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-5 rounded-full bg-card transition-transform duration-150",
            checked ? "translate-x-4" : "translate-x-0",
          )}
        />
      </span>
    </button>
  );
}

function JobList({
  jobs,
  activeId,
  onSelect,
  onRemove,
  onClear,
}: {
  jobs: ConvertJob[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  if (!jobs.length) return null;
  return (
    <div className="rounded-2xl bg-card p-3 shadow-border">
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
          Queue
        </p>
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Clear
        </button>
      </div>
      <ul className="mt-2 flex flex-col gap-1">
        {jobs.map((job) => (
          <li key={job.id}>
            <div
              className={cn(
                "flex items-center gap-2 rounded-lg px-2 py-2",
                job.id === activeId ? "bg-muted" : "hover:bg-muted/60",
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(job.id)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block truncate text-sm">{job.fileName}</span>
                <span className="block text-xs text-muted-foreground">
                  {job.status === "done" && job.result
                    ? `${formatLabel(job.result.format)} · ${job.result.slides.length} ${job.result.mode === "slides" ? "slides" : "section"}`
                    : job.status === "working"
                      ? "Converting…"
                      : job.status === "error"
                        ? job.error
                        : "Queued"}
                </span>
              </button>
              {job.status === "working" ? (
                <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
              ) : null}
              <button
                type="button"
                aria-label={`Remove ${job.fileName}`}
                onClick={() => onRemove(job.id)}
                className="relative size-9 text-muted-foreground after:absolute after:top-1/2 after:left-1/2 after:size-10 after:-translate-x-1/2 after:-translate-y-1/2 hover:text-foreground"
              >
                <Trash2 className="mx-auto size-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EmptyBench({
  onSample,
  onFiles,
}: {
  onSample: (kind: "pptx" | "html" | "csv") => void;
  onFiles: (files: FileList | File[] | null) => void;
}) {
  return (
    <div className="rounded-2xl bg-card p-6 shadow-border sm:p-10">
      <p className="font-display text-3xl leading-tight sm:text-4xl">
        Tired decks, breathing in Markdown.
      </p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
        This is the same structure as your Python converter —{" "}
        <code className="font-mono text-xs"># Slide N - Title</code>, notes
        blocks, and{" "}
        <code className="font-mono text-xs">{`<img width="500">`}</code> — now
        for every format you actually receive from instructors.
      </p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {FORMAT_GUIDE.map((item) => (
          <div key={item.label} className="rounded-xl bg-muted/70 px-4 py-3">
            <p className="text-sm font-medium">{item.label}</p>
            <p className="text-xs text-muted-foreground">{item.hint}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap gap-2">
        <label className={cn(buttonVariants(), "cursor-pointer")}>
          <FileInput onFiles={onFiles} />
          <Upload />
          Convert files
        </label>
        <Button variant="secondary" onClick={() => onSample("pptx")}>
          Sample PPTX
        </Button>
        <Button variant="outline" onClick={() => onSample("html")}>
          Sample HTML
        </Button>
        <Button variant="outline" onClick={() => onSample("csv")}>
          Sample CSV
        </Button>
      </div>
    </div>
  );
}

function ResultPane({
  result,
  pane,
  onPane,
  copied,
  onCopy,
  onMd,
  onZip,
  onZipAll,
  zipAllCount,
  imageWidth,
}: {
  result: ConvertResult;
  pane: Pane;
  onPane: (pane: Pane) => void;
  copied: boolean;
  onCopy: () => void;
  onMd: () => void;
  onZip: () => void;
  onZipAll: () => void;
  zipAllCount: number;
  imageWidth: number;
}) {
  return (
    <div className="flex min-h-[70dvh] flex-col rounded-2xl bg-card shadow-border">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="truncate font-medium">{result.fileName}</p>
          <p className="text-xs text-muted-foreground">
            {formatLabel(result.format)} · {result.slides.length}{" "}
            {result.mode === "slides" ? "slides" : "section"} ·{" "}
            {result.images.length} images
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onCopy}>
            {copied ? <Check /> : <Copy />}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button variant="outline" size="sm" onClick={onMd}>
            <FileText />
            .md
          </Button>
          <Button variant="outline" size="sm" onClick={onZip}>
            <Download />
            ZIP
          </Button>
          {zipAllCount > 1 ? (
            <Button variant="secondary" size="sm" onClick={onZipAll}>
              <FileArchive />
              All ({zipAllCount})
            </Button>
          ) : null}
        </div>
      </div>
      <div className="flex gap-1 px-4 pt-3">
        {(
          [
            ["preview", "Preview"],
            ["markdown", "Markdown"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => onPane(id)}
            className={cn(
              "h-10 rounded-md px-3 text-sm",
              pane === id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {result.warnings.length ? (
        <p className="px-4 pt-3 text-xs text-destructive">
          {result.warnings.slice(0, 3).join(" · ")}
        </p>
      ) : null}
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {pane === "markdown" ? (
          <pre className="font-mono text-[13px] leading-relaxed whitespace-pre-wrap text-foreground">
            {result.markdown}
          </pre>
        ) : (
          <SlidePreview result={result} imageWidth={imageWidth} />
        )}
      </div>
    </div>
  );
}

function SlidePreview({
  result,
  imageWidth,
}: {
  result: ConvertResult;
  imageWidth: number;
}) {
  const urls = useMemo(() => {
    const map = new Map<string, string>();
    for (const image of result.images) {
      const url = URL.createObjectURL(
        new Blob([image.bytes.slice()], { type: image.mime }),
      );
      map.set(image.relPath, url);
    }
    return map;
  }, [result.images]);

  useEffect(() => {
    return () => {
      for (const url of urls.values()) URL.revokeObjectURL(url);
    };
  }, [urls]);

  if (result.mode === "document") {
    return (
      <article className="max-w-3xl">
        <DocumentPreview markdown={result.markdown} />
        <div className="mt-4 flex flex-col gap-3">
          {result.images.map((image) => (
            <img
              key={image.relPath}
              src={urls.get(image.relPath)}
              alt={image.fileName}
              width={imageWidth}
              className="h-auto max-w-full rounded-md"
            />
          ))}
        </div>
      </article>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {result.slides.map((slide) => (
        <article
          key={slide.number}
          className="border-b border-border pb-8 last:border-b-0 last:pb-0"
        >
          <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Slide {slide.number}
          </p>
          <h2 className="font-display mt-1 text-2xl font-medium tracking-tight">
            {slide.title || "Untitled"}
          </h2>
          {slide.bullets.length ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-relaxed">
              {slide.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          ) : null}
          {slide.notes ? (
            <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-sm">
              <span className="font-medium">Notes. </span>
              {slide.notes}
            </p>
          ) : null}
          <div className="mt-4 flex flex-col gap-3">
            {slide.images.map((image) => (
              <img
                key={image.relPath}
                src={urls.get(image.relPath)}
                alt={`Slide ${slide.number} image`}
                width={imageWidth}
                className="h-auto max-w-full rounded-md"
              />
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

function DocumentPreview({ markdown }: { markdown: string }) {
  const blocks = markdown
    .replace(/\r\n/g, "\n")
    .trim()
    .split(/\n{2,}/);
  return (
    <div className="space-y-4">
      {blocks.map((block, index) => {
        const lines = block.split("\n");
        if (lines.some((line) => line.trim().startsWith("|"))) {
          const rows = lines
            .filter((line) => line.includes("|"))
            .map((line) =>
              line
                .split("|")
                .slice(1, -1)
                .map((cell) => cell.trim()),
            );
          if (rows.length >= 2) {
            const header = rows[0];
            const body = rows
              .slice(1)
              .filter((row) => !row.every((cell) => /^:?-+:?$/.test(cell)));
            return (
              <div key={index} className="overflow-x-auto rounded-lg bg-muted/60 p-2">
                <table className="w-full min-w-80 text-sm">
                  <thead>
                    <tr>
                      {header.map((cell) => (
                        <th
                          key={cell}
                          className="border-b border-border px-3 py-2 text-left font-medium"
                        >
                          {cell}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {body.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                          <td
                            key={`${rowIndex}-${cellIndex}`}
                            className="border-b border-border px-3 py-2"
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
        }
        if (block.startsWith("# ")) {
          return (
            <h2
              key={index}
              className="font-display text-2xl font-medium tracking-tight"
            >
              {block.replace(/^#\s+/, "")}
            </h2>
          );
        }
        if (block.startsWith("## ")) {
          return (
            <h3 key={index} className="text-lg font-medium">
              {block.replace(/^##\s+/, "")}
            </h3>
          );
        }
        if (lines.every((line) => line.trim().startsWith("- "))) {
          return (
            <ul
              key={index}
              className="list-disc space-y-1 pl-5 text-sm leading-relaxed"
            >
              {lines.map((line) => (
                <li key={line}>{line.replace(/^- /, "")}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={index} className="text-sm leading-relaxed">
            {block}
          </p>
        );
      })}
    </div>
  );
}
