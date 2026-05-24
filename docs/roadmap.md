# Roadmap — Namecard Station

> Last updated: 2026-05-24

---

## Pre-Development — Camera Detection Test Page

**Goal:** Validate that the phone camera and frame-analysis algorithms work on the actual device before writing any React or Fastify code.

Build a single standalone HTML file (`/test` route or `public/test.html`) — no framework, no build step. It should:

- Open camera via `getUserMedia` and display live preview
- Sample frames every 100ms and compute all three checks
- Show a real-time debug overlay:
  - Current brightness value + pass/fail
  - Current motion diff value + pass/fail
  - Current contrast value + pass/fail
  - Overall: READY / NOT READY
- Show a manual "Capture Now" button to test JPEG blob creation and display
- Show the canvas crop of the guide-frame region

**Pass criteria to proceed to full development:**

1. Camera opens on Android Chrome via `adb reverse` at `http://localhost:3000/test`
2. Holding a still business card for 1–2 seconds shows READY in the overlay
3. Moving the card resets to NOT READY
4. Manual capture produces a visible JPEG crop

This test page stays in the repo as a diagnostic tool.

### GitHub Issue

| # | Issue                      | Description                                                                                |
|---|----------------------------|--------------------------------------------------------------------------------------------|
| 0 | Camera Detection Test Page | Standalone HTML test harness - camera access, frame analysis debug overlay, manual capture |

---

## MVP 0 — Core Capture (Current)

**Goal:** Reliably capture front & back images of a business card and save them to disk.

### Features

- [ ] Camera detection test page passes on Android device
- [ ] Docker Compose local server on port 3000
- [ ] `/capture` page with mobile camera preview
- [ ] Fixed business card guide frame overlay
- [ ] Brightness detection (warn if too dark/bright)
- [ ] Motion stability detection
- [ ] Center content contrast check
- [ ] Auto 3-2-1 countdown when stable
- [ ] Countdown cancellation if motion detected
- [ ] Front image capture from `<canvas>`
- [ ] Immediate front upload to server
- [ ] "Flip card" prompt for back side
- [ ] Back image auto-capture and upload
- [ ] Server: one folder per card under `./data/cards/`
- [ ] Server: `metadata.json` generation
- [ ] Server: `status.json` generation
- [ ] Server: `contact.md` draft generation
- [ ] `/cards` list page
- [ ] `/cards/:cardId` detail page (view images, status, contact draft)
- [ ] Partial capture support (front-only cards)
- [ ] Resume/retake/delete draft card actions

### GitHub Issues

| # | Issue | Description |
|---|-------|-------------|
| 1 | Project Bootstrap | Dockerfile, docker-compose, `/health`, home page |
| 2 | Local File Storage Service | `POST /api/cards/start`, folder creation, metadata/status |
| 3 | Image Upload API | `POST /api/cards/:id/front`, `:id/back`, multipart upload |
| 4 | Mobile Capture Page | Camera preview, guide frame, manual capture, front/back flow |
| 5 | Auto Capture Detection | Brightness, stability, content checks, auto countdown |
| 6 | Card Complete Flow | `/complete` endpoint, contact.md, status update |
| 7 | Cards List & Detail Page | `/cards`, `/cards/:id`, image display, metadata view |
| 8 | Basic Export | Download contact.md, metadata.json per card |

---

## MVP 1 — Local OCR

**Goal:** Extract raw text from card images using local OCR.

### Features

- [ ] Integrate Tesseract.js for browser-side OCR
- [ ] Integrate Tesseract CLI for server-side OCR
- [ ] OCR worker: scan `data/cards/` for `status.json` with `ocr: "pending"`
- [ ] Write `ocr_raw.txt` to card folder
- [ ] Update `status.json` → `ocr: "done"`
- [ ] Update `contact.md` with raw OCR text
- [ ] "Run OCR" button on card detail page
- [ ] "Run OCR for all pending" button on cards list page
- [ ] Background interval worker (optional, every 10s)

### GitHub Issues

| # | Issue | Description |
|---|-------|-------------|
| 9 | Server-Side OCR Worker | Tesseract CLI integration, folder scanner, ocr_raw.txt output |
| 10 | Browser-Side OCR Option | Tesseract.js for per-card on-demand OCR |
| 11 | OCR Trigger UI | Buttons on detail and list pages |
| 12 | OCR Status & Error Handling | Progress feedback, error states, re-run support |

