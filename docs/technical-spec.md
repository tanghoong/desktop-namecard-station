# Technical Specification — Namecard Station

> **Version:** 0.1.0 (MVP)
> **Status:** Draft
> **Last Updated:** 2026-05-24

---

## 1. Overview

Namecard Station is a local-first, Dockerized web application that lets a phone browser auto-capture front and back images of business cards and save them to the host computer's filesystem. The phone performs all capture decisions (stability detection, countdown, image capture) locally; the server only receives uploaded images and writes them to disk.

---

## 2. System Architecture

```
┌──────────────────────┐       HTTP (LAN)       ┌──────────────────────────┐
│   Phone Browser      │ ──────────────────────> │   Computer (Docker)      │
│                      │                         │                          │
│  - Camera preview    │   POST /api/cards/start │  - Fastify HTTP server   │
│  - Stability detect  │   POST /api/cards/:id/  │  - Filesystem storage    │
│  - Auto countdown    │       front             │  - Card folder manager   │
│  - Image capture     │   POST /api/cards/:id/  │  - Static file serving   │
│  - Upload            │       back              │                          │
│                      │   POST /api/cards/:id/  │  Volume: ./data:/app/data│
│                      │       complete          │                          │
└──────────────────────┘                         └──────────────────────────┘
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Phone handles capture logic | Phone has the camera; avoids streaming video over LAN |
| No live video to server | Eliminates WebRTC complexity, latency, and bandwidth issues |
| Filesystem as source of truth | No database dependency; data survives any index corruption |
| Immediate image upload | Don't wait for both sides; prevents data loss on disconnect |
| One folder per card | Simple, portable, human-readable structure |

---

## 3. Technology Stack

### Frontend (`apps/web/`)

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Framework | React 18+ | Component model fits capture state machine |
| Language | TypeScript | Type safety for state machine and API contracts |
| Bundler | Vite | Fast dev server, good PWA support |
| Styling | CSS Modules or Tailwind | Keep it simple for MVP |
| Camera API | `getUserMedia` / MediaDevices | Standard web API, works on mobile browsers — request rear camera + high resolution |
| HTTP Client | `fetch` or `ky` | Lightweight |
| PWA | Optional for MVP | Install prompt for better mobile UX |

### Backend (`apps/server/`)

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Runtime | Node.js 20+ (LTS) | Broad ecosystem, Docker-friendly |
| Framework | Fastify 5 | Fast, TypeScript-native, schema validation built-in |
| File Uploads | `@fastify/multipart` | Streaming multipart handling |
| Static Files | `@fastify/static` | Serve frontend build and card images |
| CORS | `@fastify/cors` | Allow LAN access from phone |
| ID Generation | `crypto.randomUUID()` or `nanoid` | Short unique folder names |

### Infrastructure

| Concern | Choice |
|---------|--------|
| Containerization | Docker + Docker Compose |
| Base Image | `node:20-alpine` |
| Volume | `./data:/app/data` (bind mount) |
| Port | `3000` |

---

## 4. Data Model

### 4.1 Folder Structure

```
data/
└── cards/
    └── {cardId}/                  # e.g., 2026-05-24_230501_ab12
        ├── front.original.jpg     # Uncropped front capture
        ├── front.jpg              # Cropped front (guide frame)
        ├── back.original.jpg      # Uncropped back capture
        ├── back.jpg               # Cropped back (guide frame)
        ├── metadata.json          # Capture metadata
        ├── status.json            # Processing pipeline status
        ├── ocr_raw.txt            # (v2) Raw OCR output
        ├── contact.draft.json     # (v2) AI-parsed contact
        └── contact.md             # Human-readable draft
```

### 4.2 `metadata.json`

```json
{
  "id": "2026-05-24_230501_ab12",
  "created_at": "2026-05-24T23:05:01+08:00",
  "updated_at": "2026-05-24T23:06:22+08:00",
  "source": "mobile-web-camera",
  "capture_mode": "auto-front-back",
  "app_version": "0.1.0",
  "device": {
    "user_agent": "",
    "screen_width": 0,
    "screen_height": 0
  },
  "files": {
    "front_original": "front.original.jpg",
    "front": "front.jpg",
    "back_original": "back.original.jpg",
    "back": "back.jpg"
  },
  "tags": [],
  "notes": ""
}
```

### 4.3 `status.json`

```json
{
  "capture": "done",
  "front": "done",
  "back": "done",
  "ocr": "pending",
  "ai_parse": "pending",
  "review": "pending",
  "export": "pending",
  "errors": []
}
```

**Status values per field:** `pending` | `in_progress` | `done` | `failed`

**Capture field values:** `pending` | `partial` | `done`

### 4.4 `contact.md`

```markdown
# Business Card Draft

