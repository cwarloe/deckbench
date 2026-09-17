# Deckbench

A training-content conversion workbench. Drop the files you actually use — decks, handouts, PDFs, Word docs, spreadsheets, HTML exports, images — and get **one Git-friendly Markdown profile** back.

It is not a universal file converter. It does not turn Keynote, Google Slides, old binary Office, video, or audio into Markdown. It *does* put the formats that show up in a training repo behind one drop zone, instead of a pile of one-off websites.

Companion to [pptx-slides-to-markdown](https://github.com/cwarloe/pptx-slides-to-markdown): same **Training Git v3** Markdown, plus the other formats that used to live in other tools.

Everything runs in the browser. Files never leave your machine.

## What you get

For slide-like sources (PowerPoint, ODP, PDF, and Word/HTML when heading-split is on):

```markdown
# Slide 1 - Title here

- First bullet
- Second bullet

**Notes:**
Speaker notes, if the file had them.

<img src="images/deck-name/slide_1_img_0.png" alt="Slide 1 Image 0" width="500" />
```

For document-like sources (CSV, Excel, plain Markdown, TXT, RTF, and Word/HTML with heading-split off): you get a single Markdown file — tables stay tables, headings stay headings.

Download options:

| Action | Result |
|---|---|
| Copy Markdown | Clipboard, UTF-8 |
| Download `.md` | Just the notes |
| Download ZIP | `{name}.md` plus `images/{name}/…` so relative image paths resolve on GitHub |
| ZIP all | Every finished job in one archive |

Image paths are URL-encoded. Width is configurable (default 500px). You can switch HTML `<img>` tags to Markdown `![]()` if you want.

## What it converts

| You drop | Extensions | What Deckbench extracts | Output mode |
|---|---|---|---|
| PowerPoint | `.pptx` `.pptm` `.ppsx` `.potx` | Slide titles, body text, tables-as-bullets, speaker notes, embedded pictures | Slides |
| LibreOffice Impress | `.odp` | Slide frames, text boxes, images | Slides |
| PDF | `.pdf` | Text per page; optional PNG render of each page | Slides |
| Word | `.docx` `.docm` | Body text, headings, embedded images | Slides if “Headings as slides” is on, else one document |
| HTML | `.html` `.htm` | Clean Markdown (lists, code, tables); optional split on H1/H2 | Same as Word |
| Excel | `.xlsx` | Each sheet as a `# Sheet name` heading and a Markdown table | Document |
| CSV | `.csv` | One Markdown table | Document |
| Images | `.png` `.jpg` `.jpeg` `.gif` `.webp` `.bmp` `.svg` | One slide per image, packed into `images/` | Slides |
| Markdown | `.md` `.markdown` | Normalized and packed as-is | Document |
| Plain text | `.txt` | Paragraphs as Markdown | Document |
| RTF | `.rtf` | Control words stripped to paragraphs | Document |

### PowerPoint details

Port of the Training Git v3 extractor:

- Title from the title placeholder (or the first text shape)
- Other shapes become bullets
- Tables flatten to `cell | cell` bullets
- Notes slides become a `**Notes:**` block
- Pictures land in `images/{deck}/slide_N_img_M.ext`

Charts, SmartArt, animations, slide masters, and speaker video are not reconstructed. If the chart was saved as a picture, the picture comes through.

### PDF details

Each page is a slide. Visible text is pulled in reading order. With **Render PDF pages** on (default), a PNG of the page is embedded next to the text so layout-heavy slides still have a picture in Git.

### Word and HTML details

Converted to Markdown (Word via Mammoth, HTML via Turndown). Tables become pipe tables. With **Headings as slides** on (default), each H1/H2 starts a new `# Slide N - …` section so a lesson plan or export can live next to decks.

### Spreadsheet details

CSV is one table. Excel walks every sheet and emits:

```markdown
# Roster

| Name | Role |
| --- | --- |
| Ada | Facilitator |
```

Formulas become cached values when Excel stored them. Charts, macros, and pivot caches are ignored.

## Workbench

One place to do the whole job:

- **Click the dashed panel** to open a real file picker (multiple files)
- **Drop** files onto the page
- **Paste** a copied file
- Queue with status (queued / converting / done / error)
- Switch jobs without losing the rest
- **Markdown** tab for the raw Git file
- **Preview** tab for slides (images + notes) or document tables
- Sample PPTX, HTML, and CSV if you just want to see the profile
- Settings persist in the browser (`deckbench-settings`)

### Settings (Training Git v3 profile)

| Setting | Default | Effect |
|---|---|---|
| Image width | 500px | `width` on HTML images |
| Speaker notes | on | Include `**Notes:**` from PPTX |
| HTML image tags | on | `<img>` vs Markdown images |
| Render PDF pages | on | PNG of each PDF page |
| Headings as slides | on | Split Word/HTML on H1/H2 |

## What it will not convert

Save or export these first:

| Not supported | Do this instead |
|---|---|
| Old binary `.ppt` `.doc` `.xls` | Save As `.pptx` / `.docx` / `.xlsx` |
| Google Slides / Docs / Sheets | File → Download as PPTX / DOCX / XLSX or PDF |
| Keynote `.key` | Export PowerPoint or PDF |
| OpenDocument Word/Calc (`.odt` `.ods`) | Not yet — PDF or DOCX/XLSX |
| Video, audio, SCORM, Captivate, Storyline | Out of scope |

If you drop an unknown type, Deckbench tells you it has no converter for that extension instead of guessing.

## Privacy

Conversion is client-side. Nothing is uploaded to a server. Refreshing the tab clears the queue; settings stay in localStorage.

## Run locally

```bash
git clone https://github.com/cwarloe/deckbench.git
cd deckbench
npm install
npm run dev
```

Open the printed local URL, then click the dashed panel or drop files onto the page.

```bash
npm run typecheck
npm run build
```

## Output layout in Git

Unzip next to your curriculum, or copy the `.md` and `images/` folder:

```
lesson-01.md
images/lesson-01/slide_1_img_0.png
images/lesson-01/slide_2_img_0.jpeg
```

Relative `src` paths then render on GitHub, GitLab, and most Markdown previews.