---

## MVP 2 — AI Parser

**Goal:** Parse raw OCR text into structured contact fields using an LLM.

### Features

- [ ] Configurable AI provider (OpenAI / Gemini / OpenRouter)
- [ ] Prompt template for business card parsing
- [ ] Input: `ocr_raw.txt`
- [ ] Output: `contact.draft.json` with confidence scores
- [ ] Update `contact.md` with parsed fields
- [ ] Update `status.json` → `ai_parse: "done"`
- [ ] "Parse with AI" button on card detail page
- [ ] API key configuration via environment variables
- [ ] Cost estimation display before parsing
- [ ] Batch AI parsing for all pending cards

### GitHub Issues

| # | Issue | Description |
|---|-------|-------------|
| 13 | AI Provider Abstraction | OpenAI, Gemini, OpenRouter adapter pattern |
| 14 | Card Parsing Prompt | Structured prompt template, JSON output format |
| 15 | Parser Output Pipeline | ocr_raw.txt → contact.draft.json → contact.md |
| 16 | AI Parser UI | Per-card & batch trigger buttons, cost estimate |

---

## MVP 3 — Review & Edit UI

**Goal:** Allow users to review and correct AI-parsed contact fields.

### Features

- [ ] Editable contact form on card detail page
- [ ] Side-by-side view: card image ↔ editable fields
- [ ] Field-level confidence indicators (color-coded)
- [ ] Save edited fields to `contact.draft.json`
- [ ] Update `contact.md` with reviewed data
- [ ] Update `status.json` → `review: "done"`
- [ ] Keyboard shortcuts for fast review (Tab, Enter, Escape)
- [ ] Bulk review mode: paginated card-by-card review flow
- [ ] Review progress dashboard

### GitHub Issues

| # | Issue | Description |
|---|-------|-------------|
| 17 | Contact Edit Form | Editable fields, side-by-side image view |
| 18 | Confidence Display | Color-coded field confidence from AI parser |
| 19 | Review Status Tracking | status.json review field, progress dashboard |
| 20 | Bulk Review Mode | Sequential card review flow with keyboard nav |

---

## MVP 4 — Export & Integration

**Goal:** Export contact data to common formats and services.

### Features

- [ ] Export single card as vCard (`.vcf`)
- [ ] Export single card as CSV row
- [ ] Export all cards as CSV
- [ ] Export all cards as JSON array
- [ ] Download card folder as `.zip`
- [ ] Bulk export with status filters (e.g., "export all reviewed")
- [ ] Optional: Google Contacts API integration (one-way push)
- [ ] Optional: Apple Contacts CSV format

### GitHub Issues

| # | Issue | Description |
|---|-------|-------------|
| 21 | vCard Export | .vcf single-card export |
| 22 | CSV Export | Single & bulk CSV with field mapping |
| 23 | JSON Export | Full dataset export as JSON array |
| 24 | ZIP Archive Export | Download card folder with all files |
| 25 | Google Contacts Integration | OAuth, one-way push, field mapping |

---

## Future — Beyond MVP

Ideas for long-term exploration (not committed):

- **SQLite search index**: Fast full-text search across all cards without scanning filesystem
- **Multi-language OCR**: Tesseract language packs for non-English cards
- **Image enhancement**: Auto-rotate, perspective correction, contrast boost
- **Duplicate detection**: Image similarity to prevent re-capturing the same card
- **Tags & collections**: Organize cards with user-defined tags
- **Webhook notifications**: Trigger external workflows on new card capture
- **Desktop app wrapper**: Electron or Tauri for native OS experience
- **Multi-user support**: Lightweight auth for small team usage on same LAN
- **Mobile PWA**: Install to home screen, offline queue, background sync

---

## Version History

| Version | Date | Milestone |
|---------|------|-----------|
| 0.1.0 | TBD | MVP 0 — Core Capture |
| 0.2.0 | TBD | MVP 1 — Local OCR |
| 0.3.0 | TBD | MVP 2 — AI Parser |
| 0.4.0 | TBD | MVP 3 — Review & Edit UI |
| 0.5.0 | TBD | MVP 4 — Export & Integration |
| 1.0.0 | TBD | Stable release with all MVP features |