## Status
- Capture: done
- OCR: pending
- AI Parse: pending
- Review: pending

## Images
- Front: `front.jpg`
- Back: `back.jpg`

## Extracted Contact
Name:
Company:
Job Title:
Phone:
Email:
Website:
Address:

## OCR Raw Text
Pending.

## Notes
```

### 4.5 `contact.draft.json` (v2)

```json
{
  "name": "",
  "company": "",
  "job_title": "",
  "phone": [],
  "email": [],
  "website": [],
  "address": "",
  "social": [],
  "notes": "",
  "confidence": {
    "overall": 0,
    "name": 0,
    "company": 0,
    "phone": 0,
    "email": 0
  }
}
```

---

## 5. Capture State Machine

The phone client uses an explicit TypeScript state machine:

```typescript
type CaptureState =
  | "idle"
  | "waiting_front"
  | "detecting_front"
  | "countdown_front"
  | "capturing_front"
  | "uploading_front"
  | "waiting_back"
  | "detecting_back"
  | "countdown_back"
  | "capturing_back"
  | "uploading_back"
  | "done"
  | "error";
```

### State Transitions

| From | To | Trigger |
|------|----|---------|
| `idle` | `waiting_front` | User taps "Start Capture" |
| `waiting_front` | `detecting_front` | Camera stream ready |
| `detecting_front` | `countdown_front` | Stability + brightness + content OK for 800–1200ms |
| `countdown_front` | `detecting_front` | Motion detected during countdown |
| `countdown_front` | `capturing_front` | Countdown completed |
| `capturing_front` | `uploading_front` | Frame extracted from canvas |
| `uploading_front` | `waiting_back` | `POST /api/cards/:id/front` success |
| `waiting_back` | `detecting_back` | Auto: frame analysis resumes immediately; content-change threshold crossed after flip |
| `detecting_back` | `countdown_back` | Stability + brightness + content OK |
| `countdown_back` | `detecting_back` | Motion detected during countdown |
| `countdown_back` | `capturing_back` | Countdown completed |
| `capturing_back` | `uploading_back` | Frame extracted from canvas |
| `uploading_back` | `done` | `POST /api/cards/:id/back` + `/complete` success |
| `*` | `error` | Any unrecoverable error |

---

## 6. Auto-Capture Detection

Detection runs as a **continuous loop** at ~100ms intervals from the moment the camera stream is ready — similar to how face-detection UIs work. There is no manual trigger for any transition except the initial "Start Capture" button. The system watches the frame at all times and advances the state machine automatically when conditions are met.

Four checks run on every frame sample:

### 6.1 Brightness Check

- Sample a downscaled frame (160×120).
- Compute mean brightness: `(R + G + B) / 3`.
- Valid range: `40 ≤ brightness ≤ 230`.

### 6.2 Motion Stability Check

- Compare current frame vs previous frame pixel difference.
- Use downscaled frames for performance.
- Threshold: mean pixel difference `< 12`.
- Must remain stable for **5 consecutive samples (~500ms)**. *(Confirmed via device testing: 8–12 was too slow for handheld capture.)*

### 6.3 Center Content Check

- Extract the guide-frame region from the frame.
- Compute contrast (standard deviation of luminance).
- Threshold: `contrast > 20`.
- Prevents capturing empty desks or blurred frames.

### 6.4 Edge Density Check

- Extract the guide-frame region (downscaled to 80×50).
- Compute horizontal + vertical gradient magnitude per pixel: `|lum(x) - lum(x+1)| + |lum(y) - lum(y+1)|`.
- Count fraction of pixels where gradient > 20.
- Threshold: **edge density > 4%**.
- Purpose: a plain desk or wall has 1–2% edge pixels; a business card with text/logos has 8–15%. Prevents triggering on background surfaces.

```typescript
function calcEdgeDensity(d: Uint8ClampedArray, w: number, h: number): number {
  let edges = 0;
  const total = (w - 1) * (h - 1);
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const i  = (y * w + x) * 4;
      const ir = (y * w + x + 1) * 4;
      const id = ((y + 1) * w + x) * 4;
      const lum = (v: number) => 0.299*d[v] + 0.587*d[v+1] + 0.114*d[v+2];
      if (Math.abs(lum(i) - lum(ir)) + Math.abs(lum(i) - lum(id)) > 20) edges++;
    }
  }
  return edges / total;
}
```

### 6.5 Flip Detection (waiting_back → detecting_back)

After the front image uploads, the system stays in `waiting_back` and continues sampling frames. It automatically transitions to `detecting_back` when:

1. **Motion spike**: mean pixel diff > **45** — card is being picked up and flipped.
2. **Settled**: motion diff drops back below stability threshold for **4 consecutive frames** (~400ms).

A manual "Back Side Ready" button is also shown as fallback. The UI shows "Flip the card — auto-detecting…" during `waiting_back`.

---

## 7. Camera Constraints

Request the rear camera at high resolution. Business cards have small text — resolution matters for later OCR.

```typescript
const stream = await navigator.mediaDevices.getUserMedia({
  video: {
    facingMode: { exact: 'environment' }, // rear camera only
    width:  { ideal: 1920 },
    height: { ideal: 1080 },
  },
  audio: false,
});
```

> `{ exact: 'environment' }` rejects if no rear camera. Use `{ ideal: 'environment' }` as fallback if you want desktop testing to still work (front camera will be used instead).

Attach to `<video>` with `autoplay playsinline muted`. `playsinline` is required on Android to prevent full-screen takeover.

---

## 8. Guide Frame & Cropping

```
┌──────────────────────────────┐
│                              │
│   ┌────────────────────┐     │
│   │                    │     │
│   │   Place card here  │     │  ← Guide frame (aspect ratio ~1.585:1)
│   │                    │     │
│   └────────────────────┘     │
│                              │
│         [ 3 ]                │  ← Countdown overlay
└──────────────────────────────┘
```

### Frame Dimensions (CSS)

Standard business card is 85.6 × 54mm (ratio 1.585:1). On a phone held portrait:

```
frameWidth  = min(viewport.width * 0.85, 360px)
frameHeight = frameWidth / 1.585
```

Position the frame horizontally and vertically centered in the viewport.

### Canvas Coordinate Scaling

The `<video>` element is displayed smaller than the actual camera resolution. When cropping, you must map CSS pixel coordinates to actual video pixel coordinates:

```typescript
const scaleX = video.videoWidth  / video.clientWidth;
const scaleY = video.videoHeight / video.clientHeight;

