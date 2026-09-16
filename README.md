# Deckbench

Browser workbench that turns training decks and documents into Git-friendly Markdown.

Same **Training Git v3** profile as a typical PPTX→Markdown converter:

- `# Slide N - Title`
- body as bullets
- `**Notes:**` for speaker notes
- HTML `<img width="500">` with URL-encoded relative paths
- ZIP as `deck.md` plus `images/deck-name/`

Everything runs in the browser. Files never leave your machine.

## Formats

| Input | What you get |
|---|---|
| PPTX (also PPTM / PPSX / POTX) | Slides, notes, embedded images |
| PDF | Each page as a slide, optional page render |
| Word (.docx) | Headings become slides |
| HTML | Clean Markdown, optional heading split |
| Excel / CSV | Markdown tables |
| ODP | LibreOffice decks |
| Images, Markdown, TXT, RTF | Packed into the same layout |

Old binary `.ppt` / `.doc` / `.xls` are not supported — save as PPTX / DOCX / XLSX first.

## Run locally

```bash
npm install
npm run dev
```

Open the printed local URL, then drop files or use **Click or drop files here**.

```bash
npm run typecheck
npm run build
```

## Output

Copy Markdown, download a `.md` file, or download a ZIP with images next to the notes so the relative `src` paths resolve in GitHub, GitLab, or any Markdown viewer.
