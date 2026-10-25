# Alexandros Haliassos

A small, static research website. The design and implementation are new; the earlier website's layout was not used.

The homepage introduces Alexandros's current research and five selected papers. The publications page contains 13 papers and one book chapter, topic filters, search, BibTeX citations and a bibliography download. An industry research CV is available as accessible HTML and a two-page PDF, with six selected first-author papers. Use the PDF for sharing and printing.

## Open locally

Open `dist/index.html` in a browser. Navigation, publication filtering and downloads work directly from the filesystem. Clipboard copying appears only where the browser supports it; BibTeX is always readable and selectable.

For an HTTP preview:

```sh
npm start
```

The server listens at `http://127.0.0.1:4173`. No installation is needed.

## Edit and build

Requires Node.js 20 or later. There are no npm dependencies, externally loaded fonts, trackers, accounts or runtime APIs.

```sh
npm run build
npm run check
```

| File | Purpose |
| --- | --- |
| `data/profile.json` | Profile, portrait, employment dates, MEng results, honours, reviewing service, contact links and canonical domain |
| `data/cv.json` | CV experience descriptions, education and selected publications; shared by HTML and PDF |
| `assets/alexandros-haliassos.jpg` | User-supplied portrait, framed with CSS on the homepage |
| `data/publications.json` | Publication metadata, summaries, topics, figure paths and verification sources |
| `assets/figures/` | Compact conceptual SVG illustrations for the two featured papers |
| `scripts/build.mjs` | HTML templates, biography, background and CV content |
| `assets/style.css` | Colours, typography, layouts, responsive and print rules |
| `assets/site.js` | Search, topic filters and citation copying |
| `cv/template.tex` | PDF typography and page layout |
| `scripts/cv-source.mjs` | Shared CV helpers, LaTeX generation and PDF freshness validation |
| `scripts/build-cv.mjs` | Typeset and validate the two-page PDF |
| `cv/alexandros-haliassos-cv.tex` | Generated standalone, editable LaTeX source |
| `assets/alexandros-haliassos-cv.pdf` | Typeset PDF copied into the published site |
| `cv/build.json` | Source/PDF hashes and verified page count |
| `dist/` | Complete, deployable static site |

Edit source files, then rebuild. Changes to `dist/` alone will be overwritten. To add a paper, add an object to the publications JSON; the list and downloadable bibliography are generated from that single source. The homepage's five chosen papers are defined in the build template. CV content is shared by HTML and PDF through the JSON files.

### Rebuild the CV PDF

The PDF is typeset with LaTeX, with embedded fonts, selectable text and clickable links. Normal website builds and GitHub Pages need only Node: they use the checked-in PDF and verify that its contents match the current source. Editing CV content or layout requires Tectonic and Poppler (`pdfinfo`) to regenerate it:

```sh
npm run build:cv
npm run build
npm run check
```

Use `npm run build:cv -- --offline` when the required TeX resources are already cached. The typesetting step rejects extra pages, overfull boxes, missing glyphs and font substitutions. The ordinary website build rejects a stale PDF. Render both pages with `pdftoppm` after layout changes to inspect wrapping, alignment and spacing.

`cv/alexandros-haliassos-cv.tex` is also a standalone document that can be compiled in a LaTeX editor. In this repository, edit the JSON and `cv/template.tex`, then regenerate; direct edits to the generated `.tex` are overwritten. 

The main pages use relative navigation and assets so they also open directly from the filesystem. The 404 page uses paths relative to the site root so its assets and recovery links work at nested missing URLs, including when hosted under a subdirectory. To set the canonical origin at build time:

```sh
SITE_URL=https://example.com node scripts/build.mjs
```

The public default is `https://ahaliassos.github.io`. This is a publishing destination, not a claim that this version is live there.

## GitHub Pages

This repository is prepared for `https://ahaliassos.github.io`. The publishing workflow runs on pushes to `master` and can also be run manually from Actions. It installs Node.js 24, builds and checks the website, and uploads only `dist/` as the Pages artifact. The deployment job then configures Pages and publishes that artifact.

For first-time setup, open **Settings → Pages** and set **Source → GitHub Actions**. If GitHub has disabled Actions for this fork, enable workflows from the **Actions** tab. Then run **Publish website** on `master` (or rerun its failed deployment job).

The canonical site URL comes from `data/profile.json`. If a custom domain is added later, update that URL and the GitHub Pages domain setting together; regenerate the CV PDF if its website link changes. `SITE_URL` can override the canonical URL for a separate preview build.

Editorial notes, local QA artifacts, local hosting metadata and generated `dist/` are ignored by Git and excluded from the source upload. The previous template remains available in the repository history; its original licence is retained in `LICENSE`.

## Checks

`npm run check` verifies publication records, unique page IDs, local links and fragments (including nested missing URLs), protected BibTeX names and matching inline/downloaded citations, metadata, all generated documents, image dimensions, search/topic combinations, empty results and reset behaviour. Content is present in HTML without JavaScript. Filters and clipboard controls progressively enhance it.

The October 2026 improvements were also checked in an isolated build with a subdirectory `SITE_URL`. A cached Tectonic/BibTeX run confirmed that CTC, BRAVEn, Auto-AVSR, SparseVSR and SVTS retain their capitalisation under title-case conversion.

The automated checks cover generated files and script behaviour. They do not verify live browser layouts or external URL availability. Review desktop and mobile layouts and the main links before release. Both PDF pages and the social image have been visually inspected. The design includes responsive layouts, reduced-motion support and keyboard focus styles.

## Optional sharing image regeneration

The PNG is checked in, so regular builds need no image tools. Its vector design source is `assets/social-preview.svg`; `scripts/social.mjs` renders the same layout to PDF for portable rasterisation with Poppler:

```sh
node scripts/social.mjs
pdftoppm -png -singlefile -scale-to-x 1200 -scale-to-y 630 .artifacts/social-preview.pdf assets/social-preview
npm run build
```