const sx = guideFrame.offsetLeft   * scaleX;
const sy = guideFrame.offsetTop    * scaleY;
const sw = guideFrame.clientWidth  * scaleX;
const sh = guideFrame.clientHeight * scaleY;

ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
```

### Capture Format

Always encode as JPEG before upload. PNG from canvas is 3–5× larger and unnecessary for photos:

```typescript
canvas.toBlob((blob) => { /* upload blob */ }, 'image/jpeg', 0.88);
```

Quality `0.88` preserves text readability for OCR without excessive file size.

---

## 9. Error Handling

### Phone-Side Errors

| Error | Handling |
|-------|----------|
| Camera permission denied | Show message with instructions to enable camera |
| No camera found | Show message |
| Upload failed | Retry up to 3 times with exponential backoff; allow manual retry |
| Network disconnected | Show "Connection lost" overlay; auto-retry on reconnect |
| Countdown interrupted | Return to `detecting_*` state |
| Image capture failed | Retry capture; fall back to error state |

### Server-Side Errors

| Error | HTTP Status | Handling |
|-------|-------------|----------|
| Invalid `cardId` | 404 | Return error JSON |
| Folder create failed | 500 | Log error, return 500 |
| File write failed | 500 | Log error, return 500 |
| File too large (>20MB) | 413 | Return error with size limit info |
| Unsupported image type | 415 | Return error with accepted types |
| Missing file in multipart | 400 | Return validation error |

---

## 10. Security Considerations

- **LAN-only by default**: Server listens on `0.0.0.0:3000` for LAN access but is not exposed to the internet.
- **No authentication in MVP**: The app is designed for single-user, trusted LAN environments.
- **File size limits**: Max upload size of 20MB per image.
- **Allowed MIME types**: `image/jpeg`, `image/png`, `image/webp`.
- **Path traversal protection**: `cardId` validated to prevent directory traversal.

### Camera Access

Android Chrome and Huawei Browser both require a **secure context** (`https://` or `localhost`) for `getUserMedia`. A plain `http://192.168.x.x` LAN URL will block camera access.

#### Option A — `adb reverse` (Recommended for personal use, no cert needed)

Connect phone via USB with Developer Mode enabled:

```bash
adb reverse tcp:3000 tcp:3000
```

The phone then accesses `http://localhost:3000` — which is a secure context by browser definition. No certificate, no nginx. Works with Android Chrome and Huawei Browser.

Requirements: ADB installed ([Android Platform Tools](https://developer.android.com/tools/releases/platform-tools)), USB cable, Developer Mode on phone.

#### Option B — `mkcert` local HTTPS (Wi-Fi access without USB)

```bash
# Install mkcert, then:
mkcert -install
mkcert 192.168.1.25  # use your actual LAN IP
```

Configure Fastify to use the generated cert, or add an nginx sidecar in `docker-compose.yml`. Phone must trust the local CA (copy `rootCA.pem` to phone and install).

#### Scope

iOS Safari support is out of scope — this tool targets Android Chrome and Huawei Browser only.

---

## 11. Docker Configuration

### `Dockerfile`

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/web/package*.json apps/web/
COPY apps/server/package*.json apps/server/
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY package*.json apps/server/package*.json ./
RUN npm ci --omit=dev
EXPOSE 3000
CMD ["node", "apps/server/dist/index.js"]
```

### `docker-compose.yml`

```yaml
services:
  namecard-station:
    build: .
    container_name: namecard-station
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DATA_DIR=/app/data
    restart: unless-stopped
```

---

## 12. Development Workflow

### Phase 0 — Test Page Only (no Node.js, no Docker)

Serve the standalone test page with any static file server. The test page is pure HTML/JS with no build step:

```bash
# Option A: Python (always available)
python -m http.server 3000

# Option B: Node.js one-liner
npx serve -p 3000 .

# Option C: VS Code Live Server extension pointing to port 3000
```

Then on your Android phone (USB connected):

```bash
adb reverse tcp:3000 tcp:3000
# Open http://localhost:3000/test on phone browser
```

### Phase 1+ — Full Stack

```bash
# Install dependencies
npm install

# Start backend dev server
cd apps/server && npm run dev

# Start frontend dev server (separate terminal)
cd apps/web && npm run dev

# Build for production
npm run build

# Docker build and run
docker compose up -d --build
```

---

## 13. Testing Strategy

| Layer | Approach |
|-------|----------|
| Server routes | Integration tests with `fastify.inject()` |
| Storage service | Unit tests with temp directories |
| Capture state machine | Unit tests for state transitions |
| Detection algorithms | Unit tests with mock `ImageData` |
| Frontend components | React Testing Library / Vitest |
| E2E | Manual testing with real phone on LAN |

---

## 14. Performance Targets

| Metric | Target |
|--------|--------|
| Frame analysis interval | 100ms |
| Stability detection window | ~500ms (5 frames × 100ms) |
| Image upload time (Wi-Fi) | < 2s per image |
| Server cold start | < 5s |
| Docker image size | < 300MB |
| Page load (LAN) | < 3s |

---

## 15. Appendix: ID Format

Card IDs use the format:

```
YYYY-MM-DD_HHmmss_xxxx
```

Example: `2026-05-24_230501_ab12`

- `YYYY-MM-DD_HHmmss`: Capture start timestamp (local time).
- `xxxx`: 4 random lowercase hex characters from `nanoid` or `crypto.randomUUID()`.
- Total length: 22 characters.
- Filesystem-safe on all major OSes.